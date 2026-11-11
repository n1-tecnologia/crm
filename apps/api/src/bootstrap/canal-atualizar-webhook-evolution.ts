/**
 * `npm run canal:atualizar-webhook-evolution -w @n1/api -- --canal <id> | --todos [--espaco <id>] [--seco]` (Sessão 4, 4.4.5)
 *
 * Uma instância da Evolution guarda a lista de eventos que o webhook dela manda ao CRM de QUANDO foi ligada. Quando o CRM passa a
 * precisar de eventos novos (o tique, a Mensagem apagada e a editada, desde a 4.4.5), a instância que já estava conectada
 * continua com a lista velha até alguém reaplicá-la: este comando faz isso, sem pedir um novo QR code.
 *
 * Para cada Canal `whatsapp-nao-oficial` ativo e de verdade (não simulado) chama `POST /webhook/set/<instancia>` com o TOKEN da
 * instância (o do cofre), o mesmo endereço de sempre (`<API_URL_PUBLICA>/webhooks/mensageria/<canalId>`), o segredo que JÁ está no
 * cofre e a lista atual de `EVENTOS_DO_WEBHOOK`. Rodar de novo é seguro: a Evolution só troca a configuração.
 *
 * Regras que valem para o arquivo inteiro:
 *   - Não escreve no banco e NÃO troca o segredo do webhook (quem troca é `canal:ligar-evolution`): lê o cofre e fala só com a
 *     Evolution. Não precisa da chave GLOBAL da Evolution, só do token da instância;
 *   - a instância `numeropvmarcos` (a do `automation/`) nunca é tocada, mesmo que apareça numa credencial;
 *   - Canal sem credencial ou sem segredo do webhook é PULADO com o motivo, nunca "consertado" à força;
 *   - nenhuma saída mostra o token, o segredo ou o número; só o id do Canal e o nome da instância;
 *   - `--seco` percorre o mesmo caminho e para antes do `webhook/set`.
 *
 * Saída: 0 ok (inclui pulados), 1 se alguma instância falhou ou erro inesperado, 2 recusa ou erro de uso. `principal` não chama
 * `process.exit`. Ambiente: `EVOLUTION_URL`, `API_URL_PUBLICA` (ou `--url-publica`), `COFRE_CHAVE` (a mesma do runtime) e o
 * `DATABASE_URL` de quem tem o cofre.
 */

import type { Pool } from "pg";
import { canalParaProvedor } from "../mensageria/registro";
import { EVENTOS_DO_WEBHOOK, urlDoWebhookDoCanal } from "../mensageria/provedores/evolution/ambiente";
import { criarClienteDaEvolution, type ClienteDaEvolution } from "../mensageria/provedores/evolution/cliente";
import { pool as poolPadrao } from "../persistencia/conexao";
import { criarRepositorioDeCanaisPg } from "../repositorios/crm/canais";
import { lerChavesDoCofre, type ChavesDoCofre } from "../servicos/cofre";
import { normalizarUrlPublica } from "./canal-ligar-evolution";

const INSTANCIA_DO_FINANCEIRO = "numeropvmarcos";
const PROVEDOR_DO_CANAL = "whatsapp-nao-oficial";

/** Uma recusa esperada (argumento, ambiente, Canal que não existe): o comando sai com 2. */
export class RecusaDoWebhook extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "RecusaDoWebhook";
  }
}

class ErroDeUso extends RecusaDoWebhook {}

export const USO = [
  "Uso: npm run canal:atualizar-webhook-evolution -w @n1/api -- (--canal <id> | --todos [--espaco <id>]) [--seco] [--url-publica <url>]",
  "  Reaplica nas instâncias da Evolution a lista atual de eventos do webhook (tique, apagada e editada, 4.4.5), sem pedir QR",
  "  code e sem trocar o segredo. --seco só mostra o que faria. Ambiente: EVOLUTION_URL, API_URL_PUBLICA (ou --url-publica) e COFRE_CHAVE.",
].join("\n");

export interface ArgumentosDoWebhook {
  readonly alvo: { readonly tipo: "canal"; readonly canalId: string } | { readonly tipo: "todos"; readonly espacoId?: string };
  readonly seco: boolean;
  readonly urlPublica?: string;
}

/** Lê e valida os argumentos. Lança `RecusaDoWebhook`; não toca em banco, rede nem ambiente. */
export function lerArgumentos(argv: readonly string[]): ArgumentosDoWebhook {
  const valores = new Map<string, string>();
  let seco = false;
  let todos = false;
  let i = 0;
  while (i < argv.length) {
    const atual = argv[i]!;
    const igual = atual.indexOf("=");
    const nome = atual.startsWith("--") ? (igual === -1 ? atual : atual.slice(0, igual)) : atual;
    if ((nome === "--seco" || nome === "--todos") && igual === -1) {
      if (nome === "--seco" ? seco : todos) throw new ErroDeUso(`${nome} só pode aparecer uma vez.`);
      if (nome === "--seco") seco = true;
      else todos = true;
      i += 1;
      continue;
    }
    if (nome !== "--canal" && nome !== "--espaco" && nome !== "--url-publica") throw new ErroDeUso(`Argumento desconhecido: ${atual}.`);
    if (valores.has(nome)) throw new ErroDeUso(`${nome} só pode aparecer uma vez.`);
    let valor: string | undefined;
    if (igual !== -1) {
      valor = atual.slice(igual + 1);
      i += 1;
    } else {
      valor = argv[i + 1];
      i += 2;
    }
    if (valor === undefined || valor.trim() === "" || valor.startsWith("--")) throw new ErroDeUso(`Falta o valor de ${nome}.`);
    valores.set(nome, valor.trim());
  }
  const canalId = valores.get("--canal");
  if (canalId !== undefined && todos) throw new ErroDeUso("Use --canal <id> OU --todos, não os dois.");
  if (canalId === undefined && !todos) throw new ErroDeUso("Falta --canal <id> ou --todos.");
  const espacoId = valores.get("--espaco");
  if (espacoId !== undefined && !todos) throw new ErroDeUso("--espaco só vale com --todos.");
  const urlPublica = valores.get("--url-publica");
  const alvo: ArgumentosDoWebhook["alvo"] =
    canalId !== undefined ? { tipo: "canal", canalId } : espacoId === undefined ? { tipo: "todos" } : { tipo: "todos", espacoId };
  return { alvo, seco, ...(urlPublica === undefined ? {} : { urlPublica }) };
}

export interface ResultadoDoCanal {
  readonly canalId: string;
  readonly instancia?: string;
  readonly resultado: "atualizado" | "seco" | "pulado" | "falhou";
  readonly motivo?: string;
}

export interface ResumoDoWebhook {
  readonly seco: boolean;
  readonly canais: readonly ResultadoDoCanal[];
}

function nomeComparavel(nome: string): string {
  return nome.normalize("NFKC").trim().toLowerCase();
}

/** `{ instancia, apikey }` do cofre; `undefined` se não for esse JSON. */
function lerCredencial(texto: string | undefined): { readonly instancia: string; readonly apikey: string } | undefined {
  if (texto === undefined) return undefined;
  try {
    const dado: unknown = JSON.parse(texto);
    if (typeof dado !== "object" || dado === null) return undefined;
    const { instancia, apikey } = dado as { instancia?: unknown; apikey?: unknown };
    return typeof instancia === "string" && instancia !== "" && typeof apikey === "string" && apikey !== "" ? { instancia, apikey } : undefined;
  } catch {
    return undefined;
  }
}

export interface AmbienteDoWebhook {
  readonly pool: Pick<Pool, "connect" | "query">;
  readonly chaves: ChavesDoCofre;
  readonly cliente: ClienteDaEvolution;
  readonly urlPublica: string;
}

export async function atualizarWebhooks(ambiente: AmbienteDoWebhook, argumentos: ArgumentosDoWebhook): Promise<ResumoDoWebhook> {
  const { pool, chaves, cliente, urlPublica } = ambiente;
  const { alvo } = argumentos;
  const filtro = alvo.tipo === "canal" ? "and id = $2" : alvo.espacoId === undefined ? "" : "and workspace_id = $2";
  const { rows } = await pool.query<{ workspace_id: string; id: string }>(
    `select workspace_id, id from plataforma.canais
      where provedor = $1 and estado = 'ativo' and conexao_simulada = false ${filtro}
      order by workspace_id, id`,
    alvo.tipo === "canal" ? [PROVEDOR_DO_CANAL, alvo.canalId] : alvo.espacoId === undefined ? [PROVEDOR_DO_CANAL] : [PROVEDOR_DO_CANAL, alvo.espacoId],
  );
  if (alvo.tipo === "canal" && rows.length === 0) {
    throw new RecusaDoWebhook("O Canal não existe, está arquivado ou não é um WhatsApp não oficial ligado de verdade.");
  }

  const canais = criarRepositorioDeCanaisPg(pool as Pool);
  const resultados: ResultadoDoCanal[] = [];
  for (const { workspace_id: workspaceId, id: canalId } of rows) {
    const canal = await canais.obter(workspaceId, canalId);
    if (!canal) {
      resultados.push({ canalId, resultado: "pulado", motivo: "o Canal sumiu" });
      continue;
    }
    const paraProvedor = await canalParaProvedor(pool as Pool, chaves, workspaceId, canal);
    const credencial = lerCredencial(paraProvedor.credencial);
    if (!credencial) {
      resultados.push({ canalId, resultado: "pulado", motivo: "sem credencial da instância no cofre" });
      continue;
    }
    if (nomeComparavel(credencial.instancia) === INSTANCIA_DO_FINANCEIRO) {
      resultados.push({ canalId, instancia: credencial.instancia, resultado: "pulado", motivo: "instância do automation/ (Financeiro): nunca é tocada" });
      continue;
    }
    if (paraProvedor.segredoDoWebhook === undefined) {
      resultados.push({ canalId, instancia: credencial.instancia, resultado: "pulado", motivo: "sem segredo do webhook no cofre (rode canal:ligar-evolution)" });
      continue;
    }
    if (argumentos.seco) {
      resultados.push({ canalId, instancia: credencial.instancia, resultado: "seco" });
      continue;
    }
    try {
      await cliente.configurarWebhook(credencial.apikey, credencial.instancia, {
        url: urlDoWebhookDoCanal(urlPublica, canalId),
        segredo: paraProvedor.segredoDoWebhook,
      });
      resultados.push({ canalId, instancia: credencial.instancia, resultado: "atualizado" });
    } catch (erro) {
      // Só a frase do cliente da Evolution (sem chave nem corpo): o resto do erro pode carregar a URL.
      resultados.push({ canalId, instancia: credencial.instancia, resultado: "falhou", motivo: erro instanceof Error ? erro.message : "erro desconhecido" });
    }
  }
  return { seco: argumentos.seco, canais: resultados };
}

export interface DependenciasDoWebhook {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly pool: () => Pick<Pool, "connect" | "query">;
  readonly chaves: () => ChavesDoCofre;
  readonly criarCliente: (url: string) => ClienteDaEvolution;
  readonly saida: { out(texto: string): void; err(texto: string): void };
}

export function dependenciasPadrao(): DependenciasDoWebhook {
  return {
    env: process.env,
    pool: () => poolPadrao(),
    chaves: () => lerChavesDoCofre(process.env),
    criarCliente: (url) => criarClienteDaEvolution({ url }),
    saida: { out: (texto) => console.log(texto), err: (texto) => console.error(texto) },
  };
}

function descreverResumo(r: ResumoDoWebhook): string {
  const linhas = r.canais.map((c) => {
    const onde = `Canal ${c.canalId}${c.instancia === undefined ? "" : ` (instância ${c.instancia})`}`;
    if (c.resultado === "atualizado") return `  ${onde}: webhook atualizado`;
    if (c.resultado === "seco") return `  ${onde}: seria atualizado`;
    if (c.resultado === "pulado") return `  ${onde}: pulado, ${c.motivo ?? ""}`;
    return `  ${onde}: FALHOU, ${c.motivo ?? ""}`;
  });
  const cabecalho = r.seco ? "Simulação (--seco): nada foi enviado à Evolution." : `Eventos do webhook: ${EVENTOS_DO_WEBHOOK.join(", ")}.`;
  return [cabecalho, "", ...(linhas.length === 0 ? ["  Nenhum Canal WhatsApp não oficial ligado de verdade."] : linhas)].join("\n");
}

/** Roda o comando e devolve o código de saída. Argumento ou variável errada sai antes de abrir pool, cofre ou rede. */
export async function principal(argv: readonly string[], deps: DependenciasDoWebhook = dependenciasPadrao()): Promise<number> {
  try {
    const argumentos = lerArgumentos(argv);
    const urlDaEvolution = deps.env.EVOLUTION_URL?.trim();
    if (!urlDaEvolution) throw new RecusaDoWebhook("Falta a variável EVOLUTION_URL (a base da Evolution, sem barra final).");
    const urlBruta = argumentos.urlPublica ?? deps.env.API_URL_PUBLICA?.trim();
    if (!urlBruta) throw new RecusaDoWebhook("Falta a URL pública da API: defina a variável API_URL_PUBLICA ou passe --url-publica.");
    const urlPublica = normalizarUrlPublica(urlBruta, argumentos.urlPublica === undefined ? "A variável API_URL_PUBLICA" : "--url-publica");
    normalizarUrlPublica(urlDaEvolution, "A variável EVOLUTION_URL");

    const resumo = await atualizarWebhooks({ pool: deps.pool(), chaves: deps.chaves(), cliente: deps.criarCliente(urlDaEvolution), urlPublica }, argumentos);
    deps.saida.out(descreverResumo(resumo));
    return resumo.canais.some((c) => c.resultado === "falhou") ? 1 : 0;
  } catch (erro) {
    if (erro instanceof ErroDeUso) {
      deps.saida.err(`${erro.message}\n\n${USO}`);
      return 2;
    }
    if (erro instanceof RecusaDoWebhook) {
      deps.saida.err(erro.message);
      return 2;
    }
    if (erro instanceof Error && erro.name === "RecusaDaLigacao") {
      deps.saida.err(erro.message);
      return 2;
    }
    deps.saida.err(`Falhou: ${erro instanceof Error ? erro.message : String(erro)}`);
    return 1;
  }
}
