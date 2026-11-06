/**
 * As abas por Canal e o Canal de resposta do fio da Conversa, lidos das TABELAS
 * do CRM novo (15-20, 3.4.2). São as regras de `derive-conversacional` (D-13,
 * D-14, D-15) sobre `Canal`, `IdentificadorDeContato` e `ConversaNaLista`:
 * quem chama entrega os Canais e os Identificadores do Contato como argumento
 * (a tela os lê por HTTP), e nenhuma função aqui toca `DataState`.
 *
 *   - D-14: uma aba por Canal, não por tipo. A fileira mostra todos os Canais
 *     ativos, sempre na mesma ordem (tipo, criação, id); os que o Contato não
 *     alcança vêm desligados (`alcancavel: false`).
 *   - D-15: o "Responder por" oferece só os Canais `conectada` que alcançam o
 *     Contato, e já vem com o Canal por onde o Contato falou por último.
 *
 * O alcance é do TIPO do Canal: o Identificador que o tipo resolve
 * (`TIPO_DE_IDENTIFICADOR_DO_CANAL`); o provedor não o muda. `telefone` é
 * discável mas não é WhatsApp.
 *
 * A Conversa chega pela lista (`ConversaNaLista`), que traz `ultimaRecebidaEm`
 * (a recebida mais recente) mas não a última Mensagem de qualquer direção.
 * "A Conversa mais recente" (`canalDaAbaInicialNasTabelas`) é, por isso, a de
 * maior entre `ultimaRecebidaEm` e `atualizadoEm`: uma resposta nossa que não
 * mexeu na linha da Conversa não adianta a aba. Conversa na lixeira não conta.
 *
 * Sem barril: `src/index.ts` não reexporta este módulo. Quem precisa importa
 * pelo subcaminho `@n1/dominio/crm/canais-de-resposta`.
 */

import { PROVEDORES, type TipoComProvedor } from "../provedores-de-canal";
import type { Canal } from "./canais";
import type { IdentificadorDeContato } from "./contatos";
import { TIPO_DE_IDENTIFICADOR_DO_CANAL, type ConversaNaLista } from "./conversas";

/**
 * A ordem das abas é da PLATAFORMA, não dos Identificadores do Contato: quem
 * atende usa sempre a mesma tela, e a aba do WhatsApp não pode mudar de lugar
 * porque este Contato tem e-mail e o outro não.
 */
export const ORDEM_DOS_TIPOS_NAS_TABELAS: readonly TipoComProvedor[] = ["whatsapp", "instagram", "email"];

/** Uma aba do chat: o Canal e se ele chega ao Contato (se não, a aba aparece desligada). */
export interface CanalDoFioNasTabelas {
  readonly canal: Canal;
  readonly alcancavel: boolean;
}

/** O que a regra lê de cada Conversa do Contato: o Canal, se está viva e quando mexeu. */
export type ConversaParaOFio = Pick<ConversaNaLista, "canalId" | "estado" | "ultimaRecebidaEm" | "atualizadoEm">;

/** `undefined` = o Contato ainda não foi lido: nenhum filtro de alcance, todos servem. */
type Identificadores = readonly Pick<IdentificadorDeContato, "tipo">[] | undefined;

function alcancaOContato(canal: Canal, identificadores: Identificadores): boolean {
  if (identificadores === undefined) return true;
  const tipo = TIPO_DE_IDENTIFICADOR_DO_CANAL[canal.tipo];
  return identificadores.some((i) => i.tipo === tipo);
}

/**
 * Os Canais ativos que alcançam algum Identificador do Contato — a regra do
 * diálogo de Iniciar Conversa. Sem Identificadores informados, todos os ativos.
 */
export function canaisQueAlcancamNasTabelas(canais: readonly Canal[], identificadores: Identificadores): Canal[] {
  return canais.filter((canal) => canal.estado === "ativo").filter((canal) => alcancaOContato(canal, identificadores));
}

/**
 * D-14 — uma aba por CANAL, não por tipo: dois WhatsApps dão duas abas. Os que
 * não chegam ao Contato vêm desligados, para a aba dizer por quê. Ordem estável:
 * tipo (`ORDEM_DOS_TIPOS_NAS_TABELAS`), criação, id.
 */
export function canaisDoFioNasTabelas(canais: readonly Canal[], identificadores: Identificadores): CanalDoFioNasTabelas[] {
  const posicao = (tipo: TipoComProvedor): number => ORDEM_DOS_TIPOS_NAS_TABELAS.indexOf(tipo);
  return canais
    .filter((canal) => canal.estado === "ativo")
    .sort((a, b) => posicao(a.tipo) - posicao(b.tipo) || a.criadoEm.localeCompare(b.criadoEm) || a.id.localeCompare(b.id))
    .map((canal) => ({ canal, alcancavel: alcancaOContato(canal, identificadores) }));
}

/**
 * D-15 — o que o seletor "Responder por" oferece: só os Canais que alcançam o
 * Contato E estão `conectada`. Um Canal desligado não aceita resposta nova;
 * mandar por ele só criaria Mensagem `pendente`.
 */
export function canaisDeRespostaNasTabelas(canais: readonly Canal[], identificadores: Identificadores): Canal[] {
  return canaisDoFioNasTabelas(canais, identificadores)
    .filter((c) => c.alcancavel && c.canal.conexao === "conectada")
    .map((c) => c.canal);
}

/** Conversas vivas (fora da lixeira). */
const vivas = (conversas: readonly ConversaParaOFio[]): ConversaParaOFio[] => conversas.filter((c) => c.estado === "ativo");

/** O Canal da Conversa com a Mensagem `recebida` mais recente (entre os Canais aceitos por `serve`). */
function canalDaUltimaRecebida(conversas: readonly ConversaParaOFio[], serve: (canalId: string) => boolean): string | undefined {
  let melhor: { readonly canalId: string; readonly em: string } | undefined;
  for (const conversa of vivas(conversas)) {
    if (conversa.ultimaRecebidaEm === null || !serve(conversa.canalId)) continue;
    if (!melhor || conversa.ultimaRecebidaEm > melhor.em) melhor = { canalId: conversa.canalId, em: conversa.ultimaRecebidaEm };
  }
  return melhor?.canalId;
}

/**
 * D-15 — o "Responder por" já vem preenchido com o Canal por onde o Contato
 * falou por último. Se esse Canal não serve mais (desconectado, arquivado), o
 * primeiro Canal de resposta do MESMO tipo; sem ele, o primeiro de resposta.
 * `undefined` quando nenhum Canal serve.
 */
export function canalPadraoDeRespostaNasTabelas(
  canais: readonly Canal[],
  identificadores: Identificadores,
  conversas: readonly ConversaParaOFio[],
): string | undefined {
  const resposta = canaisDeRespostaNasTabelas(canais, identificadores);
  const ultimo = canalDaUltimaRecebida(conversas, () => true);
  const doUltimo = resposta.find((c) => c.id === ultimo);
  if (doUltimo) return doUltimo.id;
  const tipoDoUltimo = canais.find((c) => c.id === ultimo)?.tipo;
  const domesmoTipo = tipoDoUltimo ? resposta.find((c) => c.tipo === tipoDoUltimo) : undefined;
  return (domesmoTipo ?? resposta[0])?.id;
}

/**
 * D-14 — a aba que abre é a do Canal da Conversa mais recente. Abrir numa aba
 * vazia enquanto há Conversa viva em outro Canal esconde justamente o que a
 * pessoa veio ver. Sem Conversa, o primeiro Canal alcançável.
 */
export function canalDaAbaInicialNasTabelas(
  canais: readonly Canal[],
  identificadores: Identificadores,
  conversas: readonly ConversaParaOFio[],
): string | undefined {
  const fio = canaisDoFioNasTabelas(canais, identificadores);
  const noFio = new Set(fio.filter((c) => c.alcancavel).map((c) => c.canal.id));
  let melhor: { readonly canalId: string; readonly em: string } | undefined;
  for (const conversa of vivas(conversas)) {
    if (!noFio.has(conversa.canalId)) continue;
    const em = conversa.ultimaRecebidaEm !== null && conversa.ultimaRecebidaEm > conversa.atualizadoEm ? conversa.ultimaRecebidaEm : conversa.atualizadoEm;
    if (!melhor || em > melhor.em) melhor = { canalId: conversa.canalId, em };
  }
  return melhor?.canalId ?? fio.find((c) => c.alcancavel)?.canal.id;
}

/**
 * O Canal que um gesto "por tipo" (abrir atendimento, iniciar Conversa) usa
 * quando só o tipo é conhecido: entre os Canais de resposta do tipo, o da
 * última recebida naquele tipo; senão o primeiro. `undefined` se o Contato não
 * tem Canal conectado desse tipo.
 */
export function canalPadraoDoTipoNasTabelas(
  canais: readonly Canal[],
  identificadores: Identificadores,
  conversas: readonly ConversaParaOFio[],
  tipo: TipoComProvedor,
): string | undefined {
  const doTipo = canaisDeRespostaNasTabelas(canais, identificadores).filter((c) => c.tipo === tipo);
  if (doTipo.length === 0) return undefined;
  const ultimo = canalDaUltimaRecebida(conversas, (id) => doTipo.some((c) => c.id === id));
  return doTipo.find((c) => c.id === ultimo)?.id ?? doTipo[0]?.id;
}

/** "Comercial · WhatsApp oficial": o nome e o provedor, para o seletor "Responder por" e as abas. */
export function rotuloDoCanalNasTabelas(canal: Pick<Canal, "nome" | "provedor">): string {
  return `${canal.nome} · ${PROVEDORES[canal.provedor].rotulo}`;
}

/** "via Suporte (WhatsApp não oficial)": o texto do separador de troca de Canal. */
export function textoDoSeparadorNasTabelas(canal: Pick<Canal, "nome" | "provedor">): string {
  return `via ${canal.nome} (${PROVEDORES[canal.provedor].rotulo})`;
}
