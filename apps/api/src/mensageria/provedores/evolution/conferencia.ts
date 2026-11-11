/**
 * A conferência da conexão de tempos em tempos (Sessão 4, 4.3.2): a cada 5 minutos pergunta à Evolution, para cada Canal
 * `whatsapp-nao-oficial` ligado de verdade, se a instância está aberta, e corrige o banco quando o que o CRM guardou diverge.
 * É a rede para o webhook perdido: sem ela, um `connection.update` que não chegou deixaria o Canal "conectada" para sempre
 * com o celular desligado (e as respostas escritas na Caixa esperando, sem aviso).
 *
 * A regra de decisão, conservadora:
 *   - a Evolution NÃO respondeu (rede, tempo esgotado, 5xx): NADA muda, e o Canal fica para a próxima rodada. Quem não sabe não
 *     corrige;
 *   - instância fechada ou conectando e o banco diz `conectada` (celular desligado, sessão caída): `com_erro`;
 *   - instância sumida ou credencial recusada e o banco diz `conectada`: `com_erro`;
 *   - instância aberta e o banco diz `com_erro` ou `desconectada` (um `open` se perdeu): confere o número como no webhook
 *     (`conferirConexao`) e só então `conectada`; outro número tira o aparelho e deixa `com_erro`;
 *   - o resto (banco e Evolution concordam, ou o Canal já está `desconectada` e a instância fechada) não toca em nada.
 * A gravação é a mesma do webhook (`aplicarConexaoAoCanal`): só Canal real e ativo, travas na ordem do Espaço e depois do Canal,
 * e as Mensagens `pendente` de um Canal que volta a `conectada` são reenfileiradas.
 *
 * Só uma instância roda por vez: `pg_try_advisory_lock` num cliente próprio do pool, devolvida no `finally`. Mesma separação do
 * outbox e da coleta de órfãos: não conhece `buildApp()`, e só sobe em `index.ts` com `EVOLUTION_CONFERENCIA_ATIVA=true`.
 *
 * Nada aqui loga Espaço, Canal, número, instância nem token: o registro leva só as contagens.
 */

import type { Pool } from "pg";
import type { ConexaoDoCanal } from "@n1/dominio/crm/canais";
import { pool as poolPadrao } from "../../../persistencia/conexao";
import { criarRepositorioDeCanaisPg } from "../../../repositorios/crm/canais";
import { lerChavesDoCofre, type ChavesDoCofre } from "../../../servicos/cofre";
import { aplicarConexaoAoCanal } from "../../aplicar-conexao";
import { ErroDeProvedor } from "../../provedor";
import { canalParaProvedor, registroPadrao, type RegistroDeProvedores } from "../../registro";

/** O número da trava consultiva: uma só conferência por vez no banco, seja qual for a instância da api. */
const CHAVE_DA_TRAVA = "n1:conferencia-da-evolution";

export interface OpcoesDaConferenciaDaEvolution {
  readonly pool?: () => Pool;
  /** Padrão: `lerChavesDoCofre()`, lido quando uma rodada precisa decifrar uma credencial. */
  readonly chaves?: () => ChavesDoCofre;
  /** Padrão: `registroPadrao()`, lido a cada rodada (sem `EVOLUTION_URL` não há provedor, e a rodada não faz nada). */
  readonly registro?: () => RegistroDeProvedores;
  /** Acorda o worker de saída depois do commit que reenfileirou as Mensagens `pendente` de um Canal que voltou. */
  readonly acordarSaida?: () => void;
  /** Padrão 5 min. */
  readonly intervaloMs?: number;
  /** Padrão 30 s: a primeira rodada depois de `iniciar()`, para um deploy ou reinício não esperar os 5 min inteiros. */
  readonly primeiraRodadaEmMs?: number;
  /** Padrão 500: quantos Canais por rodada. */
  readonly limite?: number;
  /** Só para teste: confere apenas os Canais deste Espaço (o banco dos testes é compartilhado entre arquivos). */
  readonly somenteDoEspaco?: string;
  /** Só contagens: nunca Espaço, Canal, número, instância nem token. */
  readonly registrar?: (nivel: "info" | "warn" | "error", mensagem: string, dados?: Record<string, unknown>) => void;
}

export interface ResultadoDaConferencia {
  /** `false` quando outra instância tinha a trava, ou quando não há provedor da Evolution registrado: nada foi feito. */
  readonly rodou: boolean;
  /** Canais em que a Evolution respondeu. */
  readonly conferidos: number;
  /** Canais cuja conexão no banco foi mudada. */
  readonly corrigidos: number;
  /** Canais em que a Evolution não respondeu: nada mudou neles. */
  readonly semResposta: number;
}

export interface ConferenciaDaEvolution {
  /** Agenda a conferência: a primeira em `primeiraRodadaEmMs`, depois a cada `intervaloMs`. Chamar duas vezes é no-op. */
  iniciar(): void;
  /** Para o agendamento e espera a rodada em voo. */
  parar(): Promise<void>;
  rodarUmaVez(): Promise<ResultadoDaConferencia>;
}

const NADA: ResultadoDaConferencia = { rodou: false, conferidos: 0, corrigidos: 0, semResposta: 0 };

export function criarConferenciaDaEvolution(opcoes: OpcoesDaConferenciaDaEvolution = {}): ConferenciaDaEvolution {
  const pool = opcoes.pool ?? poolPadrao;
  const chaves = opcoes.chaves ?? (() => lerChavesDoCofre());
  const registroDe = opcoes.registro ?? (() => registroPadrao());
  const intervaloMs = opcoes.intervaloMs ?? 300_000;
  const primeiraRodadaEmMs = opcoes.primeiraRodadaEmMs ?? 30_000;
  const limite = opcoes.limite ?? 500;
  const registrar = opcoes.registrar ?? (() => undefined);

  /** Os Canais `whatsapp-nao-oficial` reais e ativos que têm credencial ATIVA da Evolution no cofre. */
  async function canaisParaConferir(): Promise<{ workspace_id: string; id: string }[]> {
    const { rows } = await pool().query<{ workspace_id: string; id: string }>(
      `select c.workspace_id, c.id
         from plataforma.canais c
        where c.provedor = 'whatsapp-nao-oficial' and c.estado = 'ativo' and not c.conexao_simulada
          and ($2::text is null or c.workspace_id = $2)
          and exists (
            select 1 from plataforma.credenciais k
             where k.workspace_id = c.workspace_id and k.dono_tipo = 'canal' and k.dono_id = c.id
               and k.tipo = 'whatsapp-nao-oficial' and k.revogado_em is null
          )
        order by c.workspace_id, c.id
        limit $1`,
      [limite, opcoes.somenteDoEspaco ?? null],
    );
    return rows;
  }

  async function rodar(): Promise<ResultadoDaConferencia> {
    const registro = registroDe();
    const provedor = registro.porProvedor["whatsapp-nao-oficial"];
    // Sem `EVOLUTION_URL` não há provedor: um Canal real recusa o envio e não há a quem perguntar.
    if (!provedor || !provedor.conferirConexao) return NADA;
    const cofre = chaves();
    let conferidos = 0;
    let corrigidos = 0;
    let semResposta = 0;

    for (const linha of await canaisParaConferir()) {
      const canal = await criarRepositorioDeCanaisPg(pool()).obter(linha.workspace_id, linha.id);
      if (!canal || canal.estado !== "ativo" || canal.conexaoSimulada) continue;
      const alvo = { workspaceId: linha.workspace_id, canalId: linha.id };
      try {
        const paraOProvedor = await canalParaProvedor(pool(), cofre, linha.workspace_id, canal);
        const doProvedor = await provedor.estadoDaConexao(paraOProvedor);
        conferidos += 1;
        let novo: ConexaoDoCanal | undefined;
        let tentativaFalhada = false;
        if (doProvedor === "conectada") {
          // Aberta na Evolution. Se o banco já concorda, não há o que fazer; senão confere o número antes de gravar.
          if (canal.conexao !== "conectada") {
            const conferida = await provedor.conferirConexao(paraOProvedor);
            novo = conferida.conexao;
            tentativaFalhada = novo === "com_erro";
          }
        } else if (canal.conexao === "conectada") {
          // Fechada, conectando, sem instância ou com a credencial recusada, e o banco diz conectada: o celular caiu ou o aviso se perdeu.
          novo = "com_erro";
        }
        if (novo === undefined) continue;
        const desfecho = await aplicarConexaoAoCanal(pool, alvo, novo, { tentativaFalhada });
        if (desfecho.mudou) corrigidos += 1;
        if (desfecho.reenfileirou) opcoes.acordarSaida?.();
      } catch (erro) {
        // A Evolution não respondeu (`PROVEDOR_INDISPONIVEL`): nada muda neste Canal, e ele volta na próxima rodada. Um erro que
        // não é do provedor sobe: é defeito nosso e não pode ser engolido como "sem resposta".
        if (erro instanceof ErroDeProvedor) {
          semResposta += 1;
          continue;
        }
        throw erro;
      }
    }
    return { rodou: true, conferidos, corrigidos, semResposta };
  }

  async function rodarUmaVez(): Promise<ResultadoDaConferencia> {
    // A trava é de sessão: fica no cliente que a pegou até o `unlock` (ou até a conexão cair).
    const cliente = await pool().connect();
    try {
      const { rows } = await cliente.query<{ ok: boolean }>("select pg_try_advisory_lock(hashtext($1)) as ok", [CHAVE_DA_TRAVA]);
      if (!rows[0]?.ok) return NADA;
      try {
        const resultado = await rodar();
        if (resultado.rodou) {
          registrar("info", "conferência da Evolution concluída", {
            conferidos: resultado.conferidos,
            corrigidos: resultado.corrigidos,
            semResposta: resultado.semResposta,
          });
        }
        return resultado;
      } finally {
        await cliente.query("select pg_advisory_unlock(hashtext($1))", [CHAVE_DA_TRAVA]);
      }
    } finally {
      cliente.release();
    }
  }

  let temporizador: ReturnType<typeof setInterval> | undefined;
  let primeira: ReturnType<typeof setTimeout> | undefined;
  let emVoo: Promise<void> | undefined;

  function dispararRodada(): void {
    if (emVoo) return;
    emVoo = rodarUmaVez()
      .then(() => undefined)
      .catch((erro: unknown) => {
        registrar("error", "conferência da Evolution falhou", { erro: erro instanceof Error ? erro.name : "erro" });
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
      primeira = setTimeout(dispararRodada, primeiraRodadaEmMs);
      primeira.unref();
    },
    async parar() {
      if (temporizador) clearInterval(temporizador);
      if (primeira) clearTimeout(primeira);
      temporizador = undefined;
      primeira = undefined;
      await emVoo;
    },
    rodarUmaVez,
  };
}
