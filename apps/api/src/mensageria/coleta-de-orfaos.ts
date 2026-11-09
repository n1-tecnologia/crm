/** Esqueleto do 16-10 (RED): a coleta de órfãos ainda não faz nada. */
export interface ResultadoDaColeta {
  readonly rodou: boolean;
  readonly sessoesExpiradas: number;
  readonly objetosRemovidos: number;
  readonly objetosDeEntradaRemovidos: number;
}

export interface ColetaDeOrfaos {
  iniciar(): void;
  parar(): Promise<void>;
  rodarUmaVez(): Promise<ResultadoDaColeta>;
}

export function criarColetaDeOrfaos(_opcoes: Record<string, unknown> = {}): ColetaDeOrfaos {
  return {
    iniciar() {},
    async parar() {},
    async rodarUmaVez() {
      return { rodou: false, sessoesExpiradas: 0, objetosRemovidos: 0, objetosDeEntradaRemovidos: 0 };
    },
  };
}
