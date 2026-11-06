/**
 * O gesto misto das Ferramentas do Canal (Grupo, Comunidade, Flow): as
 * operações que conferem Canal e Contato contra as tabelas do CRM novo
 * (`plataforma.canais`, `plataforma.contatos`), não contra a projeção antiga do
 * estado, que some na 3.5.4. Fase 15, 3.4.8 (UCR-08).
 *
 * O `crm` que o navegador mandou (último argumento, só para a execução local)
 * é DESCARTADO: a posição é sobrescrita com o que o servidor leu, deste Espaço,
 * em qualquer estado (T-15-20). Quem decide é o domínio, com esse conjunto.
 *
 * `posicao` é o índice do `crm` em `args` (o argumento depois dos que a
 * operação recebe do navegador). Grupo e Flow CONTINUAM gravando a Conversa de
 * Grupo e o envio de Flow em `state.conversations` (F14-D-05): só a conferência
 * de Canal e de Contato vem das tabelas.
 *
 * Fica num arquivo próprio para que os planos paralelos não disputem o mesmo
 * arquivo; `index.ts` compõe. O 15-17 acrescenta aqui a criação do Contato do
 * Participante (`AO_CONFIRMAR_FERRAMENTAS`).
 */

import type { DataState } from "@n1/dominio";
import { criarRepositorioDeCanaisPg } from "../../repositorios/crm/canais";
import { criarRepositorioDeContatosPg } from "../../repositorios/crm/contatos";
import type { LeituraDoCrm, TabelaDeConfirmacoes, TabelaDeLeituras } from "./tipos";

/** Os ids de Contato que a operação cita; só o que for texto entra (o esquema já fixou a forma dos `args`). */
type IdsDeContato = (args: readonly unknown[], state: DataState) => readonly unknown[];

const textos = (valor: unknown): string[] => (Array.isArray(valor) ? valor.filter((v): v is string => typeof v === "string") : []);
const objetoOuVazio = (valor: unknown): Record<string, unknown> => (typeof valor === "object" && valor !== null ? (valor as Record<string, unknown>) : {});

/** `criarGrupo`: os Participantes iniciais, os administradores e o Contato criador do `input`. */
const contatosDoCriarGrupo: IdsDeContato = (args) => {
  const input = objetoOuVazio(args[0]);
  return [...textos(input.participantesIniciaisContactIds), ...textos(input.administradoresContactIds), ...textos([input.contatoCriadorId])];
};

/** `enviarLinkDeConvite(grupoId, contactIds)`. */
const contatosDoEnvioDeConvite: IdsDeContato = (args) => textos(args[1]);

/** `adicionarParticipantes(grupoId, { contactIds })`. */
const contatosDoAdicionar: IdsDeContato = (args) => textos(objetoOuVazio(args[1]).contactIds);

/** `removerParticipante`, `promoverParticipante`, `rebaixarParticipante`: o Contato da Participação alvo, para o nome no Registro. */
const contatoDaParticipacaoAlvo: IdsDeContato = (args, state) => {
  const grupo = state.grupos.find((g) => g.id === args[0]);
  const participacao = grupo?.participacoes.find((p) => p.id === args[1]);
  return participacao?.contactId ? [participacao.contactId] : [];
};

/** `aprovarPedidoDeEntrada`, `recusarPedidoDeEntrada`: o Contato do Pedido alvo. */
const contatoDoPedidoAlvo: IdsDeContato = (args, state) => {
  const grupo = state.grupos.find((g) => g.id === args[0]);
  const pedido = grupo?.pedidosDeEntrada.find((p) => p.id === args[1]);
  return pedido ? [pedido.contactId] : [];
};

/**
 * A leitura de uma operação de Ferramenta: os Canais do Espaço e os Contatos
 * citados (`resumidosPorIds`, do Espaço da sessão, teto de 500). `posicao` é o
 * índice do `crm` em `args`; sem `idsDeContato` a operação não confere Contato.
 */
const leituraDasFerramentas = (posicao: number, idsDeContato?: IdsDeContato): LeituraDoCrm => ({
  posicao,
  ler: async (cliente, workspaceId, args, state) => ({
    canais: await criarRepositorioDeCanaisPg(cliente).todos(workspaceId),
    contatos: idsDeContato
      ? await criarRepositorioDeContatosPg(cliente).resumidosPorIds(
          workspaceId,
          idsDeContato(args, state).filter((id): id is string => typeof id === "string"),
        )
      : [],
  }),
  argumento: (lido) => ({ canais: lido.canais ?? [], contatos: lido.contatos ?? [] }),
});

export const LER_DO_CRM_FERRAMENTAS: TabelaDeLeituras = {
  // Grupo — `[..., crm]`: a posição é o índice logo depois dos argumentos da operação.
  criarGrupo: leituraDasFerramentas(1, contatosDoCriarGrupo),
  importarGruposDoCanal: leituraDasFerramentas(1),
  sincronizarGrupo: leituraDasFerramentas(1),
  editarGrupo: leituraDasFerramentas(2),
  definirCanalDoGrupo: leituraDasFerramentas(2),
  regenerarLinkDeConvite: leituraDasFerramentas(1),
  enviarLinkDeConvite: leituraDasFerramentas(2, contatosDoEnvioDeConvite),
  adicionarParticipantes: leituraDasFerramentas(2, contatosDoAdicionar),
  removerParticipante: leituraDasFerramentas(2, contatoDaParticipacaoAlvo),
  promoverParticipante: leituraDasFerramentas(2, contatoDaParticipacaoAlvo),
  rebaixarParticipante: leituraDasFerramentas(2, contatoDaParticipacaoAlvo),
  sairDoGrupo: leituraDasFerramentas(2),
  aprovarPedidoDeEntrada: leituraDasFerramentas(2, contatoDoPedidoAlvo),
  recusarPedidoDeEntrada: leituraDasFerramentas(3, contatoDoPedidoAlvo),
  enviarMensagemAoGrupo: leituraDasFerramentas(2),
  // Comunidade
  criarComunidade: leituraDasFerramentas(1),
  sincronizarComunidade: leituraDasFerramentas(1),
  editarComunidade: leituraDasFerramentas(2),
  alterarConfiguracoesDaComunidade: leituraDasFerramentas(2),
  vincularGrupoAComunidade: leituraDasFerramentas(2),
  desvincularGrupoDaComunidade: leituraDasFerramentas(2),
  enviarMensagemAComunidade: leituraDasFerramentas(2),
  sairDaComunidade: leituraDasFerramentas(2),
  // Flow
  criarFlow: leituraDasFerramentas(1),
  editarFlow: leituraDasFerramentas(2),
  publicarVersao: leituraDasFerramentas(2),
  sincronizarFlow: leituraDasFerramentas(1),
  enviarFlow: leituraDasFerramentas(1),
};

export const AO_CONFIRMAR_FERRAMENTAS: TabelaDeConfirmacoes = {};
