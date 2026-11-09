/**
 * O processador da fila de entrada (16-03, 3.6.4, MSG-01): reivindica uma linha `pendente` de
 * `plataforma.webhooks_recebidos` por vez (`for update skip locked`: duas instâncias nunca pegam a mesma),
 * interpreta o corpo pelo provedor do Canal e manda cada evento `mensagem` a `receberMensagem`.
 *
 * Nada aqui loga corpo, texto, telefone nem segredo: `registrar` só recebe o id da linha, contagens e
 * códigos.
 */

import type { Pool } from "pg";
import { pool as poolPadrao } from "../persistencia/conexao";
import { criarRepositorioDeCanaisPg } from "../repositorios/crm/canais";
import { lerChavesDoCofre, type ChavesDoCofre } from "../servicos/cofre";
import { criarServicoDeRecebimento, type ServicoDeRecebimento } from "../servicos/crm/recebimento";
import type { Relogio } from "../testes/relogio";
import { relogioDoSistema } from "../testes/relogio";
import { canalParaProvedor, provedorDoCanal, registroPadrao, type RegistroDeProvedores } from "./registro";

export interface OpcoesDoProcessadorDeEntrada {
  /** Identifica esta instância em `locked_by` — dois processos precisam de valores distintos. */
  readonly workerId: string;
  readonly pool?: () => Pool;
  /** Padrão: `lerChavesDoCofre()`, lido quando uma linha é processada. */
  readonly chaves?: ChavesDoCofre;
  readonly registro?: RegistroDeProvedores;
  readonly recebimento?: ServicoDeRecebimento;
  readonly relogio?: Relogio;
  /** Padrão 10 s: só a reserva; quem acorda o processador é a rota do webhook. */
  readonly intervaloMs?: number;
  /** Padrão 8. */
  readonly maxTentativas?: number;
  /** Padrão 2 min: depois disso uma linha `processando` é tida como de um worker que caiu. */
  readonly travaVenceEmMs?: number;
  readonly registrar?: (nivel: "info" | "warn" | "error", mensagem: string, dados?: Record<string, unknown>) => void;
}

export interface ProcessadorDeEntrada {
  /** Começa o laço de `intervaloMs` em `intervaloMs`. Chamar duas vezes é no-op. */
  iniciar(): void;
  /** Para o laço e espera o ciclo em voo. */
  parar(): Promise<void>;
  /** Reivindica e processa UMA linha. Devolve `false` quando não havia linha pronta. */
  processarUm(): Promise<boolean>;
  /** Dispara um ciclo agora (a rota do webhook chama depois do 200). */
  acordar(): void;
}

interface LinhaReivindicada {
  readonly id: string;
  readonly workspace_id: string;
  readonly canal_id: string;
  readonly corpo: unknown;
  readonly tentativas: number;
}

export function criarProcessadorDeEntrada(opcoes: OpcoesDoProcessadorDeEntrada): ProcessadorDeEntrada {
  const pool = opcoes.pool ?? poolPadrao;
  const registro = opcoes.registro ?? registroPadrao();
  const recebimento = opcoes.recebimento ?? criarServicoDeRecebimento({ pool });
  const relogio = opcoes.relogio ?? relogioDoSistema;
  void relogio;

  async function reivindicar(): Promise<LinhaReivindicada | undefined> {
    const r = await pool().query<LinhaReivindicada>(
      `update plataforma.webhooks_recebidos
          set estado = 'processando', locked_at = now(), locked_by = $1, tentativas = tentativas + 1
        where id = (
          select id from plataforma.webhooks_recebidos
           where estado = 'pendente' and disponivel_em <= now()
           order by disponivel_em, id
           limit 1
             for update skip locked
        )
        returning id, workspace_id, canal_id, corpo, tentativas`,
      [opcoes.workerId],
    );
    return r.rows[0];
  }

  async function processar(linha: LinhaReivindicada): Promise<void> {
    const canal = await criarRepositorioDeCanaisPg(pool()).obter(linha.workspace_id, linha.canal_id);
    if (!canal) throw new Error("Canal não encontrado.");
    const chaves = opcoes.chaves ?? lerChavesDoCofre();
    const paraOProvedor = await canalParaProvedor(pool(), chaves, linha.workspace_id, canal);
    const provedor = provedorDoCanal(canal, registro);
    for (const evento of provedor.interpretarChamada(linha.corpo, paraOProvedor)) {
      if (evento.tipo !== "mensagem") continue;
      const { tipo: _tipo, ...recebida } = evento;
      await recebimento.receberMensagem(linha.workspace_id, linha.canal_id, recebida);
    }
    await pool().query(
      "update plataforma.webhooks_recebidos set estado = 'processado', processado_em = now(), locked_at = null, locked_by = null where id = $1",
      [linha.id],
    );
  }

  async function processarUm(): Promise<boolean> {
    const linha = await reivindicar();
    if (!linha) return false;
    await processar(linha);
    return true;
  }

  let temporizador: ReturnType<typeof setInterval> | undefined;

  return {
    iniciar() {
      if (temporizador) return;
      temporizador = setInterval(() => {
        void processarUm().catch(() => undefined);
      }, opcoes.intervaloMs ?? 10_000);
    },
    async parar() {
      if (temporizador) clearInterval(temporizador);
      temporizador = undefined;
    },
    processarUm,
    acordar() {
      void processarUm().catch(() => undefined);
    },
  };
}
