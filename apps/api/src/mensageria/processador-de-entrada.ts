/**
 * O processador da fila de entrada (16-03, 3.6.4, MSG-01): reivindica uma linha `pendente` de
 * `plataforma.webhooks_recebidos` por vez (`for update skip locked`: duas instâncias nunca pegam a mesma),
 * interpreta o corpo pelo provedor do Canal e manda cada evento `mensagem` a `receberMensagem`.
 *
 * Como cada linha termina:
 *   - `processado`: todos os eventos foram tratados. `resultado` diz o que NÃO virou Mensagem
 *     (`ignorado:<motivo>`, `sem_tratamento:<tipo>`). O evento `status` muda a Mensagem pelo domínio
 *     (`atualizarStatusDeEntrega`: só avança) e deixa `ignorado:status_sem_mensagem` quando nenhuma Mensagem do
 *     Canal tem o id externo, ou `ignorado:status_atrasado` quando o status não avança;
 *   - `falhou` com o `codigo` em `ultimo_erro`: o recebimento recusou por regra (4xx: Canal arquivado,
 *     valor inválido). É permanente: tentar de novo daria a mesma recusa;
 *   - `pendente` de novo, com `disponivel_em` no futuro (`backoff`): uma exceção (banco, cofre, provedor
 *     indisponível) é transitória. Na `maxTentativas`-ésima tentativa vira `falhou`.
 *
 * Queda no meio: uma linha `processando` cujo `locked_at` passou de `travaVenceEmMs` é de um worker que
 * caiu. Ela volta a `pendente` (ou a `falhou/TRAVA_VENCIDA` se já gastou as tentativas, para uma linha que
 * derruba o processo não voltar para sempre). Como `receberMensagem` é idempotente por (Canal, idExterno),
 * reprocessar uma linha que já tinha gravado parte das Mensagens não duplica nada.
 *
 * A rota do webhook chama `acordar()` depois do 200 (Pitfall 3): o laço de `intervaloMs` é só a reserva.
 *
 * Nada aqui loga corpo, texto, telefone nem segredo: `registrar` só recebe o id da linha, contagens e
 * códigos.
 */

import type { Pool } from "pg";
import type { StatusDeEntrega } from "@n1/dominio/crm/mensagens";
import { pool as poolPadrao } from "../persistencia/conexao";
import { backoff, sanitizarErro } from "../persistencia/outbox-worker";
import { criarRepositorioDeCanaisPg } from "../repositorios/crm/canais";
import { criarRepositorioDeMensagensPg } from "../repositorios/crm/mensagens";
import { lerChavesDoCofre, type ChavesDoCofre } from "../servicos/cofre";
import { criarServicoDeRecebimento, type ServicoDeRecebimento } from "../servicos/crm/recebimento";
import type { Relogio } from "../testes/relogio";
import { relogioDoSistema } from "../testes/relogio";
import { FRASES_DA_SAIDA } from "./entregar-mensagem";
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
  /** Só id da linha, contagens e códigos: nunca corpo, texto, telefone nem segredo. */
  readonly registrar?: (nivel: "info" | "warn" | "error", mensagem: string, dados?: Record<string, unknown>) => void;
}

export interface ProcessadorDeEntrada {
  /** Começa o laço de `intervaloMs` em `intervaloMs`. Chamar duas vezes é no-op. */
  iniciar(): void;
  /** Para o laço e espera o ciclo em voo. */
  parar(): Promise<void>;
  /** Reivindica e processa UMA linha. Devolve `false` quando não havia linha pronta. */
  processarUm(): Promise<boolean>;
  /** Dispara um ciclo agora (a rota do webhook chama depois do 200). Ciclo em voo: pede mais uma volta. */
  acordar(): void;
}

interface LinhaReivindicada {
  readonly id: string;
  readonly workspace_id: string;
  readonly canal_id: string;
  readonly corpo: unknown;
  readonly tentativas: number;
}

type Desfecho =
  | { readonly tipo: "processado"; readonly resultado: string | null; readonly eventos: number; readonly mensagens: number }
  | { readonly tipo: "recusada"; readonly codigo: string };

/** O motivo que o provedor deu para a falha, sem `apikey`, Bearer nem documento; vazio vira a frase padrão. */
function motivoDaFalha(motivo: string | undefined): string {
  const limpo = sanitizarErro(motivo ?? "").summary.trim();
  return limpo === "" ? FRASES_DA_SAIDA.recusou : limpo;
}

export function criarProcessadorDeEntrada(opcoes: OpcoesDoProcessadorDeEntrada): ProcessadorDeEntrada {
  const pool = opcoes.pool ?? poolPadrao;
  const registro = opcoes.registro ?? registroPadrao();
  const recebimento = opcoes.recebimento ?? criarServicoDeRecebimento({ pool });
  const relogio = opcoes.relogio ?? relogioDoSistema;
  const intervaloMs = opcoes.intervaloMs ?? 10_000;
  const maxTentativas = opcoes.maxTentativas ?? 8;
  const travaVenceEmMs = opcoes.travaVenceEmMs ?? 120_000;
  const registrar = opcoes.registrar ?? (() => undefined);

  /** Trava vencida: volta a `pendente`, ou a `falhou` se já gastou as tentativas. */
  async function devolverTravasVencidas(): Promise<void> {
    const segundos = travaVenceEmMs / 1000;
    const desistidas = await pool().query(
      `update plataforma.webhooks_recebidos
          set estado = 'falhou', locked_at = null, locked_by = null, ultimo_erro = 'TRAVA_VENCIDA'
        where estado = 'processando' and locked_at < now() - make_interval(secs => $1) and tentativas >= $2`,
      [segundos, maxTentativas],
    );
    const devolvidas = await pool().query(
      `update plataforma.webhooks_recebidos
          set estado = 'pendente', locked_at = null, locked_by = null
        where estado = 'processando' and locked_at < now() - make_interval(secs => $1)`,
      [segundos],
    );
    if ((desistidas.rowCount ?? 0) > 0 || (devolvidas.rowCount ?? 0) > 0) {
      registrar("warn", "travas vencidas da fila de entrada", { devolvidas: devolvidas.rowCount ?? 0, desistidas: desistidas.rowCount ?? 0 });
    }
  }

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

  /**
   * 3.6.5: o status que o provedor informa, numa transação própria (o `for update` do repositório segura a linha da
   * Mensagem até o commit: dois status da mesma Mensagem se aplicam um depois do outro). Devolve o motivo de
   * `resultado` quando o evento não mudou nada.
   */
  async function aplicarStatus(
    linha: LinhaReivindicada,
    evento: { readonly idExterno: string; readonly status: StatusDeEntrega; readonly em: string; readonly motivo?: string },
  ): Promise<string | undefined> {
    const quando = Number.isNaN(Date.parse(evento.em)) ? relogio.agora() : new Date(evento.em);
    const motivo = evento.status === "falhou" ? motivoDaFalha(evento.motivo) : undefined;
    const cliente = await pool().connect();
    try {
      await cliente.query("begin");
      const r = await criarRepositorioDeMensagensPg(cliente).atualizarStatusDeEntrega(
        linha.workspace_id,
        linha.canal_id,
        evento.idExterno,
        evento.status,
        quando.toISOString(),
        motivo,
      );
      await cliente.query("commit");
      if (r === undefined) return "ignorado:status_sem_mensagem";
      return r.mudou ? undefined : "ignorado:status_atrasado";
    } catch (erro) {
      await cliente.query("rollback").catch(() => undefined);
      throw erro;
    } finally {
      cliente.release();
    }
  }

  async function processar(linha: LinhaReivindicada): Promise<Desfecho> {
    const canal = await criarRepositorioDeCanaisPg(pool()).obter(linha.workspace_id, linha.canal_id);
    if (!canal) return { tipo: "recusada", codigo: "CANAL_NAO_ENCONTRADO" };
    // Arquivado depois da chamada: sem provedor para ele (um Canal arquivado nunca é simulado), e o
    // recebimento o recusaria do mesmo jeito. Recusa permanente, sem passar pelo registro.
    if (canal.estado === "arquivado") return { tipo: "recusada", codigo: "CANAL_ARQUIVADO" };

    const chaves = opcoes.chaves ?? lerChavesDoCofre();
    const paraOProvedor = await canalParaProvedor(pool(), chaves, linha.workspace_id, canal);
    const provedor = provedorDoCanal(canal, registro);
    const eventos = provedor.interpretarChamada(linha.corpo, paraOProvedor);

    const resultados = new Set<string>();
    let recusa: string | undefined;
    let mensagens = 0;
    for (const evento of eventos) {
      if (evento.tipo === "mensagem") {
        const { tipo: _tipo, ...recebida } = evento;
        const r = await recebimento.receberMensagem(linha.workspace_id, linha.canal_id, recebida);
        if (r.ok) mensagens += 1;
        else recusa ??= r.codigo ?? `RECUSADA_${r.status}`;
      } else if (evento.tipo === "ignorado") {
        resultados.add(`ignorado:${evento.motivo}`);
      } else if (evento.tipo === "status") {
        const resultado = await aplicarStatus(linha, evento);
        if (resultado !== undefined) resultados.add(resultado);
      } else {
        resultados.add(`sem_tratamento:${evento.tipo}`);
      }
    }
    if (recusa !== undefined) return { tipo: "recusada", codigo: recusa };
    return { tipo: "processado", resultado: resultados.size > 0 ? [...resultados].join(",") : null, eventos: eventos.length, mensagens };
  }

  async function marcarProcessado(id: string, resultado: string | null): Promise<void> {
    await pool().query(
      `update plataforma.webhooks_recebidos
          set estado = 'processado', processado_em = now(), resultado = $2, ultimo_erro = null, locked_at = null, locked_by = null
        where id = $1`,
      [id, resultado],
    );
  }

  async function marcarRecusada(id: string, codigo: string): Promise<void> {
    await pool().query(
      "update plataforma.webhooks_recebidos set estado = 'falhou', ultimo_erro = $2, locked_at = null, locked_by = null where id = $1",
      [id, codigo],
    );
  }

  /** Exceção: tenta de novo com espera, e na última tentativa desiste. `ultimo_erro` sempre por `sanitizarErro`. */
  async function marcarTransitoria(linha: LinhaReivindicada, erro: unknown): Promise<void> {
    const resumo = sanitizarErro(erro).summary;
    const desistiu = linha.tentativas >= maxTentativas;
    if (desistiu) {
      await pool().query(
        "update plataforma.webhooks_recebidos set estado = 'falhou', ultimo_erro = $2, locked_at = null, locked_by = null where id = $1",
        [linha.id, resumo],
      );
    } else {
      const disponivelEm = new Date(relogio.agora().getTime() + backoff(linha.tentativas));
      await pool().query(
        `update plataforma.webhooks_recebidos
            set estado = 'pendente', disponivel_em = $2, ultimo_erro = $3, locked_at = null, locked_by = null
          where id = $1`,
        [linha.id, disponivelEm.toISOString(), resumo],
      );
    }
    registrar("warn", "falha ao processar uma chamada da fila de entrada", {
      id: linha.id,
      tentativa: linha.tentativas,
      desistiu,
      erro: erro instanceof Error ? erro.name : "erro",
    });
  }

  async function processarUm(): Promise<boolean> {
    await devolverTravasVencidas();
    const linha = await reivindicar();
    if (!linha) return false;
    try {
      const desfecho = await processar(linha);
      if (desfecho.tipo === "recusada") {
        await marcarRecusada(linha.id, desfecho.codigo);
        registrar("warn", "chamada da fila de entrada recusada", { id: linha.id, codigo: desfecho.codigo });
      } else {
        await marcarProcessado(linha.id, desfecho.resultado);
        registrar("info", "chamada da fila de entrada processada", { id: linha.id, eventos: desfecho.eventos, mensagens: desfecho.mensagens });
      }
    } catch (erro) {
      await marcarTransitoria(linha, erro);
    }
    return true;
  }

  let temporizador: ReturnType<typeof setInterval> | undefined;
  // O ciclo em voo: `parar()` o espera, e `acordar()` durante ele só pede mais uma volta (nunca dois juntos).
  let emVoo: Promise<void> | undefined;
  let pedirOutraVolta = false;
  let parado = false;

  async function rodarCiclo(): Promise<void> {
    try {
      do {
        pedirOutraVolta = false;
        while (!parado && (await processarUm())) {
          // até a fila esvaziar
        }
      } while (pedirOutraVolta && !parado);
    } catch (erro) {
      registrar("error", "ciclo do processador de entrada falhou", { erro: erro instanceof Error ? erro.name : "erro" });
    }
  }

  function dispararCiclo(): void {
    if (parado) return;
    if (emVoo) {
      pedirOutraVolta = true;
      return;
    }
    emVoo = rodarCiclo().finally(() => {
      emVoo = undefined;
    });
  }

  return {
    iniciar() {
      if (temporizador) return;
      parado = false;
      temporizador = setInterval(dispararCiclo, intervaloMs);
      temporizador.unref();
    },
    async parar() {
      parado = true;
      if (temporizador) clearInterval(temporizador);
      temporizador = undefined;
      await emVoo;
    },
    processarUm,
    acordar: dispararCiclo,
  };
}
