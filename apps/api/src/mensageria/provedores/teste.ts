/**
 * O provedor de teste (3.6.1, D-16-03): serve ao CI e à demonstração da Caixa num Canal SIMULADO.
 *
 * Nunca faz requisição de rede: `baixarMidia` lê só do depósito em memória (`guardarMidia`), sem seguir
 * URL (sem SSRF), e `enviar` grava em memória e devolve `idExterno = "teste-<uuid>"`, ou o próximo
 * resultado programado. Não existe segredo fixo: `verificarChamada` compara o cabeçalho com o segredo
 * do webhook DAQUELE Canal (que vem do cofre) em tempo constante, e recusa sem ele.
 *
 * Quem decide se um Canal pode usá-lo é `provedorDoCanal` (só `conexaoSimulada = true`). Por defesa em
 * profundidade, `enviar` recusa um Canal real mesmo que alguém o chame direto: uma Mensagem de um Canal
 * real nunca é dada como enviada por aqui (MSG-05).
 *
 * O corpo aceito é o simples `{ eventos: [...] }`, com três formas (`mensagem`, `status`, `conexao`).
 * Nada aqui loga corpo, texto, telefone nem segredo.
 */

import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { CONEXOES_DO_CANAL, type ConexaoDoCanal } from "@n1/dominio/crm/canais";
import { TIPOS_IDENTIFICADOR_CONTATO } from "@n1/dominio/crm/contatos";
import { STATUS_DE_ENTREGA } from "@n1/dominio/crm/mensagens";
import {
  CABECALHO_DO_SEGREDO,
  ErroDeProvedor,
  type CanalParaProvedor,
  type ChamadaDoWebhook,
  type EnvioAoProvedor,
  type EventoDoProvedor,
  type MidiaBaixada,
  type ProvedorDeMensageria,
  type ResultadoDoEnvio,
} from "../provedor";

export type ProvedorDeTeste = ProvedorDeMensageria & {
  /** Tudo que `enviar` recebeu, na ordem. */
  readonly enviados: EnvioAoProvedor[];
  /** Os próximos resultados de `enviar`, na ordem; acabando, volta ao sucesso. */
  programarEnvio(...resultados: ResultadoDoEnvio[]): void;
  guardarMidia(referencia: string, midia: MidiaBaixada): void;
  esquecerMidia(referencia: string): void;
  limpar(): void;
};

const instante = z.iso.datetime({ offset: true });

const mensagem = z
  .object({
    tipo: z.literal("mensagem"),
    idExterno: z.string().min(1),
    remetente: z
      .object({
        tipo: z.enum(TIPOS_IDENTIFICADOR_CONTATO),
        valor: z.string().min(1),
        nomeExibido: z.string().min(1).optional(),
      })
      .strict(),
    conteudo: z.string().optional(),
    anexos: z
      .array(
        z.object({ referenciaNoProvedor: z.string().min(1), tipoDeMidia: z.string().min(1), nome: z.string().min(1) }).strict(),
      )
      .optional(),
    emRespostaAIdExterno: z.string().min(1).optional(),
    assunto: z.string().optional(),
    criadoEm: instante.optional(),
  })
  .strict();

const status = z
  .object({
    tipo: z.literal("status"),
    idExterno: z.string().min(1),
    status: z.enum(STATUS_DE_ENTREGA),
    em: instante,
    motivo: z.string().optional(),
  })
  .strict();

const conexao = z
  .object({ tipo: z.literal("conexao"), conexao: z.enum(CONEXOES_DO_CANAL), motivo: z.string().optional() })
  .strict();

const corpoDoTeste = z.object({ eventos: z.array(z.discriminatedUnion("tipo", [mensagem, status, conexao])).min(1) }).strict();

function iguais(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function criarProvedorDeTeste(): ProvedorDeTeste {
  const enviados: EnvioAoProvedor[] = [];
  const programados: ResultadoDoEnvio[] = [];
  const midias = new Map<string, MidiaBaixada>();

  return {
    provedor: "teste",
    enviados,

    verificarChamada(chamada: ChamadaDoWebhook, canal: CanalParaProvedor): boolean {
      const esperado = canal.segredoDoWebhook;
      if (esperado === undefined || esperado === "") return false;
      const recebido = chamada.cabecalhos[CABECALHO_DO_SEGREDO];
      if (recebido === undefined || recebido === "") return false;
      return iguais(recebido, esperado);
    },

    interpretarChamada(corpo: unknown): readonly EventoDoProvedor[] {
      const lido = corpoDoTeste.safeParse(corpo);
      if (!lido.success) return [{ tipo: "ignorado", motivo: "formato_invalido" }];
      const brutos = (corpo as { eventos: unknown[] }).eventos;
      return lido.data.eventos.map((evento, i): EventoDoProvedor => {
        if (evento.tipo === "mensagem") {
          const { criadoEm, ...resto } = evento;
          return { ...resto, criadoEm: criadoEm === undefined ? new Date().toISOString() : new Date(criadoEm).toISOString(), cargaBruta: brutos[i] };
        }
        if (evento.tipo === "status") return { ...evento, em: new Date(evento.em).toISOString() };
        return evento;
      });
    },

    chaveDaChamada(corpo: unknown): string | undefined {
      if (typeof corpo !== "object" || corpo === null) return undefined;
      const eventos = (corpo as { eventos?: unknown }).eventos;
      const primeiro = Array.isArray(eventos) ? (eventos[0] as { idExterno?: unknown } | undefined) : undefined;
      const id = primeiro?.idExterno;
      return typeof id === "string" && id !== "" ? id : undefined;
    },

    async enviar(canal: CanalParaProvedor, envio: EnvioAoProvedor): Promise<ResultadoDoEnvio> {
      if (!canal.canal.conexaoSimulada) {
        return {
          ok: false,
          transitorio: false,
          codigo: "PROVEDOR_INDISPONIVEL",
          motivo: "O provedor de teste só envia por Canal simulado.",
        };
      }
      enviados.push(envio);
      return programados.shift() ?? { ok: true, idExterno: `teste-${randomUUID()}` };
    },

    async baixarMidia(_canal: CanalParaProvedor, referenciaNoProvedor: string, opcoes: { tetoBytes: number }): Promise<MidiaBaixada> {
      const midia = midias.get(referenciaNoProvedor);
      if (!midia) throw new ErroDeProvedor("MIDIA_INDISPONIVEL", "A mídia não está disponível no provedor.");
      if (midia.bytes.byteLength > opcoes.tetoBytes) {
        throw new ErroDeProvedor("MIDIA_GRANDE_DEMAIS", "A mídia passa do teto de tamanho.");
      }
      return midia;
    },

    async estadoDaConexao(canal: CanalParaProvedor): Promise<ConexaoDoCanal> {
      return canal.canal.conexao;
    },

    programarEnvio(...resultados: ResultadoDoEnvio[]): void {
      programados.push(...resultados);
    },
    guardarMidia(referencia: string, midia: MidiaBaixada): void {
      midias.set(referencia, midia);
    },
    esquecerMidia(referencia: string): void {
      midias.delete(referencia);
    },
    limpar(): void {
      enviados.length = 0;
      programados.length = 0;
      midias.clear();
    },
  };
}

/** A instância do módulo: o registro padrão a entrega para todo Canal simulado. */
export const provedorDeTeste = criarProvedorDeTeste();
