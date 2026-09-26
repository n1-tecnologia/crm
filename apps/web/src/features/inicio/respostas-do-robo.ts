/**
 * AS RESPOSTAS EM TEXTO DO ROBÔ — o que ele "diz" quando a resposta vira texto
 * (silenciado ou com legenda, 2026-09-23: "a opção de silenciar faz com que as
 * respostas do robô se tornem texto… em um balão de chat").
 *
 * Não há modelo por trás (P30). O robô responde com o que o app JÁ SABE — o
 * panorama do Membro, montado na hora a partir do armazém (`panorama-do-robo.ts`):
 * tarefas, notificações, negócios, contatos e conversas — reconhecendo a
 * INTENÇÃO da pergunta por palavras (sem acento, sem maiúscula). O que ele não
 * reconhece, ele diz que não sabe, e diz o que sabe. Uma pergunta que veio pelo
 * MICROFONE (`null`) não tem texto: o robô só reage ao som e diz isso.
 *
 * Puro e testado ao lado. Nada sai do navegador.
 */

/** O que o robô sabe do Membro no instante da pergunta. */
export type Panorama = {
  /** O primeiro nome do Membro (vazio se não há sessão). */
  readonly nome: string;
  readonly tarefas: {
    readonly abertas: number;
    readonly vencidas: number;
    /** Os títulos das vencidas (até três). */
    readonly urgentes: readonly string[];
  };
  readonly notificacoes: {
    readonly total: number;
    readonly mencoes: number;
    readonly aprovacoes: number;
    readonly conversas: number;
    readonly vencidas: number;
  };
  readonly contatos: {
    readonly total: number;
    /** Os nomes dos mais recentes (até três). */
    readonly recentes: readonly string[];
  };
  readonly negocios: {
    readonly abertos: number;
    /** O valor ponderado dos abertos, já formatado — null com mais de uma moeda ou sem valor. */
    readonly valorPonderado: string | null;
  };
  readonly conversas: {
    readonly abertas: number;
    /** As abertas atribuídas ao Membro. */
    readonly minhas: number;
  };
};

/**
 * O ROTEIRO DA CONVERSA SIMULADA (fim de 2026-09-23: "quando o microfone não
 * puder ser conectado, quero que simule a fala e faça uma conversa entre o robô
 * e a fala simulada"): o que a "pessoa" simulada pergunta, em ordem, voltando
 * ao começo. Cada pergunta cai numa intenção que o robô sabe responder — ele
 * responde com o panorama de verdade do Membro.
 */
export const ROTEIRO_SIMULADO: readonly string[] = [
  "Oi, robô! Quem é você?",
  "Quantas tarefas vencidas eu tenho?",
  "E as notificações, o que espera por mim?",
  "Como está o funil de vendas?",
  "Quais são os contatos mais recentes?",
  "Tem conversa aberta na caixa de entrada?",
];

/** A resposta a uma fala pelo microfone: o robô não entende fala, só reage ao som. */
export const FALA_OUVIDA = "Ouvi você, mas ainda não entendo fala — só reajo ao som. Escreva a pergunta que eu respondo em texto.";

/** O que o robô sabe fazer, dito quando ele não reconhece a pergunta. */
const O_QUE_SEI = "tarefas, notificações, negócios, contatos e conversas";

/** Sem acento e sem maiúscula, para comparar palavras. */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** "1 tarefa aberta" / "3 tarefas abertas". */
function contar(quantidade: number, singular: string, plural: string): string {
  return `${quantidade} ${quantidade === 1 ? singular : plural}`;
}

/** "a, b e c". */
function listar(itens: readonly string[]): string {
  if (itens.length <= 1) return itens.join("");
  return `${itens.slice(0, -1).join(", ")} e ${itens.at(-1)}`;
}

/**
 * As intenções, na ORDEM em que ganham: as que leem o app primeiro, a saudação
 * e a ajuda por último ("oi, quantas tarefas eu tenho?" pergunta de tarefas).
 * Cada termo é uma expressão regular sobre o texto normalizado: um radical
 * (`\btarefa` pega "tarefas"; `\bvencid`, "vencida" e "vencidas") ou uma
 * palavra inteira (`\boi\b`, para "foi" não cumprimentar).
 */
const INTENCOES: readonly { readonly nome: string; readonly termos: readonly string[]; readonly responder: (p: Panorama) => string }[] = [
  {
    nome: "tarefas",
    termos: ["\\btarefa", "\\bpendencia", "\\bpendente", "\\bvencid", "\\batrasad", "\\bprazo", "\\ba fazer\\b", "\\bto-?do\\b"],
    responder: ({ tarefas }) => {
      if (tarefas.abertas === 0) return "Você não tem nenhuma tarefa aberta atribuída a você. Nada pendente por enquanto.";
      const vencidas =
        tarefas.vencidas === 0
          ? "nenhuma vencida"
          : `${contar(tarefas.vencidas, "vencida", "vencidas")}${tarefas.urgentes.length ? `: ${listar(tarefas.urgentes)}` : ""}`;
      return `Você tem ${contar(tarefas.abertas, "tarefa aberta", "tarefas abertas")}, ${vencidas}. Está tudo em Minhas Tarefas.`;
    },
  },
  {
    nome: "notificacoes",
    termos: ["\\bnotifica", "\\baviso", "\\bmenc(ao|oes)\\b", "\\baprovac", "\\bespera por mim\\b", "\\bsino\\b", "\\bo que (eu )?tenho\\b"],
    responder: ({ notificacoes }) => {
      if (notificacoes.total === 0) return "Nada espera por você agora: sem menções, aprovações, conversas ou tarefas vencidas.";
      const partes = [
        notificacoes.vencidas ? contar(notificacoes.vencidas, "tarefa vencida", "tarefas vencidas") : "",
        notificacoes.mencoes ? contar(notificacoes.mencoes, "menção", "menções") : "",
        notificacoes.aprovacoes ? contar(notificacoes.aprovacoes, "aprovação", "aprovações") : "",
        notificacoes.conversas ? contar(notificacoes.conversas, "conversa com você", "conversas com você") : "",
      ].filter(Boolean);
      const resto = notificacoes.total - notificacoes.vencidas - notificacoes.mencoes - notificacoes.aprovacoes - notificacoes.conversas;
      if (resto > 0) partes.push(contar(resto, "outro item", "outros itens"));
      return `${contar(notificacoes.total, "coisa espera", "coisas esperam")} por você: ${listar(partes)}. Está tudo no sino, em Notificações.`;
    },
  },
  {
    nome: "negocios",
    termos: ["\\bnegocio", "\\bdeal", "\\bfunil", "\\bvenda", "\\bpipeline\\b", "\\bproposta", "\\bfechamento"],
    responder: ({ negocios }) => {
      if (negocios.abertos === 0) return "Não há negócio aberto no momento. Os funis estão em Negócios.";
      const valor = negocios.valorPonderado ? ` — ${negocios.valorPonderado} em valor ponderado` : "";
      return `Há ${contar(negocios.abertos, "negócio aberto", "negócios abertos")}${valor}. Os funis estão em Negócios.`;
    },
  },
  {
    nome: "contatos",
    termos: ["\\bcontato", "\\bcliente", "\\blead", "\\bpessoa"],
    responder: ({ contatos }) => {
      if (contatos.total === 0) return "Ainda não há contato cadastrado. Eles nascem na Caixa de Entrada ou em Contatos.";
      const recentes = contatos.recentes.length ? `; os mais recentes: ${listar(contatos.recentes)}` : "";
      return `São ${contar(contatos.total, "contato", "contatos")} no Espaço de Trabalho${recentes}. Está tudo em Contatos.`;
    },
  },
  {
    nome: "conversas",
    termos: ["\\bconversa", "\\bcaixa de entrada\\b", "\\bmensage", "\\bwhatsapp\\b", "\\batendimento", "\\bchat\\b"],
    responder: ({ conversas }) => {
      if (conversas.abertas === 0) return "Nenhuma conversa aberta na Caixa de Entrada: está tudo resolvido.";
      const minhas = conversas.minhas ? `, ${contar(conversas.minhas, "delas com você", "delas com você")}` : "";
      return `Há ${contar(conversas.abertas, "conversa aberta", "conversas abertas")} na Caixa de Entrada${minhas}.`;
    },
  },
  {
    nome: "ajuda",
    termos: ["\\bquem (e|eh) voce\\b", "\\bo que voce (faz|sabe)\\b", "\\bajuda", "\\bhelp\\b", "\\bcomo funciona\\b", "\\bo que (eu )?posso\\b"],
    responder: () => `Sou o robô da N1. Sei contar o que espera por você no app: ${O_QUE_SEI}. Pergunte, por exemplo: quantas tarefas vencidas eu tenho?`,
  },
  {
    nome: "saudacao",
    termos: ["\\boi\\b", "\\bola\\b", "\\bbom dia\\b", "\\bboa tarde\\b", "\\bboa noite\\b", "\\be ai\\b", "\\bhey\\b", "\\bhello\\b", "\\bopa\\b"],
    responder: ({ nome }) => `Olá${nome ? `, ${nome}` : ""}! Pergunte sobre suas ${O_QUE_SEI}.`,
  },
];

/** A intenção reconhecida numa pergunta, se alguma. */
export function intencaoDe(pergunta: string): string | null {
  const texto = normalizar(pergunta);
  for (const intencao of INTENCOES) {
    if (intencao.termos.some((termo) => new RegExp(termo).test(texto))) return intencao.nome;
  }
  return null;
}

/** O texto da resposta do robô a `pergunta` (null: veio pelo microfone). */
export function responderEmTexto(pergunta: string | null, panorama: Panorama): string {
  if (pergunta === null) return FALA_OUVIDA;
  const nome = intencaoDe(pergunta);
  const intencao = INTENCOES.find((i) => i.nome === nome);
  if (intencao) return intencao.responder(panorama);
  return `Ainda não sei responder isso — por enquanto só conto o que está no app: ${O_QUE_SEI}. Tente: quantas tarefas vencidas eu tenho?`;
}
