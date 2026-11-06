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
 * O Contato do Participante (15-17, 3.4.8): quando uma operação precisa do Contato
 * de um número de WhatsApp (importar Grupo do Canal), a LEITURA procura o Contato
 * por Identificador `whatsapp` em `plataforma.contato_identificadores` (mesclado
 * resolve ao sobrevivente) e GERA o id dos que faltam (`contatosACriar`, `randomUUID`
 * — nunca vem do navegador, T-15-42). A operação pura usa esse id; o `aoConfirmar`
 * insere, no mesmo commit, só os Contatos que ela de fato usou. Os eventos do
 * provedor (Pedido de Entrada, entrada no Grupo, clique de Captação) não são
 * operações de `POST /operacoes`: quando ganharem rota, usam as mesmas duas
 * funções, `lerContatosDosParticipantes` e `confirmarContatosDosParticipantes`.
 *
 * Fica num arquivo próprio para que os planos paralelos não disputem o mesmo
 * arquivo; `index.ts` compõe.
 */

import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import type { DataState } from "@n1/dominio";
import type { Canal } from "@n1/dominio/crm/canais";
import { numeroExibido, numerosAResolver, padroesDoContatoCriado } from "@n1/dominio/operations/ferramentas/participacoes";
import type { MembroDaSessao } from "../../plugins/autenticacao";
import { criarRepositorioDeCanaisPg } from "../../repositorios/crm/canais";
import { criarRepositorioDeContatosPg } from "../../repositorios/crm/contatos";
import { inserirContatosDeParticipantes, resolverContatosPorWhatsapp } from "../../repositorios/crm/contatos-de-participantes";
import type { ContatoACriar, ContatoResumido, LeituraDoCrm, LidoDoCrm, TabelaDeConfirmacoes, TabelaDeLeituras } from "./tipos";

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
 * O que a leitura devolve para a operação que precisa do Contato de números de WhatsApp: os Contatos
 * que a tabela já tem (mesclado → sobrevivente) e, para cada número sem Contato, um `ContatoACriar`
 * com id novo. O número fica no `whatsapp` do item, nunca em log (T-15-44).
 */
export async function lerContatosDosParticipantes(
  cliente: PoolClient,
  workspaceId: string,
  numeros: readonly string[],
): Promise<{ readonly contatos: readonly ContatoResumido[]; readonly contatosACriar: readonly ContatoACriar[] }> {
  const contatos = await resolverContatosPorWhatsapp(cliente, workspaceId, numeros);
  const resolvidos = new Set(contatos.map((c) => (c.whatsapp ?? "").replace(/\D/g, "")));
  const contatosACriar = numeros
    .filter((n) => !resolvidos.has(n.replace(/\D/g, "")))
    .map((n) => ({ id: randomUUID(), nome: numeroExibido(n), whatsapp: n }));
  return { contatos, contatosACriar };
}

/** Os ids de Contato que algum Grupo do estado usa em Participação ou Pedido de Entrada. */
function contatosUsadosNosGrupos(state: DataState): Set<string> {
  const usados = new Set<string>();
  for (const grupo of state.grupos) {
    for (const p of grupo.participacoes) if (p.contactId !== undefined) usados.add(p.contactId);
    for (const p of grupo.pedidosDeEntrada) usados.add(p.contactId);
  }
  return usados;
}

/**
 * Insere, no mesmo commit da operação, só os `contatosACriar` que a operação usou (o id aparece em
 * Participação ou Pedido de Entrada do estado de DEPOIS): Proprietário pela cadeia do Canal
 * (DO-CXE-05) e Origem padrão do Canal, como o Contato criado por Grupo sempre teve.
 */
export async function confirmarContatosDosParticipantes(cliente: PoolClient, membro: MembroDaSessao, state: DataState, canal: Canal | undefined, lido: LidoDoCrm | undefined): Promise<number> {
  const aCriar = lido?.contatosACriar ?? [];
  if (aCriar.length === 0) return 0;
  const usados = contatosUsadosNosGrupos(state);
  const doUso = aCriar.filter((c) => usados.has(c.id));
  if (doUso.length === 0) return 0;
  if (!canal) throw new Error("confirmarContatosDosParticipantes: o Canal da operação não está no que a leitura trouxe.");
  const { proprietarioId, origem } = padroesDoContatoCriado(state, canal);
  return inserirContatosDeParticipantes(
    cliente,
    membro.workspaceId,
    membro.id,
    doUso.map((c) => ({ id: c.id, numero: c.whatsapp, valorExibido: c.nome, proprietarioId, origem })),
  );
}

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

/**
 * `importarGruposDoCanal`: além dos Canais, os Contatos dos Participantes dos Grupos que o provedor
 * mostra e o Espaço ainda não espelhou (`numerosAResolver`, a fonte única que a operação também usa).
 */
const leituraDaImportacaoDeGrupos: LeituraDoCrm = {
  posicao: 1,
  ler: async (cliente, workspaceId, args, state) => {
    const canais = await criarRepositorioDeCanaisPg(cliente).todos(workspaceId);
    const numeros = numerosAResolver("importarGruposDoCanal", state, args, { canais, contatos: [] });
    return { canais, ...(await lerContatosDosParticipantes(cliente, workspaceId, numeros)) };
  },
  argumento: (lido) => ({ canais: lido.canais ?? [], contatos: lido.contatos ?? [], contatosACriar: lido.contatosACriar ?? [] }),
};

export const LER_DO_CRM_FERRAMENTAS: TabelaDeLeituras = {
  // Grupo — `[..., crm]`: a posição é o índice logo depois dos argumentos da operação.
  criarGrupo: leituraDasFerramentas(1, contatosDoCriarGrupo),
  importarGruposDoCanal: leituraDaImportacaoDeGrupos,
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

export const AO_CONFIRMAR_FERRAMENTAS: TabelaDeConfirmacoes = {
  // O Canal é o primeiro argumento: dele vêm o Proprietário e a Origem padrão do Contato criado.
  importarGruposDoCanal: async (cliente, args, membro, state, lido) => {
    await confirmarContatosDosParticipantes(
      cliente,
      membro,
      state,
      lido?.canais?.find((c) => c.id === args[0]),
      lido,
    );
  },
};
