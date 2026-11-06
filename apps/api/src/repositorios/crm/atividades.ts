/**
 * Repositório da Atividade do CRM novo — `plataforma.crm_atividades` (012, D-15-09).
 *
 * SÓ INSERÇÃO E LEITURA, por contrato: este módulo não tem caminho de alterar nem
 * de apagar uma linha (a Atividade não é meio de reescrever o histórico, T-15-11).
 * Quem quer saber o que aconteceu lê daqui; quem quer fazer algo acontecer grava
 * outra linha.
 *
 * Regras que valem em todo método:
 *   - `registrarAtividade` recebe o CLIENTE do gesto (o mesmo `PoolClient` do
 *     `comTransacao`), para a Atividade e o efeito do gesto entrarem no mesmo
 *     commit — ou nenhum dos dois (UCR-03);
 *   - todo `WHERE` leva `workspace_id = $1`: o Espaço vem do serviço, que o tira
 *     da sessão (T-14-14);
 *   - valores sempre `$n`, nunca interpolados; a ordem é fixa (`em desc, id desc`);
 *   - o ator é o que o serviço passa a partir da sessão; este módulo não o deduz.
 */

import type { Pool, PoolClient } from "pg";
import type { FiltroDeAtividades } from "@n1/dominio/crm/atividades";
import type { ActivityRecord, ActorKind, ActorRef } from "@n1/dominio/types/primitives";

/** O que um gesto registra. O momento é do banco (`now()`, em milissegundos), nunca de quem chama. */
export interface EntradaDeAtividade {
  readonly ator: ActorRef;
  /** "Em nome de" (A6.2). */
  readonly delegante?: ActorRef;
  readonly acao: string;
  readonly objetoTipo: string;
  readonly objetoId: string;
  /** Sobrevive à eliminação do objeto (INV-ET-12): por isso o nome vai junto. */
  readonly objetoNome: string;
  readonly resultado?: "ok" | "denied" | "failed";
  readonly antes?: string;
  readonly depois?: string;
  /** Motivo ou causa. NUNCA o conteúdo de dado pessoal (T-15-14). */
  readonly detalhe?: string;
}

/**
 * O momento do gesto, em milissegundos: `ActivityRecord.at` é ISO com milissegundos, então o
 * cursor `(at, id)` da leitura só é exato se `em` não guardar microssegundos que o `at` perde.
 * A sucessão grava no mesmo instante com o mesmo valor (`sucessao.ts`).
 */
export const MOMENTO_DO_GESTO = "date_trunc('milliseconds', now())";

const COLUNAS =
  "id, workspace_id, ator_tipo, ator_id, delegante_tipo, delegante_id, acao, objeto_tipo, objeto_id, objeto_nome, em, resultado, antes, depois, detalhe";

interface LinhaDoBanco {
  readonly id: string;
  readonly workspace_id: string;
  readonly ator_tipo: ActorKind;
  readonly ator_id: string;
  readonly delegante_tipo: ActorKind | null;
  readonly delegante_id: string | null;
  readonly acao: string;
  readonly objeto_tipo: string;
  readonly objeto_id: string;
  readonly objeto_nome: string;
  readonly em: Date;
  readonly resultado: "ok" | "denied" | "failed";
  readonly antes: string | null;
  readonly depois: string | null;
  readonly detalhe: string | null;
}

/** snake_case → `ActivityRecord`; `Date` → ISO 8601; coluna nula → campo ausente. */
function linhaParaAtividade(linha: LinhaDoBanco): ActivityRecord {
  return {
    id: linha.id,
    workspaceId: linha.workspace_id,
    actor: { kind: linha.ator_tipo, id: linha.ator_id },
    ...(linha.delegante_tipo !== null && linha.delegante_id !== null
      ? { delegate: { kind: linha.delegante_tipo, id: linha.delegante_id } }
      : {}),
    action: linha.acao,
    objectType: linha.objeto_tipo,
    objectId: linha.objeto_id,
    objectName: linha.objeto_nome,
    at: linha.em.toISOString(),
    result: linha.resultado,
    ...(linha.antes !== null ? { before: linha.antes } : {}),
    ...(linha.depois !== null ? { after: linha.depois } : {}),
    ...(linha.detalhe !== null ? { detail: linha.detalhe } : {}),
  };
}

/** Grava a Atividade no cliente do gesto. Quem chama dentro de `comTransacao` herda o rollback. */
export async function registrarAtividade(cliente: Pool | PoolClient, workspaceId: string, entrada: EntradaDeAtividade): Promise<void> {
  await cliente.query(
    `insert into plataforma.crm_atividades
       (workspace_id, ator_tipo, ator_id, delegante_tipo, delegante_id, acao, objeto_tipo, objeto_id, objeto_nome, resultado, antes, depois, detalhe, em)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, ${MOMENTO_DO_GESTO})`,
    [
      workspaceId,
      entrada.ator.kind,
      entrada.ator.id,
      entrada.delegante?.kind ?? null,
      entrada.delegante?.id ?? null,
      entrada.acao,
      entrada.objetoTipo,
      entrada.objetoId,
      entrada.objetoNome,
      entrada.resultado ?? "ok",
      entrada.antes ?? null,
      entrada.depois ?? null,
      entrada.detalhe ?? null,
    ],
  );
}

/**
 * As Atividades do Espaço, da mais recente para a mais antiga. `tiposPermitidos`
 * é o que o Papel de quem lê pode ver: um tipo fora dele nunca sai, mesmo que o
 * filtro o peça; lista vazia não devolve nada.
 */
export async function listar(
  cliente: Pool | PoolClient,
  workspaceId: string,
  filtro: FiltroDeAtividades,
  tiposPermitidos: readonly string[],
): Promise<ActivityRecord[]> {
  const condicoes = ["workspace_id = $1", "objeto_tipo = any($2::text[])"];
  const valores: unknown[] = [workspaceId, [...tiposPermitidos]];
  if (filtro.objetoTipo !== undefined && filtro.objetoId !== undefined) {
    valores.push(filtro.objetoTipo, filtro.objetoId);
    condicoes.push(`objeto_tipo = $${valores.length - 1}`, `objeto_id = $${valores.length}`);
  }
  if (filtro.ate !== undefined && filtro.ateId !== undefined) {
    // Cursor composto: a ordem é `(em, id)` decrescente, então "depois do cursor" é o menor par.
    valores.push(filtro.ate, filtro.ateId);
    condicoes.push(`(em, id) < ($${valores.length - 1}::timestamptz, $${valores.length})`);
  } else if (filtro.ate !== undefined) {
    valores.push(filtro.ate);
    condicoes.push(`em < $${valores.length}::timestamptz`);
  }
  valores.push(filtro.limite);
  const resultado = await cliente.query<LinhaDoBanco>(
    `select ${COLUNAS} from plataforma.crm_atividades
      where ${condicoes.join(" and ")}
      order by em desc, id desc
      limit $${valores.length}`,
    valores,
  );
  return resultado.rows.map(linhaParaAtividade);
}
