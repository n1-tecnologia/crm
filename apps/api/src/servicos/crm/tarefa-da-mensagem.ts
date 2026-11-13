/**
 * A Tarefa que a Mensagem recebida cria ou reabre (Sessão 5, 5.1.5): depois que `receberMensagem` gravou Contato, Conversa
 * e Mensagem, o Canal pode pertencer a uma Lista conversacional, e então a Lista é a fila de atendimento. A decisão é do
 * domínio (`tarefaDaRecebida`); este arquivo lê o CRM, chama `aplicarTarefaDaRecebida` e grava a Tarefa.
 *
 * Roda DEPOIS do commit da Mensagem, em transação própria (um gesto misto, `gesto-misto.ts`): falhar aqui não perde a
 * Mensagem. Quem chama (o processador de entrada) deixa a linha de `webhooks_recebidos` voltar a `pendente` se este passo
 * lança, e repetir é seguro porque `tarefaDaRecebida` olha as Tarefas que já existem: a segunda passada acha a criada e
 * não faz nada.
 *
 * Quem assina: o Ator é o sistema, pelo Canal (`mensagem:<canalId>`). O Membro que AUTORIZA a escrita (o atribuído da
 * Conversa, ou o Proprietário/Administrador que alcança a Lista) só existe porque as regras de escrita do domínio pedem
 * um; ele não aparece no Registro de Atividade. O "Agente do pipeline" não serve: é Convidado, e Convidado não cria Tarefa.
 *
 * Custo: quando o Canal não está em nenhuma Lista conversacional ativa, uma consulta barata encerra tudo (a maioria dos
 * Canais). Quando está, o gesto trava e hidrata o Espaço como qualquer gravação, mesmo que a decisão seja "nada"; essa
 * recusa desfaz limpo e NÃO sobe a revisão do Espaço, então as abas não reidratam por causa de uma Mensagem que não mexeu
 * em Tarefa.
 *
 * O conteúdo da Mensagem não passa por aqui, e este módulo não loga.
 */

import type { Pool } from "pg";
import { nomeDeExibicaoDoContato } from "@n1/dominio/crm/contatos";
import {
  aplicarTarefaDaRecebida,
  atorDaMensagemRecebida,
  autorizadorDaTarefaDaRecebida,
  tarefaDaRecebida,
  type DecisaoDaTarefaDaRecebida,
  type ReferenciasDaTarefaConversacional,
} from "@n1/dominio/operations";
import { avisarCrm } from "../../mensageria/avisar";
import { criarRepositorioDeCanaisPg } from "../../repositorios/crm/canais";
import { criarRepositorioDeContatosPg } from "../../repositorios/crm/contatos";
import { criarRepositorioDeConversasPg } from "../../repositorios/crm/conversas";
import { identificadorDoCanal } from "./conversas";
import { executarGestoMisto } from "./gesto-misto";
import { recusa, sucesso } from "./resultado";

export interface EntradaDaTarefaDaMensagem {
  readonly workspaceId: string;
  readonly canalId: string;
  readonly contatoId: string;
  readonly conversaId: string;
}

/**
 * O que o passo fez, para o processador registrar no `resultado` da linha. `sem_lista` e `nada` são o caminho comum e não
 * dizem erro; `pulada` diz por que uma Tarefa que deveria nascer não nasceu (a Mensagem segue na Caixa).
 */
export type DesfechoDaTarefaDaMensagem =
  | { readonly tipo: "sem_lista" }
  | { readonly tipo: "nada" }
  | { readonly tipo: "criada" | "reaberta"; readonly taskId: string }
  | { readonly tipo: "pulada"; readonly motivo: string };

export interface ServicoDaTarefaDaMensagem {
  aplicar(entrada: EntradaDaTarefaDaMensagem): Promise<DesfechoDaTarefaDaMensagem>;
}

/** Os códigos com que `lerDoCrm` recusa para desfazer limpo; o serviço os traduz em desfecho. */
const NADA_A_FAZER = "TAREFA_DA_MENSAGEM_NADA";
const PULADA = "TAREFA_DA_MENSAGEM_PULADA";

interface Lido {
  readonly decisao: Exclude<DecisaoDaTarefaDaRecebida, { readonly acao: "nada" }>;
  readonly autorizadorId: string;
  readonly responsavelId?: string;
  readonly referencias: ReferenciasDaTarefaConversacional;
}

export function criarServicoDaTarefaDaMensagem(deps: { readonly pool: () => Pool }): ServicoDaTarefaDaMensagem {
  return {
    async aplicar(entrada) {
      const { workspaceId, canalId, contatoId, conversaId } = entrada;

      // A maioria dos Canais não está em Lista nenhuma: não vale travar e hidratar o Espaço por causa deles.
      const atende = await deps.pool().query(
        `select 1
           from plataforma.registros
          where workspace_id = $1
            and colecao = 'lists'
            and dados->>'modeloDeTarefa' = 'conversacional'
            and dados->>'lifecycle' = 'ativo'
            and dados->'canaisDeAtendimento' ? $2
          limit 1`,
        [workspaceId, canalId],
      );
      if (atende.rowCount === 0) return { tipo: "sem_lista" };

      // A decisão anotada por `lerDoCrm` para o desfecho (o gesto não devolve o que foi lido).
      let acao: "criar" | "reabrir" | undefined;
      const desfecho = await executarGestoMisto<Lido, { readonly task?: { readonly id: string } }>(workspaceId, {
        lerDoCrm: async (cliente, state) => {
          const decisao = tarefaDaRecebida(state, { canalId, contatoId, conversaId });
          if (decisao.acao === "nada") return recusa(409, "A Mensagem não mexe em Tarefa.", { codigo: NADA_A_FAZER });

          // O Contato antes de qualquer Conversa na ordem das travas, como mover e restaurar (14-05/14-07).
          const contatos = criarRepositorioDeContatosPg(cliente);
          const contato = await contatos.obter(workspaceId, contatoId, { travar: true });
          if (!contato || contato.estado !== "ativo") return recusa(409, "O Contato não está ativo.", { codigo: PULADA, campo: "contato_nao_ativo" });
          const canal = await criarRepositorioDeCanaisPg(cliente).obter(workspaceId, canalId);
          if (!canal || canal.estado === "arquivado") return recusa(409, "O Canal não está ativo.", { codigo: PULADA, campo: "canal_nao_ativo" });
          // A Conversa é a da Mensagem: do mesmo Contato e do mesmo Canal, e fora da lixeira.
          const conversa = await criarRepositorioDeConversasPg(cliente).obter(workspaceId, conversaId);
          if (!conversa || conversa.contatoId !== contato.id || conversa.canalId !== canal.id || conversa.estado !== "ativo") {
            return recusa(409, "A Conversa não serve à Tarefa.", { codigo: PULADA, campo: "conversa_fora_do_par" });
          }
          const doCanal = identificadorDoCanal(await contatos.listarIdentificadores(workspaceId, contato.id), canal);
          if (!doCanal.ok) return recusa(409, doCanal.error, { codigo: PULADA, campo: "sem_identificador_do_canal" });

          const atribuidoAMembro = conversa.atribuido?.tipo === "membro" ? conversa.atribuido.id : undefined;
          const autorizadorId = autorizadorDaTarefaDaRecebida(state, decisao.listId, atribuidoAMembro);
          if (autorizadorId === undefined) {
            return recusa(409, "Nenhum Membro pode escrever nesta Lista.", { codigo: PULADA, campo: "sem_autorizador" });
          }

          acao = decisao.acao;
          return sucesso<Lido>({
            decisao,
            autorizadorId,
            ...(atribuidoAMembro !== undefined ? { responsavelId: atribuidoAMembro } : {}),
            referencias: {
              contato: { id: contato.id, nome: nomeDeExibicaoDoContato(contato, doCanal.valor.valorExibido ?? doCanal.valor.valor) },
              // A Mensagem acabou de chegar por este Canal: ele está de pé, mesmo que a conexão gravada ainda diga o contrário
              // (o `connection.update` pode estar na fila). Só a desconexão definitiva recusaria a Tarefa.
              canal: { id: canal.id, nome: canal.nome, tipo: canal.tipo, conexao: "conectada" },
              conversaId: conversa.id,
            },
          });
        },

        operacao: (state, lido) =>
          aplicarTarefaDaRecebida(state, lido.decisao, {
            autorizadorId: lido.autorizadorId,
            ator: atorDaMensagemRecebida(canalId),
            ...(lido.responsavelId !== undefined ? { responsavelId: lido.responsavelId } : {}),
            referencias: lido.referencias,
          }),

        // O aviso sai no mesmo cliente e só chega às abas no commit. A Tarefa mora em `registros`: a aba a lê pela revisão do
        // Espaço, e `conversa.mudou` é o que a faz conferi-la agora, em vez de esperar a releitura de 5 s.
        gravarNoCrm: async (cliente, _valor, lido) => {
          await avisarCrm(cliente, { workspaceId, tipo: "conversa.mudou", conversaId: lido.referencias.conversaId });
        },
      });

      if (!desfecho.ok) {
        if (desfecho.codigo === NADA_A_FAZER) return { tipo: "nada" };
        if (desfecho.codigo === PULADA) return { tipo: "pulada", motivo: desfecho.campo ?? "sem_motivo" };
        // Uma recusa do domínio (Lista cheia, Status sem saída, Tipo que a Lista não enxerga): a Mensagem segue na Caixa.
        if (desfecho.codigo === "RECUSA_DO_DOMINIO") return { tipo: "pulada", motivo: "recusa_do_dominio" };
        // Conflito da trava do Espaço ou erro de restrição: transitório, a fila tenta de novo.
        throw new Error(`A Tarefa da Mensagem não foi gravada (${desfecho.codigo ?? desfecho.status}).`);
      }

      const task = desfecho.valor.valor.task;
      if (!task || acao === undefined) return { tipo: "nada" };
      return { tipo: acao === "reabrir" ? "reaberta" : "criada", taskId: task.id };
    },
  };
}
