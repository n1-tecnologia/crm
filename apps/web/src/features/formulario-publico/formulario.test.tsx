// @vitest-environment jsdom
/**
 * V02-02A/V02-02D — prova de seletor dos onze casos (a)-(k) do Formulário
 * público: condições puras de `campos-condicionais.ts` e comportamento do
 * componente sem rede real (`transportePublico` é mockado — a jornada
 * completa contra o `apps/api` de verdade é o Playwright do Plan 02-23).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { invalidadasPor, perguntasVisiveis, secoesDoFormulario } from "./campos-condicionais";
import { FormularioPublico } from "./formulario";
import { transportePublico } from "@/dados/transporte-publico";
import type { FormularioPublicoDto } from "@/dados/transporte-publico";

vi.mock("@/dados/transporte-publico", () => ({
  transportePublico: {
    obterFormulario: vi.fn(),
    pedirTicket: vi.fn(),
    enviarSubmissao: vi.fn(),
  },
}));

const enviarSubmissaoMock = vi.mocked(transportePublico.enviarSubmissao);

/**
 * O Formulário da Solicitação como o `apps/api` o entrega (checklist 1.2/1.3):
 * seção, condição e máscara são DADO de cada pergunta — a página não sabe
 * nada de "Fornecedor" ou "Forma de pagamento".
 */
function montarFormulario(): FormularioPublicoDto {
  const quando = (questionId: string, valor: string) => ({ showWhen: { questionId, values: [valor] } });
  return {
    formId: "frm_teste",
    title: "Solicitação de pagamento",
    intro: "Preencha os dados do pagamento.",
    questions: [
      { id: "q_titulo", label: "O que deve ser pago?", required: true, kind: "text", section: "Sobre a solicitação" },
      { id: "q_descricao", label: "O que é e como será utilizado?", required: false, kind: "longText", section: "Sobre a solicitação" },
      { id: "q_nome", label: "Nome do solicitante", required: true, kind: "text", section: "Solicitante" },
      { id: "q_whats", label: "WhatsApp", required: true, kind: "phone", section: "Solicitante", mask: "telefone" },
      { id: "q_cc", label: "Centro de Custo", required: true, kind: "singleSelect", options: ["TRIA", "IVL"], section: "Classificação" },
      { id: "q_fornecedor", label: "Fornecedor", required: true, kind: "singleSelect", options: ["CPF", "CNPJ"], section: "Fornecedor" },
      { id: "q_cpf", label: "CPF", required: false, kind: "text", section: "Fornecedor", mask: "cpf", ...quando("q_fornecedor", "CPF") },
      { id: "q_cnpj", label: "CNPJ", required: false, kind: "text", section: "Fornecedor", mask: "cnpj", ...quando("q_fornecedor", "CNPJ") },
      { id: "q_valor", label: "Valor", required: true, kind: "currency", section: "Documento e datas" },
      {
        id: "q_forma",
        label: "Forma de pagamento",
        required: true,
        kind: "singleSelect",
        options: ["Chave Pix", "Boleto", "QRCode Pix", "Cartão"],
        section: "Pagamento",
      },
      { id: "q_chave", label: "Chave pix", required: false, kind: "text", section: "Pagamento", help: "Necessário para seguir à aprovação.", ...quando("q_forma", "Chave Pix") },
      { id: "q_codigo", label: "Código de barras", required: false, kind: "text", section: "Pagamento", ...quando("q_forma", "Boleto") },
      { id: "q_boleto", label: "Boleto", required: false, kind: "file", section: "Pagamento", ...quando("q_forma", "Boleto") },
      { id: "q_pix", label: "Pix copia e cola", required: false, kind: "text", section: "Pagamento", ...quando("q_forma", "QRCode Pix") },
      { id: "q_qr", label: "QR Code", required: false, kind: "file", section: "Pagamento", ...quando("q_forma", "QRCode Pix") },
      { id: "q_link", label: "Link de pagamento", required: false, kind: "url", section: "Pagamento", ...quando("q_forma", "Cartão") },
    ],
  };
}

function renderizar(formulario: FormularioPublicoDto = montarFormulario()) {
  return render(<FormularioPublico secret="segredo-de-teste" formulario={formulario} />);
}

function abrirEEscolher(rotuloCampo: string, opcaoTexto: string): void {
  fireEvent.click(screen.getByRole("combobox", { name: rotuloCampo }));
  fireEvent.click(screen.getByRole("option", { name: opcaoTexto }));
}

/**
 * `Field` desenha o asterisco de obrigatório DENTRO do `<label>` (§ui-ptbr),
 * então o `textContent` de um rótulo obrigatório é `"<rótulo> *"`, não
 * `"<rótulo>"`. `exact: false` casa pelo prefixo sem precisar repetir o
 * asterisco em cada chamada.
 */
function campo(rotulo: string): HTMLElement {
  return screen.getByLabelText(rotulo, { exact: false });
}

function campoOuNulo(rotulo: string): HTMLElement | null {
  return screen.queryByLabelText(rotulo, { exact: false });
}

beforeEach(() => {
  enviarSubmissaoMock.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("campos-condicionais — puro, lido do Formulário", () => {
  const perguntas = montarFormulario().questions;
  const visiveis = (respostas: Record<string, string>) => perguntas.filter((p) => p.showWhen && perguntasVisiveis(perguntas, respostas).has(p.id)).map((p) => p.label);

  it("(a) Fornecedor=CPF mostra CPF e oculta CNPJ; Fornecedor=CNPJ é o inverso", () => {
    expect(visiveis({ q_fornecedor: "CPF" })).toEqual(["CPF"]);
    expect(visiveis({ q_fornecedor: "CNPJ" })).toEqual(["CNPJ"]);
  });

  it("(b) cada Forma de pagamento revela exatamente os campos que o Formulário declara", () => {
    expect(visiveis({ q_forma: "Chave Pix" })).toEqual(["Chave pix"]);
    expect(visiveis({ q_forma: "Boleto" })).toEqual(["Código de barras", "Boleto"]);
    expect(visiveis({ q_forma: "QRCode Pix" })).toEqual(["Pix copia e cola", "QR Code"]);
    expect(visiveis({ q_forma: "Cartão" })).toEqual(["Link de pagamento"]);
  });

  it("(c) invalidadasPor ignora pergunta vazia e devolve a que tem valor ou arquivo", () => {
    expect(invalidadasPor(perguntas, "q_forma", "Boleto", { q_forma: "Chave Pix", q_chave: "" })).toEqual([]);
    expect(invalidadasPor(perguntas, "q_forma", "Boleto", { q_forma: "Chave Pix", q_chave: "abc123" }).map((p) => p.label)).toEqual(["Chave pix"]);
    expect(invalidadasPor(perguntas, "q_forma", "Chave Pix", { q_forma: "Boleto" }, new Set(["q_boleto"])).map((p) => p.label)).toEqual(["Boleto"]);
  });

  it("(c2) as seções são blocos na ordem do Formulário", () => {
    expect(secoesDoFormulario(perguntas).map((s) => s.titulo)).toEqual(["Sobre a solicitação", "Solicitante", "Classificação", "Fornecedor", "Documento e datas", "Pagamento"]);
  });
});

describe("FormularioPublico — componente", () => {
  it("(d) trocar a Forma de pagamento com dado preenchido abre confirmação; Manter preserva, Trocar e limpar aplica", () => {
    renderizar();

    abrirEEscolher("Forma de pagamento", "Chave Pix");
    fireEvent.change(campo("Chave pix"), { target: { value: "minhachave@pix.com" } });

    abrirEEscolher("Forma de pagamento", "Boleto");
    const dialogo = screen.getByRole("alertdialog");
    expect(within(dialogo).getByText("Trocar forma de pagamento?")).toBeTruthy();

    fireEvent.click(within(dialogo).getByRole("button", { name: "Manter a escolha atual" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByRole("combobox", { name: "Forma de pagamento" }).textContent).toContain("Chave Pix");
    expect(campo("Chave pix")).toHaveProperty("value", "minhachave@pix.com");

    abrirEEscolher("Forma de pagamento", "Boleto");
    const segundoDialogo = screen.getByRole("alertdialog");
    fireEvent.click(within(segundoDialogo).getByRole("button", { name: "Trocar e limpar dados" }));
    expect(screen.getByRole("combobox", { name: "Forma de pagamento" }).textContent).toContain("Boleto");
    expect(campoOuNulo("Chave pix")).toBeNull();

    abrirEEscolher("Forma de pagamento", "Chave Pix");
    expect(campo("Chave pix")).toHaveProperty("value", "");
  });

  it("(e) submeter com obrigatório vazio foca o resumo de erros e ele aponta para o primeiro campo inválido", async () => {
    renderizar();

    fireEvent.click(screen.getByRole("button", { name: "Enviar solicitação" }));

    const resumo = await screen.findByRole("alert", { name: "Resumo de erros" });
    await waitFor(() => expect(document.activeElement).toBe(resumo));
    const link = within(resumo).getByRole("link", { name: "O que deve ser pago?" });
    expect(link.getAttribute("href")).toBe("#campo-q_titulo");
    expect(enviarSubmissaoMock).not.toHaveBeenCalled();
  });

  it("(f) o CTA está habilitado no primeiro carregamento mesmo com campos vazios", () => {
    renderizar();
    const cta = screen.getByRole("button", { name: "Enviar solicitação" });
    expect(cta.getAttribute("aria-disabled")).toBe("false");
  });

  it("(g) durante o envio o CTA fica desabilitado e o label muda para 'Enviando solicitação…'", async () => {
    let resolver: (valor: Awaited<ReturnType<typeof transportePublico.enviarSubmissao>>) => void = () => {};
    enviarSubmissaoMock.mockImplementation(() => new Promise((resolve) => (resolver = resolve)));
    renderizar();
    preencherObrigatorios();

    fireEvent.click(screen.getByRole("button", { name: "Enviar solicitação" }));

    const ctaEnviando = await screen.findByRole("button", { name: "Enviando solicitação…" });
    expect(ctaEnviando.getAttribute("aria-disabled")).toBe("true");

    resolver({ tipo: "ok", readableId: "SP-0001" });
    await waitFor(() => expect(screen.getByText("SP-0001")).toBeTruthy());
  });

  it("(h) '1.234,56' é enviado como '1234.56' (reais decimais) e exibido como 'R$ 1.234,56'", async () => {
    enviarSubmissaoMock.mockResolvedValue({ tipo: "ok", readableId: "SP-0002" });
    renderizar();
    preencherObrigatorios({ valorDigitado: "1.234,56" });

    // `toLocaleString` do Intl usa NBSP (U+00A0) entre "R$" e o número em pt-BR — comparar
    // contra a MESMA chamada em vez de um literal evita depender desse detalhe do ICU.
    const esperado = (1234.56).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    expect(campo("Valor")).toHaveProperty("value", esperado);

    fireEvent.click(screen.getByRole("button", { name: "Enviar solicitação" }));
    await waitFor(() => expect(enviarSubmissaoMock).toHaveBeenCalledTimes(1));
    const pedido = enviarSubmissaoMock.mock.calls[0]![0];
    expect(pedido.answers["q_valor"]).toBe("1234.56");
  });

  it("(i) um retry após erro envia a MESMA submissionId da primeira tentativa", async () => {
    enviarSubmissaoMock.mockResolvedValueOnce({ tipo: "falha", erro: "Sem conexão com o servidor." });
    enviarSubmissaoMock.mockResolvedValueOnce({ tipo: "ok", readableId: "SP-0003" });
    renderizar();
    preencherObrigatorios();

    fireEvent.click(screen.getByRole("button", { name: "Enviar solicitação" }));
    await waitFor(() => expect(enviarSubmissaoMock).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "Enviar solicitação" }));
    await waitFor(() => expect(enviarSubmissaoMock).toHaveBeenCalledTimes(2));

    const primeiraSubmissionId = enviarSubmissaoMock.mock.calls[0]![0].submissionId;
    const segundaSubmissionId = enviarSubmissaoMock.mock.calls[1]![0].submissionId;
    expect(segundaSubmissionId).toBe(primeiraSubmissionId);
  });

  it("(j) o DTO não carrega ownerMemberId/listId e o componente não renderiza nenhum id começando com 'fld_'", () => {
    const formulario = montarFormulario();
    expect(JSON.stringify(formulario)).not.toContain("ownerMemberId");
    expect(JSON.stringify(formulario)).not.toContain("listId");

    const { container } = renderizar(formulario);
    const idsComFld = [...container.querySelectorAll("[id]")].filter((el) => el.id.startsWith("fld_"));
    expect(idsComFld).toEqual([]);
  });

  it("(k) cada seção é um fieldset com legend e há exatamente um h1 na árvore", () => {
    const { container } = renderizar();
    const fieldsets = container.querySelectorAll("fieldset");
    expect(fieldsets.length).toBeGreaterThanOrEqual(6);
    for (const fieldset of fieldsets) {
      expect(fieldset.querySelector("legend")).not.toBeNull();
    }
    expect(container.querySelectorAll("h1")).toHaveLength(1);
  });
});

describe("FormularioPublico — o Formulário como dado (checklist 1.2–1.4)", () => {
  it("(l) título e introdução vêm do Formulário", () => {
    renderizar({ ...montarFormulario(), title: "Pedido de reembolso", intro: "Para despesas de viagem." });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Pedido de reembolso");
    expect(screen.getByText("Para despesas de viagem.")).toBeTruthy();
  });

  it("(m) renomear as perguntas não quebra a condição nem a máscara: quem decide é o dado", () => {
    const formulario = montarFormulario();
    const renomeado = {
      ...formulario,
      questions: formulario.questions.map((q) =>
        q.id === "q_fornecedor" ? { ...q, label: "Tipo de fornecedor" } : q.id === "q_cnpj" ? { ...q, label: "Documento da empresa" } : q,
      ),
    };
    renderizar(renomeado);
    expect(campoOuNulo("Documento da empresa")).toBeNull();
    abrirEEscolher("Tipo de fornecedor", "CNPJ");
    fireEvent.change(campo("Documento da empresa"), { target: { value: "11222333000181" } });
    expect(campo("Documento da empresa")).toHaveProperty("value", "11.222.333/0001-81");
  });

  it("(n) a resposta de uma pergunta que ficou escondida não vai no envio", async () => {
    enviarSubmissaoMock.mockResolvedValue({ tipo: "ok", readableId: "SP-0009" });
    const formulario = montarFormulario();
    // Sem confirmação no meio: a pergunta escondida estava vazia quando o gatilho mudou.
    renderizar(formulario);
    preencherObrigatorios();
    fireEvent.click(screen.getByRole("button", { name: "Enviar solicitação" }));
    await waitFor(() => expect(enviarSubmissaoMock).toHaveBeenCalledTimes(1));
    const pedido = enviarSubmissaoMock.mock.calls[0]![0];
    expect(Object.keys(pedido.answers)).not.toContain("q_cpf");
    expect(pedido.answers["q_cnpj"]).toBe("12345678000199");
  });

  it("(o) a ajuda é a da pergunta", () => {
    renderizar();
    abrirEEscolher("Forma de pagamento", "Chave Pix");
    expect(screen.getByText("Necessário para seguir à aprovação.")).toBeTruthy();
  });
});

/** Preenche todos os campos obrigatórios do formulário-fixture com valores válidos, deixando o CTA pronto para enviar. */
function preencherObrigatorios(opcoes: { readonly valorDigitado?: string } = {}): void {
  fireEvent.change(campo("O que deve ser pago?"), { target: { value: "Pagamento de teste" } });
  fireEvent.change(campo("Nome do solicitante"), { target: { value: "Fulano de Tal" } });
  fireEvent.change(campo("WhatsApp"), { target: { value: "11999998888" } });
  abrirEEscolher("Centro de Custo", "TRIA");
  abrirEEscolher("Fornecedor", "CNPJ");
  fireEvent.change(campo("CNPJ"), { target: { value: "12345678000199" } });
  fireEvent.change(campo("Valor"), { target: { value: opcoes.valorDigitado ?? "100,00" } });
  abrirEEscolher("Forma de pagamento", "Chave Pix");
  fireEvent.change(campo("Chave pix"), { target: { value: "chave@teste.com" } });
}
