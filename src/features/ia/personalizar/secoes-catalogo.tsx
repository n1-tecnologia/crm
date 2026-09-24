"use client";

/**
 * As seis seções de Personalizar, que são os INVENTÁRIOS das entidades de IA
 * (D2): cada uma mapeia os registros do Espaço de Trabalho para cartões com a
 * ação principal da seção, e um menu por cartão com o que o registro faz sem
 * abrir a ficha. As fichas continuam nas rotas de sempre — o cartão é a porta.
 *
 * Cada item desligado diz por quê com a frase do domínio (`permissoes-ia` e
 * as próprias operações): o menu recusa com as mesmas palavras que a
 * operação recusaria (D7). Os diálogos de criar/conceder são das seções
 * donas (Habilidades, Conhecimento, Automações, Agentes); daqui só se abrem.
 */

import { Bot, FileStack, Plug, Sparkles, Workflow, Wrench } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useData, useRun, useSession } from "@/data/store";
import {
  arquivarAgente,
  arquivarAutomacao,
  arquivarColecao,
  arquivarHabilidade,
  ativarAgente,
  criarRascunhoDaHabilidade,
  duplicarAutomacao,
  escopoExecutaNoPrototipo,
  motivoParaNaoAtivar,
  pausarAgente,
  pausarAutomacao,
  publicarVersaoDaHabilidade,
  recusaDeAdministrarAutomacao,
  recusaDeConvidado,
  recusaDeGovernarAgente,
  recusaDeGovernarHabilidade,
  recusaNaColecao,
  restaurarColecao,
  restaurarHabilidade,
  recusaDeRestaurarAgente,
  recusaDeRestaurarAutomacao,
  restoreAgent,
  restoreAutomation,
  retomarAutomacao,
} from "@/data/operations";
import {
  agentesGovernaveisPor,
  disponibilidadeDoAgente,
  efeitoDeclarado,
  inoperante,
  rascunhoDaHabilidade,
  versaoCorrenteDaHabilidade,
  versaoCorrenteDoAgente,
  versaoVigenteDaAutomacao,
} from "@/data/derive-ia";
import type { Id } from "@/data/types";
import { AUTONOMY_LABEL, EFFECT_CLASS_LABEL, LIFECYCLE_LABEL, RESOURCE_TYPE_LABEL, TRIGGER_KIND_LABEL } from "@/features/shell/format";
import { useAvisos } from "@/features/shell/ficha";
import { useNavegar } from "@/features/shell/navegacao";
import { marcarChegada, useRecente } from "@/features/shell/recente";
import { Button, ConfirmDialog, Icone } from "@/features/shell/ui";
import { PermitirFerramentaDialog } from "@/features/ia/agentes/permitir-ferramenta-dialog";
import { NovaAutomacaoDialog } from "@/features/ia/automacoes/nova-automacao-dialog";
import { AdicionarDocumentoDialog } from "@/features/ia/conhecimento/adicionar-documento-dialog";
import { ConcederColecaoDialog } from "@/features/ia/conhecimento/conceder-colecao-dialog";
import { NovaColecaoDialog } from "@/features/ia/conhecimento/nova-colecao-dialog";
import { ConcederHabilidadeDialog, recusaDeConcederAAlgumAgente } from "@/features/ia/habilidades/conceder-habilidade-dialog";
import { CopiarDaPlataformaDialog } from "@/features/ia/habilidades/copiar-da-plataforma-dialog";
import { NovaHabilidadeDialog } from "@/features/ia/habilidades/nova-habilidade-dialog";
import { useIntegracoesMenu } from "@/features/ia/integracoes/integracao-menu";
import { EFEITO_LABEL, EFEITO_TOM, EXECUTA_LABEL } from "@/features/ia/rotulos";
import { CatalogGrid, type CatalogCondition, type CatalogFact, type CatalogMenuItem } from "./catalog-grid";

// ── Peças partilhadas pelas seções ─────────────────────────────────────────

interface PedidoDeConfirmacao {
  readonly title: string;
  readonly description: string;
  readonly confirmLabel: string;
  readonly destructive?: boolean;
  readonly onConfirm: () => void;
}

/**
 * Um ConfirmDialog por seção, alimentado por `pedir`. O pedido fica guardado
 * ao fechar para o diálogo sair com o texto que entrou, e não vazio.
 */
function useConfirmacao(): { readonly pedir: (pedido: PedidoDeConfirmacao) => void; readonly dialogo: ReactNode } {
  const [pedido, setPedido] = useState<PedidoDeConfirmacao | null>(null);
  const [aberto, setAberto] = useState(false);
  const pedir = (novo: PedidoDeConfirmacao) => {
    setPedido(novo);
    setAberto(true);
  };
  const dialogo = (
    <ConfirmDialog
      open={aberto}
      title={pedido?.title ?? ""}
      description={pedido?.description ?? ""}
      confirmLabel={pedido?.confirmLabel ?? "Confirmar"}
      destructive={pedido?.destructive ?? false}
      onConfirm={() => {
        setAberto(false);
        pedido?.onConfirm();
      }}
      onCancel={() => setAberto(false)}
    />
  );
  return { pedir, dialogo };
}

/**
 * O alvo de um diálogo que nasce com um id fixo (a Habilidade deste cartão, a
 * Coleção deste cartão). O id sobrevive ao fechar, para a saída animar com o
 * conteúdo certo; a `key` do diálogo é o id, e a troca de alvo o remonta.
 */
function useAlvoDeDialogo(): { readonly alvo: Id | null; readonly aberto: boolean; readonly abrir: (id: Id) => void; readonly fechar: () => void } {
  const [alvo, setAlvo] = useState<Id | null>(null);
  const [aberto, setAberto] = useState(false);
  return {
    alvo,
    aberto,
    abrir: (id) => {
      setAlvo(id);
      setAberto(true);
    },
    fechar: () => setAberto(false),
  };
}

/** A primeira recusa que vale, na ordem em que a operação as verificaria. */
const semRecusa = (...razoes: readonly (string | undefined)[]): string | undefined => razoes.find((r) => r !== undefined);

/** Um item de menu que, desligado, diz por quê (§11) — sem `disabledReason: undefined` (exactOptionalPropertyTypes). */
const itemDeMenu = (label: string, onSelect: () => void, recusa: string | undefined, destructive = false): CatalogMenuItem => ({
  label,
  onSelect,
  ...(destructive ? { destructive: true } : {}),
  ...(recusa ? { disabledReason: recusa } : {}),
});

const plural = (n: number, singular: string, varios: string): string => (n === 1 ? `1 ${singular}` : `${n} ${varios}`);

function estado(lifecycle: string): CatalogFact {
  switch (lifecycle) {
    case "ativo":
      return { label: "ativa", tone: "ok" };
    case "rascunho":
      return { label: "rascunho", tone: "atencao" };
    case "pausado":
      return { label: "pausada", tone: "atencao" };
    case "arquivado":
      return { label: "arquivada", tone: "neutro" };
    default:
      return { label: lifecycle, tone: "neutro" };
  }
}

// ── Agentes ────────────────────────────────────────────────────────────────

/** O estado do Agente é masculino; o tom acompanha o de `estado()`. */
function estadoDoAgente(lifecycle: string): CatalogFact {
  return { label: LIFECYCLE_LABEL[lifecycle] ?? lifecycle, tone: estado(lifecycle).tone ?? "neutro" };
}

/**
 * O inventário de Agentes (D2): criar é no Construtor (`/ia/agentes`); o
 * menu do cartão governa o estado (12.1) e leva ao Construtor e ao ensaio.
 */
export function AgentesCatalogo() {
  const state = useData((data) => data);
  const run = useRun();
  const { memberId } = useSession();
  const { avisos, report } = useAvisos();
  const [navegar] = useNavegar();
  const recente = useRecente();
  const { pedir, dialogo } = useConfirmacao();

  const itens = state.agents
    .filter((a) => a.lifecycle !== "naLixeira")
    .map((agent) => {
      const versao = versaoCorrenteDoAgente(agent);
      const padrao = state.workspace.defaultAgentId === agent.id;
      const modelo =
        versao?.modelId === "padraoDaPlataforma"
          ? "Modelo padrão da plataforma"
          : (state.models.find((m) => m.id === versao?.modelId)?.name ?? "Modelo inexistente");
      const habilidades = state.skillGrants.filter((g) => g.agentId === agent.id).length;
      const ferramentas = versao?.allowedToolIds.length ?? 0;
      const dono = state.members.find((m) => m.id === agent.ownerMemberId)?.displayName ?? "—";
      // O estado já é o selo; sobram as condições que a ficha também marca (11.4).
      const disponibilidade = disponibilidadeDoAgente(state, agent);
      const condicoes: CatalogCondition[] = disponibilidade.disponivel
        ? []
        : disponibilidade.motivos.filter((m) => !m.startsWith("Agente ")).map((m) => ({ label: m, tone: "warning" as const, title: "Indisponível" }));

      const editar = recusaDeGovernarAgente(state, memberId, agent, "editar");
      const administrar = recusaDeGovernarAgente(state, memberId, agent, "administrar");
      const arquivado = agent.lifecycle === "arquivado";
      // As mesmas frases, na mesma ordem, das operações de `agentes.ts`.
      const menu: CatalogMenuItem[] = [
        itemDeMenu("Abrir no Construtor", () => navegar(`/ia/agentes?editar=${agent.id}`), semRecusa(editar, arquivado ? "Restaure o Agente antes de editar." : undefined)),
        agent.lifecycle === "ativo"
          ? itemDeMenu(
              "Pausar",
              () => report(run((data, me) => pausarAgente(data, me, agent.id)), `Agente “${agent.name}” pausado.`),
              semRecusa(administrar, padrao ? "O Assistente padrão nunca é pausado (INV-AGE-11)." : undefined),
            )
          : itemDeMenu(
              "Ativar",
              () => report(run((data, me) => ativarAgente(data, me, agent.id)), `Agente “${agent.name}” ativado.`),
              semRecusa(administrar, arquivado ? "Desarquive o Agente antes: ele volta a pausado (B94)." : undefined, motivoParaNaoAtivar(state, versao)),
            ),
        itemDeMenu(
          "Ensaiar",
          () => navegar(`/ia/agentes/${agent.id}?ensaiar=1`),
          semRecusa(
            editar,
            agent.lifecycle !== "rascunho" && agent.lifecycle !== "ativo" ? "Só um Agente em rascunho ou ativo ensaia (DO-AGE-13)." : undefined,
            versao && !versao.instructions.trim() ? "Escreva as instruções antes de ensaiar: sem elas o Agente não sabe o que fazer." : undefined,
          ),
        ),
        arquivado
          ? itemDeMenu("Desarquivar", () => report(run((data, me) => restoreAgent(data, me, agent.id)), `Agente “${agent.name}” desarquivado: volta a pausado (B94).`), recusaDeRestaurarAgente(state, memberId, agent))
          : itemDeMenu(
              "Arquivar…",
              () =>
                pedir({
                  title: `Arquivar “${agent.name}”?`,
                  description: "Tarefas e Conversas sob a responsabilidade do Agente são liberadas no ato (RN-AGE-20); Concessões, Memória e Execuções ficam. Desarquivar devolve o Agente a pausado (B94).",
                  confirmLabel: "Arquivar",
                  destructive: true,
                  onConfirm: () => report(run((data, me) => arquivarAgente(data, me, agent.id)), `Agente “${agent.name}” arquivado.`),
                }),
              semRecusa(administrar, padrao ? "O Assistente padrão não é arquivado (INV-AGE-11)." : undefined),
              true,
            ),
      ];

      return {
        id: agent.id,
        title: agent.name,
        description: agent.description,
        href: `/ia/agentes/${agent.id}`,
        icon: <Icone de={Bot} tamanho="md" />,
        badge: estadoDoAgente(agent.lifecycle),
        condicoes,
        facts: [
          ...(padrao ? [{ label: "Assistente padrão", tone: "acento" as const }] : []),
          ...(versao ? [{ label: `v${versao.number}`, tone: "acento" as const }, { label: AUTONOMY_LABEL[versao.autonomy] ?? versao.autonomy }] : []),
          { label: modelo },
          { label: plural(habilidades, "Habilidade", "Habilidades"), tone: habilidades > 0 ? ("ok" as const) : ("neutro" as const) },
          { label: plural(ferramentas, "Ferramenta", "Ferramentas") },
          { label: dono },
        ],
        menu,
        recente: agent.id === recente,
      };
    });

  const criar = recusaDeConvidado(state, memberId, "publica Agente");
  return (
    <>
      <CatalogGrid
        title="Agentes"
        items={itens}
        action={
          <Button variant="primary" size="sm" onClick={() => navegar("/ia/agentes")} disabled={criar !== undefined} {...(criar ? { disabledReason: criar } : {})}>
            Novo Agente
          </Button>
        }
        emptyTitle="Nenhum Agente."
        emptyHint="Crie o primeiro no Construtor: objetivo, instruções, Modelo e as Ferramentas que ele pode tentar."
      />
      {avisos}
      {dialogo}
    </>
  );
}

// ── Habilidades ────────────────────────────────────────────────────────────

/**
 * O inventário de Habilidades: criar do zero ou copiar uma da plataforma
 * (INV-HAB-07); o menu move o rascunho (RN-HAB-04), publica (RN-HAB-06),
 * concede a um Agente e arquiva.
 */
export function HabilidadesCatalogo() {
  const state = useData((data) => data);
  const run = useRun();
  const { memberId } = useSession();
  const { avisos, report } = useAvisos();
  const [navegar] = useNavegar();
  const recente = useRecente();
  const { pedir, dialogo } = useConfirmacao();
  const [criando, setCriando] = useState<"nova" | "copiar" | null>(null);
  const concessao = useAlvoDeDialogo();
  // Sem Agente ao alcance não há a quem conceder — a mesma recusa da ficha, antes de abrir o diálogo (§11).
  const semAgente = recusaDeConcederAAlgumAgente(state, memberId);

  const itens = state.skills
    .filter((s) => s.lifecycle !== "naLixeira")
    .map((skill) => {
      const corrente = versaoCorrenteDaHabilidade(skill);
      const rascunho = rascunhoDaHabilidade(skill);
      const concessoes = state.skillGrants.filter((g) => g.skillId === skill.id).length;
      const efeito = corrente ? efeitoDeclarado(state, corrente) : undefined;
      const editar = recusaDeGovernarHabilidade(state, memberId, skill, "editar");
      const administrar = recusaDeGovernarHabilidade(state, memberId, skill, "administrar");
      const ativa = skill.lifecycle === "ativo";

      const criarRascunho = semRecusa(
        editar,
        !ativa ? "Restaure a Habilidade antes de editar." : undefined,
        rascunho ? "A Habilidade já tem um rascunho: edite-o ou descarte-o (RN-HAB-04)." : undefined,
      );
      const publicar = semRecusa(administrar, !ativa ? "Restaure a Habilidade antes de publicar." : undefined, !rascunho ? "Não há rascunho para publicar." : undefined);
      const conceder = semRecusa(!ativa ? "Só uma Habilidade ativa é concedida." : undefined, semAgente);
      const arquivar = semRecusa(administrar, !ativa ? "Só uma Habilidade ativa é arquivada." : undefined);

      const menu: CatalogMenuItem[] = [
        itemDeMenu(
          corrente ? `Criar rascunho a partir da v${corrente.number}` : "Criar rascunho",
          () => report(run((data, me) => criarRascunhoDaHabilidade(data, me, skill.id)), `Rascunho de “${skill.name}” criado.`),
          criarRascunho,
        ),
        itemDeMenu(
          rascunho ? `Publicar rascunho v${rascunho.number}` : "Publicar rascunho",
          () => report(run((data, me) => publicarVersaoDaHabilidade(data, me, skill.id)), `Versão ${rascunho?.number ?? ""} de “${skill.name}” publicada.`),
          publicar,
        ),
        itemDeMenu("Conceder a um Agente…", () => concessao.abrir(skill.id), conceder),
        skill.lifecycle === "arquivado"
          ? itemDeMenu("Restaurar", () => report(run((data, me) => restaurarHabilidade(data, me, skill.id)), `Habilidade “${skill.name}” restaurada.`), administrar)
          : itemDeMenu(
              "Arquivar…",
              () =>
                pedir({
                  title: `Arquivar “${skill.name}”?`,
                  description: `${plural(concessoes, "Concessão fica indisponível", "Concessões ficam indisponíveis")}; exercícios em curso terminam com a Versão carregada (RN-HAB-14). O rascunho é preservado.`,
                  confirmLabel: "Arquivar",
                  destructive: true,
                  onConfirm: () => report(run((data, me) => arquivarHabilidade(data, me, skill.id)), `Habilidade “${skill.name}” arquivada.`),
                }),
              arquivar,
              true,
            ),
      ];

      return {
        id: skill.id,
        title: skill.name,
        description: skill.description,
        href: `/ia/habilidades/${skill.id}`,
        icon: <Icone de={Sparkles} tamanho="md" />,
        badge: corrente ? { label: `v${corrente.number}`, tone: "acento" as const } : { label: "sem versão publicada", tone: "atencao" as const },
        facts: [
          { label: skill.ownership === "plataforma" ? "da plataforma" : "do Espaço de Trabalho" },
          ...(efeito ? [{ label: EFEITO_LABEL[efeito], tone: EFEITO_TOM[efeito] }] : []),
          ...(rascunho ? [{ label: `rascunho v${rascunho.number}`, tone: "aviso" as const }] : []),
          { label: plural(concessoes, "Agente", "Agentes"), tone: concessoes > 0 ? ("ok" as const) : ("neutro" as const) },
          estado(skill.lifecycle),
        ],
        menu,
        recente: skill.id === recente,
      };
    });

  const criar = recusaDeConvidado(state, memberId, "cria Habilidade");
  // "Criar e abrir": o Toast é da ficha de chegada — um `report` aqui morreria com esta tela.
  const aoCriar = (message: string, skillId: Id) => {
    setCriando(null);
    const href = `/ia/habilidades/${skillId}`;
    marcarChegada(href, message);
    navegar(href);
  };
  return (
    <>
      <CatalogGrid
        title="Habilidades"
        items={itens}
        action={
          <>
            <Button variant="secondary" size="sm" onClick={() => setCriando("copiar")} disabled={criar !== undefined} {...(criar ? { disabledReason: criar } : {})}>
              Copiar da plataforma
            </Button>
            <Button variant="primary" size="sm" onClick={() => setCriando("nova")} disabled={criar !== undefined} {...(criar ? { disabledReason: criar } : {})}>
              Nova Habilidade
            </Button>
          </>
        }
        emptyTitle="Nenhuma Habilidade."
        emptyHint="As da plataforma nascem com o Espaço de Trabalho; crie a sua ou copie uma da plataforma para editar."
      />
      {avisos}
      {dialogo}
      <NovaHabilidadeDialog open={criando === "nova"} onClose={() => setCriando(null)} onDone={aoCriar} />
      <CopiarDaPlataformaDialog open={criando === "copiar"} onClose={() => setCriando(null)} onDone={aoCriar} />
      <ConcederHabilidadeDialog
        key={`concessao-${concessao.alvo ?? "nenhuma"}`}
        {...(concessao.alvo ? { skillId: concessao.alvo } : {})}
        open={concessao.aberto}
        onClose={concessao.fechar}
        onDone={(message) => {
          concessao.fechar();
          report({ ok: true }, message);
        }}
      />
    </>
  );
}

// ── Automação ──────────────────────────────────────────────────────────────

/**
 * O inventário de Automações: criar abre o editor; o menu pausa e retoma
 * (12.3), duplica (12.1) e arquiva. "Inoperante" não é estado gravado — é
 * condição lida a cada render (19, 11.1) — e "executa no protótipo" marca o
 * par (escopo, Gatilho) que os motores de fato rodam (D5).
 */
export function AutomacoesCatalogo() {
  const state = useData((data) => data);
  const run = useRun();
  const { memberId } = useSession();
  const { avisos, report } = useAvisos();
  const [navegar] = useNavegar();
  const recente = useRecente();
  const { pedir, dialogo } = useConfirmacao();
  const [criando, setCriando] = useState(false);

  const itens = state.automations
    .filter((a) => a.lifecycle !== "naLixeira")
    .map((automacao) => {
      const corrente = versaoVigenteDaAutomacao(automacao) ?? automacao.versions.at(-1);
      const gatilho = corrente?.trigger?.kind;
      const hibrida = automacao.versions.some((v) => v.conditions.some((c) => c.kind === "hibrida"));
      const execucoes = state.automationExecutions.filter((e) => e.automationId === automacao.id).length;
      const dono = state.members.find((m) => m.id === automacao.ownerMemberId)?.displayName ?? "—";
      const motivo = inoperante(state, automacao);
      const executa = escopoExecutaNoPrototipo(automacao.scopeType, corrente?.trigger);
      const pausar = recusaDeAdministrarAutomacao(state, memberId, automacao, "pausar");
      const arquivar = recusaDeAdministrarAutomacao(state, memberId, automacao, "arquivar");
      const duplicar = semRecusa(recusaDeConvidado(state, memberId, "cria Automação"), automacao.versions.length === 0 ? "A Automação de origem não tem Versão." : undefined);

      const menu: CatalogMenuItem[] = [
        itemDeMenu("Abrir editor", () => navegar(`/ia/automacoes/${automacao.id}`), undefined),
        automacao.lifecycle === "pausado"
          ? itemDeMenu("Retomar", () => report(run((data, me) => retomarAutomacao(data, me, automacao.id)), `Automação “${automacao.name}” retomada.`), pausar)
          : automacao.lifecycle === "arquivado"
            ? itemDeMenu("Restaurar", () => report(run((data, me) => restoreAutomation(data, me, automacao.id)), `Automação “${automacao.name}” restaurada: volta a pausada (RN-AUT-05).`), recusaDeRestaurarAutomacao(state, memberId, automacao))
            : itemDeMenu(
                "Pausar",
                () => report(run((data, me) => pausarAutomacao(data, me, automacao.id)), `Automação “${automacao.name}” pausada.`),
                semRecusa(pausar, automacao.lifecycle !== "ativo" ? "Só uma Automação ativa é pausada." : undefined),
              ),
        itemDeMenu("Duplicar", () => report(run((data, me) => duplicarAutomacao(data, me, automacao.id)), `Automação “${automacao.name}” duplicada em rascunho.`), duplicar),
        ...(automacao.lifecycle === "arquivado"
          ? []
          : [
              itemDeMenu(
                "Arquivar…",
                () =>
                  pedir({
                    title: `Arquivar “${automacao.name}”?`,
                    description: "Execuções em curso são canceladas; restaurar devolve a Automação a pausada (RN-AUT-05).",
                    confirmLabel: "Arquivar",
                    destructive: true,
                    onConfirm: () => report(run((data, me) => arquivarAutomacao(data, me, automacao.id)), `Automação “${automacao.name}” arquivada.`),
                  }),
                arquivar,
                true,
              ),
            ]),
      ];

      return {
        id: automacao.id,
        title: automacao.name,
        description: automacao.description,
        href: `/ia/automacoes/${automacao.id}`,
        icon: <Icone de={Workflow} tamanho="md" />,
        badge: estado(automacao.lifecycle),
        // O motivo inteiro ("referência inválida: Ferramenta “x” não existe…") não cabe numa pílula: a cabeça no rótulo, o resto no title.
        condicoes: motivo ? [{ label: `inoperante: ${motivo.split(": ")[0]}`, tone: "warning" as const, title: motivo }] : [],
        facts: [
          ...(gatilho ? [{ label: TRIGGER_KIND_LABEL[gatilho] ?? gatilho, tone: "acento" as const }] : []),
          { label: `escopo: ${RESOURCE_TYPE_LABEL[automacao.scopeType] ?? automacao.scopeType}` },
          { label: hibrida ? "híbrida" : "determinística" },
          ...(executa ? [{ label: EXECUTA_LABEL, tone: "info" as const }] : []),
          { label: plural(execucoes, "execução", "execuções") },
          { label: dono },
        ],
        menu,
        recente: automacao.id === recente,
      };
    });

  const criar = recusaDeConvidado(state, memberId, "cria Automação");
  return (
    <>
      <CatalogGrid
        title="Automação"
        items={itens}
        action={
          <Button variant="primary" size="sm" onClick={() => setCriando(true)} disabled={criar !== undefined} {...(criar ? { disabledReason: criar } : {})}>
            Nova Automação
          </Button>
        }
        emptyTitle="Nenhuma Automação."
        emptyHint="Uma Automação nasce dentro de um escopo: o Espaço de Trabalho, uma Lista, um Funil ou uma Fila."
      />
      {avisos}
      {dialogo}
      <NovaAutomacaoDialog
        open={criando}
        onClose={() => setCriando(false)}
        onDone={(message, automationId) => {
          setCriando(false);
          const href = `/ia/automacoes/${automationId}`;
          marcarChegada(href, message);
          navegar(href);
        }}
      />
    </>
  );
}

// ── Conhecimento ───────────────────────────────────────────────────────────

/**
 * O inventário de Coleções: criar nasce com a Fonte Envio manual (RN-CNH-04);
 * o menu adiciona Documento (criar na Coleção), dá acesso a um Agente
 * (administrar; a Concessão vive na Coleção, DO-CNH-12) e arquiva (12.5).
 */
export function ConhecimentoCatalogo() {
  const state = useData((data) => data);
  const run = useRun();
  const { memberId } = useSession();
  const { avisos, report } = useAvisos();
  const [navegar] = useNavegar();
  const recente = useRecente();
  const { pedir, dialogo } = useConfirmacao();
  const [criando, setCriando] = useState(false);
  const documento = useAlvoDeDialogo();
  const acesso = useAlvoDeDialogo();

  const itens = state.collections
    .filter((c) => c.lifecycle !== "naLixeira")
    .map((colecao) => {
      const documentos = state.documents.filter((d) => d.collectionId === colecao.id && d.lifecycle !== "naLixeira").length;
      const agentes = state.collectionGrants.filter((g) => g.collectionId === colecao.id).length;
      const dono = state.members.find((m) => m.id === colecao.ownerMemberId)?.displayName ?? "—";
      const ativa = colecao.lifecycle === "ativo";
      const administrar = recusaNaColecao(state, memberId, colecao, "administrar");
      const adicionar = semRecusa(recusaNaColecao(state, memberId, colecao, "criar"), !ativa ? "Restaure a Coleção antes." : undefined);

      const menu: CatalogMenuItem[] = [
        itemDeMenu("Adicionar Documento…", () => documento.abrir(colecao.id), adicionar),
        itemDeMenu("Dar acesso a um Agente…", () => acesso.abrir(colecao.id), semRecusa(administrar, !ativa ? "Restaure a Coleção antes." : undefined)),
        colecao.lifecycle === "arquivado"
          ? itemDeMenu("Restaurar", () => report(run((data, me) => restaurarColecao(data, me, colecao.id)), `Coleção “${colecao.name}” restaurada.`), administrar)
          : itemDeMenu(
              "Arquivar…",
              () =>
                pedir({
                  title: `Arquivar “${colecao.name}”?`,
                  description: "As Fontes são pausadas e os Agentes deixam de consultá-la no ato; as Concessões ficam gravadas (12.5).",
                  confirmLabel: "Arquivar",
                  destructive: true,
                  onConfirm: () => report(run((data, me) => arquivarColecao(data, me, colecao.id)), `Coleção “${colecao.name}” arquivada.`),
                }),
              semRecusa(administrar, !ativa ? "Só uma Coleção ativa é arquivada." : undefined),
              true,
            ),
      ];

      return {
        id: colecao.id,
        title: colecao.name,
        description: colecao.description,
        href: `/ia/conhecimento/${colecao.id}`,
        icon: <Icone de={FileStack} tamanho="md" />,
        ...(colecao.isPrivate ? { badge: { label: "privada", tone: "atencao" as const } } : {}),
        facts: [
          { label: plural(documentos, "documento", "documentos"), tone: documentos > 0 ? ("ok" as const) : ("neutro" as const) },
          { label: plural(colecao.sources.length, "fonte", "fontes") },
          { label: plural(agentes, "Agente com acesso", "Agentes com acesso"), tone: agentes > 0 ? ("ok" as const) : ("neutro" as const) },
          { label: dono },
          estado(colecao.lifecycle),
        ],
        menu,
        recente: colecao.id === recente,
      };
    });

  const criar = recusaDeConvidado(state, memberId, "cria Coleção");
  return (
    <>
      <CatalogGrid
        title="Conhecimento"
        items={itens}
        action={
          <Button variant="primary" size="sm" onClick={() => setCriando(true)} disabled={criar !== undefined} {...(criar ? { disabledReason: criar } : {})}>
            Nova Coleção
          </Button>
        }
        emptyTitle="Nenhuma Coleção."
        emptyHint="Crie uma Coleção e adicione documentos, URLs ou uma Integração como fonte."
      />
      {avisos}
      {dialogo}
      <NovaColecaoDialog
        open={criando}
        onClose={() => setCriando(false)}
        onDone={(message, colecaoId) => {
          setCriando(false);
          const href = `/ia/conhecimento/${colecaoId}`;
          marcarChegada(href, message);
          navegar(href);
        }}
      />
      <AdicionarDocumentoDialog
        key={`documento-${documento.alvo ?? "nenhuma"}`}
        {...(documento.alvo ? { colecaoId: documento.alvo } : {})}
        open={documento.aberto}
        onClose={documento.fechar}
        onDone={(message) => {
          documento.fechar();
          report({ ok: true }, message);
        }}
      />
      <ConcederColecaoDialog
        key={`acesso-${acesso.alvo ?? "nenhuma"}`}
        {...(acesso.alvo ? { colecaoId: acesso.alvo } : {})}
        open={acesso.aberto}
        onClose={acesso.fechar}
        onDone={(message) => {
          acesso.fechar();
          report({ ok: true }, message);
        }}
      />
    </>
  );
}

// ── Integrações (slug `conectores`, D3) ────────────────────────────────────

/** O inventário de Integrações: o menu conecta e desconecta (B35), espelhado em `/configuracoes/integracoes`. */
export function ConectoresCatalogo() {
  const state = useData((data) => data);
  const recente = useRecente();
  const { itensDe, dialogo } = useIntegracoesMenu();
  const itens = state.integrations.map((integracao) => {
    // A Integração declara o que expõe; a Ferramenta nem sempre aponta de volta.
    const ferramentas = new Set([
      ...integracao.exposedTools,
      ...state.tools.filter((t) => t.integrationId === integracao.id).map((t) => t.id),
    ]).size;
    const configurou = state.members.find((m) => m.id === integracao.configuredBy)?.displayName ?? "—";
    return {
      id: integracao.id,
      title: integracao.name,
      description: `Sistema ${integracao.systemType.toUpperCase()}, configurado por ${configurou}.`,
      href: "/configuracoes/integracoes",
      icon: <Icone de={Plug} tamanho="md" />,
      badge:
        integracao.state === "conectada"
          ? { label: "conectada", tone: "ok" as const }
          : integracao.state === "comErro"
            ? { label: "com erro", tone: "perigo" as const }
            : { label: "desconectada", tone: "atencao" as const },
      facts: [{ label: `expõe ${plural(ferramentas, "Ferramenta", "Ferramentas")}`, tone: "acento" as const }],
      menu: itensDe(integracao),
      recente: integracao.id === recente,
    };
  });
  return (
    <>
      <CatalogGrid
        title="Integrações"
        items={itens}
        emptyTitle="Nenhuma Integração configurada."
        emptyHint="Sem Integração, um Agente só alcança as Ferramentas internas do Espaço de Trabalho."
      />
      {dialogo}
    </>
  );
}

// ── Plugins (o Catálogo de Ferramentas, D3) ────────────────────────────────

/**
 * O Catálogo de Ferramentas sob o rótulo de produto "Plugins": cada cartão
 * carrega a Pilula "Ferramenta" e "Dar a um Agente" abre o diálogo de permitir
 * com a Ferramenta fixa. Permitir não concede permissão sobre registro algum
 * (DO-HAB-14); uma Ferramenta de Integração desconectada fica permitida e
 * inoperante (7.7) — o cartão avisa antes, o diálogo avisa de novo.
 */
export function PluginsCatalogo() {
  const state = useData((data) => data);
  const { memberId } = useSession();
  const { avisos, report } = useAvisos();
  const permissao = useAlvoDeDialogo();
  const governaveis = agentesGovernaveisPor(state, memberId).length;
  const dar = semRecusa(recusaDeConvidado(state, memberId, "edita Agente"), governaveis === 0 ? "Você não governa nenhum Agente que possa receber Ferramentas." : undefined);

  const itens = state.tools.map((tool) => {
    const integracao =
      state.integrations.find((i) => i.id === tool.integrationId || i.exposedTools.includes(tool.id));
    const agentes = state.agents.filter(
      (a) => a.lifecycle === "ativo" && (versaoCorrenteDoAgente(a)?.allowedToolIds ?? []).includes(tool.id),
    ).length;
    const efeito = EFFECT_CLASS_LABEL[tool.effectClass] ?? tool.effectClass;
    const desconectada = integracao !== undefined && integracao.state !== "conectada";
    return {
      id: tool.id,
      title: tool.name,
      description: tool.description,
      href: integracao ? "/ia/personalizar/conectores" : "/ia/personalizar/agente",
      icon: <Icone de={Wrench} tamanho="md" />,
      badge: { label: efeito, tone: tool.effectClass === "leitura" ? ("ok" as const) : ("atencao" as const) },
      condicoes: desconectada ? [{ label: `Integração ${integracao.name} desconectada`, tone: "warning" as const, title: "Permitida, a Ferramenta fica inoperante até reconectar (7.7)." }] : [],
      facts: [
        { label: "Ferramenta", tone: "acento" as const },
        { label: integracao ? integracao.name : "da plataforma" },
        { label: RESOURCE_TYPE_LABEL[tool.targetResourceType] ?? tool.targetResourceType },
        { label: plural(agentes, "Agente", "Agentes"), tone: agentes > 0 ? ("ok" as const) : ("neutro" as const) },
      ],
      onAction: { label: "Dar a um Agente", onSelect: () => permissao.abrir(tool.id), ...(dar ? { disabledReason: dar } : {}) },
    };
  });
  return (
    <>
      <CatalogGrid
        title="Plugins"
        items={itens}
        emptyTitle="Nenhuma Ferramenta no Catálogo."
        emptyHint="As da plataforma nascem com o Espaço de Trabalho; as demais chegam pelas Integrações."
      />
      {avisos}
      <PermitirFerramentaDialog
        key={`permissao-${permissao.alvo ?? "nenhuma"}`}
        {...(permissao.alvo ? { toolId: permissao.alvo } : {})}
        open={permissao.aberto}
        onClose={permissao.fechar}
        onDone={(message) => {
          permissao.fechar();
          report({ ok: true }, message);
        }}
      />
    </>
  );
}
