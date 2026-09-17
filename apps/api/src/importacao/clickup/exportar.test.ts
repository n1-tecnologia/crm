/**
 * `exportar.ts` — testes puros/sem rede desta Wave. Task 1 prova os
 * utilitários que sustentam retomada, segurança de caminho e a coleta de
 * anexos/usuários vistos: `sanitizarNomeDeArquivo`, `caminhoDoAnexo`,
 * `gravarAtomico`, `lerSeValido`, `coletarAnexos`, `coletarUsuarios`.
 *
 * Fixtures de detalhe de Tarefa e de Comentários no formato de
 * `developer.clickup.com/reference/gettask` e `.../gettaskcomments` — ids
 * fictícios (`"9hz"`, `"abc"`), usuário `"John Doe"` / `john@example.com`,
 * nunca dado real (D-02, LGPD).
 */

import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { ErroClickUp, type ClienteClickUp } from "./cliente";
import {
  caminhoDoAnexo,
  coletarAnexos,
  coletarUsuarios,
  exportarClickUp,
  gravarAtomico,
  lerSeValido,
  sanitizarNomeDeArquivo,
  TAMANHO_MAXIMO_DE_ANEXO,
  type UsuarioVisto,
} from "./exportar";

const USUARIO_JOHN = { id: 183, username: "John Doe", email: "john@example.com" };
const USUARIO_JANE = { id: 999, username: "Jane Watcher", email: "jane@example.com" };

/** Formato de developer.clickup.com/reference/gettask (campos relevantes só). */
const detalheDaTarefaFixture = {
  id: "9hz",
  name: "Tarefa de exemplo",
  creator: USUARIO_JOHN,
  assignees: [USUARIO_JOHN],
  watchers: [USUARIO_JANE],
  attachments: [
    {
      id: "abc",
      version: 0,
      date: "1568044355774",
      title: "nota-fulano-123.456.789-00.pdf",
      extension: "pdf",
      size: 1234,
      url: "https://t123.clickup-attachments.com/abc/nota-fulano-123.456.789-00.pdf",
    },
  ],
};

/** Formato de developer.clickup.com/reference/gettaskcomments (campos relevantes só). */
const paginaDeComentariosFixture = {
  comments: [
    {
      id: "cmt1",
      comment_text: "Aprovado!",
      comment: [
        { text: "Aprovado! " },
        {
          text: "",
          attachment: {
            id: "att-9",
            url: "https://t1.clickup-attachments.com/att-9/comprovante.png",
            title: "comprovante.png",
            size: 500,
          },
        },
      ],
      user: USUARIO_JOHN,
      date: "1568044355800",
    },
  ],
};

let pastaTemporaria: string | undefined;

afterEach(async () => {
  if (pastaTemporaria !== undefined) {
    await rm(pastaTemporaria, { recursive: true, force: true });
    pastaTemporaria = undefined;
  }
});

describe("exportar — utilitários: caminho, retomada, coleta", () => {
  it("(a) sanitizarNomeDeArquivo remove path traversal, preserva o charset permitido e nunca fica vazio", () => {
    const traversal = sanitizarNomeDeArquivo("../../etc/passwd");
    expect(traversal).not.toContain("/");
    expect(traversal).not.toContain("\\");
    expect(traversal).not.toContain("..");

    const nomeComEspacosEParenteses = sanitizarNomeDeArquivo("NFS-e 21_03 (final).pdf");
    expect(nomeComEspacosEParenteses).toMatch(/^[A-Za-z0-9._-]+$/);
    expect(nomeComEspacosEParenteses).toContain("NFS-e");
    expect(nomeComEspacosEParenteses).toContain(".pdf");

    expect(sanitizarNomeDeArquivo("")).toBe("anexo");

    const entradaLonga = "a".repeat(500);
    expect(sanitizarNomeDeArquivo(entradaLonga).length).toBeLessThanOrEqual(120);
  });

  it("(b) caminhoDoAnexo resolve dentro de <base>/attachments/<taskId>/ e lança para id hostil", () => {
    const base = "/tmp/exportacoes-fixture/901109104938";
    const caminho = caminhoDoAnexo(base, "9hz", "att1", "..\\..\\x.pdf");
    const pastaEsperada = path.resolve(base, "attachments", "9hz");
    expect(caminho.startsWith(pastaEsperada + path.sep)).toBe(true);
    expect(path.basename(caminho).startsWith("att1-")).toBe(true);

    expect(() => caminhoDoAnexo(base, "../fora", "att1", "x.pdf")).toThrow();
    expect(() => caminhoDoAnexo(base, "9hz", "../fora", "x.pdf")).toThrow();
    expect(() => caminhoDoAnexo(base, "9hz/outro", "att1", "x.pdf")).toThrow();
  });

  it("(c) gravarAtomico grava o texto exato sem deixar .tmp para trás; lerSeValido distingue ausente/vazio/inválido/válido", async () => {
    pastaTemporaria = await mkdtemp(path.join(tmpdir(), "exportar-clickup-"));
    const caminho = path.join(pastaTemporaria, "lista", "list.json");

    await gravarAtomico(caminho, '{"ok":true}');

    const conteudo = await readFile(caminho, "utf8");
    expect(conteudo).toBe('{"ok":true}');

    const arquivosNaPasta = await readdir(path.dirname(caminho));
    expect(arquivosNaPasta.some((nome) => nome.endsWith(".tmp"))).toBe(false);
    await expect(stat(`${caminho}.tmp`)).rejects.toThrow();

    expect(await lerSeValido(path.join(pastaTemporaria, "nao-existe.json"))).toBeUndefined();

    const caminhoVazio = path.join(pastaTemporaria, "vazio.json");
    await gravarAtomico(caminhoVazio, "");
    expect(await lerSeValido(caminhoVazio)).toBeUndefined();

    const caminhoInvalido = path.join(pastaTemporaria, "invalido.json");
    await gravarAtomico(caminhoInvalido, "{");
    expect(await lerSeValido(caminhoInvalido)).toBeUndefined();

    expect(await lerSeValido(caminho)).toBe('{"ok":true}');
  });

  it("(d) coletarAnexos lê attachments[] do detalhe e os attachment[] dentro de comment[], deduplica por id, ignora sem url", () => {
    const anexos = coletarAnexos("9hz", detalheDaTarefaFixture, [paginaDeComentariosFixture]);

    expect(anexos).toHaveLength(2);
    const doDetalhe = anexos.find((a) => a.id === "abc");
    expect(doDetalhe).toMatchObject({ origem: "tarefa", taskId: "9hz", titulo: "nota-fulano-123.456.789-00.pdf" });

    const doComentario = anexos.find((a) => a.id === "att-9");
    expect(doComentario).toMatchObject({ origem: "comentario", taskId: "9hz", titulo: "comprovante.png" });

    // dedupe: chamar de novo com a mesma fixture não duplica por id
    const anexosDeNovo = coletarAnexos("9hz", detalheDaTarefaFixture, [
      paginaDeComentariosFixture,
      paginaDeComentariosFixture,
    ]);
    expect(anexosDeNovo).toHaveLength(2);

    // sem url é ignorado
    const semUrl = coletarAnexos("9hz", { attachments: [{ id: "x", title: "y" }] }, []);
    expect(semUrl).toHaveLength(0);
  });

  it("(e) coletarUsuarios acumula creator/assignees/watchers/autor de comentário; ocorrências somam; papéis não repetem", () => {
    const acumulador = new Map<string, UsuarioVisto>();

    coletarUsuarios(acumulador, detalheDaTarefaFixture, [paginaDeComentariosFixture]);

    const john = acumulador.get("183");
    expect(john).toBeDefined();
    expect(john?.nome).toBe("John Doe");
    // creator (1) + assignee (1) + comment-author (1) = 3 ocorrências
    expect(john?.ocorrencias).toBe(3);
    expect(john?.papeis).toEqual(expect.arrayContaining(["creator", "assignee", "comment-author"]));
    expect(new Set(john?.papeis).size).toBe(john?.papeis.length);

    const jane = acumulador.get("999");
    expect(jane).toBeDefined();
    expect(jane?.papeis).toContain("watcher");

    // chamar de novo com o MESMO detalhe dobra ocorrências (contagem de ocorrências, não de Tarefas)
    coletarUsuarios(acumulador, detalheDaTarefaFixture, [paginaDeComentariosFixture]);
    expect(acumulador.get("183")?.ocorrencias).toBe(6);
    expect(new Set(acumulador.get("183")?.papeis).size).toBe(acumulador.get("183")?.papeis.length);
  });
});

/**
 * `exportarClickUp` — orquestração contra um cliente falso (sem rede). O
 * cliente falso guarda um `token` interno só para o teste (g) provar que
 * ele nunca aparece em `log`/`avisos` — `exportar.ts` nunca recebe o token
 * de verdade, só a abstração `ClienteClickUp` (D-01).
 */

const TOKEN_DO_CLIENTE_FALSO = "pk_teste_nunca_real";

const USUARIO_CENARIO_1 = { id: 501, username: "Fulano", email: "fulano@example.com" };
const USUARIO_CENARIO_2 = { id: 502, username: "Beltrana", email: "beltrana@example.com" };

/** Sufixo "\n" que `JSON.stringify` sozinho nunca produz — prova que `gravarAtomico` grava o `corpoCru` exato (teste b). */
function corpoCruDe(objeto: unknown): string {
  return `${JSON.stringify(objeto)}\n`;
}

function chaveDaRota(caminho: string, query?: Record<string, string>): string {
  const entradas = Object.entries(query ?? {}).sort(([a], [b]) => a.localeCompare(b));
  const querystring = entradas.map(([chave, valor]) => `${chave}=${valor}`).join("&");
  return querystring.length > 0 ? `${caminho}?${querystring}` : caminho;
}

interface OpcoesDoClienteFalso {
  readonly rotas: ReadonlyMap<string, string>;
  readonly erroEmTimeInStatus?: { readonly status: number };
  readonly bytesDoAnexo?: Uint8Array;
}

function criarClienteFalso(opcoes: OpcoesDoClienteFalso): {
  readonly cliente: ClienteClickUp;
  readonly chamadas: readonly string[];
  readonly urlsBaixadas: readonly string[];
  readonly contadorDeChamadasTimeInStatus: () => number;
} {
  const chamadas: string[] = [];
  const urlsBaixadas: string[] = [];
  let chamadasTimeInStatus = 0;
  // Nunca usado fora deste cliente falso — só existe para o teste (g) provar ausência de vazamento.
  void TOKEN_DO_CLIENTE_FALSO;

  const cliente: ClienteClickUp = {
    async get(caminho, query) {
      const chave = chaveDaRota(caminho, query);
      chamadas.push(chave);
      if (caminho.endsWith("/time_in_status")) {
        chamadasTimeInStatus += 1;
        if (opcoes.erroEmTimeInStatus !== undefined) {
          throw new ErroClickUp(opcoes.erroEmTimeInStatus.status, caminho, "time_in_status indisponível (fixture de teste)");
        }
      }
      const corpoCru = opcoes.rotas.get(chave);
      if (corpoCru === undefined) {
        throw new Error(`cliente falso: rota não configurada — ${chave}`);
      }
      return { status: 200, corpoCru, json: JSON.parse(corpoCru) as unknown, cabecalhos: new Headers() };
    },
    async baixar(url) {
      urlsBaixadas.push(url);
      return { bytes: opcoes.bytesDoAnexo ?? new Uint8Array([1, 2, 3, 4]), contentType: "application/octet-stream" };
    },
  };

  return { cliente, chamadas, urlsBaixadas, contadorDeChamadasTimeInStatus: () => chamadasTimeInStatus };
}

const LIST_ID_CENARIO = "list-fake-1";

/**
 * 1 Lista (3 statuses, 2 campos, 1 membro), 2 Tarefas abertas + 1 arquivada,
 * detalhe das 3, comentários (task-open-1: 1 página parcial; task-open-2:
 * página cheia de 25 + parcial de 3 — duas páginas; task-arch-1: 1 página
 * parcial), `time_in_status` ok para as 3, e 1 anexo (só em task-open-1).
 */
function construirRotasDoCenarioCompleto(): Map<string, string> {
  const rotas = new Map<string, string>();

  rotas.set(
    chaveDaRota(`/list/${LIST_ID_CENARIO}`),
    corpoCruDe({
      id: LIST_ID_CENARIO,
      name: "Lista de teste",
      statuses: [
        { status: "aberto", type: "open" },
        { status: "em revisão", type: "custom" },
        { status: "fechado", type: "closed" },
      ],
    }),
  );

  rotas.set(
    chaveDaRota(`/list/${LIST_ID_CENARIO}/field`),
    corpoCruDe({
      fields: [
        { id: "f1", name: "Forma de pagamento", type: "drop_down" },
        { id: "f2", name: "Valor", type: "currency" },
      ],
    }),
  );

  rotas.set(
    chaveDaRota(`/list/${LIST_ID_CENARIO}/member`),
    corpoCruDe({ members: [{ id: 1, username: "Financeiro", email: "financeiro@tria.example" }] }),
  );

  rotas.set(
    chaveDaRota(`/list/${LIST_ID_CENARIO}/task`, {
      page: "0",
      include_closed: "true",
      subtasks: "true",
      archived: "false",
    }),
    corpoCruDe({
      tasks: [
        {
          id: "task-open-1",
          name: "Tarefa aberta 1",
          date_updated: "1000",
          creator: USUARIO_CENARIO_1,
          assignees: [USUARIO_CENARIO_1],
          watchers: [],
          attachments: [
            { id: "att-1", title: "nota.pdf", url: "https://t1.clickup-attachments.com/att-1/nota.pdf", size: 111 },
          ],
        },
        {
          id: "task-open-2",
          name: "Tarefa aberta 2",
          date_updated: "3000",
          creator: USUARIO_CENARIO_2,
          assignees: [],
          watchers: [],
        },
      ],
      last_page: true,
    }),
  );

  rotas.set(
    chaveDaRota(`/list/${LIST_ID_CENARIO}/task`, {
      page: "0",
      include_closed: "true",
      subtasks: "true",
      archived: "true",
    }),
    corpoCruDe({
      tasks: [
        {
          id: "task-arch-1",
          name: "Tarefa arquivada 1",
          date_updated: "2000",
          creator: USUARIO_CENARIO_1,
          assignees: [],
          watchers: [],
        },
      ],
      last_page: true,
    }),
  );

  rotas.set(
    chaveDaRota("/task/task-open-1"),
    corpoCruDe({
      id: "task-open-1",
      name: "Tarefa aberta 1",
      date_updated: "1000",
      creator: USUARIO_CENARIO_1,
      assignees: [USUARIO_CENARIO_1],
      watchers: [],
      attachments: [
        { id: "att-1", title: "nota.pdf", url: "https://t1.clickup-attachments.com/att-1/nota.pdf", size: 111 },
      ],
    }),
  );
  rotas.set(
    chaveDaRota("/task/task-open-2"),
    corpoCruDe({
      id: "task-open-2",
      name: "Tarefa aberta 2",
      date_updated: "3000",
      creator: USUARIO_CENARIO_2,
      assignees: [],
      watchers: [],
    }),
  );
  rotas.set(
    chaveDaRota("/task/task-arch-1"),
    corpoCruDe({
      id: "task-arch-1",
      name: "Tarefa arquivada 1",
      date_updated: "2000",
      creator: USUARIO_CENARIO_1,
      assignees: [],
      watchers: [],
    }),
  );

  rotas.set(
    chaveDaRota("/task/task-open-1/comment"),
    corpoCruDe({
      comments: [
        { id: "c-tsk1-1", date: "500002", user: USUARIO_CENARIO_1, comment: [{ text: "Aprovado" }] },
        { id: "c-tsk1-2", date: "500001", user: USUARIO_CENARIO_2, comment: [{ text: "Ok" }] },
      ],
    }),
  );

  const paginaCheiaTask2 = Array.from({ length: 25 }, (_, indice) => ({
    id: `c-tsk2-${indice + 1}`,
    date: String(2000024 - indice),
    user: USUARIO_CENARIO_1,
    comment: [{ text: `comentário ${indice + 1}` }],
  }));
  rotas.set(chaveDaRota("/task/task-open-2/comment"), corpoCruDe({ comments: paginaCheiaTask2 }));
  const ultimoDaPaginaCheia = paginaCheiaTask2[paginaCheiaTask2.length - 1]!;
  rotas.set(
    chaveDaRota("/task/task-open-2/comment", { start: ultimoDaPaginaCheia.date, start_id: ultimoDaPaginaCheia.id }),
    corpoCruDe({
      comments: [
        { id: "c-tsk2-26", date: "1999998", user: USUARIO_CENARIO_2, comment: [{ text: "x" }] },
        { id: "c-tsk2-27", date: "1999997", user: USUARIO_CENARIO_2, comment: [{ text: "y" }] },
        { id: "c-tsk2-28", date: "1999996", user: USUARIO_CENARIO_2, comment: [{ text: "z" }] },
      ],
    }),
  );

  rotas.set(
    chaveDaRota("/task/task-arch-1/comment"),
    corpoCruDe({ comments: [{ id: "c-arch-1", date: "100001", user: USUARIO_CENARIO_1, comment: [{ text: "arquivo" }] }] }),
  );

  for (const taskId of ["task-open-1", "task-open-2", "task-arch-1"]) {
    rotas.set(
      chaveDaRota(`/task/${taskId}/time_in_status`),
      corpoCruDe({ current_status: { status: "aberto", total_time: { by_minute: 120, since: "1568044355774" } } }),
    );
  }

  return rotas;
}

describe("exportarClickUp — orquestração contra cliente falso", () => {
  const pastasParaLimpar: string[] = [];

  afterEach(async () => {
    await Promise.all(pastasParaLimpar.splice(0).map((pasta) => rm(pasta, { recursive: true, force: true })));
  });

  async function novaPasta(): Promise<string> {
    const pasta = await mkdtemp(path.join(tmpdir(), "exportar-clickup-orquestracao-"));
    pastasParaLimpar.push(pasta);
    return pasta;
  }

  it("(a) exporta 1 Lista inteira contra o cliente falso — disco e ContagensDaLista batem", async () => {
    const pasta = await novaPasta();
    const { cliente } = criarClienteFalso({ rotas: construirRotasDoCenarioCompleto() });
    const linhasDeLog: string[] = [];

    const resultado = await exportarClickUp({
      cliente,
      pastaDestino: pasta,
      listas: [LIST_ID_CENARIO],
      log: (linha) => linhasDeLog.push(linha),
    });

    const base = path.join(pasta, LIST_ID_CENARIO);
    for (const relativo of [
      "list.json",
      "fields.json",
      "members.json",
      "tasks/page-000.json",
      "tasks-arquivadas/page-000.json",
      "task/task-open-1.json",
      "task/task-open-2.json",
      "task/task-arch-1.json",
      "comments/task-open-1/page-000.json",
      "comments/task-open-2/page-000.json",
      "comments/task-open-2/page-001.json",
      "comments/task-arch-1/page-000.json",
      "time-in-status/task-open-1.json",
      "time-in-status/task-open-2.json",
      "time-in-status/task-arch-1.json",
      "attachments/task-open-1/att-1-nota.pdf",
    ]) {
      await expect(stat(path.join(base, relativo)), `esperava ${relativo}`).resolves.toBeDefined();
    }
    await expect(stat(path.join(pasta, "usuarios-vistos.json"))).resolves.toBeDefined();
    await expect(stat(path.join(pasta, "execucao.json"))).resolves.toBeDefined();

    const contagens = resultado.listas[0]!;
    expect(contagens.listId).toBe(LIST_ID_CENARIO);
    expect(contagens.paginasDeTarefas).toBe(2);
    expect(contagens.tarefas).toBe(2);
    expect(contagens.tarefasArquivadas).toBe(1);
    expect(contagens.detalhes).toBe(3);
    expect(contagens.comentarios).toBe(31);
    expect(contagens.paginasDeComentarios).toBe(4);
    expect(contagens.anexos).toBe(1);
    expect(contagens.anexosBaixados).toBe(1);
    expect(contagens.anexosPulados).toBe(0);
    expect(contagens.timeInStatus).toBe(3);
    expect(contagens.timeInStatusIndisponivel).toBe(0);
    expect(contagens.campos).toBe(2);
    expect(contagens.membros).toBe(1);
    expect(contagens.statusDefinidos).toBe(3);
    expect(contagens.maiorDateUpdated).toBe("3000");

    expect(resultado.amostra).toBe(false);
    expect(resultado.timeInStatusDisponivel).toBe(true);
    expect(resultado.requisicoes).toBeGreaterThan(0);
    expect(linhasDeLog.length).toBeGreaterThan(0);
  });

  it("(b) o conteúdo gravado é byte a byte o corpoCru do cliente falso — nunca reserializado", async () => {
    const pasta = await novaPasta();
    const rotas = construirRotasDoCenarioCompleto();
    const { cliente } = criarClienteFalso({ rotas });

    await exportarClickUp({ cliente, pastaDestino: pasta, listas: [LIST_ID_CENARIO] });

    const caminho = path.join(pasta, LIST_ID_CENARIO, "tasks", "page-000.json");
    const gravado = await readFile(caminho, "utf8");
    const esperado = rotas.get(
      chaveDaRota(`/list/${LIST_ID_CENARIO}/task`, {
        page: "0",
        include_closed: "true",
        subtasks: "true",
        archived: "false",
      }),
    )!;
    expect(gravado).toBe(esperado);
    expect(gravado.endsWith("\n")).toBe(true);
  });

  it("(c) retomada: segunda execução na mesma pasta não faz nenhuma requisição e não reescreve nada", async () => {
    const pasta = await novaPasta();
    const { cliente, chamadas } = criarClienteFalso({ rotas: construirRotasDoCenarioCompleto() });

    const primeiraExecucao = await exportarClickUp({ cliente, pastaDestino: pasta, listas: [LIST_ID_CENARIO] });
    expect(primeiraExecucao.requisicoes).toBeGreaterThan(0);

    const caminhoListJson = path.join(pasta, LIST_ID_CENARIO, "list.json");
    const mtimeAntes = (await stat(caminhoListJson)).mtimeMs;
    const chamadasAntes = chamadas.length;

    const segundaExecucao = await exportarClickUp({ cliente, pastaDestino: pasta, listas: [LIST_ID_CENARIO] });

    expect(segundaExecucao.requisicoes).toBe(0);
    expect(chamadas.length).toBe(chamadasAntes);
    expect((await stat(caminhoListJson)).mtimeMs).toBe(mtimeAntes);
    expect(segundaExecucao.listas[0]).toEqual(primeiraExecucao.listas[0]);
  });

  it("(d) smoke test de time_in_status: 4xx desliga o recurso para toda a execução; timeInStatus: 'nao' não tenta nenhuma vez", async () => {
    const pasta = await novaPasta();
    const { cliente, contadorDeChamadasTimeInStatus } = criarClienteFalso({
      rotas: construirRotasDoCenarioCompleto(),
      erroEmTimeInStatus: { status: 400 },
    });

    const resultado = await exportarClickUp({ cliente, pastaDestino: pasta, listas: [LIST_ID_CENARIO] });

    expect(resultado.timeInStatusDisponivel).toBe(false);
    expect(contadorDeChamadasTimeInStatus()).toBe(1);
    expect(resultado.avisos.some((aviso) => aviso.includes("time_in_status") && aviso.includes("400"))).toBe(true);
    await expect(stat(path.join(pasta, LIST_ID_CENARIO, "time-in-status", "task-open-1.json"))).rejects.toThrow();

    const pastaSemVerificar = await novaPasta();
    const { cliente: clienteOptOut, contadorDeChamadasTimeInStatus: contadorOptOut } = criarClienteFalso({
      rotas: construirRotasDoCenarioCompleto(),
      erroEmTimeInStatus: { status: 400 },
    });
    const resultadoOptOut = await exportarClickUp({
      cliente: clienteOptOut,
      pastaDestino: pastaSemVerificar,
      listas: [LIST_ID_CENARIO],
      timeInStatus: "nao",
    });
    expect(resultadoOptOut.timeInStatusDisponivel).toBe("nao-verificado");
    expect(contadorOptOut()).toBe(0);
  });

  it("(e) anexos: host fora da allowlist e tamanho acima do máximo são pulados; 'nenhuma' não baixa; já em disco não baixa de novo", async () => {
    const listaAnexo = "list-anexo-1";
    const detalheComAnexo = (anexo: Record<string, unknown>) => ({
      tasks: [{ id: "t-anexo", name: "Tarefa com anexo", date_updated: "1", creator: USUARIO_CENARIO_1, assignees: [], watchers: [] }],
      _detalheDaTarefa: { id: "t-anexo", attachments: [anexo] },
    });

    function rotasComUmAnexo(anexo: Record<string, unknown>): Map<string, string> {
      const rotas = new Map<string, string>();
      rotas.set(chaveDaRota(`/list/${listaAnexo}`), corpoCruDe({ id: listaAnexo, statuses: [] }));
      rotas.set(chaveDaRota(`/list/${listaAnexo}/field`), corpoCruDe({ fields: [] }));
      rotas.set(chaveDaRota(`/list/${listaAnexo}/member`), corpoCruDe({ members: [] }));
      rotas.set(
        chaveDaRota(`/list/${listaAnexo}/task`, { page: "0", include_closed: "true", subtasks: "true", archived: "false" }),
        corpoCruDe({ tasks: [{ id: "t-anexo", date_updated: "1" }], last_page: true }),
      );
      rotas.set(
        chaveDaRota(`/list/${listaAnexo}/task`, { page: "0", include_closed: "true", subtasks: "true", archived: "true" }),
        corpoCruDe({ tasks: [], last_page: true }),
      );
      rotas.set(chaveDaRota("/task/t-anexo"), corpoCruDe({ id: "t-anexo", attachments: [anexo] }));
      rotas.set(chaveDaRota("/task/t-anexo/comment"), corpoCruDe({ comments: [] }));
      rotas.set(chaveDaRota("/task/t-anexo/time_in_status"), corpoCruDe({ current_status: {} }));
      return rotas;
    }
    void detalheComAnexo;

    // host fora da allowlist
    const pastaHostRuim = await novaPasta();
    const { cliente: clienteHostRuim, urlsBaixadas: urlsHostRuim } = criarClienteFalso({
      rotas: rotasComUmAnexo({ id: "att-x", title: "x.pdf", url: "https://evil.example.com/x.pdf", size: 10 }),
    });
    const resultadoHostRuim = await exportarClickUp({ cliente: clienteHostRuim, pastaDestino: pastaHostRuim, listas: [listaAnexo] });
    expect(resultadoHostRuim.listas[0]!.anexosPulados).toBe(1);
    expect(resultadoHostRuim.listas[0]!.anexosBaixados).toBe(0);
    expect(urlsHostRuim).toHaveLength(0);
    expect(resultadoHostRuim.avisos.some((a) => a.includes("att-x") && a.includes("host"))).toBe(true);

    // tamanho acima do máximo
    const pastaGrande = await novaPasta();
    const { cliente: clienteGrande } = criarClienteFalso({
      rotas: rotasComUmAnexo({
        id: "att-grande",
        title: "grande.pdf",
        url: "https://t1.clickup-attachments.com/att-grande/grande.pdf",
        size: TAMANHO_MAXIMO_DE_ANEXO + 1,
      }),
    });
    const resultadoGrande = await exportarClickUp({ cliente: clienteGrande, pastaDestino: pastaGrande, listas: [listaAnexo] });
    expect(resultadoGrande.listas[0]!.anexosPulados).toBe(1);
    expect(resultadoGrande.listas[0]!.anexosBaixados).toBe(0);
    expect(resultadoGrande.avisos.some((a) => a.includes("att-grande"))).toBe(true);

    // política "nenhuma"
    const pastaSemAnexo = await novaPasta();
    const { cliente: clienteOk, urlsBaixadas: urlsOk } = criarClienteFalso({
      rotas: rotasComUmAnexo({ id: "att-ok", title: "ok.pdf", url: "https://t1.clickup-attachments.com/att-ok/ok.pdf", size: 10 }),
    });
    const resultadoSemAnexo = await exportarClickUp({
      cliente: clienteOk,
      pastaDestino: pastaSemAnexo,
      listas: [listaAnexo],
      anexos: "nenhuma",
    });
    expect(resultadoSemAnexo.listas[0]!.anexosBaixados).toBe(0);
    expect(urlsOk).toHaveLength(0);

    // já em disco com tamanho > 0 — não baixa de novo
    const pastaJaBaixado = await novaPasta();
    const anexoJaBaixado = { id: "att-cache", title: "cache.pdf", url: "https://t1.clickup-attachments.com/att-cache/cache.pdf", size: 10 };
    const { cliente: clienteCache, urlsBaixadas: urlsCache } = criarClienteFalso({ rotas: rotasComUmAnexo(anexoJaBaixado) });
    const caminhoDoAnexoCache = caminhoDoAnexo(path.join(pastaJaBaixado, listaAnexo), "t-anexo", "att-cache", "cache.pdf");
    await gravarAtomico(caminhoDoAnexoCache, "conteudo-ja-existente");
    const resultadoCache = await exportarClickUp({ cliente: clienteCache, pastaDestino: pastaJaBaixado, listas: [listaAnexo] });
    expect(resultadoCache.listas[0]!.anexosBaixados).toBe(1);
    expect(urlsCache).toHaveLength(0);
  });

  it("(f) limiteDeTarefas restringe a amostra e marca amostra: true; sem limite, amostra: false", async () => {
    const pastaComLimite = await novaPasta();
    const { cliente: clienteComLimite } = criarClienteFalso({ rotas: construirRotasDoCenarioCompleto() });
    const resultadoComLimite = await exportarClickUp({
      cliente: clienteComLimite,
      pastaDestino: pastaComLimite,
      listas: [LIST_ID_CENARIO],
      limiteDeTarefas: 1,
    });
    expect(resultadoComLimite.amostra).toBe(true);
    expect(resultadoComLimite.listas[0]!.detalhes).toBe(1);
    const arquivosDeTarefa = await readdir(path.join(pastaComLimite, LIST_ID_CENARIO, "task"));
    expect(arquivosDeTarefa).toHaveLength(1);

    const pastaSemLimite = await novaPasta();
    const { cliente: clienteSemLimite } = criarClienteFalso({ rotas: construirRotasDoCenarioCompleto() });
    const resultadoSemLimite = await exportarClickUp({
      cliente: clienteSemLimite,
      pastaDestino: pastaSemLimite,
      listas: [LIST_ID_CENARIO],
    });
    expect(resultadoSemLimite.amostra).toBe(false);
    expect(resultadoSemLimite.listas[0]!.detalhes).toBe(3);
  });

  it("(g) usuarios-vistos.json lista quem apareceu com ocorrências/papéis; log e avisos nunca contêm o token do cliente falso", async () => {
    const pasta = await novaPasta();
    const { cliente } = criarClienteFalso({ rotas: construirRotasDoCenarioCompleto() });
    const linhasDeLog: string[] = [];

    const resultado = await exportarClickUp({
      cliente,
      pastaDestino: pasta,
      listas: [LIST_ID_CENARIO],
      log: (linha) => linhasDeLog.push(linha),
    });

    expect(resultado.usuariosVistos.length).toBeGreaterThan(0);
    const fulano = resultado.usuariosVistos.find((u) => u.id === "501");
    expect(fulano).toBeDefined();
    expect(fulano?.ocorrencias).toBeGreaterThan(0);
    expect(fulano?.papeis.length).toBeGreaterThan(0);

    const usuariosVistosNoDisco = JSON.parse(
      await readFile(path.join(pasta, "usuarios-vistos.json"), "utf8"),
    ) as readonly UsuarioVisto[];
    expect(usuariosVistosNoDisco.length).toBe(resultado.usuariosVistos.length);
    // ordenado por ocorrências desc
    for (let i = 1; i < usuariosVistosNoDisco.length; i += 1) {
      expect(usuariosVistosNoDisco[i - 1]!.ocorrencias).toBeGreaterThanOrEqual(usuariosVistosNoDisco[i]!.ocorrencias);
    }

    const textoDosAvisos = resultado.avisos.join("\n");
    const textoDoLog = linhasDeLog.join("\n");
    expect(textoDosAvisos).not.toContain(TOKEN_DO_CLIENTE_FALSO);
    expect(textoDoLog).not.toContain(TOKEN_DO_CLIENTE_FALSO);
  });
});
