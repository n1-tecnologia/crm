/**
 * `npm run gravacao:medir -w @n1/api -- [--repeticoes=10] [--workspace=<id> --confirmar-espaco] [--membro=<id>]`
 *
 * O comando que mede a gravação (Fase 12, D-01/D-02/D-04/D-05/D-17): repete
 * `createList`, `updateContainer`, `trashContainer` (um Espaço com Listas) e
 * `changeTaskStatus` e imprime, por gesto e por etapa, a mediana e o pior caso,
 * mais `select 1`, `hidratar` direto, `GET /estado` e o tamanho de
 * `plataforma.registros`. O MESMO comando, sem mudança, mede o "antes" e o "depois".
 *
 * D-17: ele sobe o PRÓPRIO Fastify (`buildApp`, o mesmo código do serviço) em
 * `127.0.0.1`, porta efêmera, neste processo, com o logger capturado num array:
 * as etapas vêm da linha "gravacao medida" de 12-01, sem `Server-Timing` nem campo
 * na resposta. É processo à parte do serviço `n1-crm-api`: mesmo código, mesmo
 * banco, mesma rede; não pega o pool quente do serviço nem o nginx/TLS.
 *
 * Autenticação: o `verificarToken` abaixo é um STUB que só existe neste arquivo.
 * Este arquivo NÃO exporta nada e ninguém o importa (nem `app.ts`, nem `index.ts`):
 * o stub só aceita o token aleatório (`randomUUID`) que ESTE processo gera, o
 * Fastify escuta só em loopback e fecha no `finally`. Não há variável de ambiente
 * que o ligue e nenhum segredo vai para arquivo. O Membro que assina as gravações
 * é o Proprietário (`workspace.ownerMemberId`) ou o `--membro`, lido de
 * `plataforma.registros` junto com o `userId` dele.
 *
 * Rastro (D-04, aceito pelo dono): grava num Espaço de teste `ZZ-MEDICAO-<carimbo>`
 * dentro do Espaço de Trabalho, toca só ids que ele mesmo criou e manda os Espaços
 * de teste para a lixeira (nunca apaga). Ficam Atividade assinada pelo Proprietário
 * e os Espaços na lixeira.
 *
 * `--workspace` diferente de `WORKSPACE_ID` (padrão `ws_n1`) exige
 * `--confirmar-espaco`. Saída: 0 ok; 2 argumento inválido; 1 erro.
 *
 * A saída só tem nomes de operação e de coleção, contagens, bytes e milissegundos.
 */

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { buildApp } from "../app";
import { carregarEnv, encerrar, pool } from "../persistencia/conexao";
import { opcoesDoLogger } from "./log";
import { formatarRelatorio } from "./medicao-da-gravacao";
import { medirGravacao } from "./medir-gravacao";

/** Sinaliza saída não-zero sem `process.exit` direto — `encerrar()` sempre roda antes (molde de `reconciliacao.cli.ts`). */
class SairComCodigo extends Error {
  constructor(
    readonly codigo: number,
    mensagem?: string,
  ) {
    super(mensagem ?? `saída ${codigo}`);
  }
}

const argv = process.argv.slice(2);
const CONHECIDOS = ["repeticoes", "workspace", "membro", "confirmar-espaco"];

function valorDe(chave: string): string | undefined {
  const prefixo = `--${chave}=`;
  return argv.find((a) => a.startsWith(prefixo))?.slice(prefixo.length);
}

function argumentoInvalido(mensagem: string): never {
  throw new SairComCodigo(2, mensagem);
}

function lerArgumentos(): { repeticoes: number; workspaceId: string; membroId: string | undefined } {
  for (const a of argv) {
    const chave = a.startsWith("--") ? a.slice(2).split("=")[0] : undefined;
    if (!chave || !CONHECIDOS.includes(chave)) argumentoInvalido(`argumento desconhecido: ${a}`);
  }
  const bruto = valorDe("repeticoes");
  const repeticoes = bruto === undefined ? 10 : Number(bruto);
  if (!Number.isInteger(repeticoes) || repeticoes < 1 || repeticoes > 50) {
    argumentoInvalido("--repeticoes precisa ser um inteiro de 1 a 50.");
  }
  const padrao = process.env.WORKSPACE_ID ?? "ws_n1";
  const workspaceId = valorDe("workspace") ?? padrao;
  if (workspaceId !== padrao && !argv.includes("--confirmar-espaco")) {
    argumentoInvalido(`--workspace=${workspaceId} difere de WORKSPACE_ID (${padrao}): confirme com --confirmar-espaco.`);
  }
  return { repeticoes, workspaceId, membroId: valorDe("membro") };
}

/** O `userId` do Membro que assina as gravações: o Proprietário do Espaço de Trabalho, ou o `--membro`. Só leitura. */
async function usuarioDoMembro(workspaceId: string, membroId: string | undefined): Promise<string> {
  let id = membroId;
  if (!id) {
    const dono = await pool().query<{ dono: string | null }>(
      "select dados->>'ownerMemberId' as dono from plataforma.registros where workspace_id = $1 and colecao = 'workspace' limit 1",
      [workspaceId],
    );
    id = dono.rows[0]?.dono ?? undefined;
    if (!id) throw new Error(`O Espaço de Trabalho ${workspaceId} não existe ou não tem Proprietário.`);
  }
  const membro = await pool().query<{ usuario: string | null }>(
    "select dados->>'userId' as usuario from plataforma.registros where workspace_id = $1 and colecao = 'members' and id = $2",
    [workspaceId, id],
  );
  const usuario = membro.rows[0]?.usuario;
  if (!usuario) throw new Error(`O Membro ${id} não existe em ${workspaceId} ou não tem userId (convite pendente).`);
  return usuario;
}

/** O SHA que `instalar-release.sh` grava na raiz do release; fora da VPS não há. */
function revisaoDoCodigo(): string {
  try {
    return readFileSync(new URL("../../../../REVISION", import.meta.url), "utf8").trim() || "(sem REVISION)";
  } catch {
    return "(sem REVISION)";
  }
}

async function rodar(): Promise<void> {
  carregarEnv();
  const { repeticoes, workspaceId, membroId } = lerArgumentos();
  const usuario = await usuarioDoMembro(workspaceId, membroId);

  // O stub vive só aqui: aceita apenas o token que este processo acabou de gerar.
  const token = randomUUID();
  const verificarToken = async (t: string) => (t === token ? { sub: usuario } : null);

  const linhasDoLog: string[] = [];
  const destino = { write: (linha: string) => void linhasDoLog.push(linha) };
  const app = buildApp({
    logger: opcoesDoLogger({ ...process.env, LOG_LEVEL: "info" }, destino),
    workspaceId,
    verificarToken,
  });
  try {
    await app.listen({ host: "127.0.0.1", port: 0 });
    const baseUrl = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
    const relatorio = await medirGravacao({
      baseUrl,
      token,
      workspaceId,
      repeticoes,
      linhasDoLog: () => linhasDoLog,
      revisaoDoCodigo: revisaoDoCodigo(),
    });
    console.log(formatarRelatorio(relatorio));
  } finally {
    await app.close();
  }
}

try {
  await rodar();
} catch (erro) {
  const codigo = erro instanceof SairComCodigo ? erro.codigo : 1;
  console.error(erro instanceof Error ? erro.message : String(erro));
  await encerrar();
  process.exit(codigo);
}

await encerrar();
