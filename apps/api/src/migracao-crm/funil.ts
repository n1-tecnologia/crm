/**
 * O Funil do CRM antigo (D-15-04): planejar o que migra e inserir em `plataforma.funis`/`etapas`.
 *
 * `planejarFunis` é puro (decide; não toca no banco) e `inserirFunis` escreve, sempre dentro da
 * transação de `executar()`. A leitura dos Funis antigos é por SQL em `plataforma.registros`, tipada
 * por `formatos-antigos.ts`.
 *
 * Ids: o Funil mantém o id antigo (as colunas são `text` e nenhuma rota exige UUID), então nada que
 * aponte para ele em `registros` precisa ser reescrito. A Etapa ganha id NOVO (o id antigo só era único
 * dentro do Funil), com uma linha em `crm_de_para` por Etapa: `colecao_antiga = 'funnels/stages'`,
 * `id_antigo = '<funil>/<etapa>'`. É essa linha que o plano 15-28 usa para trocar a Etapa dos Negócios.
 */

import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { COLECOES_DO_CRM_ANTIGO } from "./colecoes";
import type { EtapaAntiga, FunilAntigo } from "./formatos-antigos";

export type DecisaoDeFunil = "migrar" | "guardar";

export interface EtapaParaInserir {
  readonly idAntigo: string;
  readonly nome: string;
  readonly ordem: number;
  readonly probabilidade: number;
  readonly cor: string | null;
  readonly descricao: string | null;
}

export interface FunilParaInserir {
  readonly id: string;
  readonly nome: string;
  readonly descricao: string | null;
  readonly cor: string | null;
  readonly padrao: boolean;
  readonly privado: boolean;
  readonly exigeMotivoPerda: boolean;
  readonly exigeValorGanho: boolean;
  readonly estado: "ativo" | "arquivado" | "na_lixeira";
  readonly criadoPor: string;
  readonly criadoEm: string | null;
  readonly etapas: readonly EtapaParaInserir[];
}

export interface FunilNaoMigrado {
  readonly id: string;
  readonly nome: string;
  readonly motivo: string;
}

export interface PlanoDeFunis {
  readonly aInserir: readonly FunilParaInserir[];
  readonly naoMigrados: readonly FunilNaoMigrado[];
}

/** O que o CRM novo já tem no Espaço: o bastante para decidir nome em uso e padrão. */
export interface FunilDoCrmNovo {
  readonly id: string;
  readonly nome: string;
  readonly padrao: boolean;
  readonly estado: string;
}

const CRIADOR_PADRAO = "migracao-crm-antigo";

function textoOuNulo(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim().length > 0 ? valor.trim() : null;
}

function estadoNovo(ciclo: string | undefined): FunilParaInserir["estado"] {
  if (ciclo === "arquivado") return "arquivado";
  if (ciclo === "naLixeira") return "na_lixeira";
  return "ativo";
}

function chaveDoNome(nome: string): string {
  return nome.trim().toLowerCase();
}

function probabilidade(valor: number | undefined): number {
  if (typeof valor !== "number" || !Number.isFinite(valor)) return 0;
  return Math.min(100, Math.max(0, Math.round(valor)));
}

function instanteValido(valor: unknown): string | null {
  return typeof valor === "string" && !Number.isNaN(Date.parse(valor)) ? valor : null;
}

/** Ordem estável por um número: empate mantém a ordem em que vieram. */
function porOrdem<T>(itens: readonly T[], ordemDe: (item: T) => number): T[] {
  return itens
    .map((item, indice) => ({ item, indice }))
    .sort((a, b) => ordemDe(a.item) - ordemDe(b.item) || a.indice - b.indice)
    .map(({ item }) => item);
}

function planejarEtapas(etapas: readonly EtapaAntiga[]): { readonly etapas: EtapaParaInserir[]; readonly erro: string | undefined } {
  const resultado = porOrdem(etapas, (e) => (typeof e.order === "number" ? e.order : 0)).map((e, indice) => ({
    idAntigo: e.id,
    nome: typeof e.name === "string" ? e.name.trim() : "",
    ordem: indice + 1,
    probabilidade: probabilidade(e.defaultProbability),
    cor: textoOuNulo(e.color),
    descricao: textoOuNulo(e.description),
  }));
  if (resultado.some((e) => e.nome === "")) return { etapas: resultado, erro: "Etapa sem nome" };
  const vistos = new Set<string>();
  for (const e of resultado) {
    const chave = chaveDoNome(e.nome);
    if (vistos.has(chave)) return { etapas: resultado, erro: "Etapas com nome repetido" };
    vistos.add(chave);
  }
  return { etapas: resultado, erro: undefined };
}

/**
 * Decide quais Funis antigos entram no CRM novo.
 *
 * Um Funil NÃO migra (e o relatório diz por quê) se: não tem nome, não tem Etapa, a Etapa não tem nome
 * ou repete o nome de outra do mesmo Funil, o id já existe no CRM novo ou o nome está em uso por Funil
 * ativo ou arquivado (sem distinguir caixa nem espaços nas pontas; a lixeira não conta). Em
 * `--funil=guardar` nenhum migra.
 *
 * Padrão: só se o Espaço ainda não tem Funil padrão. Entre os elegíveis (ativo, não privado), vale o
 * que o Espaço apontava (`preferidoId`) e, na falta dele, o primeiro pela ordem antiga.
 */
export function planejarFunis(
  funisAntigos: readonly FunilAntigo[],
  funisNovosDoEspaco: readonly FunilDoCrmNovo[],
  decisao: DecisaoDeFunil,
  preferidoId?: string,
): PlanoDeFunis {
  if (decisao === "guardar") return { aInserir: [], naoMigrados: [] };

  const nomesEmUso = new Set(funisNovosDoEspaco.filter((f) => f.estado !== "na_lixeira").map((f) => chaveDoNome(f.nome)));
  const idsExistentes = new Set(funisNovosDoEspaco.map((f) => f.id));
  const naoMigrados: FunilNaoMigrado[] = [];
  const candidatos: Omit<FunilParaInserir, "padrao">[] = [];

  for (const antigo of porOrdem(funisAntigos, (f) => (typeof f.order === "number" ? f.order : 0))) {
    const recusar = (motivo: string) => naoMigrados.push({ id: antigo.id, nome: antigo.name, motivo });
    const nome = typeof antigo.name === "string" ? antigo.name.trim() : "";
    if (nome === "") {
      recusar("sem nome");
      continue;
    }
    if ((antigo.stages ?? []).length === 0) {
      recusar("sem Etapa");
      continue;
    }
    if (idsExistentes.has(antigo.id)) {
      recusar("id já existe no CRM novo");
      continue;
    }
    const { etapas, erro } = planejarEtapas(antigo.stages ?? []);
    if (erro) {
      recusar(erro);
      continue;
    }
    const estado = estadoNovo(antigo.lifecycle);
    if (estado !== "na_lixeira") {
      if (nomesEmUso.has(chaveDoNome(nome))) {
        recusar("nome em uso");
        continue;
      }
      nomesEmUso.add(chaveDoNome(nome));
    }
    candidatos.push({
      id: antigo.id,
      nome,
      descricao: textoOuNulo(antigo.description),
      cor: textoOuNulo(antigo.color),
      privado: antigo.isPrivate === true,
      exigeMotivoPerda: antigo.closingRules?.requireLossReason === true,
      exigeValorGanho: antigo.closingRules?.requireValueOnWin === true,
      estado,
      criadoPor: textoOuNulo(antigo.createdBy?.id) ?? CRIADOR_PADRAO,
      criadoEm: instanteValido(antigo.createdAt),
      etapas,
    });
  }

  const jaTemPadrao = funisNovosDoEspaco.some((f) => f.padrao);
  const elegiveis = candidatos.filter((c) => c.estado === "ativo" && !c.privado);
  const escolhido = jaTemPadrao ? undefined : (elegiveis.find((c) => c.id === preferidoId) ?? elegiveis[0]);
  return { aInserir: candidatos.map((c) => ({ ...c, padrao: c.id === escolhido?.id })), naoMigrados };
}

/** Os Funis que PASSAM a existir no CRM novo e as Etapas (ids ANTIGOS) de cada um: o que o mapeador de Negócios consulta. */
export function etapasDosFunisAInserir(plano: PlanoDeFunis): Map<string, ReadonlySet<string>> {
  return new Map(plano.aInserir.map((funil) => [funil.id, new Set(funil.etapas.map((etapa) => etapa.idAntigo))]));
}

/** Os Funis do CRM antigo do Espaço, por SQL, na ordem em que estão em `registros`. */
export async function lerFunisAntigos(cliente: PoolClient, espaco: string): Promise<FunilAntigo[]> {
  const resultado = await cliente.query<{ dados: FunilAntigo }>(
    "select dados from plataforma.registros where workspace_id = $1 and colecao = 'funnels' order by ordem, id",
    [espaco],
  );
  return resultado.rows.map((linha) => linha.dados);
}

/** O Funil que o Espaço apontava como padrão no modelo antigo (`defaultFunnelId` da entidade `workspace`), se ainda estiver gravado. */
export async function lerFunilPreferido(cliente: PoolClient, espaco: string): Promise<string | undefined> {
  const resultado = await cliente.query<{ id: string | null }>(
    "select dados->>'defaultFunnelId' as id from plataforma.registros where workspace_id = $1 and colecao = 'workspace' limit 1",
    [espaco],
  );
  return resultado.rows[0]?.id ?? undefined;
}

/** Os Funis que o CRM novo já tem no Espaço. */
export async function lerFunisDoCrmNovo(cliente: PoolClient, espaco: string): Promise<FunilDoCrmNovo[]> {
  const resultado = await cliente.query<FunilDoCrmNovo>(
    "select id, nome, padrao, estado from plataforma.funis where workspace_id = $1 order by ordem, id",
    [espaco],
  );
  return resultado.rows;
}

/**
 * Quantas linhas de cada coleção (fora as nove do CRM antigo) citam o id do Funil: Automações, Agentes,
 * Painéis, concessões, a entidade do Espaço. Só o relatório usa; o que aponta para o Funil e não migra
 * fica apontando para um id que o CRM novo pode não ter.
 */
export async function contarReferenciasAoFunil(
  cliente: PoolClient,
  espaco: string,
  funilId: string,
): Promise<{ readonly colecao: string; readonly quantidade: number }[]> {
  const resultado = await cliente.query<{ colecao: string; n: string }>(
    `select r.colecao, count(*)::text as n
       from plataforma.registros r
      where r.workspace_id = $1 and r.colecao <> all($2::text[]) and strpos(r.dados::text, $3) > 0
      group by r.colecao
      order by r.colecao`,
    [espaco, [...COLECOES_DO_CRM_ANTIGO], JSON.stringify(funilId)],
  );
  return resultado.rows.map((linha) => ({ colecao: linha.colecao, quantidade: Number(linha.n) }));
}

/**
 * Insere os Funis e as Etapas do plano e o de-para, sob o MESMO `pg_advisory_xact_lock` do serviço de
 * Funis (duas criações simultâneas não decidem o padrão juntas). O padrão é reconferido sob a trava: se
 * outro Funil padrão apareceu depois do planejamento, este entra sem padrão.
 *
 * Um nome em uso que o planejamento não viu (corrida) estoura o índice único e a transação inteira
 * volta: não há `on conflict` genérico aqui para não engolir isso em silêncio.
 */
export async function inserirFunis(cliente: PoolClient, espaco: string, plano: PlanoDeFunis): Promise<{ readonly funis: number; readonly etapas: number }> {
  if (plano.aInserir.length === 0) return { funis: 0, etapas: 0 };
  await cliente.query("select pg_advisory_xact_lock(hashtext($1))", [`funil-padrao:${espaco}`]);
  let temPadrao = ((await cliente.query("select 1 from plataforma.funis where workspace_id = $1 and padrao limit 1", [espaco])).rowCount ?? 0) > 0;
  let funis = 0;
  let etapas = 0;

  for (const funil of plano.aInserir) {
    const padrao = funil.padrao && !temPadrao && funil.estado === "ativo" && !funil.privado;
    const inserido = await cliente.query(
      `insert into plataforma.funis
         (id, workspace_id, nome, descricao, cor, ordem, padrao, privado, exige_motivo_perda, exige_valor_ganho, estado, criado_por, criado_em)
       values ($1, $2, $3, $4, $5,
               (select coalesce(max(ordem), 0) + 1 from plataforma.funis where workspace_id = $2),
               $6, $7, $8, $9, $10, $11, coalesce($12::timestamptz, now()))
       on conflict (workspace_id, id) do nothing`,
      [funil.id, espaco, funil.nome, funil.descricao, funil.cor, padrao, funil.privado, funil.exigeMotivoPerda, funil.exigeValorGanho, funil.estado, funil.criadoPor, funil.criadoEm],
    );
    if ((inserido.rowCount ?? 0) === 0) continue;
    funis += 1;
    if (padrao) temPadrao = true;
    await cliente.query(
      `insert into plataforma.crm_de_para (workspace_id, colecao_antiga, id_antigo, tabela_nova, id_novo)
       values ($1, 'funnels', $2, 'funis', $2) on conflict do nothing`,
      [espaco, funil.id],
    );
    for (const etapa of funil.etapas) {
      const idNovo = randomUUID();
      await cliente.query(
        `insert into plataforma.etapas (id, workspace_id, funil_id, nome, ordem, probabilidade_padrao, cor, descricao)
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [idNovo, espaco, funil.id, etapa.nome, etapa.ordem, etapa.probabilidade, etapa.cor, etapa.descricao],
      );
      await cliente.query(
        `insert into plataforma.crm_de_para (workspace_id, colecao_antiga, id_antigo, tabela_nova, id_novo)
         values ($1, 'funnels/stages', $2, 'etapas', $3) on conflict do nothing`,
        [espaco, `${funil.id}/${etapa.idAntigo}`, idNovo],
      );
      etapas += 1;
    }
  }
  return { funis, etapas };
}
