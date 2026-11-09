/**
 * O hub de eventos em memória (16-07, 3.8.3, D-16-01): recebe cada notificação que o ouvinte `LISTEN` lê (`publicar`)
 * e a entrega aos fluxos SSE abertos (`assinar`) do MESMO Espaço. Fica em memória de um processo só: cada instância
 * da api tem o seu ouvinte e o seu hub, e o Postgres leva o aviso a todas.
 *
 * O que vai à aba é `{ tipo, conversaId, mensagemId? }`; o `workspaceId` filtra aqui e não sai do servidor (T-16-24,
 * T-16-27). `podeLer` é a pergunta "este Membro ainda pode ler Conversas?": a rota a faz ao abrir. `disponivel` nasce
 * `false` e só o ouvinte o liga: sem `LISTEN` de pé a rota responde 503 e a tela cai na releitura de 5 s.
 *
 * O handler de `publicar` nunca bloqueia nem faz I/O: o ouvinte tem de consumir sempre (a fila de NOTIFY do Postgres
 * cheia derruba o commit de quem avisa, T-16-26).
 */

import type { EventoDoCrm, EventoParaATela } from "@n1/dominio/crm/eventos";
import type { MembroDaSessao } from "../plugins/autenticacao";

export interface OpcoesDoHubDeEventos {
  /** O Papel do Membro ainda pode ler Conversas? Lido do banco a cada chamada. */
  podeLer(membro: MembroDaSessao): Promise<boolean>;
  readonly maxPorMembro?: number;
  readonly reconferirMs?: number;
}

export interface HubDeEventos {
  /** A pergunta que a rota faz ao abrir o fluxo (a mesma que o hub repete a cada `reconferirMs`). */
  podeLer(membro: MembroDaSessao): Promise<boolean>;
  /** Registra um fluxo. Devolve quem o remove (idempotente, sem chamar `fechar`). */
  assinar(membro: MembroDaSessao, enviar: (evento: EventoParaATela) => void, fechar: () => void): () => void;
  publicar(evento: EventoDoCrm): void;
  /** Fecha todos os fluxos (antes do `app.close()`, que senão pendura com um SSE aberto). */
  encerrarTodos(): void;
  /** O ouvinte liga e desliga; desligar encerra todos os fluxos. */
  definirDisponivel(sim: boolean): void;
  readonly disponivel: boolean;
  readonly assinantes: number;
}

interface Assinante {
  readonly membro: MembroDaSessao;
  readonly enviar: (evento: EventoParaATela) => void;
  readonly fechar: () => void;
}

/** Um Membro é a dupla (Espaço, id): o mesmo id em outro Espaço é outra pessoa. */
const chaveDoMembro = (membro: MembroDaSessao) => `${membro.workspaceId}\u0000${membro.id}`;

export function criarHubDeEventos(opcoes: OpcoesDoHubDeEventos): HubDeEventos {
  // Um `Set` guarda a ordem de inserção: o primeiro de um Membro é sempre o mais antigo.
  const assinantes = new Set<Assinante>();
  const maxPorMembro = opcoes.maxPorMembro ?? 5;
  const reconferirMs = opcoes.reconferirMs ?? 60_000;
  let disponivel = false;
  let temporizador: ReturnType<typeof setInterval> | undefined;
  let reconferindo = false;

  /** Tira o assinante sem fechá-lo; sem ninguém, o temporizador de reconferência para (não segura o processo). */
  function remover(assinante: Assinante): boolean {
    const tirou = assinantes.delete(assinante);
    if (assinantes.size === 0 && temporizador !== undefined) {
      clearInterval(temporizador);
      temporizador = undefined;
    }
    return tirou;
  }

  function encerrar(assinante: Assinante): void {
    if (!remover(assinante)) return;
    try {
      assinante.fechar();
    } catch {
      // um fechar que lança não pode impedir o hub de fechar os outros
    }
  }

  /**
   * O Papel pode mudar com a aba aberta (Membro removido, Papel trocado): a cada volta pergunta de novo por Membro
   * (uma consulta por Membro, não por aba) e fecha quem não pode mais ler Conversas. Um `podeLer` que lança (o banco
   * falhou) não é negação: o fluxo fica e a próxima volta tenta de novo. Voltas não se sobrepõem.
   */
  async function reconferir(): Promise<void> {
    if (reconferindo) return;
    reconferindo = true;
    try {
      const respostas = new Map<string, boolean | undefined>();
      for (const assinante of [...assinantes]) {
        if (!assinantes.has(assinante)) continue;
        const chave = chaveDoMembro(assinante.membro);
        if (!respostas.has(chave)) {
          try {
            respostas.set(chave, await opcoes.podeLer(assinante.membro));
          } catch {
            respostas.set(chave, undefined);
          }
        }
        if (respostas.get(chave) === false) encerrar(assinante);
      }
    } finally {
      reconferindo = false;
    }
  }

  return {
    podeLer: (membro) => opcoes.podeLer(membro),

    assinar(membro, enviar, fechar) {
      const assinante: Assinante = { membro, enviar, fechar };
      assinantes.add(assinante);
      if (temporizador === undefined) {
        temporizador = setInterval(() => void reconferir(), reconferirMs);
        temporizador.unref();
      }
      // T-16-26: aba esquecida. A mais antiga do mesmo Membro cai quando passa do limite.
      const doMembro = [...assinantes].filter((a) => chaveDoMembro(a.membro) === chaveDoMembro(membro));
      for (const antigo of doMembro.slice(0, Math.max(0, doMembro.length - maxPorMembro))) encerrar(antigo);
      return () => {
        remover(assinante);
      };
    },

    publicar(evento) {
      const { workspaceId, ...paraATela } = evento;
      for (const assinante of [...assinantes]) {
        if (assinante.membro.workspaceId !== workspaceId) continue;
        try {
          assinante.enviar(paraATela);
        } catch {
          // um fluxo quebrado não pode atrasar nem esconder o evento dos outros
        }
      }
    },

    encerrarTodos() {
      for (const assinante of [...assinantes]) encerrar(assinante);
    },

    definirDisponivel(sim) {
      disponivel = sim;
      if (!sim) for (const assinante of [...assinantes]) encerrar(assinante);
    },

    get disponivel() {
      return disponivel;
    },

    get assinantes() {
      return assinantes.size;
    },
  };
}
