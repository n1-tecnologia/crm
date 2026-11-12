/**
 * `npm run canal:ligar-evolution -w @n1/api -- --canal <id> --instancia <nome>` (16-13, D-16-05, D-16-06, MSG-06)
 *
 * Liga um Canal `whatsapp-nao-oficial` a uma instância da Evolution do dono, sem tela: lê a instância com a chave global
 * (`GET /instance/fetchInstances?instanceName=`), exige `connectionState` `open`, confere o número conectado com o do Canal
 * (`conferirNumeroConectado`), gera o segredo do webhook, aponta o webhook da instância para
 * `<API_URL_PUBLICA>/webhooks/mensageria/<canalId>` com o segredo no cabeçalho `x-n1-webhook-segredo` e, numa transação,
 * guarda no cofre o segredo e o TOKEN da instância (`{ instancia, apikey }`), marca o Canal `conectada` com
 * `conexao_simulada = false` (`conexao_confirmada`), sobe a revisão do Espaço e reenfileira as Mensagens `pendente` do
 * Canal. A Sessão 4 troca este comando pelo botão "Conectar" com QR.
 *
 * Regras que valem para o arquivo inteiro:
 *   - A instância `numeropvmarcos` é do `automation/` (extratos e avisos do Financeiro): `lerArgumentos` a recusa, sem
 *     diferença de caixa nem de espaços, ANTES de qualquer chamada à rede ou ao banco (T-16-48).
 *   - O cofre guarda o TOKEN da instância, nunca a chave global: a global cria e apaga instâncias, inclusive a do
 *     Financeiro (T-16-51). Se a Evolution não devolver o token, o comando recusa; usar a global no lugar é decisão do dono.
 *   - Nenhuma saída mostra a chave global, o token nem o segredo do webhook, e do número só os 4 últimos dígitos (T-16-50).
 *   - Ordem: tudo o que pode recusar vem antes do `webhook/set`; o `webhook/set` vem antes da transação. Se o `webhook/set`
 *     falha, nada é gravado. Se a transação falha depois dele, a instância já aponta para um segredo que o banco não tem:
 *     as chamadas dela recebem 401 até o comando rodar de novo — nunca um Canal `conectada` sem webhook (T-16-52).
 *   - `--seco` percorre o mesmo caminho até a conferência do número e para: não escreve na Evolution nem no banco.
 *
 * Saída: 0 ok, 2 recusa ou erro de uso, 1 erro inesperado. `principal` não chama `process.exit`.
 * Variáveis de ambiente: `EVOLUTION_URL` (base da Evolution), `EVOLUTION_API_KEY` (a chave GLOBAL da Evolution; passe-a só
 * na linha de comando, nunca no `.env` do runtime), `API_URL_PUBLICA` (ou `--url-publica`) e `COFRE_CHAVE` (a mesma do runtime).
 */

import { randomBytes } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { conferirNumeroConectado, proximaConexao, type Canal } from "@n1/dominio/crm/canais";
import { reenfileirarPendentesDoCanal } from "../mensageria/fila-de-saida";
import { TIPO_DO_SEGREDO_DO_WEBHOOK } from "../mensageria/provedor";
import { criarClienteDaEvolution, type ClienteDaEvolution } from "../mensageria/provedores/evolution/cliente";
import { pool as poolPadrao } from "../persistencia/conexao";
import { criarRepositorioDeCanaisPg } from "../repositorios/crm/canais";
import { avisarCrm } from "../mensageria/avisar";
import { avancarRevisaoDoEspaco } from "../repositorios/crm/referencias";
import { guardarCredencial, lerChavesDoCofre, type ChavesDoCofre } from "../servicos/cofre";

/** A instância do `automation/` (extratos e avisos do Financeiro): nunca se liga a um Canal. */
const INSTANCIA_DO_FINANCEIRO = "numeropvmarcos";

const PROVEDOR_DO_CANAL = "whatsapp-nao-oficial";

/** Uma recusa esperada (argumento, Canal, instância, número): o comando sai com 2. */
export class RecusaDaLigacao extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "RecusaDaLigacao";
  }
}

/** Erro de uso da linha de comando: a recusa que mostra o `USO` junto. */
class ErroDeUso extends RecusaDaLigacao {}

/** O `webhook/set` já foi aceito, mas o banco não gravou: a instância aponta para um segredo que ninguém tem. */
export class FalhaDepoisDoWebhook extends Error {
  constructor(instancia: string, causa: string) {
    super(
      `O webhook da instância ${instancia} já aponta para a API com um segredo novo, mas o banco não gravou a ligação (${causa}). ` +
        "As chamadas dela recebem 401 até você rodar o comando de novo.",
    );
    this.name = "FalhaDepoisDoWebhook";
  }
}

export const USO = [
  "Uso: npm run canal:ligar-evolution -w @n1/api -- --canal <id> --instancia <nome> [--seco] [--url-publica <url>]",
  "  Liga um Canal WhatsApp não oficial à instância da Evolution: aponta o webhook, guarda o segredo e o token da",
  "  instância no cofre e marca o Canal conectado. --seco só mostra o que faria, sem escrever em lugar nenhum.",
  "  Ambiente: EVOLUTION_URL, EVOLUTION_API_KEY (a chave global), API_URL_PUBLICA (ou --url-publica) e COFRE_CHAVE.",
].join("\n");

export interface ArgumentosDaLigacao {
  readonly canalId: string;
  readonly instancia: string;
  readonly seco: boolean;
  readonly urlPublica?: string;
}

function nomeComparavel(nome: string): string {
  return nome.normalize("NFKC").trim().toLowerCase();
}

/** Lê e valida os argumentos. Lança `RecusaDaLigacao`; não toca em banco, rede nem ambiente. */
export function lerArgumentos(argv: readonly string[]): ArgumentosDaLigacao {
  const valores = new Map<string, string>();
  let seco = false;
  let i = 0;
  while (i < argv.length) {
    const atual = argv[i]!;
    const igual = atual.indexOf("=");
    const nome = atual.startsWith("--") ? (igual === -1 ? atual : atual.slice(0, igual)) : atual;
    if (nome === "--seco" && igual === -1) {
      if (seco) throw new ErroDeUso("--seco só pode aparecer uma vez.");
      seco = true;
      i += 1;
      continue;
    }
    if (nome !== "--canal" && nome !== "--instancia" && nome !== "--url-publica") {
      throw new ErroDeUso(`Argumento desconhecido: ${atual}.`);
    }
    if (valores.has(nome)) throw new ErroDeUso(`${nome} só pode aparecer uma vez: o comando liga um Canal a uma instância por execução.`);
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
    // A recusa da instância do Financeiro sai assim que o nome é lido: antes de qualquer outra conferência.
    if (nome === "--instancia" && nomeComparavel(valor) === INSTANCIA_DO_FINANCEIRO) {
      throw new RecusaDaLigacao(
        `A instância ${INSTANCIA_DO_FINANCEIRO} é do automation/ (extratos e avisos do Financeiro) e não pode ser ligada a um Canal.`,
      );
    }
  }
  const canalId = valores.get("--canal");
  const instancia = valores.get("--instancia");
  if (canalId === undefined) throw new ErroDeUso("Falta --canal <id>.");
  if (instancia === undefined) throw new ErroDeUso("Falta --instancia <nome>.");
  const urlPublica = valores.get("--url-publica");
  return { canalId, instancia, seco, ...(urlPublica === undefined ? {} : { urlPublica }) };
}

/** A URL pública da API sem a barra final; só http(s), sem usuário, query nem fragmento. Lança `RecusaDaLigacao`. */
export function normalizarUrlPublica(bruta: string, origem: string): string {
  let url: URL;
  try {
    url = new URL(bruta.trim());
  } catch {
    throw new RecusaDaLigacao(`${origem} não é uma URL válida (com http:// ou https://).`);
  }
  if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username !== "" || url.password !== "" || url.search !== "" || url.hash !== "") {
    throw new RecusaDaLigacao(`${origem} tem de ser só o endereço (http:// ou https://, sem usuário, query nem #).`);
  }
  return `${url.origin}${url.pathname}`.replace(/\/+$/, "");
}

/** Só os dígitos do número, o suficiente para mostrar o final e nunca o resto. */
function finalDoNumero(numero: string): string {
  return numero.replace(/\D/g, "").slice(-4);
}

export interface ResumoDaLigacao {
  readonly seco: boolean;
  readonly canalId: string;
  readonly nomeDoCanal: string;
  readonly workspaceId: string;
  readonly instancia: string;
  /** Só os 4 últimos dígitos do número conectado. */
  readonly finalDoNumero: string;
  readonly urlDoWebhook: string;
  /** A versão da Evolution (`GET /`), só no `--seco`. */
  readonly versao?: string;
  readonly estadoDaInstancia: string;
  readonly mensagensReenfileiradas: number;
}

export interface DependenciasDeLigarCanal {
  readonly pool: Pick<Pool, "connect">;
  /** Obrigatório fora do `--seco`; o `--seco` não escreve no cofre. */
  readonly chaves?: ChavesDoCofre;
  readonly cliente: ClienteDaEvolution;
  /** A chave GLOBAL da Evolution: só lê a instância. Nunca vai ao cofre. */
  readonly apikeyGlobal: string;
  readonly urlPublica: string;
}

/** Acha o Canal só por `id` (o comando não recebe Espaço): exatamente uma linha. */
async function acharCanal(pool: Pick<Pool, "connect">, canalId: string): Promise<Canal & { readonly workspaceId: string }> {
  const cliente = await pool.connect();
  try {
    const { rows } = await cliente.query<{ workspace_id: string }>("select workspace_id from plataforma.canais where id = $1", [canalId]);
    if (rows.length === 0) throw new RecusaDaLigacao("Canal não encontrado.");
    if (rows.length > 1) {
      throw new RecusaDaLigacao("Há mais de um Canal com esse id (em Espaços diferentes); o comando não adivinha qual.");
    }
    const workspaceId = rows[0]!.workspace_id;
    const canal = await criarRepositorioDeCanaisPg(cliente).obter(workspaceId, canalId);
    if (!canal) throw new RecusaDaLigacao("Canal não encontrado.");
    exigirCanalLigavel(canal);
    return { ...canal, workspaceId };
  } finally {
    cliente.release();
  }
}

function exigirCanalLigavel(canal: Canal): void {
  if (canal.provedor !== PROVEDOR_DO_CANAL) {
    throw new RecusaDaLigacao(
      `Este comando só liga Canal do provedor ${PROVEDOR_DO_CANAL} (Evolution); este Canal é do provedor ${canal.provedor}.`,
    );
  }
  if (canal.estado !== "ativo") throw new RecusaDaLigacao("Este Canal está arquivado; restaure-o antes de ligá-lo.");
}

/**
 * Liga o Canal à instância (ou, com `seco`, só confere). Lança `RecusaDaLigacao` para o que se recusa, o erro da
 * Evolution (já sem chave nem corpo) quando o `webhook/set` falha e `FalhaDepoisDoWebhook` quando o banco falha depois dele.
 */
export async function ligarCanalAEvolution(deps: DependenciasDeLigarCanal, args: ArgumentosDaLigacao): Promise<ResumoDaLigacao> {
  if (nomeComparavel(args.instancia) === INSTANCIA_DO_FINANCEIRO) {
    // Defesa em profundidade: `lerArgumentos` já recusou; quem chamar esta função direto também não liga a do Financeiro.
    throw new RecusaDaLigacao(
      `A instância ${INSTANCIA_DO_FINANCEIRO} é do automation/ (extratos e avisos do Financeiro) e não pode ser ligada a um Canal.`,
    );
  }
  const urlPublica = normalizarUrlPublica(deps.urlPublica, "A URL pública da API");
  const canal = await acharCanal(deps.pool, args.canalId);
  const urlDoWebhook = `${urlPublica}/webhooks/mensageria/${encodeURIComponent(canal.id)}`;
  const nome = args.instancia;

  const versao = args.seco ? await deps.cliente.versao(deps.apikeyGlobal) : undefined;
  const instancia = await deps.cliente.buscarInstancia(deps.apikeyGlobal, nome);
  if (instancia === undefined) throw new RecusaDaLigacao(`A instância ${nome} não existe nesta Evolution.`);
  const token = instancia.token;
  if (token === null) {
    throw new RecusaDaLigacao(
      `A Evolution não devolveu o token da instância ${nome}. Este comando guarda só o token da instância, nunca a chave global ` +
        "(ela também cria e apaga instâncias, inclusive a do Financeiro); usar outra credencial é uma decisão do dono.",
    );
  }
  const estado = await deps.cliente.estadoDaConexao(token, nome);
  if (estado !== "open") {
    throw new RecusaDaLigacao("A instância não está conectada ao WhatsApp. Conecte o número na Evolution e rode de novo.");
  }
  const confere = conferirNumeroConectado(canal, instancia.ownerJid ?? "");
  if (!confere.ok) throw new RecusaDaLigacao(confere.error);

  const resumo = {
    canalId: canal.id,
    nomeDoCanal: canal.nome,
    workspaceId: canal.workspaceId,
    instancia: nome,
    finalDoNumero: finalDoNumero(canal.identificadorExterno),
    urlDoWebhook,
    estadoDaInstancia: estado,
  };
  if (args.seco) return { ...resumo, seco: true, ...(versao === undefined ? {} : { versao }), mensagensReenfileiradas: 0 };

  const chaves = deps.chaves;
  if (chaves === undefined) throw new Error("COFRE_CHAVE não está configurada.");

  // O segredo nasce em memória e só chega ao banco depois de a Evolution o aceitar: se o `webhook/set` falha, nada é gravado.
  const segredo = randomBytes(32).toString("hex");
  await deps.cliente.configurarWebhook(token, nome, { url: urlDoWebhook, segredo });

  try {
    const reenfileiradas = await gravarALigacao(deps.pool, chaves, { workspaceId: canal.workspaceId, canalId: canal.id, instancia: nome, token, segredo });
    return { ...resumo, seco: false, mensagensReenfileiradas: reenfileiradas };
  } catch (erro) {
    throw new FalhaDepoisDoWebhook(nome, erro instanceof Error ? erro.message : String(erro));
  }
}

/** A transação da ligação: cofre ×2, conexão real, revisão do Espaço e a fila de saída. Devolve quantas Mensagens voltaram à fila. */
async function gravarALigacao(
  pool: Pick<Pool, "connect">,
  chaves: ChavesDoCofre,
  entrada: { readonly workspaceId: string; readonly canalId: string; readonly instancia: string; readonly token: string; readonly segredo: string },
): Promise<number> {
  const cliente: PoolClient = await pool.connect();
  try {
    await cliente.query("begin");
    // A linha do Espaço ANTES da do Canal, a mesma ordem de `executar()` e dos serviços do CRM: evita `40P01`.
    await cliente.query("select 1 from plataforma.workspaces where workspace_id = $1 for update", [entrada.workspaceId]);
    const repositorio = criarRepositorioDeCanaisPg(cliente);
    const canal = await repositorio.obter(entrada.workspaceId, entrada.canalId, { travar: true });
    if (!canal) throw new RecusaDaLigacao("Canal não encontrado.");
    exigirCanalLigavel(canal);

    const dono = { workspaceId: entrada.workspaceId, donoTipo: "canal", donoId: entrada.canalId } as const;
    await guardarCredencial(cliente, chaves, { ...dono, tipo: TIPO_DO_SEGREDO_DO_WEBHOOK, segredo: entrada.segredo });
    // O TOKEN da instância, nunca a chave global (T-16-51): é o que `canalParaProvedor` lê.
    await guardarCredencial(cliente, chaves, {
      ...dono,
      tipo: PROVEDOR_DO_CANAL,
      segredo: JSON.stringify({ instancia: entrada.instancia, apikey: entrada.token }),
    });

    const proxima = proximaConexao(canal, "conexao_confirmada");
    if (!proxima.ok) throw new RecusaDaLigacao(proxima.error);
    const atualizado = await repositorio.definirConexao(entrada.workspaceId, entrada.canalId, proxima.value);
    if (!atualizado) throw new RecusaDaLigacao("Canal não encontrado.");
    await avancarRevisaoDoEspaco(cliente, entrada.workspaceId);
    await avisarCrm(cliente, { workspaceId: entrada.workspaceId, tipo: "canal.mudou", canalId: entrada.canalId });
    // B69: o que foi escrito com o Canal fora do ar sai agora, no MESMO commit da conexão.
    const reenfileiradas = await reenfileirarPendentesDoCanal(cliente, entrada.workspaceId, entrada.canalId);
    await cliente.query("commit");
    return reenfileiradas;
  } catch (erro) {
    await cliente.query("rollback").catch(() => undefined);
    throw erro;
  } finally {
    cliente.release();
  }
}

export interface DependenciasDaLigacao {
  /** O ambiente que o comando lê: `process.env` na CLI, um objeto de teste nos testes. */
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly pool: () => Pick<Pool, "connect">;
  readonly chaves: () => ChavesDoCofre;
  readonly criarCliente: (url: string) => ClienteDaEvolution;
  readonly saida: { out(texto: string): void; err(texto: string): void };
}

export function dependenciasPadrao(): DependenciasDaLigacao {
  return {
    env: process.env,
    pool: () => poolPadrao(),
    chaves: () => lerChavesDoCofre(process.env),
    criarCliente: (url) => criarClienteDaEvolution({ url }),
    saida: { out: (texto) => console.log(texto), err: (texto) => console.error(texto) },
  };
}

function descreverResumo(r: ResumoDaLigacao): string {
  const comum = [
    `  Canal       ${r.nomeDoCanal} (${r.canalId})`,
    `  Espaço      ${r.workspaceId}`,
    `  Instância   ${r.instancia} (${r.estadoDaInstancia})`,
    `  Número      final ${r.finalDoNumero}, confere com o do Canal`,
    `  Webhook     ${r.urlDoWebhook}`,
  ];
  if (r.seco) {
    return [
      "Simulação (--seco): nada foi escrito, nem na Evolution nem no banco.",
      "",
      ...(r.versao === undefined ? [] : [`  Evolution   versão ${r.versao}`]),
      ...comum,
      "",
      "Sem --seco, o comando aponta o webhook para o endereço acima e marca o Canal conectado.",
    ].join("\n");
  }
  return [
    "Canal ligado à instância da Evolution.",
    "",
    ...comum,
    `  Fila        ${r.mensagensReenfileiradas} Mensagem(ns) pendente(s) reenfileirada(s)`,
    "",
    "O segredo do webhook e o token da instância ficam só no cofre; rodar o comando de novo troca o segredo e reaponta o webhook.",
  ].join("\n");
}

/** Roda o comando e devolve o código de saída. Argumento ou variável errada sai antes de abrir pool, cofre ou rede. */
export async function principal(argv: readonly string[], deps: DependenciasDaLigacao = dependenciasPadrao()): Promise<number> {
  try {
    const argumentos = lerArgumentos(argv);

    const urlDaEvolution = deps.env.EVOLUTION_URL?.trim();
    if (!urlDaEvolution) throw new RecusaDaLigacao("Falta a variável EVOLUTION_URL (a base da Evolution, sem barra final).");
    const apikeyGlobal = deps.env.EVOLUTION_API_KEY?.trim();
    if (!apikeyGlobal) throw new RecusaDaLigacao("Falta a variável EVOLUTION_API_KEY (a chave global da Evolution; só lê a instância, nunca vai ao cofre).");
    const urlBruta = argumentos.urlPublica ?? deps.env.API_URL_PUBLICA?.trim();
    if (!urlBruta) throw new RecusaDaLigacao("Falta a URL pública da API: defina a variável API_URL_PUBLICA ou passe --url-publica.");
    const urlPublica = normalizarUrlPublica(urlBruta, argumentos.urlPublica === undefined ? "A variável API_URL_PUBLICA" : "--url-publica");
    normalizarUrlPublica(urlDaEvolution, "A variável EVOLUTION_URL");

    // As chaves do cofre ANTES de falar com a Evolution: sem COFRE_CHAVE o webhook nem chega a ser mudado.
    const chaves = argumentos.seco ? undefined : deps.chaves();
    const resumo = await ligarCanalAEvolution(
      { pool: deps.pool(), ...(chaves === undefined ? {} : { chaves }), cliente: deps.criarCliente(urlDaEvolution), apikeyGlobal, urlPublica },
      argumentos,
    );
    deps.saida.out(descreverResumo(resumo));
    return 0;
  } catch (erro) {
    if (erro instanceof ErroDeUso) {
      deps.saida.err(`${erro.message}\n\n${USO}`);
      return 2;
    }
    if (erro instanceof RecusaDaLigacao) {
      deps.saida.err(erro.message);
      return 2;
    }
    // Só a mensagem: nunca o objeto do erro, que pode carregar a URL do banco ou o detalhe de uma linha. A do cliente da
    // Evolution é uma frase fixa, sem chave nem corpo.
    deps.saida.err(`Falhou: ${erro instanceof Error ? erro.message : String(erro)}`);
    return 1;
  }
}
