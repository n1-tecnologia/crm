/**
 * `manifesto.ts` — testes puros/sem rede: sha256 conhecido, contagens de uma
 * fixture em disco (`mkdtemp`, nunca dado real — o anexo é nomeado de
 * propósito `nota-fulano-123.456.789-00.pdf` para provar que o nome nunca
 * atravessa para o manifesto, T-0-05), determinismo (mesma exportação ⇒
 * mesmo JSON; 1 byte mudado ⇒ só aquele sha256 e o `hashAgregado` mudam) e a
 * ausência de PII no markdown (regex de e-mail/CPF/CNPJ, T-0-05). O caso (f)
 * prende a linha do `.gitignore` que mantém `apps/api/exportacoes/clickup/`
 * fora do git (T-0-03) — sem essa linha, o manifesto deixaria de ser a única
 * coisa versionada da exportação.
 */

import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  contarRecursos,
  escreverManifesto,
  gerarManifesto,
  hashDoArquivo,
  listarArquivos,
  manifestoEmMarkdown,
} from "./manifesto";

const pastasParaLimpar: string[] = [];

afterEach(async () => {
  await Promise.all(pastasParaLimpar.splice(0).map((pasta) => rm(pasta, { recursive: true, force: true })));
});

async function novaPasta(): Promise<string> {
  const pasta = await mkdtemp(path.join(tmpdir(), "manifesto-teste-"));
  pastasParaLimpar.push(pasta);
  return pasta;
}

async function escrever(caminho: string, conteudo: string): Promise<void> {
  await mkdir(path.dirname(caminho), { recursive: true });
  await writeFile(caminho, conteudo, "utf8");
}

/**
 * Uma Lista `123`: 3 status, 2 Campos, 1 Membro, 2 Tarefas abertas + 1
 * arquivada, 2 detalhes, Comentários em duas Tarefas (3 + 2 = 5, em 2
 * páginas), 1 `time_in_status`, 1 anexo cujo nome tenta vazar CPF
 * (`nota-fulano-123.456.789-00.pdf` — nunca deve aparecer no manifesto).
 * Mais ruído no topo (`exportacao.log`, `execucao.json`, `qualquer.tmp`) que
 * `listarArquivos` deve excluir.
 */
async function criarFixtureCompleta(pasta: string): Promise<void> {
  const base = path.join(pasta, "123");

  await escrever(
    path.join(base, "list.json"),
    JSON.stringify({ statuses: [{ status: "aberto" }, { status: "em revisão" }, { status: "fechado" }] }),
  );
  await escrever(
    path.join(base, "fields.json"),
    JSON.stringify({ fields: [{ id: "f1", name: "Forma" }, { id: "f2", name: "Valor" }] }),
  );
  await escrever(path.join(base, "members.json"), JSON.stringify({ members: [{ id: 1 }] }));

  await escrever(
    path.join(base, "tasks", "page-000.json"),
    JSON.stringify({ tasks: [{ id: "t1", date_updated: "1000" }, { id: "t2", date_updated: "3000" }], last_page: true }),
  );
  await escrever(
    path.join(base, "tasks-arquivadas", "page-000.json"),
    JSON.stringify({ tasks: [{ id: "t3", date_updated: "2000" }], last_page: true }),
  );

  await escrever(path.join(base, "task", "t1.json"), JSON.stringify({ id: "t1" }));
  await escrever(path.join(base, "task", "t2.json"), JSON.stringify({ id: "t2" }));

  await escrever(
    path.join(base, "comments", "t1", "page-000.json"),
    JSON.stringify({ comments: [{ id: "c1" }, { id: "c2" }, { id: "c3" }] }),
  );
  await escrever(
    path.join(base, "comments", "t2", "page-000.json"),
    JSON.stringify({ comments: [{ id: "c4" }, { id: "c5" }] }),
  );

  await escrever(path.join(base, "time-in-status", "t1.json"), JSON.stringify({ current_status: {} }));

  await escrever(path.join(base, "attachments", "t1", "att1-nota-fulano-123.456.789-00.pdf"), "conteudo-do-anexo");

  await escrever(path.join(pasta, "exportacao.log"), "linha de progresso, sem token\n");
  await escrever(path.join(pasta, "execucao.json"), JSON.stringify({ amostra: false }));
  await escrever(path.join(pasta, "qualquer.tmp"), "resto de gravação atômica interrompida");
}

describe("hashDoArquivo", () => {
  it("(a) sha256/bytes conhecidos de um arquivo com o texto 'abc'", async () => {
    const pasta = await novaPasta();
    const caminho = path.join(pasta, "abc.txt");
    await writeFile(caminho, "abc", "utf8");

    const { sha256, bytes } = await hashDoArquivo(caminho);

    expect(sha256).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(bytes).toBe(3);
  });
});

describe("contarRecursos", () => {
  it("(b) reconta do disco: status, campos, membros, tarefas, arquivadas, detalhes, comentários, time_in_status, anexos, maiorDateUpdated", async () => {
    const pasta = await novaPasta();
    await criarFixtureCompleta(pasta);

    const listas = await contarRecursos(pasta);

    expect(listas).toHaveLength(1);
    expect(listas[0]).toMatchObject({
      listId: "123",
      statusDefinidos: 3,
      campos: 2,
      membros: 1,
      paginasDeTarefas: 1,
      tarefas: 2,
      tarefasArquivadas: 1,
      detalhes: 2,
      comentarios: 5,
      paginasDeComentarios: 2,
      timeInStatus: 1,
      anexos: 1,
      anexosBaixados: 1,
      maiorDateUpdated: "3000",
    });
  });
});

describe("listarArquivos", () => {
  it("(c) caminhos relativos ordenados; anexo sem o nome original; exportacao.log/execucao.json/*.tmp excluídos", async () => {
    const pasta = await novaPasta();
    await criarFixtureCompleta(pasta);

    const arquivos = await listarArquivos(pasta);

    for (const entrada of arquivos) {
      expect(entrada.caminho).not.toContain("\\");
    }
    const caminhos = arquivos.map((a) => a.caminho);
    const ordenados = [...caminhos].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    expect(caminhos).toEqual(ordenados);

    expect(caminhos).toContain("123/attachments/t1/att1");
    expect(caminhos.some((c) => c.includes("nota-fulano"))).toBe(false);

    expect(caminhos.some((c) => c.endsWith("exportacao.log"))).toBe(false);
    expect(caminhos.some((c) => c.endsWith("execucao.json"))).toBe(false);
    expect(caminhos.some((c) => c.endsWith(".tmp"))).toBe(false);

    expect(caminhos).toContain("123/list.json");
    expect(caminhos).toContain("123/fields.json");
  });
});

describe("gerarManifesto / manifestoEmMarkdown — sem PII, determinismo", () => {
  const REGEX_EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/;
  const REGEX_CPF = /\d{3}\.\d{3}\.\d{3}-\d{2}/;
  const REGEX_CNPJ = /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/;

  it("(d) markdown não contém e-mail, CPF, CNPJ nem 'nota-fulano'; contém 123, Tarefas, Comentários, hashAgregado e a ressalva de time_in_status", async () => {
    const pasta = await novaPasta();
    await criarFixtureCompleta(pasta);

    const manifesto = await gerarManifesto({
      pastaExportada: pasta,
      exportadoEm: "2026-09-16T12:00:00.000Z",
      commit: "deadbeef",
    });
    const markdown = manifestoEmMarkdown(manifesto);

    expect(markdown).not.toMatch(REGEX_EMAIL);
    expect(markdown).not.toMatch(REGEX_CPF);
    expect(markdown).not.toMatch(REGEX_CNPJ);
    expect(markdown).not.toContain("nota-fulano");

    expect(markdown).toContain("123");
    expect(markdown).toContain("Tarefas");
    expect(markdown).toContain("Comentários");
    expect(markdown).toContain("hashAgregado");
    expect(markdown.toLowerCase()).toContain("histórico");
  });

  it("(e) determinismo: mesma exportação ⇒ mesmo JSON; 1 byte mudado em fields.json ⇒ só aquele sha256 e o hashAgregado mudam; usuariosVistos nunca traz nome", async () => {
    const pasta = await novaPasta();
    await criarFixtureCompleta(pasta);
    await escrever(
      path.join(pasta, "usuarios-vistos.json"),
      JSON.stringify([{ id: "501", nome: "Fulano da Silva", ocorrencias: 5 }]),
    );

    const opcoes = { pastaExportada: pasta, exportadoEm: "2026-09-16T12:00:00.000Z", commit: "deadbeef" };

    const primeiro = await gerarManifesto(opcoes);
    const segundo = await gerarManifesto(opcoes);
    expect(JSON.stringify(segundo)).toBe(JSON.stringify(primeiro));

    expect(primeiro.usuariosVistos).toEqual([{ id: "501", ocorrencias: 5 }]);
    expect(JSON.stringify(primeiro)).not.toContain("Fulano da Silva");
    expect(JSON.stringify(primeiro)).not.toContain("nome");

    const caminhoFields = path.join(pasta, "123", "fields.json");
    const original = await readFile(caminhoFields, "utf8");
    await writeFile(caminhoFields, original.replace("Forma", "Formaa"), "utf8");

    const terceiro = await gerarManifesto(opcoes);
    expect(terceiro.hashAgregado).not.toBe(primeiro.hashAgregado);

    const entradaFieldsAntes = primeiro.arquivos.find((a) => a.caminho === "123/fields.json")!;
    const entradaFieldsDepois = terceiro.arquivos.find((a) => a.caminho === "123/fields.json")!;
    expect(entradaFieldsDepois.sha256).not.toBe(entradaFieldsAntes.sha256);

    for (const arquivoAntes of primeiro.arquivos) {
      if (arquivoAntes.caminho === "123/fields.json") continue;
      const arquivoDepois = terceiro.arquivos.find((a) => a.caminho === arquivoAntes.caminho)!;
      expect(arquivoDepois.sha256).toBe(arquivoAntes.sha256);
    }
  });

  it("escreverManifesto grava MANIFESTO.json e MANIFESTO.md, ambos terminados em nova linha", async () => {
    const pasta = await novaPasta();
    await criarFixtureCompleta(pasta);
    const pastaDeSaida = await novaPasta();

    const manifesto = await gerarManifesto({
      pastaExportada: pasta,
      exportadoEm: "2026-09-16T12:00:00.000Z",
      commit: "deadbeef",
    });
    const { json, md } = await escreverManifesto(manifesto, pastaDeSaida);

    const textoJson = await readFile(json, "utf8");
    const textoMd = await readFile(md, "utf8");
    expect(textoJson.endsWith("\n")).toBe(true);
    expect(textoMd.endsWith("\n")).toBe(true);
    expect(JSON.parse(textoJson)).toEqual(manifesto);
  });
});

describe(".gitignore", () => {
  it("(f) apps/api/exportacoes/clickup/ está ignorada — T-0-03", () => {
    // apps/api/src/importacao/clickup/manifesto.test.ts -> raiz do repositório
    const texto = readFileSync(new URL("../../../../../.gitignore", import.meta.url), "utf8");
    expect(texto).toContain("apps/api/exportacoes/clickup/");
  });
});
