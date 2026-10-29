/**
 * TAR-04 e TAR-06 no domínio (11-02): `updateTask` guarda a menção da descrição
 * (derivada do texto, D-06 e D-09) e o texto anterior e o novo no Registro de
 * Atividade "Descrição alterada", cortados em 2.000 pontos de código + "…" (D-10).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import { cortarParaHistorico, LIMITE_DO_HISTORICO } from "../descricao-da-tarefa";
import { updateTask } from "./tasks";

const THIAGO = "mem_thiago";
const TAREFA = "tsk_seed_1";
const JULIA = { type: "member", id: "mem_julia" } as const;

let state: DataState;
beforeEach(() => {
  state = buildSeed();
});

const tarefa = () => state.tasks.find((t) => t.id === TAREFA)!;
const registrosDeDescricao = () => state.activity.filter((a) => a.objectId === TAREFA && a.action === "Descrição alterada");

describe("updateTask — menção da descrição e texto anterior (11-02)", () => {
  it("grava a menção derivada do texto e o antes/depois da descrição", () => {
    expect(updateTask(state, THIAGO, TAREFA, { description: "Texto antigo" }).ok).toBe(true);
    const result = updateTask(state, THIAGO, TAREFA, { description: "@Júlia Prado revisar", descriptionMentions: [JULIA] });

    expect(result.ok).toBe(true);
    expect(tarefa().descriptionMentions).toEqual([JULIA]);
    const registro = registrosDeDescricao()[0];
    expect(registro?.before).toBe("Texto antigo");
    expect(registro?.after).toBe("@Júlia Prado revisar");
  });

  it("recusa Membro inexistente antes de mudar qualquer campo", () => {
    const antes = { titulo: tarefa().title, descricao: tarefa().description, atividade: state.activity.length };

    const result = updateTask(state, THIAGO, TAREFA, {
      title: "Outro",
      description: "@Fantasma revisar",
      descriptionMentions: [{ type: "member", id: "mem_nao_existe" }],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("A menção aponta para um Membro que não existe.");
    expect(tarefa().title).toBe(antes.titulo);
    expect(tarefa().description).toBe(antes.descricao);
    expect(tarefa().descriptionMentions).toBeUndefined();
    expect(state.activity.length).toBe(antes.atividade);
  });

  it("não grava o Membro cujo @Nome não está no texto", () => {
    const result = updateTask(state, THIAGO, TAREFA, { description: "revisar sem nome", descriptionMentions: [JULIA] });

    expect(result.ok).toBe(true);
    expect("descriptionMentions" in tarefa()).toBe(false);
  });

  it("grava a mesma menção uma vez só", () => {
    updateTask(state, THIAGO, TAREFA, { description: "@Júlia Prado revisar", descriptionMentions: [JULIA, JULIA] });

    expect(tarefa().descriptionMentions).toEqual([JULIA]);
  });

  it("salvar só o título não mexe na lista; mudar só a descrição refiltra pelo texto novo", () => {
    updateTask(state, THIAGO, TAREFA, { description: "@Júlia Prado revisar", descriptionMentions: [JULIA] });

    updateTask(state, THIAGO, TAREFA, { title: "Novo título" });
    expect(tarefa().descriptionMentions).toEqual([JULIA]);

    updateTask(state, THIAGO, TAREFA, { description: "texto sem o nome" });
    expect("descriptionMentions" in tarefa()).toBe(false);
  });

  it("texto igual com lista nova grava a lista, muda updatedAt e não cria Atividade", () => {
    updateTask(state, THIAGO, TAREFA, { description: "@Júlia Prado revisar" });
    expect("descriptionMentions" in tarefa()).toBe(false);
    tarefa().updatedAt = "2000-01-01T00:00:00.000Z";
    const atividade = state.activity.length;

    const result = updateTask(state, THIAGO, TAREFA, { description: "@Júlia Prado revisar", descriptionMentions: [JULIA] });

    expect(result.ok).toBe(true);
    expect(tarefa().descriptionMentions).toEqual([JULIA]);
    expect(tarefa().updatedAt).not.toBe("2000-01-01T00:00:00.000Z");
    expect(state.activity.length).toBe(atividade);
  });

  it("descrição antes vazia grava before vazio presente", () => {
    expect(tarefa().description).toBe("");

    updateTask(state, THIAGO, TAREFA, { description: "B" });

    const registro = registrosDeDescricao()[0];
    expect(registro).toBeDefined();
    expect("before" in registro!).toBe(true);
    expect(registro?.before).toBe("");
    expect(registro?.after).toBe("B");
  });

  it("corta o texto do histórico em 2.000 pontos de código mais reticências", () => {
    updateTask(state, THIAGO, TAREFA, { description: "a".repeat(3000) });

    const depois = registrosDeDescricao()[0]?.after ?? "";
    expect(Array.from(depois).length).toBe(2001);
    expect(depois.endsWith("…")).toBe(true);
    expect(tarefa().description.length).toBe(3000);
  });

  it("não corta o texto de exatamente 2.000 caracteres", () => {
    const texto = "b".repeat(2000);
    updateTask(state, THIAGO, TAREFA, { description: texto });

    expect(registrosDeDescricao()[0]?.after).toBe(texto);
  });

  it("não parte um emoji na posição do corte", () => {
    const texto = `${"c".repeat(1999)}😀${"d".repeat(10)}`;
    updateTask(state, THIAGO, TAREFA, { description: texto });

    const depois = registrosDeDescricao()[0]?.after ?? "";
    expect(Array.from(depois).length).toBe(2001);
    expect(Array.from(depois)[1999]).toBe("😀");
    expect(depois.endsWith("😀…")).toBe(true);
  });

  it("uma menção não concede acesso nem cria Vínculo", () => {
    const concessoes = state.grants.length;
    const vinculos = state.links.length;

    updateTask(state, THIAGO, TAREFA, { description: "@Júlia Prado revisar", descriptionMentions: [JULIA] });

    expect(state.grants.length).toBe(concessoes);
    expect(state.links.length).toBe(vinculos);
  });
});

describe("cortarParaHistorico", () => {
  it("devolve igual até o limite e corta acima dele", () => {
    expect(LIMITE_DO_HISTORICO).toBe(2000);
    expect(cortarParaHistorico("")).toBe("");
    expect(cortarParaHistorico("x")).toBe("x");
    expect(cortarParaHistorico("y".repeat(2000))).toBe("y".repeat(2000));
    expect(cortarParaHistorico("z".repeat(2001))).toBe(`${"z".repeat(2000)}…`);
    expect(Array.from(cortarParaHistorico("w".repeat(3000))).length).toBe(2001);
  });

  it("conta pontos de código, não unidades UTF-16", () => {
    const emojis = "😀".repeat(2001);
    const cortado = cortarParaHistorico(emojis);
    expect(Array.from(cortado).length).toBe(2001);
    expect(cortado).toBe(`${"😀".repeat(2000)}…`);
  });
});
