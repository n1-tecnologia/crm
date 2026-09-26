"use client";

/**
 * A Lista "Contas a pagar" vista como software financeiro: indicadores,
 * uma barra só, tabela agrupada por situação financeira e ações rápidas por
 * linha. É uma LENTE sobre as mesmas Tarefas e operações da Lista — o Status
 * real continua na pílula; os grupos (a pagar, vencidas, aguardando
 * autorização, programadas, pagas) são derivados do Status e do vencimento,
 * nunca gravados.
 *
 * Composição no sistema do CRM-COMPLETO: os indicadores são peças de bloco que
 * filtram ao clicar; a barra vive na `BarraDeFiltros` da tela; a tabela é a
 * `.tabela` do sistema, com cada conta como peça e cada grupo como faixa.
 *
 * Correção de rota (Plan 03-13): o gesto de SELEÇÃO mora neste arquivo
 * (checkbox por linha e por grupo, `onToggleMany`) — mas a AÇÃO de mudar
 * Status em lote não. Ela mora em `../bulk-status-bar.tsx`, e o relato dos
 * quatro resultados que ela produz mora em `../relatorio-de-lote.tsx`. Um
 * esboço anterior desta fase apontou a ação de lote para este arquivo; não é
 * aqui.
 */

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  Filter,
  Minus,
  Search,
  Wallet,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { useData, useRun, useSession } from "@/dados/store";
import { useRecente } from "@/features/shell/recente";
import {
  changeTaskStatus,
  CP,
  runScheduledAutomations,
  statusOptionRefusal,
} from "@n1/dominio/operations";
import {
  containerAdminRefusal,
  effectiveListConfig,
  isTerminalCategory,
  statusCategory,
  taskWriteRefusal,
} from "@n1/dominio/derive";
import {
  type FinanceFilters,
  type FinanceGroup,
  type FinanceProfile,
  type FinanceQuickAction,
  FILTROS_INICIAIS,
  GROUP_LABEL,
  nascimentoNoGrupo,
  opcoesDeEmpresa,
  pagoEm,
  textoDoCampo as textoDe,
  valorDaConta as valorDe,
} from "./lens";
import { PRIORITY_LABEL } from "@/features/shell/format";
import { BotaoDeMais, CompositorNoGrupo } from "@/features/estrutura/novo-no-grupo";
import { useFormat } from "@/features/shell/use-format";
import {
  ActionMenu,
  ActorAvatar,
  Button,
  Chip,
  ConfirmDialog,
  Divisor,
  EmptyState,
  Icone,
  Pilula,
  Select,
} from "@/features/shell/ui";
import type { LucideIcon } from "lucide-react";
import type { DataState } from "@n1/dominio/state";
import type { Priority, StatusDefinition, Task } from "@n1/dominio/types";

type Report = (
  result: { ok: boolean; error?: string },
  message: string,
) => void;

/* ───────────────────────────── Lente financeira ───────────────────────────── */

export {
  applyFinanceFilters,
  FILTROS_INICIAIS,
  financeProfileOf,
  GROUP_LABEL,
  type FinanceFilters,
  type FinanceGroup,
  type FinanceProfile,
} from "./lens";

/** Cor semântica do grupo — só em pílula, ponto e data, nunca na linha inteira. */
const GROUP_TOKEN: Record<FinanceGroup, string> = {
  autorizacao: "var(--acento)",
  aPagar: "var(--info)",
  vencidas: "var(--erro)",
  programadas: "var(--info)",
  pagas: "var(--sucesso)",
  negadas: "var(--aviso)",
  aReceber: "var(--info)",
  emCobranca: "var(--aviso)",
  saque: "var(--acento)",
  recebidas: "var(--sucesso)",
  descartadas: "var(--texto-4)",
};
const CARD_ICON: Record<FinanceGroup, LucideIcon> = {
  autorizacao: Clock,
  aPagar: Wallet,
  vencidas: AlertTriangle,
  programadas: Clock,
  pagas: CheckCircle2,
  negadas: AlertTriangle,
  aReceber: Wallet,
  emCobranca: Clock,
  saque: Wallet,
  recebidas: CheckCircle2,
  descartadas: Minus,
};

/* ───────────────────────────── Indicadores ───────────────────────────── */

export function FinanceIndicators({
  state,
  profile,
  tasks,
  active,
  onPick,
}: {
  readonly state: DataState;
  readonly profile: FinanceProfile;
  readonly tasks: readonly Task[];
  readonly active: FinanceGroup | "";
  readonly onPick: (grupo: FinanceGroup | "") => void;
}) {
  const fmt = useFormat();
  const now = new Date();
  const soma = (pred: (t: Task) => boolean) =>
    tasks.filter(pred).reduce((s, t) => s + valorDe(t), 0);
  const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const settledGroup = profile.groupOf(
    state,
    { ...tasks[0], statusId: profile.settledStatusId } as Task,
    now,
  );
  // Cada peça soma exatamente o grupo que o clique filtra — o número da peça
  // e o subtotal do grupo na tabela são o mesmo.
  const cards: ReadonlyArray<{
    grupo: FinanceGroup;
    label: string;
    valor: number;
    nota?: string;
    icon: LucideIcon;
    cor: string;
  }> = profile.cards.map((c) => ({
    grupo: c.grupo,
    label: c.label,
    valor: soma((t) => profile.groupOf(state, t, now) === c.grupo),
    ...(tasks.length > 0 && c.grupo === settledGroup
      ? {
          nota: `${fmt.money({ amount: soma((t) => (pagoEm(state, t) ?? Number.NaN) >= inicioMes), currency: "BRL" })} ${profile.labels.settledNota}`,
        }
      : {}),
    icon: CARD_ICON[c.grupo],
    cor: GROUP_TOKEN[c.grupo],
  }));
  return (
    <div className="grade-solta grid-cols-2 xl:grid-cols-4">
      {cards.map((c) => {
        const ativo = active === c.grupo;
        return (
          <button
            key={c.grupo}
            type="button"
            onClick={() => onPick(ativo ? "" : c.grupo)}
            aria-pressed={ativo}
            title={ativo ? "Tirar este filtro" : `Ver só “${c.label}”`}
            className="item-solto text-left"
            data-bloco="true"
            data-destacado={ativo ? "true" : undefined}
            data-atenuado={!ativo && c.valor === 0 ? "true" : undefined}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="app-coluna truncate">{c.label}</span>
              <Icone de={c.icon} tamanho="xs" style={{ color: c.cor }} />
            </span>
            <span className="mt-1 flex items-baseline gap-2">
              <span
                className="ed-subtitulo app-numero"
                style={{
                  color: c.valor === 0 ? "var(--texto-4)" : "var(--texto)",
                }}
              >
                {fmt.money({ amount: c.valor, currency: "BRL" })}
              </span>
            </span>
            {c.nota ? (
              <span className="app-meta app-numero block truncate">
                {c.nota}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* ───────────────────────────── Barra ───────────────────────────── */

/**
 * O conteúdo da `BarraDeFiltros` da Lista financeira: busca, filtros, os dois
 * seletores e as ações de lote. Quem a hospeda põe a barra; aqui só o miolo.
 */
export function FinanceToolbar({
  listId,
  profile,
  filters,
  onFilters,
  onOpenFilters,
  filtrosAvancados,
  selecionando,
  onToggleSelecionar,
  report,
}: {
  readonly listId: string;
  readonly profile: FinanceProfile;
  readonly filters: FinanceFilters;
  readonly onFilters: (next: FinanceFilters) => void;
  readonly onOpenFilters: () => void;
  readonly filtrosAvancados: number;
  readonly selecionando: boolean;
  readonly onToggleSelecionar: () => void;
  readonly report: Report;
}) {
  const state = useData((data) => data);
  const run = useRun();
  const router = useRouter();
  const { memberId } = useSession();
  const empresas = opcoesDeEmpresa(state);
  const admin = containerAdminRefusal(state, memberId, "list", listId);
  const agendadas = state.automations.filter(
    (a) =>
      a.lifecycle === "ativo" &&
      a.scopeType === "list" &&
      a.scopeId === listId &&
      a.versions.some(
        (v) =>
          v.state === "publicada" && v.trigger?.kind === "condicaoTemporal",
      ),
  ).length;
  const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];
  if (filters.texto.trim())
    chips.push({
      key: "texto",
      label: `Busca: ${filters.texto.trim()}`,
      onRemove: () => onFilters({ ...filters, texto: "" }),
    });
  if (filters.empresa)
    chips.push({
      key: "empresa",
      label: `Empresa: ${filters.empresa}`,
      onRemove: () => onFilters({ ...filters, empresa: "" }),
    });
  if (filters.periodo !== "todos")
    chips.push({
      key: "periodo",
      label:
        filters.periodo === "mes"
          ? "Este mês"
          : filters.periodo === "30dias"
            ? "Próximos 30 dias"
            : "Só vencidas",
      onRemove: () => onFilters({ ...filters, periodo: "todos" }),
    });
  if (filters.grupo)
    chips.push({
      key: "grupo",
      label: GROUP_LABEL[filters.grupo],
      onRemove: () => onFilters({ ...filters, grupo: "" }),
    });

  return (
    <>
      <span className="relative min-w-56 flex-1">
        <Icone
          de={Search}
          tamanho="xs"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
          style={{ color: "var(--texto-4)" }}
        />
        <label htmlFor="busca-contas" className="sr-only">
          {profile.labels.buscar}
        </label>
        <input
          id="busca-contas"
          type="search"
          value={filters.texto}
          onChange={(event) =>
            onFilters({ ...filters, texto: event.target.value })
          }
          placeholder={profile.labels.buscar}
          className="campo pl-9"
          style={{ height: "var(--controle-h-sm)" }}
        />
      </span>
      <Button
        size="sm"
        onClick={onOpenFilters}
        icon={<Icone de={Filter} tamanho="xs" />}
      >
        Filtros{filtrosAvancados > 0 ? ` (${filtrosAvancados})` : ""}
      </Button>
      <span className="w-52">
        <label htmlFor="filtro-empresa" className="sr-only">
          Empresa
        </label>
        <Select
          id="filtro-empresa"
          size="sm"
          value={filters.empresa}
          onChange={(empresa) => onFilters({ ...filters, empresa })}
          placeholder="Todas as Empresas"
          options={empresas.map((e) => ({ value: e, label: e }))}
        />
      </span>
      <span className="w-44">
        <label htmlFor="filtro-periodo" className="sr-only">
          Período
        </label>
        <Select
          id="filtro-periodo"
          size="sm"
          value={filters.periodo}
          onChange={(periodo) =>
            onFilters({
              ...filters,
              periodo: periodo as FinanceFilters["periodo"],
            })
          }
          options={[
            { value: "todos", label: "Todo o período" },
            { value: "mes", label: "Este mês" },
            { value: "30dias", label: "Próximos 30 dias" },
            { value: "vencidas", label: "Só vencidas" },
          ]}
        />
      </span>
      <Divisor vertical className="mx-1" />
      <Button
        size="sm"
        onClick={onToggleSelecionar}
        aria-pressed={selecionando}
      >
        {selecionando ? "Sair da seleção" : "Selecionar várias"}
      </Button>
      <ActionMenu
        label="Automatizar"
        trigger={
          <span className="btn btn-fantasma btn-sm">
            <Icone de={Zap} tamanho="xs" />
            Automatizar
          </span>
        }
        items={[
          {
            label: "Rodar automações por vencimento (hoje)",
            onSelect: () => {
              const r = run((data, me) =>
                runScheduledAutomations(data, me, listId, new Date()),
              );
              if (r.ok && r.value.failed > 0)
                report(
                  {
                    ok: false,
                    error: `${r.value.executed} executada(s); ${r.value.failed} falhou(aram): ${r.value.failures.map((f) => `${f.title} — ${f.reason}`).join(" · ")}`,
                  },
                  "",
                );
              else
                report(
                  r,
                  r.ok
                    ? `Automações por vencimento: ${r.value.executed} executada(s), ${r.value.skipped} já rodada(s) ou fora da condição.`
                    : "",
                );
            },
            ...(admin
              ? { disabledReason: admin }
              : agendadas === 0
                ? {
                    disabledReason:
                      "Esta Lista não tem Automação por vencimento.",
                  }
                : {}),
          },
          {
            label: "Ver Automações desta Lista",
            onSelect: () => router.push("/ia/personalizar/automacao"),
          },
        ]}
      />
      {chips.length > 0 ? (
        <span className="flex basis-full flex-wrap items-center gap-1.5 pb-2">
          <span className="app-meta">Filtros aplicados:</span>
          {chips.map((c) => (
            <Chip key={c.key} onRemove={c.onRemove}>
              {c.label}
            </Chip>
          ))}
          <button
            type="button"
            onClick={() => onFilters(FILTROS_INICIAIS)}
            className="app-meta underline transition-colors hover:text-[var(--texto)]"
          >
            limpar todos
          </button>
        </span>
      ) : null}
    </>
  );
}

/* ───────────────────────────── Tabela ───────────────────────────── */

const PRIORITY_ICON: Record<
  Priority,
  { readonly icone: LucideIcon; readonly cor: string }
> = {
  urgente: { icone: AlertTriangle, cor: "var(--erro)" },
  alta: { icone: ArrowUp, cor: "var(--aviso)" },
  normal: { icone: Minus, cor: "var(--texto-4)" },
  baixa: { icone: ArrowDown, cor: "var(--texto-4)" },
  semPrioridade: { icone: Minus, cor: "var(--texto-4)" },
};

export function StatusBadge({
  definition,
  grupo,
}: {
  readonly definition: StatusDefinition | undefined;
  readonly grupo: FinanceGroup;
}) {
  return (
    <Pilula cor={GROUP_TOKEN[grupo]} className="whitespace-nowrap">
      {definition?.name ?? "—"}
    </Pilula>
  );
}

function QuickAction({
  label,
  onClick,
  icone,
  disabledReason,
}: {
  readonly label: string;
  readonly onClick: () => void;
  readonly icone: LucideIcon;
  readonly disabledReason?: string;
}) {
  const off = disabledReason !== undefined;
  return (
    <button
      type="button"
      onClick={off ? undefined : onClick}
      aria-disabled={off}
      aria-label={label}
      title={off ? disabledReason : label}
      className="btn-icone btn-icone-nu"
      style={{
        width: "1.75rem",
        height: "1.75rem",
        ...(off
          ? { cursor: "not-allowed", color: "var(--texto-4)", opacity: 0.6 }
          : {}),
      }}
    >
      <Icone de={icone} tamanho="xs" />
    </button>
  );
}

export function FinanceTable({
  state,
  profile,
  tasks,
  definitions,
  selected,
  onToggle,
  onToggleMany,
  selecionando,
  grupoFiltrado,
  openTask,
  report,
  onCreateInGroup,
  criacaoRecusada,
  seletorDeTipo,
}: {
  readonly state: DataState;
  readonly profile: FinanceProfile;
  readonly tasks: readonly Task[];
  readonly definitions: readonly StatusDefinition[];
  readonly selected: ReadonlySet<string>;
  readonly onToggle: (taskId: string) => void;
  readonly onToggleMany: (ids: readonly string[], on: boolean) => void;
  readonly selecionando: boolean;
  /** O grupo escolhido no filtro aparece mesmo vazio: é a resposta à pergunta. */
  readonly grupoFiltrado: FinanceGroup | "";
  readonly openTask: (taskId: string) => void;
  readonly report: Report;
  /** O "+" do grupo: a conta nasce no Status daquele grupo. */
  readonly onCreateInGroup?: (title: string, statusId?: string, taskTypeId?: string) => boolean;
  readonly criacaoRecusada?: string;
  /** O seletor de Tipo do compositor; `null` quando a Lista enxerga um Tipo só. */
  readonly seletorDeTipo?: (valor: string | undefined, aoEscolher: (taskTypeId: string) => void) => ReactNode;
}) {
  const fmt = useFormat();
  const run = useRun();
  // A conta que acabou de nascer ou mudar acende (`data-recente`); a criada
  // pelo compositor inline já entra acesa, sem cascata.
  const recente = useRecente();
  const router = useRouter();
  const [acao1, acao2] = profile.quickActions;
  const { memberId } = useSession();
  const now = useMemo(() => new Date(), []);
  const [fechados, setFechados] = useState<ReadonlySet<FinanceGroup>>(
    new Set(),
  );
  const [confirmando, setConfirmando] = useState<{
    taskId: string;
    statusId: string;
    label: string;
  } | null>(null);

  const alternar = (grupo: FinanceGroup) =>
    setFechados((atual) => {
      const n = new Set(atual);
      if (n.has(grupo)) n.delete(grupo);
      else n.add(grupo);
      return n;
    });
  const [criandoEm, setCriandoEm] = useState<FinanceGroup | null>(null);
  // Um grupo sem conta não aparece — a não ser que o filtro tenha escolhido
  // exatamente esse grupo (aí o vazio, e o "+" dele, são a resposta), ou que
  // o compositor esteja aberto nele.
  const grupos = profile.groups
    .map((g) => ({
      grupo: g,
      itens: tasks.filter((t) => profile.groupOf(state, t, now) === g),
    }))
    .filter((g) => g.itens.length > 0 || g.grupo === grupoFiltrado || g.grupo === criandoEm);
  // O "+" de um grupo que não recebe conta nova (vencidas, pagas…) não fica
  // mudo: diz o motivo e abre o compositor no grupo onde a conta nasce.
  const berco = profile.groups.find((g) => nascimentoNoGrupo(profile, g).recusa === undefined);
  const redirecionarCriacao = (motivo: string) => {
    if (berco && onCreateInGroup && criacaoRecusada === undefined) {
      setCriandoEm(berco);
      report({ ok: true }, `${motivo} O campo de criação abriu em ${GROUP_LABEL[berco]}.`);
    } else {
      report({ ok: false, error: motivo }, "");
    }
  };
  const statusDe = (id: string) => definitions.find((d) => d.id === id);
  const mover = (task: Task, statusId: string, label: string) => {
    const r = run((data, me) => changeTaskStatus(data, me, task.id, statusId));
    report(r, `“${task.title}”: ${label}.`);
  };
  const aConfirmar = confirmando
    ? tasks.find((t) => t.id === confirmando.taskId)
    : undefined;

  // ARMADILHA: sem wrapper com `overflow-x: auto` — ele viraria contêiner de
  // rolagem nos dois eixos e o `thead` fixo deixaria de grudar. Quem rola é o
  // corpo da tela; as colunas menos úteis somem por degrau de largura.
  return (
    <div className="@container">
      <ConfirmDialog
        open={confirmando !== null}
        title={`${confirmando?.label ?? ""}: “${aConfirmar?.title ?? ""}”?`}
        description={`${fmt.money({ amount: aConfirmar ? valorDe(aConfirmar) : 0, currency: "BRL" })} · vence ${aConfirmar?.dueDate ? fmt.taskDate(aConfirmar.dueDate) : "—"}. A mudança de Status passa pelas regras da Lista e fica na Atividade.`}
        confirmLabel={confirmando?.label ?? "Confirmar"}
        onConfirm={() => {
          if (confirmando && aConfirmar)
            mover(
              aConfirmar,
              confirmando.statusId,
              confirmando.label.toLocaleLowerCase("pt-BR"),
            );
          setConfirmando(null);
        }}
        onCancel={() => setConfirmando(null)}
      />
      <table className="tabela">
        <thead>
          <tr>
            <th
              className="app-coluna"
              data-vazia="true"
              style={{ width: "2rem", paddingInline: "var(--e-2)" }}
            >
              {selecionando ? (
                <span className="sr-only">Selecionar</span>
              ) : null}
            </th>
            <th className="app-coluna">Conta</th>
            <th className="app-coluna hidden @3xl:table-cell">
              {profile.labels.contraparte}
            </th>
            <th className="app-coluna hidden @6xl:table-cell">Empresa</th>
            <th className="app-coluna">Vencimento</th>
            <th className="app-coluna text-right">Valor</th>
            <th className="app-coluna hidden @7xl:table-cell">Prioridade</th>
            <th className="app-coluna hidden @5xl:table-cell">Responsável</th>
            <th className="app-coluna">Status</th>
            <th className="app-coluna" data-vazia="true" style={{ width: "1%" }}>
              <span className="sr-only">Ações</span>
            </th>
          </tr>
        </thead>
        {grupos.map(({ grupo, itens }) => {
          const fechado = fechados.has(grupo);
          const subtotal = itens.reduce((s, t) => s + valorDe(t), 0);
          const cor = GROUP_TOKEN[grupo];
          const todos =
            itens.length > 0 && itens.every((t) => selected.has(t.id));
          return (
            <tbody key={grupo}>
              <tr data-faixa="true">
                <td colSpan={10}>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => alternar(grupo)}
                      aria-expanded={!fechado}
                      className="app-md inline-flex items-center gap-1.5 rounded-[var(--r-controle)] px-1 py-0.5 transition-colors hover:bg-[var(--superficie-2)]"
                      style={{ color: "var(--texto)" }}
                    >
                      <Icone
                        de={fechado ? ChevronRight : ChevronDown}
                        tamanho="xs"
                        style={{ color: "var(--texto-3)" }}
                      />
                      <Pilula cor={cor}>{GROUP_LABEL[grupo]}</Pilula>
                    </button>
                    <span className="app-meta app-numero">{itens.length}</span>
                    {(() => {
                      const berco = nascimentoNoGrupo(profile, grupo);
                      const motivo = !onCreateInGroup
                        ? (criacaoRecusada ?? "Esta Lista não recebe contas novas.")
                        : (criacaoRecusada ?? berco.recusa);
                      return (
                        <BotaoDeMais
                          rotulo={GROUP_LABEL[grupo]}
                          aberto={criandoEm === grupo}
                          onClick={() => setCriandoEm((atual) => (atual === grupo ? null : grupo))}
                          onBloqueado={redirecionarCriacao}
                          {...(motivo ? { motivo } : {})}
                        />
                      );
                    })()}
                    <span
                      className="app-sm app-numero"
                      style={{ color: "var(--texto-1)" }}
                    >
                      {fmt.money({ amount: subtotal, currency: "BRL" })}
                    </span>
                    <span className="flex-1" />
                    {selecionando && itens.length > 0 ? (
                      <label className="app-meta flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={todos}
                          onChange={(e) =>
                            onToggleMany(
                              itens.map((t) => t.id),
                              e.target.checked,
                            )
                          }
                          className="accent-[var(--acento)]"
                          style={{
                            width: "var(--caixa-tam)",
                            height: "var(--caixa-tam)",
                          }}
                        />
                        todas do grupo
                      </label>
                    ) : null}
                    <ActionMenu
                      label={`Ações do grupo ${GROUP_LABEL[grupo]}`}
                      items={[
                        {
                          label: fechado ? "Expandir" : "Recolher",
                          onSelect: () => alternar(grupo),
                        },
                        {
                          label: "Selecionar todas do grupo",
                          onSelect: () =>
                            onToggleMany(
                              itens.map((t) => t.id),
                              true,
                            ),
                          ...(selecionando
                            ? {}
                            : {
                                disabledReason:
                                  "Entre em “Selecionar várias” primeiro.",
                              }),
                        },
                      ]}
                    />
                  </div>
                </td>
              </tr>
              {criandoEm === grupo && onCreateInGroup ? (
                <tr data-faixa="true">
                  <td colSpan={10}>
                    <CompositorNoGrupo
                      placeholder={`${profile.labels.novaPlaceholder} — em ${GROUP_LABEL[grupo].toLocaleLowerCase("pt-BR")}`}
                      onCreate={(title, taskTypeId) => onCreateInGroup(title, nascimentoNoGrupo(profile, grupo).statusId, taskTypeId)}
                      onCancel={() => setCriandoEm(null)}
                      seletor={seletorDeTipo}
                    />
                  </td>
                </tr>
              ) : null}
              {fechado ? null : itens.length === 0 ? (
                <tr data-faixa="true">
                  <td colSpan={10} className="app-meta">
                    Nenhuma conta em{" "}
                    {GROUP_LABEL[grupo].toLocaleLowerCase("pt-BR")}.
                  </td>
                </tr>
              ) : (
                itens.map((task) => {
                  const definition = statusDe(task.statusId);
                  const vencida = grupo === "vencidas";
                  const proxima =
                    !vencida &&
                    task.dueDate !== undefined &&
                    !isTerminalCategory(statusCategory(state, task)) &&
                    Date.parse(
                      task.dueDate.form === "civilDay"
                        ? `${task.dueDate.value}T23:59:59`
                        : task.dueDate.value,
                    ) -
                      now.getTime() <
                      3 * 86_400_000;
                  const responsavel = task.assignees.find(
                    (a) => a.kind === "member",
                  );
                  const membro = responsavel
                    ? state.members.find((m) => m.id === responsavel.id)
                    : undefined;
                  const escreve =
                    taskWriteRefusal(state, memberId, task.id) === undefined;
                  const motivoDe = (acao: FinanceQuickAction) =>
                    !escreve
                      ? "Você não altera esta conta."
                      : (acao.notApplicable(task) ??
                        statusOptionRefusal(
                          state,
                          memberId,
                          task,
                          acao.statusId,
                        ));
                  const podeAutorizar = motivoDe(acao1);
                  const podePagar = motivoDe(acao2);
                  const selecionada = selected.has(task.id);
                  const prioridade = PRIORITY_ICON[task.priority];
                  return (
                    <tr
                      key={task.id}
                      data-recente={task.id === recente ? "true" : undefined}
                      className="group cursor-pointer"
                      data-selecionada={selecionada ? "true" : undefined}
                      // A linha inteira abre a conta — não só o nome. Um clique
                      // que nasce num controle (caixa, ação rápida, menu, link)
                      // é dele, e não abre nada.
                      onClick={(event) => {
                        const alvo = event.target as HTMLElement;
                        if (alvo.closest("button, a, input, select, textarea, [role=menu], [role=listbox]")) return;
                        openTask(task.id);
                      }}
                    >
                      <td style={{ paddingInline: "var(--e-2)" }}>
                        {selecionando ? (
                          <input
                            type="checkbox"
                            checked={selecionada}
                            onChange={() => onToggle(task.id)}
                            aria-label={`Selecionar ${task.title}`}
                            className="block accent-[var(--acento)]"
                            style={{
                              width: "var(--caixa-tam)",
                              height: "var(--caixa-tam)",
                            }}
                          />
                        ) : (
                          <span
                            aria-hidden="true"
                            className="mx-auto block h-6 w-0.5 rounded-full"
                            style={{
                              background: vencida
                                ? "var(--erro)"
                                : proxima
                                  ? "var(--aviso)"
                                  : "transparent",
                            }}
                          />
                        )}
                      </td>
                      <td
                        className="max-w-[22ch]"
                        style={{ paddingBlock: "var(--e-1)" }}
                      >
                        {/* Só o nome: o identificador mora na ficha. */}
                        <button
                          type="button"
                          onClick={() => openTask(task.id)}
                          className="app-md block max-w-full truncate text-left hover:underline"
                          style={{ color: "var(--texto)" }}
                          title={task.readableId ? `${task.readableId} · ${task.title}` : task.title}
                        >
                          {task.title}
                        </button>
                      </td>
                      <td className="hidden max-w-[18ch] truncate @3xl:table-cell">
                        {profile.counterpart(state, task)}
                      </td>
                      <td
                        className="hidden max-w-[14ch] truncate @6xl:table-cell"
                        style={{ color: "var(--texto-3)" }}
                      >
                        {textoDe(task, CP.fields.empresa) || "—"}
                      </td>
                      <td
                        className="app-numero whitespace-nowrap"
                        style={{
                          color: vencida
                            ? "var(--erro)"
                            : proxima
                              ? "var(--aviso)"
                              : "var(--texto)",
                          fontWeight: vencida ? 500 : undefined,
                        }}
                      >
                        {task.dueDate ? fmt.taskDate(task.dueDate) : "—"}
                      </td>
                      <td
                        className="app-numero whitespace-nowrap text-right"
                        style={{ color: "var(--texto)" }}
                      >
                        {fmt.money({ amount: valorDe(task), currency: "BRL" })}
                      </td>
                      <td className="hidden @7xl:table-cell">
                        <span
                          className="app-sm inline-flex items-center gap-1"
                          style={{ color: "var(--texto-3)" }}
                          title={PRIORITY_LABEL[task.priority]}
                        >
                          <Icone
                            de={prioridade.icone}
                            tamanho="xs"
                            style={{ color: prioridade.cor }}
                          />
                          {PRIORITY_LABEL[task.priority]}
                        </span>
                      </td>
                      <td className="hidden @5xl:table-cell">
                        {membro ? (
                          <span
                            className="inline-flex items-center gap-1.5"
                            style={{ color: "var(--texto)" }}
                          >
                            <ActorAvatar
                              kind="member"
                              name={membro.displayName}
                              {...(membro.photoFileId
                                ? { photoFileId: membro.photoFileId }
                                : {})}
                            />
                            <span className="max-w-[12ch] truncate">
                              {membro.displayName}
                            </span>
                          </span>
                        ) : (
                          <span style={{ color: "var(--texto-4)" }}>—</span>
                        )}
                      </td>
                      <td>
                        <StatusBadge definition={definition} grupo={grupo} />
                      </td>
                      <td style={{ paddingInline: "var(--e-1)" }}>
                        <span className="flex items-center justify-end gap-0.5">
                          {/* As ações rápidas têm o seu lugar na linha (à esquerda do "…") e só se
                              mostram no hover/foco — nunca por cima do Status. Onde a largura não
                              cabe (abaixo de @5xl), ficam só no menu. */}
                          <span className="invisible hidden items-center gap-0.5 group-focus-within:visible group-hover:visible @5xl:flex">
                            <QuickAction
                              label="Abrir detalhes"
                              onClick={() => openTask(task.id)}
                              icone={ExternalLink}
                            />
                            <QuickAction
                              label={acao1.label}
                              onClick={() =>
                                setConfirmando({
                                  taskId: task.id,
                                  statusId: acao1.statusId,
                                  label: acao1.label,
                                })
                              }
                              icone={Check}
                              {...(podeAutorizar
                                ? { disabledReason: podeAutorizar }
                                : {})}
                            />
                            <QuickAction
                              label={acao2.label}
                              onClick={() =>
                                setConfirmando({
                                  taskId: task.id,
                                  statusId: acao2.statusId,
                                  label: acao2.label,
                                })
                              }
                              icone={CheckCircle2}
                              {...(podePagar
                                ? { disabledReason: podePagar }
                                : {})}
                            />
                          </span>
                          <ActionMenu
                            label={`Mais opções de ${task.title}`}
                            items={[
                              {
                                label: "Abrir detalhes",
                                onSelect: () => openTask(task.id),
                              },
                              {
                                label: "Editar conta (página completa)",
                                onSelect: () =>
                                  router.push(`/estrutura/tarefas/${task.id}`),
                              },
                              {
                                label: acao1.label,
                                onSelect: () =>
                                  setConfirmando({
                                    taskId: task.id,
                                    statusId: acao1.statusId,
                                    label: acao1.label,
                                  }),
                                ...(podeAutorizar
                                  ? { disabledReason: podeAutorizar }
                                  : {}),
                              },
                              {
                                label: acao2.label,
                                onSelect: () =>
                                  setConfirmando({
                                    taskId: task.id,
                                    statusId: acao2.statusId,
                                    label: acao2.label,
                                  }),
                                ...(podePagar
                                  ? { disabledReason: podePagar }
                                  : {}),
                              },
                              ...definitions
                                .filter(
                                  (d) =>
                                    d.id !== task.statusId &&
                                    d.id !== acao1.statusId &&
                                    d.id !== acao2.statusId,
                                )
                                .map((d) => {
                                  const motivo = escreve
                                    ? statusOptionRefusal(
                                        state,
                                        memberId,
                                        task,
                                        d.id,
                                      )
                                    : "Você não altera esta conta.";
                                  return {
                                    label: `Mover para “${d.name}”`,
                                    onSelect: () =>
                                      setConfirmando({
                                        taskId: task.id,
                                        statusId: d.id,
                                        label: `Mover para “${d.name}”`,
                                      }),
                                    ...(motivo
                                      ? { disabledReason: motivo }
                                      : {}),
                                  };
                                }),
                            ]}
                          />
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          );
        })}
      </table>
      {tasks.length === 0 ? (
        <EmptyState
          compact
          title="Nenhuma conta passa pelos filtros."
          hint="Limpe-os para ver todas."
        />
      ) : null}
    </div>
  );
}

/* ───────────────────────────── Cartões (mobile) ───────────────────────────── */

export function FinanceCards({
  state,
  profile,
  tasks,
  openTask,
}: {
  readonly state: DataState;
  readonly profile: FinanceProfile;
  readonly tasks: readonly Task[];
  readonly openTask: (taskId: string) => void;
}) {
  const fmt = useFormat();
  const recente = useRecente();
  const now = new Date();
  const config = tasks[0] ? effectiveListConfig(state, tasks[0].listId) : null;
  if (tasks.length === 0)
    return <EmptyState compact title="Nenhuma conta passa pelos filtros." />;
  return (
    <ul className="cascata pilha-solta">
      {tasks.map((task) => {
        const grupo = profile.groupOf(state, task, now);
        return (
          <li key={task.id} className="min-w-0">
            <button
              type="button"
              onClick={() => openTask(task.id)}
              className="item-solto w-full text-left"
              data-recente={task.id === recente ? "true" : undefined}
              data-bloco="true"
            >
              <span className="flex items-baseline justify-between gap-2">
                <span
                  className="app-md min-w-0 truncate"
                  style={{ color: "var(--texto)" }}
                >
                  {task.title}
                </span>
                <span
                  className="app-md app-numero shrink-0"
                  style={{ color: "var(--texto)" }}
                >
                  {fmt.money({ amount: valorDe(task), currency: "BRL" })}
                </span>
              </span>
              <span className="app-meta mt-0.5 block truncate">
                <span className="app-numero">
                  {task.dueDate ? fmt.taskDate(task.dueDate) : "sem vencimento"}
                </span>{" "}
                · {profile.counterpart(state, task)}
              </span>
              <span className="mt-2 block">
                <StatusBadge
                  definition={config?.statusSet.definitions.find(
                    (d) => d.id === task.statusId,
                  )}
                  grupo={grupo}
                />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
