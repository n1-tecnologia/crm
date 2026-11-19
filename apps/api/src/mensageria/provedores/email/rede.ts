/**
 * A guarda de rede do e-mail (Fase 17, 17-03, D-17-07, EML-06, T-17-06 a T-17-08).
 *
 * "Outro servidor" deixa a pessoa digitar host e porta. Sem esta guarda o `apps/api` viraria sonda da rede interna da VM
 * (o Postgres em `127.0.0.1`, os metadados de nuvem). Daí as quatro regras:
 *
 *   1. Só quatro portas, cada uma com a sua segurança: IMAP 993 (TLS direto) e 143 (STARTTLS obrigatório), SMTP 465 (TLS
 *      direto) e 587 (STARTTLS obrigatório). Qualquer outra é recusada ANTES de qualquer conexão; nenhum caminho fala em
 *      texto puro.
 *   2. O host é resolvido UMA vez por conexão. Se QUALQUER endereço devolvido for de uma faixa proibida, a conexão é
 *      recusada (o atacante controla o DNS e pode misturar um IP público com um privado).
 *   3. Quem conecta usa o IP já conferido (`DestinoConferido.ip`) e entrega o nome original só como `servername`, para o
 *      certificado: não há segunda consulta de DNS entre conferir e conectar (rebinding).
 *   4. A política é um VALOR passado à fábrica. A de produção (`POLITICA_DE_PRODUCAO`) não tem exceção; os testes
 *      funcionais passam uma que libera só `127.0.0.1` (`criarPoliticaDeRede({ permitir })`). Nada aqui lê o ambiente.
 *
 * Faixas recusadas (D-17-07, mais as que a pesquisa listou no pressuposto A2, a confirmar com o dono; afrouxar é trocar
 * esta lista):
 *   IPv4: 0.0.0.0/8, 10.0.0.0/8, 100.64.0.0/10 (CGNAT), 127.0.0.0/8, 169.254.0.0/16 (link-local e metadados de nuvem),
 *         172.16.0.0/12, 192.0.0.0/24, 192.0.2.0/24, 192.168.0.0/16, 198.18.0.0/15, 198.51.100.0/24, 203.0.113.0/24,
 *         224.0.0.0/4 (multicast), 240.0.0.0/4, e o IP 168.63.129.16 (plataforma do Azure).
 *   IPv6: ::/128, ::1/128, ::/96 (IPv4 compatível), 64:ff9b::/96 (NAT64), 64:ff9b:1::/48, 100::/64, 2001::/32 (Teredo),
 *         2001:db8::/32, 2002::/16 (6to4), fc00::/7 (inclui fd00:ec2::254 dos metadados da AWS), fe80::/10, fec0::/10,
 *         ff00::/8.
 *   IPv4 mapeado em IPv6 (`::ffff:a.b.c.d`) casa as regras IPv4 (o `BlockList` do Node faz isso). Para NAT64 e 6to4 é
 *   mais seguro recusar a faixa inteira do que extrair o IPv4 embutido.
 */

import { BlockList, isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { domainToASCII } from "node:url";

export type ServicoDeEmail = "imap" | "smtp";
export type SegurancaDaPorta = "tls" | "starttls";

export type TabelaDePortas = Readonly<Record<ServicoDeEmail, Readonly<Record<number, SegurancaDaPorta>>>>;

/** As únicas portas que a produção abre (D-17-07). */
export const PORTAS_DO_EMAIL: TabelaDePortas = {
  imap: { 993: "tls", 143: "starttls" },
  smtp: { 465: "tls", 587: "starttls" },
};

export type Resolvedor = (host: string) => Promise<readonly { address: string; family: 4 | 6 }[]>;

export interface PoliticaDeRede {
  proibido(ip: string, familia: 4 | 6): boolean;
}

const REDES_IPV4: readonly (readonly [string, number])[] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

const REDES_IPV6: readonly (readonly [string, number])[] = [
  ["::", 128],
  ["::1", 128],
  ["::", 96],
  ["64:ff9b::", 96],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001::", 32],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["fec0::", 10],
  ["ff00::", 8],
];

function montarListaDeProibidos(): BlockList {
  const lista = new BlockList();
  for (const [rede, bits] of REDES_IPV4) lista.addSubnet(rede, bits, "ipv4");
  lista.addAddress("168.63.129.16", "ipv4");
  for (const [rede, bits] of REDES_IPV6) lista.addSubnet(rede, bits, "ipv6");
  return lista;
}

const PROIBIDOS = montarListaDeProibidos();

function proibidoNaProducao(ip: string, familia: 4 | 6): boolean {
  try {
    return PROIBIDOS.check(ip, familia === 6 ? "ipv6" : "ipv4");
  } catch {
    // Um endereço que o `BlockList` não entende nunca passa.
    return true;
  }
}

export const POLITICA_DE_PRODUCAO: PoliticaDeRede = { proibido: proibidoNaProducao };

/**
 * Uma política que libera só os IPs exatos dados e mantém as faixas de produção para todo o resto. Existe para os
 * testes funcionais (o dublê de e-mail ouve em `127.0.0.1`); a produção usa `POLITICA_DE_PRODUCAO`.
 */
export function criarPoliticaDeRede(opcoes: { permitir?: readonly string[] } = {}): PoliticaDeRede {
  const permitidos = new Set(opcoes.permitir ?? []);
  return {
    proibido(ip, familia) {
      if (permitidos.has(ip)) return false;
      return proibidoNaProducao(ip, familia);
    },
  };
}

export interface DestinoConferido {
  /** O nome que a pessoa digitou, normalizado; vai ao `servername` do TLS, nunca à conexão. */
  readonly host: string;
  /** O IP já conferido: é a ele que se conecta. */
  readonly ip: string;
  readonly porta: number;
  readonly seguranca: SegurancaDaPorta;
}

export type MotivoDeRecusaDeRede = "porta" | "host_invalido" | "sem_endereco" | "rede_interna";

export type ResultadoDaConferencia =
  | { readonly ok: true; readonly destino: DestinoConferido }
  | { readonly ok: false; readonly motivo: MotivoDeRecusaDeRede };

export class RecusaDeRede extends Error {
  readonly motivo: MotivoDeRecusaDeRede;
  readonly servico: ServicoDeEmail;

  constructor(motivo: MotivoDeRecusaDeRede, servico: ServicoDeEmail) {
    // Frase fixa: nem o host, nem a porta, nem o IP vão para a mensagem (a conexão não pode servir de sonda).
    super("Destino de e-mail recusado pela guarda de rede.");
    this.name = "RecusaDeRede";
    this.motivo = motivo;
    this.servico = servico;
  }
}

const TEMPO_DO_DNS_MS = 10_000;

const resolvedorPadrao: Resolvedor = async (host) => {
  let relogio: NodeJS.Timeout | undefined;
  const limite = new Promise<never>((_, rejeitar) => {
    relogio = setTimeout(() => rejeitar(new Error("DNS demorou demais.")), TEMPO_DO_DNS_MS);
  });
  try {
    const enderecos = await Promise.race([lookup(host, { all: true, verbatim: true }), limite]);
    return enderecos.map((e) => ({ address: e.address, family: e.family === 6 ? (6 as const) : (4 as const) }));
  } finally {
    if (relogio) clearTimeout(relogio);
  }
};

/** Normaliza o host digitado: nome em ASCII (punycode) em minúsculas, ou IP literal; `undefined` se não presta. */
function normalizarHost(bruto: string): { host: string; literal: 4 | 6 | 0 } | undefined {
  let host = bruto.trim().toLowerCase();
  if (host.startsWith("[") && host.endsWith("]")) host = host.slice(1, -1);
  host = host.replace(/\.$/, "");
  if (host === "" || host.length > 253) return undefined;

  const familia = /^[0-9a-f:.]+$/.test(host) ? isIP(host) : 0;
  if (familia === 4 || familia === 6) return { host, literal: familia };

  const ascii = domainToASCII(host);
  if (ascii === "" || ascii.length > 253 || /[^a-z0-9.-]/.test(ascii)) return undefined;
  const rotulos = ascii.split(".");
  if (rotulos.some((r) => r === "" || r.length > 63)) return undefined;
  // Um nome cujo último rótulo é só número ou hexadecimal ("127.1", "0x7f.1") é um IPv4 disfarçado: o `getaddrinfo` o lê
  // como endereço. Nenhum domínio real termina assim.
  const ultimo = rotulos[rotulos.length - 1]!;
  if (/^[0-9]+$/.test(ultimo) || /^0x[0-9a-f]*$/.test(ultimo)) return undefined;
  return { host: ascii, literal: 0 };
}

export interface OpcoesDeConferencia {
  readonly resolver?: Resolvedor;
  readonly politica?: PoliticaDeRede;
  readonly portas?: TabelaDePortas;
}

/**
 * Decide se o `apps/api` pode abrir esta conexão e, se pode, para qual IP. Resolve o host UMA vez. Toda abertura de IMAP
 * ou de SMTP chama esta função antes: o DNS do domínio pode mudar depois do cadastro.
 */
export async function conferirDestino(
  entrada: { host: string; porta: number; servico: ServicoDeEmail },
  opcoes: OpcoesDeConferencia = {},
): Promise<ResultadoDaConferencia> {
  const tabela = opcoes.portas ?? PORTAS_DO_EMAIL;
  const politica = opcoes.politica ?? POLITICA_DE_PRODUCAO;
  const resolver = opcoes.resolver ?? resolvedorPadrao;

  const seguranca = Number.isInteger(entrada.porta) ? tabela[entrada.servico][entrada.porta] : undefined;
  if (seguranca === undefined) return { ok: false, motivo: "porta" };

  const normalizado = typeof entrada.host === "string" ? normalizarHost(entrada.host) : undefined;
  if (normalizado === undefined) return { ok: false, motivo: "host_invalido" };

  let enderecos: readonly { address: string; family: 4 | 6 }[];
  if (normalizado.literal !== 0) {
    enderecos = [{ address: normalizado.host, family: normalizado.literal }];
  } else {
    try {
      enderecos = await resolver(normalizado.host);
    } catch {
      return { ok: false, motivo: "sem_endereco" };
    }
  }
  if (enderecos.length === 0) return { ok: false, motivo: "sem_endereco" };

  for (const { address, family } of enderecos) {
    if (politica.proibido(address, family)) return { ok: false, motivo: "rede_interna" };
  }

  return {
    ok: true,
    destino: { host: normalizado.host, ip: enderecos[0]!.address, porta: entrada.porta, seguranca },
  };
}
