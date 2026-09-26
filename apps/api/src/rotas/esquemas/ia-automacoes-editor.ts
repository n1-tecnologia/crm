/**
 * A FORMA dos `args` das operações de
 * `packages/dominio/src/operations/ia/automacoes-editor.ts` — 18 operações
 * (o editor de Automação: Gatilho, Condições, Ações, Política de erro e o
 * ciclo de vida). Não confundir com `./automacoes.ts`, que cobre
 * `automations.ts` (`runScheduledAutomations`). Ver `../esquemas/CONTEXT.md`
 * para a regra da pasta.
 *
 * `expression`, `params`, `targetExpression` e `temporalPredicate` são
 * `string` no domínio (JSON serializado pela tela, `automacao-spec.ts`) — a
 * forma de dentro é regra do domínio (`automacoes-validacao.ts`), não
 * transporte; por isso ficam `z.string()`.
 */

import type {
  AutomationAction,
  AutomationCondition,
  AutomationScopeType,
  AutomationTrigger,
  AutomationVersion,
  AutonomyLevel,
  TriggerKind,
} from "@n1/dominio";
import { ID, type Confere, type Esquemas, type Igual } from "./fragmentos";
import { z } from "zod";

const TRIGGER_KIND = z.enum(["evento", "agendamento", "manual", "condicaoTemporal"]);
const FREQUENCIA = z.enum(["minutos", "horas", "dias", "semanas", "meses"]);
const AUTOMATION_SCOPE_TYPE = z.enum([
  "workspace",
  "space",
  "folder",
  "list",
  "funnel",
  "inbox",
  "queue",
  "grupo",
  "comunidade",
  "flow",
]);
const AUTONOMY_LEVEL = z.enum(["assistido", "supervisionado", "autonomo"]);
const CONDITION_KIND = z.enum(["atributo", "valorDeCampo", "pertencimento", "temporal", "hibrida"]);
const ACTION_KIND = z.enum(["escrita", "controle"]);
const CONTROL_KIND = z.enum(["ramificar", "invocarAgente", "solicitarAprovacao", "aguardar", "notificar", "encerrar"]);
const ON_ACTION_FAILURE = z.enum(["interromper", "continuar"]);

const AUTOMATION_TRIGGER = z
  .object({
    kind: TRIGGER_KIND,
    eventType: z.string().optional(),
    eventSubtype: z.string().optional(),
    schedule: z
      .object({
        frequency: FREQUENCIA,
        interval: z.number(),
        weekDays: z.array(z.number()).optional(),
        time: z.string().optional(),
      })
      .strict()
      .optional(),
    temporalPredicate: z.string().optional(),
  })
  .strict();

const CAMPOS_DA_CONDICAO = {
  kind: CONDITION_KIND,
  expression: z.string(),
  agentId: ID.optional(),
  skillId: ID.optional(),
  defaultOnFailure: z.string().optional(),
};

const AUTOMATION_CONDITION = z.object(CAMPOS_DA_CONDICAO).strict();
/** `Partial<AutomationCondition>` — `editarCondicao`. */
const PATCH_DA_CONDICAO = AUTOMATION_CONDITION.partial().strict();

/** `Omit<AutomationAction, "order">` — `adicionarAcao`. */
const ACAO_SEM_ORDEM = z
  .object({
    kind: ACTION_KIND,
    toolId: z.string().optional(),
    controlKind: CONTROL_KIND.optional(),
    params: z.string(),
    targetExpression: z.string().optional(),
    agentId: ID.optional(),
    skillId: ID.optional(),
    maxAutonomy: AUTONOMY_LEVEL.optional(),
    approverMemberId: ID.optional(),
    approverTeamId: ID.optional(),
    timeoutHours: z.number().optional(),
  })
  .strict();
/** `Partial<Omit<AutomationAction, "order">>` — `editarAcao`. */
const PATCH_DA_ACAO = ACAO_SEM_ORDEM.partial().strict();

const CRIAR_AUTOMACAO_INPUT = z
  .object({
    name: z.string(),
    description: z.string().optional(),
    scopeType: AUTOMATION_SCOPE_TYPE,
    scopeId: ID,
    trigger: AUTOMATION_TRIGGER.optional(),
  })
  .strict();

const EDITAR_AUTOMACAO_INPUT = z
  .object({
    name: z.string().optional(),
    description: z.string().optional(),
    reactsToAutomationEvents: z.boolean().optional(),
  })
  .strict();

/** `maxAutonomy?: AutonomyLevel | null` — `null` retira o teto, ausente não mexe. */
const POLITICA_DE_ERRO_INPUT = z
  .object({
    onActionFailure: ON_ACTION_FAILURE,
    retries: z.number(),
    maxAutonomy: AUTONOMY_LEVEL.nullable().optional(),
  })
  .strict();

export const IA_AUTOMACOES_EDITOR = {
  criarAutomacao: z.tuple([CRIAR_AUTOMACAO_INPUT]),
  editarAutomacao: z.tuple([ID, EDITAR_AUTOMACAO_INPUT]),
  duplicarAutomacao: z.tuple([ID]),
  criarRascunhoDaAutomacao: z.tuple([ID]),
  descartarRascunhoDaAutomacao: z.tuple([ID]),
  // `null` (obrigatório na assinatura) — "Remover gatilho".
  definirGatilho: z.tuple([ID, AUTOMATION_TRIGGER.nullable()]),
  adicionarCondicao: z.tuple([ID, AUTOMATION_CONDITION]),
  editarCondicao: z.tuple([ID, z.number(), PATCH_DA_CONDICAO]),
  removerCondicao: z.tuple([ID, z.number()]),
  adicionarAcao: z.tuple([ID, ACAO_SEM_ORDEM]),
  editarAcao: z.tuple([ID, z.number(), PATCH_DA_ACAO]),
  moverAcao: z.tuple([ID, z.number(), z.enum(["subir", "descer"])]),
  removerAcao: z.tuple([ID, z.number()]),
  definirPoliticaDeErro: z.tuple([ID, POLITICA_DE_ERRO_INPUT]),
  pausarAutomacao: z.tuple([ID]),
  retomarAutomacao: z.tuple([ID]),
  arquivarAutomacao: z.tuple([ID]),
  enviarAutomacaoALixeira: z.tuple([ID]),
} satisfies Esquemas;

// ── Portão de enum bidirecional — falta ou sobra de membro não compila ──

type _EnumsCompletos = Confere<
  [
    Igual<z.infer<typeof TRIGGER_KIND>, TriggerKind>,
    Igual<z.infer<typeof FREQUENCIA>, NonNullable<AutomationTrigger["schedule"]>["frequency"]>,
    Igual<z.infer<typeof AUTOMATION_SCOPE_TYPE>, AutomationScopeType>,
    Igual<z.infer<typeof AUTONOMY_LEVEL>, AutonomyLevel>,
    Igual<z.infer<typeof CONDITION_KIND>, AutomationCondition["kind"]>,
    Igual<z.infer<typeof ACTION_KIND>, AutomationAction["kind"]>,
    Igual<z.infer<typeof CONTROL_KIND>, NonNullable<AutomationAction["controlKind"]>>,
    Igual<z.infer<typeof ON_ACTION_FAILURE>, AutomationVersion["errorPolicy"]["onActionFailure"]>,
  ]
>;
