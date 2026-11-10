/**
 * A coleta diária de órfãos do bucket (16-10, 3.9.6, T-16-39): apaga o que nenhuma pessoa nem Mensagem aponta.
 *
 *   1. Sessões de upload EXPIRADAS e nunca consumidas (o anexo da Caixa que a pessoa abandonou): os objetos `reservado` e
 *      `enviado` delas saem do bucket e viram `expirado`. Uma sessão cuja remoção falhou NÃO é marcada: a próxima rodada tenta.
 *   2. Objetos de `workspace/<ws>/entrada/<canalId>/` com mais de `idadeMinimaMs` (1 h) que nenhuma Mensagem do Canal cita no
 *      anexo: o que a entrada de mídia (`midia.ts`) subiu e a transação não gravou, ou que uma passada repetida duplicou.
 *      O que uma Mensagem cita nunca sai, e o que tem menos de 1 h fica (pode ser de uma transação em voo).
 *
 * Só uma instância roda por vez: `pg_try_advisory_lock` num cliente próprio do pool (sem a trava, `rodou: false`), devolvida no
 * `finally`. Mesma separação do outbox: não conhece `buildApp()`, e só sobe em `index.ts` com `COLETA_DE_ORFAOS_ATIVA=true`.
 *
 * Nada aqui loga chave de objeto, Espaço nem nome de arquivo: o registro leva só as três contagens.
 */

import type { Pool } from "pg";
import { pool as poolPadrao } from "../persistencia/conexao";
import { marcarExpirados, objetosDaSessao } from "../persistencia/sessoes-de-upload";
import { armazenamentoDeAnexosPadrao, type ArmazenamentoDeAnexos } from "../servicos/armazenamento-de-anexos";

/** O número da trava consultiva: uma só coleta por vez no banco, seja qual for a instância. */
const CHAVE_DA_TRAVA = "n1:coleta-de-orfaos";

export interface OpcoesDaColetaDeOrfaos {
  /** O bucket. Padrão: o do Supabase; os testes injetam `criarArmazenamentoFalso()`. */
  readonly armazenamento?: ArmazenamentoDeAnexos;
  readonly pool?: () => Pool;
  /** Padrão 24 h. */
  readonly intervaloMs?: number;
  /** Padrão 1 h: um objeto de `entrada/` mais novo que isto nunca é apagado. */
  readonly idadeMinimaMs?: number;
  /** Padrão 500: quantas sessões e quantos objetos por pasta de Canal em cada rodada. */
  readonly limite?: number;
  /** Só contagens: nunca chave, Espaço nem nome de arquivo. */
  readonly registrar?: (nivel: "info" | "warn" | "error", mensagem: string, dados?: Record<string, unknown>) => void;
}

export interface ResultadoDaColeta {
  /** `false` quando outra instância tinha a trava: nada foi feito. */
  readonly rodou: boolean;
  readonly sessoesExpiradas: number;
  readonly objetosRemovidos: number;
  readonly objetosDeEntradaRemovidos: number;
}

export interface ColetaDeOrfaos {
  /** Agenda a coleta a cada `intervaloMs`. Chamar duas vezes é no-op. */
  iniciar(): void;
  /** Para o agendamento e espera a rodada em voo. */
  parar(): Promise<void>;
  rodarUmaVez(): Promise<ResultadoDaColeta>;
}

const NADA: ResultadoDaColeta = { rodou: false, sessoesExpiradas: 0, objetosRemovidos: 0, objetosDeEntradaRemovidos: 0 };

export function criarColetaDeOrfaos(opcoes: OpcoesDaColetaDeOrfaos = {}): ColetaDeOrfaos {
  // Criar o padrão não abre conexão nem lê variável: só tocar nele o faz.
  const armazenamento = opcoes.armazenamento ?? armazenamentoDeAnexosPadrao();
  const pool = opcoes.pool ?? poolPadrao;
  const intervaloMs = opcoes.intervaloMs ?? 86_400_000;
  const idadeMinimaMs = opcoes.idadeMinimaMs ?? 3_600_000;
  const limite = opcoes.limite ?? 500;
  const registrar = opcoes.registrar ?? (() => undefined);

  /** As sessões expiradas que ainda têm objeto a apagar (as que já foram limpas não voltam a ocupar o lote). */
  async function limparSessoesExpiradas(): Promise<{ sessoes: number; objetos: number }> {
    const { rows } = await pool().query<{ id: string }>(
      `select s.id
         from plataforma.upload_sessions s
        where s.consumed_at is null
          and s.expires_at < now()
          and exists (select 1 from plataforma.upload_objects o where o.session_id = s.id and o.state in ('reservado', 'enviado'))
        order by s.expires_at
        limit $1`,
      [limite],
    );
    let sessoes = 0;
    let objetos = 0;
    for (const { id } of rows) {
      const chaves = (await objetosDaSessao(id)).filter((o) => o.state === "reservado" || o.state === "enviado").map((o) => o.objectKey);
      try {
        if (chaves.length > 0) await armazenamento.remover(chaves);
      } catch (erro) {
        // O bucket falhou: a sessão fica como está e a próxima rodada tenta de novo.
        registrar("warn", "coleta de órfãos: o bucket não removeu os objetos de uma sessão", { erro: erro instanceof Error ? erro.name : "erro" });
        continue;
      }
      await marcarExpirados([id]);
      sessoes += 1;
      objetos += chaves.length;
    }
    return { sessoes, objetos };
  }

  /** Os objetos de `entrada/` de cada Canal que nenhuma Mensagem cita e que passaram da idade mínima. */
  async function limparEntradaSemMensagem(): Promise<number> {
    const { rows: canais } = await pool().query<{ workspace_id: string; id: string }>("select workspace_id, id from plataforma.canais");
    const corte = Date.now() - idadeMinimaMs;
    let removidos = 0;
    for (const canal of canais) {
      // A porta lista UMA pasta (sem descer) e devolve só arquivos com a data de criação que o bucket informa.
      const listados = await armazenamento.listar(`workspace/${canal.workspace_id}/entrada/${canal.id}`, { limite });
      const velhos = listados.filter((objeto) => objeto.criadoEm.getTime() < corte).map((objeto) => objeto.objectKey);
      if (velhos.length === 0) continue;
      const { rows: citados } = await pool().query<{ chave: string }>(
        `select distinct a->>'objectKey' as chave
           from plataforma.mensagens m
          cross join lateral jsonb_array_elements(m.anexos) a
          where m.workspace_id = $1 and m.canal_id = $2 and m.id_externo is not null
            and a->>'objectKey' = any($3::text[])`,
        [canal.workspace_id, canal.id, velhos],
      );
      const emUso = new Set(citados.map((linha) => linha.chave));
      const orfaos = velhos.filter((chave) => !emUso.has(chave));
      if (orfaos.length === 0) continue;
      await armazenamento.remover(orfaos);
      removidos += orfaos.length;
    }
    return removidos;
  }

  async function rodarUmaVez(): Promise<ResultadoDaColeta> {
    // A trava é de sessão: fica no cliente que a pegou até o `unlock` (ou até a conexão cair).
    const cliente = await pool().connect();
    try {
      const { rows } = await cliente.query<{ ok: boolean }>("select pg_try_advisory_lock(hashtext($1)) as ok", [CHAVE_DA_TRAVA]);
      if (!rows[0]?.ok) return NADA;
      try {
        const sessoes = await limparSessoesExpiradas();
        const objetosDeEntradaRemovidos = await limparEntradaSemMensagem();
        const resultado = { rodou: true, sessoesExpiradas: sessoes.sessoes, objetosRemovidos: sessoes.objetos, objetosDeEntradaRemovidos };
        registrar("info", "coleta de órfãos concluída", {
          sessoesExpiradas: resultado.sessoesExpiradas,
          objetosRemovidos: resultado.objetosRemovidos,
          objetosDeEntradaRemovidos: resultado.objetosDeEntradaRemovidos,
        });
        return resultado;
      } finally {
        await cliente.query("select pg_advisory_unlock(hashtext($1))", [CHAVE_DA_TRAVA]);
      }
    } finally {
      cliente.release();
    }
  }

  let temporizador: ReturnType<typeof setInterval> | undefined;
  let emVoo: Promise<void> | undefined;

  function dispararRodada(): void {
    if (emVoo) return;
    emVoo = rodarUmaVez()
      .then(() => undefined)
      .catch((erro: unknown) => {
        registrar("error", "coleta de órfãos falhou", { erro: erro instanceof Error ? erro.name : "erro" });
      })
      .finally(() => {
        emVoo = undefined;
      });
  }

  return {
    iniciar() {
      if (temporizador) return;
      temporizador = setInterval(dispararRodada, intervaloMs);
      temporizador.unref();
    },
    async parar() {
      if (temporizador) clearInterval(temporizador);
      temporizador = undefined;
      await emVoo;
    },
    rodarUmaVez,
  };
}
