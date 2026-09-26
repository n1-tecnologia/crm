/**
 * AS FRASES DO MICROFONE — o estado da conversa por voz dito em palavras,
 * igual na caixa do assistente e no botão de voz do palco.
 *
 * Desde o fim de 2026-09-23 uma falha do microfone não é mais um aviso longo
 * ("quando o microfone não puder ser conectado, quero que simule a fala"): a
 * conversa segue SIMULADA, e o estado diz o motivo em poucas palavras
 * (`MOTIVO_CURTO`) e o ponto da conversa. Como resolver o microfone
 * (`comoResolver`, com o caminho em cada sistema) fica na dica do botão e no
 * leitor de tela.
 */

import type { Sistema } from "./microfone";
import type { EstadoDoMicrofone, MotivoDaSimulacao, Simulacao } from "./use-assistente-do-robo";

/** Onde, em cada sistema, o microfone é liberado para os programas. */
export const PRIVACIDADE: Readonly<Record<Sistema, string>> = {
  windows:
    "no Windows, Configurações › Privacidade e segurança › Microfone (no Windows 10, Privacidade › Microfone): ligue o acesso, inclusive o dos aplicativos da área de trabalho",
  mac: "no Mac, Ajustes do Sistema › Privacidade e Segurança › Microfone: ative o navegador (e reabra-o se o sistema pedir)",
  outro: "nas configurações de privacidade do sistema, libere o microfone para o navegador",
};

/** No Windows, um atalho direto para a tela de privacidade do microfone. */
export const ATALHO_DO_WINDOWS = "ms-settings:privacy-microphone";

/** Os motivos resolvidos nas configurações do sistema: no Windows, com o atalho. */
export const PELO_SISTEMA: ReadonlySet<MotivoDaSimulacao> = new Set(["sistema", "sem-microfone"]);

/** O microfone de verdade, em palavras (desligado não diz nada). */
export const FRASE_DO_MICROFONE: Readonly<Record<Exclude<EstadoDoMicrofone, "desligado">, string>> = {
  pedindo: "Libere o microfone para falar com o robô.",
  ouvindo: "Pode falar — estou ouvindo.",
  escutando: "Ouvindo você…",
};

/** Por que a conversa é simulada, em poucas palavras. */
export const MOTIVO_CURTO: Readonly<Record<MotivoDaSimulacao, string>> = {
  negado: "Microfone bloqueado no navegador",
  dispensado: "Microfone não permitido",
  sistema: "Microfone bloqueado pelo sistema",
  ocupado: "Microfone em uso por outro programa",
  "sem-microfone": "Nenhum microfone encontrado",
  inseguro: "Microfone só em conexão segura",
  indisponivel: "Este navegador não libera o microfone",
  perdido: "O microfone caiu",
  erro: "O microfone não abriu",
};

/** O que fazer para o microfone de verdade funcionar, depois de encerrar a conversa simulada. */
const DE_NOVO = " Depois, encerre a conversa simulada e toque no microfone de novo.";

/** Como resolver cada motivo, com o caminho no sistema da pessoa. */
export function comoResolver(sistema: Sistema, motivo: MotivoDaSimulacao): string {
  switch (motivo) {
    case "negado":
      return `O navegador bloqueou o microfone: em Informações do site, à esquerda do endereço (ou no ícone do microfone, no fim da barra), escolha Permitir.${DE_NOVO}`;
    case "dispensado":
      return `O microfone ainda não foi permitido: quando o navegador perguntar, escolha Permitir.${DE_NOVO}`;
    case "sistema":
      return `O navegador permitiu, mas o sistema bloqueou o microfone: ${PRIVACIDADE[sistema]}.${DE_NOVO}`;
    case "ocupado":
      return `O microfone está em uso por outro programa: feche-o.${DE_NOVO}`;
    case "sem-microfone":
      return `O navegador não encontra nenhum microfone. Se há um conectado: ${PRIVACIDADE[sistema]}${sistema === "windows" ? "; e em Sistema › Som › Entrada, o microfone ativado" : ""}.${DE_NOVO}`;
    case "inseguro":
      return "O microfone só abre em conexão segura: acesse o app por localhost ou por https.";
    case "indisponivel":
      return "Este navegador não libera o microfone nesta página.";
    case "perdido":
      return `O microfone parou de responder — foi desconectado ou bloqueado.${DE_NOVO}`;
    case "erro":
      return `Não deu para abrir o microfone.${DE_NOVO}`;
  }
}

/**
 * O estado da conversa por voz em palavras: o `aviso` (só na conversa
 * simulada: o motivo) e o que acontece `agora` — o robô respondendo, a fala
 * simulada (a pergunta entre aspas), ou o microfone de verdade.
 *
 * Quem mostra decide o que ANUNCIAR (achado da revisão): na conversa
 * simulada, só o `aviso` vai à região viva — uma vez, quando a conversa
 * começa —, e o `agora` fica só à vista; senão o leitor de tela relia o
 * aviso a cada fase, sem fim, e a pergunta duas vezes (o balão já a anuncia
 * com a resposta). Com o microfone de verdade, o `agora` é o anunciado.
 */
export function estadoEmPalavras({
  microfone,
  respondendo,
  simulacao,
}: {
  readonly microfone: EstadoDoMicrofone;
  readonly respondendo: boolean;
  readonly simulacao: Simulacao | null;
}): { readonly aviso: string; readonly agora: string } {
  if (simulacao) {
    return {
      aviso: `${MOTIVO_CURTO[simulacao.motivo]} — simulando a sua fala.`,
      agora: respondendo
        ? "Respondendo…"
        : simulacao.fase === "falando"
          ? `“${simulacao.pergunta}”`
          : "Toque de novo para encerrar a conversa.",
    };
  }
  return { aviso: "", agora: respondendo ? "Respondendo…" : microfone === "desligado" ? "" : FRASE_DO_MICROFONE[microfone] };
}
