/**
 * Serviço da Tarefa conversacional nas tabelas novas (Fase 14, 3.3.1 e 3.3.4 a 3.3.6):
 * criar a Tarefa e abrir (ou reaproveitar) a Conversa no MESMO commit; trocar o
 * Canal da Tarefa; ligar, desligar e criar o Negócio dela.
 *
 * A Tarefa mora em `plataforma.registros` e a Conversa em `plataforma.conversas`;
 * por isso é um gesto misto (`gesto-misto.ts`, 14-03):
 *   - `lerDoCrm` trava o Contato (`for update`) e lê, na transação, o que a
 *     operação do domínio precisa: o Contato `ativo`, o Canal não arquivado, o
 *     Identificador do tipo do Canal, a Conversa aberta do par (`abertaDoPar`)
 *     e, se vier, o Negócio. O corpo da requisição NUNCA diz que algo está
 *     "conferido" (T-14-31): quem confere é este arquivo, lendo do banco.
 *   - `operacao` é `criarTarefaConversacionalNasTabelas`, que grava a Tarefa e os
 *     Vínculos com os ids que `lerDoCrm` devolveu.
 *   - `gravarNoCrm` abre a Conversa em `plataforma.conversas` quando não havia
 *     uma aberta, com o id que `lerDoCrm` gerou antes (`abrirConversaNoCliente`).
 *     Se a operação recusa (Lista operacional, Canal fora da Lista, Canal
 *     desconectado), `gravarNoCrm` nem roda e a transação inteira se desfaz.
 *
 * D-07: sem Conversa aberta no par, a primeira Mensagem é obrigatória (400
 * `VALOR_INVALIDO`, campo `mensagem`); com uma aberta ela é reaproveitada e
 * nenhuma Mensagem nova é gravada. A Mensagem vai para `plataforma.mensagens`,
 * nunca para `registros`.
 *
 * O Papel é exigido ANTES de qualquer leitura. O conteúdo da Mensagem nunca é
 * logado. A resposta sai pelo mesmo recorte por Membro de `POST /operacoes`
 * (`recortarResposta`, T-14-33): a Tarefa que o Membro não enxerga não volta.
 */

import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { nomeDeExibicaoDoContato } from "@n1/dominio/crm/contatos";
import { validarNovaConversa } from "@n1/dominio/crm/conversas";
import { RESUMO_MAXIMO, type ResumoDaTarefaConversacional, type VinculoParaResumo } from "@n1/dominio/crm/resumo-da-tarefa";
import { taskWriteRefusal } from "@n1/dominio/derive";
import { vinculosDoCrmDaTarefa } from "@n1/dominio/derive-conversacional";
import {
  criarTarefaConversacionalNasTabelas,
  trocarCanalDaTarefaNasTabelas,
  type ReferenciasDaTarefaConversacional,
} from "@n1/dominio/operations";
import type { ActorRef, DataState, Id, Priority, Task, TaskDate } from "@n1/dominio";
import type { MembroDaSessao } from "../../plugins/autenticacao";
import { criarRepositorioDeCanaisPg } from "../../repositorios/crm/canais";
import { criarRepositorioDeContatosPg } from "../../repositorios/crm/contatos";
import { criarRepositorioDeConversasPg } from "../../repositorios/crm/conversas";
import { criarRepositorioDeNegociosPg } from "../../repositorios/crm/negocios";
import { resumoDasTarefas } from "../../repositorios/crm/tarefas-conversacionais";
import { recortarResposta } from "../../rotas/resposta-recortada";
import { exigir, type AcessoAoCrm } from "./acesso";
import { abrirConversaNoCliente, canalArquivado, FRASES_DE_CONVERSAS, identificadorDoCanal } from "./conversas";
import { executarGestoMisto } from "./gesto-misto";
import { recusa, sucesso, type ResultadoCrm } from "./resultado";

export interface NovaTarefaConversacional {
  readonly listId: string;
  readonly contatoId: string;
  readonly canalId: string;
  /** Obrigatória só quando o par (Contato, Canal) não tem Conversa aberta (D-07). */
  readonly mensagem?: { readonly conteudo: string } | undefined;
  readonly negocioId?: string | undefined;
  readonly title?: string | undefined;
  readonly statusId?: Id | undefined;
  readonly assignees?: readonly ActorRef[] | undefined;
  readonly priority?: Priority | undefined;
  readonly dueDate?: TaskDate | undefined;
  readonly taskTypeId?: Id | undefined;
}

/** O corpo de `POST /operacoes` já recortado por Membro: a Tarefa (ou o que a operação devolve) em `value`, a diferença e a revisão. */
type RespostaRecortada<V> = ReturnType<typeof recortarResposta<V>>;

/** A Conversa que a Tarefa ganhou: `aberta: true` quando nasceu agora; `false` quando já havia uma aberta no par e foi reaproveitada. */
interface ConversaDaResposta {
  readonly conversa: { readonly id: string; readonly aberta: boolean };
}

/** O que o Membro recebe ao criar: o mesmo corpo de `POST /operacoes` (Tarefa em `value`, diferença, revisão) e a Conversa. */
export type RespostaDaTarefaConversacional = RespostaRecortada<{ readonly task: Task }> & ConversaDaResposta;

/** Trocar o Canal: `value.mudou` é `false` quando a Tarefa já estava naquela Conversa (nada foi gravado). */
export type RespostaDaTrocaDeCanal = RespostaRecortada<{ readonly task: Task; readonly mudou: boolean }> & ConversaDaResposta;

export interface ServicoDeTarefasConversacionais {
  criar(membro: MembroDaSessao, entrada: NovaTarefaConversacional): Promise<ResultadoCrm<RespostaDaTarefaConversacional>>;
  /**
   * Contato, Canal, última Mensagem e Negócio de até `RESUMO_MAXIMO` Tarefas, numa ida só (3.3.3).
   * Um item por Vínculo, na ordem pedida; id que não é deste Espaço volta com os quatro campos `null`.
   */
  resumo(membro: MembroDaSessao, vinculos: readonly VinculoParaResumo[]): Promise<ResultadoCrm<readonly ResumoDaTarefaConversacional[]>>;
  /**
   * Troca o Canal da Tarefa (3.3.5): reaproveita a Conversa aberta do Contato dela no Canal novo ou abre uma, e
   * troca só o Vínculo "conversa da Tarefa". A Conversa anterior continua onde estava na Caixa.
   */
  trocarCanal(
    membro: MembroDaSessao,
    taskId: string,
    entrada: { readonly canalId: string; readonly mensagem?: { readonly conteudo: string } | undefined },
  ): Promise<ResultadoCrm<RespostaDaTrocaDeCanal>>;
}

/** A mesma frase de `NEGOCIO_DE_OUTRO_CONTATO` do domínio (`operations/tarefas-conversacionais.ts`). */
const FRASE_NEGOCIO_DE_OUTRO_CONTATO = "Este Negócio não é deste Contato.";

const contatoNaoEncontrado = () =>
  recusa<never>(404, "Contato não encontrado.", { codigo: "CONTATO_NAO_ENCONTRADO", campo: "contatoId" });
const canalNaoEncontrado = () => recusa<never>(404, "Canal não encontrado.", { codigo: "CANAL_NAO_ENCONTRADO", campo: "canalId" });

/** D-07: a Conversa nova nasce com a primeira Mensagem; sem ela, 400 com o campo que a tela marca. */
const mensagemObrigatoria = () =>
  recusa<never>(400, "Escreva a primeira Mensagem: este Contato não tem Conversa aberta neste Canal.", {
    codigo: "VALOR_INVALIDO",
    campo: "mensagem",
  });

/** Marca de lugar para a forma da Mensagem antes da transação: o Contato da troca de Canal vem do Vínculo da Tarefa, lido depois. */
const CONTATO_DO_VINCULO = "contato-do-vinculo";

/** `undefined` quando a Mensagem (se vier) tem forma válida; senão o 400 com o campo que a tela marca. */
function recusaDeFormaDaMensagem(canalId: string, contatoId: string, mensagem: { readonly conteudo: string } | undefined): ResultadoCrm<never> | undefined {
  if (mensagem === undefined) return undefined;
  const forma = validarNovaConversa({ canalId, contatoId, mensagem });
  if (forma.ok) return undefined;
  return recusa<never>(400, forma.error, { codigo: "VALOR_INVALIDO", ...(forma.field !== undefined ? { campo: forma.field } : {}) });
}

/** O que `lerDoCrm` leu e conferiu: as referências da operação e se a Conversa ainda vai ser aberta. */
export interface LidoParaConversa {
  readonly contato: { readonly id: string; readonly nome: string };
  readonly canal: ReferenciasDaTarefaConversacional["canal"];
  readonly conversaId: string;
  /** `true`: a Conversa não existe ainda; quem chama a abre em `gravarNoCrm` com este `conversaId`. */
  readonly nova: boolean;
}

/**
 * Lê no `cliente` o Contato (travado), o Canal, o Identificador do tipo do Canal
 * e a Conversa aberta do par, e decide o id da Conversa: o da aberta, ou um novo
 * (`randomUUID()`). É a conferência que a Tarefa conversacional e a troca de
 * Canal (14-14) compartilham.
 *
 * Contato `mesclado` → 409 `CONTATO_MESCLADO`; outro estado que não `ativo` →
 * 409 `CONTATO_INATIVO`; Canal arquivado → 409; Conversa nova sem Mensagem → 400.
 * Tudo é filtrado por `workspace_id`: id de outro Espaço é 404 (T-14-31).
 */
export async function lerParaConversa(
  cliente: PoolClient,
  workspaceId: string,
  entrada: { readonly contatoId: string; readonly canalId: string; readonly mensagem?: { readonly conteudo: string } | undefined },
): Promise<ResultadoCrm<LidoParaConversa>> {
  const contatos = criarRepositorioDeContatosPg(cliente);
  // O Contato antes de qualquer Conversa na ordem das travas (como mover e restaurar, 14-05/14-07).
  const contato = await contatos.obter(workspaceId, entrada.contatoId, { travar: true });
  if (!contato) return contatoNaoEncontrado();
  if (contato.estado === "mesclado") {
    return recusa<never>(409, "Este Contato foi mesclado e agora é somente leitura. Abra o Contato que ficou.", {
      codigo: "CONTATO_MESCLADO",
      campo: "contatoId",
    });
  }
  if (contato.estado !== "ativo") {
    return recusa<never>(409, "Só um Contato ativo abre Conversa.", { codigo: "CONTATO_INATIVO", campo: "contatoId" });
  }

  const canal = await criarRepositorioDeCanaisPg(cliente).obter(workspaceId, entrada.canalId);
  if (!canal) return canalNaoEncontrado();
  if (canal.estado === "arquivado") return canalArquivado();

  const doCanal = identificadorDoCanal(await contatos.listarIdentificadores(workspaceId, contato.id), canal);
  if (!doCanal.ok) return doCanal;

  const aberta = await criarRepositorioDeConversasPg(cliente).abertaDoPar(workspaceId, contato.id, canal.id);
  if (!aberta && entrada.mensagem === undefined) return mensagemObrigatoria();

  return sucesso({
    contato: { id: contato.id, nome: nomeDeExibicaoDoContato(contato, doCanal.valor.valorExibido ?? doCanal.valor.valor) },
    canal: { id: canal.id, nome: canal.nome, tipo: canal.tipo, conexao: canal.conexao },
    conversaId: aberta?.id ?? randomUUID(),
    nova: aberta === undefined,
  });
}

/** Quantos saltos de `mesclado_em_id` se seguem até o Contato que ficou (a 14-09 não deixa cadeia; o limite é só rede). */
const SALTOS_DE_MESCLAGEM = 5;

/**
 * O Contato com quem a Tarefa conversa hoje: o do Vínculo, ou o sobrevivente se
 * aquele foi mesclado (`vinculosDoCrmDaTarefa` não olha o banco). Sem trava: quem
 * chama trava o Contato que devolver. Id que não existe volta como veio, e a
 * conferência seguinte dá o 404.
 */
async function contatoVigenteDaTarefa(cliente: PoolClient, workspaceId: string, contatoId: string): Promise<string> {
  const contatos = criarRepositorioDeContatosPg(cliente);
  let atual = contatoId;
  for (let salto = 0; salto < SALTOS_DE_MESCLAGEM; salto += 1) {
    const contato = await contatos.obter(workspaceId, atual);
    if (!contato || contato.estado !== "mesclado" || contato.mescladoEmId === null) return atual;
    atual = contato.mescladoEmId;
  }
  return atual;
}

/**
 * A Tarefa e o Contato do Vínculo dela, lidos do estado hidratado dentro da
 * transação (nunca do corpo). `undefined` quando não há como seguir: Tarefa que não
 * existe neste Espaço, que o Membro não escreve, ou sem Vínculo de Contato. Nesses
 * casos quem diz a frase é a operação pura do domínio, dentro da mesma transação.
 */
function tarefaEContato(state: DataState, membroId: string, taskId: string): { readonly task: Task; readonly contatoId: string } | undefined {
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task || taskWriteRefusal(state, membroId, task.id) !== undefined) return undefined;
  const contatoId = vinculosDoCrmDaTarefa(state, task).contatoId;
  return contatoId === undefined ? undefined : { task, contatoId };
}

/** O que `lerDoCrm` leu para a troca de Canal; `ausente` quando a operação pura é quem recusa. */
type LidoDaTroca =
  | { readonly ausente: true }
  | { readonly ausente: false; readonly lido: LidoParaConversa; readonly canalAnterior?: { readonly nome: string } };

/** Um Canal qualquer para a operação pura recusar pela Tarefa (que não existe, sem Contato...) antes de olhar o Canal. */
const CANAL_DE_PASSAGEM: ReferenciasDaTarefaConversacional["canal"] = { id: "", nome: "", tipo: "whatsapp", conexao: "conectada" };

export function criarServicoDeTarefasConversacionais(deps: {
  readonly pool: () => Pool;
  readonly acesso: AcessoAoCrm;
}): ServicoDeTarefasConversacionais {
  return {
    async criar(membro, entrada) {
      const negado = await exigir(deps.acesso, membro, "criar", "conversa");
      if (negado) return { ok: false, ...negado };

      // A forma da Mensagem, quando vem, antes de abrir a transação. Sem ela a recusa é a de D-07, depois de olhar o par.
      const malFormada = recusaDeFormaDaMensagem(entrada.canalId, entrada.contatoId, entrada.mensagem);
      if (malFormada) return malFormada;

      const workspaceId = membro.workspaceId;
      // A Conversa que a Tarefa ganhou, anotada por `lerDoCrm` para a resposta (o desfecho do gesto não carrega o que foi lido).
      const anotado: { conversa?: { readonly id: string; readonly aberta: boolean } } = {};
      const desfecho = await executarGestoMisto<
        LidoParaConversa & { readonly negocio?: { readonly id: string; readonly titulo: string } },
        { readonly task: Task }
      >(
        workspaceId,
        {
          lerDoCrm: async (cliente) => {
            const lido = await lerParaConversa(cliente, workspaceId, entrada);
            if (!lido.ok) return lido;
            anotado.conversa = { id: lido.valor.conversaId, aberta: lido.valor.nova };

            if (entrada.negocioId === undefined) return lido;
            // O Negócio tem de ser `ativo`, deste Espaço e do Contato da Tarefa; qualquer falha é a mesma frase.
            const negocio = await criarRepositorioDeNegociosPg(cliente).obter(workspaceId, entrada.negocioId);
            if (!negocio || negocio.estado !== "ativo" || negocio.contatoId !== lido.valor.contato.id) {
              return recusa<never>(409, FRASE_NEGOCIO_DE_OUTRO_CONTATO, { codigo: "NEGOCIO_DE_OUTRO_CONTATO", campo: "negocioId" });
            }
            return sucesso({ ...lido.valor, negocio: { id: negocio.id, titulo: negocio.titulo } });
          },

          operacao: (state, lido) =>
            criarTarefaConversacionalNasTabelas(
              state,
              membro.id,
              {
                listId: entrada.listId,
                ...(entrada.title !== undefined ? { title: entrada.title } : {}),
                ...(entrada.statusId !== undefined ? { statusId: entrada.statusId } : {}),
                ...(entrada.assignees !== undefined ? { assignees: entrada.assignees } : {}),
                ...(entrada.priority !== undefined ? { priority: entrada.priority } : {}),
                ...(entrada.dueDate !== undefined ? { dueDate: entrada.dueDate } : {}),
                ...(entrada.taskTypeId !== undefined ? { taskTypeId: entrada.taskTypeId } : {}),
              },
              {
                contato: lido.contato,
                canal: lido.canal,
                conversaId: lido.conversaId,
                ...(lido.negocio ? { negocio: lido.negocio } : {}),
              },
            ),

          // Só roda se a operação aceitou: uma recusa do domínio não deixa Conversa nova.
          gravarNoCrm: async (cliente, _valor, lido) => {
            if (!lido.nova) return;
            if (entrada.mensagem === undefined) throw new Error("A Conversa nova chegou a gravarNoCrm sem Mensagem.");
            const aberta = await abrirConversaNoCliente(
              cliente,
              membro,
              { canalId: lido.canal.id, contatoId: lido.contato.id, mensagem: entrada.mensagem },
              { id: lido.conversaId },
            );
            if (!aberta.ok) return aberta;
            return;
          },
        },
        FRASES_DE_CONVERSAS,
      );
      if (!desfecho.ok) return desfecho;

      const { resultado, depois } = desfecho.valor;
      if (!anotado.conversa) throw new Error("O gesto da Tarefa gravou sem ler a Conversa.");
      return sucesso({ ...recortarResposta(resultado, depois, membro.id), conversa: anotado.conversa });
    },

    async trocarCanal(membro, taskId, entrada) {
      // Trocar o Canal pode abrir Conversa: pede o mesmo Papel de criá-la (o Convidado segue sem trocar).
      const negado = await exigir(deps.acesso, membro, "criar", "conversa");
      if (negado) return { ok: false, ...negado };

      // O Contato só se conhece dentro da transação (vem do Vínculo): aqui só a forma da Mensagem.
      const malFormada = recusaDeFormaDaMensagem(entrada.canalId, CONTATO_DO_VINCULO, entrada.mensagem);
      if (malFormada) return malFormada;

      const workspaceId = membro.workspaceId;
      const anotado: { conversa?: { readonly id: string; readonly aberta: boolean } } = {};
      const desfecho = await executarGestoMisto<LidoDaTroca, { readonly task: Task; readonly mudou: boolean }>(
        workspaceId,
        {
          lerDoCrm: async (cliente, state) => {
            const alvo = tarefaEContato(state, membro.id, taskId);
            if (!alvo) return sucesso({ ausente: true });
            // O Contato do Vínculo (ou o que ficou, se foi mesclado), nunca o do corpo.
            const contatoId = await contatoVigenteDaTarefa(cliente, workspaceId, alvo.contatoId);
            const lido = await lerParaConversa(cliente, workspaceId, { contatoId, canalId: entrada.canalId, mensagem: entrada.mensagem });
            if (!lido.ok) return lido;
            anotado.conversa = { id: lido.valor.conversaId, aberta: lido.valor.nova };

            // O nome do Canal que sai, para a Atividade: o da Conversa vinculada hoje (que pode nem existir mais).
            const atual = vinculosDoCrmDaTarefa(state, alvo.task).conversaId;
            const conversaAtual = atual === undefined ? undefined : await criarRepositorioDeConversasPg(cliente).obter(workspaceId, atual);
            const canalAnterior = conversaAtual ? await criarRepositorioDeCanaisPg(cliente).obter(workspaceId, conversaAtual.canalId) : undefined;
            return sucesso({ ausente: false, lido: lido.valor, ...(canalAnterior ? { canalAnterior: { nome: canalAnterior.nome } } : {}) });
          },

          operacao: (state, lido) => {
            if (lido.ausente) {
              // A operação pura recusa pela mesma razão que `lerDoCrm` viu; o Canal de passagem nunca é lido.
              const recusada = trocarCanalDaTarefaNasTabelas(state, membro.id, taskId, { canal: CANAL_DE_PASSAGEM, conversaId: "" });
              if (recusada.ok) throw new Error("A troca de Canal aceitou uma Tarefa que lerDoCrm não achou.");
              return recusada;
            }
            return trocarCanalDaTarefaNasTabelas(state, membro.id, taskId, {
              canal: lido.lido.canal,
              conversaId: lido.lido.conversaId,
              ...(lido.canalAnterior ? { canalAnterior: lido.canalAnterior } : {}),
            });
          },

          // Só roda se a operação aceitou, e só abre a Conversa quando a troca mudou o Vínculo.
          gravarNoCrm: async (cliente, valor, lido) => {
            if (lido.ausente || !lido.lido.nova || !valor.mudou) return;
            if (entrada.mensagem === undefined) throw new Error("A Conversa nova chegou a gravarNoCrm sem Mensagem.");
            const aberta = await abrirConversaNoCliente(
              cliente,
              membro,
              { canalId: lido.lido.canal.id, contatoId: lido.lido.contato.id, mensagem: entrada.mensagem },
              { id: lido.lido.conversaId },
            );
            if (!aberta.ok) return aberta;
            return;
          },
        },
        FRASES_DE_CONVERSAS,
      );
      if (!desfecho.ok) return desfecho;

      const { resultado, depois } = desfecho.valor;
      if (!anotado.conversa) throw new Error("O gesto da Tarefa gravou sem ler a Conversa.");
      return sucesso({ ...recortarResposta(resultado, depois, membro.id), conversa: anotado.conversa });
    },

    async resumo(membro, vinculos) {
      // O cartão mostra nome de Contato e trecho de Mensagem: pede-se a leitura dos dois recursos, antes de olhar o banco.
      const semContato = await exigir(deps.acesso, membro, "ler", "contato");
      if (semContato) return { ok: false, ...semContato };
      const semConversa = await exigir(deps.acesso, membro, "ler", "conversa");
      if (semConversa) return { ok: false, ...semConversa };
      if (vinculos.length > RESUMO_MAXIMO) {
        return recusa<never>(400, `O resumo aceita até ${RESUMO_MAXIMO} Tarefas por chamada.`, { codigo: "VALOR_INVALIDO", campo: "vinculos" });
      }
      return sucesso(await resumoDasTarefas(deps.pool(), membro.workspaceId, vinculos));
    },
  };
}
