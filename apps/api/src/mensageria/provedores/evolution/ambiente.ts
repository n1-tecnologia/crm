/**
 * O que o "Conectar" pelo CRM (Sessão 4) precisa saber da Evolution e do ambiente, sem rede nem banco.
 *
 * A REGRA DE OURO DESTE ARQUIVO é a chave global: quem a tem cria e APAGA qualquer instância da Evolution, inclusive a
 * `numeropvmarcos`, que é do `automation/` (extratos e avisos do Financeiro). Por isso o CRM só mexe em instância cujo nome
 * ele mesmo gerou (`n1-<espaço>-<canal>`), e o cliente (`cliente.ts`) recusa criar ou apagar qualquer outra, mesmo que um
 * chamador erre o nome. Ligar um Canal a uma instância que o dono criou à mão (`canal:ligar-evolution`) continua possível;
 * essa instância só ganha "sair da sessão" ao desconectar e nunca é apagada pelo CRM.
 */

import { createHash } from "node:crypto";

/** A instância do `automation/` (Financeiro). Nenhuma chamada do CRM a cria, liga a um Canal ou apaga. */
export const INSTANCIA_DO_FINANCEIRO = "numeropvmarcos";

/** O começo do nome de toda instância que o CRM cria: `n1-<espaço>-<canal>`. */
export const PREFIXO_DA_INSTANCIA_DO_CRM = "n1-";

function nomeComparavel(nome: string): string {
  return nome.normalize("NFKC").trim().toLowerCase();
}

export function ehInstanciaDoFinanceiro(nome: string): boolean {
  return nomeComparavel(nome) === INSTANCIA_DO_FINANCEIRO;
}

/** A instância é uma das que o CRM cria (e por isso pode apagar). A do Financeiro nunca é. */
export function ehInstanciaDoCrm(nome: string): boolean {
  return nome.startsWith(PREFIXO_DA_INSTANCIA_DO_CRM) && !ehInstanciaDoFinanceiro(nome);
}

const TAMANHO_MAXIMO_DO_NOME = 80;

/**
 * O nome da instância de um Canal: `n1-<espaço>-<canal>`, só com letras, dígitos, `_` e `-` (o que a Evolution aceita em
 * qualquer versão). Nunca colide entre Espaços nem com a `numeropvmarcos`. Um nome que passaria do limite é cortado e
 * ganha um sufixo de hash, para continuar único.
 */
export function nomeDaInstanciaDoCanal(workspaceId: string, canalId: string): string {
  const limpo = (texto: string) => texto.replace(/[^A-Za-z0-9_-]/g, "-");
  const base = `${PREFIXO_DA_INSTANCIA_DO_CRM}${limpo(workspaceId)}-${limpo(canalId)}`;
  if (base.length <= TAMANHO_MAXIMO_DO_NOME) return base;
  const sufixo = createHash("sha256").update(`${workspaceId}\u0000${canalId}`).digest("hex").slice(0, 12);
  return `${base.slice(0, TAMANHO_MAXIMO_DO_NOME - 13)}-${sufixo}`;
}

export interface ConfiguracaoDaEvolution {
  /** A base da Evolution, sem barra final (`EVOLUTION_URL`). */
  readonly url: string;
  /** A chave GLOBAL (`EVOLUTION_API_KEY`): cria, lê e apaga instâncias. Só no ambiente do processo, nunca no cofre nem em log. */
  readonly apikeyGlobal: string;
  /** O endereço público da api sem barra final (`API_URL_PUBLICA`): para onde a Evolution manda o webhook. */
  readonly urlPublica: string;
}

export type LeituraDaConfiguracao =
  | { readonly ok: true; readonly configuracao: ConfiguracaoDaEvolution }
  | { readonly ok: false; readonly faltam: readonly string[]; readonly invalida?: string };

function urlLimpa(bruta: string): string | undefined {
  let url: URL;
  try {
    url = new URL(bruta.trim());
  } catch {
    return undefined;
  }
  if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username !== "" || url.password !== "" || url.search !== "" || url.hash !== "") {
    return undefined;
  }
  return `${url.origin}${url.pathname}`.replace(/\/+$/, "");
}

/**
 * Lê `EVOLUTION_URL`, `EVOLUTION_API_KEY` e `API_URL_PUBLICA` do ambiente. Faltando qualquer uma, devolve o nome do que
 * falta (a frase de recusa do "Conectar" diz o que configurar, sem mostrar valor algum). Uma URL mal formada é `invalida`.
 */
export function lerConfiguracaoDaEvolution(env: Readonly<Record<string, string | undefined>> = process.env): LeituraDaConfiguracao {
  const bruta = {
    EVOLUTION_URL: env.EVOLUTION_URL?.trim() ?? "",
    EVOLUTION_API_KEY: env.EVOLUTION_API_KEY?.trim() ?? "",
    API_URL_PUBLICA: env.API_URL_PUBLICA?.trim() ?? "",
  };
  const faltam = (Object.keys(bruta) as (keyof typeof bruta)[]).filter((nome) => bruta[nome] === "");
  if (faltam.length > 0) return { ok: false, faltam };
  const url = urlLimpa(bruta.EVOLUTION_URL);
  if (url === undefined) return { ok: false, faltam: [], invalida: "EVOLUTION_URL precisa ser só o endereço (http:// ou https://, sem usuário, query nem #)." };
  const urlPublica = urlLimpa(bruta.API_URL_PUBLICA);
  if (urlPublica === undefined) return { ok: false, faltam: [], invalida: "API_URL_PUBLICA precisa ser só o endereço (http:// ou https://, sem usuário, query nem #)." };
  return { ok: true, configuracao: { url, apikeyGlobal: bruta.EVOLUTION_API_KEY, urlPublica } };
}

/** O endereço do webhook de um Canal na api: o mesmo da rota `POST /webhooks/mensageria/:canalId`. */
export function urlDoWebhookDoCanal(urlPublica: string, canalId: string): string {
  return `${urlPublica}/webhooks/mensageria/${encodeURIComponent(canalId)}`;
}

/**
 * Os eventos que a instância manda ao CRM: a mensagem recebida (que também traz as reações), a mudança de conexão (4.3.1) e, desde
 * a 4.4.5, o tique (`MESSAGES_UPDATE`), a Mensagem apagada (`MESSAGES_DELETE`) e a editada (`MESSAGES_EDITED`). Uma instância que
 * já estava conectada guarda a lista de quando foi ligada: `npm run canal:atualizar-webhook-evolution` a reaplica.
 */
export const EVENTOS_DO_WEBHOOK = ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "MESSAGES_UPDATE", "MESSAGES_DELETE", "MESSAGES_EDITED"] as const;
