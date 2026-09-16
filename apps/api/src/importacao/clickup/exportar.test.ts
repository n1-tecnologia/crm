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

import {
  caminhoDoAnexo,
  coletarAnexos,
  coletarUsuarios,
  gravarAtomico,
  lerSeValido,
  sanitizarNomeDeArquivo,
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
