/**
 * O processador da fila de entrada (16-03, 3.6.4, MSG-01): reivindica uma linha `pendente` de
 * `plataforma.webhooks_recebidos` por vez (`for update skip locked`: duas instâncias nunca pegam a mesma),
 * interpreta o corpo pelo provedor do Canal e manda cada evento `mensagem` a `receberMensagem`.
 *
 * Como cada linha termina:
 *   - `processado`: todos os eventos foram tratados. `resultado` diz o que NÃO virou Mensagem
 *     (`ignorado:<motivo>`, `sem_tratamento:<tipo>`). O evento `status` muda a Mensagem pelo domínio
 *     (`atualizarStatusDeEntrega`: só avança) e, quando ela mudou, avisa o tempo real (`mensagem.status`, 16-07), e deixa `ignorado:status_sem_mensagem` quando nenhuma Mensagem do
 *     Canal tem o id externo, ou `ignorado:status_atrasado` quando o status não avança. O evento `conexao` só muda
 *     Canal REAL: num Canal simulado fica `ignorado:<motivo>` com o motivo da conexão simulada (a conexão simulada é dos botões da ficha,
 *     D-15-12); num real grava a conexão, sobe a revisão do Espaço e, se voltou a `conectada`, reenfileira as
 *     Mensagens `pendente` dele, tudo numa transação;
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
 * A mídia (16-10, 3.9.4, D-16-08): o anexo de uma Mensagem recebida é baixado do provedor e guardado no bucket ANTES da
 * transação do recebimento (`midia.ts`). Mídia grande, de tipo fora da lista, com assinatura que não bate ou que o provedor
 * já esqueceu grava a Mensagem assim mesmo, com o anexo `baixado: false`. Se a falha pode passar sozinha (rede, provedor ou
 * bucket fora do ar), a linha volta a `pendente` com `resultado = "midia_pendente"` e a passada seguinte COMPLETA o anexo da
 * Mensagem já gravada (a repetida não duplica nada); depois de `TENTATIVAS_DA_MIDIA` passadas a linha fica `processado` com
 * `resultado = "midia_indisponivel"` e o anexo continua marcado como indisponível.
 *
 * Cada chamada registra UMA linha de etapas (espera na fila, baixar, subir, transação e total, em ms): é a medição da prova
 * ao vivo do "menos de 2 s" com áudio, e leva só o id da linha e números.
 *
 * Quem escreveu (Sessão 8): um provedor com `resolverRemetente` (o Instagram, cujo webhook só traz o IGSID) troca o id
 * opaco pelo Identificador do Contato antes de `receberMensagem`, também fora da transação. Falhar ali é transitório.
 *
 * A rota do webhook chama `acordar()` depois do 200 (Pitfall 3): o laço de `intervaloMs` é só a reserva.
 *
 * Nada aqui loga corpo, texto, telefone nem segredo: `registrar` só recebe o id da linha, contagens e
 * códigos.
 */

import { performance } from "node:perf_hooks";
import type { Pool } from "pg";
import type { ConexaoDoCanal } from "@n1/dominio/crm/canais";
import type { StatusDeEntrega } from "@n1/dominio/crm/mensagens";
import { pool as poolPadrao } from "../persistencia/conexao";
import { backoff, sanitizarErro } from "../persistencia/outbox-worker";
import { criarRepositorioDeCanaisPg } from "../repositorios/crm/canais";
import { criarRepositorioDeMensagensPg } from "../repositorios/crm/mensagens";
import { lerChavesDoCofre, type ChavesDoCofre } from "../servicos/cofre";
import { criarServicoDeRecebimento, type ServicoDeRecebimento } from "../servicos/crm/recebimento";
import type { Relogio } from "../testes/relogio";
import { relogioDoSistema } from "../testes/relogio";
import type { ArmazenamentoDeAnexos } from "../servicos/armazenamento-de-anexos";
import { aplicarConexaoAoCanal, type OpcoesDaConexao } from "./aplicar-conexao";
import { avisarCrm } from "./avisar";
import { FRASES_DA_SAIDA } from "./entregar-mensagem";
import { criarGuardaDeMidia } from "./midia";
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
  /** 16-10: o bucket onde a mídia recebida é guardada antes da transação. Padrão: o do Supabase; os testes injetam o falso. */
  readonly armazenamento?: ArmazenamentoDeAnexos;
  /**
   * 16-07: acorda o worker de saída depois do commit que reenfileirou as Mensagens `pendente` de um Canal que
   * voltou a `conectada` (evento `conexao`), para elas não esperarem o intervalo de reserva do worker.
   */
  readonly acordarSaida?: () => void;
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
  /** Quanto a linha esperou na fila até esta reivindicação (desde que ficou disponível), em ms. */
  readonly espera_ms: number;
}

type Desfecho =
  | {
      readonly tipo: "processado";
      readonly resultados: readonly string[];
      readonly eventos: number;
      readonly mensagens: number;
      /** Algum anexo falhou por causa que pode passar sozinha: vale outra passada. */
      readonly midiaPendente: boolean;
    }
  | { readonly tipo: "recusada"; readonly codigo: string };

/** As etapas de UMA chamada, somadas sobre os eventos dela (16-10). */
interface Etapas {
  baixarMs: number;
  subirMs: number;
  transacaoMs: number;
  anexos: number;
}

const RESULTADO_MIDIA_PENDENTE = "midia_pendente";
const RESULTADO_MIDIA_INDISPONIVEL = "midia_indisponivel";

/** Quantas passadas uma linha com mídia transitória ganha antes de ficar `processado` com `midia_indisponivel`. */
const TENTATIVAS_DA_MIDIA = 3;

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
  const guardaDeMidia = criarGuardaDeMidia(opcoes.armazenamento ? { armazenamento: opcoes.armazenamento } : {});
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
        returning id, workspace_id, canal_id, corpo, tentativas,
          greatest(0, extract(epoch from (now() - disponivel_em)) * 1000)::float8 as espera_ms`,
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
      // 16-07 / 3.8.2: só quando o status de fato mudou; o aviso sai no mesmo cliente, depois do `commit`.
      if (r?.mudou) {
        await avisarCrm(cliente, { workspaceId: linha.workspace_id, tipo: "mensagem.status", conversaId: r.mensagem.conversaId, mensagemId: r.mensagem.id });
      }
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

  /**
   * 3.7.1 item 5 / B69: o provedor diz que a conexão do Canal mudou. A regra (só Canal real, travas na ordem do Espaço e
   * depois do Canal, reenfileirar as pendentes ao conectar) mora em `aplicar-conexao.ts`, que a conferência periódica da
   * Sessão 4 também usa; aqui só se acorda o worker de saída depois do commit.
   */
  async function aplicarConexao(linha: LinhaReivindicada, conexao: ConexaoDoCanal, opcoesDaConexao: OpcoesDaConexao = {}): Promise<string | undefined> {
    const desfecho = await aplicarConexaoAoCanal(pool, { workspaceId: linha.workspace_id, canalId: linha.canal_id }, conexao, opcoesDaConexao);
    if (desfecho.reenfileirou) opcoes.acordarSaida?.();
    return desfecho.resultado;
  }

  async function processar(linha: LinhaReivindicada, etapas: Etapas): Promise<Desfecho> {
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
    let midiaPendente = false;
    for (const evento of eventos) {
      if (evento.tipo === "mensagem") {
        const { tipo: _tipo, ...doProvedor } = evento;
        // Sessão 8: o provedor que só conhece um id opaco de quem escreveu (o IGSID do Instagram) o troca pelo
        // Identificador do Contato aqui, fora da transação. Uma exceção sobe: a linha volta à fila (`marcarTransitoria`).
        const recebida = provedor.resolverRemetente ? await provedor.resolverRemetente(paraOProvedor, doProvedor) : doProvedor;
        // 16-10 / 3.9.4: a mídia é baixada e guardada ANTES da transação, para a conexão do banco não esperar o provedor.
        const guardados =
          (recebida.anexos ?? []).length > 0
            ? await guardaDeMidia.guardarAnexosRecebidos({ workspaceId: linha.workspace_id, canal: paraOProvedor, provedor, anexos: recebida.anexos ?? [] })
            : undefined;
        if (guardados) {
          etapas.anexos += guardados.anexos.length;
          etapas.baixarMs += guardados.baixarMs;
          etapas.subirMs += guardados.subirMs;
          if (guardados.algumTransitorio) midiaPendente = true;
        }
        const inicioDaTransacao = performance.now();
        const r = await recebimento.receberMensagem(linha.workspace_id, linha.canal_id, recebida, guardados ? { anexos: guardados.anexos } : undefined);
        etapas.transacaoMs += performance.now() - inicioDaTransacao;
        if (r.ok) mensagens += 1;
        else recusa ??= r.codigo ?? `RECUSADA_${r.status}`;
      } else if (evento.tipo === "ignorado") {
        resultados.add(`ignorado:${evento.motivo}`);
      } else if (evento.tipo === "status") {
        const resultado = await aplicarStatus(linha, evento);
        if (resultado !== undefined) resultados.add(resultado);
      } else if (evento.tipo === "conexao") {
        // Sessão 4 (4.3.1): o evento `open` da Evolution é só um aviso. Antes de gravar `conectada`, o provedor que sabe
        // conferir na fonte (`conferirConexao`) pergunta à Evolution se a instância está mesmo aberta e se o número é o do
        // Canal; um QR lido por OUTRO número vira `com_erro`, e o que a Evolution não confirma não muda nada. Fora da
        // transação (é rede); uma exceção sobe e a linha volta à fila (`marcarTransitoria`).
        let conexao: ConexaoDoCanal | undefined = evento.conexao;
        let tentativaFalhada = false;
        if (conexao === "conectada" && provedor.conferirConexao) {
          const conferida = await provedor.conferirConexao(paraOProvedor);
          conexao = conferida.conexao;
          // O `open` foi um aviso e a conferência disse que NÃO deu certo (outro número, credencial recusada): a tentativa
          // de conectar falhou, o que leva até um Canal `desconectada` a `com_erro`.
          tentativaFalhada = conexao === "com_erro";
          if (conexao !== "conectada") resultados.add(`conexao:${conferida.motivo}`);
        }
        if (conexao !== undefined) {
          const resultado = await aplicarConexao(linha, conexao, { tentativaFalhada });
          if (resultado !== undefined) resultados.add(resultado);
        }
      } else {
        // Todos os tipos de `EventoDoProvedor` têm ramo: um tipo novo quebra a compilação aqui e obriga a tratá-lo.
        // Em tempo de execução, um tipo que o provedor inventou fica registrado e a linha segue processada.
        const naoTratado: never = evento;
        resultados.add(`sem_tratamento:${(naoTratado as { readonly tipo: string }).tipo}`);
      }
    }
    if (recusa !== undefined) return { tipo: "recusada", codigo: recusa };
    return { tipo: "processado", resultados: [...resultados], eventos: eventos.length, mensagens, midiaPendente };
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

  /** A mídia falhou por causa que pode passar: a linha volta a `pendente` na escada de `backoff()` e a próxima passada completa o anexo. */
  async function marcarMidiaPendente(linha: LinhaReivindicada): Promise<void> {
    const disponivelEm = new Date(relogio.agora().getTime() + backoff(linha.tentativas));
    await pool().query(
      `update plataforma.webhooks_recebidos
          set estado = 'pendente', disponivel_em = $2, resultado = $3, ultimo_erro = null, locked_at = null, locked_by = null
        where id = $1`,
      [linha.id, disponivelEm.toISOString(), RESULTADO_MIDIA_PENDENTE],
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
    const inicio = performance.now();
    const etapas: Etapas = { baixarMs: 0, subirMs: 0, transacaoMs: 0, anexos: 0 };
    try {
      const desfecho = await processar(linha, etapas);
      if (desfecho.tipo === "recusada") {
        await marcarRecusada(linha.id, desfecho.codigo);
        registrar("warn", "chamada da fila de entrada recusada", { id: linha.id, codigo: desfecho.codigo });
      } else if (desfecho.midiaPendente && linha.tentativas < TENTATIVAS_DA_MIDIA) {
        // A Mensagem já está gravada (com o anexo `baixado: false`); a próxima passada só completa o anexo.
        await marcarMidiaPendente(linha);
        registrar("info", "mídia da fila de entrada adiada para nova passada", { id: linha.id, tentativa: linha.tentativas });
      } else {
        const resultados = desfecho.midiaPendente ? [...desfecho.resultados, RESULTADO_MIDIA_INDISPONIVEL] : desfecho.resultados;
        await marcarProcessado(linha.id, resultados.length > 0 ? resultados.join(",") : null);
        registrar("info", "chamada da fila de entrada processada", { id: linha.id, eventos: desfecho.eventos, mensagens: desfecho.mensagens });
      }
    } catch (erro) {
      await marcarTransitoria(linha, erro);
    }
    // Uma linha por chamada, só o id da linha e números (T-16-40): nenhum telefone, texto, nome de arquivo nem referência.
    registrar("info", "mensageria.etapas", {
      webhookId: linha.id,
      esperaMs: Math.round(linha.espera_ms),
      baixarMs: Math.round(etapas.baixarMs),
      subirMs: Math.round(etapas.subirMs),
      transacaoMs: Math.round(etapas.transacaoMs),
      totalMs: Math.round(linha.espera_ms + (performance.now() - inicio)),
      anexos: etapas.anexos,
    });
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
