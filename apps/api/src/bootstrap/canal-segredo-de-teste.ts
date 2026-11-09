/**
 * `npm run canal:segredo-de-teste -w @n1/api -- --canal <id>` (16-02, D-16-03, MSG-05)
 *
 * Gera o segredo do webhook de um Canal SIMULADO, guarda no cofre (`plataforma.credenciais`,
 * `donoTipo: "canal"`, `tipo: "webhook_segredo"`), revogando o anterior, e o mostra UMA vez. Não existe
 * segredo fixo de teste: cada Canal simulado tem o seu, e o provedor de teste recusa a chamada sem ele.
 * Um Canal real é recusado: o WhatsApp de verdade se liga por `canal:ligar-evolution`.
 *
 * O segredo sai só no `stdout` deste comando, uma vez; nunca em log, arquivo nem mensagem de erro.
 * O Canal é achado só por `id` (o comando não recebe Espaço): se o mesmo id existir em dois Espaços,
 * recusa em vez de adivinhar.
 *
 * Saída: 0 ok, 2 recusa ou erro de uso, 1 erro inesperado. `principal` não chama `process.exit`.
 */

import { randomBytes } from "node:crypto";
import type { Pool } from "pg";
import { CABECALHO_DO_SEGREDO, TIPO_DO_SEGREDO_DO_WEBHOOK } from "../mensageria/provedor";
import { guardarCredencial, type ChavesDoCofre } from "../servicos/cofre";

/** Uma recusa esperada (argumento, Canal inexistente, real ou arquivado): o comando sai com 2. */
export class RecusaDoSegredo extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "RecusaDoSegredo";
  }
}

export const USO = [
  "Uso: npm run canal:segredo-de-teste -w @n1/api -- --canal <id>",
  "  Gera o segredo do webhook de um Canal SIMULADO e o mostra uma vez; um novo segredo revoga o anterior.",
].join("\n");

export interface ArgumentosDoSegredo {
  readonly canal: string;
}

/** Lê e valida os argumentos. Lança `RecusaDoSegredo`; não toca em banco nem em ambiente. */
export function lerArgumentos(argv: readonly string[]): ArgumentosDoSegredo {
  let canal: string | undefined;
  let i = 0;
  while (i < argv.length) {
    const atual = argv[i]!;
    if (atual === "--canal" || atual.startsWith("--canal=")) {
      if (canal !== undefined) throw new RecusaDoSegredo("--canal só pode aparecer uma vez: o comando gera o segredo de um Canal por execução.");
      if (atual.startsWith("--canal=")) {
        canal = atual.slice("--canal=".length);
        i += 1;
      } else {
        canal = argv[i + 1];
        i += 2;
      }
      if (canal === undefined || canal === "" || canal.startsWith("--")) throw new RecusaDoSegredo("Falta o valor de --canal.");
    } else {
      throw new RecusaDoSegredo(`Argumento desconhecido: ${atual}.`);
    }
  }
  if (canal === undefined) throw new RecusaDoSegredo("Falta --canal <id>.");
  return { canal };
}

export interface ResultadoDoSegredo {
  readonly segredo: string;
  readonly canalId: string;
  readonly workspaceId: string;
}

interface LinhaDoCanal {
  readonly id: string;
  readonly workspace_id: string;
  readonly conexao_simulada: boolean;
  readonly estado: string;
}

/** Acha o Canal (exatamente uma linha), recusa o que não for simulado ou estiver arquivado e guarda o segredo novo, numa transação. */
export async function gerarSegredoDeTeste(entrada: {
  readonly pool: Pick<Pool, "connect">;
  readonly chaves: ChavesDoCofre;
  readonly canalId: string;
}): Promise<ResultadoDoSegredo> {
  const cliente = await entrada.pool.connect();
  try {
    await cliente.query("begin");
    // `for update`: o Canal não deixa de ser simulado entre a conferência e o INSERT do segredo.
    const { rows } = await cliente.query<LinhaDoCanal>(
      "select id, workspace_id, conexao_simulada, estado from plataforma.canais where id = $1 for update",
      [entrada.canalId],
    );
    if (rows.length === 0) throw new RecusaDoSegredo("Canal não encontrado.");
    if (rows.length > 1) {
      throw new RecusaDoSegredo("Há mais de um Canal com esse id (em Espaços diferentes); o comando não adivinha qual.");
    }
    const canal = rows[0]!;
    if (!canal.conexao_simulada) {
      throw new RecusaDoSegredo(
        "Este comando só gera segredo para Canal simulado (D-16-03). Para um WhatsApp de verdade, use `canal:ligar-evolution`.",
      );
    }
    // Defesa em profundidade: `canais_arquivado_desconectado_ck` e `canais_simulada_ck` (008) já impedem um
    // Canal arquivado e simulado ao mesmo tempo.
    if (canal.estado !== "ativo") throw new RecusaDoSegredo("Este Canal está arquivado; restaure-o antes de gerar o segredo.");

    const segredo = randomBytes(32).toString("hex");
    await guardarCredencial(cliente, entrada.chaves, {
      workspaceId: canal.workspace_id,
      donoTipo: "canal",
      donoId: canal.id,
      tipo: TIPO_DO_SEGREDO_DO_WEBHOOK,
      segredo,
    });
    await cliente.query("commit");
    return { segredo, canalId: canal.id, workspaceId: canal.workspace_id };
  } catch (erro) {
    await cliente.query("rollback").catch(() => undefined);
    throw erro;
  } finally {
    cliente.release();
  }
}

export interface DependenciasDoSegredo {
  readonly pool: () => Pick<Pool, "connect">;
  readonly chaves: () => ChavesDoCofre;
  readonly saida: { out(texto: string): void; err(texto: string): void };
}

/** Roda o comando e devolve o código de saída. Argumento errado sai antes de pedir pool ou chaves. */
export async function principal(argv: readonly string[], deps: DependenciasDoSegredo): Promise<number> {
  let argumentos: ArgumentosDoSegredo;
  try {
    argumentos = lerArgumentos(argv);
  } catch (erro) {
    if (erro instanceof RecusaDoSegredo) {
      deps.saida.err(`${erro.message}\n\n${USO}`);
      return 2;
    }
    throw erro;
  }

  try {
    const chaves = deps.chaves();
    const r = await gerarSegredoDeTeste({ pool: deps.pool(), chaves, canalId: argumentos.canal });
    const caminho = `/webhooks/mensageria/${r.canalId}`;
    const corpo = JSON.stringify({
      eventos: [{ tipo: "mensagem", idExterno: "teste-1", remetente: { tipo: "whatsapp", valor: "+5511987654321" }, conteudo: "oi" }],
    });
    deps.saida.out(
      [
        `Segredo do webhook do Canal ${r.canalId} (Espaço ${r.workspaceId}):`,
        "",
        `  segredo    ${r.segredo}`,
        `  endereço   POST ${caminho}`,
        `  cabeçalho  ${CABECALHO_DO_SEGREDO}`,
        "",
        "Este segredo não será mostrado de novo: copie agora. Rodar o comando outra vez revoga este e gera outro.",
        "",
        "Exemplo (troque <host-da-api> pelo endereço da API):",
        `curl -X POST https://<host-da-api>${caminho} \\`,
        `  -H "content-type: application/json" \\`,
        `  -H "${CABECALHO_DO_SEGREDO}: ${r.segredo}" \\`,
        `  -d '${corpo}'`,
      ].join("\n"),
    );
    return 0;
  } catch (erro) {
    if (erro instanceof RecusaDoSegredo) {
      deps.saida.err(erro.message);
      return 2;
    }
    // Só a mensagem: nunca o objeto do erro, que pode carregar a URL do banco ou o detalhe de uma linha.
    deps.saida.err(`Falhou: ${erro instanceof Error ? erro.message : String(erro)}`);
    return 1;
  }
}
