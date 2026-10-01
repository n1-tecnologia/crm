/**
 * Checklist 1.8 — o Formulário público da Solicitação de pagamento, como DADO:
 * as perguntas na ordem, as seções e as condições do UI-SPEC da Fase 2
 * (`02-UI-SPEC.md`, "Formulário público"), apontando para os Campos do
 * catálogo da Lista. Antes, a ordem, as seções e as condições moravam no
 * código da página pública e dependiam do rótulo exato de cada pergunta;
 * agora a página lê do Formulário, e depois de criado ele se edita pela tela
 * (Lista › Configurações › Formulários).
 *
 * `garantirFormularioDaSolicitacao` cria o Formulário UMA vez: se já existe
 * um ativo com este nome na Lista, nada muda — o que alguém editou pela tela
 * não é sobrescrito por um comando.
 */

import type { FormInput } from "./operations/scale";
import { createForm } from "./operations/scale";
import { CATALOGO_SOLICITACAO_DE_PAGAMENTO } from "./solicitacao-de-pagamento";
import { LISTA_ID } from "./solicitacao-de-pagamento-evolver";
import { fail, ok, type DataState, type OperationResult } from "./state";
import type { Form, Id } from "./types";

export const NOME_DO_FORMULARIO_DA_SOLICITACAO = "Solicitação de pagamento";
export const INTRODUCAO_DO_FORMULARIO_DA_SOLICITACAO = "Preencha os dados do pagamento. O Financeiro acompanhará a solicitação por este número.";
/** UI-SPEC: documento, anexo e dado de pagamento, quando não obrigatórios no envio. */
export const AJUDA_PARA_SEGUIR_A_APROVACAO = "Necessário para seguir à aprovação.";

/** O id do Campo do catálogo pelo rótulo — falha alto se o catálogo mudar de nome. */
function campo(rotulo: string): Id {
  const achado = CATALOGO_SOLICITACAO_DE_PAGAMENTO.campos.find((c) => c.rotulo === rotulo);
  if (!achado) throw new Error(`O catálogo da Solicitação não tem o Campo "${rotulo}".`);
  return achado.id;
}

type Pergunta = FormInput["questions"][number];

const pergunta = (id: string, rotulo: string, secao: string, extra: Partial<Pergunta> = {}): Pergunta => ({
  id,
  label: rotulo,
  required: false,
  target: { kind: "field", definitionId: campo(rotulo) },
  section: secao,
  ...extra,
});

/**
 * As perguntas na ordem do UI-SPEC. Os ids são provisórios (`createForm` dá
 * os definitivos) e servem para as condições apontarem para o gatilho.
 * Obrigatórias: só o título e o Centro de Custo (a única obrigatoriedade do
 * schema da Lista); o resto é do pipeline, que valida depois.
 */
export function perguntasDoFormularioDaSolicitacao(): FormInput["questions"] {
  const sobre = "Sobre a solicitação";
  const solicitante = "Solicitante";
  const classificacao = "Classificação";
  const fornecedor = "Fornecedor";
  const documento = "Documento e datas";
  const pagamento = "Pagamento";
  const aprovacao = { help: AJUDA_PARA_SEGUIR_A_APROVACAO };
  const quandoFornecedor = (valor: string) => ({ showWhen: { questionId: "p_fornecedor", values: [valor] } });
  const quandoForma = (valor: string) => ({ showWhen: { questionId: "p_forma", values: [valor] }, ...aprovacao });
  return [
    { id: "p_titulo", label: "O que deve ser pago?", required: true, target: { kind: "title" }, section: sobre },
    { id: "p_descricao", label: "O que é e como será utilizado?", required: false, target: { kind: "description" }, section: sobre },
    pergunta("p_solicitante", "Nome do solicitante", solicitante),
    pergunta("p_whatsapp", "WhatsApp", solicitante),
    pergunta("p_centro", "Centro de Custo", classificacao, { required: true }),
    pergunta("p_bu", "BU", classificacao),
    pergunta("p_empresa", "Empresa", classificacao),
    pergunta("p_categoria", "Categoria de pagamento", classificacao),
    pergunta("p_produto", "Produto", classificacao),
    pergunta("p_fornecedor", "Fornecedor", fornecedor, aprovacao),
    pergunta("p_cpf", "CPF", fornecedor, { ...quandoFornecedor("CPF"), ...aprovacao }),
    pergunta("p_cnpj", "CNPJ", fornecedor, { ...quandoFornecedor("CNPJ"), ...aprovacao }),
    pergunta("p_nome_fornecedor", "Nome do fornecedor", fornecedor),
    pergunta("p_anexo", "Anexo", documento, aprovacao),
    pergunta("p_emissao", "Data de Emissão", documento),
    pergunta("p_vencimento", "Data Vencimento", documento),
    pergunta("p_valor", "Valor", documento),
    pergunta("p_forma", "Forma de pagamento", pagamento, aprovacao),
    pergunta("p_chave_pix", "Chave pix", pagamento, quandoForma("Chave Pix")),
    pergunta("p_codigo_barras", "Código de barras", pagamento, quandoForma("Boleto")),
    pergunta("p_boleto", "Boleto", pagamento, quandoForma("Boleto")),
    pergunta("p_pix_copia", "Pix copia e cola", pagamento, quandoForma("QRCode Pix")),
    pergunta("p_qr_code", "QR Code", pagamento, quandoForma("QRCode Pix")),
    pergunta("p_link", "Link de pagamento", pagamento, quandoForma("Cartão")),
  ];
}

export function formularioDaSolicitacao(): FormInput {
  return {
    name: NOME_DO_FORMULARIO_DA_SOLICITACAO,
    description: INTRODUCAO_DO_FORMULARIO_DA_SOLICITACAO,
    questions: perguntasDoFormularioDaSolicitacao(),
  };
}

export type ResultadoDoFormularioDaSolicitacao =
  | { readonly criado: true; readonly form: Form }
  | { readonly criado: false; readonly form: Form };

/**
 * Cria o Formulário da Solicitação, com `actingMemberId` como dono (o envio
 * anônimo cria a Tarefa em nome dele), se ainda não existe um ativo com este
 * nome na Lista. Existindo, devolve-o sem mudar nada.
 */
export function garantirFormularioDaSolicitacao(state: DataState, actingMemberId: Id): OperationResult<ResultadoDoFormularioDaSolicitacao> {
  if (!state.lists.some((l) => l.id === LISTA_ID)) {
    return fail("A Lista de Solicitações não existe: rode `solicitacoes:configurar` antes.");
  }
  const existente = state.forms.find(
    (f) => f.listId === LISTA_ID && f.lifecycle === "ativo" && f.name.trim().toLocaleLowerCase("pt-BR") === NOME_DO_FORMULARIO_DA_SOLICITACAO.toLocaleLowerCase("pt-BR"),
  );
  if (existente) return ok({ criado: false, form: existente });
  const criado = createForm(state, actingMemberId, LISTA_ID, formularioDaSolicitacao());
  if (!criado.ok) return fail(criado.error, criado.field);
  return ok({ criado: true, form: criado.value });
}
