"use client";

/**
 * O COMPOSITOR DO CHAT — a caixa de escrever da home e da Sessão, uma peça só
 * para as duas (são o mesmo momento e não podem divergir).
 *
 * 2026-09-25: "quero uma refatoração visual da tela de IA, o componente de chat
 * deve seguir este prompt de exemplo" — o PromptBar: caixa grafite de cantos
 * de destaque com uma luz percorrendo a borda, o campo no alto e, embaixo, uma
 * fileira de botões redondos que abrem menus. O exemplo veio em shadcn; aqui
 * ele é vestido com o sistema (tokens, `ActionMenu`, `Icone`) e cada botão faz
 * uma coisa REAL deste produto — nada de controle falso:
 *
 *  - "+" (anexar): a Âncora da Sessão (B83) e, desligados com o motivo, Anexar
 *    arquivo e Anexar imagem — a Mensagem de Chat prevê Arquivos (A8), mas o
 *    protótipo ainda não os recebe.
 *  - "/" (ferramentas): a HABILIDADE da Sessão — as concedidas ao Agente que
 *    responde primeiro; as outras aparecem desligadas, com o porquê.
 *  - pasta de Sessões (do Membro, um nível só), com "Nova pasta…" que já a
 *    deixa escolhida.
 *  - "layout": a LARGURA DA CONVERSA (estreita ou larga), preferência deste
 *    navegador.
 *  - a paleta de cor do exemplo SAIU: o acento é o roxo único da marca. No
 *    lugar dela, o AGENTE que responde (o Assistente padrão quando nenhum).
 *  - a pílula de "modo" (Rápido/Equilibrado/Refletido) é o MODELO — os nomes
 *    reais, sem prometer "esforço de raciocínio" que não existe; desligada
 *    com o motivo quando o Agente não admite trocar o Modelo (B75).
 *  - microfone: desligado com o motivo — o Chat não recebe voz, e nada é
 *    gravado nem transcrito (pulso vermelho sem captura seria controle falso).
 *  - enviar: a única ação sólida, no degradê; sem o que enviar, o círculo
 *    neutro, com o motivo na dica e no leitor de tela.
 *
 * O que está escolhido fica À VISTA, em fichas acima da fileira (Âncora,
 * Habilidade, pasta, Agente), cada uma com o "tirar" — a escolha não se
 * esconde na dica de um botão. Enter envia; Shift+Enter quebra a linha.
 */

import { useId, type ReactNode } from "react";
import {
  Anchor,
  ArrowUp,
  Bot,
  ChevronDown,
  Cpu,
  Folder,
  FolderPlus,
  Image as ImageIcon,
  Info,
  LayoutGrid,
  LayoutTemplate,
  List,
  Mic,
  Paperclip,
  Plus,
  Puzzle,
  Scale,
  Slash,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useData, useSession } from "@/data/store";
import { agenteEfetivoDaSessao, motivoDeHabilidadeForaDoAgente, recusaDeTrocarModelo, versaoCorrenteDoAgente } from "@/data/derive-ia";
import type { Model } from "@/data/types";
import type { ItemDeMenu } from "@/design/components";
import { ActionMenu, Icone } from "@/features/shell/ui";
import type { LarguraDoChat } from "./largura-do-chat";

/** Os ajustes que o compositor escolhe. Vazio = o padrão (sem pasta, sem Habilidade, Modelo do Agente, Assistente padrão). */
export interface AjustesDoChat {
  readonly folderId: string;
  readonly skillId: string;
  readonly modelId: string;
  readonly agentId: string;
}

const SEM_ARQUIVOS = "O Chat ainda não recebe Arquivos: a Mensagem leva só texto.";
const SEM_IMAGENS = "O Chat ainda não recebe imagens: a Mensagem leva só texto.";
const SEM_VOZ = "O Chat ainda não recebe voz: nada é gravado nem transcrito.";

/** O ícone de um Modelo pelo que o nome dele promete (rápido, de base) — os outros, o chip. */
export function iconeDoModelo(nome: string): LucideIcon {
  const n = nome.toLocaleLowerCase("pt-BR");
  return n.includes("rápido") ? Zap : n.includes("base") ? Scale : Cpu;
}

const ENTRADA: Record<Model["capabilities"]["inputs"][number], string> = {
  texto: "texto",
  imagem: "imagem",
  audio: "áudio",
  video: "vídeo",
  documento: "documento",
};

/** "Lê texto, imagem e documento." — as Capacidades do Modelo, em palavras. */
function oQueLe(model: Model): string {
  const itens = model.capabilities.inputs.map((entrada) => ENTRADA[entrada]);
  const lista = itens.length > 1 ? `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}` : (itens[0] ?? "");
  return lista ? `Lê ${lista}.` : "";
}

export function CompositorDoChat({
  id,
  rotulo,
  tamanho,
  valor,
  aoMudar,
  placeholder,
  aoEnviar,
  rotuloDoEnvio,
  bloqueio,
  somenteLeitura,
  ajustes,
  aoAjustar,
  ancora,
  ancoraTravada,
  aoAncorar,
  aoTirarAncora,
  aoNovaPasta,
  largura,
  aoLargura,
}: {
  /** O id do campo (o `label` sr-only aponta para ele). */
  readonly id: string;
  /** O nome do campo para o leitor de tela. */
  readonly rotulo: string;
  /** "palco": no centro da tela, antes da primeira Mensagem; "rodape": colado ao pé, menus para cima. */
  readonly tamanho: "palco" | "rodape";
  readonly valor: string;
  readonly aoMudar: (valor: string) => void;
  readonly placeholder: string;
  readonly aoEnviar: () => void;
  /** "Começar" (a home cria a Sessão) ou "Enviar". */
  readonly rotuloDoEnvio: string;
  /** Por que o enviar está desligado agora (texto vazio, sem permissão…). */
  readonly bloqueio?: string;
  /** A caixa inteira desligada, com o porquê (leitura por compartilhamento, Sessão não ativa). */
  readonly somenteLeitura?: string;
  readonly ajustes: AjustesDoChat;
  readonly aoAjustar: (patch: Partial<AjustesDoChat>) => void;
  /** A Âncora escolhida, pelo nome. */
  readonly ancora?: string;
  /** Por que a Âncora não muda mais (a Sessão já tem Mensagens). */
  readonly ancoraTravada?: string;
  readonly aoAncorar: () => void;
  readonly aoTirarAncora: () => void;
  readonly aoNovaPasta: () => void;
  readonly largura: LarguraDoChat;
  readonly aoLargura: (largura: LarguraDoChat) => void;
}) {
  const { memberId } = useSession();
  const state = useData((data) => data);
  const idDoMotivoDoEnvio = useId();
  const idDoMotivoDaVoz = useId();
  const paraCima = tamanho === "rodape";
  const agentId = ajustes.agentId || undefined;

  const agentePadrao = state.agents.find((a) => a.id === state.workspace.defaultAgentId);
  const agenteEfetivo = agenteEfetivoDaSessao(state, agentId);
  const agenteEscolhido = agentId ? state.agents.find((a) => a.id === agentId) : undefined;
  const agentes = state.agents
    .filter((a) => a.lifecycle === "ativo")
    // O Assistente padrão primeiro: é quem responde quando ninguém é escolhido.
    .sort((a, b) => Number(b.id === agentePadrao?.id) - Number(a.id === agentePadrao?.id) || a.name.localeCompare(b.name, "pt-BR"));
  const pastas = state.chatFolders.filter((f) => f.ownerMemberId === memberId).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const pasta = pastas.find((f) => f.id === ajustes.folderId);
  const habilidades = state.skills.filter((k) => k.lifecycle === "ativo").sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const habilidade = state.skills.find((k) => k.id === ajustes.skillId);
  const modelos = state.models.filter((m) => !m.discontinued);
  const modelo = state.models.find((m) => m.id === ajustes.modelId);
  const recusaDeModelo = recusaDeTrocarModelo(state, agentId);
  const versao = agenteEfetivo ? versaoCorrenteDoAgente(agenteEfetivo) : undefined;
  const modeloDoAgente =
    versao?.modelId === "padraoDaPlataforma" ? "o Modelo padrão da plataforma" : state.models.find((m) => m.id === versao?.modelId)?.name;

  // ── Os menus ─────────────────────────────────────────────────────────────
  const itensDoMais: ItemDeMenu[] = [
    {
      secao: "Âncora",
      icone: Anchor,
      label: ancora ? "Trocar a Âncora…" : "Ancorar em registro…",
      onSelect: aoAncorar,
      ...(ancoraTravada ? { disabledReason: ancoraTravada } : {}),
    },
    ...(ancora && !ancoraTravada ? [{ icone: X, label: "Tirar a Âncora", onSelect: aoTirarAncora }] : []),
    { secao: "Arquivos", icone: Paperclip, label: "Anexar arquivo", onSelect: () => undefined, disabledReason: SEM_ARQUIVOS },
    { icone: ImageIcon, label: "Anexar imagem", onSelect: () => undefined, disabledReason: SEM_IMAGENS },
  ];

  // As concedidas ao Agente que responde, escolhíveis; as com Concessão mas
  // indisponível, desligadas com o motivo de cada uma; as SEM Concessão viram
  // uma linha só (nove itens desligados repetindo a mesma frase eram ruído) —
  // menos a que já estiver escolhida, que aparece marcada para não sumir.
  const motivoDe = (skillId: string) => motivoDeHabilidadeForaDoAgente(state, agentId, skillId);
  const temConcessao = (skillId: string) => state.skillGrants.some((g) => g.agentId === agenteEfetivo?.id && g.skillId === skillId);
  const concedidas = habilidades.filter((k) => temConcessao(k.id));
  const semConcessao = habilidades.filter((k) => !temConcessao(k.id));
  const escolhidaSemConcessao = semConcessao.find((k) => k.id === ajustes.skillId);
  const quantasSem = semConcessao.length - (escolhidaSemConcessao ? 1 : 0);
  const nomeDoAgente = agenteEfetivo?.name ?? "este Agente";
  const itensDaHabilidade: ItemDeMenu[] = [
    { icone: Slash, label: "Sem Habilidade", selecionado: ajustes.skillId === "", onSelect: () => aoAjustar({ skillId: "" }) },
    ...concedidas.map((k, i) => {
      const motivo = motivoDe(k.id);
      return {
        ...(i === 0 ? { secao: `Concedidas a ${nomeDoAgente}` } : {}),
        icone: Puzzle,
        label: k.name,
        selecionado: ajustes.skillId === k.id,
        onSelect: () => aoAjustar({ skillId: k.id }),
        ...(motivo ? { disabledReason: motivo } : {}),
      };
    }),
    ...(escolhidaSemConcessao
      ? [
          {
            secao: "",
            icone: Puzzle,
            label: escolhidaSemConcessao.name,
            selecionado: true,
            onSelect: () => undefined,
            disabledReason: motivoDe(escolhidaSemConcessao.id) ?? `Não concedida a “${nomeDoAgente}”.`,
          },
        ]
      : []),
    ...(quantasSem > 0
      ? [
          {
            secao: "",
            icone: Info,
            label: `${quantasSem} ${quantasSem === 1 ? "Habilidade sem Concessão" : "Habilidades sem Concessão"} para ${nomeDoAgente}`,
            onSelect: () => undefined,
            disabledReason: "Para pedi-las, escolha um Agente que tenha a Concessão.",
          },
        ]
      : []),
  ];

  const itensDaPasta: ItemDeMenu[] = [
    { icone: Folder, label: "Sem pasta", selecionado: ajustes.folderId === "", onSelect: () => aoAjustar({ folderId: "" }) },
    ...pastas.map((f) => ({ icone: Folder, label: f.name, selecionado: ajustes.folderId === f.id, onSelect: () => aoAjustar({ folderId: f.id }) })),
    { secao: "", icone: FolderPlus, label: "Nova pasta…", onSelect: aoNovaPasta },
  ];

  const itensDaLargura: ItemDeMenu[] = [
    { icone: List, label: "Conversa estreita", selecionado: largura === "estreita", onSelect: () => aoLargura("estreita") },
    { icone: LayoutTemplate, label: "Conversa larga", selecionado: largura === "larga", onSelect: () => aoLargura("larga") },
  ];

  const itensDoAgente: ItemDeMenu[] = agentes.map((a) => ({
    icone: Bot,
    label: a.name,
    ...(a.id === agentePadrao?.id ? { detalhe: "Assistente padrão do Espaço de Trabalho" } : {}),
    selecionado: (agentId ?? agentePadrao?.id) === a.id,
    onSelect: () => aoAjustar({ agentId: a.id === agentePadrao?.id ? "" : a.id }),
  }));

  const itensDoModelo: ItemDeMenu[] = [
    {
      icone: Bot,
      label: "Modelo do Agente",
      ...(modeloDoAgente ? { detalhe: `O que ${agenteEfetivo?.name ?? "o Agente"} usa: ${modeloDoAgente}.` } : {}),
      selecionado: ajustes.modelId === "",
      onSelect: () => aoAjustar({ modelId: "" }),
    },
    ...modelos.map((m) => {
      const le = oQueLe(m);
      return {
        icone: iconeDoModelo(m.name),
        label: m.name,
        ...(le ? { detalhe: le } : {}),
        selecionado: ajustes.modelId === m.id,
        onSelect: () => aoAjustar({ modelId: m.id }),
        ...(recusaDeModelo ? { disabledReason: recusaDeModelo } : {}),
      };
    }),
  ];
  // Sem sobrescrita e sem Modelo escolhido, não há o que abrir: a pílula
  // desliga e diz por quê. Com um Modelo escolhido de antes, abre para voltar
  // ao Modelo do Agente.
  const modeloDesligado = somenteLeitura ?? (recusaDeModelo && !modelo ? recusaDeModelo : undefined);

  // ── As fichas: o que está escolhido, à vista ────────────────────────────
  const livre = somenteLeitura === undefined;
  // O "tirar" desmonta o próprio botão: o foco volta ao campo, e não ao <body>.
  const tirar = (acao: () => void) => () => {
    acao();
    document.getElementById(id)?.focus();
  };
  const fichas: ReactNode[] = [];
  if (ancora) {
    fichas.push(
      <Ficha
        key="ancora"
        icone={Anchor}
        tipo="Âncora"
        rotulo={ancora}
        dica={ancoraTravada ? `${ancora}. ${ancoraTravada}` : "A Âncora guarda o nome que o registro tem agora."}
        {...(livre && !ancoraTravada ? { aoAbrir: aoAncorar, aoTirar: tirar(aoTirarAncora), rotuloDoTirar: "Tirar a Âncora" } : {})}
      />,
    );
  }
  if (habilidade) {
    fichas.push(
      <Ficha
        key="habilidade"
        icone={Puzzle}
        tipo="Habilidade"
        rotulo={habilidade.name}
        {...(livre ? { aoTirar: tirar(() => aoAjustar({ skillId: "" })), rotuloDoTirar: "Tirar a Habilidade" } : {})}
      />,
    );
  }
  if (pasta) {
    fichas.push(
      <Ficha
        key="pasta"
        icone={Folder}
        tipo="Pasta"
        rotulo={pasta.name}
        {...(livre ? { aoTirar: tirar(() => aoAjustar({ folderId: "" })), rotuloDoTirar: "Tirar da pasta" } : {})}
      />,
    );
  }
  if (agenteEscolhido) {
    fichas.push(
      <Ficha
        key="agente"
        icone={Bot}
        tipo="Agente"
        rotulo={agenteEscolhido.name}
        {...(livre ? { aoTirar: tirar(() => aoAjustar({ agentId: "" })), rotuloDoTirar: `Voltar a ${agentePadrao?.name ?? "o Assistente padrão"}` } : {})}
      />,
    );
  }

  const menu = (props: {
    readonly label: string;
    readonly icone: LucideIcon;
    readonly items: ReadonlyArray<ItemDeMenu>;
    readonly alinhar: "inicio" | "fim";
    readonly dica?: string;
  }) => (
    <ActionMenu
      label={props.label}
      dica={props.dica ?? props.label}
      trigger={<Icone de={props.icone} tamanho="md" />}
      gatilhoClassName="compositor-botao"
      menuClassName="w-72 max-h-80 overflow-y-auto"
      items={props.items}
      alinhar={props.alinhar}
      abrirParaCima={paraCima}
      {...(somenteLeitura ? { desligadoPor: somenteLeitura } : {})}
    />
  );

  return (
    <div className="compositor" data-tamanho={tamanho}>
      {/* A luz que percorre a borda: decoração, fora da árvore de acessibilidade. */}
      <span className="compositor-aro" aria-hidden="true">
        <span className="compositor-luz" />
      </span>
      <div className="compositor-caixa">
        <label className="sr-only" htmlFor={id}>
          {rotulo}
        </label>
        <textarea
          id={id}
          value={valor}
          onChange={(event) => aoMudar(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
            event.preventDefault();
            if (bloqueio === undefined) aoEnviar();
          }}
          rows={1}
          disabled={somenteLeitura !== undefined}
          placeholder={somenteLeitura ?? placeholder}
          className="compositor-campo campo-sem-anel"
        />

        {fichas.length > 0 ? (
          <div className="compositor-fichas" role="group" aria-label="No contexto desta Sessão">
            {fichas}
          </div>
        ) : null}

        <div className="compositor-fileira">
          <div className="compositor-grupo">
            {menu({ label: "Anexar contexto", icone: Plus, items: itensDoMais, alinhar: "inicio" })}
            {menu({
              label: habilidade ? `Habilidade: ${habilidade.name}` : "Habilidade",
              dica: "Habilidade",
              icone: Slash,
              items: itensDaHabilidade,
              alinhar: "inicio",
            })}
            {menu({ label: pasta ? `Pasta: ${pasta.name}` : "Pasta", dica: "Pasta de Sessões", icone: Folder, items: itensDaPasta, alinhar: "inicio" })}
          </div>

          <div className="compositor-grupo">
            {menu({ label: "Largura da conversa", icone: LayoutGrid, items: itensDaLargura, alinhar: "fim" })}
            {menu({
              label: `Agente: ${agenteEfetivo?.name ?? "Assistente padrão"}`,
              dica: "Agente que responde",
              icone: Bot,
              items: itensDoAgente,
              alinhar: "fim",
            })}
            <ActionMenu
              label={`Modelo: ${modelo?.name ?? "Modelo do Agente"}`}
              dica="Modelo que responde"
              gatilhoClassName="compositor-modo app-sm"
              trigger={
                <>
                  <Icone de={modelo ? iconeDoModelo(modelo.name) : Bot} tamanho="xs" />
                  <span className="min-w-0 truncate">{modelo?.name ?? "Modelo do Agente"}</span>
                  <Icone de={ChevronDown} tamanho="xs" />
                </>
              }
              items={itensDoModelo}
              menuClassName="w-72 max-h-80 overflow-y-auto"
              alinhar="fim"
              abrirParaCima={paraCima}
              {...(modeloDesligado ? { desligadoPor: modeloDesligado } : {})}
            />
            <button
              type="button"
              className="compositor-botao"
              aria-label="Ditar"
              aria-disabled="true"
              aria-describedby={idDoMotivoDaVoz}
              title={SEM_VOZ}
            >
              <Icone de={Mic} tamanho="md" />
            </button>
            <span id={idDoMotivoDaVoz} hidden>
              {SEM_VOZ}
            </span>
            <button
              type="button"
              className="compositor-enviar"
              aria-label={rotuloDoEnvio}
              aria-disabled={bloqueio !== undefined || undefined}
              aria-describedby={bloqueio !== undefined ? idDoMotivoDoEnvio : undefined}
              title={bloqueio ?? rotuloDoEnvio}
              onClick={() => {
                if (bloqueio === undefined) aoEnviar();
              }}
            >
              <Icone de={ArrowUp} tamanho="sm" />
            </button>
            {bloqueio !== undefined ? (
              <span id={idDoMotivoDoEnvio} hidden>
                {bloqueio}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Uma escolha à vista: o ícone, o nome e, quando dá para desfazer, o "tirar". */
function Ficha({
  icone,
  tipo,
  rotulo,
  dica,
  aoAbrir,
  aoTirar,
  rotuloDoTirar,
}: {
  readonly icone: LucideIcon;
  /** O que é, para o leitor de tela ("Âncora", "Habilidade"…). */
  readonly tipo: string;
  readonly rotulo: string;
  readonly dica?: string;
  readonly aoAbrir?: () => void;
  readonly aoTirar?: () => void;
  readonly rotuloDoTirar?: string;
}) {
  const nome = (
    <>
      <span className="sr-only">{tipo}: </span>
      {rotulo}
    </>
  );
  return (
    <span className="compositor-ficha app-sm" title={dica ?? `${tipo}: ${rotulo}`}>
      <Icone de={icone} tamanho="xs" />
      {aoAbrir ? (
        <button type="button" className="compositor-ficha-rotulo" onClick={aoAbrir}>
          {nome}
        </button>
      ) : (
        <span className="compositor-ficha-rotulo">{nome}</span>
      )}
      {aoTirar ? (
        <button type="button" className="compositor-ficha-tirar" aria-label={rotuloDoTirar} title={rotuloDoTirar} onClick={aoTirar}>
          <Icone de={X} tamanho="xs" />
        </button>
      ) : null}
    </span>
  );
}
