/**
 * A fonte de instante que o código de produção lê, injetada — nunca `new
 * Date()` direto. É o que permite cobrir a janela de 90 dias (D-10) e o
 * backoff do outbox sem esperar tempo real.
 */

export interface Relogio {
  agora(): Date;
  agoraIso(): string;
}

export const relogioDoSistema: Relogio = {
  agora: () => new Date(),
  agoraIso: () => new Date().toISOString(),
};

export interface RelogioFixo extends Relogio {
  /** Soma `ms` ao instante atual. */
  avancar(ms: number): void;
  /** Substitui o instante atual pelo dado. */
  definir(instante: string | Date): void;
}

export function relogioFixo(inicial: string | Date): RelogioFixo {
  let atual = new Date(inicial);
  return {
    agora: () => new Date(atual.getTime()),
    agoraIso: () => atual.toISOString(),
    avancar(ms) {
      atual = new Date(atual.getTime() + ms);
    },
    definir(instante) {
      atual = new Date(instante);
    },
  };
}
