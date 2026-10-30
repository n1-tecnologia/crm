/**
 * Quem mede: `medirGravacao` repete gestos de gravação por HTTP contra um
 * Fastify já no ar e lê as etapas da linha `"gravacao medida"` (12-01) no log
 * capturado (Fase 12, D-01/D-02/D-04/D-17).
 *
 * O comando (`medir-gravacao.cli.ts`) sobe o Fastify, o logger e o token e chama
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

import { type AmostraDoGesto, lerLinhaDeMedicao, resumirGesto, serieVazia, type RelatorioDaMedicao, type ResumoDoGesto } from "./medicao-da-gravacao";

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

  async criarListas(espacoId: string): Promise<ResumoDoGesto> {
    const amostras: AmostraDoGesto[] = [];
    for (let i = 0; i < this.opcoes.repeticoes; i += 1) {
      const { medicao, pedidoMs } = await this.gravarMedindo("createList", [
        { name: `${PREFIXO_DE_TESTE}-lista-${i}`, parentType: "space", parentId: espacoId },
      ]);
      amostras.push({ medicao, pedidoMs });
    }
    return resumirGesto("criar Lista", "createList", amostras);
  }

  async rodar(): Promise<RelatorioDaMedicao> {
    const gestos: ResumoDoGesto[] = [];
    try {
      const espaco = await this.criarEspacoDeTeste();
      gestos.push(await this.criarListas(espaco.id));
    } finally {
      await this.limpar();
    }
    return {
      quando: new Date().toISOString(),
      revisaoDoCodigo: this.opcoes.revisaoDoCodigo,
      workspaceId: this.opcoes.workspaceId,
      repeticoes: this.opcoes.repeticoes,
      idaEVolta: serieVazia(),
      hidratarDireto: { ...serieVazia(), registros: 0 },
      estado: serieVazia(),
      tamanho: { porColecao: [], total: { registros: 0, comprimido: 0, texto: 0 } },
      gestos,
    };
  }
}

export async function medirGravacao(opcoes: OpcoesDaMedicao): Promise<RelatorioDaMedicao> {
  return new Medidor(opcoes).rodar();
}
