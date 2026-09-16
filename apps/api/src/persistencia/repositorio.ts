/**
 * A tradução entre o banco e o `DataState` que o domínio conhece.
 *
 * O domínio é uma função pura sobre o estado inteiro do Espaço de Trabalho:
 * `operacao(state, quem, entrada)` lê o grafo todo e muta o que precisa. Para
 * isso continuar verdadeiro com banco, o caminho é hidratar o estado, rodar a
 * operação sem alterá-la, e gravar só o que mudou.
 *
 * O que torna isso viável é a escala real: o Espaço de Trabalho inteiro são
 * cerca de 900 registros e 475 KB. Hidratar é uma consulta; comparar é passar
 * por 900 strings. Se um dia um Espaço de Trabalho crescer a ponto de isso
 * doer, a saída é carregar um recorte (a Lista e o que ela referencia) — o
 * formato do `DataState` não muda, só o `where` da consulta.
 */

import type { PoolClient } from "pg";
import type { DataState, Diferenca, Ordens, RegistroGravado, RegistroRemovido } from "@n1/dominio";
import { COLECOES, SINGULARES as SINGULARES_DO_DOMINIO } from "@n1/dominio";

/** Chaves de `DataState` que não são coleção: entidade única do Espaço. */
const SINGULARES = new Set<string>(SINGULARES_DO_DOMINIO);

/**
 * Serialização canônica: as chaves de cada objeto em ordem alfabética.
 *
 * `JSON.stringify` preserva a ordem de inserção e o `jsonb` do Postgres
 * reordena por conta própria — `{"zz":1,"a":2}` volta como `{"a":2,"zz":1}`.
 * Comparar as duas formas textualmente acusaria mudança em todo registro lido,
 * e a gravação por diferença gravaria o Espaço de Trabalho inteiro a cada
 * operação. Pôr os dois lados na mesma forma é o que faz a comparação medir
 * conteúdo, e não a ordem em que as chaves foram escritas.
 *
 * Chave com valor `undefined` é omitida, como `JSON.stringify` faz e como o
 * banco devolve — assim um campo ausente e um campo indefinido comparam igual.
 */
export function canonico(valor: unknown): string {
  if (valor === null || typeof valor !== "object") return JSON.stringify(valor) ?? "null";
  if (Array.isArray(valor)) return `[${valor.map(canonico).join(",")}]`;
  const partes: string[] = [];
  for (const chave of Object.keys(valor as object).sort()) {
    const v = (valor as Record<string, unknown>)[chave];
    if (v === undefined) continue;
    partes.push(`${JSON.stringify(chave)}:${canonico(v)}`);
  }
  return `{${partes.join(",")}}`;
}

/** O JSON de cada registro como veio do banco: coleção > id > json. */
type Original = Map<string, Map<string, string>>;
/** A posição de cada registro como veio do banco: coleção > id > ordem. */
type Ordem = Map<string, Map<string, number>>;

/** O menor passo entre duas posições antes de a precisão do double acabar. */
const PRECISAO_MINIMA = 1e-9;

export interface EstadoHidratado {
  readonly state: DataState;
  readonly revisao: number;
  readonly original: Original;
  readonly ordem: Ordem;
}

export async function hidratar(cliente: PoolClient, workspaceId: string): Promise<EstadoHidratado> {
  // Uma ida e volta só. A revisão vem repetida em cada linha — são 8 bytes
  // por registro contra uma latência de rede inteira; e o LEFT JOIN garante
  // que um Espaço de Trabalho vazio ainda devolva a sua revisão.
  const linhas = await cliente.query<{ colecao: string | null; id: string | null; dados: unknown; ordem: number | null; revisao: string }>(
    `select r.colecao, r.id, r.dados, r.ordem, w.revisao
       from plataforma.workspaces w
       left join plataforma.registros r on r.workspace_id = w.workspace_id
      where w.workspace_id = $1
      order by r.colecao, r.ordem`,
    [workspaceId],
  );
  if (linhas.rowCount === 0) throw new Error(`Espaço de Trabalho "${workspaceId}" não existe.`);
  const revisao = Number(linhas.rows[0]!.revisao);

  // Toda coleção nasce vazia: uma sem registros não deixa linha no banco, e
  // `state.files` valendo `undefined` em vez de `[]` quebraria o domínio na
  // primeira escrita.
  const state = Object.fromEntries(COLECOES.map((c) => [c, [] as unknown[]])) as Record<string, unknown>;
  const original: Original = new Map();
  const ordem: Ordem = new Map();
  for (const linha of linhas.rows) {
    if (linha.colecao === null || linha.id === null) continue; // Espaço vazio: só a revisão veio.
    let daColecao = original.get(linha.colecao);
    if (!daColecao) original.set(linha.colecao, (daColecao = new Map()));
    daColecao.set(linha.id, canonico(linha.dados));
    let ordemDaColecao = ordem.get(linha.colecao);
    if (!ordemDaColecao) ordem.set(linha.colecao, (ordemDaColecao = new Map()));
    ordemDaColecao.set(linha.id, linha.ordem!);

    if (SINGULARES.has(linha.colecao)) {
      state[linha.colecao] = linha.dados;
    } else {
      const lista = (state[linha.colecao] ??= [] as unknown[]) as unknown[];
      lista.push(linha.dados);
    }
  }
  return { state: state as unknown as DataState, revisao, original, ordem };
}

/**
 * Atribui uma posição a cada id preservando a ordem do array, mexendo no menor
 * número possível de registros.
 *
 * Quem já tem posição coerente com quem veio antes fica onde está; só quem
 * entrou ou saiu do lugar recebe valor novo, escolhido entre o vizinho de trás
 * e o primeiro valor livre à frente. É o que faz um `unshift` no log de
 * atividade custar uma linha em vez da coleção inteira.
 */
export function reordenar(ids: readonly string[], antigas: Map<string, number> | undefined): number[] {
  const resultado: number[] = new Array(ids.length);
  let anterior = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < ids.length; i += 1) {
    const atual = antigas?.get(ids[i]!);
    if (atual !== undefined && atual > anterior) {
      resultado[i] = atual;
      anterior = atual;
      continue;
    }
    // Procura o próximo valor existente que ainda sirva como teto.
    let teto: number | undefined;
    for (let j = i + 1; j < ids.length; j += 1) {
      const candidato = antigas?.get(ids[j]!);
      if (candidato !== undefined && candidato > anterior) { teto = candidato; break; }
    }
    let novo: number;
    if (teto === undefined) {
      novo = anterior === Number.NEGATIVE_INFINITY ? 0 : anterior + 1;
    } else if (anterior === Number.NEGATIVE_INFINITY) {
      novo = teto - 1;
    } else {
      novo = (anterior + teto) / 2;
      // Se a fração deixou de caber no double, renumera daqui para a frente
      // com inteiros — raro, e melhor que duas posições colidirem.
      if (novo - anterior < PRECISAO_MINIMA || teto - novo < PRECISAO_MINIMA) novo = anterior + 1;
    }
    resultado[i] = novo;
    anterior = novo;
  }
  return resultado;
}

/** `hidratar()` devolve `ordem` como `Map` (chave interna); `GET /estado` (D-04) precisa de um objeto simples que viaje em JSON. */
export function ordensComoObjeto(ordem: EstadoHidratado["ordem"]): Ordens {
  const resultado: Record<string, Record<string, number>> = {};
  for (const [colecao, porId] of ordem) {
    resultado[colecao] = Object.fromEntries(porId);
  }
  return resultado;
}

/**
 * Grava o que mudou entre o estado hidratado e o estado depois da operação.
 *
 * A comparação é por JSON e não por identidade de objeto porque as operações
 * mutam em lugar: o objeto que saiu do banco é o mesmo que a operação alterou,
 * então comparar referências não acusaria nada.
 */
export async function gravar(
  cliente: PoolClient,
  workspaceId: string,
  depois: DataState,
  antes: EstadoHidratado,
): Promise<Diferenca> {
  const vistos: Original = new Map();
  // Guarda também o próprio registro (não só o `json` canônico): `dados` na
  // resposta HTTP (D-03) é o objeto que a operação produziu, não uma
  // re-serialização — o Fastify já omite `undefined` como `canonico()` faz.
  const registrosPorChave = new Map<string, unknown>();
  const upserts: Array<[string, string, string, number]> = [];

  for (const [colecao, valor] of Object.entries(depois as unknown as Record<string, unknown>)) {
    const registros = SINGULARES.has(colecao) ? [valor] : Array.isArray(valor) ? valor : [];
    if (registros.length === 0) continue;
    let daColecao = vistos.get(colecao);
    if (!daColecao) vistos.set(colecao, (daColecao = new Map()));
    const originais = antes.original.get(colecao);
    const ordensAntigas = antes.ordem.get(colecao);
    const ids: string[] = [];
    for (const registro of registros) {
      if (registro === undefined || registro === null) continue;
      const id = (registro as { id?: string }).id;
      if (id === undefined) throw new Error(`Registro sem id em "${colecao}".`);
      daColecao.set(id, canonico(registro));
      registrosPorChave.set(`${colecao} ${id}`, registro);
      ids.push(id);
    }
    const ordens = reordenar(ids, ordensAntigas);
    ids.forEach((id, i) => {
      const json = daColecao.get(id)!;
      const ordem = ordens[i]!;
      if (originais?.get(id) !== json || ordensAntigas?.get(id) !== ordem) {
        upserts.push([colecao, id, json, ordem]);
      }
    });
  }

  const removidos: Array<[string, string]> = [];
  for (const [colecao, originais] of antes.original) {
    const agora = vistos.get(colecao);
    for (const id of originais.keys()) {
      if (!agora?.has(id)) removidos.push([colecao, id]);
    }
  }

  if (upserts.length > 0) {
    // Um INSERT só com todas as linhas: 900 round-trips seria o custo dominante.
    await cliente.query(
      `insert into plataforma.registros (workspace_id, colecao, id, dados, ordem, revisao, atualizado_em)
       select $1, c, i, d::jsonb, o, 1, now()
         from unnest($2::text[], $3::text[], $4::text[], $5::double precision[]) as t(c, i, d, o)
       on conflict (workspace_id, colecao, id) do update
         set dados = excluded.dados,
             ordem = excluded.ordem,
             revisao = plataforma.registros.revisao + 1,
             atualizado_em = now()`,
      [workspaceId, upserts.map((u) => u[0]), upserts.map((u) => u[1]), upserts.map((u) => u[2]), upserts.map((u) => u[3])],
    );
  }
  if (removidos.length > 0) {
    await cliente.query(
      `delete from plataforma.registros
        where workspace_id = $1
          and (colecao, id) in (select c, i from unnest($2::text[], $3::text[]) as t(c, i))`,
      [workspaceId, removidos.map((r) => r[0]), removidos.map((r) => r[1])],
    );
  }

  const gravados: RegistroGravado[] = upserts.map(([colecao, id, , ordem]) => ({
    colecao,
    id,
    dados: registrosPorChave.get(`${colecao} ${id}`),
    ordem,
  }));
  const removidosDetalhados: RegistroRemovido[] = removidos.map(([colecao, id]) => ({ colecao, id }));

  return { gravados, removidos: removidosDetalhados };
}

/** Escreve um `DataState` inteiro num Espaço de Trabalho vazio (bootstrap, importação). */
export async function semear(cliente: PoolClient, workspaceId: string, state: DataState): Promise<number> {
  await cliente.query(
    "insert into plataforma.workspaces (workspace_id) values ($1) on conflict do nothing",
    [workspaceId],
  );
  const vazio: EstadoHidratado = { state: {} as DataState, revisao: 1, original: new Map(), ordem: new Map() };
  const { gravados } = await gravar(cliente, workspaceId, state, vazio);
  return gravados.length;
}
