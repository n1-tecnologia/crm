/**
 * Evolver idempotente de configuração por Empresa (TEN-01, `05-CONTEXT.md`
 * D5-03; D5-19/WR-05 no fechamento de lacunas, plano 05-20): transforma
 * `CATALOGO_CONFIGURACAO_POR_EMPRESA` na opção que falta nos DOIS Campos
 * `Empresa` (`fd_cp_empresa` de Contas a pagar e `fld_sp_c_empresa` da
 * Solicitação de pagamento) e nas 6 Integrações de verdade no `DataState` —
 * a peça que falta porque `bootstrapGestao()` só grava em Espaço vazio
 * (`count(*) > 0` recusa) e `ws_n1` já opera. Mesmo molde de
 * `solicitacao-de-pagamento-evolver.ts` (Plan 02-08).
 *
 * D5-19 — sem a opção "Marcos Paulo" em `fld_sp_c_empresa` (o Campo lido por
 * `destinoDeCanal`, `operations/automations.ts`), nenhuma Solicitação do
 * Marcos Paulo existe, e o Canal não tem o que notificar. Editar o catálogo
 * de `solicitacao-de-pagamento.ts` não corrige produção (Pitfall 1 de
 * 05-RESEARCH) — é este evolver que leva a opção a `ws_n1`.
 *
 * Regra central — criar-ou-conferir, nunca substituir:
 *   - id do catálogo ausente no estado → cria;
 *   - id do catálogo presente no estado → compara campo a campo (inclusive
 *     `avisosPorCanal`/`statusDeclarados`, WR-05, por JSON canônico); qualquer
 *     divergência é reportada, nunca sobrescrita;
 *   - a opção "Marcos Paulo" só é acrescentada a cada Campo `Empresa` se
 *     ainda não estiver lá — nenhuma opção existente é removida nem
 *     reordenada.
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
import { CATALOGO_SOLICITACAO_DE_PAGAMENTO } from "./solicitacao-de-pagamento";
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

/**
 * `fld_sp_c_empresa` — a Empresa da Solicitação de pagamento, o SEGUNDO Campo
 * que precisa da opção "Marcos Paulo" (D5-19). Derivado do catálogo real
 * (nunca literal solto) para que uma mudança lá sem espelhar aqui quebre no
 * import/typecheck, não em produção — mesma técnica de `campoDoCatalogo` em
 * `operations/automations.ts`. Sem ciclo de import: nem
 * `solicitacao-de-pagamento.ts` nem `solicitacao-de-pagamento-evolver.ts`
 * importa deste arquivo (confirmado por grep).
 */
function campoDaSolicitacao(id: Id, rotuloEsperado: string): Id {
  const campo = CATALOGO_SOLICITACAO_DE_PAGAMENTO.campos.find((c) => c.id === id);
  if (!campo || campo.rotulo !== rotuloEsperado) {
    throw new Error(
      `Catálogo da Solicitação sem o Campo "${rotuloEsperado}" (${id}) — configuracao-por-empresa-evolver.ts desalinhado do catálogo real.`,
    );
  }
  return campo.id;
}

const CAMPO_EMPRESA_SOLICITACAO_ID: Id = campoDaSolicitacao("fld_sp_c_empresa", "Empresa");

interface CampoEmpresaAlvo {
  readonly campoId: Id;
  readonly mensagemAusente: string;
}

/** Os DOIS Campos `Empresa` que precisam da opção "Marcos Paulo" (D5-19). */
const CAMPOS_EMPRESA_ALVO: readonly CampoEmpresaAlvo[] = [
  {
    campoId: CP.fields.empresa,
    mensagemAusente: `Campo "Empresa" (${CP.fields.empresa}) não existe — rode o bootstrap da Fase 1 (bootstrapGestao) antes de evoluir esta configuração.`,
  },
  {
    campoId: CAMPO_EMPRESA_SOLICITACAO_ID,
    mensagemAusente: `Campo "Empresa" da Solicitação (${CAMPO_EMPRESA_SOLICITACAO_ID}) não existe — rode "npm run solicitacoes:configurar -w @n1/api" antes de evoluir esta configuração (D5-19).`,
  },
];

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
 * Serialização canônica (chaves em ordem alfabética) — cópia deliberada de
 * `contas-a-receber-evolver.ts::canonico` (que por sua vez copia de
 * `apps/api/src/persistencia/repositorio.ts::canonico`): nenhuma das duas
 * funções é exportada por aquele arquivo, e `packages/dominio` não importa de
 * `apps/api` (a regra de dependência do monorepo, `CONTEXT.md` raiz) — WR-05
 * precisa da mesma comparação estável de JSON para `avisosPorCanal` e
 * `statusDeclarados`.
 */
function canonico(valor: unknown): string {
  if (valor === null || typeof valor !== "object") return JSON.stringify(valor) ?? "null";
  if (Array.isArray(valor)) return `[${valor.map(canonico).join(",")}]`;
  const partes: string[] = [];
  for (const chave of Object.keys(valor as object).sort()) {
    const v = (valor as Record<string, unknown>)[chave];
    if (v === undefined) continue;
    partes.push(`${JSON.stringify(chave)}:${canonico(v)}`);
  }
  return `{${partes.join(",")}}`;
}

/**
 * Evolui a configuração por Empresa sobre um `DataState` já bootstrapado
 * pela Fase 1 (Espaço "Gestão" › Pasta "Financeiro" precisam existir) e já
 * com a Lista de Solicitações configurada (`evoluirConfiguracaoDeSolicitacoes`,
 * Plan 02-08) — este evolver não recria nenhum dos dois. Reaplicar é seguro:
 * a segunda chamada sobre o próprio resultado devolve `ok` com `criados` e
 * `divergentes` vazios.
 *
 * Ordem:
 *   1. localizar Espaço/Pasta; recusar se ausentes;
 *   2. para CADA um dos dois Campos `Empresa` (`fd_cp_empresa` e
 *      `fld_sp_c_empresa`, D5-19): localizar o Campo; recusar se ausente
 *      (mensagem específica por Campo); acrescentar `EMPRESA_NOVA` ao FINAL
 *      das opções só se ainda não estiver lá;
 *   3. recusar se alguma `empresa` do catálogo não for opção de AMBOS os
 *      Campos depois do passo 2 — uma Integração apontando para uma Empresa
 *      inexistente em qualquer um dos dois é exatamente o tipo de
 *      configuração pela metade que este evolver existe para impedir;
 *   4. criar-ou-conferir cada uma das 6 Integrações do catálogo, agora
 *      também comparando `avisosPorCanal` e `statusDeclarados` por JSON
 *      canônico (WR-05) — sem essa comparação o evolver responderia
 *      "conferido" mesmo com os destinatários de WhatsApp ou os Status
 *      declarados divergentes do catálogo;
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

  /* ── 2. Cada Campo `Empresa` ganha a opção que falta ──────────────────── */
  const opcoesFinaisPorCampo = new Map<Id, readonly string[]>();
  for (const alvo of CAMPOS_EMPRESA_ALVO) {
    const idx = state.fieldDefinitions.findIndex((f) => f.id === alvo.campoId);
    if (idx === -1) {
      return fail(alvo.mensagemAusente);
    }
    const campo = state.fieldDefinitions[idx]!;
    const opcoesAtuais = campo.options ?? [];
    if (!opcoesAtuais.includes(EMPRESA_NOVA)) {
      // `options` é `readonly` na interface — a opção nova nasce num objeto
      // novo, nunca por atribuição direta na propriedade do existente.
      state.fieldDefinitions[idx] = { ...campo, options: [...opcoesAtuais, EMPRESA_NOVA] };
      registrarCriacao("fieldDefinitionOption", `${campo.id}:${EMPRESA_NOVA}`, EMPRESA_NOVA);
    } else {
      conferidos.push(`${campo.id}:${EMPRESA_NOVA}`);
    }
    opcoesFinaisPorCampo.set(alvo.campoId, state.fieldDefinitions[idx]!.options ?? []);
  }

  /* ── 3. Toda Empresa do catálogo precisa ser opção válida dos DOIS Campos ── */
  for (const linha of CATALOGO_CONFIGURACAO_POR_EMPRESA) {
    for (const alvo of CAMPOS_EMPRESA_ALVO) {
      const opcoes = opcoesFinaisPorCampo.get(alvo.campoId) ?? [];
      if (!opcoes.includes(linha.empresa)) {
        return fail(
          `A Integração "${linha.nome}" aponta para a Empresa "${linha.empresa}", que não é opção do Campo "Empresa" (${alvo.campoId}) — configuração pela metade recusada.`,
        );
      }
    }
  }

  /* ── 4. Criar-ou-conferir cada Integração (WR-05: avisosPorCanal/statusDeclarados também) ── */
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
        // WR-05 — a ordem dos rótulos importa (é a ordem de envio); os
        // arrays são comparados exatamente como estão, via JSON canônico
        // (ausente = `null` dos dois lados, nunca falso-positivo).
        ["avisosPorCanal", canonico(linha.avisosPorCanal ?? null), canonico(existente.avisosPorCanal ?? null)],
        ["statusDeclarados", canonico(linha.statusDeclarados ?? null), canonico(existente.statusDeclarados ?? null)],
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
