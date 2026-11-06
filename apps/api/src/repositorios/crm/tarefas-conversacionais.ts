/**
 * Leitura em lote do cartão da Tarefa conversacional (Fase 14, 3.3.3): o resumo
 * de até 200 Tarefas numa consulta só.
 *
 * Cada Tarefa chega como um `VinculoParaResumo` (os ids que ela guarda em
 * `registros`). A consulta os desdobra com `unnest ... with ordinality` e junta,
 * por Tarefa: o Contato (seguindo `mesclado_em_id` até o sobrevivente), a Conversa
 * vinculada e o Canal dela, a última Mensagem que não é `interna` entre as
 * Conversas `ativas` do Contato EFETIVO no Canal da Tarefa, e o Negócio com a
 * Etapa. A ordem de saída é a de entrada.
 *
 * Regras que valem aqui (as mesmas dos outros repositórios do CRM):
 *   - todo `join` leva `workspace_id = $1` (T-14-32): um id de outro Espaço não
 *     casa com nada e a Tarefa volta com `null` nos quatro campos, sem erro;
 *   - valores sempre `$n`, nunca interpolados;
 *   - o conteúdo da Mensagem só sai cortado (140 caracteres, no SQL) e nunca vai a log.
 *
 * Sem `for update`: é leitura. Sem trava, e sem mexer em `registros`.
 */

import type { Pool, PoolClient } from "pg";
import { nomeDeExibicaoDoContato } from "@n1/dominio/crm/contatos";
import type { ResumoDaTarefaConversacional, VinculoParaResumo } from "@n1/dominio/crm/resumo-da-tarefa";
import type { Canal } from "@n1/dominio/crm/canais";

/** Quantos caracteres da última Mensagem o cartão mostra. */
const TAMANHO_DO_TRECHO = 140;

interface LinhaDoResumo {
  readonly task_id: string;
  readonly contato_id: string | null;
  readonly contato_nome: string | null;
  readonly contato_sobrenome: string | null;
  readonly identificador_principal: string | null;
  readonly canal_id: string | null;
  readonly canal_nome: string | null;
  readonly canal_tipo: Canal["tipo"] | null;
  readonly canal_provedor: Canal["provedor"] | null;
  readonly canal_conexao: Canal["conexao"] | null;
  readonly trecho: string | null;
  readonly direcao: "recebida" | "enviada" | null;
  readonly mensagem_em: Date | null;
  readonly negocio_id: string | null;
  readonly negocio_titulo: string | null;
  readonly etapa_nome: string | null;
}

const linhaParaResumo = (linha: LinhaDoResumo): ResumoDaTarefaConversacional => ({
  taskId: linha.task_id,
  contato:
    linha.contato_id === null
      ? null
      : {
          id: linha.contato_id,
          nome: nomeDeExibicaoDoContato({ nome: linha.contato_nome, sobrenome: linha.contato_sobrenome }, linha.identificador_principal),
        },
  canal:
    linha.canal_id === null
      ? null
      : {
          id: linha.canal_id,
          nome: linha.canal_nome!,
          tipo: linha.canal_tipo!,
          provedor: linha.canal_provedor!,
          conexao: linha.canal_conexao!,
        },
  ultimaMensagem:
    linha.direcao === null || linha.mensagem_em === null
      ? null
      : { trecho: linha.trecho ?? "", direcao: linha.direcao, criadoEm: linha.mensagem_em.toISOString() },
  negocio: linha.negocio_id === null ? null : { id: linha.negocio_id, titulo: linha.negocio_titulo!, etapa: linha.etapa_nome },
});

/**
 * Um resumo por Vínculo, na ordem pedida. Lista vazia não consulta o banco.
 *
 * O que está na lixeira não aparece (RN-TAR-15: o Vínculo fica suspenso enquanto o Negócio está lá;
 * WR-05: o mesmo vale para o Contato e para a Conversa, que ficam nulos, e o Canal e a última
 * Mensagem com a Conversa); o arquivado aparece. A Mensagem com marcação de exclusão não é candidata a "última".
 */
export async function resumoDasTarefas(
  cliente: Pool | PoolClient,
  workspaceId: string,
  vinculos: readonly VinculoParaResumo[],
): Promise<readonly ResumoDaTarefaConversacional[]> {
  if (vinculos.length === 0) return [];
  const { rows } = await cliente.query<LinhaDoResumo>(
    `select e.task_id,
            ef.id as contato_id, ef.nome as contato_nome, ef.sobrenome as contato_sobrenome,
            (select i.valor from plataforma.contato_identificadores i
              where i.workspace_id = $1 and i.contato_id = ef.id and i.principal
              order by i.criado_em, i.id limit 1) as identificador_principal,
            cn.id as canal_id, cn.nome as canal_nome, cn.tipo as canal_tipo, cn.provedor as canal_provedor, cn.conexao as canal_conexao,
            ult.trecho, ult.direcao, ult.criado_em as mensagem_em,
            n.id as negocio_id, n.titulo as negocio_titulo, et.nome as etapa_nome
       from unnest($2::text[], $3::text[], $4::text[], $5::text[])
              with ordinality as e(task_id, contato_id, conversa_id, negocio_id, ordem)
       left join plataforma.contatos c
              on c.workspace_id = $1 and c.id = e.contato_id
       left join plataforma.contatos ef
              on ef.workspace_id = $1
             and ef.id = case when c.estado = 'mesclado' then c.mesclado_em_id else c.id end
             and ef.estado <> 'na_lixeira'
       left join plataforma.conversas cv
              on cv.workspace_id = $1 and cv.id = e.conversa_id and cv.estado = 'ativo'
       left join plataforma.canais cn
              on cn.workspace_id = $1 and cn.id = cv.canal_id
       left join lateral (
         select left(coalesce(m.conteudo, ''), ${TAMANHO_DO_TRECHO}) as trecho, m.direcao, m.criado_em
           from plataforma.conversas cx
           join plataforma.mensagens m
             on m.workspace_id = cx.workspace_id and m.conversa_id = cx.id
          where cx.workspace_id = $1
            and cx.contato_id = ef.id
            and cx.canal_id = cv.canal_id
            and cx.estado = 'ativo'
            and m.direcao <> 'interna'
            and m.marcacao_exclusao is null
          order by m.criado_em desc, m.seq desc
          limit 1
       ) ult on true
       left join plataforma.negocios n
              on n.workspace_id = $1 and n.id = e.negocio_id and n.estado <> 'na_lixeira'
       left join plataforma.etapas et
              on et.workspace_id = $1 and et.id = n.etapa_id
      order by e.ordem`,
    [
      workspaceId,
      vinculos.map((v) => v.taskId),
      vinculos.map((v) => v.contatoId ?? null),
      vinculos.map((v) => v.conversaId ?? null),
      vinculos.map((v) => v.negocioId ?? null),
    ],
  );
  return rows.map(linhaParaResumo);
}
