/**
 * O leitor da caixa de entrada do e-mail (Fase 17, 17-10, EML-03, D-17-08, D-17-09, D-17-20; achados F5 e F6).
 *
 * É o processo, dentro do `apps/api`, que mantém UMA sessão IMAP por Canal de e-mail conectado, lê o que chega por IDLE (com
 * uma conferência de reserva a cada 2 min, que sozinha garante o "até 2 min" de D-17-09) e põe cada e-mail na fila de entrada
 * (`webhooks_recebidos`) com o cursor da caixa na MESMA transação (`enfileirarEmailEAvancar`). Quem transforma a linha da fila
 * em Contato, Conversa e Mensagem é o processador de entrada da Fase 16; por isso o leitor só liga junto com ele
 * (`deveIniciarOLeitorDeEmail`): sem o processador a fila encheria, e a coleta de órfãos apagaria anexos que ainda não viraram
 * Mensagem (F6, T-17-49).
 *
 * Uma conexão a mais, FORA do pool (F5, T-17-45): cada Canal é lido por um processo só, por `pg_try_advisory_lock` segurado
 * numa conexão `pg.Client` DEDICADA (molde de `ouvinte-pg.ts`). A trava é de sessão: segurá-la num cliente do pool prenderia
 * uma das 10 conexões do pool por Canal. O orçamento de conexões é o pool (10) mais o ouvinte do tempo real (1) mais esta (1).
 * Se a conexão dedicada cai, as travas somem com ela: todas as sessões param na hora e o supervisor refaz tudo, com espera
 * crescente.
 *
 * O supervisor varre a lista de contas (`contasParaLer`) a cada `intervaloDoSupervisorMs` (30 s): abre a sessão do Canal que
 * apareceu e tem a trava, fecha e solta a do que sumiu (desconectado, arquivado, caído). Cada sessão:
 *
 *   - abre o IMAP pela fábrica, que confere o destino na guarda de rede a CADA abertura (D-17-07, T-17-48): uma sessão nova
 *     (a biblioteca não reconecta sozinha) sempre passa de novo pela guarda;
 *   - lê só o que está ao alcance do cursor (`UID >= proximoUid`): o que já estava na caixa antes de conectar não entra
 *     (D-17-08), e a faixa `n:*` que devolve a última mensagem ABAIXO do cursor quando não há nada novo é descartada;
 *   - UIDVALIDITY novo: o cursor recomeça do `UIDNEXT` novo, registra o fato e não reimporta (os UIDs de antes não valem);
 *   - recusa de login (`authenticationFailed`) ou autorização retirada: o Canal passa a `desconectada` com o motivo e a sessão
 *     PARA, sem laço contra o servidor do cliente (D-17-20, T-17-46); queda de rede ou servidor fora só reconecta, com espera
 *     crescente (5 s a 5 min, zerada depois de 2 min de sessão estável) e NÃO muda o estado do Canal;
 *   - um anexo que falhou no bucket por causa passageira segura o cursor até 3 vezes antes de o e-mail entrar com
 *     `baixado: false` (D-16-08); um e-mail que faz o tradutor lançar três vezes entra como `ignorado:ilegivel`, para não
 *     prender a caixa; um e-mail acima de 50 MiB nem é baixado (T-17-47).
 *
 * Nada de endereço, assunto, corpo, senha nem token em `registrar` ou em erro: só contagens, o id do Canal e o nome do tipo da
 * falha (T-17-50). As bibliotecas ficam com `logger: false` na fábrica (17-03).
 */

import { Client, type Pool } from "pg";
import type { ImapFlow } from "imapflow";
import { carregarEnv, construirSsl, pool as poolPadrao, type OpcoesSsl } from "../../../persistencia/conexao";
import { criarRepositorioDeCanaisPg } from "../../../repositorios/crm/canais";
import { armazenamentoDeAnexosPadrao, type ArmazenamentoDeAnexos } from "../../../servicos/armazenamento-de-anexos";
import type { ChavesDoCofre } from "../../../servicos/cofre";
import { criarGuardaDeMidia, type GuardaDeMidia } from "../../midia";
import type { CanalParaProvedor } from "../../provedor";
import { canalParaProvedor } from "../../registro";
import { acessoDoEmailDoAmbiente, type AcessoDoEmail } from "./credencial";
import { enfileirarEmailEAvancar } from "./entrada";
import { classificarErroDeConexao } from "./erros";
import { criarFabricaDeConexao, type FabricaDeConexao } from "./fabrica-de-conexao";
import { registrarQuedaDoEmail } from "./queda";
import { contasParaLer, gravarCursor, lerCursor, type ContaDeEmail } from "./repositorio";
import { chaveDePosicao, corpoIgnorado, prepararEmailRecebido, TETO_DO_EMAIL_RECEBIDO_BYTES, type EmailPreparado } from "./traduzir";

/** A pasta que o leitor lê: a mesma do cursor que a conexão grava (`conexao.ts`). */
const PASTA_LIDA = "INBOX";
const PROVEDOR_DO_EMAIL = "email-imap-smtp";

/** O que a ficha do Canal mostra quando a caixa recusa o usuário ou a senha na leitura (D-17-20). */
export const FRASE_DA_SENHA_RECUSADA_NA_LEITURA = "O servidor IMAP recusou o usuário ou a senha: conecte a caixa de novo.";

const TEMPO_PARA_CONECTAR_MS = 10_000;
const TEMPO_PARA_FECHAR_MS = 2_000;

/** Quantas vezes um e-mail com anexo transitório (ou que faz o tradutor lançar) segura o cursor antes de entrar do jeito que está. */
const TENTATIVAS_DO_ANEXO = 3;

export interface OpcoesDoLeitorDeEmail {
  /** Padrão: `DATABASE_URL`. A conexão dedicada das travas nasce aqui, fora do pool. */
  readonly url?: string;
  /** Padrão: o pool do processo (só consultas curtas e a transação do `enfileirarEmailEAvancar`; nunca a trava). */
  readonly pool?: () => Pool;
  /** Padrão: a fábrica de produção (guarda de rede sem exceção). Os testes injetam a do dublê. */
  readonly fabrica?: FabricaDeConexao;
  /** Padrão: a porta de acesso do ambiente (banco e cofre do processo, renovadores OAuth configurados). */
  readonly acesso?: AcessoDoEmail;
  /** O bucket dos anexos. Padrão: o do Supabase; os testes injetam o falso. */
  readonly armazenamento?: ArmazenamentoDeAnexos;
  /** Padrão: a guarda de mídia da Fase 16 sobre `armazenamento`. */
  readonly guarda?: GuardaDeMidia;
  /** Padrão: lidas do ambiente quando um Canal precisa delas. Os testes injetam as deles. */
  readonly chaves?: ChavesDoCofre;
  /** O e-mail entrou na fila: acorda o processador de entrada (`acordadores.entrada` do `index.ts`). */
  readonly aoEnfileirar?: () => void;
  /** Padrão 30 s: de quanto em quanto tempo a lista de Canais é relida. */
  readonly intervaloDoSupervisorMs?: number;
  /** Padrão 2 min: a leitura de reserva, para o e-mail que o IDLE não avisou. */
  readonly intervaloDeConferenciaMs?: number;
  /** Padrão 5 min: de quanto em quanto tempo o IDLE é quebrado e refeito (tem de ser menor que o `socketMs` do leitor). */
  readonly maxIdleTimeMs?: number;
  /** Padrão 50: quantas sessões um processo mantém (A10). */
  readonly maxSessoes?: number;
  /** Padrão 5 s: a primeira espera entre reconexões (dobra até `esperaMaximaMs`). */
  readonly esperaInicialMs?: number;
  /** Padrão 5 min. */
  readonly esperaMaximaMs?: number;
  /** Padrão 2 min: a sessão que dura isto sem cair zera a espera. */
  readonly estavelMs?: number;
  /** Padrão 10 s: a espera antes de reler um e-mail cujo anexo falhou no bucket. */
  readonly esperaDoAnexoMs?: number;
  /** Padrão 100: quantos e-mails entram por leitura (o resto vem na volta seguinte). */
  readonly maxPorLeitura?: number;
  /**
   * Só para os testes: limita a lista de contas lidas (o Postgres de teste é compartilhado entre arquivos, e a lista atravessa
   * os Espaços). A produção não usa: o leitor é da plataforma e lê todos.
   */
  readonly filtrarContas?: (conta: ContaDeEmail) => boolean;
  /** Só para os testes contarem as conexões do leitor em `pg_stat_activity`; a produção não manda `application_name` (o pooler pode recusá-lo). */
  readonly nomeDaAplicacao?: string;
  /** Só id do Canal, contagens e o nome do tipo da falha: nunca endereço, assunto, corpo nem segredo. */
  readonly registrar?: (nivel: "info" | "warn" | "error", mensagem: string, dados?: Record<string, unknown>) => void;
}

export interface LeitorDeEmail {
  /** Começa a supervisionar (e a ler). Chamar duas vezes é no-op. */
  iniciar(): void;
  /** Fecha as sessões IMAP, solta as travas e fecha a conexão dedicada. */
  parar(): Promise<void>;
  /** Os Canais que ESTE processo lê agora (os que têm trava e sessão): `canalId`. */
  canaisLidos(): readonly string[];
}

/**
 * O leitor só liga com `EMAIL_LEITOR_ATIVO=true` E `MENSAGERIA_WORKER_ATIVO=true` (Pitfall 8, F6). Sem o segundo, devolve o
 * motivo, para o `index.ts` avisar; sem o primeiro, é só "não": o padrão da produção.
 */
export function deveIniciarOLeitorDeEmail(env: NodeJS.ProcessEnv = process.env): { readonly iniciar: boolean; readonly motivo?: string } {
  if (env.EMAIL_LEITOR_ATIVO !== "true") return { iniciar: false };
  if (env.MENSAGERIA_WORKER_ATIVO !== "true") {
    return {
      iniciar: false,
      motivo:
        "EMAIL_LEITOR_ATIVO=true exige MENSAGERIA_WORKER_ATIVO=true: sem o processador de entrada a fila encheria e a coleta de órfãos apagaria anexos que ainda não viraram Mensagem. O leitor de e-mail não foi iniciado.",
    };
  }
  return { iniciar: true };
}

/**
 * Um sinal que acorda quem espera: a parada do leitor, a de uma sessão, a queda da conexão das travas. As esperas se registram e
 * se tiram sozinhas (nada fica pendurado num `Promise` que nunca resolve, como ficaria com `.then` repetido).
 */
class Sinal {
  private readonly acordadores = new Set<() => void>();
  private disparado = false;

  get foiDisparado(): boolean {
    return this.disparado;
  }

  disparar(): void {
    this.disparado = true;
    for (const acordar of [...this.acordadores]) acordar();
  }

  /** Dorme `ms` (ou, sem `ms`, indefinidamente) ou até algum dos sinais disparar; o temporizador nunca fica pendurado. */
  static esperar(ms: number | undefined, ...sinais: readonly Sinal[]): Promise<void> {
    return new Promise<void>((resolver) => {
      if (sinais.some((sinal) => sinal.disparado)) {
        resolver();
        return;
      }
      let temporizador: ReturnType<typeof setTimeout> | undefined;
      const acordar = (): void => {
        if (temporizador) clearTimeout(temporizador);
        for (const sinal of sinais) sinal.acordadores.delete(acordar);
        resolver();
      };
      if (ms !== undefined) temporizador = setTimeout(acordar, ms);
      for (const sinal of sinais) sinal.acordadores.add(acordar);
    });
  }
}

/** Uma sessão IMAP de um Canal, com o laço que a reabre. */
interface Sessao {
  readonly conta: ContaDeEmail;
  /** A sessão acabou sozinha (queda registrada, Canal fora de uso) e já pode ser recolhida pelo supervisor. */
  readonly encerrada: boolean;
  parar(): Promise<void>;
}

export function criarLeitorDeEmail(opcoes: OpcoesDoLeitorDeEmail = {}): LeitorDeEmail {
  const registrar = opcoes.registrar ?? (() => undefined);
  const pool = opcoes.pool ?? poolPadrao;
  const intervaloDoSupervisorMs = opcoes.intervaloDoSupervisorMs ?? 30_000;
  const intervaloDeConferenciaMs = opcoes.intervaloDeConferenciaMs ?? 120_000;
  const maxIdleTimeMs = opcoes.maxIdleTimeMs ?? 5 * 60_000;
  const maxSessoes = opcoes.maxSessoes ?? 50;
  const esperaInicialMs = opcoes.esperaInicialMs ?? 5_000;
  const esperaMaximaMs = opcoes.esperaMaximaMs ?? 5 * 60_000;
  const estavelMs = opcoes.estavelMs ?? 120_000;
  const esperaDoAnexoMs = opcoes.esperaDoAnexoMs ?? 10_000;
  const maxPorLeitura = opcoes.maxPorLeitura ?? 100;

  // Montados na primeira vez que se precisa deles: criar o padrão não abre conexão nem lê variável.
  let fabricaPronta: FabricaDeConexao | undefined;
  const fabrica = (): FabricaDeConexao => (fabricaPronta ??= opcoes.fabrica ?? criarFabricaDeConexao());
  let acessoPronto: AcessoDoEmail | undefined;
  const acesso = (): AcessoDoEmail => (acessoPronto ??= opcoes.acesso ?? acessoDoEmailDoAmbiente());
  let armazenamentoPronto: ArmazenamentoDeAnexos | undefined;
  const armazenamento = (): ArmazenamentoDeAnexos => (armazenamentoPronto ??= opcoes.armazenamento ?? armazenamentoDeAnexosPadrao());
  let guardaPronta: GuardaDeMidia | undefined;
  const guarda = (): GuardaDeMidia => (guardaPronta ??= opcoes.guarda ?? criarGuardaDeMidia({ armazenamento: armazenamento() }));

  let parado = true;
  let laco: Promise<void> | undefined;
  /** Dispara quando `parar()` é chamado: acorda toda espera do supervisor. */
  let aParada = new Sinal();
  const sessoes = new Map<string, Sessao>();

  const chaveDaSessao = (conta: Pick<ContaDeEmail, "workspaceId" | "canalId">): string => `${conta.workspaceId}:${conta.canalId}`;
  /** A chave da trava consultiva: 64 bits do hash do texto (`hashtextextended`), para dois Canais nunca colidirem. */
  const textoDaTrava = (conta: Pick<ContaDeEmail, "workspaceId" | "canalId">): string => `n1:email-leitor:${conta.workspaceId}:${conta.canalId}`;

  /** Fecha o cliente IMAP sem nunca pendurar nem lançar: uma conexão morta pode não responder ao `logout`. */
  async function fecharImap(cliente: ImapFlow): Promise<void> {
    if (cliente.usable) {
      await Promise.race([
        cliente.logout().catch(() => undefined),
        new Promise<void>((resolver) => setTimeout(resolver, TEMPO_PARA_FECHAR_MS).unref()),
      ]);
    }
    try {
      cliente.close();
    } catch {
      // já fechado
    }
  }

  function avisarQueEnfileirou(): void {
    try {
      opcoes.aoEnfileirar?.();
    } catch {
      // acordar o processador nunca derruba a leitura: a reserva dele cobre
    }
  }

  // ---------------------------------------------------------------------------------------------------------------------
  // A sessão de um Canal
  // ---------------------------------------------------------------------------------------------------------------------

  function iniciarSessao(conta: ContaDeEmail): Sessao {
    const alvo = { workspaceId: conta.workspaceId, canalId: conta.canalId };
    let sessaoParada = false;
    let encerrada = false;
    const fim = new Sinal();
    /** Quantas vezes cada e-mail (UIDVALIDITY:UID) já segurou o cursor; vive enquanto a sessão (e as reconexões dela) viver. */
    const tentativas = new Map<string, number>();

    /** Registra a queda (D-17-20). `true` quando a sessão pode parar; `false` quando o banco não deixou gravar (volta a tentar). */
    async function derrubar(motivo: string): Promise<boolean> {
      try {
        await registrarQuedaDoEmail(pool, alvo, motivo);
        registrar("warn", "caixa de e-mail caiu: a leitura parou", { canalId: conta.canalId });
        return true;
      } catch (erro) {
        registrar("warn", "não foi possível registrar a queda da caixa de e-mail", { canalId: conta.canalId, erro: erro instanceof Error ? erro.name : "erro" });
        return false;
      }
    }

    /**
     * Lê o que há de novo depois do cursor e o põe na fila, um e-mail por vez. `"mais"`: ficou e-mail por ler (o lote
     * acabou), vale outra volta já. `"adiar"`: um e-mail segurou o cursor (anexo no bucket fora do ar), vale outra volta depois
     * de `esperaDoAnexoMs`.
     */
    async function lerNovos(cliente: ImapFlow, paraOProvedor: CanalParaProvedor): Promise<"ok" | "mais" | "adiar"> {
      const trava = await cliente.getMailboxLock(PASTA_LIDA);
      let novas = 0;
      try {
        const caixa = cliente.mailbox;
        if (caixa === false) return "ok";
        const uidValidity = caixa.uidValidity.toString();
        const cursor = await lerCursor(pool(), conta.workspaceId, conta.canalId, PASTA_LIDA);
        if (!cursor) {
          // A conta sem cursor (não deveria existir: conectar grava os dois) recomeça de agora; nunca importa o histórico.
          await gravarCursor(pool(), conta.workspaceId, conta.canalId, { pasta: PASTA_LIDA, uidValidity, proximoUid: caixa.uidNext });
          registrar("info", "cursor da caixa criado no UIDNEXT atual", { canalId: conta.canalId });
          return "ok";
        }
        if (cursor.uidValidity !== uidValidity) {
          // Os UIDs de antes não valem mais: recomeça do `UIDNEXT` novo e não reimporta nada (D-17-08).
          await gravarCursor(pool(), conta.workspaceId, conta.canalId, { pasta: PASTA_LIDA, uidValidity, proximoUid: caixa.uidNext });
          registrar("warn", "uidvalidity mudou: a leitura recomeça do UIDNEXT novo e nada é reimportado", { canalId: conta.canalId });
          return "ok";
        }

        // `n:*` devolve a última mensagem da caixa mesmo quando ela está ABAIXO de `n`: o que sobra do cursor é descartado.
        const listadas = (await cliente.fetchAll(`${cursor.proximoUid}:*`, { uid: true, size: true, internalDate: true }, { uid: true }))
          .filter((mensagem) => mensagem.uid >= cursor.proximoUid)
          .sort((a, b) => a.uid - b.uid);
        const lote = listadas.slice(0, maxPorLeitura);

        for (const mensagem of lote) {
          if (sessaoParada) return "ok";
          const uid = mensagem.uid;
          const tamanho = mensagem.size ?? 0;
          const chaveDaTentativa = `${uidValidity}:${uid}`;
          const proximo = { pasta: PASTA_LIDA, uidValidity, proximoUid: uid + 1 };
          let preparado: EmailPreparado;

          if (tamanho > TETO_DO_EMAIL_RECEBIDO_BYTES) {
            // Acima do teto o e-mail nem é baixado (T-17-47): fica registrado como ignorado.
            const chave = chaveDePosicao(uidValidity, uid, tamanho);
            preparado = { chave, corpo: corpoIgnorado("grande_demais", { messageId: chave, uid, uidValidity }), algumTransitorio: false };
          } else {
            const lida = await cliente.fetchOne(String(uid), { uid: true, source: true }, { uid: true });
            if (lida === false || lida.source === undefined) {
              // Sumiu entre a listagem e a leitura (apagado por outro cliente): o cursor passa dele.
              await gravarCursor(pool(), conta.workspaceId, conta.canalId, proximo);
              continue;
            }
            const recebidoEm =
              mensagem.internalDate === undefined || Number.isNaN(new Date(mensagem.internalDate).getTime())
                ? undefined
                : new Date(mensagem.internalDate).toISOString();
            try {
              preparado = await prepararEmailRecebido({
                bytes: new Uint8Array(lida.source.buffer, lida.source.byteOffset, lida.source.byteLength),
                uid,
                uidValidity,
                recebidoEm,
                workspaceId: conta.workspaceId,
                canal: paraOProvedor,
                guarda: guarda(),
                armazenamento: armazenamento(),
              });
            } catch {
              // O tradutor não lança por causa do conteúdo; se lançou, é algo fora do e-mail (ou um defeito dele). Três vezes
              // seguidas e o e-mail entra como ilegível, para não prender a caixa inteira atrás dele.
              const vezes = (tentativas.get(chaveDaTentativa) ?? 0) + 1;
              tentativas.set(chaveDaTentativa, vezes);
              registrar("warn", "o tradutor do e-mail lançou", { canalId: conta.canalId, tentativa: vezes });
              if (vezes < TENTATIVAS_DO_ANEXO) return "adiar";
              const chave = chaveDePosicao(uidValidity, uid, tamanho);
              preparado = { chave, corpo: corpoIgnorado("ilegivel", { messageId: chave, uid, uidValidity }), algumTransitorio: false };
            }
          }

          if (preparado.algumTransitorio) {
            const vezes = (tentativas.get(chaveDaTentativa) ?? 0) + 1;
            tentativas.set(chaveDaTentativa, vezes);
            // O bucket pode voltar em instantes: segura o cursor e relê. Gasta as tentativas, o e-mail entra com `baixado: false`.
            if (vezes < TENTATIVAS_DO_ANEXO) {
              registrar("warn", "anexo do e-mail sem bucket por ora: a leitura espera", { canalId: conta.canalId, tentativa: vezes });
              return "adiar";
            }
          }
          tentativas.delete(chaveDaTentativa);

          const resultado = await enfileirarEmailEAvancar(pool, alvo, { chave: preparado.chave, corpo: preparado.corpo }, proximo);
          if (resultado === "guardada") novas += 1;
        }
        return listadas.length > lote.length ? "mais" : "ok";
      } finally {
        trava.release();
        if (novas > 0) {
          registrar("info", "e-mails novos na fila de entrada", { canalId: conta.canalId, quantidade: novas });
          avisarQueEnfileirou();
        }
      }
    }

    /** Uma sessão IMAP de ponta a ponta: do `abrirImap` até a queda da conexão ou a parada. */
    async function umaSessao(): Promise<"reconectar" | "encerrar"> {
      const canal = await criarRepositorioDeCanaisPg(pool()).obter(conta.workspaceId, conta.canalId);
      if (!canal || canal.provedor !== PROVEDOR_DO_EMAIL || canal.estado !== "ativo" || canal.conexao !== "conectada" || canal.conexaoSimulada) {
        return "encerrar";
      }
      const paraOProvedor = await canalParaProvedor(pool(), opcoes.chaves, conta.workspaceId, canal);

      const acessoDaCaixa = await acesso().acessoParaUsar(paraOProvedor);
      if (!acessoDaCaixa.ok) {
        // Autorização retirada, credencial sumida: não há o que repetir. Falha passageira (login do serviço desligado,
        // renovação que falhou): só espera.
        if (acessoDaCaixa.permanente) return (await derrubar(acessoDaCaixa.motivo)) ? "encerrar" : "reconectar";
        registrar("warn", "sem acesso à caixa de e-mail por ora", { canalId: conta.canalId, codigo: acessoDaCaixa.codigo });
        return "reconectar";
      }
      const auth = acessoDaCaixa.auth;

      let cliente: ImapFlow;
      try {
        // A guarda de rede de D-17-07 roda DENTRO de `abrirImap`, a cada abertura: uma reconexão nunca a pula (T-17-48).
        cliente = await fabrica().abrirImap({
          host: conta.imap.host,
          porta: conta.imap.porta,
          auth,
          uso: "leitor",
          maxIdleTimeMs,
          ...(auth.tipo === "oauth" ? { sessaoExpiraEm: auth.expiraEm } : {}),
        });
      } catch (erro) {
        const falha = classificarErroDeConexao(erro, "imap", [auth.tipo === "senha" ? auth.senha : auth.accessToken]);
        if (falha.tipo === "recusou_login") return (await derrubar(FRASE_DA_SENHA_RECUSADA_NA_LEITURA)) ? "encerrar" : "reconectar";
        registrar("warn", "não conectou à caixa de e-mail", { canalId: conta.canalId, tipo: falha.tipo });
        return "reconectar";
      }

      const fechou = new Sinal();
      cliente.on("close", () => fechou.disparar());
      // O `error` sem ouvinte derrubaria o processo; a fábrica já pôs um, e este diz à sessão que acabou.
      cliente.on("error", () => fechou.disparar());

      let emVoo: Promise<void> | undefined;
      let pedirOutra = false;
      let temporizadorDoAnexo: ReturnType<typeof setTimeout> | undefined;

      const agendar = (): void => {
        if (sessaoParada) return;
        if (emVoo) {
          pedirOutra = true;
          return;
        }
        emVoo = (async () => {
          try {
            let situacao: "ok" | "mais" | "adiar";
            do {
              pedirOutra = false;
              situacao = await lerNovos(cliente, paraOProvedor);
            } while ((pedirOutra || situacao === "mais") && !sessaoParada);
            if (situacao === "adiar" && !sessaoParada) {
              temporizadorDoAnexo = setTimeout(agendar, esperaDoAnexoMs);
              temporizadorDoAnexo.unref();
            }
          } catch (erro) {
            // Falha de leitura ou de banco: a conferência seguinte tenta de novo. Se a conexão morreu, o `close` já vai chegar.
            registrar("warn", "a leitura da caixa de e-mail falhou", { canalId: conta.canalId, erro: erro instanceof Error ? erro.name : "erro" });
          } finally {
            emVoo = undefined;
          }
        })();
      };

      cliente.on("exists", agendar);
      const conferencia = setInterval(agendar, intervaloDeConferenciaMs);
      conferencia.unref();
      agendar();

      try {
        await Sinal.esperar(undefined, fechou, fim);
      } finally {
        clearInterval(conferencia);
        if (temporizadorDoAnexo) clearTimeout(temporizadorDoAnexo);
        await fecharImap(cliente);
        await emVoo;
      }
      return sessaoParada ? "encerrar" : "reconectar";
    }

    async function rodar(): Promise<void> {
      let espera = esperaInicialMs;
      while (!sessaoParada) {
        const inicio = Date.now();
        let desfecho: "reconectar" | "encerrar";
        try {
          desfecho = await umaSessao();
        } catch (erro) {
          registrar("warn", "a sessão da caixa de e-mail falhou", { canalId: conta.canalId, erro: erro instanceof Error ? erro.name : "erro" });
          desfecho = "reconectar";
        }
        if (desfecho === "encerrar" || sessaoParada) break;
        // A sessão que durou o bastante prova que o servidor está bem: a espera recomeça do começo.
        if (Date.now() - inicio >= estavelMs) espera = esperaInicialMs;
        registrar("info", "sessão da caixa de e-mail vai reconectar", { canalId: conta.canalId, esperaMs: espera });
        await Sinal.esperar(espera, fim);
        espera = Math.min(espera * 2, esperaMaximaMs);
      }
    }

    const andamento = rodar()
      .catch((erro: unknown) => {
        registrar("error", "o laço da sessão da caixa de e-mail terminou", { canalId: conta.canalId, erro: erro instanceof Error ? erro.name : "erro" });
      })
      .finally(() => {
        encerrada = true;
      });

    return {
      conta,
      get encerrada() {
        return encerrada;
      },
      async parar() {
        sessaoParada = true;
        fim.disparar();
        await andamento;
      },
    };
  }

  // ---------------------------------------------------------------------------------------------------------------------
  // O supervisor e a conexão dedicada das travas
  // ---------------------------------------------------------------------------------------------------------------------

  async function pararTodas(): Promise<void> {
    const todas = [...sessoes.values()];
    sessoes.clear();
    await Promise.all(todas.map((sessao) => sessao.parar()));
  }

  /** Uma volta do supervisor: recolhe as sessões que acabaram ou cujo Canal saiu da lista, e abre as dos Canais novos. */
  async function varrer(travas: Client): Promise<void> {
    const contas = (await contasParaLer(pool())).filter(opcoes.filtrarContas ?? (() => true));
    const ativas = new Set(contas.map(chaveDaSessao));

    for (const [chave, sessao] of [...sessoes]) {
      if (ativas.has(chave) && !sessao.encerrada) continue;
      // A sessão acaba ANTES da trava ser solta: duas leituras do mesmo Canal nunca se sobrepõem.
      await sessao.parar();
      sessoes.delete(chave);
      await travas.query("select pg_advisory_unlock(hashtextextended($1, 0))", [textoDaTrava(sessao.conta)]);
    }

    for (const conta of contas) {
      if (parado) return;
      if (sessoes.has(chaveDaSessao(conta))) continue;
      if (sessoes.size >= maxSessoes) {
        registrar("warn", "teto de sessões do leitor de e-mail atingido", { maximo: maxSessoes });
        return;
      }
      const { rows } = await travas.query<{ ok: boolean }>("select pg_try_advisory_lock(hashtextextended($1, 0)) as ok", [textoDaTrava(conta)]);
      if (!rows[0]?.ok) continue; // outro processo lê este Canal
      sessoes.set(chaveDaSessao(conta), iniciarSessao(conta));
      registrar("info", "sessão da caixa de e-mail aberta", { canalId: conta.canalId });
    }
  }

  async function rodarSupervisor(url: string): Promise<void> {
    let espera = esperaInicialMs;
    let ssl: OpcoesSsl;
    let sslPronto = false;
    while (!parado) {
      if (!sslPronto) {
        ssl = construirSsl({ connectionString: url });
        sslPronto = true;
      }
      // A conexão DEDICADA das travas (F5): fora do pool, sem `query_timeout`, e com `keepAlive` como a do ouvinte do tempo real.
      const travas = new Client({
        connectionString: url,
        keepAlive: true,
        connectionTimeoutMillis: TEMPO_PARA_CONECTAR_MS,
        ...(opcoes.nomeDaAplicacao ? { application_name: opcoes.nomeDaAplicacao } : {}),
        ...(ssl ? { ssl } : {}),
      });
      let caiu = false;
      const queda = new Sinal();
      // Antes do `connect()`: um `error` sem ouvinte derrubaria o processo.
      travas.on("error", () => {
        caiu = true;
        queda.disparar();
      });
      travas.on("end", () => {
        caiu = true;
        queda.disparar();
      });

      try {
        await travas.connect();
        espera = esperaInicialMs;
        registrar("info", "leitor de e-mail conectado ao banco");
        while (!parado && !caiu) {
          await varrer(travas);
          if (parado || caiu) break;
          await Sinal.esperar(intervaloDoSupervisorMs, aParada, queda);
        }
      } catch (erro) {
        registrar("warn", "o supervisor do leitor de e-mail falhou", { erro: erro instanceof Error ? erro.name : "erro" });
      }

      // Sem a conexão dedicada não há trava: todas as sessões param na hora (outro processo pode assumir os Canais) e o
      // supervisor refaz as travas na volta.
      await pararTodas();
      await Promise.race([travas.end().catch(() => undefined), new Promise<void>((resolver) => setTimeout(resolver, TEMPO_PARA_FECHAR_MS).unref())]);
      if (caiu && !parado) registrar("warn", "a conexão das travas do leitor de e-mail caiu; vai reconectar");
      if (parado) break;
      await Sinal.esperar(espera, aParada);
      espera = Math.min(espera * 2, esperaMaximaMs);
    }
  }

  return {
    iniciar() {
      if (laco) return;
      let url = opcoes.url;
      if (url === undefined) {
        carregarEnv();
        url = process.env.DATABASE_URL;
      }
      if (!url) {
        registrar("warn", "leitor de e-mail não iniciou: DATABASE_URL não definida");
        return;
      }
      parado = false;
      aParada = new Sinal();
      laco = rodarSupervisor(url)
        .catch((erro: unknown) => {
          registrar("error", "o laço do leitor de e-mail terminou", { erro: erro instanceof Error ? erro.name : "erro" });
        })
        .finally(() => {
          laco = undefined;
        });
    },

    async parar() {
      parado = true;
      aParada.disparar();
      await laco;
    },

    canaisLidos() {
      return [...sessoes.values()].map((sessao) => sessao.conta.canalId);
    },
  };
}
