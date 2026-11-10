/**
 * O encerramento da api (Fase 16, 16-18, T-16-28 / WR-03).
 *
 * Antes, cada worker pendurava no processo um ouvinte de SIGTERM que só chamava a sua parada. Com qualquer ouvinte de
 * sinal instalado o Node deixa de sair sozinho, e nada nesse caminho fechava o servidor, encerrava o pool nem chamava
 * `process.exit()`: o `systemctl restart` esperava os 20 s do `TimeoutStopSec` e levava SIGKILL, cortando no meio o
 * que estivesse em voo. Aqui mora o tratador ÚNICO: um sinal roda a mesma desmontagem da recarga do `vite-node --watch`
 * e então sai do processo.
 *
 * A ordem, que é a da desmontagem da recarga (o `index.ts` a usa nos dois caminhos):
 * 1. `fecharFluxos()` — deixa o tempo real indisponível e fecha os fluxos SSE (senão o `app.close()` pendura esperando
 *    as abas, e `GET /eventos` passa a responder 503 em vez de abrir fluxo novo enquanto o resto fecha);
 * 2. as paradas registradas, em paralelo e esperadas até o fim (cada worker termina a volta em voo);
 * 3. `fecharFluxos()` de novo, para um fluxo que tenha entrado no intervalo;
 * 4. `fecharServidor()` — espera as requisições em curso;
 * 5. `encerrarPool()` — por último, porque as etapas acima ainda falam com o banco;
 * 6. sair (só no caminho do sinal: a recarga continua no mesmo processo).
 *
 * Uma etapa que falha é registrada e não impede as seguintes; o processo sai com 1 nesse caso. O teto de 15 s fica abaixo
 * dos 20 s da unidade, com margem para o systemd: uma etapa que pendura não segura o processo, ele registra e sai com 1.
 * Uma entrega em voo cortada pelo teto fica com a trava do outbox e é tratada como ambígua, nunca reenviada sozinha.
 *
 * Este módulo não conhece Fastify, o banco nem o resto da api: recebe as etapas por injeção.
 */

/** O teto do encerramento por sinal, abaixo dos 20 s de `TimeoutStopSec` da unidade. */
export const TETO_DO_ENCERRAMENTO_MS = 15_000;

type Nivel = "info" | "warn" | "error";

/** O pedaço do `process` que o tratador usa: ligar e desligar o ouvinte de um sinal, e sair. */
export interface ProcessoDeSinais {
  on(evento: "SIGTERM" | "SIGINT", ouvinte: () => void): unknown;
  off(evento: "SIGTERM" | "SIGINT", ouvinte: () => void): unknown;
  exit(codigo: number): unknown;
}

export interface Temporizador {
  cancelar(): void;
}

export interface OpcoesDoEncerramento {
  /** Deixa o tempo real indisponível e fecha os fluxos SSE abertos. Idempotente. */
  fecharFluxos(): void;
  /** Para de aceitar conexões e espera as requisições em curso (`app.close()`). */
  fecharServidor(): Promise<void>;
  /** Fecha os pools do banco. */
  encerrarPool(): Promise<void>;
  registrar(nivel: Nivel, mensagem: string, dados?: Record<string, unknown>): void;
  /** O teto do encerramento por sinal; padrão `TETO_DO_ENCERRAMENTO_MS`. */
  tetoMs?: number;
  /** O `setTimeout` injetável dos testes. O padrão agenda com `unref()`, para o teto nunca segurar o processo. */
  agendar?: (acao: () => void, ms: number) => Temporizador;
}

export interface Encerramento {
  /** Guarda como parar um worker. Não pendura ouvinte de sinal nenhum. */
  aoEncerrar(parar: () => Promise<void>): void;
  /** A sequência inteira, sem sair do processo (o caminho da recarga). Chamada duas vezes devolve a MESMA promessa. */
  desmontar(): Promise<{ readonly ok: boolean }>;
  /** Liga SIGTERM e SIGINT ao encerramento com saída do processo. */
  instalar(processo: ProcessoDeSinais): void;
  /** Tira os dois ouvintes de sinal. */
  desinstalar(): void;
}

function agendarComUnref(acao: () => void, ms: number): Temporizador {
  const temporizador = setTimeout(acao, ms);
  temporizador.unref?.();
  return { cancelar: () => clearTimeout(temporizador) };
}

/** Só o nome do erro vai para o registro: a mensagem pode carregar um segredo de conexão. */
function nomeDoErro(erro: unknown): string {
  return erro instanceof Error ? erro.name : typeof erro;
}

export function criarEncerramento(opcoes: OpcoesDoEncerramento): Encerramento {
  const tetoMs = opcoes.tetoMs ?? TETO_DO_ENCERRAMENTO_MS;
  const agendar = opcoes.agendar ?? agendarComUnref;
  const paradas: Array<() => Promise<void>> = [];
  let desmontagem: Promise<{ readonly ok: boolean }> | undefined;
  let ouvintes: Array<{ sinal: "SIGTERM" | "SIGINT"; ouvinte: () => void }> = [];
  let processoInstalado: ProcessoDeSinais | undefined;

  /** Roda uma etapa: registra o início, e se ela falhar registra qual e segue (devolve `false`). */
  async function etapa(nome: string, acao: () => void | Promise<void>, anunciar = true): Promise<boolean> {
    if (anunciar) opcoes.registrar("info", `encerramento: ${nome}`);
    try {
      await acao();
      return true;
    } catch (erro) {
      opcoes.registrar("error", `encerramento: ${nome} falhou`, { erro: nomeDoErro(erro) });
      return false;
    }
  }

  async function rodar(): Promise<{ readonly ok: boolean }> {
    const resultados: boolean[] = [];
    resultados.push(await etapa("fluxos", () => opcoes.fecharFluxos()));
    resultados.push(
      await etapa("paradas", async () => {
        const feitas = await Promise.allSettled(paradas.map(async (parar) => parar()));
        const rejeitadas = feitas.filter((feita) => feita.status === "rejected");
        if (rejeitadas.length > 0) {
          throw new Error(`${rejeitadas.length} de ${feitas.length} paradas falharam`);
        }
      }),
    );
    // Um fluxo pode ter entrado enquanto os workers terminavam a volta em voo.
    resultados.push(await etapa("fluxos", () => opcoes.fecharFluxos(), false));
    resultados.push(await etapa("servidor", () => opcoes.fecharServidor()));
    resultados.push(await etapa("pool", () => opcoes.encerrarPool()));
    return { ok: resultados.every(Boolean) };
  }

  function desmontar(): Promise<{ readonly ok: boolean }> {
    desmontagem ??= rodar();
    return desmontagem;
  }

  function instalar(processo: ProcessoDeSinais): void {
    let recebido = false;
    let saiu = false;
    const sair = (codigo: number): void => {
      if (saiu) return;
      saiu = true;
      processo.exit(codigo);
    };
    const tratar = (sinal: "SIGTERM" | "SIGINT"): void => {
      if (recebido) {
        opcoes.registrar("warn", `encerramento: sinal ${sinal} ignorado, já está encerrando`);
        return;
      }
      recebido = true;
      opcoes.registrar("info", `encerramento: sinal ${sinal}`);
      const teto = agendar(() => {
        opcoes.registrar("error", "encerramento: teto estourado", { tetoMs });
        sair(1);
      }, tetoMs);
      void desmontar().then(({ ok }) => {
        teto.cancelar();
        sair(ok ? 0 : 1);
      });
    };
    processoInstalado = processo;
    ouvintes = (["SIGTERM", "SIGINT"] as const).map((sinal) => ({ sinal, ouvinte: () => tratar(sinal) }));
    for (const { sinal, ouvinte } of ouvintes) processo.on(sinal, ouvinte);
  }

  function desinstalar(): void {
    for (const { sinal, ouvinte } of ouvintes) processoInstalado?.off(sinal, ouvinte);
    ouvintes = [];
  }

  return {
    aoEncerrar: (parar) => {
      paradas.push(parar);
    },
    desmontar,
    instalar,
    desinstalar,
  };
}
