/**
 * O evento de tempo real do CRM (16-07, D-16-01, MSG-03): o que o backend avisa à tela quando uma Mensagem ou uma
 * Conversa muda. Só ids e o tipo, nunca texto, nome nem telefone: a tela busca o resto pelas rotas que já conferem
 * o acesso (prohibition de MSG-03).
 *
 * O tipo mora aqui para a api (que escreve e lê o aviso) e a web (que lê o fluxo) usarem a mesma forma.
 * `workspaceId` só existe dentro do servidor: o hub filtra por ele e a aba recebe `EventoParaATela`.
 *
 * Sem barril: quem precisa importa por `@n1/dominio/crm/eventos`.
 */

export const TIPOS_DE_EVENTO_DO_CRM = ["mensagem.nova", "mensagem.status", "conversa.mudou"] as const;

export type TipoDeEventoDoCrm = (typeof TIPOS_DE_EVENTO_DO_CRM)[number];

export interface EventoDoCrm {
  readonly workspaceId: string;
  readonly tipo: TipoDeEventoDoCrm;
  readonly conversaId: string;
  readonly mensagemId?: string;
}

/** O que sai para a aba: o mesmo evento sem o Espaço. */
export type EventoParaATela = Omit<EventoDoCrm, "workspaceId">;

/** O tamanho máximo de um id no aviso: com 4 campos de até 64 caracteres o NOTIFY fica muito abaixo dos 8000 bytes. */
const MAXIMO_DO_ID = 64;

function ehId(valor: unknown): valor is string {
  return typeof valor === "string" && valor.length >= 1 && valor.length <= MAXIMO_DO_ID;
}

function ehTipo(valor: unknown): valor is TipoDeEventoDoCrm {
  return typeof valor === "string" && (TIPOS_DE_EVENTO_DO_CRM as readonly string[]).includes(valor);
}

/** Só objeto simples e só as chaves permitidas: um campo a mais (texto, nome, telefone) recusa o evento inteiro. */
function objetoComAsChaves(valor: unknown, permitidas: readonly string[]): Record<string, unknown> | undefined {
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) return undefined;
  const objeto = valor as Record<string, unknown>;
  for (const chave of Object.keys(objeto)) if (!permitidas.includes(chave)) return undefined;
  return objeto;
}

function lerTipoEIds(objeto: Record<string, unknown>): EventoParaATela | undefined {
  const { tipo, conversaId, mensagemId } = objeto;
  if (!ehTipo(tipo) || !ehId(conversaId)) return undefined;
  if (mensagemId === undefined) return { tipo, conversaId };
  if (!ehId(mensagemId)) return undefined;
  return { tipo, conversaId, mensagemId };
}

/** Lê o que o `NOTIFY` leva (validação à mão, sem biblioteca de esquema). `undefined` para qualquer forma que não seja exatamente esta. */
export function lerEventoDoCrm(valor: unknown): EventoDoCrm | undefined {
  const objeto = objetoComAsChaves(valor, ["workspaceId", "tipo", "conversaId", "mensagemId"]);
  if (!objeto || !ehId(objeto.workspaceId)) return undefined;
  const aTela = lerTipoEIds(objeto);
  return aTela ? { workspaceId: objeto.workspaceId, ...aTela } : undefined;
}

/** Lê o que sai para a aba: o mesmo evento, sem `workspaceId` (ele não sai do servidor). */
export function lerEventoParaATela(valor: unknown): EventoParaATela | undefined {
  const objeto = objetoComAsChaves(valor, ["tipo", "conversaId", "mensagemId"]);
  return objeto ? lerTipoEIds(objeto) : undefined;
}
