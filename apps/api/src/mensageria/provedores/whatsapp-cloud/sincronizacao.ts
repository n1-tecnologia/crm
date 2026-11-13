/**
 * Manter os modelos de mensagem do WhatsApp oficial em dia sem ninguém apertar nada (Sessão 7, 7.3.2). A leitura em si é de
 * `modelos.ts` (`sincronizarModelos`); aqui só se decide QUEM sincronizar e QUANDO:
 *
 *   - `daConta(wabaId)`: quando a Meta avisa que um modelo mudou (`message_template_status_update`: aprovado, rejeitado,
 *     pausado…). O webhook entrega a conta (WABA) e esta função sincroniza o Canal de cada número dela;
 *   - `deTodos()`: a cada hora, para o aviso que se perdeu (o webhook da Meta pode falhar ou nem estar inscrito no campo).
 *     Desligada por padrão: só com `WHATSAPP_MODELOS_SINCRONIZACAO_ATIVA=true`, como a conferência da Evolution. A trava
 *     consultiva garante que duas instâncias da api nunca sincronizam juntas.
 *
 * Só se sincroniza Canal ATIVO, `conectada` e REAL (não simulado). Um Canal que falha (token vencido, a Meta fora do ar) não
 * segura os outros, e a falha de um nunca apaga o que ele já tinha (`sincronizarModelos` só grava depois de ler). Nada aqui
 * loga token nem modelo: o registro leva só contagens.
 */

import type { Pool } from "pg";
import { pool as poolPadrao } from "../../../persistencia/conexao";
import { criarRepositorioDeCanaisPg } from "../../../repositorios/crm/canais";
import { lerChavesDoCofre, type ChavesDoCofre } from "../../../servicos/cofre";
import { canalParaProvedor } from "../../registro";
import { criarClienteDaCloudApi, type ClienteDaCloudApi } from "./cliente";
import { lerConfiguracaoDaCloudApi, type ConfiguracaoDaCloudApi } from "./configuracao";
import { sincronizarModelos } from "./modelos";
import { lerCredencialDaCloudApi } from "./repositorio";

/** O número da trava consultiva: uma só sincronização por vez no banco, seja qual for a instância da api. */
const CHAVE_DA_TRAVA = "n1-crm:whatsapp-modelos-sincronizacao";

export interface OpcoesDoSincronizador {
  readonly pool?: () => Pool;
  /** Padrão: `lerChavesDoCofre()`, lido a cada rodada (sem `COFRE_CHAVE` a rodada não faz nada). */
  readonly chaves?: () => ChavesDoCofre;
  /** Padrão: o ambiente (`META_APP_SECRET`, `META_GRAPH_VERSAO`). `undefined` deixa a integração desligada. */
  readonly configuracao?: () => ConfiguracaoDaCloudApi | undefined;
  /** Testes trocam pelo cliente apontado a um servidor falso. */
  readonly cliente?: (configuracao: ConfiguracaoDaCloudApi) => ClienteDaCloudApi;
  /** Padrão 1 h. */
  readonly intervaloMs?: number;
  /** Padrão 60 s: a primeira rodada depois de `iniciar()`, para um deploy não esperar a hora inteira. */
  readonly primeiraRodadaEmMs?: number;
  /** O registro leva só contagens (nunca token, modelo nem número). */
  readonly registrar?: (nivel: "info" | "warn", mensagem: string, dados?: Record<string, unknown>) => void;
}

export interface ResultadoDaSincronizacaoEmLote {
  /** `false` quando a integração está desligada, falta `COFRE_CHAVE` ou outra instância tinha a trava: nada foi feito. */
  readonly rodou: boolean;
  readonly canais: number;
  readonly sincronizados: number;
  readonly falhas: number;
}

export interface SincronizadorDeModelos {
  /** Sincroniza o Canal de cada número da conta `wabaId` (o aviso da Meta). Nunca lança. */
  daConta(wabaId: string): Promise<ResultadoDaSincronizacaoEmLote>;
  /** Sincroniza todos os Canais reais conectados (a rodada de hora em hora). Nunca lança. */
  deTodos(): Promise<ResultadoDaSincronizacaoEmLote>;
  iniciar(): void;
  parar(): Promise<void>;
}

const NADA: ResultadoDaSincronizacaoEmLote = { rodou: false, canais: 0, sincronizados: 0, falhas: 0 };

export function criarSincronizadorDeModelos(opcoes: OpcoesDoSincronizador = {}): SincronizadorDeModelos {
  const pool = opcoes.pool ?? poolPadrao;
  const chaves = opcoes.chaves ?? (() => lerChavesDoCofre());
  const configuracao = opcoes.configuracao ?? (() => lerConfiguracaoDaCloudApi());
  const clienteDe = opcoes.cliente ?? ((config: ConfiguracaoDaCloudApi) => criarClienteDaCloudApi(config));
  const intervaloMs = opcoes.intervaloMs ?? 3_600_000;
  const primeiraRodadaEmMs = opcoes.primeiraRodadaEmMs ?? 60_000;
  const registrar = opcoes.registrar ?? (() => undefined);

  /** Sincroniza os Canais dos números `daConta` (ou de todos). Quem chama já pegou a trava, se precisa dela. */
  async function sincronizar(daConta: string | null): Promise<ResultadoDaSincronizacaoEmLote> {
    let config: ConfiguracaoDaCloudApi | undefined;
    let cofre: ChavesDoCofre;
    try {
      config = configuracao();
      cofre = chaves();
    } catch {
      return NADA;
    }
    if (!config) return NADA;
    const whatsapp = clienteDe(config);

    const { rows } = await pool().query<{ workspace_id: string; canal_id: string }>(
      `select n.workspace_id, n.canal_id
         from plataforma.whatsapp_cloud_numeros n
         join plataforma.canais c on c.workspace_id = n.workspace_id and c.id = n.canal_id
        where c.estado = 'ativo' and c.conexao = 'conectada' and not c.conexao_simulada
          and ($1::text is null or n.waba_id = $1)`,
      [daConta],
    );
    let sincronizados = 0;
    let falhas = 0;
    for (const { workspace_id: workspaceId, canal_id: canalId } of rows) {
      try {
        const canal = await criarRepositorioDeCanaisPg(pool()).obter(workspaceId, canalId);
        const credencial = canal ? lerCredencialDaCloudApi((await canalParaProvedor(pool(), cofre, workspaceId, canal)).credencial) : undefined;
        if (!canal || !credencial) {
          falhas += 1;
          continue;
        }
        await sincronizarModelos({ pool, cliente: whatsapp }, { workspaceId, canalId, token: credencial.token, wabaId: credencial.wabaId });
        sincronizados += 1;
      } catch {
        // Um Canal que falha não segura os outros; a próxima rodada ou o aviso seguinte tenta de novo.
        falhas += 1;
      }
    }
    return { rodou: true, canais: rows.length, sincronizados, falhas };
  }

  async function protegida(daConta: string | null): Promise<ResultadoDaSincronizacaoEmLote> {
    try {
      return await sincronizar(daConta);
    } catch {
      return NADA;
    }
  }

  /** A rodada de hora em hora: com a trava, para duas instâncias da api nunca sincronizarem juntas. */
  async function rodadaComTrava(): Promise<ResultadoDaSincronizacaoEmLote> {
    // A trava é de sessão: fica no cliente que a pegou até o `unlock` (ou até a conexão cair).
    let cliente;
    try {
      cliente = await pool().connect();
    } catch {
      return NADA;
    }
    try {
      const { rows } = await cliente.query<{ ok: boolean }>("select pg_try_advisory_lock(hashtext($1)) as ok", [CHAVE_DA_TRAVA]);
      if (rows[0]?.ok !== true) return NADA;
      try {
        return await protegida(null);
      } finally {
        await cliente.query("select pg_advisory_unlock(hashtext($1))", [CHAVE_DA_TRAVA]);
      }
    } catch {
      return NADA;
    } finally {
      cliente.release();
    }
  }

  let temporizador: ReturnType<typeof setInterval> | undefined;
  let primeira: ReturnType<typeof setTimeout> | undefined;
  let emVoo: Promise<unknown> | undefined;

  function dispararRodada(): void {
    // Uma rodada por vez neste processo: se a anterior ainda não acabou, esta não empilha.
    if (emVoo) return;
    emVoo = rodadaComTrava()
      .then((r) => {
        if (r.rodou) registrar("info", "modelos do WhatsApp sincronizados", { canais: r.canais, sincronizados: r.sincronizados, falhas: r.falhas });
      })
      .finally(() => {
        emVoo = undefined;
      });
  }

  return {
    daConta: (wabaId) => protegida(wabaId),
    deTodos: rodadaComTrava,
    iniciar() {
      if (temporizador) return;
      temporizador = setInterval(dispararRodada, intervaloMs);
      primeira = setTimeout(dispararRodada, primeiraRodadaEmMs);
      temporizador.unref?.();
      primeira.unref?.();
    },
    async parar() {
      if (temporizador) clearInterval(temporizador);
      if (primeira) clearTimeout(primeira);
      temporizador = undefined;
      primeira = undefined;
      await emVoo;
    },
  };
}
