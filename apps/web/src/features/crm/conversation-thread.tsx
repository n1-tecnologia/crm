"use client";

/**
 * A conversa de um Contato, por Canal, embutível em qualquer ficha.
 *
 * Existe como componente porque a mesma conversa precisa aparecer na ficha do
 * Contato e na do Negócio — e duas cópias divergiriam justamente nas regras do
 * Canal, que é onde errar custa uma Mensagem enviada fora da janela.
 *
 * Desde a Fase 15 (15-20, 3.4.2) o fio recebe IDS e lê o CRM novo pela api:
 * o Contato com os Identificadores (`useContato`), os Canais (`useCanais`), as
 * Conversas do Contato (`useConversas`) e as Mensagens da Conversa
 * (`useMensagens`). Responder grava UMA linha em `plataforma.mensagens`
 * (`enviarMensagem`, `POST /mensagens`); o que decide janela, consentimento e
 * Canal arquivado é a api, e a recusa dela aparece no fio. Nada daqui lê as
 * Conversas, os Contatos nem os Canais do estado antigo (`DataState`).
 *
 * As abas são por Canal (D-14): uma por Canal ativo do Espaço, e a de um Canal
 * que o Contato não alcança fica desligada dizendo o que falta. O compositor
 * escolhe por qual Canal responder (D-15) e o separador "via …" marca a troca
 * de Canal numa sequência de Mensagens (D-13). Toda a conta mora no domínio
 * (`crm/canais-de-resposta`); aqui só se desenha.
 *
 * O modelo novo não tem Rascunho de IA (D-15-11, adiado para a Sessão 16), nem
 * Mensagem de modelo: `plataforma.canais` não guarda modelos. Fora da janela de
 * 24 h do WhatsApp oficial, então, o envio fica desligado dizendo por quê.
 */

import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import {
  AudioLines,
  FileText,
  Globe,
  Image,
  Mail,
  ListTodo,
  MessageCircle,
  Paperclip,
  Plus,
  Send,
  StickyNote,
  Video,
  type LucideIcon,
} from "lucide-react";
import { useData, useRehidratar, useRun } from "@/dados/store";
import { ErroDeApi } from "@/dados/crm/cliente-crm";
import { useCanais } from "@/dados/crm/canais";
import { useContato } from "@/dados/crm/contatos";
import { abrirConversa, useConversa, useConversas } from "@/dados/crm/conversas";
import { enviarMensagem, pedirTicketDeAnexo, useMensagens } from "@/dados/crm/mensagens";
import { enviarBytesAoBucket, recusaDoAnexoDaMensagem } from "@/dados/envio-ao-bucket";
import { useNegocios } from "@/dados/crm/negocios";
import { useConsentimentosDoContato } from "@/dados/crm/consentimentos";
import { adicionarNotaAoContato } from "@/dados/crm/notas";
import { criarTarefaConversacional } from "@/dados/crm/tarefas-conversacionais";
import { createTask } from "@n1/dominio/operations";
import { capacidadesDoCanal } from "@n1/dominio/crm/capacidades";
import { FRASE_SO_RESPONDE, fraseDaJanelaBloqueada } from "@n1/dominio/crm/mensagens";
import { statusCategory } from "@n1/dominio/derive";
import {
  canaisDaListaNasTabelas,
  listaConversacional,
  listaSemCanaisNasTabelas,
  marcadoresDeCanal,
} from "@n1/dominio/derive-conversacional";
import {
  canaisDoFioNasTabelas,
  canalDaAbaInicialNasTabelas,
  canalPadraoDeRespostaNasTabelas,
  rotuloDoCanalNasTabelas,
} from "@n1/dominio/crm/canais-de-resposta";
import { LIMITES_CRM } from "@n1/dominio/crm/comum";
import { categoriaDaMidia, normalizarTipoDeMidia, tiposAceitosParaOCanal, type CategoriaDeMidia } from "@n1/dominio/crm/midia";
import type { ReferenciaDeAnexoEnviado } from "@n1/dominio/crm/mensagens";
import { nomeDeExibicaoDoContato, ROTULO_DO_TIPO_DE_IDENTIFICADOR } from "@n1/dominio/crm/contatos";
import { consentimentoVigente } from "@n1/dominio/crm/consentimentos";
import { recusaDeNotaNoContato, validarNovaNota } from "@n1/dominio/crm/notas";
import { TIPO_DE_IDENTIFICADOR_DO_CANAL, type ConversaNaLista } from "@n1/dominio/crm/conversas";
import { LISTA_SEM_CANAIS } from "@n1/dominio/operations/canais";
import { SeletorDeTipoDeTarefa } from "@/features/estrutura/seletor-de-tipo";
import { AvatarDoContato } from "@/features/crm/avatar-do-contato";
import { AnexoDaMensagemNoFio } from "@/features/crm/anexo-da-mensagem";
import { EstadoDaEntrega } from "@/features/crm/estado-da-entrega";
import { SeletorDeCanalDeResposta } from "@/features/crm/seletor-de-canal";
import { SeparadorDeCanal } from "@/features/crm/separador-de-canal";
import { MarcaDeConexaoSimulada, SeloDoProvedor } from "@/features/crm/selo-do-provedor";
import { InstagramIcon, LinkedinIcon } from "@/features/crm/brand-icons";
import { useFormat } from "@/features/shell/use-format";
import {
  ActorAvatar,
  Button,
  ConfirmDialog,
  Divisor,
  EmptyState,
  Icone,
  Pilula,
  Select,
  cn,
} from "@/features/shell/ui";
import type { ChannelType, Id, Task } from "@n1/dominio/types";

export const CHANNEL_ICON: Record<
  ChannelType,
  (props: { readonly className?: string }) => ReactNode
> = {
  whatsapp: MessageCircle,
  instagram: InstagramIcon,
  linkedin: LinkedinIcon,
  email: Mail,
  chatDoSite: Globe,
};

/**
 * As categorias de arquivo que o compositor oferece (D-16-10): as que a Mensagem
 * leva de verdade (`@n1/dominio/crm/midia`). Localização, figurinha e Flow não são
 * arquivo e saíram da barra; enviar áudio é anexar um arquivo de áudio.
 */
const CATEGORIAS_DE_ARQUIVO = [
  { categoria: "image", rotulo: "Imagem", icone: Image },
  { categoria: "audio", rotulo: "Áudio", icone: AudioLines },
  { categoria: "video", rotulo: "Vídeo", icone: Video },
  { categoria: "document", rotulo: "Documento", icone: FileText },
] as const satisfies readonly { readonly categoria: CategoriaDeMidia; readonly rotulo: string; readonly icone: LucideIcon }[];

/** O alternador de anexo: aceso em acento lavado, apagado em cinza. */
function classeDoAlternador(ligado: boolean): string {
  return cn(
    "app-sm flex items-center gap-1 rounded-[var(--r-controle)] px-2 py-1 transition-colors",
    ligado
      ? "bg-[var(--acento-lavado)] text-[var(--acento)]"
      : "text-[var(--texto-3)] hover:bg-[var(--superficie-2)] hover:text-[var(--texto)]",
  );
}

/*
  A região que rola (o fio de Mensagens, ou a aba de Nota/Tarefa/Meet) na FICHA
  EMPILHADA: dentro de um `@container/ficha` mais estreito que @4xl o fio não é
  `flex-1` de uma fatia disputada — tem altura própria, `--conversa-empilhada-min`,
  e é a ficha em cima que reparte o resto. A altura é DEFINIDA (não mínima) de
  propósito: numa coluna que se dimensiona pelo conteúdo, um `flex-basis: 0`
  contribuiria com todas as Mensagens e o fio nunca rolaria. `shrink-0` para o
  fio não ceder; `basis-auto` para a altura ser a base de flex.
*/
const CLASSE_DO_FIO_EMPILHADO =
  "@max-4xl/ficha:h-[var(--conversa-empilhada-min)] @max-4xl/ficha:shrink-0 @max-4xl/ficha:basis-auto";
/* Os botões redondos da barra do compositor têm a altura do controle, e não a
   do botão nu (menor), para alinharem com a pílula de texto ao lado. */
const MEDIDA_DO_BOTAO_DO_COMPOSITOR = {
  width: "var(--controle-h)",
  height: "var(--controle-h)",
} as const;

/** A Conversa como o fio a enxerga: a da lista do Contato, ou só o que `GET /conversas/:id` diz dela. */
type ConversaDaAba = Pick<ConversaNaLista, "id" | "canalId" | "situacao" | "ultimaRecebidaEm">;

export function ConversationThread({
  conversaId,
  contatoId,
  canalPreferidoId,
  canalSelecionado,
  onCanalChange,
  onConversaAberta,
  flush = false,
}: {
  /** A Conversa que o fio segue; sem ela o fio escolhe a do Canal da aba. */
  readonly conversaId?: string;
  readonly contatoId: string;
  /** O Canal em que a aba prefere abrir quando a tela não a controla e nada decide por ela. */
  readonly canalPreferidoId?: string;
  /**
   * A Tarefa conversacional a que este fio pertence (ficha da Tarefa). Ainda não é
   * lida aqui: a Nota é do Contato (`POST /contatos/:id/notas`) e o "Criar Tarefa"
   * nasce da Lista que se escolhe, então nenhum dos dois precisa dela.
   */
  readonly tarefaId?: string;
  /** O id do Canal da aba; controlado quando a tela tem atalho de Canal fora da aba. */
  readonly canalSelecionado?: Id | null;
  readonly onCanalChange?: (channelId: Id) => void;
  /** Avisa a tela de que o fio abriu uma Conversa nova (a primeira Mensagem acabou de sair). */
  readonly onConversaAberta?: (conversaId: string) => void;
  /** Sem moldura: o thread É o painel, como na Caixa de Entrada. */
  readonly flush?: boolean;
}) {
  // O estado ainda guarda Listas, Tarefas, Membros e Agentes; o CRM vem da api.
  const state = useData((data) => data);
  const run = useRun();
  const rehidratar = useRehidratar();
  const fmt = useFormat();
  /*
    A FICHA EMPILHADA. Quando o fio vive num contêiner chamado `ficha` mais
    estreito que @4xl (a Tarefa conversacional com a Conversa embaixo da
    ficha), a altura é disputada: o fio ganha uma altura própria
    (`--conversa-empilhada-min`, que a ficha reparte) em vez de se espremer.
    Fora desse contêiner — Caixa de Entrada, Contato, Negócio, a Tarefa em
    colunas — as classes `@max-4xl/ficha:` não casam com nada e nada muda.
  */
  const [canalAtivo, setCanalAtivo] = useState<Id | null>(null);
  const [draft, setDraft] = useState("");
  const [assunto, setAssunto] = useState("");
  const [copia, setCopia] = useState("");
  const [copiaOculta, setCopiaOculta] = useState("");
  // O arquivo escolhido para a próxima Mensagem; o progresso é o do envio ao bucket (0 a 100).
  const [anexo, setAnexo] = useState<{ readonly arquivo: File; readonly progresso: number } | null>(null);
  const [anexando, setAnexando] = useState(false);
  const seletoresDeArquivo = useRef<Partial<Record<CategoriaDeMidia, HTMLInputElement | null>>>({});
  const [registro, setRegistro] = useState<"nota" | "tarefa" | "meet" | null>(
    null,
  );
  const [textoDoRegistro, setTextoDoRegistro] = useState("");
  const [listaDaTarefa, setListaDaTarefa] = useState("");
  /** O Tipo da Tarefa que nasce daqui; vazio até o seletor pôr o padrão da Lista. */
  const [tipoDaTarefa, setTipoDaTarefa] = useState<string | undefined>(undefined);
  const [confirmandoEnvio, setConfirmandoEnvio] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // A Tarefa conversacional é uma chamada à api: o botão espera a resposta, sem criar duas.
  const [criandoTarefa, setCriandoTarefa] = useState(false);
  // A Nota também é uma chamada à api (`POST /contatos/:id/notas`): o `ref` fecha o intervalo do duplo clique (UCR-05).
  const [salvandoNota, setSalvandoNota] = useState(false);
  const salvandoNotaRef = useRef(false);
  /*
    O envio é uma chamada à api: o botão desliga enquanto a primeira está em voo
    (borda UCR-05). O `ref` fecha o intervalo entre o clique e a renderização, em
    que um segundo clique ainda veria o botão ligado.
  */
  const [enviando, setEnviando] = useState(false);
  const enviandoRef = useRef(false);
  // A Mensagem que acabou de sair, para o fio acender só ela.
  const [recemEnviada, setRecemEnviada] = useState<string | null>(null);
  // A Conversa que o próprio fio acabou de abrir: dali em diante é ela que ele segue.
  const [aberta, setAberta] = useState<string | undefined>(undefined);
  const [agora] = useState(() => Date.now());

  /*
    O que o fio lê da api. Cada leitura é uma chave de SWR do CRM; `useConversa`
    segue a Conversa que a tela pediu (`conversaId`) mesmo quando ela não está na
    lista do Contato (fora do Espaço da lista, por exemplo).
  */
  const contatoQ = useContato(contatoId);
  const canaisQ = useCanais({ estado: "ativo", limite: LIMITES_CRM.paginaMaxima });
  const conversasQ = useConversas({ contatoId, estado: "ativo", limite: LIMITES_CRM.paginaMaxima });
  const seguida = aberta ?? conversaId;
  const pedidaQ = useConversa(seguida);
  const negociosQ = useNegocios({ contatoId, estado: "ativo", limite: LIMITES_CRM.paginaMaxima });
  const consentimentosQ = useConsentimentosDoContato(contatoId);

  const canais = canaisQ.data?.itens;
  const contato = contatoQ.data?.contato;
  const identificadores = contatoQ.data?.identificadores;
  const conversasDoContato = conversasQ.data?.itens;
  const pedida = pedidaQ.data?.conversa;
  const fio = canais && identificadores ? canaisDoFioNasTabelas(canais, identificadores) : undefined;

  // Quem controla o Canal por fora (os atalhos da ficha) espera ver o chat ao
  // clicar. Ajuste de estado durante a renderização, o padrão do React para
  // "reagir a uma prop mudar" sem efeito nem renderização a mais.
  const [canalVisto, setCanalVisto] = useState(canalSelecionado);
  if (canalSelecionado !== canalVisto) {
    setCanalVisto(canalSelecionado);
    setRegistro(null);
    setAnexo(null);
  }

  const principal = identificadores?.find((i) => i.principal) ?? identificadores?.[0];
  const nomeDoContato = contato ? nomeDeExibicaoDoContato(contato, principal?.valorExibido ?? principal?.valor) : "";
  const primeiroNome = contato?.nome?.trim() || nomeDoContato.split(" ")[0] || "";

  /*
   * A Reunião do Contato: Tarefa de Tipo Reunião ligada a um Negócio em que ele
   * está vinculado (os Negócios do Contato vêm de `GET /negocios?contatoId=`).
   * A que está em andamento ganha a vez; senão, a próxima.
   */
  const negocios = negociosQ.data?.itens ?? [];
  const negociosDele = new Set(negocios.map((n) => n.id));
  const reunioes = state.tasks
    .filter((t) => t.lifecycle === "ativo")
    .filter(
      (t) =>
        state.taskTypes.find((tt) => tt.id === t.taskTypeId)?.name ===
        "Reunião",
    )
    .filter((t) =>
      state.links.some(
        (l) =>
          (l.fromId === t.id &&
            l.toType === "deal" &&
            negociosDele.has(l.toId)) ||
          (l.toId === t.id &&
            l.fromType === "deal" &&
            negociosDele.has(l.fromId)),
      ),
    );
  /** O Negócio ao qual a Reunião está ligada: é dele que sai o valor. */
  const negocioDaReuniao = (reuniaoId: Id) => {
    const vinculo = state.links.find(
      (l) =>
        (l.fromId === reuniaoId && l.toType === "deal") ||
        (l.toId === reuniaoId && l.fromType === "deal"),
    );
    if (!vinculo) return undefined;
    const idDoNegocio = vinculo.fromId === reuniaoId ? vinculo.toId : vinculo.fromId;
    return negocios.find((n) => n.id === idDoNegocio);
  };

  /* Em andamento primeiro, depois a mais próxima: a call de agora é a que o
     Closer veio abrir, e as outras são o contexto. */
  const agenda = [...reunioes].sort((a, b) => {
    const viva = (t: Task) =>
      statusCategory(state, t) === "emAndamento" ? 0 : 1;
    return (
      viva(a) - viva(b) ||
      String(a.dueDate?.value ?? "9").localeCompare(
        String(b.dueDate?.value ?? "9"),
      )
    );
  });

  const reuniao =
    reunioes.find((t) => statusCategory(state, t) === "emAndamento") ??
    reunioes
      .filter((t) => statusCategory(state, t) !== "concluido")
      .sort((a, b) =>
        String(a.dueDate?.value ?? "9").localeCompare(
          String(b.dueDate?.value ?? "9"),
        ),
      )[0];
  const reuniaoAoVivo =
    reuniao !== undefined && statusCategory(state, reuniao) === "emAndamento";

  /*
    D-15: a aba abre no Canal da última Mensagem recebida do Contato; sem ela,
    D-14: no da Conversa mais recente. Depois disso a escolha é de quem atende.
    Um Canal que a tela mande e que não esteja (mais) na fileira é ignorado.
  */
  const naFileira = (id: Id | null | undefined): Id | undefined =>
    id !== null && id !== undefined && fio?.some((c) => c.canal.id === id) ? id : undefined;
  const canalDaAba =
    naFileira(canalSelecionado) ??
    naFileira(canalAtivo) ??
    naFileira(pedida?.canalId) ??
    naFileira(canalPreferidoId) ??
    (canais && identificadores && conversasDoContato
      ? (canalPadraoDeRespostaNasTabelas(canais, identificadores, conversasDoContato) ??
        canalDaAbaInicialNasTabelas(canais, identificadores, conversasDoContato))
      : undefined) ??
    null;
  const canal = canalDaAba ? canais?.find((ch) => ch.id === canalDaAba) : undefined;

  // D-14: a Conversa da aba é a deste Canal com o Contato — nunca a de outro
  // Canal do mesmo tipo. A que o fio foi mandado seguir ganha; senão a Conversa
  // aberta é a que recebe resposta e as resolvidas ficam como histórico.
  const doCanal = canal ? (conversasDoContato ?? []).filter((c) => c.canalId === canal.id) : [];
  const pedidaDestaAba: ConversaDaAba | undefined =
    pedida && canal && pedida.canalId === canal.id
      ? { id: pedida.id, canalId: pedida.canalId, situacao: pedida.situacao, ultimaRecebidaEm: null }
      : undefined;
  const conversa: ConversaDaAba | undefined =
    doCanal.find((c) => c.id === seguida) ??
    pedidaDestaAba ??
    doCanal.find((c) => c.situacao !== "resolvida") ??
    doCanal[0];

  /*
    As Mensagens vêm em páginas de até 200 na ordem do fio (a mais antiga
    primeiro). Uma Conversa maior mostra as 200 ÚLTIMAS: o deslocamento sobe
    para `total - 200` assim que a primeira página diz o tamanho do fio.
  */
  const [posicao, setPosicao] = useState<{ readonly conversaId: string | undefined; readonly deslocamento: number }>({
    conversaId: undefined,
    deslocamento: 0,
  });
  const deslocamento = posicao.conversaId === conversa?.id ? posicao.deslocamento : 0;
  const mensagensQ = useMensagens(conversa?.id, { limite: LIMITES_CRM.paginaMaxima, deslocamento });
  // `keepPreviousData` mostra a página da Conversa anterior enquanto a nova chega: só vale a desta.
  const daConversa = (mensagensQ.data?.itens ?? []).filter((m) => m.conversaId === conversa?.id);
  if (conversa && mensagensQ.data && daConversa.length > 0) {
    const ultimaPagina = Math.max(0, mensagensQ.data.total - LIMITES_CRM.paginaMaxima);
    if (ultimaPagina !== deslocamento) setPosicao({ conversaId: conversa.id, deslocamento: ultimaPagina });
  }
  const mensagens = daConversa;

  const IconeDaAba = canal ? CHANNEL_ICON[canal.tipo] : undefined;

  /*
    3.4.2 — o aviso de consentimento de marketing é a regra do CRM novo: o
    consentimento vigente (`consentimentoVigente`) da finalidade Marketing do
    Catálogo, para o tipo do Canal da aba, sobre o histórico de
    `GET /contatos/:id/consentimentos`. Vigente que não seja `concedido` (revogado,
    ou nenhum registro, ou Espaço sem a finalidade) dispara o aviso — a mesma conta
    que o fio antigo fazia e que `recusaPorFaltaDeConsentimento` aplica, no
    envio da api, ao modelo de marketing. É AVISO: o texto livre dentro da
    janela não é marketing e continua saindo. Sem a leitura (carregando ou falha)
    o fio não afirma nada.
  */
  const finalidadeDeMarketingId = state.catalog.find(
    (item) => item.kind === "finalidadeConsentimento" && item.name.toLowerCase() === "marketing",
  )?.id;
  const semConsentimentoDeMarketing =
    canal !== undefined &&
    consentimentosQ.data !== undefined &&
    (finalidadeDeMarketingId === undefined ||
      consentimentoVigente(consentimentosQ.data.itens, finalidadeDeMarketingId, canal.tipo)?.decisao !== "concedido");

  // A Capacidade é do Canal da aba (D-02): o provedor muda a janela.
  const capacidades = canal ? capacidadesDoCanal({ channelType: canal.tipo, provider: canal.provedor }) : undefined;
  // D-16-10: só as categorias de arquivo e os tipos que o Canal da aba envia (`sendableMediaTypes`).
  const tiposDoCanal = capacidades ? tiposAceitosParaOCanal(capacidades.sendableMediaTypes) : [];
  const categoriasDoCanal = CATEGORIAS_DE_ARQUIVO.map((c) => ({
    ...c,
    tipos: tiposDoCanal.filter((tipo) => categoriaDaMidia(tipo) === c.categoria),
  })).filter((c) => c.tipos.length > 0);
  const horasDaJanela = capacidades?.responseWindowHours;
  const abertaAte =
    horasDaJanela !== undefined && conversa?.ultimaRecebidaEm
      ? new Date(Date.parse(conversa.ultimaRecebidaEm) + horasDaJanela * 3_600_000)
      : null;
  const janelaFechada = abertaAte !== null && agora > abertaAte.getTime();
  /*
    RN-CXE-19 — fora da janela, o WhatsApp oficial só aceita Mensagem de modelo
    aprovada pelo provedor. O Canal novo não guarda modelos, então não há o que
    escolher: em vez de deixar o envio falhar no clique, o compositor se
    desliga dizendo por quê. Quem decide de verdade é a api.
  */
  const exigeModelo = janelaFechada && capacidades?.foraDaJanela === "soModelo";
  /*
    Sessão 8 — no Instagram não existe modelo: antes da primeira mensagem do
    Contato, ou depois das 24 h, só ele reabre a conversa. A api recusa com as
    mesmas frases do domínio; o compositor se desliga antes, dizendo por quê.
  */
  const soOContatoReabre =
    capacidades?.foraDaJanela === "bloqueado" && (janelaFechada || !conversa?.ultimaRecebidaEm)
      ? janelaFechada
        ? fraseDaJanelaBloqueada(horasDaJanela ?? 24)
        : FRASE_SO_RESPONDE
      : undefined;

  const bloqueio = enviando
    ? "Enviando a Mensagem…"
    : !canal
      ? "Este Contato não tem Canal."
      : anexo && !conversa
        ? "Abra a Conversa com uma Mensagem antes de anexar um arquivo."
      : draft.trim() === "" && !anexo
        ? conversa
          ? "Escreva a mensagem antes de enviar."
          : "Escreva a primeira Mensagem antes de enviar."
        : soOContatoReabre
          ? soOContatoReabre
          : exigeModelo
          ? "A janela de resposta expirou e este Canal não tem Mensagem de modelo aprovada: não dá para enviar agora."
          : janelaFechada
            ? "A janela de resposta expirou."
            : canal?.conexao === "com_erro"
              ? "O Canal está com erro de conexão."
              : undefined;

  /*
    D-15 — "Responder por": muda a aba. O Canal de nenhuma Conversa existente
    muda (INV-CXE-04), e nada é gravado: a Conversa do outro Canal já existe, ou
    nasce com a primeira Mensagem.
  */
  const trocarCanalDeResposta = (canalId: Id) => {
    const escolhido = canais?.find((ch) => ch.id === canalId);
    setCanalAtivo(canalId);
    onCanalChange?.(canalId);
    setDraft("");
    setAnexo(null);
    setErro(null);
    setAviso(`Respondendo por ${escolhido ? rotuloDoCanalNasTabelas(escolhido) : "outro Canal"}.`);
  };

  /** O arquivo escolhido é pré-conferido (tipo do Canal e teto); a api confere de novo ao pedir o ticket. */
  const escolherArquivo = (arquivo: File | undefined) => {
    if (!arquivo) return;
    setAviso(null);
    const recusa = recusaDoAnexoDaMensagem(arquivo, tiposDoCanal);
    if (recusa) {
      setErro(recusa);
      return;
    }
    setErro(null);
    setAnexo({ arquivo, progresso: 0 });
    setAnexando(false);
  };

  /** A falha vira a frase da api (janela fechada, sem consentimento, Canal arquivado…) e o texto fica no campo. */
  const recusar = (falha: unknown) => {
    setAviso(null);
    setErro(falha instanceof ErroDeApi ? falha.message : "Não foi possível enviar a Mensagem. Tente de novo.");
  };

  /*
    Com Conversa no Canal da aba, a Mensagem vai para ela (`POST /mensagens`).
    Sem ela, a Conversa nasce COM a primeira Mensagem (`POST /conversas`,
    INV-CXE-05, F14-D-07): não existe Conversa vazia. O Canal da Conversa é o da
    aba, para sempre (INV-CXE-04).
  */
  const enviar = async () => {
    if (enviandoRef.current || !canal) return;
    enviandoRef.current = true;
    setEnviando(true);
    try {
      if (conversa) {
        /*
          Com arquivo (D-16-10): o ticket reserva o objeto (a api já confere tipo, tamanho e Canal), os
          bytes sobem direto ao bucket pela URL assinada e só então a Mensagem sai com a referência do
          arquivo. Se o arquivo não chega ao bucket nada é gravado e ele continua escolhido.
        */
        let anexos: ReferenciaDeAnexoEnviado[] | undefined;
        if (anexo) {
          const ticket = await pedirTicketDeAnexo({
            conversaId: conversa.id,
            nome: anexo.arquivo.name,
            tipoDeMidia: normalizarTipoDeMidia(anexo.arquivo.type),
            tamanhoBytes: anexo.arquivo.size,
          });
          const subiu = await enviarBytesAoBucket(ticket.uploadUrl, anexo.arquivo, (progresso) =>
            setAnexo((atual) => (atual ? { ...atual, progresso } : atual)),
          );
          if (!subiu) {
            setAnexo((atual) => (atual ? { ...atual, progresso: 0 } : atual));
            setAviso(null);
            setErro("O arquivo não chegou ao armazenamento. Tente de novo.");
            return;
          }
          anexos = [{ submissionId: ticket.submissionId, objectId: ticket.objectId }];
        }
        const enviada = await enviarMensagem({
          conversaId: conversa.id,
          direcao: "enviada",
          conteudo: anexo && draft.trim() === "" ? "" : draft,
          ...(anexos ? { anexos } : {}),
        });
        setRecemEnviada(enviada.id);
        setAnexo(null);
        setAviso("Mensagem enviada.");
      } else {
        const nova = await abrirConversa({ canalId: canal.id, contatoId, mensagem: { conteudo: draft } });
        setAberta(nova.conversa.id);
        setRecemEnviada(nova.primeiraMensagem.id);
        setAviso("Conversa aberta e Mensagem enviada.");
        onConversaAberta?.(nova.conversa.id);
      }
      setDraft("");
      setErro(null);
    } catch (falha) {
      recusar(falha);
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
      setConfirmandoEnvio(false);
    }
  };

  /*
    A Nota é do Contato (3.2.7): o texto vai para `POST /contatos/:id/notas` e o
    autor é o Membro da sessão. A regra de forma é a do domínio (`validarNovaNota`,
    a mesma que o endpoint aplica), conferida ANTES de ir à api; o Contato que não
    aceita Nota (mesclado, na lixeira) é recusado pela mesma `recusaDeNotaNoContato`.
    A recusa da api aparece aqui com a frase dela e o texto fica no campo.
  */
  const registrarNota = async () => {
    if (salvandoNotaRef.current) return;
    const valida = validarNovaNota({ conteudo: textoDoRegistro });
    if (!valida.ok) {
      setAviso(null);
      setErro(valida.error);
      return;
    }
    const recusa = contato ? recusaDeNotaNoContato(contato) : undefined;
    if (recusa) {
      setAviso(null);
      setErro(recusa);
      return;
    }
    salvandoNotaRef.current = true;
    setSalvandoNota(true);
    try {
      await adicionarNotaAoContato(contatoId, valida.value.conteudo);
      setErro(null);
      setAviso("Nota registrada no Contato.");
      setTextoDoRegistro("");
    } catch (falha) {
      setAviso(null);
      setErro(falha instanceof ErroDeApi ? falha.message : "Não foi possível registrar a nota. Tente de novo.");
    } finally {
      salvandoNotaRef.current = false;
      setSalvandoNota(false);
    }
  };

  if (contatoQ.error || canaisQ.error || conversasQ.error) {
    const naoAchou = contatoQ.error instanceof ErroDeApi && contatoQ.error.status === 404;
    return (
      <EmptyState
        title={naoAchou ? "Contato não encontrado." : "Não foi possível carregar a conversa."}
        hint={naoAchou ? "Ele pode estar em outro Espaço de Trabalho ou ter sido removido." : "Tente de novo em instantes."}
      />
    );
  }

  if (!fio || !conversasDoContato) {
    return (
      <p role="status" className="app-sm p-3" style={{ color: "var(--texto-3)" }}>
        Carregando a conversa…
      </p>
    );
  }

  if (!fio.some((c) => c.alcancavel)) {
    return (
      <EmptyState
        title="Nenhum Canal deste Espaço alcança este Contato."
        hint="Sem um Identificador do tipo de um Canal ativo não há por onde conversar."
      />
    );
  }

  return (
    <div className={cn("flex h-full min-h-0 flex-col", !flush && "painel")}>
      <ConfirmDialog
        open={confirmandoEnvio}
        title={`Enviar a ${nomeDoContato} por ${canal ? rotuloDoCanalNasTabelas(canal) : ""}?`}
        description={`${conversa ? "Esta Mensagem sai da plataforma." : "Esta é a primeira Mensagem: ela abre a Conversa neste Canal e sai da plataforma."} Depois de enviada, nada aqui a apaga do lado de quem recebeu.`}
        confirmLabel="Enviar"
        {...(enviando ? { confirmDisabledReason: "Enviando a Mensagem…" } : {})}
        confirmCarregando={enviando}
        onConfirm={() => void enviar()}
        onCancel={() => setConfirmandoEnvio(false)}
      >
        <p
          className="app-base rounded-[var(--r-controle)] px-3 py-2"
          style={{ background: "var(--superficie-2)", color: "var(--texto)" }}
        >
          {draft.trim() !== "" ? draft : anexo ? `Arquivo: ${anexo.arquivo.name}` : ""}
        </p>
        {draft.trim() !== "" && anexo ? (
          <p className="app-sm mt-2" style={{ color: "var(--texto-3)" }}>
            Com o arquivo {anexo.arquivo.name}
          </p>
        ) : null}
      </ConfirmDialog>

      {/* ── abas de Canal ── */}
      <div
        role="tablist"
        aria-label="Canais de comunicação"
        className="flex shrink-0 flex-wrap items-center gap-1 px-2"
        style={{ borderBottom: "1px solid var(--linha)" }}
      >
        {/*
          D-14 — a fileira mostra uma aba por Canal ativo do Espaço, sempre na
          mesma ordem. Os que este Contato não alcança vêm desligados dizendo
          por quê, em vez de sumirem: uma barra que muda de tamanho a cada
          Contato faz procurar a aba, e some justamente com a informação de que
          falta um Identificador.
        */}
        {fio.map(({ canal: canalDaFileira, alcancavel }) => {
          const IconeDoCanal = CHANNEL_ICON[canalDaFileira.tipo];
          const quantas = conversasDoContato.filter(
            (c) => c.canalId === canalDaFileira.id,
          ).length;
          const ativa = canal?.id === canalDaFileira.id;
          const motivo = alcancavel
            ? undefined
            : `Este Contato não tem ${ROTULO_DO_TIPO_DE_IDENTIFICADOR[TIPO_DE_IDENTIFICADOR_DO_CANAL[canalDaFileira.tipo]]}.`;
          return (
            <button
              key={canalDaFileira.id}
              type="button"
              role="tab"
              aria-selected={ativa}
              aria-disabled={!alcancavel}
              title={motivo}
              onClick={
                alcancavel
                  ? () => {
                      setCanalAtivo(canalDaFileira.id);
                      setRegistro(null);
                      onCanalChange?.(canalDaFileira.id);
                      setDraft("");
                    }
                  : undefined
              }
              data-ativo={ativa && registro === null}
              className={cn(
                "app-base flex items-center gap-2 whitespace-nowrap px-3 py-2 transition-colors",
                ativa && registro === null
                  ? "sublinhado font-medium text-[var(--texto)]"
                  : alcancavel
                    ? "sublinhado text-[var(--texto-3)] hover:text-[var(--texto)]"
                    : "cursor-not-allowed text-[var(--texto-3)] opacity-40",
              )}
            >
              {/* Ícone de marca não é Lucide: recebe a medida do sistema pela classe. */}
              <IconeDoCanal className="size-[var(--icone-sm)] shrink-0" aria-hidden="true" />
              {rotuloDoCanalNasTabelas(canalDaFileira)}
              {quantas > 0 ? <Contador valor={quantas} /> : null}
              {motivo ? <span className="sr-only">{motivo}</span> : null}
            </button>
          );
        })}

        {/*
          A Reunião fecha os Canais: ela também é falar com a pessoa, só que ao
          vivo. Não é Canal na ontologia (é Tarefa de Tipo Reunião), mas separá-la
          daqui faria o Closer procurar a call em outro lugar no meio do
          atendimento.
        */}
        {agenda.length > 0 ? (
          <button
            type="button"
            role="tab"
            aria-selected={registro === "meet"}
            onClick={() => setRegistro(registro === "meet" ? null : "meet")}
            data-ativo={registro === "meet"}
            className={cn(
              "sublinhado app-base flex items-center gap-2 whitespace-nowrap px-3 py-2 transition-colors",
              registro === "meet"
                ? "font-medium text-[var(--texto)]"
                : reuniaoAoVivo
                  ? "font-medium text-[var(--sucesso)]"
                  : "text-[var(--texto-3)] hover:text-[var(--texto)]",
            )}
          >
            <Icone de={Video} />
            Meet
            {agenda.length > 1 ? <Contador valor={agenda.length} /> : null}
            {reuniaoAoVivo ? (
              <span
                aria-label="Reunião em andamento"
                className="pilula-ponto"
                style={{ background: "var(--sucesso)" }}
              />
            ) : null}
          </button>
        ) : (
          <span
            title="Este Contato não tem Reunião marcada."
            className="app-base flex cursor-not-allowed items-center gap-2 whitespace-nowrap px-3 py-2 text-[var(--texto-3)] opacity-40"
          >
            <Icone de={Video} />
            Meet
            <span className="sr-only">
              Este Contato não tem Reunião marcada.
            </span>
          </span>
        )}

        {/*
          Nota e Tarefa fecham a fileira, separadas por uma linha: as duas NÃO
          são Canais e nada sai da plataforma por elas. Estão aqui porque o
          gesto é o mesmo, registrar algo sobre esta pessoa, e separá-las em
          outro canto obrigaria a procurar em dois lugares.
        */}
        <Divisor vertical className="mx-1" />
        {[
          { aba: "nota" as const, rotulo: "Nota interna", icone: StickyNote },
          { aba: "tarefa" as const, rotulo: "Tarefa", icone: ListTodo },
        ].map(({ aba, rotulo, icone }) => (
          <button
            key={aba}
            type="button"
            role="tab"
            aria-selected={registro === aba}
            onClick={() => setRegistro(registro === aba ? null : aba)}
            data-ativo={registro === aba}
            className={cn(
              "sublinhado app-base flex items-center gap-2 whitespace-nowrap px-3 py-2 transition-colors",
              registro === aba
                ? "font-medium text-[var(--texto)]"
                : "text-[var(--texto-3)] hover:text-[var(--texto)]",
            )}
          >
            <Icone de={icone} />
            {rotulo}
          </button>
        ))}
      </div>

      {/* ── o Canal da aba e a regra dele, ditos onde ela morde (D-13) ── */}
      {canal && IconeDaAba && capacidades && registro !== "meet" ? (
        <div
          data-regra-do-canal="true"
          className="app-sm flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2"
          style={
            janelaFechada || canal?.conexao === "com_erro"
              ? {
                  background: "var(--aviso-lavado)",
                  color: "var(--aviso)",
                  borderBottom: "1px solid var(--linha)",
                }
              : { color: "var(--texto-3)" }
          }
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <IconeDaAba className="size-[var(--icone-xs)] shrink-0" aria-hidden="true" />
            <span className="truncate font-medium">{canal.nome}</span>
          </span>
          <SeloDoProvedor canal={canal} />
          <MarcaDeConexaoSimulada canal={canal} />
          <span>
            {capacidades.responseWindowHours === undefined
              ? "sem janela de resposta"
              : janelaFechada && abertaAte
                ? `janela expirada em ${fmt.instant(abertaAte.toISOString())} — só Mensagem de modelo aprovada`
                : abertaAte
                  ? `janela de resposta até ${fmt.instant(abertaAte.toISOString())}`
                  : `janela de ${capacidades.responseWindowHours}h após a Mensagem recebida`}
            {canal.conexao === "com_erro"
              ? " · Canal com erro de conexão"
              : ""}
          </span>
        </div>
      ) : null}

      {semConsentimentoDeMarketing && registro !== "meet" ? (
        <p
          data-aviso="consentimento-de-marketing"
          className="app-sm shrink-0 px-3 py-2"
          style={{ background: "var(--aviso-lavado)", color: "var(--aviso)", borderBottom: "1px solid var(--linha)" }}
        >
          {primeiroNome || "Este Contato"} não tem consentimento vigente para marketing neste Canal. Mensagem de modelo
          de marketing só sai com o consentimento registrado na ficha do Contato.
        </p>
      ) : null}

      {registro !== null ? (
        <div className={cn("relative min-h-0 flex-1 overflow-y-auto p-3", CLASSE_DO_FIO_EMPILHADO)}>
          {registro === "meet" ? (
            /*
              A aba não pula direto para a call: uma reunião custa a hora do
              Closer e a do lead, e entrar sem saber o objetivo, quem estará na
              sala e quanto está em jogo é entrar despreparado. A lista diz isso
              antes, e a call fica a um clique.
            */
            <ul className="pilha-solta">
              {agenda.map((reuniaoDaLista) => {
                const negocio = negocioDaReuniao(reuniaoDaLista.id);
                const aoVivo =
                  statusCategory(state, reuniaoDaLista) === "emAndamento";
                const concluida =
                  statusCategory(state, reuniaoDaLista) === "concluido";
                const participantes = [
                  ...reuniaoDaLista.assignees
                    .filter((a) => a.kind === "member")
                    .map((a) => state.members.find((m) => m.id === a.id))
                    .filter((m) => m !== undefined)
                    .map((m) => ({ id: m.id, nome: m.displayName })),
                  { id: contatoId, nome: nomeDoContato },
                ];
                return (
                  <li key={reuniaoDaLista.id}>
                    <details
                      open={aoVivo}
                      className="item-solto"
                      data-bloco="true"
                      data-destacado={aoVivo ? "true" : undefined}
                      data-atenuado={concluida ? "true" : undefined}
                    >
                      <summary className="flex cursor-pointer flex-wrap items-center gap-2">
                        <Icone de={Video} style={{ color: "var(--texto-3)" }} />
                        <span className="app-md min-w-0 flex-1 truncate" style={{ color: "var(--texto)" }}>
                          {reuniaoDaLista.title}
                        </span>
                        <Pilula tom={aoVivo ? "sucesso" : "neutro"} comPonto={aoVivo}>
                          {aoVivo
                            ? "Em andamento"
                            : concluida
                              ? "Encerrada"
                              : "Agendada"}
                        </Pilula>
                        <span className="app-sm app-numero" style={{ color: "var(--texto-3)" }}>
                          {reuniaoDaLista.dueDate
                            ? fmt.taskDate(reuniaoDaLista.dueDate)
                            : "sem horário"}
                        </span>
                      </summary>

                      <div className="mt-3 grid gap-2 pt-3" style={{ borderTop: "1px solid var(--linha)" }}>
                        <p className="app-coluna">Objetivo</p>
                        <p className="app-base" style={{ color: "var(--texto)" }}>
                          {reuniaoDaLista.description?.trim() ||
                            reuniaoDaLista.title}
                        </p>

                        <p className="app-coluna">
                          Participantes ({participantes.length})
                        </p>
                        <ul className="flex flex-wrap gap-1.5">
                          {participantes.map(({ id, nome }) => (
                            <li key={id}>
                              <Pilula tom="neutro">{nome}</Pilula>
                            </li>
                          ))}
                        </ul>

                        <p className="app-coluna">Em negociação</p>
                        <p className="app-base" style={{ color: "var(--texto)" }}>
                          {negocio
                            ? `${negocio.titulo} · ${negocio.valor ? fmt.money({ amount: Number(negocio.valor), currency: negocio.moeda }) : "sem valor declarado"}`
                            : "Sem Negócio vinculado."}
                        </p>

                        <span className="mt-1">
                          <Link
                            href={`/crm/reunioes/${reuniaoDaLista.id}`}
                            className="btn btn-solido btn-sm"
                          >
                            <Icone de={Video} tamanho="xs" />
                            {aoVivo
                              ? "Participar agora"
                              : concluida
                                ? "Ver a call"
                                : "Abrir a call"}
                          </Link>
                        </span>
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
          ) : registro === "nota" ? (
            <form
              className="grid gap-2"
              onSubmit={(evento) => {
                evento.preventDefault();
                void registrarNota();
              }}
            >
              <p className="app-sm" style={{ color: "var(--texto-3)" }}>
                A Nota fica na ficha do Contato: ela não sai da plataforma e o
                Contato nunca a vê.
              </p>
              <label className="sr-only" htmlFor="nota-da-conversa">
                Nota interna
              </label>
              <textarea
                id="nota-da-conversa"
                rows={4}
                value={textoDoRegistro}
                onChange={(evento) => setTextoDoRegistro(evento.target.value)}
                placeholder="O que ficou combinado, o que reparar na próxima conversa…"
                className="campo"
              />
              <span>
                <Button
                  type="submit"
                  disabled={textoDoRegistro.trim() === "" || salvandoNota}
                  disabledReason={salvandoNota ? "Registrando a nota…" : "Escreva a nota antes de salvar."}
                >
                  Registrar nota
                </Button>
              </span>
            </form>
          ) : (
            <form
              className="grid gap-2"
              onSubmit={(evento) => {
                evento.preventDefault();
                /*
                  C35 — numa Lista conversacional a Tarefa nasce COM este
                  Contato e a conversa do Canal ativo; numa operacional, pelo
                  título, como sempre. O `createTask` recusaria a conversacional
                  sem Contato — aqui ele já está.

                  Fase 14 (3.3.4): a conversacional nasce por
                  `POST /tarefas-conversacionais` (só os ids; o servidor confere
                  Contato e Canal nas tabelas) e a tela re-hidrata o store depois
                  (A5). O fio inteiro troca de base na 3.4.2; este botão já fala
                  com a api. Sem `mensagem`: a Conversa do fio já está aberta, e
                  se ela estiver resolvida a api pede a primeira Mensagem (D-07)
                  e a recusa aparece aqui.
                */
                const conversacional = listaConversacional(state, listaDaTarefa);
                const listaEscolhida = state.lists.find((l) => l.id === listaDaTarefa);
                // C36 por Canal — a Tarefa nasce por um canal de atendimento da
                // Lista, e só pelo Canal desta aba (não por outro do mesmo tipo).
                const channelId = conversacional
                  ? canaisDaListaNasTabelas(listaEscolhida, canais ?? []).find((ch) => ch.id === canal?.id)?.id
                  : undefined;
                if (conversacional && !channelId) {
                  setAviso(null);
                  setErro(
                    listaSemCanaisNasTabelas(listaEscolhida, canais ?? [])
                      ? LISTA_SEM_CANAIS
                      : `Esta Lista não atende por “${canal?.nome ?? "este Canal"}”.`,
                  );
                  return;
                }
                if (conversacional && channelId) {
                  setCriandoTarefa(true);
                  void criarTarefaConversacional({
                    listId: listaDaTarefa,
                    contatoId,
                    canalId: channelId,
                    title: textoDoRegistro,
                    ...(tipoDaTarefa ? { taskTypeId: tipoDaTarefa } : {}),
                  })
                    // Se o `GET /estado` falhar a Tarefa já existe: o aviso vale e a revisão do Espaço alcança o store depois.
                    .then(() => rehidratar().catch(() => undefined))
                    .then(() => {
                      setErro(null);
                      setAviso("Tarefa criada com o Contato e atribuída a você.");
                      setTextoDoRegistro("");
                    })
                    .catch((falha: unknown) => {
                      setAviso(null);
                      setErro(falha instanceof ErroDeApi ? falha.message : "Não foi possível criar a Tarefa. Tente de novo.");
                    })
                    .finally(() => setCriandoTarefa(false));
                  return;
                }
                const resultado = run((data, memberId) =>
                  createTask(data, memberId, {
                    listId: listaDaTarefa,
                    title: textoDoRegistro,
                    assignees: [{ kind: "member", id: memberId }],
                    ...(tipoDaTarefa ? { taskTypeId: tipoDaTarefa } : {}),
                  }),
                );
                if (resultado.ok) {
                  setErro(null);
                  setAviso("Tarefa criada e atribuída a você.");
                  setTextoDoRegistro("");
                } else {
                  setAviso(null);
                  setErro(resultado.error);
                }
              }}
            >
              <p className="app-sm" style={{ color: "var(--texto-3)" }}>
                A Tarefa nasce dentro de uma Lista, e é ela que define o Status
                inicial.
                {listaDaTarefa && listaConversacional(state, listaDaTarefa)
                  ? ` Nesta Lista ela nasce com ${primeiroNome} e a conversa do Canal “${canal?.nome ?? "este Canal"}”.`
                  : ""}
              </p>
              <label className="sr-only" htmlFor="titulo-da-tarefa">
                Título da Tarefa
              </label>
              <input
                id="titulo-da-tarefa"
                value={textoDoRegistro}
                onChange={(evento) => setTextoDoRegistro(evento.target.value)}
                placeholder={`Retomar com ${primeiroNome}…`}
                className="campo"
              />
              <label className="sr-only" htmlFor="lista-da-tarefa">
                Lista
              </label>
              <Select
                id="lista-da-tarefa"
                value={listaDaTarefa}
                onChange={setListaDaTarefa}
                searchable
                placeholder="Escolha a Lista"
                options={state.lists
                  .filter((lista) => lista.lifecycle === "ativo")
                  .map((lista) => {
                    // O modelo da Lista decide o que nasce: dito antes de escolher.
                    // E a conversacional só recebe a Tarefa se atende pelo canal desta aba (C36).
                    const conversacional = lista.modeloDeTarefa === "conversacional";
                    const motivo = !conversacional
                      ? undefined
                      : listaSemCanaisNasTabelas(lista, canais ?? [])
                        ? LISTA_SEM_CANAIS
                        : canal && !canaisDaListaNasTabelas(lista, canais ?? []).some((ch) => ch.id === canal.id)
                          ? `Esta Lista não atende por “${canal.nome}”.`
                          : undefined;
                    return {
                      value: lista.id,
                      label: lista.name,
                      detail: conversacional ? "Conversacional" : "Operacional",
                      ...(motivo ? { disabledReason: motivo } : {}),
                    };
                  })}
              />
              {/* O Tipo, depois da Lista: é ela que diz quais existem. */}
              {listaDaTarefa ? (
                <SeletorDeTipoDeTarefa
                  id="tipo-da-tarefa-da-conversa"
                  state={state}
                  listId={listaDaTarefa}
                  value={tipoDaTarefa}
                  onChange={setTipoDaTarefa}
                  largura="100%"
                />
              ) : null}
              <span>
                <Button
                  type="submit"
                  disabled={
                    textoDoRegistro.trim() === "" || listaDaTarefa === "" || criandoTarefa
                  }
                  disabledReason={
                    criandoTarefa
                      ? "Criando a Tarefa…"
                      : listaDaTarefa === ""
                        ? "Escolha a Lista."
                        : "Dê um título à Tarefa."
                  }
                >
                  Criar Tarefa
                </Button>
              </span>
            </form>
          )}

          {aviso ? (
            <p role="status" className="app-sm mt-2" style={{ color: "var(--sucesso)" }}>
              {aviso}
            </p>
          ) : null}
          {erro ? (
            <p role="alert" className="app-sm mt-2" style={{ color: "var(--erro)" }}>
              {erro}
            </p>
          ) : null}
        </div>
      ) : (
        <>
          {/* ── a conversa ── */}
          <div
            data-fio="mensagens"
            className={cn("relative min-h-0 flex-1 space-y-3 overflow-y-auto p-3", CLASSE_DO_FIO_EMPILHADO)}
          >
            {!conversa ? (
              <EmptyState
                title={`Nenhuma Conversa em ${canal ? rotuloDoCanalNasTabelas(canal) : "nenhum Canal"}.`}
                hint="A Conversa nasce quando a Mensagem do Contato chega — ou agora, com a sua primeira Mensagem, escrita abaixo."
              />
            ) : (
              marcadoresDeCanal(
                mensagens.map((mensagem) => ({ channelId: mensagem.canalId, mensagem })),
              ).map((marcador, posicaoNoFio) => {
                  // D-13: o separador "via …" só aparece quando a sequência troca de
                  // Canal; numa aba por Canal ela é de um Canal só. Bolhas sem selo.
                  if (marcador.tipo === "via") {
                    const canalDoMarcador = canais?.find(
                      (ch) => ch.id === marcador.channelId,
                    );
                    return canalDoMarcador ? (
                      <SeparadorDeCanal
                        key={`via-${posicaoNoFio}`}
                        canal={canalDoMarcador}
                      />
                    ) : null;
                  }
                  const { mensagem } = marcador.item;
                  const saiu = mensagem.direcao === "enviada";
                  const interna = mensagem.direcao === "interna";
                  /*
                   * O rosto de quem falou, dos dois lados: quem atendeu à direita,
                   * o Contato à esquerda. Sem isso, uma conversa em que três
                   * pessoas do time responderam parece ter uma voz só — e a
                   * Mensagem do Agente ficaria indistinguível da do Membro, que é
                   * exatamente o que B18 proíbe.
                   */
                  const quemFalou = state.members.find(
                    (m) => m.id === mensagem.ator.id,
                  );
                  const agente = state.agents.find(
                    (a) => a.id === mensagem.ator.id,
                  );
                  const avatar =
                    mensagem.direcao === "recebida" ? (
                      <AvatarDoContato nome={contato?.nome} sobrenome={contato?.sobrenome} />
                    ) : (
                      <ActorAvatar
                        kind={mensagem.ator.tipo}
                        name={
                          quemFalou?.displayName ??
                          agente?.name ??
                          // Uma `enviada` do Canal como Integração é a que a pessoa digitou no celular (4.4.2).
                          (mensagem.ator.tipo === "integration" ? "Celular" : "Sistema")
                        }
                        size="grande"
                        {...(quemFalou?.photoFileId
                          ? { photoFileId: quemFalou.photoFileId }
                          : {})}
                      />
                    );

                  return (
                    <div
                      key={mensagem.id}
                      className={`flex items-end gap-2 ${saiu ? "justify-end" : "justify-start"}${mensagem.id === recemEnviada ? " surgir" : ""}`}
                    >
                      {!saiu ? avatar : null}
                      <div
                        className={cn(
                          "app-base max-w-[80%] rounded-[var(--r-painel)] px-3 py-2",
                          interna
                            ? "border border-[var(--cor-atencao-traco)] bg-[var(--cor-atencao-fraco)] text-[var(--cor-atencao-texto)]"
                            : saiu
                              ? "bg-[var(--acento)] text-[var(--sobre-acento)]"
                              : "bg-[var(--superficie-2)] text-[var(--texto)]",
                        )}
                      >
                        {interna ? (
                          <p className="app-sm mb-1 font-medium">
                            Nota interna — não foi enviada
                          </p>
                        ) : null}
                        {/* T-15-50: o texto vem de terceiros e entra como texto do React, nunca como HTML. */}
                        {mensagem.conteudo || mensagem.anexos.length === 0 ? (
                          <p className="whitespace-pre-wrap">
                            {mensagem.conteudo ?? ""}
                          </p>
                        ) : null}
                        {/* 3.9.5: o anexo vem da URL assinada de `GET /mensagens/:id/anexos/:indice`; a legenda é o `conteudo`. */}
                        {mensagem.anexos.length > 0 ? (
                          <div className={cn("flex flex-col gap-2", mensagem.conteudo ? "mt-2" : "")}>
                            {mensagem.anexos.map((anexo, indice) => (
                              <AnexoDaMensagemNoFio key={`${mensagem.id}:${indice}`} mensagemId={mensagem.id} indice={indice} anexo={anexo} />
                            ))}
                          </div>
                        ) : null}
                        <p
                          className={cn(
                            "app-sm mt-1",
                            saiu && !interna ? "opacity-80" : "text-[var(--texto-3)]",
                          )}
                        >
                          {quemFalou?.displayName ?? agente?.name ?? ""}
                          {quemFalou || agente ? " · " : ""}
                          {fmt.instant(mensagem.criadoEm)}
                          {saiu && mensagem.statusEntrega ? (
                            <>
                              {" · "}
                              <EstadoDaEntrega mensagem={mensagem} />
                            </>
                          ) : null}
                        </p>
                      </div>
                      {saiu ? avatar : null}
                    </div>
                  );
                })
            )}
          </div>

          {/* ── compositor ── */}
          <div className="shrink-0" style={{ borderTop: "1px solid var(--linha)" }}>
            <div className="px-3 pt-3 empty:hidden">
              <div className="mb-2">
                <SeletorDeCanalDeResposta
                  canais={canais ?? []}
                  identificadores={identificadores ?? []}
                  canalId={canal?.id ?? null}
                  onTrocar={trocarCanalDeResposta}
                />
              </div>
              {aviso ? (
                <p role="status" className="app-sm mb-2" style={{ color: "var(--sucesso)" }}>
                  {aviso}
                </p>
              ) : null}
              {erro ? (
                <p role="alert" className="app-sm mb-2" style={{ color: "var(--erro)" }}>
                  {erro}
                </p>
              ) : null}
              {/*
          O e-mail é o único Canal com assunto e cópias (`hasSubjectAndCopies`).
          Mostrar esses campos nos outros seria prometer um envio que o Canal
          não tem como fazer.
        */}
              {capacidades?.hasSubjectAndCopies ? (
                <div className="mb-2 grid gap-1.5">
                  <label className="sr-only" htmlFor="assunto-mensagem">
                    Assunto
                  </label>
                  <input
                    id="assunto-mensagem"
                    value={assunto}
                    onChange={(evento) => setAssunto(evento.target.value)}
                    placeholder="Assunto"
                    className="campo"
                  />
                  <div className="grid grid-cols-2 gap-1.5">
                    <span className="min-w-0">
                      <label className="sr-only" htmlFor="copia-mensagem">
                        Cc
                      </label>
                      <input
                        id="copia-mensagem"
                        value={copia}
                        onChange={(evento) => setCopia(evento.target.value)}
                        placeholder="Cc"
                        className="campo"
                      />
                    </span>
                    <span className="min-w-0">
                      <label
                        className="sr-only"
                        htmlFor="copia-oculta-mensagem"
                      >
                        Cco
                      </label>
                      <input
                        id="copia-oculta-mensagem"
                        value={copiaOculta}
                        onChange={(evento) =>
                          setCopiaOculta(evento.target.value)
                        }
                        placeholder="Cco"
                        className="campo"
                      />
                    </span>
                  </div>
                </div>
              ) : null}

              {/*
          A barra de anexos é a do CANAL: cada categoria aceita os tipos que ele
          envia (`tiposAceitosParaOCanal`), não um menu fixo, e cada uma abre o
          seletor de arquivo com o `accept` desses tipos. Só arquivo de verdade:
          nada de tipo sem conteúdo, nem "ver uma vez", que a api não envia.
        */}
              {categoriasDoCanal.map(({ categoria, rotulo, tipos }) => (
                <input
                  key={categoria}
                  ref={(elemento) => {
                    seletoresDeArquivo.current[categoria] = elemento;
                  }}
                  type="file"
                  hidden
                  aria-label={`Escolher ${rotulo.toLowerCase()}`}
                  accept={tipos.join(",")}
                  onChange={(evento) => {
                    const arquivo = evento.target.files?.[0];
                    evento.target.value = "";
                    escolherArquivo(arquivo);
                  }}
                />
              ))}
              {anexando ? (
                <div className="mb-2 flex flex-wrap items-center gap-1">
                  {categoriasDoCanal.map(({ categoria, rotulo, icone }) => (
                    <button
                      key={categoria}
                      type="button"
                      title={`Anexar ${rotulo.toLowerCase()}`}
                      onClick={() => seletoresDeArquivo.current[categoria]?.click()}
                      className={classeDoAlternador(false)}
                    >
                      <Icone de={icone} />
                      {rotulo}
                    </button>
                  ))}
                </div>
              ) : null}

              {anexo ? (
                <p
                  className="item-solto app-sm mb-2"
                  data-estatico="true"
                  style={{ color: "var(--texto-3)" }}
                >
                  <Icone de={Paperclip} tamanho="xs" />
                  <span className="min-w-0 flex-1 truncate">{anexo.arquivo.name}</span>
                  {enviando && anexo.progresso > 0 ? <span className="shrink-0">{anexo.progresso}%</span> : null}
                  <button
                    type="button"
                    disabled={enviando}
                    onClick={() => setAnexo(null)}
                    className="shrink-0 hover:text-[var(--texto)] hover:underline disabled:opacity-60"
                  >
                    Remover
                  </button>
                </p>
              ) : null}

            </div>

            {/*
              Modelo do WhatsApp: uma linha só. O "+" abre os anexos do Canal
              acima da barra; o campo é uma pílula que cresce até seis linhas;
              à direita fica o enviar. Não há botão de gravar: o áudio sai como
              arquivo de áudio anexado (D-16-10). Enter envia, Shift+Enter quebra.
            */}
            {/* A doca do robô flutuante: o fundo fica no invólucro, que vai
                até o canto; a linha encolhe dentro dele quando o robô está
                ali (features/shell/robo-flutuante.tsx). */}
            <div className="doca-do-robo" style={{ background: "var(--superficie-2)" }}>
              <div className="flex items-end gap-2 px-3 py-2">
                {categoriasDoCanal.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setAnexando((aberto) => !aberto)}
                    aria-expanded={anexando}
                    aria-label={anexando ? "Fechar anexos" : "Anexar"}
                    title={anexando ? "Fechar anexos" : "Anexar"}
                    disabled={!conversa}
                    className="btn-icone btn-icone-nu shrink-0 rounded-full"
                    style={MEDIDA_DO_BOTAO_DO_COMPOSITOR}
                  >
                    {/* A rotação fica no SVG folha: transform num elemento com descendente prenderia um `fixed`. */}
                    <Icone
                      de={Plus}
                      tamanho="md"
                      className={cn("rotacao", anexando && "rotate-45")}
                    />
                  </button>
                ) : null}

                <label className="sr-only" htmlFor="compositor-ficha">
                  {conversa ? `Escrever para ${nomeDoContato}` : "Primeira Mensagem"}
                </label>
                <textarea
                  id="compositor-ficha"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey && bloqueio === undefined) {
                      event.preventDefault();
                      setConfirmandoEnvio(true);
                    }
                  }}
                  rows={1}
                  disabled={!canal}
                  placeholder={conversa ? "Digite uma mensagem" : "Escreva a primeira Mensagem"}
                  className="app-base max-h-40 min-h-10 min-w-0 flex-1 resize-none border-0 bg-[var(--page)] px-4 py-2.5 outline-none [field-sizing:content] placeholder:text-[var(--texto-3)] disabled:opacity-50"
                  style={{ borderRadius: "calc(var(--controle-h) / 2)" }}
                />

                <Button
                  variant="primary"
                  onClick={() => setConfirmandoEnvio(true)}
                  disabled={bloqueio !== undefined}
                  disabledReason={bloqueio ?? ""}
                  icon={<Icone de={Send} />}
                >
                  <span className="sr-only">Enviar</span>
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** O contador de uma aba, no mesmo desenho do das Abas do sistema. */
function Contador({ valor }: { readonly valor: number }) {
  return (
    <span
      className="app-xs app-numero rounded-full px-1.5"
      style={{ background: "var(--superficie-3)", color: "var(--texto-3)" }}
    >
      {valor}
    </span>
  );
}
