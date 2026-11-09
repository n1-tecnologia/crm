/** Esqueleto do RED (16-02): o provedor de teste ainda não faz nada. */

import type { ConexaoDoCanal } from "@n1/dominio/crm/canais";
import type {
  CanalParaProvedor,
  EnvioAoProvedor,
  EventoDoProvedor,
  MidiaBaixada,
  ProvedorDeMensageria,
  ResultadoDoEnvio,
} from "../provedor";

export type ProvedorDeTeste = ProvedorDeMensageria & {
  readonly enviados: EnvioAoProvedor[];
  programarEnvio(...resultados: ResultadoDoEnvio[]): void;
  guardarMidia(referencia: string, midia: MidiaBaixada): void;
  esquecerMidia(referencia: string): void;
  limpar(): void;
};

export function criarProvedorDeTeste(): ProvedorDeTeste {
  const enviados: EnvioAoProvedor[] = [];
  return {
    provedor: "teste",
    enviados,
    verificarChamada: () => false,
    interpretarChamada: (): readonly EventoDoProvedor[] => [],
    async enviar(): Promise<ResultadoDoEnvio> {
      return { ok: false, transitorio: false, codigo: "NAO_IMPLEMENTADO", motivo: "esqueleto" };
    },
    async baixarMidia(): Promise<MidiaBaixada> {
      throw new Error("esqueleto");
    },
    async estadoDaConexao(canal: CanalParaProvedor): Promise<ConexaoDoCanal> {
      return canal.canal.conexao;
    },
    programarEnvio: () => undefined,
    guardarMidia: () => undefined,
    esquecerMidia: () => undefined,
    limpar: () => undefined,
  };
}

export const provedorDeTeste = criarProvedorDeTeste();
