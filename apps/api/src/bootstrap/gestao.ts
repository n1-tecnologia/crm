/**
 * Materializa o dado inicial de produção da Fase 1 (PERS-06): o `DataState`
 * de `buildGestaoBootstrap()` — só a configuração do Financeiro, a Maryane
 * Proprietária — gravado num Espaço de Trabalho vazio, uma vez.
 *
 * Guarda de "Espaço vazio": rodar duas vezes não duplica nem apaga nada. A
 * segunda execução encontra registros e não grava — reaplicar configuração
 * por cima de Tarefas reais exigiria `gravar()` filtrado por coleção, e isso
 * não é necessário agora (RESEARCH.md, Open Question #3: rodar uma vez basta
 * para o critério da fase; quando reaplicar for preciso, nasce aqui).
 */

import type { PoolClient } from "pg";
import { buildGestaoBootstrap } from "@n1/dominio/bootstrap-gestao";
import { semear } from "../persistencia/repositorio";

export interface ResultadoDoBootstrap {
  readonly criado: boolean;
  readonly gravados: number;
  readonly motivo?: string;
}

export async function bootstrapGestao(
  cliente: PoolClient,
  opcoes: { readonly workspaceId: string; readonly agora?: string },
): Promise<ResultadoDoBootstrap> {
  const { workspaceId, agora } = opcoes;

  const { rows } = await cliente.query<{ n: number }>(
    "select count(*)::int as n from plataforma.registros where workspace_id = $1",
    [workspaceId],
  );
  const n = rows[0]?.n ?? 0;
  if (n > 0) {
    return {
      criado: false,
      gravados: 0,
      motivo: `O Espaço "${workspaceId}" já tem ${n} registros; o bootstrap grava só em Espaço vazio.`,
    };
  }

  await cliente.query("begin");
  try {
    const gravados = await semear(cliente, workspaceId, buildGestaoBootstrap({ workspaceId, agora }));
    await cliente.query("commit");
    return { criado: true, gravados };
  } catch (erro) {
    await cliente.query("rollback");
    throw erro;
  }
}
