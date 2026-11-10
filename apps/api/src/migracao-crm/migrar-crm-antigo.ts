/**
 * O script `migrar:crm-antigo` (15-27, UCR-09): guardar o CRM antigo de UM Espaço, decidir o Funil e
 * limpar a Pasta "Meus negócios".
 *
 * Cada modo que escreve roda numa única `executar()` do Espaço (a trava padrão): a trava da linha do
 * Espaço, `revisao + 1` (os navegadores abertos se re-hidratam), os prazos do servidor e o `rollback` em
 * qualquer falha vêm de graça. A ordem dentro da transação é a de F14-D-03:
 *
 *   1. `lerDoCrm`     — decide o plano (recusa antes de escrever, se for o caso), copia para
 *                       `registros_crm_antigo` e CONFERE a cópia (lança se não bate);
 *   2. `operacao`     — pura; NÃO toca nas nove coleções antigas, só tira a Pasta "Meus negócios" (D-15-14);
 *   3. `aoConfirmar`  — insere o Funil e, em seguida, o plano do mapeador de entidades (no `--migrar`), e só
 *                       então apaga de `registros` por SQL.
 *
 * Toda leitura das coleções antigas é por SQL em `plataforma.registros`, tipada por
 * `formatos-antigos.ts`, nunca pelo `state`; assim o script sobrevive à remoção do modelo antigo (3.5.4)
 * sem mudança. Nada aqui lê nem imprime dado pessoal: só ids, contagens e nomes de configuração.
 */

import type { PoolClient } from "pg";
import { fail, ok } from "@n1/dominio/state";
import { pool } from "../persistencia/conexao";
import { hidratar } from "../persistencia/repositorio";
import { executar } from "../persistencia/unidade-de-trabalho";
import { COLECOES_DO_CRM_ANTIGO, COLECOES_SEM_GRUPO, ErroDeUso, validarEspaco } from "./colecoes";
import { lerCrmNovoDoEspaco, lerLinhasAntigas } from "./crm-novo";
import {
  contarReferenciasAoFunil,
  type DecisaoDeFunil,
  etapasDosFunisAInserir,
  type FunilNaoMigrado,
  inserirFunis,
  lerFunilPreferido,
  lerFunisAntigos,
  lerFunisDoCrmNovo,
  planejarFunis,
  type PlanoDeFunis,
} from "./funil";
import {
  type Alvo,
  apagarDoRegistros,
  type ChaveDeRegistro,
  conferirCopia,
  contarConversasDeFlow,
  contarConversasDeGrupo,
  contarDoAlvo,
  contarGuardadas,
  copiarParaRegistrosCrmAntigo,
} from "./guardar";
import { type Inseridos, inserirPlano } from "./inserir";
import { contarLinhasDoPlano, type PlanoDeMigracao, planejarMigracao } from "./mapeador";
import type { NaoMigrado } from "./nao-migrados";
import { chavesDaPasta, type PlanoDaPasta, planejarPasta, removerPasta } from "./pasta-meus-negocios";
import { type EntradaDoRelatorio, type FunilDoRelatorio, montarRelatorio, montarResumoDeEscrita } from "./relatorio";

export type { DecisaoDeFunil } from "./funil";

/** Ganchos só dos testes: provam a volta atrás (rollback) injetando falha entre duas etapas. */
export interface GanchosDeTeste {
  /** Roda depois da cópia e antes da conferência. */
  readonly antesDeConferir?: (cliente: PoolClient) => Promise<void>;
  /** Roda no `aoConfirmar` do `--migrar`, logo depois de inserir o Funil. */
  readonly depoisDeInserirFunis?: (cliente: PoolClient) => Promise<void>;
  /** Roda no `aoConfirmar` do `--migrar`, logo depois de `inserirPlano` (Contatos, Empresas, Negócios...). */
  readonly depoisDeInserirPlano?: (cliente: PoolClient) => Promise<void>;
}

export interface OpcoesDeEscrita {
  readonly ganchosDeTeste?: GanchosDeTeste;
  /** `--funil=migrar|guardar`: o que fazer com o Funil antigo (só no `--migrar`). */
  readonly funil?: DecisaoDeFunil;
}

export interface ResultadoDeEscrita {
  readonly espaco: string;
  /** Verdadeiro quando não havia o que copiar, apagar ou inserir: nada foi escrito, nem a revisão do Espaço subiu. */
  readonly nadaAFazer: boolean;
  /** Linhas que entraram em `registros_crm_antigo` NESTA execução. */
  readonly copiadas: number;
  /** Linhas apagadas de `registros` nesta execução, por coleção (a Pasta "Meus negócios" não entra: sai pela operação). */
  readonly apagadas: Readonly<Record<string, number>>;
  /** Conversas de Grupo que continuam em `registros` (F14-D-05). */
  readonly conversasDeGrupoQueFicaram: number;
  /**
   * Conversas 1:1 que continuam em `registros` por serem do modelo que fica (15-44, H-02): as que o Flow, a Automação
   * e o convite de Grupo abrem com um Contato de `plataforma.contatos`, e as que não dá para classificar.
   */
  readonly conversasDeFlowQueFicaram: number;
  readonly funisMigrados: number;
  readonly funisNaoMigrados: readonly FunilNaoMigrado[];
  /** Linhas que entraram em cada tabela nova do CRM nesta execução (sem Funil e Etapa, que vêm em `funisMigrados`). */
  readonly entidadesMigradas: Inseridos;
  /** O que ficou de fora das tabelas novas, só com coleção e id (continua em `registros_crm_antigo`). */
  readonly naoMigrados: readonly NaoMigrado[];
  /** A Pasta "Meus negócios" saiu de `registros` nesta execução. */
  readonly pastaRemovida: boolean;
  /** A revisão do Espaço depois da escrita; indefinida quando não houve escrita. */
  readonly revisao: number | undefined;
  /** O resumo em português, só com contagens e nomes de configuração. */
  readonly mensagem: string;
}

/** A marca que `operacao` devolve quando não há nada a fazer: `executar()` desfaz sem subir a revisão. */
const NADA_A_FAZER = "nada a fazer";

const RECUSA_SEM_DECISAO_DO_FUNIL =
  "Este Espaço tem Funil do CRM antigo: diga o que fazer com ele com --funil=migrar (leva o Funil e as Etapas para o CRM novo) ou --funil=guardar (só na cópia; o Espaço fica sem Funil).";

type Modo = "guardar" | "migrar";

/** O que `lerDoCrm` decide e `operacao`/`aoConfirmar` executam. */
interface Plano {
  readonly recusa: string | undefined;
  readonly nadaAFazer: boolean;
  readonly copiadas: number;
  readonly aApagar: Readonly<Record<string, number>>;
  readonly conversasDeGrupo: number;
  readonly conversasDeFlow: number;
  /** O alvo do `delete` em SQL: as oito coleções e as Conversas do CRM antigo (a Pasta sai pela operação). */
  readonly apagar: Alvo;
  readonly pasta: PlanoDaPasta;
  readonly funis: PlanoDeFunis;
  /** O que o mapeador de entidades leva para as tabelas novas (vazio no `--guardar`). */
  readonly entidades: PlanoDeMigracao;
}

const SEM_PASTA: PlanoDaPasta = { existe: false, nome: undefined, listas: [], removivel: false };
const SEM_FUNIS: PlanoDeFunis = { aInserir: [], naoMigrados: [] };
const SEM_ENTIDADES: PlanoDeMigracao = planejarMigracao([]);


/** As linhas que se copiam: as nove coleções INTEIRAS (as Conversas de Grupo também) e as linhas da Pasta. */
function alvoDeCopiar(extras: readonly ChaveDeRegistro[]): Alvo {
  return { colecoes: COLECOES_DO_CRM_ANTIGO, conversasSemGrupo: false, extras };
}

/** As linhas que saem de `registros`: as oito coleções e as Conversas do CRM antigo, mais (na conferência) as da Pasta. */
function alvoDeApagar(extras: readonly ChaveDeRegistro[]): Alvo {
  return { colecoes: COLECOES_SEM_GRUPO, conversasSemGrupo: true, extras };
}

function soma(porColecao: Readonly<Record<string, number>>): number {
  return Object.values(porColecao).reduce((total, n) => total + n, 0);
}

/** `--espaco` existe em `plataforma.workspaces`? Sem Espaço não há o que guardar, e `executar()` lançaria um erro genérico. */
async function exigirEspacoExistente(espaco: string): Promise<void> {
  validarEspaco(espaco);
  const achou = await pool().query("select 1 from plataforma.workspaces where workspace_id = $1", [espaco]);
  if ((achou.rowCount ?? 0) === 0) throw new ErroDeUso(`Espaço não encontrado: ${espaco}.`);
}

/**
 * Uma transação SÓ DE LEITURA: `begin read only`, então o Postgres recusa qualquer escrita (`25006`).
 * É o que faz o `--seco` e o `--verificar` não poderem escrever, mesmo com um erro de código.
 */
export async function emTransacaoSoLeitura<T>(fn: (cliente: PoolClient) => Promise<T>): Promise<T> {
  const cliente = await pool().connect();
  try {
    await cliente.query("begin read only");
    return await fn(cliente);
  } finally {
    await cliente.query("rollback").catch(() => undefined);
    cliente.release();
  }
}

async function escrever(espaco: string, modo: Modo, opcoes: OpcoesDeEscrita): Promise<ResultadoDeEscrita> {
  await exigirEspacoExistente(espaco);

  let visto: Plano | undefined;
  let apagadas: Readonly<Record<string, number>> = {};
  let funisInseridos = { funis: 0, etapas: 0 };
  let entidadesInseridas: Inseridos = {};

  const resultado = await executar<Plano, Plano>(
    espaco,
    (estado, plano) => {
      if (plano.recusa) return fail(plano.recusa);
      if (plano.nadaAFazer) return fail(NADA_A_FAZER);
      removerPasta(estado, plano.pasta);
      return ok(plano);
    },
    {
      lerDoCrm: async (cliente, estado) => {
        const pasta = planejarPasta(estado);
        const extras = chavesDaPasta(estado, pasta);
        let funis = SEM_FUNIS;
        let entidades = SEM_ENTIDADES;

        // 1) A recusa vem ANTES de qualquer escrita (nem a cópia): com Funil antigo o dono precisa dizer o que
        //    fazer com ele. O resto do CRM antigo (Contatos, Empresas, Negócios, Canais, Conversas) passa pelo
        //    mapeador, que manda ao relatório o que o banco recusaria (15-28).
        let recusa: string | undefined;
        if (modo === "migrar") {
          const funisAntigos = await lerFunisAntigos(cliente, espaco);
          if (funisAntigos.length > 0 && !opcoes.funil) {
            recusa = RECUSA_SEM_DECISAO_DO_FUNIL;
          } else {
            if (funisAntigos.length > 0 && opcoes.funil) {
              funis = planejarFunis(funisAntigos, await lerFunisDoCrmNovo(cliente, espaco), opcoes.funil, await lerFunilPreferido(cliente, espaco));
            }
            const antigas = await lerLinhasAntigas(cliente, espaco);
            entidades = planejarMigracao(antigas, await lerCrmNovoDoEspaco(cliente, espaco, antigas), { funisMigrados: etapasDosFunisAInserir(funis) });
          }
        }
        if (recusa) {
          visto = { recusa, nadaAFazer: false, copiadas: 0, aApagar: {}, conversasDeGrupo: 0, conversasDeFlow: 0, apagar: alvoDeApagar([]), pasta, funis, entidades };
          return visto;
        }

        // 2) Copiar, conferir e só então deixar o `aoConfirmar` apagar.
        const copiar = alvoDeCopiar(extras);
        const copiadas = await copiarParaRegistrosCrmAntigo(cliente, espaco, copiar);
        if (opcoes.ganchosDeTeste?.antesDeConferir) await opcoes.ganchosDeTeste.antesDeConferir(cliente);
        await conferirCopia(cliente, espaco, copiar, alvoDeApagar(extras));
        const apagar = alvoDeApagar([]);
        const aApagar = await contarDoAlvo(cliente, espaco, apagar);
        visto = {
          recusa: undefined,
          nadaAFazer: copiadas === 0 && soma(aApagar) === 0 && extras.length === 0 && funis.aInserir.length === 0,
          copiadas,
          aApagar,
          conversasDeGrupo: await contarConversasDeGrupo(cliente, espaco),
          conversasDeFlow: await contarConversasDeFlow(cliente, espaco),
          apagar,
          pasta,
          funis,
          entidades,
        };
        return visto;
      },
      aoConfirmar: async (cliente, plano) => {
        if (modo === "migrar") {
          funisInseridos = await inserirFunis(cliente, espaco, plano.funis);
          if (opcoes.ganchosDeTeste?.depoisDeInserirFunis) await opcoes.ganchosDeTeste.depoisDeInserirFunis(cliente);
          entidadesInseridas = await inserirPlano(cliente, espaco, plano.entidades);
          if (opcoes.ganchosDeTeste?.depoisDeInserirPlano) await opcoes.ganchosDeTeste.depoisDeInserirPlano(cliente);
        }
        apagadas = await apagarDoRegistros(cliente, espaco, plano.apagar);
      },
    },
  );

  if ("conflito" in resultado) throw new Error(resultado.error);
  if (!resultado.ok && resultado.error !== NADA_A_FAZER) throw new ErroDeUso(resultado.error);

  const plano = visto;
  const nadaAFazer = !resultado.ok;
  const pasta = plano?.pasta ?? SEM_PASTA;
  const funisNaoMigrados = plano?.funis.naoMigrados ?? [];
  const mensagem = montarResumoDeEscrita({
    espaco,
    modo,
    nadaAFazer,
    copiadas: nadaAFazer ? 0 : (plano?.copiadas ?? 0),
    apagadas,
    conversasDeGrupo: plano?.conversasDeGrupo ?? 0,
    conversasDeFlow: plano?.conversasDeFlow ?? 0,
    funis: { migrados: funisInseridos.funis, etapas: funisInseridos.etapas, naoMigrados: funisNaoMigrados },
    pasta,
    ...(modo === "migrar" && !nadaAFazer ? { entidades: { porTabela: entidadesInseridas, naoMigrados: plano?.entidades.naoMigrados ?? [] } } : {}),
  });
  return {
    espaco,
    nadaAFazer,
    copiadas: nadaAFazer ? 0 : (plano?.copiadas ?? 0),
    apagadas,
    conversasDeGrupoQueFicaram: nadaAFazer ? 0 : (plano?.conversasDeGrupo ?? 0),
    conversasDeFlowQueFicaram: nadaAFazer ? 0 : (plano?.conversasDeFlow ?? 0),
    funisMigrados: funisInseridos.funis,
    funisNaoMigrados,
    entidadesMigradas: entidadesInseridas,
    naoMigrados: plano?.entidades.naoMigrados ?? [],
    pastaRemovida: !nadaAFazer && pasta.removivel,
    revisao: resultado.ok ? resultado.revisao : undefined,
    mensagem,
  };
}

/**
 * `--guardar`: copia as nove coleções do CRM antigo do Espaço para `registros_crm_antigo`, confere e
 * só então apaga de `registros` (D-15-01); a Pasta "Meus negócios" sai junto se todas as Listas estão
 * vazias (D-15-14). Não cria linha no CRM novo. Repetir não faz nada.
 */
export function guardarCrmAntigo(espaco: string, opcoes: OpcoesDeEscrita = {}): Promise<ResultadoDeEscrita> {
  return escrever(espaco, "guardar", opcoes);
}

/**
 * `--migrar`: faz o `--guardar`, leva o Funil para o CRM novo conforme `--funil` (D-15-04) e, na mesma
 * transação, Contatos, Empresas, vínculos, Negócios, Canais, Conversas e Mensagens (15-28). O que o banco
 * novo recusaria vai para o relatório de não migrados em vez de derrubar o Espaço. Recusa, antes de
 * escrever, o Espaço com Funil antigo sem `--funil`.
 */
export function migrarCrmAntigo(espaco: string, opcoes: OpcoesDeEscrita = {}): Promise<ResultadoDeEscrita> {
  return escrever(espaco, "migrar", opcoes);
}

/**
 * `--seco`: o relatório do que há no Espaço e do que cada modo faria, numa sessão `begin read only`
 * (o Postgres recusa qualquer escrita). Só imprime ids, contagens e nomes de configuração.
 */
export async function relatorioSeco(espaco: string): Promise<string> {
  await exigirEspacoExistente(espaco);
  return emTransacaoSoLeitura(async (cliente) => {
    const { state } = await hidratar(cliente, espaco);
    const porColecao = await contarDoAlvo(cliente, espaco, alvoDeCopiar([]));
    const guardadas = await contarGuardadas(cliente, espaco);
    const funisAntigos = await lerFunisAntigos(cliente, espaco);
    const funisNovos = await lerFunisDoCrmNovo(cliente, espaco);
    const plano = planejarFunis(funisAntigos, funisNovos, "migrar", await lerFunilPreferido(cliente, espaco));
    const naoMigrados = new Map(plano.naoMigrados.map((f) => [f.id, f.motivo]));
    const padraoDe = new Map(plano.aInserir.map((f) => [f.id, f.padrao]));

    const funis: FunilDoRelatorio[] = [];
    for (const antigo of funisAntigos) {
      const motivo = naoMigrados.get(antigo.id);
      funis.push({
        id: antigo.id,
        nome: antigo.name,
        estado: antigo.lifecycle ?? "ativo",
        privado: antigo.isPrivate === true,
        // A posição (1..N) é a que a Etapa terá no CRM novo: a ordem antiga começa em 0 e pode ter buracos.
        etapas: [...(antigo.stages ?? [])]
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .map((e, indice) => ({ nome: e.name, ordem: indice + 1, probabilidade: e.defaultProbability ?? 0 })),
        referencias: await contarReferenciasAoFunil(cliente, espaco, antigo.id),
        destino: motivo !== undefined ? { tipo: "nao-migra", motivo } : { tipo: "migra", padrao: padraoDe.get(antigo.id) === true },
      });
    }

    // O que o `--migrar` levaria às tabelas novas e o que deixaria de fora (a mesma conta, sem escrever).
    const antigas = await lerLinhasAntigas(cliente, espaco);
    const previsto = planejarMigracao(antigas, await lerCrmNovoDoEspaco(cliente, espaco, antigas), { funisMigrados: etapasDosFunisAInserir(plano) });

    const entrada: EntradaDoRelatorio = {
      espaco,
      noRegistros: COLECOES_DO_CRM_ANTIGO.map((colecao) => ({ colecao, linhas: porColecao[colecao] ?? 0 })),
      conversasDeGrupo: await contarConversasDeGrupo(cliente, espaco),
      conversasDeFlow: await contarConversasDeFlow(cliente, espaco),
      jaGuardadas: Object.entries(guardadas).map(([colecao, linhas]) => ({ colecao, linhas })),
      funis,
      funisNoCrmNovo: { total: funisNovos.length, temPadrao: funisNovos.some((f) => f.padrao) },
      pasta: planejarPasta(state),
      entidades: { porTabela: contarLinhasDoPlano(previsto), naoMigrados: previsto.naoMigrados },
    };
    return montarRelatorio(entrada);
  });
}

// --- --verificar ---

export interface ResultadoDaVerificacao {
  readonly espaco: string;
  readonly ok: boolean;
  /** O que não confere, em português e só com coleções e contagens; vazio quando `ok`. */
  readonly problemas: readonly string[];
  /** O que `registros_crm_antigo` guarda do Espaço, por coleção: a base de comparação com o `--seco` de antes. */
  readonly guardadas: Readonly<Record<string, number>>;
  readonly mensagem: string;
}

/**
 * `--verificar`: confere, sem escrever (`begin read only`), a pós-condição do corte:
 *
 *   (a) nenhuma linha das oito coleções sem Grupo em `registros`;
 *   (b) em `conversations` de `registros`, nenhuma Conversa do CRM antigo (só ficam as de Grupo e as 1:1 de
 *       Flow/Automação/convite, cujo Contato não é da coleção `contacts` — o MESMO critério do `--guardar`, 15-44);
 *   (c) nenhuma linha órfã em `crm_de_para`: cada uma tem a linha de origem em `registros_crm_antigo`
 *       (a Etapa, que mora dentro do Funil, é conferida pelo Funil: `funnels/stages`);
 *   (d) imprime a contagem por coleção de `registros_crm_antigo`. É a base de comparação de (d): o
 *       roteiro do ensaio (15-30) e do corte (15-34/15-35) guarda a contagem do `--seco` ANTES da escrita
 *       e confere que é a mesma.
 */
export async function verificar(espaco: string): Promise<ResultadoDaVerificacao> {
  await exigirEspacoExistente(espaco);
  return emTransacaoSoLeitura(async (cliente) => {
    const problemas: string[] = [];

    const restantes = await contarDoAlvo(cliente, espaco, { colecoes: COLECOES_SEM_GRUPO, conversasSemGrupo: false, extras: [] });
    for (const [colecao, n] of Object.entries(restantes)) {
      problemas.push(`${colecao}: ${n} linha(s) ainda em registros (deveriam ter saído).`);
    }
    const conversas = await contarDoAlvo(cliente, espaco, { colecoes: [], conversasSemGrupo: true, extras: [] });
    for (const [colecao, n] of Object.entries(conversas)) {
      problemas.push(`${colecao}: ${n} Conversa(s) do CRM antigo ainda em registros (só ficam as de Grupo e as 1:1 de Flow ou Automação).`);
    }

    const orfas = await cliente.query<{ colecao_antiga: string; n: string }>(
      `select p.colecao_antiga, count(*)::text as n
         from plataforma.crm_de_para p
        where p.workspace_id = $1
          and not exists (
            select 1 from plataforma.registros_crm_antigo a
             where a.workspace_id = p.workspace_id
               and a.colecao = split_part(p.colecao_antiga, '/', 1)
               and a.id = case when p.colecao_antiga like '%/%' then split_part(p.id_antigo, '/', 1) else p.id_antigo end)
        group by p.colecao_antiga
        order by p.colecao_antiga`,
      [espaco],
    );
    for (const linha of orfas.rows) {
      problemas.push(`crm_de_para ${linha.colecao_antiga}: ${linha.n} linha(s) órfã(s), sem a linha de origem em registros_crm_antigo.`);
    }

    const guardadas = await contarGuardadas(cliente, espaco);
    const contagem = Object.entries(guardadas).map(([colecao, n]) => `  ${colecao} ${n}`);
    const guardado = contagem.length > 0 ? contagem.join("\n") : "  (nada)";
    const mensagem =
      problemas.length === 0
        ? `Espaço ${espaco}: ok.\nregistros_crm_antigo guarda:\n${guardado}`
        : `Espaço ${espaco}: NÃO CONFERE.\n${problemas.map((p) => `  - ${p}`).join("\n")}\nregistros_crm_antigo guarda:\n${guardado}`;
    return { espaco, ok: problemas.length === 0, problemas, guardadas, mensagem };
  });
}
