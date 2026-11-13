/**
 * Baixar a mídia de um Direct recebido (16-10 para o Instagram). O webhook traz a URL do arquivo na Meta
 * (`attachments[].payload.url`); o corpo vem de fora, então a URL só é seguida se for `https` num host da Meta, e
 * cada redirecionamento é conferido de novo (sem SSRF: uma URL do corpo nunca leva a API à rede interna). O token
 * da conta não vai junto: a URL da Meta já é assinada.
 *
 * O teto é conferido duas vezes, no `content-length` e na leitura em fluxo, que para no primeiro byte acima dele.
 * As falhas seguem a regra da guarda de mídia: `PROVEDOR_INDISPONIVEL` passa sozinha (rede, 429, 5xx),
 * `MIDIA_INDISPONIVEL` e `MIDIA_GRANDE_DEMAIS` não.
 */

import { normalizarTipoDeMidia } from "@n1/dominio/crm/midia";
import { ErroDeProvedor, type MidiaBaixada } from "../../provedor";

/** Os hosts de onde a Meta serve a mídia do Direct: `lookaside.fbsbx.com` e as CDNs para onde ele redireciona. */
const SUFIXOS_DA_META = ["fbsbx.com", "cdninstagram.com", "fbcdn.net"] as const;

const REDIRECIONAMENTOS = 3;

export function hostDaMetaPermitido(url: URL): boolean {
  if (url.protocol !== "https:" || url.username !== "" || url.password !== "") return false;
  const host = url.hostname.toLowerCase();
  return SUFIXOS_DA_META.some((sufixo) => host === sufixo || host.endsWith(`.${sufixo}`));
}

export interface OpcoesDoDownload {
  readonly tetoBytes: number;
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
  /** Padrão: `hostDaMetaPermitido`. Os testes apontam para o servidor falso local. */
  readonly permitido?: (url: URL) => boolean;
  /**
   * Cabeçalhos do PRIMEIRO pedido (WhatsApp oficial: o download da mídia exige `Authorization: Bearer <token>`; a URL do
   * Instagram já vem assinada e não usa isto). Nunca seguem num redirecionamento: o token não vai para a CDN.
   */
  readonly cabecalhos?: Readonly<Record<string, string>>;
}

const indisponivel = () => new ErroDeProvedor("MIDIA_INDISPONIVEL", "A mídia não está disponível no Instagram.");
const foraDoAr = () => new ErroDeProvedor("PROVEDOR_INDISPONIVEL", "O Instagram não entregou a mídia agora.");
const grandeDemais = () => new ErroDeProvedor("MIDIA_GRANDE_DEMAIS", "A mídia passa do teto de tamanho.");

function urlDe(texto: string, base?: URL): URL | undefined {
  try {
    return base ? new URL(texto, base) : new URL(texto);
  } catch {
    return undefined;
  }
}

export async function baixarMidiaDaMeta(referencia: string, opcoes: OpcoesDoDownload): Promise<MidiaBaixada> {
  const buscar = opcoes.fetchImpl ?? fetch;
  const permitido = opcoes.permitido ?? hostDaMetaPermitido;
  const timeoutMs = opcoes.timeoutMs ?? 15_000;

  const inicial = urlDe(referencia);
  if (!inicial || !permitido(inicial)) throw indisponivel();

  let url: URL = inicial;
  let resposta: Response | undefined;
  for (let salto = 0; salto <= REDIRECIONAMENTOS; salto += 1) {
    try {
      resposta = await buscar(url, {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs),
        ...(salto === 0 && opcoes.cabecalhos ? { headers: opcoes.cabecalhos } : {}),
      });
    } catch {
      throw foraDoAr();
    }
    if (resposta.status < 300 || resposta.status >= 400) break;
    const destino = resposta.headers.get("location");
    await resposta.body?.cancel().catch(() => undefined);
    const proxima: URL | undefined = destino ? urlDe(destino, url) : undefined;
    if (!proxima || !permitido(proxima) || salto === REDIRECIONAMENTOS) throw indisponivel();
    url = proxima;
  }
  if (!resposta) throw indisponivel();

  if (resposta.status < 200 || resposta.status >= 300) {
    await resposta.body?.cancel().catch(() => undefined);
    if (resposta.status === 429 || resposta.status >= 500) throw foraDoAr();
    throw indisponivel();
  }
  const declarado = Number(resposta.headers.get("content-length"));
  if (Number.isFinite(declarado) && declarado > opcoes.tetoBytes) {
    await resposta.body?.cancel().catch(() => undefined);
    throw grandeDemais();
  }
  if (!resposta.body) throw indisponivel();

  const leitor = resposta.body.getReader();
  const pedacos: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await leitor.read();
      if (done) break;
      total += value.byteLength;
      if (total > opcoes.tetoBytes) {
        await leitor.cancel().catch(() => undefined);
        throw grandeDemais();
      }
      pedacos.push(value);
    }
  } catch (erro) {
    if (erro instanceof ErroDeProvedor) throw erro;
    throw foraDoAr();
  }

  return {
    bytes: new Uint8Array(Buffer.concat(pedacos)),
    tipoDeMidia: normalizarTipoDeMidia(resposta.headers.get("content-type") ?? "application/octet-stream"),
  };
}
