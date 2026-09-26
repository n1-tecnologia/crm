"use client";

/**
 * O EDITOR DE AUTOMAÇÃO (19) — a ficha e o construtor numa tela só, no molde
 * do construtor de Flow: cabeçalho com estado, Versão e [Publicar vN]; as
 * faixas que dizem por que a tela é só leitura ou por que o motor deste
 * protótipo não a executa; e três abas. O Editor tem três colunas — Gatilho,
 * Condições, Ações — com o bloco selecionado na URL (`?bloco=&indice=`), e
 * abaixo a Validação ao vivo (com "ir" até o problema), a Política de erro e
 * os Atributos. Execuções e Versões são as outras duas abas.
 *
 * Só o rascunho é editável (INV-AUT-02): sem rascunho, a tela mostra a
 * vigente em leitura e oferece "criar rascunho a partir dela". Tudo que o
 * tipo admite aparece; o que o protótipo executa de verdade carrega a
 * Pilula (D5).
 */

import Link from "next/link";
import { useState } from "react";
import { Plus, Workflow } from "lucide-react";
import type { DataState } from "@n1/dominio/state";
import { useData, useRun, useSession } from "@/dados/store";
import {
  CONTROLES,
  eventosDoEscopo,
  adicionarAcao,
  adicionarCondicao,
  arquivarAutomacao,
  criarRascunhoDaAutomacao,
  definirGatilho,
  definirPoliticaDeErro,
  descartarRascunhoDaAutomacao,
  duplicarAutomacao,
  editarAcao,
  editarAutomacao,
  editarCondicao,
  enviarAutomacaoALixeira,
  moverAcao,
  pausarAutomacao,
  recusaDeAdministrarAutomacao,
  recusaDeConvidado,
  recusaDeRestaurarAutomacao,
  removerAcao,
  removerCondicao,
  restoreAutomation,
  retomarAutomacao,
  validarAutomacao,
  type BlocoDoEditor,
  type ControleDeAcao,
  type ProblemaDeAutomacao,
} from "@n1/dominio/operations";
import { inoperante, rascunhoDaAutomacao, versaoVigenteDaAutomacao } from "@n1/dominio/derive-ia";
import type { Automation, AutomationAction, AutomationCondition, AutomationExecution, AutomationScopeType, AutomationTrigger, AutomationVersion, AutonomyLevel, Id, TriggerKind } from "@n1/dominio/types";
import { useAgir, useAvisos, type Report } from "@/features/shell/ficha";
import { AUTONOMY_LABEL, EFFECT_CLASS_LABEL, EXECUTION_STATE_LABEL, EXECUTION_STEP_KIND_LABEL, OBJECT_TYPE_LABEL, TRIGGER_KIND_LABEL } from "@/features/shell/format";
import { marcarSeMuda, useNavegar } from "@/features/shell/navegacao";
import { marcarChegada, useRecente } from "@/features/shell/recente";
import { useFormat } from "@/features/shell/use-format";
import { Abas, ActionMenu, Button, CabecalhoDePainel, ConditionMarker, ConfirmDialog, CorpoDeTela, EmptyState, Field, Icone, PageHeader, Painel, Pilula, RecordPanel, RecordRow, Select, SetaDeOrdem, StateSeal, TextInput, Toggle, type TomPilula } from "@/features/shell/ui";
import { useParametros } from "@/features/ferramentas/url";
import { CLASSE_DE_EFEITO_TOM, EXECUTA_LABEL, LEGADO_LABEL, NAO_EXECUTA_LABEL, VERSAO_LABEL, VERSAO_TOM } from "../rotulos";
import {
  SPEC_DA_CONDICAO,
  SPEC_DO_GATILHO,
  TIPO_DE_CONDICAO_LABEL,
  acaoDoValor,
  condicaoDoValor,
  executaAcao,
  executaCondicao,
  executaGatilho,
  faltamNoBloco,
  ferramentaDepreciada,
  gatilhoDoValor,
  nomeDaAcao,
  resumoDaAcao,
  resumoDaCondicao,
  resumoDoGatilho,
  specDaAcao,
  tipoDaAcao,
  valorDaAcao,
  valorDaCondicao,
  valorDoGatilho,
  type TipoDeAcao,
  type TipoDeCondicao,
  type ValorDoBloco,
} from "./automacao-spec";
import { BlocoForm } from "./bloco-form";
import { PublicarAutomacaoDialog } from "./publicar-automacao-dialog";

type Aba = "editor" | "execucoes" | "versoes";

const ABAS: ReadonlyArray<{ readonly chave: Aba; readonly rotulo: string }> = [
  { chave: "editor", rotulo: "Editor" },
  { chave: "execucoes", rotulo: "Execuções" },
  { chave: "versoes", rotulo: "Versões" },
];

const TIPOS_DE_GATILHO: readonly TriggerKind[] = ["evento", "agendamento", "manual", "condicaoTemporal"];
const TIPOS_DE_CONDICAO: readonly TipoDeCondicao[] = ["atributo", "valorDeCampo", "pertencimento", "temporal", "hibrida"];

const TOM_DA_EXECUCAO: Record<string, TomPilula> = {
  pendente: "neutro",
  executando: "info",
  aguardandoAprovacao: "aviso",
  concluida: "sucesso",
  falhou: "erro",
  cancelada: "neutro",
};

const TOM_DO_PASSO: Record<string, TomPilula> = {
  concluido: "sucesso",
  falhou: "erro",
  negada: "erro",
  pulado: "neutro",
  aguardando: "aviso",
  cancelado: "neutro",
  simulado: "info",
};

/** A rota do contêiner do escopo, quando ele tem página própria; o Espaço de Trabalho não tem. */
function rotaDoEscopo(scopeType: AutomationScopeType, scopeId: Id): string | undefined {
  switch (scopeType) {
    case "space":
      return `/estrutura/espacos/${scopeId}`;
    case "folder":
      return `/estrutura/pastas/${scopeId}`;
    case "list":
      return `/estrutura/listas/${scopeId}`;
    case "funnel":
      return `/crm/funis/${scopeId}`;
    case "inbox":
      return "/crm/caixa-de-entrada";
    case "queue":
      return `/crm/caixa-de-entrada/configuracoes/filas/${scopeId}`;
    case "grupo":
      return `/ferramentas/grupos/${scopeId}`;
    case "comunidade":
      return `/ferramentas/comunidades/${scopeId}`;
    case "flow":
      return `/ferramentas/flows/${scopeId}`;
    default:
      return undefined;
  }
}

const ESCOPOS_QUE_EXECUTAM: ReadonlySet<AutomationScopeType> = new Set(["list", "grupo", "comunidade", "flow", "workspace"]);

/** Algum Gatilho deste tipo dispara neste escopo? Por Evento, basta um Evento do escopo que os motores escutem. */
const tipoDeGatilhoExecuta = (scopeType: AutomationScopeType, kind: TriggerKind): boolean =>
  kind === "evento" ? eventosDoEscopo(scopeType).some((e) => executaGatilho(scopeType, { kind, eventType: e.id })) : executaGatilho(scopeType, { kind });

const contagem = (n: number, singular: string, plural: string): string => `${n} ${n === 1 ? singular : plural}`;

const PilulaExecuta = ({ executa }: { readonly executa: boolean }) => <Pilula tom={executa ? "sucesso" : "neutro"}>{executa ? EXECUTA_LABEL : NAO_EXECUTA_LABEL}</Pilula>;

const Faixa = ({ tom, children }: { readonly tom: "aviso" | "info"; readonly children: string }) => (
  <p className="app-base shrink-0 px-4 py-2" style={{ background: tom === "aviso" ? "var(--aviso-lavado)" : "var(--info-lavado)", color: tom === "aviso" ? "var(--aviso)" : "var(--info)", borderBottom: "1px solid var(--linha)" }}>
    {children}
  </p>
);

/** A migalha: "Automação" é a seção-mãe em Personalizar e leva a ela. */
function Trilha() {
  const href = "/ia/personalizar/automacao";
  return (
    <span>
      Personalizar ›{" "}
      <Link href={href} onNavigate={() => marcarSeMuda(href)} className="hover:underline">
        Automação
      </Link>
    </span>
  );
}

interface Selecao {
  readonly bloco: BlocoDoEditor | null;
  readonly indice: string | null;
}

export function EditorDeAutomacao({ automationId }: { readonly automationId: string }) {
  const state = useData((data) => data);
  const { memberId } = useSession();
  const { get, set } = useParametros();
  const run = useRun();
  const { avisos, report } = useAvisos();
  const agir = useAgir(report);
  const [navegar] = useNavegar();
  const recente = useRecente();
  const [dialogo, setDialogo] = useState<"publicar" | "descartar" | "arquivar" | "lixeira" | null>(null);
  // O último bloco criado nesta tela, para a peça nova `surgir` com o realce.
  const [recem, setRecem] = useState<{ readonly bloco: "condicoes" | "acoes"; readonly indice: number } | null>(null);

  const automation = state.automations.find((a) => a.id === automationId);
  if (!automation) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader path={<Trilha />} icon={<Icone de={Workflow} tamanho="sm" />} title="Automação" />
        <CorpoDeTela>
          <EmptyState title="Automação não encontrada." hint="Ela pode ter sido eliminada, ou você não tem permissão para vê-la." />
        </CorpoDeTela>
      </div>
    );
  }

  const rascunho = rascunhoDaAutomacao(automation);
  const vigente = versaoVigenteDaAutomacao(automation);
  const versao: AutomationVersion | undefined = rascunho ?? vigente ?? [...automation.versions].sort((a, b) => b.number - a.number)[0];
  if (!versao) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader path={<Trilha />} icon={<Icone de={Workflow} tamanho="sm" />} title={automation.name} />
        <CorpoDeTela>
          <EmptyState title="A Automação não tem Versão." />
        </CorpoDeTela>
      </div>
    );
  }

  const abaAtual = (get("aba") as Aba | null) ?? "editor";
  const aba: Aba = ABAS.some((a) => a.chave === abaAtual) ? abaAtual : "editor";
  const selecao: Selecao = { bloco: get("bloco") as BlocoDoEditor | null, indice: get("indice") };
  const selecionar = (bloco: BlocoDoEditor | null, indice?: number | "nova") => set({ bloco, indice: indice === undefined ? null : String(indice) });

  const foraDeUso = automation.lifecycle === "arquivado" || automation.lifecycle === "naLixeira";
  const recusaEditar = foraDeUso ? "Restaure a Automação antes de editar." : recusaDeAdministrarAutomacao(state, memberId, automation, "editar");
  const recusaPausar = recusaDeAdministrarAutomacao(state, memberId, automation, "pausar");
  const recusaArquivar = recusaDeAdministrarAutomacao(state, memberId, automation, "arquivar");
  // Restaurar: `administrar` e o nome livre no escopo (RN-AUT-03) — a frase que `restoreAutomation` diria.
  const recusaRestaurar = recusaDeRestaurarAutomacao(state, memberId, automation);
  const recusaCriar = recusaDeConvidado(state, memberId, "cria Automação");
  const editavel = rascunho !== undefined && recusaEditar === undefined;
  const motivoLeitura = recusaEditar ?? (rascunho ? undefined : `Sem rascunho: só a Versão em rascunho é editável. Crie um a partir da v${versao.number}.`);
  const problemas = validarAutomacao(state, automation, versao);
  const recusaPublicar =
    recusaDeAdministrarAutomacao(state, memberId, automation, "publicar") ??
    (!rascunho ? "Não há rascunho para publicar." : problemas.length > 0 ? `${contagem(problemas.length, "problema", "problemas")} de validação (RN-AUT-07).` : undefined);
  const motivoInoperante = inoperante(state, automation);
  // A faixa "não executa" só quando há o que dizer: um Gatilho que os motores não escutam, ou um escopo que nenhum motor alcança.
  const naoExecuta = versao.trigger ? !executaGatilho(automation.scopeType, versao.trigger) : !ESCOPOS_QUE_EXECUTAM.has(automation.scopeType);
  const hibrida = versao.conditions.some((c) => c.kind === "hibrida");
  const proprietario = state.members.find((m) => m.id === automation.ownerMemberId);
  const rotuloDoEscopo = OBJECT_TYPE_LABEL[automation.scopeType] ?? automation.scopeType;
  const nomeDoEscopo = nomeDoRegistro(state, automation.scopeType, automation.scopeId);
  const hrefDoEscopo = rotaDoEscopo(automation.scopeType, automation.scopeId);
  const execucoes = [...state.automationExecutions.filter((e) => e.automationId === automation.id)].sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));

  const itensDoMenu = [
    automation.lifecycle === "pausado"
      ? { label: "Retomar", onSelect: () => agir((data, me) => retomarAutomacao(data, me, automation.id), "Automação retomada."), ...(recusaPausar ? { disabledReason: recusaPausar } : {}) }
      : {
          label: "Pausar",
          onSelect: () => agir((data, me) => pausarAutomacao(data, me, automation.id), "Automação pausada: o Gatilho deixa de disparar."),
          ...(recusaPausar ? { disabledReason: recusaPausar } : automation.lifecycle !== "ativo" ? { disabledReason: "Só uma Automação ativa é pausada." } : {}),
        },
    {
      label: "Duplicar",
      onSelect: () => {
        // A cópia abre no ato: o Toast de sucesso é da ficha de chegada; só a recusa fica aqui.
        const r = run((data, me) => duplicarAutomacao(data, me, automation.id));
        if (!r.ok) {
          report(r, "");
          return;
        }
        const href = `/ia/automacoes/${r.value.id}`;
        marcarChegada(href, `Automação “${automation.name}” duplicada em rascunho.`);
        navegar(href);
      },
      ...(recusaCriar ? { disabledReason: recusaCriar } : {}),
    },
    rascunho
      ? {
          label: "Descartar rascunho",
          destructive: true,
          onSelect: () => setDialogo("descartar" as const),
          ...(recusaEditar ? { disabledReason: recusaEditar } : automation.versions.length === 1 ? { disabledReason: "É a única Versão: descartá-la deixaria a Automação vazia (INV-AUT-02)." } : {}),
        }
      : {
          label: `Criar rascunho a partir da v${versao.number}`,
          onSelect: () => agir((data, me) => criarRascunhoDaAutomacao(data, me, automation.id), `Rascunho criado a partir da v${versao.number}.`),
          ...(recusaEditar ? { disabledReason: recusaEditar } : {}),
        },
    foraDeUso
      ? { label: "Restaurar", onSelect: () => agir((data, me) => restoreAutomation(data, me, automation.id), "Automação restaurada. Volta pausada quando estava ativa (B94)."), ...(recusaRestaurar ? { disabledReason: recusaRestaurar } : {}) }
      : { label: "Arquivar", onSelect: () => setDialogo("arquivar" as const), ...(recusaArquivar ? { disabledReason: recusaArquivar } : {}) },
    ...(automation.lifecycle === "naLixeira"
      ? []
      : [{ label: "Enviar à lixeira", destructive: true, onSelect: () => setDialogo("lixeira" as const), ...(recusaArquivar ? { disabledReason: recusaArquivar } : {}) }]),
  ];

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        path={<Trilha />}
        icon={<Icone de={Workflow} tamanho="sm" />}
        title={automation.name}
        seal={
          <>
            <StateSeal state={automation.lifecycle} />
            <Pilula tom={VERSAO_TOM[versao.state]}>
              v{versao.number} · {VERSAO_LABEL[versao.state]}
            </Pilula>
          </>
        }
        actions={
          <>
            <Button variant="primary" size="sm" onClick={() => setDialogo("publicar")} disabled={recusaPublicar !== undefined} {...(recusaPublicar ? { disabledReason: recusaPublicar } : {})}>
              Publicar v{rascunho?.number ?? versao.number}
            </Button>
            <ActionMenu items={itensDoMenu} />
          </>
        }
        details={
          <>
            <span className="app-meta flex items-center gap-1.5">
              <Pilula tom="neutro">{rotuloDoEscopo}</Pilula>
              {hrefDoEscopo ? (
                <Link href={hrefDoEscopo} onNavigate={() => marcarSeMuda(hrefDoEscopo)} className="hover:underline" style={{ color: "var(--texto)" }}>
                  {nomeDoEscopo}
                </Link>
              ) : (
                <span style={{ color: "var(--texto)" }}>{nomeDoEscopo}</span>
              )}
            </span>
            <span className="app-meta">· Proprietário: {proprietario?.displayName ?? "—"}</span>
            <span className="app-meta">· {hibrida ? "híbrida" : "determinística"}</span>
            {vigente ? <span className="app-meta">· vigente v{vigente.number}</span> : <span className="app-meta">· nunca publicada</span>}
            {motivoInoperante ? <ConditionMarker tone="warning">inoperante: {motivoInoperante}</ConditionMarker> : null}
          </>
        }
      />

      {motivoLeitura ? <Faixa tom="aviso">{motivoLeitura}</Faixa> : null}
      {naoExecuta ? (
        <Faixa tom="info">Esta Automação publica e fica registrada, mas o motor deste protótipo só executa escopo Lista (Tarefa criada, entrou em Status, vencimento) e Ativos de Canal (Grupo, Flow).</Faixa>
      ) : null}

      <Abas rotulo="Seções da Automação" abas={ABAS.map((a) => ({ chave: a.chave, rotulo: a.rotulo, ...(a.chave === "execucoes" && execucoes.length > 0 ? { contador: execucoes.length } : {}) }))} ativa={aba} aoTrocar={(chave) => set({ aba: chave === "editor" ? null : chave })} />

      <div className="px-4 pt-2">{avisos}</div>

      <CorpoDeTela>
        <div key={aba} className="aparecer">
          {aba === "editor" ? (
            <div className="grid gap-3">
              <div className="grid gap-3 xl:grid-cols-3 xl:items-start">
                <PainelDoGatilho automation={automation} versao={versao} editavel={editavel} motivoLeitura={motivoLeitura} aberto={selecao.bloco === "gatilho"} onAbrir={() => selecionar("gatilho")} onFechar={() => selecionar(null)} report={report} />
                <PainelDeCondicoes
                  automation={automation}
                  versao={versao}
                  editavel={editavel}
                  motivoLeitura={motivoLeitura}
                  selecao={selecao}
                  selecionar={selecionar}
                  report={report}
                  recente={recente === automation.id && recem?.bloco === "condicoes" ? recem.indice : null}
                  aoCriar={(indice) => setRecem({ bloco: "condicoes", indice })}
                />
                <PainelDeAcoes
                  automation={automation}
                  versao={versao}
                  editavel={editavel}
                  motivoLeitura={motivoLeitura}
                  selecao={selecao}
                  selecionar={selecionar}
                  report={report}
                  recente={recente === automation.id && recem?.bloco === "acoes" ? recem.indice : null}
                  aoCriar={(indice) => setRecem({ bloco: "acoes", indice })}
                />
              </div>
              <div className="grid gap-3 xl:grid-cols-3 xl:items-start">
                <PainelDeValidacao problemas={problemas} versao={versao} rascunho={rascunho} selecionar={selecionar} recusaPublicar={recusaPublicar} onPublicar={() => setDialogo("publicar")} />
                <PainelDePolitica automation={automation} versao={versao} editavel={editavel} motivoLeitura={motivoLeitura} report={report} />
                <PainelDeAtributos automation={automation} recusaEditar={recusaEditar} rotuloDoEscopo={rotuloDoEscopo} nomeDoEscopo={nomeDoEscopo} hrefDoEscopo={hrefDoEscopo} report={report} />
              </div>
            </div>
          ) : aba === "execucoes" ? (
            <AbaExecucoes execucoes={execucoes} />
          ) : (
            <AbaVersoes automation={automation} rascunho={rascunho} vigente={vigente} recusaEditar={recusaEditar} recusaPublicar={recusaPublicar} onPublicar={() => setDialogo("publicar")} onDescartar={() => setDialogo("descartar")} report={report} />
          )}
        </div>
      </CorpoDeTela>

      {dialogo === "publicar" && rascunho ? <PublicarAutomacaoDialog automation={automation} rascunho={rascunho} vigente={vigente} problemas={problemas} onClose={() => setDialogo(null)} report={report} /> : null}
      <ConfirmDialog
        open={dialogo === "descartar"}
        title={`Descartar o rascunho v${rascunho?.number ?? ""}?`}
        description="O que foi editado desde a última publicação se perde. Para editar de novo, crie um rascunho a partir da Versão vigente (INV-AUT-02)."
        confirmLabel="Descartar"
        destructive
        onConfirm={() => {
          setDialogo(null);
          selecionar(null);
          agir((data, me) => descartarRascunhoDaAutomacao(data, me, automation.id), "Rascunho descartado.");
        }}
        onCancel={() => setDialogo(null)}
      />
      <ConfirmDialog
        open={dialogo === "arquivar"}
        title={`Arquivar “${automation.name}”?`}
        description="O Gatilho deixa de disparar e as Execuções em curso são canceladas. Restaurar devolve a Automação pausada, nunca ativa (B94)."
        confirmLabel="Arquivar"
        onConfirm={() => {
          setDialogo(null);
          agir((data, me) => arquivarAutomacao(data, me, automation.id), "Automação arquivada.");
        }}
        onCancel={() => setDialogo(null)}
      />
      <ConfirmDialog
        open={dialogo === "lixeira"}
        title={`Enviar “${automation.name}” à lixeira?`}
        description="As Execuções em curso são canceladas. Da lixeira ela volta pausada; a eliminação definitiva é da lixeira."
        confirmLabel="Enviar à lixeira"
        destructive
        onConfirm={() => {
          setDialogo(null);
          agir((data, me) => enviarAutomacaoALixeira(data, me, automation.id), "Automação enviada à lixeira.");
        }}
        onCancel={() => setDialogo(null)}
      />
    </div>
  );
}

/** O nome do registro que é o escopo; o Espaço de Trabalho é o próprio. */
function nomeDoRegistro(state: DataState, scopeType: AutomationScopeType, scopeId: Id): string {
  switch (scopeType) {
    case "workspace":
      return state.workspace.name;
    case "space":
      return state.spaces.find((s) => s.id === scopeId)?.name ?? scopeId;
    case "folder":
      return state.folders.find((f) => f.id === scopeId)?.name ?? scopeId;
    case "list":
      return state.lists.find((l) => l.id === scopeId)?.name ?? scopeId;
    case "funnel":
      return state.funnels.find((f) => f.id === scopeId)?.name ?? scopeId;
    case "inbox":
      return "Caixa de Entrada";
    case "queue":
      return state.queues.find((q) => q.id === scopeId)?.name ?? scopeId;
    case "grupo":
      return state.grupos.find((g) => g.id === scopeId)?.nome ?? scopeId;
    case "comunidade":
      return state.comunidades.find((c) => c.id === scopeId)?.nome ?? scopeId;
    case "flow":
      return state.flows.find((f) => f.id === scopeId)?.nome ?? scopeId;
  }
}

// ── Gatilho ────────────────────────────────────────────────────────────────

function PainelDoGatilho({
  automation,
  versao,
  editavel,
  motivoLeitura,
  aberto,
  onAbrir,
  onFechar,
  report,
}: {
  readonly automation: Automation;
  readonly versao: AutomationVersion;
  readonly editavel: boolean;
  readonly motivoLeitura: string | undefined;
  readonly aberto: boolean;
  readonly onAbrir: () => void;
  readonly onFechar: () => void;
  readonly report: Report;
}) {
  const trigger = versao.trigger;
  const executa = executaGatilho(automation.scopeType, trigger);
  return (
    <Painel className="min-w-0">
      <CabecalhoDePainel titulo="Gatilho" acao={trigger ? <PilulaExecuta executa={executa} /> : undefined} />
      <div className="grid gap-3 p-3">
        {editavel && (aberto || !trigger) ? (
          <FormularioDoGatilho key={`${trigger?.kind ?? ""}-${String(aberto)}`} automation={automation} trigger={trigger} onFechar={onFechar} report={report} />
        ) : trigger ? (
          <div className="item-solto" data-bloco="true" data-estatico="true">
            <div className="flex flex-wrap items-center gap-2">
              <Pilula tom="acento">{TRIGGER_KIND_LABEL[trigger.kind] ?? trigger.kind}</Pilula>
              <span className="app-base min-w-0 flex-1" style={{ color: "var(--texto)" }}>
                {resumoDoGatilho(trigger)}
              </span>
            </div>
            <p className="app-meta mt-1">{SPEC_DO_GATILHO[trigger.kind].descricao}</p>
            <div className="mt-2">
              <Button size="sm" variant="ghost" onClick={onAbrir} disabled={!editavel} {...(motivoLeitura ? { disabledReason: motivoLeitura } : {})}>
                Editar
              </Button>
            </div>
          </div>
        ) : (
          <EmptyState compact title="Escolha um Gatilho para começar." hint={motivoLeitura ?? "Exatamente um por Versão (INV-AUT-03)."} />
        )}
      </div>
    </Painel>
  );
}

function FormularioDoGatilho({ automation, trigger, onFechar, report }: { readonly automation: Automation; readonly trigger: AutomationTrigger | undefined; readonly onFechar: () => void; readonly report: Report }) {
  const run = useRun();
  const [tipo, setTipo] = useState<TriggerKind | "">(trigger?.kind ?? "");
  const [valor, setValor] = useState<ValorDoBloco>(() => valorDoGatilho(trigger));
  const [erro, setErro] = useState<string | null>(null);
  const spec = tipo ? SPEC_DO_GATILHO[tipo] : undefined;
  const faltam = spec ? faltamNoBloco(spec, valor) : [];
  const motivo = !tipo ? "Escolha o tipo do Gatilho." : faltam.length > 0 ? `Preencha: ${faltam.join(", ")}.` : undefined;
  const gravar = () => {
    if (!tipo) return;
    const r = run((data, me) => definirGatilho(data, me, automation.id, gatilhoDoValor(tipo, valor)));
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    report(r, "Gatilho gravado.");
    onFechar();
  };
  return (
    <div className="grid gap-3">
      {!trigger ? <p className="app-base" style={{ color: "var(--texto)" }}>Escolha um Gatilho para começar.</p> : null}
      <Field label="Tipo" required hint="Trocar o tipo limpa o que foi preenchido.">
        {(id) => (
          <Select
            id={id}
            value={tipo}
            onChange={(v) => {
              setTipo(v as TriggerKind | "");
              // Trocar o tipo limpa: o Evento não vale para um agendamento.
              setValor({});
            }}
            placeholder="Escolher o tipo"
            options={TIPOS_DE_GATILHO.map((t) => ({ value: t, label: TRIGGER_KIND_LABEL[t] ?? t, detail: tipoDeGatilhoExecuta(automation.scopeType, t) ? EXECUTA_LABEL : NAO_EXECUTA_LABEL }))}
          />
        )}
      </Field>
      {spec && tipo ? <BlocoForm spec={spec} valor={valor} onChange={setValor} scopeType={automation.scopeType} scopeId={automation.scopeId} /> : null}
      {erro ? (
        <p role="alert" className="app-base" style={{ color: "var(--erro)" }}>
          {erro}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {trigger ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              const r = run((data, me) => definirGatilho(data, me, automation.id, null));
              report(r, "Gatilho removido.");
              if (r.ok) onFechar();
            }}
          >
            Remover Gatilho
          </Button>
        ) : null}
        {trigger ? (
          <Button size="sm" variant="ghost" onClick={onFechar}>
            Cancelar
          </Button>
        ) : null}
        <Button size="sm" variant="primary" onClick={gravar} disabled={motivo !== undefined} {...(motivo ? { disabledReason: motivo } : {})}>
          Gravar
        </Button>
      </div>
    </div>
  );
}

// ── Condições ──────────────────────────────────────────────────────────────

function PainelDeCondicoes({
  automation,
  versao,
  editavel,
  motivoLeitura,
  selecao,
  selecionar,
  report,
  recente,
  aoCriar,
}: {
  readonly automation: Automation;
  readonly versao: AutomationVersion;
  readonly editavel: boolean;
  readonly motivoLeitura: string | undefined;
  readonly selecao: Selecao;
  readonly selecionar: (bloco: BlocoDoEditor | null, indice?: number | "nova") => void;
  readonly report: Report;
  readonly recente: number | null;
  readonly aoCriar: (indice: number) => void;
}) {
  const state = useData((data) => data);
  const run = useRun();
  const aberto = editavel && selecao.bloco === "condicoes";
  const indiceAberto = aberto ? (selecao.indice === "nova" ? "nova" : Number(selecao.indice)) : null;
  const emEdicao = typeof indiceAberto === "number" ? versao.conditions[indiceAberto] : undefined;
  return (
    <Painel className="min-w-0">
      <CabecalhoDePainel
        titulo="Condições"
        contagem={versao.conditions.length}
        acao={
          <Button size="sm" variant="ghost" icon={<Icone de={Plus} tamanho="xs" />} onClick={() => selecionar("condicoes", "nova")} disabled={!editavel} {...(motivoLeitura ? { disabledReason: motivoLeitura } : {})}>
            Adicionar Condição
          </Button>
        }
      />
      {/* As listas levam `min-w-0`: item de grade com filhos `truncate` — sem ele o min-content da lista é o texto inteiro e a coluna estoura a tela. */}
      <div className="grid gap-3 p-3">
        {versao.conditions.length === 0 ? (
          <EmptyState compact title="Sem Condições: sempre." hint="As Ações rodam a cada disparo do Gatilho." />
        ) : (
          <ul className="pilha-solta cascata min-w-0">
            {versao.conditions.map((c, i) => {
              const nova = recente === i;
              return (
                <li key={i} className={nova ? "item-solto surgir" : "item-solto"} data-bloco="true" data-estatico="true" data-destacado={indiceAberto === i ? "true" : undefined} data-recente={nova || undefined}>
                  <div className="flex items-center gap-2">
                    <span className="app-meta app-numero w-4 shrink-0">{i + 1}</span>
                    <span className="app-base min-w-0 flex-1 truncate" style={{ color: "var(--texto)" }} title={resumoDaCondicao(state, c)}>
                      {resumoDaCondicao(state, c)}
                    </span>
                    {editavel ? (
                      <ActionMenu
                        items={[
                          { label: "Editar", onSelect: () => selecionar("condicoes", i) },
                          {
                            label: "Remover",
                            destructive: true,
                            onSelect: () => {
                              if (indiceAberto === i) selecionar(null);
                              report(run((data, me) => removerCondicao(data, me, automation.id, i)), "Condição removida.");
                            },
                          },
                        ]}
                      />
                    ) : null}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 pl-6">
                    <Pilula tom="acento">{TIPO_DE_CONDICAO_LABEL[c.kind]}</Pilula>
                    <PilulaExecuta executa={executaCondicao(automation.scopeType, c)} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {aberto && indiceAberto !== null && (indiceAberto === "nova" || emEdicao) ? (
          <FormularioDeCondicao
            key={String(indiceAberto)}
            automation={automation}
            indice={indiceAberto}
            condicao={emEdicao}
            onFechar={() => selecionar(null)}
            onCriada={aoCriar}
            report={report}
          />
        ) : null}
      </div>
    </Painel>
  );
}

function FormularioDeCondicao({
  automation,
  indice,
  condicao,
  onFechar,
  onCriada,
  report,
}: {
  readonly automation: Automation;
  readonly indice: number | "nova";
  readonly condicao: AutomationCondition | undefined;
  readonly onFechar: () => void;
  readonly onCriada: (indice: number) => void;
  readonly report: Report;
}) {
  const run = useRun();
  const [kind, setKind] = useState<TipoDeCondicao>(condicao?.kind ?? "atributo");
  const [valor, setValor] = useState<ValorDoBloco>(() => (condicao ? valorDaCondicao(condicao) : {}));
  const [erro, setErro] = useState<string | null>(null);
  const spec = SPEC_DA_CONDICAO[kind];
  const faltam = faltamNoBloco(spec, valor);
  const motivo = faltam.length > 0 ? `Preencha: ${faltam.join(", ")}.` : undefined;
  const gravar = () => {
    const nova = condicaoDoValor(kind, valor);
    const r = run((data, me) => (indice === "nova" ? adicionarCondicao(data, me, automation.id, nova) : editarCondicao(data, me, automation.id, indice, nova)));
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    report(r, indice === "nova" ? "Condição adicionada." : "Condição alterada.");
    if (indice === "nova") onCriada(r.value.conditions.length - 1);
    onFechar();
  };
  return (
    <div className="painel-solido grid gap-3 p-3">
      <span className="app-md" style={{ color: "var(--texto)" }}>
        {indice === "nova" ? "Nova Condição" : `${indice + 1}ª Condição`}
      </span>
      <Field label="Tipo" required>
        {(id) => (
          <Select
            id={id}
            value={kind}
            onChange={(v) => {
              setKind(v as TipoDeCondicao);
              setValor({});
            }}
            options={TIPOS_DE_CONDICAO.map((k) => ({ value: k, label: TIPO_DE_CONDICAO_LABEL[k], detail: executaCondicao(automation.scopeType, { kind: k }) ? EXECUTA_LABEL : NAO_EXECUTA_LABEL }))}
          />
        )}
      </Field>
      <BlocoForm spec={spec} valor={valor} onChange={setValor} scopeType={automation.scopeType} scopeId={automation.scopeId} />
      {erro ? (
        <p role="alert" className="app-base" style={{ color: "var(--erro)" }}>
          {erro}
        </p>
      ) : null}
      <div className="flex items-center justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onFechar}>
          Cancelar
        </Button>
        <Button size="sm" variant="primary" onClick={gravar} disabled={motivo !== undefined} {...(motivo ? { disabledReason: motivo } : {})}>
          Gravar
        </Button>
      </div>
    </div>
  );
}

// ── Ações ──────────────────────────────────────────────────────────────────

function PainelDeAcoes({
  automation,
  versao,
  editavel,
  motivoLeitura,
  selecao,
  selecionar,
  report,
  recente,
  aoCriar,
}: {
  readonly automation: Automation;
  readonly versao: AutomationVersion;
  readonly editavel: boolean;
  readonly motivoLeitura: string | undefined;
  readonly selecao: Selecao;
  readonly selecionar: (bloco: BlocoDoEditor | null, indice?: number | "nova") => void;
  readonly report: Report;
  readonly recente: number | null;
  readonly aoCriar: (indice: number) => void;
}) {
  const state = useData((data) => data);
  const run = useRun();
  const acoes = [...versao.actions].sort((a, b) => a.order - b.order);
  const aberto = editavel && selecao.bloco === "acoes";
  const orderAberta = aberto ? (selecao.indice === "nova" ? "nova" : Number(selecao.indice)) : null;
  const emEdicao = typeof orderAberta === "number" ? acoes.find((a) => a.order === orderAberta) : undefined;
  return (
    <Painel className="min-w-0">
      <CabecalhoDePainel
        titulo="Ações"
        contagem={acoes.length}
        acao={
          <Button size="sm" variant="ghost" icon={<Icone de={Plus} tamanho="xs" />} onClick={() => selecionar("acoes", "nova")} disabled={!editavel} {...(motivoLeitura ? { disabledReason: motivoLeitura } : {})}>
            Adicionar Ação
          </Button>
        }
      />
      <div className="grid gap-3 p-3">
        {acoes.length === 0 ? (
          <EmptyState compact title="Sem Ações." hint="Publicar exige ao menos uma Ação (RN-AUT-07)." />
        ) : (
          <ol className="pilha-solta cascata min-w-0">
            {acoes.map((a, i) => {
              const nova = recente === a.order;
              const tool = a.kind === "escrita" ? state.tools.find((t) => t.id === a.toolId) : undefined;
              return (
                <li key={a.order} className={nova ? "item-solto surgir" : "item-solto"} data-bloco="true" data-estatico="true" data-destacado={orderAberta === a.order ? "true" : undefined} data-recente={nova || undefined}>
                  <div className="flex items-center gap-2">
                    <span className="app-meta app-numero w-4 shrink-0">{i + 1}</span>
                    <span className="app-base min-w-0 flex-1 truncate" style={{ color: "var(--texto)" }} title={nomeDaAcao(state, a)}>
                      {nomeDaAcao(state, a)}
                    </span>
                    {editavel ? (
                      <span className="flex shrink-0 items-center">
                        {/* `moverAcao` renumera 0..n-1 antes de procurar: a posição na lista ordenada é a `order` que ele lê (seeds vêm 1..n). */}
                        <SetaDeOrdem direcao="subir" motivo={i === 0 ? "Já é a primeira." : undefined} onClick={() => report(run((data, me) => moverAcao(data, me, automation.id, i, "subir")), "Ação movida.")} />
                        <SetaDeOrdem direcao="descer" motivo={i === acoes.length - 1 ? "Já é a última." : undefined} onClick={() => report(run((data, me) => moverAcao(data, me, automation.id, i, "descer")), "Ação movida.")} />
                        <ActionMenu
                          items={[
                            { label: "Editar", onSelect: () => selecionar("acoes", a.order) },
                            {
                              label: "Remover",
                              destructive: true,
                              onSelect: () => {
                                if (orderAberta === a.order) selecionar(null);
                                report(run((data, me) => removerAcao(data, me, automation.id, a.order)), "Ação removida.");
                              },
                            },
                          ]}
                        />
                      </span>
                    ) : null}
                  </div>
                  <p className="app-meta mt-0.5 truncate pl-6" title={resumoDaAcao(state, a)}>
                    {resumoDaAcao(state, a)}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 pl-6">
                    <Pilula tom={a.kind === "escrita" ? "info" : "acento"}>{a.kind}</Pilula>
                    {tool ? <Pilula tom={CLASSE_DE_EFEITO_TOM[tool.effectClass]}>{EFFECT_CLASS_LABEL[tool.effectClass] ?? tool.effectClass}</Pilula> : null}
                    {a.kind === "escrita" && !tool ? <ConditionMarker tone="danger">fora do Catálogo</ConditionMarker> : null}
                    {a.kind === "escrita" && ferramentaDepreciada(a.toolId) ? <Pilula tom="aviso">{LEGADO_LABEL}</Pilula> : null}
                    <PilulaExecuta executa={executaAcao(automation.scopeType, a)} />
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        {aberto && orderAberta !== null && (orderAberta === "nova" || emEdicao) ? (
          <FormularioDeAcao key={String(orderAberta)} automation={automation} order={orderAberta} posicao={emEdicao ? acoes.indexOf(emEdicao) + 1 : acoes.length + 1} acao={emEdicao} onFechar={() => selecionar(null)} onCriada={aoCriar} report={report} />
        ) : null}
      </div>
    </Painel>
  );
}

function FormularioDeAcao({
  automation,
  order,
  posicao,
  acao,
  onFechar,
  onCriada,
  report,
}: {
  readonly automation: Automation;
  readonly order: number | "nova";
  /** A posição na lista ordenada (1..n) — `order` dos seeds pode vir 1..n, e o título não é a `order`. */
  readonly posicao: number;
  readonly acao: AutomationAction | undefined;
  readonly onFechar: () => void;
  readonly onCriada: (order: number) => void;
  readonly report: Report;
}) {
  const state = useData((data) => data);
  const run = useRun();
  const tipoInicial = acao ? tipoDaAcao(acao) : undefined;
  const [origem, setOrigem] = useState<"ferramenta" | "controle">(tipoInicial?.kind === "controle" ? "controle" : "ferramenta");
  const [toolId, setToolId] = useState(tipoInicial?.kind === "escrita" ? tipoInicial.toolId : "");
  const [controlKind, setControlKind] = useState<ControleDeAcao | "">(tipoInicial?.kind === "controle" ? tipoInicial.controlKind : "");
  const [valor, setValor] = useState<ValorDoBloco>(() => (acao ? valorDaAcao(state, acao) : {}));
  const [erro, setErro] = useState<string | null>(null);

  const tipo: TipoDeAcao | undefined = origem === "ferramenta" ? (toolId ? { kind: "escrita", toolId } : undefined) : controlKind ? { kind: "controle", controlKind } : undefined;
  const spec = tipo ? specDaAcao(state, tipo) : undefined;
  const faltam = spec ? faltamNoBloco(spec, valor) : [];
  const motivo = !tipo ? (origem === "ferramenta" ? "Escolha a Ferramenta." : "Escolha o controle.") : faltam.length > 0 ? `Preencha: ${faltam.join(", ")}.` : undefined;

  // Plataforma antes, Integração depois: o Select não agrupa, então a ordem e o detalhe fazem o papel do grupo.
  // As Ferramentas legadas (com equivalente executável) não entram numa Ação nova; a Ação que já as usa continua a vê-la, marcada (D5).
  const ferramentas = [...state.tools]
    .filter((t) => t.effectClass !== "leitura" && (!ferramentaDepreciada(t.id) || t.id === acao?.toolId))
    .sort((a, b) => (a.origin === b.origin ? a.name.localeCompare(b.name, "pt-BR") : a.origin === "plataforma" ? -1 : 1))
    .map((t) => {
      const integracao = t.origin === "integracao" ? state.integrations.find((i) => i.id === t.integrationId) : undefined;
      const executa = executaAcao(automation.scopeType, { kind: "escrita", toolId: t.id });
      return {
        value: t.id,
        label: t.name,
        detail: `${ferramentaDepreciada(t.id) ? `${LEGADO_LABEL} · ` : ""}${integracao ? `Integração ${integracao.name} · ` : "plataforma · "}${EFFECT_CLASS_LABEL[t.effectClass] ?? t.effectClass} · ${executa ? EXECUTA_LABEL : NAO_EXECUTA_LABEL}`,
      };
    });

  const gravar = () => {
    if (!tipo) return;
    const nova = acaoDoValor(state, tipo, valor);
    const r = run((data, me) => (order === "nova" ? adicionarAcao(data, me, automation.id, nova) : editarAcao(data, me, automation.id, order, nova)));
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    report(r, order === "nova" ? "Ação adicionada." : "Ação alterada.");
    if (order === "nova") onCriada(Math.max(0, ...r.value.actions.map((a) => a.order)));
    onFechar();
  };

  return (
    <div className="painel-solido grid gap-3 p-3">
      <span className="app-md" style={{ color: "var(--texto)" }}>
        {order === "nova" ? "Nova Ação" : `${posicao}ª Ação`}
      </span>
      <div className="grid gap-3">
        <Field label="Tipo" required hint="Uma escrita é sempre Ferramenta do Catálogo; um controle nunca é (B91).">
          {(id) => (
            <Select
              id={id}
              value={origem}
              onChange={(v) => {
                setOrigem(v as "ferramenta" | "controle");
                setValor({});
              }}
              options={[
                { value: "ferramenta", label: "Ferramenta do Catálogo" },
                { value: "controle", label: "Controle" },
              ]}
            />
          )}
        </Field>
        {origem === "ferramenta" ? (
          <Field label="Ferramenta" required>
            {(id) => (
              <Select
                id={id}
                value={toolId}
                onChange={(v) => {
                  setToolId(v);
                  setValor({});
                }}
                placeholder="Escolher a Ferramenta"
                searchable
                options={ferramentas}
              />
            )}
          </Field>
        ) : (
          <Field label="Controle" required>
            {(id) => (
              <Select
                id={id}
                value={controlKind}
                onChange={(v) => {
                  setControlKind(v as ControleDeAcao | "");
                  setValor({});
                }}
                placeholder="Escolher o controle"
                options={CONTROLES.map((c) => ({ value: c.id, label: c.rotulo, detail: executaAcao(automation.scopeType, { kind: "controle", controlKind: c.id }) ? EXECUTA_LABEL : NAO_EXECUTA_LABEL }))}
              />
            )}
          </Field>
        )}
      </div>
      {spec && tipo ? <BlocoForm key={origem === "ferramenta" ? toolId : controlKind} spec={spec} valor={valor} onChange={setValor} scopeType={automation.scopeType} scopeId={automation.scopeId} /> : null}
      {erro ? (
        <p role="alert" className="app-base" style={{ color: "var(--erro)" }}>
          {erro}
        </p>
      ) : null}
      <div className="flex items-center justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onFechar}>
          Cancelar
        </Button>
        <Button size="sm" variant="primary" onClick={gravar} disabled={motivo !== undefined} {...(motivo ? { disabledReason: motivo } : {})}>
          Gravar
        </Button>
      </div>
    </div>
  );
}

// ── Validação, Política, Atributos ─────────────────────────────────────────

function PainelDeValidacao({
  problemas,
  versao,
  rascunho,
  selecionar,
  recusaPublicar,
  onPublicar,
}: {
  readonly problemas: readonly ProblemaDeAutomacao[];
  readonly versao: AutomationVersion;
  readonly rascunho: AutomationVersion | undefined;
  readonly selecionar: (bloco: BlocoDoEditor | null, indice?: number | "nova") => void;
  readonly recusaPublicar: string | undefined;
  readonly onPublicar: () => void;
}) {
  const irAte = (p: ProblemaDeAutomacao) => {
    if (p.bloco === "gatilho") selecionar("gatilho");
    else if (p.bloco === "condicoes") selecionar("condicoes", p.indice ?? "nova");
    else if (p.bloco === "acoes") selecionar("acoes", p.indice ?? "nova");
  };
  return (
    <RecordPanel title="Validação" count={problemas.length}>
      {problemas.length === 0 ? (
        <p className="app-sm" style={{ color: "var(--sucesso)" }}>
          Nenhum problema. A Versão pode ser publicada.
        </p>
      ) : (
        <ol className="grid gap-2">
          {problemas.map((p, i) => (
            <li key={i} className="app-sm flex items-start gap-2" style={{ color: "var(--texto-2)" }}>
              <ConditionMarker tone="danger">{p.regra}</ConditionMarker>
              <span className="min-w-0 flex-1">{p.mensagem}</span>
              {p.bloco !== "politica" && rascunho ? (
                <button type="button" className="app-sm shrink-0 underline" style={{ color: "var(--acento)" }} onClick={() => irAte(p)}>
                  ir
                </button>
              ) : null}
            </li>
          ))}
        </ol>
      )}
      <div className="mt-3">
        <Button variant="primary" full onClick={onPublicar} disabled={recusaPublicar !== undefined} {...(recusaPublicar ? { disabledReason: recusaPublicar } : {})}>
          Publicar v{rascunho?.number ?? versao.number}
        </Button>
      </div>
    </RecordPanel>
  );
}

const RETENTATIVAS = ["0", "1", "2", "3"] as const;
const NIVEIS: readonly AutonomyLevel[] = ["assistido", "supervisionado", "autonomo"];

function PainelDePolitica({ automation, versao, editavel, motivoLeitura, report }: { readonly automation: Automation; readonly versao: AutomationVersion; readonly editavel: boolean; readonly motivoLeitura: string | undefined; readonly report: Report }) {
  const run = useRun();
  const gravar = (patch: { readonly onActionFailure?: AutomationVersion["errorPolicy"]["onActionFailure"]; readonly retries?: number; readonly maxAutonomy?: AutonomyLevel | null }) =>
    report(
      run((data, me) =>
        definirPoliticaDeErro(data, me, automation.id, {
          onActionFailure: patch.onActionFailure ?? versao.errorPolicy.onActionFailure,
          retries: patch.retries ?? versao.errorPolicy.retries,
          ...(patch.maxAutonomy !== undefined ? { maxAutonomy: patch.maxAutonomy } : {}),
        }),
      ),
      "Política de erro gravada.",
    );
  const bloqueio = editavel ? {} : { disabled: true, disabledReason: motivoLeitura ?? "Só o rascunho é editável." };
  return (
    <RecordPanel title="Política de erro">
      <div className="grid gap-3">
        <Field label="Se uma Ação falhar" hint="Interromper para a Execução na Ação que falhou; continuar segue para a próxima.">
          {(id) => (
            <Select
              id={id}
              value={versao.errorPolicy.onActionFailure}
              onChange={(v) => gravar({ onActionFailure: v as AutomationVersion["errorPolicy"]["onActionFailure"] })}
              options={[
                { value: "interromper", label: "interromper" },
                { value: "continuar", label: "continuar" },
              ]}
              {...bloqueio}
            />
          )}
        </Field>
        <Field label="Retentativas" hint="Só de Ferramenta de Integração, de 0 a 3 (RN-AUT-14).">
          {(id) => <Select id={id} value={String(versao.errorPolicy.retries)} onChange={(v) => gravar({ retries: Number(v) })} options={RETENTATIVAS.map((r) => ({ value: r, label: r }))} {...bloqueio} />}
        </Field>
        <Field label="Autonomia máxima" hint="Teto imposto aos Agentes invocados por esta Automação (RN-AUT-25).">
          {(id) => (
            <Select
              id={id}
              value={versao.maxAutonomy ?? ""}
              onChange={(v) => gravar({ maxAutonomy: v ? (v as AutonomyLevel) : null })}
              placeholder="Sem teto"
              options={[{ value: "", label: "Sem teto" }, ...NIVEIS.map((n) => ({ value: n, label: AUTONOMY_LABEL[n] ?? n }))]}
              {...bloqueio}
            />
          )}
        </Field>
      </div>
    </RecordPanel>
  );
}

function PainelDeAtributos({
  automation,
  recusaEditar,
  rotuloDoEscopo,
  nomeDoEscopo,
  hrefDoEscopo,
  report,
}: {
  readonly automation: Automation;
  readonly recusaEditar: string | undefined;
  readonly rotuloDoEscopo: string;
  readonly nomeDoEscopo: string;
  readonly hrefDoEscopo: string | undefined;
  readonly report: Report;
}) {
  const state = useData((data) => data);
  const run = useRun();
  const fmt = useFormat();
  const editavel = recusaEditar === undefined;
  const gravar = (patch: Parameters<typeof editarAutomacao>[3], mensagem: string) => report(run((data, me) => editarAutomacao(data, me, automation.id, patch)), mensagem);
  const proprietario = state.members.find((m) => m.id === automation.ownerMemberId)?.displayName ?? "—";
  const criador = automation.createdBy.kind === "member" ? (state.members.find((m) => m.id === automation.createdBy.id)?.displayName ?? "—") : automation.createdBy.kind;
  return (
    <RecordPanel title="Atributos">
      <div className="grid gap-3">
        {/* Nome e Descrição gravam ao sair do campo; sem permissão, o campo diz por quê (§11). */}
        <Field label="Nome" required>
          {(id) => <CampoQueGrava id={id} valor={automation.name} onSave={(v) => gravar({ name: v }, "Automação renomeada.")} {...(recusaEditar ? { motivo: recusaEditar } : {})} />}
        </Field>
        <Field label="Descrição">
          {(id) => <CampoQueGrava id={id} valor={automation.description} onSave={(v) => gravar({ description: v }, "Descrição alterada.")} placeholder="Para que serve" {...(recusaEditar ? { motivo: recusaEditar } : {})} />}
        </Field>
        <dl>
          <RecordRow label="Escopo">
            <span className="inline-flex max-w-full items-center gap-1.5" title="O escopo é fixado na criação e nunca muda (RN-AUT-02).">
              <Pilula tom="neutro">{rotuloDoEscopo}</Pilula>
              {hrefDoEscopo ? (
                <Link href={hrefDoEscopo} onNavigate={() => marcarSeMuda(hrefDoEscopo)} className="min-w-0 truncate hover:underline">
                  {nomeDoEscopo}
                </Link>
              ) : (
                <span className="min-w-0 truncate">{nomeDoEscopo}</span>
              )}
            </span>
          </RecordRow>
          <RecordRow label="Proprietário">
            <span title="Transferir a propriedade fica fora deste protótipo.">{proprietario}</span>
          </RecordRow>
          <RecordRow label="Criada">
            {criador} · {fmt.instant(automation.createdAt)}
          </RecordRow>
        </dl>
        <div className="flex items-start gap-3" title={recusaEditar}>
          <Toggle checked={automation.reactsToAutomationEvents} onChange={(v) => gravar({ reactsToAutomationEvents: v }, v ? "Passa a reagir a Eventos de outras Automações." : "Deixa de reagir a Eventos de Automações.")} labelledBy="aut-reage" disabled={!editavel} />
          <span className="min-w-0">
            <span id="aut-reage" className="app-base block" style={{ color: "var(--texto)" }}>
              Reage a Eventos de Automações
            </span>
            <span className="app-meta block">{automation.reactsToAutomationEvents ? "Reage; nunca aos próprios Eventos (INV-AUT-08)." : "Só a Eventos de Membros e Agentes (DO-AUT-11)."}</span>
          </span>
        </div>
      </div>
    </RecordPanel>
  );
}

/** Um campo de uma linha que grava ao sair (Enter ou blur) e, desligado, diz por quê. */
function CampoQueGrava({ id, valor, onSave, placeholder, motivo }: { readonly id: string; readonly valor: string; readonly onSave: (valor: string) => void; readonly placeholder?: string; readonly motivo?: string }) {
  const [texto, setTexto] = useState(valor);
  const gravarSeMudou = () => {
    if (texto.trim() !== valor.trim()) onSave(texto);
  };
  return (
    <span
      className="block"
      onBlur={gravarSeMudou}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          gravarSeMudou();
        }
      }}
    >
      <TextInput id={id} value={texto} onChange={setTexto} {...(placeholder ? { placeholder } : {})} disabled={motivo !== undefined} {...(motivo ? { disabledReason: motivo } : {})} />
    </span>
  );
}

// ── Execuções ──────────────────────────────────────────────────────────────

function AbaExecucoes({ execucoes }: { readonly execucoes: readonly AutomationExecution[] }) {
  const fmt = useFormat();
  if (execucoes.length === 0) {
    return <EmptyState title="Nenhuma Execução ainda." hint="Uma Execução nasce quando o Gatilho desta Automação acontece com a Versão publicada." />;
  }
  return (
    <ul className="pilha-solta cascata">
      {execucoes.map((e) => {
        const href = `/ia/execucoes/${e.id}`;
        return (
          <li key={e.id}>
            <details className="item-solto" data-bloco="true">
              <summary className="flex cursor-pointer flex-wrap items-center gap-2">
                <span className="app-meta app-numero shrink-0">{fmt.instant(e.startedAt)}</span>
                <Pilula tom={TOM_DA_EXECUCAO[e.state] ?? "neutro"}>{EXECUTION_STATE_LABEL[e.state] ?? e.state}</Pilula>
                <span className="app-base min-w-0 flex-1 truncate" style={{ color: "var(--texto)" }}>
                  {e.objectName ? `${OBJECT_TYPE_LABEL[e.objectType ?? ""] ?? e.objectType ?? ""} “${e.objectName}”` : TRIGGER_KIND_LABEL[e.triggerKind] ?? e.triggerKind}
                </span>
                <span className="app-meta shrink-0">v{e.automationVersion}</span>
                <span className="app-meta app-numero shrink-0">{contagem(e.steps.length, "passo", "passos")}</span>
                <Link href={href} onNavigate={() => marcarSeMuda(href)} className="app-sm shrink-0 underline" style={{ color: "var(--acento)" }}>
                  Abrir
                </Link>
              </summary>
              <div className="mt-3 grid gap-2 pt-3" style={{ borderTop: "1px solid var(--linha)" }}>
                {e.terminationReason ? (
                  <p className="app-sm" style={{ color: e.state === "falhou" ? "var(--erro)" : "var(--texto-2)" }}>
                    {e.terminationReason}
                  </p>
                ) : null}
                {e.steps.length === 0 ? (
                  <p className="app-meta">Sem passos registrados.</p>
                ) : (
                  <ol className="grid gap-1.5">
                    {e.steps.map((s) => (
                      <li key={s.index} className="app-sm flex flex-wrap items-center gap-2" style={{ color: "var(--texto-2)" }}>
                        <span className="app-meta app-numero w-4 shrink-0">{s.index + 1}</span>
                        <span className="shrink-0">{EXECUTION_STEP_KIND_LABEL[s.kind] ?? s.kind}</span>
                        {s.toolId ? <span className="identificador">{s.toolId}</span> : null}
                        <Pilula tom={TOM_DO_PASSO[s.result] ?? "neutro"}>{s.result}</Pilula>
                        {s.output ? <span className="min-w-0 flex-1 truncate" title={s.output}>{s.output}</span> : null}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </details>
          </li>
        );
      })}
    </ul>
  );
}

// ── Versões ────────────────────────────────────────────────────────────────

function AbaVersoes({
  automation,
  rascunho,
  vigente,
  recusaEditar,
  recusaPublicar,
  onPublicar,
  onDescartar,
  report,
}: {
  readonly automation: Automation;
  readonly rascunho: AutomationVersion | undefined;
  readonly vigente: AutomationVersion | undefined;
  readonly recusaEditar: string | undefined;
  readonly recusaPublicar: string | undefined;
  readonly onPublicar: () => void;
  readonly onDescartar: () => void;
  readonly report: Report;
}) {
  const state = useData((data) => data);
  const run = useRun();
  const fmt = useFormat();
  const versoes = [...automation.versions].sort((a, b) => b.number - a.number);
  // O rascunho parte da vigente; sem vigente, da Versão de maior número (automacoes-editor `versaoDePartida`).
  const base = vigente ?? versoes[0];
  return (
    <Painel className="min-w-0 overflow-x-auto">
      <table className="tabela">
        <thead>
          <tr>
            <th className="app-coluna">Versão</th>
            <th className="app-coluna">Estado</th>
            <th className="app-coluna">Gatilho</th>
            <th className="app-coluna">Condições / Ações</th>
            <th className="app-coluna">Publicada por / em</th>
            <th className="app-coluna" data-vazia="true">
              <span className="sr-only">Ações</span>
            </th>
          </tr>
        </thead>
        <tbody className="cascata">
          {versoes.map((v) => {
            const publicador = v.publishedBy ? (state.members.find((m) => m.id === v.publishedBy)?.displayName ?? v.publishedBy) : undefined;
            return (
              <tr key={v.number}>
                <td className="app-numero">
                  <Pilula tom={VERSAO_TOM[v.state]}>v{v.number}</Pilula>
                </td>
                <td>{VERSAO_LABEL[v.state]}</td>
                <td>{resumoDoGatilho(v.trigger)}</td>
                <td className="app-numero">
                  {v.conditions.length} / {v.actions.length}
                </td>
                <td>{publicador && v.publishedAt ? `${publicador} · ${fmt.instant(v.publishedAt)}` : "—"}</td>
                <td>
                  <ActionMenu
                    items={
                      v.state === "rascunho"
                        ? [
                            { label: `Publicar v${v.number}`, onSelect: onPublicar, ...(recusaPublicar ? { disabledReason: recusaPublicar } : {}) },
                            {
                              label: "Descartar rascunho",
                              destructive: true,
                              onSelect: onDescartar,
                              ...(recusaEditar ? { disabledReason: recusaEditar } : automation.versions.length === 1 ? { disabledReason: "É a única Versão (INV-AUT-02)." } : {}),
                            },
                          ]
                        : [
                            {
                              label: "Criar rascunho a partir desta",
                              onSelect: () => report(run((data, me) => criarRascunhoDaAutomacao(data, me, automation.id)), `Rascunho criado a partir da v${v.number}.`),
                              ...(recusaEditar
                                ? { disabledReason: recusaEditar }
                                : rascunho
                                  ? { disabledReason: "A Automação já tem um rascunho (INV-AUT-02)." }
                                  : v !== base
                                    ? { disabledReason: `O rascunho parte da v${base?.number ?? "—"} (a vigente).` }
                                    : {}),
                            },
                          ]
                    }
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Painel>
  );
}
