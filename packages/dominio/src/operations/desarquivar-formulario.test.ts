/** POSC-10 — desarquivar o Formulário devolve o mesmo link, pausado; só quem administra a Lista. */
import { beforeEach, describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import type { DataState } from "../state";
import { archiveForm, createForm, formBySecret, unarchiveForm, updateForm } from "./scale";

let state: DataState;
beforeEach(() => {
  state = buildSeed();
});

describe("unarchiveForm", () => {
  it("volta à Lista com o mesmo segredo, pausado; ativar reabre o link; recusa quem não administra e o que não está arquivado", () => {
    const criado = createForm(state, "mem_thiago", "lst_prospeccao", { name: "Inscrição", questions: [{ label: "Nome", required: true, target: { kind: "title" } }] });
    if (!criado.ok) throw new Error(criado.error);
    const form = criado.value;
    const segredo = form.secret;
    expect(formBySecret(state, segredo)?.id).toBe(form.id);

    expect(unarchiveForm(state, "mem_thiago", form.id).ok).toBe(false);
    expect(archiveForm(state, "mem_thiago", form.id).ok).toBe(true);
    expect(formBySecret(state, segredo)).toBeUndefined();

    expect(unarchiveForm(state, "mem_julia", form.id).ok).toBe(false);
    const volta = unarchiveForm(state, "mem_thiago", form.id);
    expect(volta.ok, volta.ok ? "" : volta.error).toBe(true);
    expect(form.lifecycle).toBe("ativo");
    expect(form.enabled).toBe(false);
    expect(form.secret).toBe(segredo);
    expect(state.activity.some((a) => a.action === "Formulário desarquivado")).toBe(true);

    expect(updateForm(state, "mem_thiago", form.id, { enabled: true }).ok).toBe(true);
    expect(formBySecret(state, segredo)?.id).toBe(form.id);
  });
});
