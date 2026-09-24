/**
 * Evolver idempotente de configuração por Empresa (TEN-01, `05-CONTEXT.md`
 * D5-03): transforma `CATALOGO_CONFIGURACAO_POR_EMPRESA` na opção que falta
 * do Campo `Empresa` (`fd_cp_empresa`) e nas 6 Integrações de verdade no
 * `DataState` — a peça que falta porque `bootstrapGestao()` só grava em
 * Espaço vazio (`count(*) > 0` recusa) e `ws_n1` já opera. Mesmo molde de
 * `solicitacao-de-pagamento-evolver.ts` (Plan 02-08).
 *
 * Regra central — criar-ou-conferir, nunca substituir:
 *   - id do catálogo ausente no estado → cria;
 *   - id do catálogo presente no estado → compara campo a campo; qualquer
 *     divergência é reportada, nunca sobrescrita;
 *   - a opção "Marcos Paulo" só é acrescentada ao Campo `Empresa` se ainda
 *     não estiver lá — nenhuma opção existente é removida nem reordenada.
 *
 * Três regras duras:
 *   1. NUNCA remove nada.
 *   2. NUNCA toca `state.tasks` nem qualquer Comentário ou valor de Campo já
 *      gravado — este arquivo não lê nem escreve `state.tasks` em nenhuma
 *      linha.
 *   3. Ids são sempre os literais do catálogo, nunca gerados por sequência.
 *
 * `int_omie` (a Integração genérica que já existe em produção) NÃO está no
 * catálogo e NÃO é reportada como sobra — este evolver não faz checagem de
 * sobra em `state.integrations`, porque a coleção é compartilhada com o
 * resto do Espaço (mesma razão pela qual o molde não a faz em `state.tags`).
 *
 * `ultimaRotacaoEm` NUNCA é escrita por este evolver (D-13): quem rotaciona
 * é quem rotaciona; aqui ela nasce ausente e a tela mostra "nunca
 * registrada".
 */

import { CP } from "./operations/financeiro";
import { memberActor, recordActivity } from "./operations/activity";
import { CATALOGO_CONFIGURACAO_POR_EMPRESA, EMPRESA_NOVA } from "./configuracao-por-empresa";
import { fail, ok, type DataState, type OperationResult } from "./state";
import type { Id, Integration } from "./types";

export interface DivergenciaDeEmpresa {
  readonly id: Id;
  readonly campo: string;
  readonly esperado: string;
  readonly encontrado: string;
}

export interface DiffDeEmpresas {
  readonly criados: string[];
  readonly conferidos: string[];
  readonly divergentes: DivergenciaDeEmpresa[];
}

function conferirCampos(
  divergentes: DivergenciaDeEmpresa[],
  id: Id,
  pares: ReadonlyArray<readonly [campo: string, esperado: string, encontrado: string]>,
): void {
  for (const [campo, esperado, encontrado] of pares) {
    if (esperado !== encontrado) divergentes.push({ id, campo, esperado, encontrado });
  }
}

function formatarDivergencias(divergentes: readonly DivergenciaDeEmpresa[]): string {
  const linhas = divergentes.map((d) => `${d.id}.${d.campo}: esperado "${d.esperado}", encontrado "${d.encontrado}"`);
  return `Configuração por Empresa diverge do catálogo — nada foi sobrescrito:\n${linhas.join("\n")}`;
}

/**
 * Evolui a configuração por Empresa sobre um `DataState` já bootstrapado
 * pela Fase 1 (Espaço "Gestão" › Pasta "Financeiro" › Campo `Empresa`
 * precisam existir — este evolver não os recria). Reaplicar é seguro: a
 * segunda chamada sobre o próprio resultado devolve `ok` com `criados` e
 * `divergentes` vazios.
 *
 * Ordem:
 *   1. localizar Espaço/Pasta; recusar se ausentes;
 *   2. localizar o Campo `Empresa`; recusar se ausente; acrescentar
 *      `EMPRESA_NOVA` às opções só se ainda não estiver lá;
 *   3. recusar se alguma `empresa` do catálogo não for opção do Campo depois
 *      do passo 2 — uma Integração apontando para uma Empresa inexistente é
 *      exatamente o tipo de configuração pela metade que este evolver existe
 *      para impedir;
 *   4. criar-ou-conferir cada uma das 6 Integrações do catálogo;
 *   5. qualquer divergência → `fail` com diff legível, nada mais muda;
 *   6. uma Atividade por elemento criado;
 *   7. `ok(diff)`.
 */
export function evoluirConfiguracaoPorEmpresa(state: DataState, actingMemberId: Id): OperationResult<DiffDeEmpresas> {
  if (!state.spaces.some((e) => e.id === CP.spaceId)) {
    return fail(`Espaço "Gestão" (${CP.spaceId}) não existe — rode o bootstrap da Fase 1 (bootstrapGestao) antes de evoluir esta configuração.`);
  }
  if (!state.folders.some((f) => f.id === CP.folderId)) {
    return fail(`Pasta "Financeiro" (${CP.folderId}) não existe — rode o bootstrap da Fase 1 (bootstrapGestao) antes de evoluir esta configuração.`);
  }

  const workspaceId = state.workspace.id;
  const agora = new Date().toISOString();
  const ator = memberActor(actingMemberId);

  const criados: string[] = [];
  const conferidos: string[] = [];
  const divergentes: DivergenciaDeEmpresa[] = [];

  const registrarCriacao = (objectType: string, objectId: Id, objectName: string): void => {
    criados.push(objectId);
    recordActivity(state, { actor: ator, action: "criar", objectType, objectId, objectName, at: agora });
  };

  /* ── 2. Campo `Empresa` ganha a opção que falta ───────────────────────── */
  const idxCampoEmpresa = state.fieldDefinitions.findIndex((f) => f.id === CP.fields.empresa);
  if (idxCampoEmpresa === -1) {
    return fail(`Campo "Empresa" (${CP.fields.empresa}) não existe — rode o bootstrap da Fase 1 (bootstrapGestao) antes de evoluir esta configuração.`);
  }
  const campoEmpresa = state.fieldDefinitions[idxCampoEmpresa]!;
  const opcoesAtuais = campoEmpresa.options ?? [];
  if (!opcoesAtuais.includes(EMPRESA_NOVA)) {
    // `options` é `readonly` na interface — a opção nova nasce num objeto
    // novo, nunca por atribuição direta na propriedade do existente.
    state.fieldDefinitions[idxCampoEmpresa] = { ...campoEmpresa, options: [...opcoesAtuais, EMPRESA_NOVA] };
    registrarCriacao("fieldDefinitionOption", `${campoEmpresa.id}:${EMPRESA_NOVA}`, EMPRESA_NOVA);
  } else {
    conferidos.push(`${campoEmpresa.id}:${EMPRESA_NOVA}`);
  }
  const opcoesFinais = state.fieldDefinitions[idxCampoEmpresa]!.options ?? [];

  /* ── 3. Toda Empresa do catálogo precisa ser opção válida ─────────────── */
  for (const linha of CATALOGO_CONFIGURACAO_POR_EMPRESA) {
    if (!opcoesFinais.includes(linha.empresa)) {
      return fail(
        `A Integração "${linha.nome}" aponta para a Empresa "${linha.empresa}", que não é opção do Campo "Empresa" (${CP.fields.empresa}) — configuração pela metade recusada.`,
      );
    }
  }

  /* ── 4. Criar-ou-conferir cada Integração ──────────────────────────────── */
  for (const linha of CATALOGO_CONFIGURACAO_POR_EMPRESA) {
    const existente = state.integrations.find((i) => i.id === linha.integrationId);
    if (!existente) {
      const nova: Integration = {
        id: linha.integrationId,
        workspaceId,
        name: linha.nome,
        systemType: "erp",
        state: "desconectada",
        configuredBy: actingMemberId,
        createdBy: ator,
        createdAt: agora,
        exposedTools: [],
        empresa: linha.empresa,
        // `ultimaRotacaoEm` nasce ausente de propósito — D-13.
        omie: { contaRotulo: linha.contaRotulo, bancoDeCategorias: linha.bancoDeCategorias },
        ...(linha.avisosPorCanal ? { avisosPorCanal: linha.avisosPorCanal } : {}),
        ...(linha.statusDeclarados ? { statusDeclarados: linha.statusDeclarados } : {}),
      };
      state.integrations.push(nova);
      registrarCriacao("integration", nova.id, nova.name);
    } else {
      conferirCampos(divergentes, existente.id, [
        ["name", linha.nome, existente.name],
        ["empresa", linha.empresa, existente.empresa ?? ""],
        ["omie.contaRotulo", linha.contaRotulo, existente.omie?.contaRotulo ?? ""],
        ["omie.bancoDeCategorias", linha.bancoDeCategorias, existente.omie?.bancoDeCategorias ?? ""],
      ]);
      conferidos.push(existente.id);
    }
  }

  /* ── 5. Qualquer divergência recusa — nada mais muda a partir daqui ────── */
  if (divergentes.length > 0) {
    return fail(formatarDivergencias(divergentes));
  }

  return ok({ criados, conferidos, divergentes });
}
