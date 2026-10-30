/**
 * Quem mede: `medirGravacao` repete gestos de gravação por HTTP contra um
 * Fastify já no ar e lê as etapas da linha `"gravacao medida"` (12-01) no log
 * capturado (Fase 12, D-01/D-02/D-04/D-17).
 *
 * O comando (o `.cli.ts` ao lado) sobe o Fastify, o logger e o token e chama
 * esta função; o teste (`medir-gravacao.test.ts`) faz a mesma montagem contra
 * Postgres local. A conta (mediana, pior caso, texto) mora em
 * `./medicao-da-gravacao.ts`, pura.
 *
 * Regras que esta função cumpre (D-04, T-12-04):
 *   - grava num Espaço de teste PRÓPRIO, `ZZ-MEDICAO-<carimbo>`, dentro do Espaço
 *     de Trabalho informado, e toca só ids que ela mesma criou;
 *   - nunca apaga: só manda para a lixeira, num `finally`, o que criou;
 *   - uma recusa ou erro HTTP lança com o nome da operação, o status e a mensagem
 *     do domínio — nunca os `args` (título, nome, e-mail não saem em erro).
 */

import { pool } from "../persistencia/conexao";
import { hidratar } from "../persistencia/repositorio";
import {
  type AmostraDoGesto,
  lerLinhaDeMedicao,
  resumirGesto,
  serieDeTempos,
  type RelatorioDaMedicao,
  type ResumoDoGesto,
  type SerieDeTempos,
  type TamanhoDoEspaco,
} from "./medicao-da-gravacao";

/** O que marca, por nome, tudo que o comando cria — é o que o dono procura na lixeira. */
export const PREFIXO_DE_TESTE = "ZZ-MEDICAO";

export interface OpcoesDaMedicao {
  /** `http://127.0.0.1:<porta>` do Fastify já escutando. */
  readonly baseUrl: string;
  /** O token que o `verificarToken` do Fastify aceita para o Membro que assina as gravações. */
  readonly token: string;
  readonly workspaceId: string;
  readonly repeticoes: number;
  /** As linhas de log escritas até agora (o array do `destino` do logger); relido a cada pedido. */
  readonly linhasDoLog: () => readonly string[];
  readonly revisaoDoCodigo: string;
}

interface RespostaDeOperacao {
  readonly ok?: boolean;
  readonly error?: string;
  readonly value?: unknown;
}

/** O que `createSpace` devolve em `value` que o comando usa. */
interface EspacoCriado {
  readonly id: string;
  readonly statusSet?: { readonly definitions?: readonly { readonly id: string; readonly category: string }[] };
}

function carimbo(): string {
  return new Date().toISOString().replace(/[:.]/g, "");
}

class Medidor {
  /** Os Espaços de teste criados e se estão na lixeira agora. */
  private readonly espacos = new Map<string, { naLixeira: boolean }>();

  constructor(private readonly opcoes: OpcoesDaMedicao) {}

  /** Um POST /operacoes/:nome. Exige 200 com `ok: true`; devolve o `value` e o tempo do pedido. */
  private async chamar(nome: string, args: readonly unknown[]): Promise<{ readonly value: unknown; readonly pedidoMs: number; readonly novas: readonly string[] }> {
    const antes = this.opcoes.linhasDoLog().length;
    const inicio = performance.now();
    const resposta = await fetch(`${this.opcoes.baseUrl}/operacoes/${nome}`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.opcoes.token}` },
      body: JSON.stringify({ args }),
    });
    const texto = await resposta.text();
    const pedidoMs = performance.now() - inicio;
    let corpo: RespostaDeOperacao = {};
    try {
      corpo = JSON.parse(texto) as RespostaDeOperacao;
    } catch {
      // corpo que não é JSON: o erro abaixo cita só o status
    }
    if (resposta.status !== 200 || corpo.ok !== true) {
      const motivo = typeof corpo.error === "string" ? corpo.error : "sem mensagem";
      throw new Error(`${nome}: HTTP ${resposta.status}: ${motivo}`);
    }
    return { value: corpo.value, pedidoMs, novas: this.opcoes.linhasDoLog().slice(antes) };
  }

  /** Um gesto medido: a chamada mais a linha de medição que ela deixou no log. */
  private async gravarMedindo(nome: string, args: readonly unknown[]): Promise<AmostraDoGesto & { readonly value: unknown }> {
    const { value, pedidoMs, novas } = await this.chamar(nome, args);
    for (let i = novas.length - 1; i >= 0; i -= 1) {
      const linha = lerLinhaDeMedicao(novas[i] ?? "");
      if (linha && linha.operacao === nome) return { medicao: linha.medicao, pedidoMs, value };
    }
    throw new Error(`${nome}: o log não trouxe a linha "gravacao medida" desta chamada.`);
  }

  /** Uma gravação fora da medição (preparação e restauração). */
  private async gravar(nome: string, args: readonly unknown[]): Promise<unknown> {
    return (await this.chamar(nome, args)).value;
  }

  async criarEspacoDeTeste(sufixo = ""): Promise<EspacoCriado> {
    const nome = `${PREFIXO_DE_TESTE}-${carimbo()}${sufixo}`;
    const espaco = (await this.gravar("createSpace", [{ name: nome }])) as EspacoCriado | undefined;
    if (!espaco || typeof espaco.id !== "string") throw new Error("createSpace: a resposta não trouxe o id do Espaço de teste.");
    this.espacos.set(espaco.id, { naLixeira: false });
    return espaco;
  }

  /** Num `finally`: manda para a lixeira todo Espaço de teste que não esteja nela. Nunca esconde o erro original. */
  async limpar(): Promise<void> {
    for (const [id, estado] of this.espacos) {
      if (estado.naLixeira) continue;
      try {
        await this.gravar("trashContainer", ["space", id]);
        estado.naLixeira = true;
      } catch (erro) {
        console.error(`não consegui enviar à lixeira o Espaço de teste ${id}: ${erro instanceof Error ? erro.message : String(erro)}`);
      }
    }
  }

  /** "Criar Lista": `createList` ×`repeticoes` no Espaço de teste. Devolve o resumo e os ids das Listas criadas. */
  async criarListas(espacoId: string): Promise<{ readonly resumo: ResumoDoGesto; readonly listaIds: readonly string[] }> {
    const amostras: AmostraDoGesto[] = [];
    const listaIds: string[] = [];
    for (let i = 0; i < this.opcoes.repeticoes; i += 1) {
      const { medicao, pedidoMs, value } = await this.gravarMedindo("createList", [
        { name: `${PREFIXO_DE_TESTE}-lista-${i}`, parentType: "space", parentId: espacoId },
      ]);
      amostras.push({ medicao, pedidoMs });
      listaIds.push(idDe(value, "createList"));
    }
    return { resumo: resumirGesto("criar Lista", "createList", amostras), listaIds };
  }

  /** "Renomear Lista": `updateContainer("list", <Lista de teste>, { name })` ×`repeticoes`. */
  async renomearLista(listaId: string): Promise<ResumoDoGesto> {
    const amostras: AmostraDoGesto[] = [];
    for (let i = 0; i < this.opcoes.repeticoes; i += 1) {
      const { medicao, pedidoMs } = await this.gravarMedindo("updateContainer", [
        "list",
        listaId,
        { name: `${PREFIXO_DE_TESTE}-renomeada-${i}` },
      ]);
      amostras.push({ medicao, pedidoMs });
    }
    return resumirGesto("renomear Lista", "updateContainer", amostras);
  }

  /**
   * "Enviar à lixeira um Espaço com Listas": um Espaço de teste próprio com duas
   * Listas vai à lixeira (medido) e volta por `restoreContainer` (fora da
   * medição) a cada repetição. Se o domínio recusar o `restoreContainer`, cada
   * repetição passa a criar um Espaço novo com duas Listas, também fora da
   * medição; a escolha vai para as observações do relatório.
   */
  async enviarEspacoALixeira(observacoes: string[]): Promise<ResumoDoGesto> {
    const criarComDuasListas = async (): Promise<string> => {
      const espaco = await this.criarEspacoDeTeste("-lixeira");
      for (const n of [1, 2]) {
        await this.gravar("createList", [{ name: `${PREFIXO_DE_TESTE}-lixeira-${n}`, parentType: "space", parentId: espaco.id }]);
      }
      return espaco.id;
    };
    let espacoId = await criarComDuasListas();
    let caminho: "restaurar" | "espaco-novo" = "restaurar";
    const amostras: AmostraDoGesto[] = [];
    for (let i = 0; i < this.opcoes.repeticoes; i += 1) {
      if (i > 0) {
        if (caminho === "restaurar") {
          try {
            await this.gravar("restoreContainer", ["space", espacoId]);
            this.espacos.set(espacoId, { naLixeira: false });
          } catch {
            caminho = "espaco-novo";
          }
        }
        if (caminho === "espaco-novo") espacoId = await criarComDuasListas();
      }
      const { medicao, pedidoMs } = await this.gravarMedindo("trashContainer", ["space", espacoId]);
      this.espacos.set(espacoId, { naLixeira: true });
      amostras.push({ medicao, pedidoMs });
    }
    observacoes.push(
      caminho === "restaurar"
        ? "Espaço com Listas à lixeira: o mesmo Espaço de teste, restaurado fora da medição a cada repetição."
        : "Espaço com Listas à lixeira: o domínio recusou restoreContainer; cada repetição usou um Espaço novo com duas Listas, criado fora da medição.",
    );
    return resumirGesto("Espaço com Listas à lixeira", "trashContainer", amostras);
  }

  /** "Mudar Status": uma Tarefa de teste muda entre dois Status do Conjunto da Lista, ×`repeticoes`. */
  async mudarStatus(listaId: string, espaco: EspacoCriado): Promise<ResumoDoGesto> {
    const tarefa = (await this.gravar("createTask", [{ listId: listaId, title: `${PREFIXO_DE_TESTE}-tarefa` }])) as
      | { readonly id?: unknown; readonly statusId?: unknown }
      | undefined;
    const tarefaId = idDe(tarefa, "createTask");
    const definicoes = espaco.statusSet?.definitions ?? [];
    const inicial = typeof tarefa?.statusId === "string" ? tarefa.statusId : undefined;
    const outros = definicoes.filter((d) => d.id !== inicial);
    const alvoB = (outros.find((d) => d.category === "emAndamento") ?? outros[0])?.id;
    if (!inicial || !alvoB) throw new Error("changeTaskStatus: o Conjunto de Status do Espaço de teste não tem dois Status para alternar.");
    const amostras: AmostraDoGesto[] = [];
    for (let i = 0; i < this.opcoes.repeticoes; i += 1) {
      const { medicao, pedidoMs } = await this.gravarMedindo("changeTaskStatus", [tarefaId, i % 2 === 0 ? alvoB : inicial]);
      amostras.push({ medicao, pedidoMs });
    }
    return resumirGesto("mudar Status", "changeTaskStatus", amostras);
  }

  /** `GET /estado` pelo mesmo `baseUrl`, só o total (D-12). */
  async pedirEstado(): Promise<number> {
    const inicio = performance.now();
    const resposta = await fetch(`${this.opcoes.baseUrl}/estado`, { headers: { authorization: `Bearer ${this.opcoes.token}` } });
    await resposta.arrayBuffer();
    const duracao = performance.now() - inicio;
    if (resposta.status !== 200) throw new Error(`GET /estado: HTTP ${resposta.status}`);
    return duracao;
  }

  async rodar(): Promise<RelatorioDaMedicao> {
    const n = this.opcoes.repeticoes;
    const { workspaceId } = this.opcoes;
    const observacoes: string[] = [];
    const gestos: ResumoDoGesto[] = [];

    // Aquecimento fora da medição: pool e JIT quentes, igual no "antes" e no "depois".
    await this.pedirEstado();
    await medirIdaEVolta(1);

    const idaEVolta = serieDeTempos(await medirIdaEVolta(n));
    const tamanho = await medirTamanho(workspaceId);
    const direto = await medirHidratarDireto(workspaceId, n);
    const estadoMs: number[] = [];
    for (let i = 0; i < n; i += 1) estadoMs.push(await this.pedirEstado());

    try {
      const espaco = await this.criarEspacoDeTeste();
      const criadas = await this.criarListas(espaco.id);
      gestos.push(criadas.resumo);
      const listaDeTeste = criadas.listaIds[0];
      if (!listaDeTeste) throw new Error("createList: nenhuma Lista de teste foi criada.");
      gestos.push(await this.renomearLista(listaDeTeste));
      gestos.push(await this.enviarEspacoALixeira(observacoes));
      gestos.push(await this.mudarStatus(listaDeTeste, espaco));
    } finally {
      await this.limpar();
    }

    return {
      quando: new Date().toISOString(),
      revisaoDoCodigo: this.opcoes.revisaoDoCodigo,
      workspaceId,
      repeticoes: n,
      idaEVolta,
      hidratarDireto: { ...serieDeTempos(direto.duracoes), registros: direto.registros },
      estado: serieDeTempos(estadoMs),
      tamanho,
      gestos,
      observacoes,
    };
  }
}

function idDe(valor: unknown, operacao: string): string {
  const id = (valor as { readonly id?: unknown } | undefined)?.id;
  if (typeof id !== "string") throw new Error(`${operacao}: a resposta não trouxe o id do registro criado.`);
  return id;
}

/** `select 1` cronometrado numa conexão do `pool()` (molde de `medirLatenciaLocal` em `metricas.ts`): a ida e volta de referência VPS↔banco. */
export async function medirIdaEVolta(n: number): Promise<number[]> {
  const cliente = await pool().connect();
  try {
    const duracoes: number[] = [];
    for (let i = 0; i < n; i += 1) {
      const inicio = performance.now();
      await cliente.query("select 1");
      duracoes.push(performance.now() - inicio);
    }
    return duracoes;
  } finally {
    cliente.release();
  }
}

/**
 * D-05 (2.2.1 item 4), só leitura: quantos registros, o tamanho como o Postgres
 * guarda (`pg_column_size`) e os bytes do texto do JSON (`length(dados::text)`),
 * por coleção. Os dois números existem porque o TOAST comprime acima de ~2 KB e
 * o que viaja na rede é o texto (Pitfall 11). Se o banco recusar a consulta
 * (permissão), o relatório pede para rodar à mão e o comando continua.
 */
export async function medirTamanho(workspaceId: string): Promise<TamanhoDoEspaco> {
  const cliente = await pool().connect();
  try {
    await cliente.query("begin transaction read only");
    try {
      const resultado = await cliente.query<{ colecao: string; registros: number; comprimido: string; texto: string }>(
        `select colecao,
                count(*)::int as registros,
                sum(pg_column_size(dados))::bigint as comprimido,
                sum(length(dados::text))::bigint as texto
           from plataforma.registros
          where workspace_id = $1
          group by colecao
          order by sum(pg_column_size(dados)) desc`,
        [workspaceId],
      );
      const porColecao = resultado.rows.map((r) => ({
        colecao: r.colecao,
        registros: r.registros,
        comprimido: Number(r.comprimido),
        texto: Number(r.texto),
      }));
      const total = porColecao.reduce(
        (soma, c) => ({ registros: soma.registros + c.registros, comprimido: soma.comprimido + c.comprimido, texto: soma.texto + c.texto }),
        { registros: 0, comprimido: 0, texto: 0 },
      );
      return { porColecao, total };
    } finally {
      await cliente.query("rollback");
    }
  } catch (erro) {
    if ((erro as { readonly code?: unknown }).code === "42501") {
      return { porColecao: [], total: { registros: 0, comprimido: 0, texto: 0 }, recusada: true };
    }
    throw erro;
  } finally {
    cliente.release();
  }
}

/** `hidratar` direto, fora de transação de escrita: `begin transaction read only`, a leitura cronometrada e `rollback`. */
export async function medirHidratarDireto(workspaceId: string, n: number): Promise<{ readonly duracoes: number[]; readonly registros: number }> {
  const cliente = await pool().connect();
  try {
    const duracoes: number[] = [];
    let registros = 0;
    for (let i = 0; i < n; i += 1) {
      await cliente.query("begin transaction read only");
      try {
        const inicio = performance.now();
        const estado = await hidratar(cliente, workspaceId);
        duracoes.push(performance.now() - inicio);
        registros = [...estado.original.values()].reduce((soma, daColecao) => soma + daColecao.size, 0);
      } finally {
        await cliente.query("rollback");
      }
    }
    return { duracoes, registros };
  } finally {
    cliente.release();
  }
}

export async function medirGravacao(opcoes: OpcoesDaMedicao): Promise<RelatorioDaMedicao> {
  return new Medidor(opcoes).rodar();
}
