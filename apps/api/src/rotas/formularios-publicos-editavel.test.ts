/**
 * Checklist 1.2–1.5 — o DTO público do Formulário editável e a recusa do
 * Formulário desatualizado já ao abrir e ao subir arquivo. Sem banco: o
 * estado é injetado (`formulariosPublicos.lerEstado`), como em
 * `formularios-publicos.test.ts`.
 */

import { describe, expect, it } from "vitest";
import type { DataState } from "@n1/dominio";
import { buildGestaoBootstrap } from "@n1/dominio/bootstrap-gestao";
import { garantirFormularioDaSolicitacao } from "@n1/dominio/formulario-da-solicitacao";
import { createFieldDefinition } from "@n1/dominio/operations/configuration";
import { evoluirConfiguracaoDeSolicitacoes, LISTA_ID } from "@n1/dominio/solicitacao-de-pagamento-evolver";
import { buildApp } from "../app";
import { criarLimiteDeTaxa } from "../servicos/limite-de-taxa";
import { COPY_DESATUALIZADO } from "./formularios-publicos";

const MARYANE = "mem_maryane";

function estadoComFormulario(): { estado: DataState; segredo: string } {
  const estado = buildGestaoBootstrap({ agora: "2026-10-01T12:00:00.000Z" });
  const evolucao = evoluirConfiguracaoDeSolicitacoes(estado, MARYANE);
  if (!evolucao.ok) throw new Error(evolucao.error);
  const form = garantirFormularioDaSolicitacao(estado, MARYANE);
  if (!form.ok) throw new Error(form.error);
  return { estado, segredo: form.value.form.secret };
}

function app(estado: DataState) {
  return buildApp({
    logger: false,
    formulariosPublicos: {
      lerEstado: async () => estado,
      limitePorIp: criarLimiteDeTaxa({ janelaMs: 60_000, maximo: 1000 }),
      limitePorSegredo: criarLimiteDeTaxa({ janelaMs: 60_000, maximo: 1000 }),
    },
  });
}

interface PerguntaDoDto {
  readonly id: string;
  readonly label: string;
  readonly section?: string;
  readonly help?: string;
  readonly mask?: string;
  readonly showWhen?: { readonly questionId: string; readonly values: readonly string[] };
}

describe("GET /v1/public/forms/:secret — o Formulário como dado", () => {
  it("título e introdução do Formulário; seção, ajuda, condição e máscara em cada pergunta; nenhum id de Campo", async () => {
    const { estado, segredo } = estadoComFormulario();
    const resposta = await app(estado).inject({ method: "GET", url: `/v1/public/forms/${segredo}` });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.body).not.toContain("fld_");
    const corpo = resposta.json() as { title: string; intro: string; questions: PerguntaDoDto[] };
    expect(corpo.title).toBe("Solicitação de pagamento");
    expect(corpo.intro).toMatch(/^Preencha os dados do pagamento/);
    const por = (label: string) => corpo.questions.find((q) => q.label === label)!;
    expect(por("Centro de Custo").section).toBe("Classificação");
    expect(por("CNPJ")).toMatchObject({ mask: "cnpj", showWhen: { questionId: por("Fornecedor").id, values: ["CNPJ"] }, help: "Necessário para seguir à aprovação." });
    expect(por("CPF").mask).toBe("cpf");
    expect(por("WhatsApp").mask).toBe("telefone");
    expect(por("Nome do fornecedor").help).toBe("Quando a Pessoa não está no Espaço de Trabalho.");
  });

  it("a máscara vem do Campo: renomear a pergunta não a tira", async () => {
    const { estado, segredo } = estadoComFormulario();
    const form = estado.forms.find((f) => f.secret === segredo)!;
    form.questions = form.questions.map((q) => (q.label === "CNPJ" ? { ...q, label: "Documento da empresa" } : q));
    const corpo = (await app(estado).inject({ method: "GET", url: `/v1/public/forms/${segredo}` })).json() as { questions: PerguntaDoDto[] };
    expect(corpo.questions.find((q) => q.label === "Documento da empresa")?.mask).toBe("cnpj");
  });
});

describe("checklist 1.5 — o Formulário desatualizado recusa já ao abrir e ao subir arquivo", () => {
  it("um Campo obrigatório novo na Lista: 409 com a frase do envio, no GET e no pedido de upload", async () => {
    const { estado, segredo } = estadoComFormulario();
    const novo = createFieldDefinition(estado, MARYANE, { name: "Aprovador (teste 1.5)", type: "text", required: true, definedAtType: "list", definedAtId: LISTA_ID });
    if (!novo.ok) throw new Error(novo.error);

    const abrir = await app(estado).inject({ method: "GET", url: `/v1/public/forms/${segredo}` });
    expect(abrir.statusCode).toBe(409);
    expect(abrir.json()).toEqual({ ok: false, error: COPY_DESATUALIZADO, desatualizado: true });
    expect(abrir.body).not.toContain("Aprovador");

    const subir = await app(estado).inject({
      method: "POST",
      url: `/v1/public/forms/${segredo}/uploads`,
      payload: { displayName: "nota.pdf", mediaType: "application/pdf" },
    });
    expect(subir.statusCode).toBe(409);
    expect(subir.json()).toMatchObject({ desatualizado: true });
  });
});
