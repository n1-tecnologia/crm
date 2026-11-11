/**
 * O Canal do CRM novo: a conta conectada de um provedor (um número de
 * WhatsApp, uma caixa de e-mail, um perfil de Instagram). Tipos camelCase dos
 * campos de `plataforma.canais` (008), mais as regras que valem dos dois lados
 * da fronteira — a tela pré-valida e o endpoint aplica as MESMAS funções.
 *
 * Convive com o `Channel` inglês de `types/crm.ts` (seed e `criarCanal`
 * antigo) até a fase de unificação (D-11, D-12). Nenhum tipo aqui carrega
 * `workspaceId`: o Espaço de Trabalho vem da sessão, nunca do corpo.
 *
 * Os valores discretos abaixo são cópia literal da 008:
 *   - `ConexaoDoCanal` → `canais_conexao_ck`
 *   - `EstadoDoCanal`  → `canais_estado_ck`
 *
 * O Canal nasce `desconectada` (D-08; ontologia 12.2) — `validarNovoCanal` não
 * devolve `conexao`, e o INSERT da api não a envia.
 *
 * Sem barril: `src/index.ts` não reexporta este módulo. Quem precisa importa
 * pelo subcaminho `@n1/dominio/crm/canais`.
 */

import { fail, ok, type OperationResult } from "../state";
import { FORMA_DO_IDENTIFICADOR, identificadorCanonico } from "../operations/canais";
import { PROVEDORES, PROVEDORES_DE_CANAL, type TipoComProvedor } from "../provedores-de-canal";
import type { ProvedorDeCanal } from "./capacidades";
import { LIMITES_CRM } from "./comum";

export const CONEXOES_DO_CANAL = ["conectada", "desconectada", "com_erro"] as const;
export type ConexaoDoCanal = (typeof CONEXOES_DO_CANAL)[number];

export const ESTADOS_DO_CANAL = ["ativo", "arquivado"] as const;
export type EstadoDoCanal = (typeof ESTADOS_DO_CANAL)[number];

export interface Canal {
  readonly id: string;
  readonly nome: string;
  readonly tipo: TipoComProvedor;
  readonly provedor: ProvedorDeCanal;
  readonly identificadorExterno: string;
  readonly conexao: ConexaoDoCanal;
  /** D-08: a conexão veio do botão "Simular conexão". */
  readonly conexaoSimulada: boolean;
  readonly conectadaEm: string | null;
  readonly estado: EstadoDoCanal;
  readonly arquivadoEm: string | null;
  /** B35 — rastreabilidade, não governança: o Canal não tem Proprietário. */
  readonly configuradoPor: string;
  readonly filaPadraoId: string | null;
  readonly proprietarioPadraoId: string | null;
  readonly origemPadraoId: string | null;
  readonly gruposHabilitados: boolean;
  readonly criadoPor: string;
  readonly criadoEm: string;
  readonly atualizadoEm: string;
}

export interface NovoCanal {
  readonly provedor: ProvedorDeCanal;
  readonly nome: string;
  readonly identificador: string;
  readonly filaPadraoId?: string;
  readonly origemPadraoId?: string;
}

export interface FiltroDeCanais {
  readonly estado: EstadoDoCanal;
  readonly limite: number;
  readonly deslocamento: number;
  readonly tipo?: TipoComProvedor;
  readonly provedor?: ProvedorDeCanal;
  readonly conexao?: ConexaoDoCanal;
  readonly q?: string;
}

/**
 * Valida um Canal novo: o `tipo` sai do provedor (nunca do cliente) e o
 * identificador vira a forma canônica que o índice `canais_conta_uq` compara
 * (INV-CXE-01).
 */
export function validarNovoCanal(entrada: NovoCanal): OperationResult<{
  readonly tipo: TipoComProvedor;
  readonly provedor: ProvedorDeCanal;
  readonly nome: string;
  readonly identificadorExterno: string;
}> {
  const nome = entrada.nome.trim();
  if (nome === "") return fail("Dê um nome ao Canal.", "nome");
  if (nome.length > LIMITES_CRM.textoCurto) {
    return fail(`O nome do Canal vai até ${LIMITES_CRM.textoCurto} caracteres.`, "nome");
  }
  const provedor = entrada.provedor as string;
  if (!(PROVEDORES_DE_CANAL as readonly string[]).includes(provedor)) {
    return fail("Este provedor de Canal não existe.", "provedor");
  }
  const tipo = PROVEDORES[entrada.provedor].tipo;
  const identificadorExterno = identificadorCanonico(tipo, entrada.identificador);
  if (identificadorExterno === undefined) return fail(FORMA_DO_IDENTIFICADOR[tipo].dica, "identificador");
  return ok({ tipo, provedor: entrada.provedor, nome, identificadorExterno });
}

/**
 * O que a configuração de um Canal pode mudar (INV-CXE-02): o nome e os dois
 * padrões. `tipo`, `provedor`, `identificador` e `conexao` não estão aqui de
 * propósito — trocar a conta é arquivar e criar outro Canal. `null` limpa o
 * padrão; ausente não mexe.
 */
export interface EdicaoDeCanal {
  readonly nome?: string;
  readonly filaPadraoId?: string | null;
  readonly origemPadraoId?: string | null;
}

export function validarEdicaoDeCanal(edicao: EdicaoDeCanal): OperationResult<EdicaoDeCanal> {
  if (edicao.nome === undefined) return ok(edicao);
  const nome = edicao.nome.trim();
  if (nome === "") return fail("Dê um nome ao Canal.", "nome");
  if (nome.length > LIMITES_CRM.textoCurto) {
    return fail(`O nome do Canal vai até ${LIMITES_CRM.textoCurto} caracteres.`, "nome");
  }
  return ok({ ...edicao, nome });
}

/**
 * A conexão em dois atos (ontologia 12.2): o Canal nasce `desconectada` e
 * conecta depois. Sem provedor real, a conexão é simulada e MARCADA como
 * simulada (D-08) — `conexaoSimulada` só vale com `conectada`, e desconectar
 * apaga a marca.
 *
 * `conexao_confirmada` (16-13, D-16-05) é a conexão de verdade: o provedor
 * confirmou a instância aberta e o número conferiu. Leva a `conectada` com
 * `conexaoSimulada: false` e, ao contrário de `simular_conexao`, aceita o Canal
 * que já está `conectada` (rodar o comando de novo troca o segredo do webhook e
 * tira a marca de simulada). `conectar` (QR) e `conexao_perdida`
 * (`CONNECTION_UPDATE`) ficam para a Sessão 4.
 *
 * `simular_conexao` (CR-01, 16-17) só vale para o Canal que NUNCA foi ligado a um
 * provedor real (D-16-03: a demonstração da Caixa em Canal simulado). O Canal
 * ligado (`FatosDaConexao.ligadoAoProvedor`) não volta a simulado: a saída dele
 * cairia no provedor de teste e a entrada da Evolution seria descartada. Reconectar
 * o Canal real é `canal:ligar-evolution` (a Sessão 4 troca pelo "Conectar" com QR).
 */
export type AcaoDeConexao = "simular_conexao" | "desconectar" | "conexao_confirmada";

/**
 * O que o domínio não sabe sozinho e quem decide a transição precisa trazer
 * (CR-01, 16-17). Obrigatório em `simular_conexao`; ignorado nas outras ações.
 */
export interface FatosDaConexao {
  /** O Canal tem credencial ativa do próprio provedor no cofre (o que `canal:ligar-evolution` guarda). */
  readonly ligadoAoProvedor: boolean;
}

/**
 * O Canal como a ficha o lê (`GET /canais/:id`): o `Canal` mais o fato da ligação ao provedor. Não é coluna de
 * `plataforma.canais`; a lista e as escritas seguem devolvendo `Canal`.
 */
export interface CanalNaFicha extends Canal {
  /** O Canal tem credencial ativa do próprio provedor no cofre; vem só na leitura da ficha, `GET /canais/:id`, e não é coluna de `plataforma.canais`. */
  readonly ligadoAoProvedor: boolean;
}

export const FRASE_DO_CANAL_REAL =
  "Este Canal já foi ligado a um provedor real e não volta a ser simulado. Para reconectá-lo, ligue-o de novo ao provedor.";

export const FRASE_SEM_FATOS_DA_CONEXAO =
  "Não foi possível conferir se o Canal está ligado a um provedor. Recarregue e tente de novo.";

export function proximaConexao(
  canal: Pick<Canal, "conexao" | "estado">,
  acao: AcaoDeConexao,
  fatos?: FatosDaConexao,
): OperationResult<{ readonly conexao: ConexaoDoCanal; readonly conexaoSimulada: boolean }> {
  if (acao === "conexao_confirmada") {
    if (canal.estado === "arquivado") return fail("Um Canal arquivado não se conecta.");
    return ok({ conexao: "conectada", conexaoSimulada: false });
  }
  if (acao === "simular_conexao") {
    if (canal.estado === "arquivado") return fail("Um Canal arquivado não se conecta.");
    if (canal.conexao === "conectada") return fail("O Canal já está conectado.");
    if (fatos === undefined) return fail(FRASE_SEM_FATOS_DA_CONEXAO);
    if (fatos.ligadoAoProvedor) return fail(FRASE_DO_CANAL_REAL);
    return ok({ conexao: "conectada", conexaoSimulada: true });
  }
  if (canal.conexao === "desconectada") return fail("O Canal já está desconectado.");
  return ok({ conexao: "desconectada", conexaoSimulada: false });
}

/** A mesma regra de `simular_conexao`, para a tela decidir se oferece o botão. */
export function podeSimularConexao(canal: Pick<CanalNaFicha, "conexao" | "estado" | "ligadoAoProvedor">): boolean {
  return proximaConexao(canal, "simular_conexao", { ligadoAoProvedor: canal.ligadoAoProvedor }).ok;
}

/**
 * A conta que autorizou no provedor é a do Canal? Compara pela forma canônica do
 * tipo (no Instagram, o usuário sem `@` e em minúsculas), a mesma que o Canal
 * guardou ao nascer. Trocar a conta de um Canal é arquivar e criar outro (INV-CXE-02).
 * Quem conecta pelo login do provedor (Sessão 8) usa `proximaConexao(canal, "conexao_confirmada")`.
 */
export function contaDoProvedorConfere(canal: Pick<Canal, "tipo" | "identificadorExterno">, contaAutorizada: string): boolean {
  const autorizada = identificadorCanonico(canal.tipo, contaAutorizada);
  const doCanal = identificadorCanonico(canal.tipo, canal.identificadorExterno);
  return autorizada !== undefined && autorizada === doCanal;
}

/**
 * 11.1: arquivar tira o Canal de uso e o libera para o mesmo número entrar
 * noutro. O Canal arquivado é sempre desconectado — o serviço faz as duas
 * mudanças na mesma escrita.
 */
export function validarArquivamento(canal: Pick<Canal, "estado">): OperationResult<void> {
  if (canal.estado === "arquivado") return fail("O Canal já está arquivado.");
  return ok(undefined);
}

/** Só os dígitos do número que o provedor informa (`5511987654321@s.whatsapp.net`, `5511987654321:12@s.whatsapp.net`, `+55 (11) 98765-4321`). */
function digitosDoNumero(bruto: string): string {
  return (bruto.split("@")[0] ?? "").split(":")[0]!.replace(/\D/g, "");
}

/**
 * Brasil: o WhatsApp antigo guarda o celular sem o nono dígito (`55` + DDD + 8 dígitos) e o novo com ele
 * (`55` + DDD + `9` + 8). Tira o `9` depois do DDD para os dois cadastros serem o mesmo número.
 */
function semONonoDigito(digitos: string): string {
  return digitos.length === 13 && digitos.startsWith("55") && digitos[4] === "9" ? digitos.slice(0, 4) + digitos.slice(5) : digitos;
}

function finalDe(digitos: string): string {
  return digitos.slice(-4);
}

/**
 * O número que o provedor diz estar conectado é o do Canal (16-13, D-16-05): antes de marcar `conectada` de
 * verdade, uma instância ligada a OUTRO número é recusada. Tolera o nono dígito brasileiro só para não recusar
 * o número certo; juntar Contatos com e sem o 9 é a 4.4.3 (Sessão 4), não esta função. A frase mostra só o final.
 */
export function conferirNumeroConectado(
  canal: Pick<Canal, "identificadorExterno">,
  numeroDoProvedor: string,
): OperationResult<void> {
  const doProvedor = digitosDoNumero(numeroDoProvedor);
  const doCanal = digitosDoNumero(canal.identificadorExterno);
  if (doProvedor === "") return fail("O provedor não informou o número conectado na instância.");
  if (semONonoDigito(doProvedor) === semONonoDigito(doCanal)) return ok(undefined);
  return fail(`O número conectado na instância (final ${finalDe(doProvedor)}) não é o deste Canal (final ${finalDe(doCanal)}).`);
}
