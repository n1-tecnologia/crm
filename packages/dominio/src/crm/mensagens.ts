/**
 * A Mensagem do CRM novo. Tipos camelCase dos campos de `plataforma.mensagens`
 * (008; ontologia 7.6), mais as regras que valem dos dois lados da fronteira —
 * a tela pré-valida e o endpoint aplica as MESMAS funções.
 *
 * Convive com o `Message` inglês de `types/crm.ts` até a fase de unificação
 * (D-11). Decisões do modelo:
 *   - `carga_bruta` (o que o provedor entregou, cru) existe só no banco e no
 *     caminho interno de ingestão (`RecebidaDoProvedor`, `crm/recebimento.ts`). O tipo público
 *     `Mensagem` não a carrega: ela é dado pessoal (A9) e a anonimização futura
 *     precisa zerá-la, então nada que sai pela api pode depender dela.
 *   - A Mensagem `recebida` não nasce por rota humana: `DIRECOES_DE_ENVIO` é o
 *     que uma pessoa manda e é a fonte do `z.enum` da rota (T-08-22).
 *   - `validarEnvio` é RN-CXE-19 por (tipo, provedor): quem chama entrega as
 *     capacidades do Canal (`capacidadesDoCanal`), e a regra não conhece
 *     provedor. B69 mora em `statusInicialDeEnvio`.
 * Nenhum tipo aqui carrega `workspaceId`.
 *
 * Os valores discretos abaixo são cópia literal da 008 (`satisfies` impede que
 * a constante e o tipo divirjam entre si):
 *   - `DirecaoDaMensagem`     → `mensagens_direcao_ck`
 *   - `TipoDeAtorDaMensagem`  → `mensagens_ator_ck`
 *   - `StatusDeEntrega`       → `mensagens_status_ck`
 *
 * Sem barril: `src/index.ts` não reexporta este módulo. Quem precisa importa
 * pelo subcaminho `@n1/dominio/crm/mensagens`.
 */

import type { ForaDaJanela } from "./capacidades";
import { fail, ok, type OperationResult } from "../state";
import type { ConexaoDoCanal } from "./canais";
import { LIMITES_CRM } from "./comum";
import { categoriaDaMidia } from "./midia";

export const DIRECOES_DA_MENSAGEM = ["recebida", "enviada", "interna"] as const satisfies readonly DirecaoDaMensagem[];
export type DirecaoDaMensagem = "recebida" | "enviada" | "interna";

export const DIRECOES_DE_ENVIO = ["enviada", "interna"] as const satisfies readonly DirecaoDaMensagem[];

export const STATUS_DE_ENTREGA = [
  "pendente",
  "enviada",
  "entregue",
  "lida",
  "falhou",
] as const satisfies readonly StatusDeEntrega[];
export type StatusDeEntrega = "pendente" | "enviada" | "entregue" | "lida" | "falhou";

export const TIPOS_DE_ATOR_DA_MENSAGEM = [
  "member",
  "agent",
  "automation",
  "integration",
  "system",
] as const satisfies readonly TipoDeAtorDaMensagem[];
export type TipoDeAtorDaMensagem = "member" | "agent" | "automation" | "integration" | "system";

export interface AtorDaMensagem {
  readonly tipo: TipoDeAtorDaMensagem;
  readonly id: string;
}

export interface AnexoDaMensagem {
  readonly tipoDeMidia: string;
  readonly nome: string;
  /** O id da mídia no provedor (a Mensagem `recebida`); some quando o arquivo é guardado. */
  readonly referenciaExterna?: string;
  /** A chave do objeto no bucket. Não dá acesso a nada: quem abre o arquivo pede uma URL assinada (3.9.3). */
  readonly objectKey?: string;
  readonly tamanhoBytes?: number;
  /** `true` quando o arquivo está guardado no bucket; `false` quando só há a referência do provedor (D-16-08). */
  readonly baixado: boolean;
}

export interface EnderecoAdicional {
  readonly tipo: "para" | "copia" | "copiaOculta";
  readonly endereco: string;
  readonly nomeExibido?: string;
}

export interface Mensagem {
  readonly id: string;
  readonly conversaId: string;
  readonly canalId: string;
  readonly seq: number;
  readonly direcao: DirecaoDaMensagem;
  readonly ator: AtorDaMensagem;
  readonly delegante: AtorDaMensagem | null;
  readonly remetenteParticipanteId: string | null;
  readonly identificadorId: string | null;
  readonly remetenteExterno: string | null;
  readonly conteudo: string | null;
  readonly anexos: readonly AnexoDaMensagem[];
  readonly assunto: string | null;
  readonly enderecosAdicionais: readonly EnderecoAdicional[];
  readonly emRespostaAId: string | null;
  /**
   * A Mensagem de modelo que foi enviada (WhatsApp oficial, 7.3): o id e o nome do modelo na Meta e, desde a Sessão 7, o idioma
   * e as variáveis preenchidas (a entrega os lê para montar o envio). Sem modelo, `null`.
   */
  readonly modeloUsado: { readonly idNoProvedor: string; readonly nome: string; readonly idioma?: string; readonly variaveis?: readonly string[] } | null;
  readonly idExterno: string | null;
  readonly statusEntrega: StatusDeEntrega | null;
  readonly statusEntregaEm: string | null;
  readonly motivoFalha: string | null;
  readonly leiturasInternas: readonly unknown[];
  /** O registro das Reações (4.4.5): cada uma é um acréscimo, e a vigente é a última de cada autor (`reacoesVigentes`). */
  readonly reacoes: readonly Reacao[];
  /** Preenchida quando a Mensagem foi apagada (4.4.5): o conteúdo continua guardado, mas deixa de ser exibido. Terminal. */
  readonly marcacaoExclusao: MarcacaoDeExclusao | null;
  /** O histórico das edições que o remetente externo transmitiu (4.4.5): o conteúdo ANTERIOR de cada uma, da mais antiga à mais nova. */
  readonly edicoesExternas: readonly EdicaoExterna[];
  readonly anonimizada: boolean;
  readonly criadoEm: string;
  readonly registradoEm: string;
}

/** O arquivo que a pessoa anexou: o ticket que ela pediu (`submissionId`) e o objeto reservado nele. */
export interface ReferenciaDeAnexoEnviado {
  readonly submissionId: string;
  readonly objectId: string;
}

/** O que o servidor confirmou no bucket sobre um anexo: o tipo e o tamanho vêm do arquivo, não do cliente. */
export interface AnexoConfirmado {
  readonly objectKey: string;
  readonly nome: string;
  readonly tipoDeMidia: string;
  readonly tamanhoBytes: number;
}

/** Uma Mensagem é uma mensagem no provedor e tem um `id_externo` só: um arquivo por vez. */
export const MAX_ANEXOS_POR_MENSAGEM = 1;

export interface NovaMensagem {
  readonly conversaId: string;
  readonly direcao: "enviada" | "interna";
  /** Pode ser vazio quando há anexo (INV-CXE-07: conteúdo OU anexo). */
  readonly conteudo: string;
  readonly emRespostaAId?: string;
  readonly anexos?: readonly ReferenciaDeAnexoEnviado[];
  /**
   * Sessão 7 (7.3): envia uma Mensagem de MODELO do Canal (`plataforma.modelos_de_mensagem`) com `variaveis` preenchendo
   * `{{1}}`, `{{2}}`… do corpo. O `conteudo` pode ficar vazio: o servidor grava o texto do modelo já preenchido. Só vale para a
   * Mensagem enviada e sem arquivo.
   */
  readonly modeloId?: string | undefined;
  readonly variaveis?: readonly string[] | undefined;
}

/**
 * Uma Mensagem que uma pessoa manda: `enviada` ao Contato ou `interna` (nota,
 * B67). INV-CXE-07: texto OU anexo. O anexo é só a referência do arquivo que a
 * pessoa subiu; o servidor confere o arquivo (tipo, tamanho, assinatura) antes de gravar.
 */
export function validarNovaMensagem(entrada: NovaMensagem): OperationResult<NovaMensagem> {
  if (entrada.conversaId.trim() === "") return fail("Escolha a Conversa da Mensagem.", "conversaId");
  if (!(DIRECOES_DE_ENVIO as readonly string[]).includes(entrada.direcao)) {
    return fail("Uma Mensagem recebida não é criada por uma pessoa.", "direcao");
  }
  const anexos = entrada.anexos ?? [];
  if (entrada.modeloId !== undefined && entrada.modeloId !== "") {
    // 7.3: a Mensagem de modelo é uma Mensagem enviada, sem arquivo; o texto vem do modelo, não da pessoa.
    if (entrada.direcao !== "enviada") return fail("Só uma Mensagem enviada usa modelo.", "modeloId");
    if (anexos.length > 0) return fail("Uma Mensagem de modelo não leva arquivo.", "anexos");
    return ok(entrada);
  }
  if (anexos.length > MAX_ANEXOS_POR_MENSAGEM) return fail("Uma Mensagem leva um arquivo por vez.", "anexos");
  for (const anexo of anexos) {
    if (anexo.submissionId.trim() === "" || anexo.objectId.trim() === "") {
      return fail("O arquivo anexado não foi reconhecido. Envie-o de novo.", "anexos");
    }
  }
  if (entrada.conteudo.trim() === "" && anexos.length === 0) {
    return fail("Escreva a mensagem ou anexe um arquivo antes de enviar.", "conteudo");
  }
  if (entrada.conteudo.length > LIMITES_CRM.textoLongo) {
    return fail(`A Mensagem vai até ${LIMITES_CRM.textoLongo} caracteres.`, "conteudo");
  }
  return ok(entrada);
}

/** 3.9.1: o Canal só envia as categorias que declara em `sendableMediaTypes` — um Canal que não envia vídeo recusa vídeo. */
export function validarAnexosDoEnvio(
  anexos: readonly AnexoConfirmado[],
  sendableMediaTypes: readonly string[],
): OperationResult<void> {
  for (const anexo of anexos) {
    const categoria = categoriaDaMidia(anexo.tipoDeMidia);
    if (categoria === undefined || !sendableMediaTypes.includes(categoria)) {
      return fail("Este Canal não envia este tipo de arquivo.", "anexos");
    }
  }
  return ok(undefined);
}

export interface EntradaDeEnvio {
  /** As Capacidades do Canal (`capacidadesDoCanal`): a regra não conhece o provedor. */
  readonly capacidades: {
    readonly responseWindowHours?: number;
    readonly foraDaJanela: ForaDaJanela;
  };
  /** O `criadoEm` da última Mensagem `recebida` da Conversa; `null` se nunca recebeu. */
  readonly ultimaRecebidaEm: string | null;
  /** O instante do envio, em milissegundos — vem de quem chama, para a regra ser pura. */
  readonly agora: number;
  readonly modeloId?: string;
  /** Os ids, no provedor, dos modelos aprovados do Canal. A api passa `[]` nesta fase. */
  readonly modelosAprovados: readonly string[];
}

/** `bloqueado` antes da primeira recebida: o provedor só deixa responder (Instagram). */
export const FRASE_SO_RESPONDE =
  "Neste Canal só se responde a quem escreveu primeiro: a conversa começa quando o Contato manda a primeira mensagem.";

/** `soModelo` antes da primeira recebida (WhatsApp oficial): a conversa só começa com Mensagem de modelo aprovada. */
export const FRASE_SO_MODELO_PRIMEIRO =
  "O Contato ainda não mandou mensagem por este Canal: para começar a conversa, escolha uma Mensagem de modelo aprovada.";

/** `bloqueado` depois da janela: não existe modelo, só o Contato reabre. */
export function fraseDaJanelaBloqueada(horas: number): string {
  return `Passaram ${horas} h desde a última mensagem do Contato: só ele pode reabrir a conversa.`;
}

/**
 * RN-CXE-19: o que sai depois da janela de resposta depende de `foraDaJanela`,
 * e a recusa vem ANTES de gravar, para qualquer ator. A janela vale até o
 * instante do fim (a mesma conta de `sendMessage`).
 *   - `livre` (WhatsApp não oficial, E-mail, LinkedIn, Chat do site): texto a qualquer hora.
 *   - `soModelo` (WhatsApp oficial): fora da janela, só Mensagem de modelo aprovada. Sem
 *     nenhuma recebida a janela ainda não existe, e a empresa só abre a conversa com modelo
 *     aprovado (Sessão 7, 7.2.6): vale a regra de fora da janela.
 *   - `bloqueado` (Instagram, Sessão 8): não existe modelo. Sem recebida ou fora da
 *     janela, nada sai — só o Contato reabre a conversa.
 */
export function validarEnvio(entrada: EntradaDeEnvio): OperationResult<void> {
  const { capacidades, ultimaRecebidaEm, agora, modeloId, modelosAprovados } = entrada;
  if (capacidades.foraDaJanela === "livre") return ok(undefined);
  const horas = capacidades.responseWindowHours;
  if (capacidades.foraDaJanela === "bloqueado") {
    if (ultimaRecebidaEm === null) return fail(FRASE_SO_RESPONDE, "conteudo");
    if (horas !== undefined && agora > Date.parse(ultimaRecebidaEm) + horas * 3_600_000) {
      return fail(fraseDaJanelaBloqueada(horas), "conteudo");
    }
    return ok(undefined);
  }
  if (horas === undefined) return ok(undefined);
  // 7.2.6: sem nenhuma recebida não há janela aberta, e o WhatsApp oficial só deixa a empresa começar com modelo.
  const semRecebida = ultimaRecebidaEm === null;
  if (!semRecebida && agora <= Date.parse(ultimaRecebidaEm) + horas * 3_600_000) return ok(undefined);

  if (modelosAprovados.length === 0) {
    return fail(
      semRecebida
        ? "Este Canal não tem Mensagem de modelo aprovada: não dá para começar a conversa."
        : "Este Canal não tem Mensagem de modelo aprovada: não dá para enviar fora da janela de resposta.",
      "modelo",
    );
  }
  if (modeloId === undefined || modeloId === "") {
    return fail(
      semRecebida ? FRASE_SO_MODELO_PRIMEIRO : "A janela de resposta deste Canal expirou. Só é possível enviar uma Mensagem de modelo aprovada.",
      "modelo",
    );
  }
  if (!modelosAprovados.includes(modeloId)) {
    return fail("Escolha uma Mensagem de modelo aprovada pelo provedor.", "modelo");
  }
  return ok(undefined);
}

/**
 * B69 + 3.7.1: a Mensagem escrita na Caixa nasce SEMPRE `pendente`. Com o Canal
 * fora do ar ela é guardada, nunca descartada em silêncio; com o Canal
 * `conectada` ela entra na fila de saída e só o provedor diz que saiu — quem
 * a passa a `enviada` é a entrega, depois da confirmação dele. O atendente
 * jamais vê "enviada" numa Mensagem que ainda não saiu (MSG-02).
 *
 * O parâmetro `conexao` fica na assinatura: os chamadores já o passam e a regra
 * pode voltar a distinguir o Canal sem tocar neles.
 */
export function statusInicialDeEnvio(_conexao: ConexaoDoCanal): StatusDeEntrega {
  return "pendente";
}

/** A escada da entrega. `falhou` fica de fora: não é um degrau, é uma saída que só `pendente`/`enviada` têm. */
const POSICAO_NA_ENTREGA: Readonly<Record<Exclude<StatusDeEntrega, "falhou">, number>> = {
  pendente: 0,
  enviada: 1,
  entregue: 2,
  lida: 3,
};

/**
 * 3.6.5, MSG-02: o status de entrega que o provedor informa SÓ avança. A ordem é
 * `pendente` < `enviada` < `entregue` < `lida`; um `entregue` que chega depois de um `lida` (a rede não garante a
 * ordem) deixa a Mensagem `lida`: ela nunca parece menos entregue do que já foi. `falhou` só vale a partir de
 * `pendente` ou `enviada` (uma Mensagem que o destinatário já recebeu não "falha"), e nada sai de `falhou` por
 * um status do provedor: quem tira uma Mensagem de `falhou` é a pessoa, por "Tentar de novo".
 *
 * `atual = null` é a Mensagem que não tem status de entrega (`recebida`, `interna`): o status do provedor não se
 * aplica e a resposta é `null`. Devolve o próprio `atual` quando o novo não avança, para quem chama comparar.
 */
export function proximoStatusDeEntrega(atual: StatusDeEntrega | null, novo: StatusDeEntrega): StatusDeEntrega | null {
  if (atual === null || atual === "falhou") return atual;
  if (novo === "falhou") return atual === "pendente" || atual === "enviada" ? "falhou" : atual;
  return POSICAO_NA_ENTREGA[novo] > POSICAO_NA_ENTREGA[atual] ? novo : atual;
}

/**
 * 4.4.5, ontologia 7.6: quem reagiu. A Conversa é de um Contato e um Canal, então só há dois autores possíveis: o Contato e o
 * celular do próprio Canal (a reação dada no aparelho conectado).
 */
export type AutorDaReacao = "contato" | "canal";

/**
 * Uma Reação é um ACRÉSCIMO ao registro (RN-CXE-16: "Reações (acréscimo)"); a que foi removida é o registro com o símbolo
 * vazio. O que vale hoje é a última de cada autor (`reacoesVigentes`), e uma reação nova do mesmo autor a substitui.
 */
export interface Reacao {
  readonly autor: AutorDaReacao;
  /** O símbolo; `""` é a reação removida. */
  readonly emoji: string;
  /** O momento que o provedor deu. */
  readonly em: string;
}

/** Quem apagou: o Contato no provedor, o celular do Canal, ou um Membro (a exclusão interna). */
export type OrigemDaExclusao = "remetente_externo" | "celular_do_canal" | "interno";

/**
 * A Marcação de exclusão (ontologia 7.6; RN-CXE-16): terminal e irreversível. A Mensagem continua na Conversa com um marcador;
 * o conteúdo e os anexos ficam guardados mas deixam de ser exibidos.
 */
export interface MarcacaoDeExclusao {
  readonly porQuem: OrigemDaExclusao;
  readonly em: string;
}

/** Uma edição que o remetente externo transmitiu (WhatsApp, Instagram): o conteúdo ANTES dela e o momento. O conteúdo da Mensagem passa a ser o novo. */
export interface EdicaoExterna {
  readonly conteudoAnterior: string | null;
  readonly em: string;
}

const AUTORES_DA_REACAO: readonly AutorDaReacao[] = ["contato", "canal"];
const ORIGENS_DA_EXCLUSAO: readonly OrigemDaExclusao[] = ["remetente_externo", "celular_do_canal", "interno"];

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

/**
 * O que o banco guarda é JSON: de uma linha antiga (a migração do CRM antigo copiou a lista como estava) pode vir uma forma que
 * não é a de hoje. Estas leituras ficam só com o que tem o formato certo, para a tela nunca tropeçar num dado velho.
 */
export function leReacoes(valor: unknown): readonly Reacao[] {
  if (!Array.isArray(valor)) return [];
  return valor.flatMap((item): Reacao[] => {
    if (!ehObjeto(item)) return [];
    const { autor, emoji, em } = item;
    if (!AUTORES_DA_REACAO.includes(autor as AutorDaReacao) || typeof emoji !== "string" || typeof em !== "string") return [];
    return [{ autor: autor as AutorDaReacao, emoji, em }];
  });
}

export function leMarcacaoDeExclusao(valor: unknown): MarcacaoDeExclusao | null {
  if (!ehObjeto(valor)) return null;
  const { porQuem, em } = valor;
  if (!ORIGENS_DA_EXCLUSAO.includes(porQuem as OrigemDaExclusao) || typeof em !== "string") return null;
  return { porQuem: porQuem as OrigemDaExclusao, em };
}

export function leEdicoesExternas(valor: unknown): readonly EdicaoExterna[] {
  if (!Array.isArray(valor)) return [];
  return valor.flatMap((item): EdicaoExterna[] => {
    if (!ehObjeto(item)) return [];
    const { conteudoAnterior, em } = item;
    if ((conteudoAnterior !== null && typeof conteudoAnterior !== "string") || typeof em !== "string") return [];
    return [{ conteudoAnterior: conteudoAnterior ?? null, em }];
  });
}

/** A Reação que vale hoje de cada autor: a de maior momento (a última gravada, no empate), sem as removidas. O Contato vem antes do Canal. */
export function reacoesVigentes(reacoes: readonly Reacao[]): readonly { readonly autor: AutorDaReacao; readonly emoji: string }[] {
  const ultima = new Map<AutorDaReacao, Reacao>();
  for (const reacao of reacoes) {
    const atual = ultima.get(reacao.autor);
    if (atual === undefined || Date.parse(reacao.em) >= Date.parse(atual.em)) ultima.set(reacao.autor, reacao);
  }
  return AUTORES_DA_REACAO.flatMap((autor) => {
    const reacao = ultima.get(autor);
    return reacao === undefined || reacao.emoji === "" ? [] : [{ autor, emoji: reacao.emoji }];
  });
}

/**
 * O registro depois de uma Reação nova, ou `null` quando ela não muda nada: a repetida (mesmo autor, símbolo e momento: o
 * provedor reenvia), a remoção de uma reação que não existia, e a que chega mais VELHA que a vigente do mesmo autor (a rede não
 * garante a ordem). Acréscimo: nada é apagado do registro, e a remoção é um registro com o símbolo vazio.
 */
export function proximasReacoes(atuais: readonly Reacao[], nova: Reacao): readonly Reacao[] | null {
  if (Number.isNaN(Date.parse(nova.em))) return null;
  if (atuais.some((r) => r.autor === nova.autor && r.emoji === nova.emoji && r.em === nova.em)) return null;
  const doAutor = atuais.filter((r) => r.autor === nova.autor);
  const vigente = doAutor.reduce<Reacao | undefined>((a, r) => (a === undefined || Date.parse(r.em) >= Date.parse(a.em) ? r : a), undefined);
  if (vigente !== undefined && Date.parse(nova.em) < Date.parse(vigente.em)) return null;
  if (nova.emoji === "" && (vigente === undefined || vigente.emoji === "")) return null;
  return [...atuais, nova];
}

/** A Marcação de exclusão que vale: a primeira (terminal), e `null` quando já havia uma. */
export function proximaMarcacaoDeExclusao(atual: MarcacaoDeExclusao | null, nova: MarcacaoDeExclusao): MarcacaoDeExclusao | null {
  if (atual !== null || Number.isNaN(Date.parse(nova.em))) return null;
  return nova;
}

/**
 * A edição que o remetente externo transmitiu (RN-CXE-16): só a Mensagem `recebida` e ainda não apagada muda, o conteúdo
 * passa a ser o novo e o anterior vai para o histórico. `null` quando não muda nada: a `enviada` e a `interna` nunca são
 * editadas ("corrige-se enviando outra"), a apagada é terminal, o conteúdo novo é vazio ou igual ao atual (o provedor reenvia).
 */
export function proximaEdicaoExterna(
  mensagem: Pick<Mensagem, "direcao" | "conteudo" | "marcacaoExclusao" | "edicoesExternas">,
  conteudoNovo: string,
  em: string,
): { readonly conteudo: string; readonly edicoesExternas: readonly EdicaoExterna[] } | null {
  if (mensagem.direcao !== "recebida" || mensagem.marcacaoExclusao !== null) return null;
  if (conteudoNovo.trim() === "" || conteudoNovo === mensagem.conteudo || Number.isNaN(Date.parse(em))) return null;
  return { conteudo: conteudoNovo, edicoesExternas: [...mensagem.edicoesExternas, { conteudoAnterior: mensagem.conteudo, em }] };
}
