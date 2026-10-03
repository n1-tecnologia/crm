/**
 * O estado de demonstração do vídeo: o seed do domínio (dados fictícios), com
 * a Lista de Solicitações e o Formulário criados pelas MESMAS funções que
 * configuraram a produção (`evoluirConfiguracaoDeSolicitacoes`,
 * `garantirFormularioDaSolicitacao`), pedidos de exemplo enviados pelo próprio
 * `submitForm` e um Resumo de pagamento esperando conferência. Nada aqui
 * lê ou grava dado real.
 */

import { buildSeed } from "@n1/dominio/seed";
import { CP } from "@n1/dominio/operations/financeiro";
import { publicarResumoParaConferencia, submitForm, type DeParaDeLancamento } from "@n1/dominio/operations";
import { evoluirConfiguracaoDeSolicitacoes } from "@n1/dominio/solicitacao-de-pagamento-evolver";
import { garantirFormularioDaSolicitacao } from "@n1/dominio/formulario-da-solicitacao";
import type { DataState } from "@n1/dominio/state";

/** A Mari do seed — quem "grava a tela". */
export const MARI = CP.financeiroId;

/** A conta a pagar do seed com o Resumo esperando conferência (completa, "para pagar", Tag "conta tria"). */
export const CONTA_COM_RESUMO = "tsk_cp_das";

const DE_PARA: DeParaDeLancamento = {
  contaPorTag: { "conta tria": "TRIA" },
  categoriaPorCampo: { Impostos: { veredito: "resolvida", nome: "Impostos e taxas", codigo: "2.06.01" } },
  origem: "omie",
};

/** Pedidos que já chegaram pelo Formulário antes da gravação começar. */
const PEDIDOS: ReadonlyArray<Readonly<Record<string, string>>> = [
  {
    "O que deve ser pago?": "Assinatura anual do software de design",
    "O que é e como será utilizado?": "Licença do time de criação para as peças das campanhas.",
    "Nome do solicitante": "Júlia Prado",
    "Centro de Custo": "TRIA",
    "Fornecedor": "CNPJ",
    "Nome do fornecedor": "Estúdio Exemplo Ltda",
    "Valor": "2400",
    "Forma de pagamento": "Boleto",
  },
  {
    "O que deve ser pago?": "Coffee break do workshop de outubro",
    "Nome do solicitante": "Rafael Nunes",
    "Centro de Custo": "TRIA",
    "Fornecedor": "CPF",
    "Nome do fornecedor": "Ana Souza Buffet",
    "Valor": "680",
    "Forma de pagamento": "Chave Pix",
  },
];

function exigir<T>(resultado: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: string }, oQue: string): T {
  if (!resultado.ok) throw new Error(`${oQue}: ${resultado.error}`);
  return resultado.value;
}

export function estadoDeDemonstracao(): { readonly state: DataState; readonly segredo: string } {
  const state = buildSeed();
  exigir(evoluirConfiguracaoDeSolicitacoes(state, MARI), "configurar a Lista de Solicitações");
  const { form } = exigir(garantirFormularioDaSolicitacao(state, MARI), "criar o Formulário");
  const pergunta = (rotulo: string): string => {
    const achada = form.questions.find((p) => p.label === rotulo);
    if (!achada) throw new Error(`o Formulário não tem a pergunta “${rotulo}”`);
    return achada.id;
  };
  for (const pedido of PEDIDOS) {
    const answers = Object.fromEntries(Object.entries(pedido).map(([rotulo, valor]) => [pergunta(rotulo), valor]));
    exigir(submitForm(state, form.secret, { answers }), `enviar “${pedido["O que deve ser pago?"]}”`);
  }
  exigir(publicarResumoParaConferencia(state, MARI, CONTA_COM_RESUMO, { dePara: DE_PARA }), "publicar o Resumo");
  return { state, segredo: form.secret };
}
