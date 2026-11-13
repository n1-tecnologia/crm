// @vitest-environment jsdom
/**
 * Sessão 7 (7.3.5) — o seletor de Mensagem de modelo do WhatsApp oficial, sozinho (sem Caixa, sem diálogo, sem rede):
 *
 *   - `escolhaDe`: o pedido pronto só quando o domínio (`validarVariaveis`) o aceita; senão o motivo na frase do domínio, e a
 *     prévia deixa `{{n}}` onde a variável ainda está vazia;
 *   - `SeletorDeModelo`: lista só o que recebe, pré-preenche `{{1}}` com o primeiro nome, devolve a escolha a cada mudança,
 *     reinicia as variáveis ao trocar de modelo, mostra a recusa da api junto do campo a que ela aponta e trata o texto do
 *     modelo como texto (nunca como HTML);
 *   - `useEscolhaDeModelo`: o "por quê" do botão desligado (carregando, sem modelo, falta escolher), a escolha presa à chave
 *     do par e a lista que a recusa `JANELA_EXPIRADA` traz quando a leitura dos modelos falhou.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import type { ModeloNaLista } from "@n1/dominio/crm/modelos";
import { ErroDeApi } from "@/dados/crm/cliente-crm";
import {
  escolhaDe,
  FRASE_ESCOLHA_O_MODELO,
  FRASE_SEM_MODELO_ENVIAVEL,
  SEM_ESCOLHA,
  SeletorDeModelo,
  useEscolhaDeModelo,
  type EscolhaDeModelo,
} from "@/features/crm/seletor-de-modelo";

/** O que `useModelosEnviaveis` devolve nos testes do hook; o seletor em si não lê rede. */
const { lidos } = vi.hoisted(() => ({
  lidos: { oficial: true, enviaveis: [] as unknown[], carregando: false },
}));

vi.mock("@/dados/crm/modelos", () => ({
  useModelosEnviaveis: () => lidos,
}));

function modelo(id: string, sobre: Partial<ModeloNaLista> = {}): ModeloNaLista {
  return {
    id,
    canalId: "ck_oficial",
    idNoProvedor: `meta_${id}`,
    nome: `modelo_${id}`,
    idioma: "pt_BR",
    categoria: "utilidade",
    estado: "aprovado",
    motivoDeRejeicao: null,
    componentes: [{ type: "BODY", text: "Olá {{1}}, seu pedido {{2}} saiu." }],
    quantidadeDeVariaveis: 2,
    sincronizadoEm: "2026-11-13T12:00:00.000Z",
    enviavel: true,
    motivoDeNaoEnviavel: null,
    ...sobre,
  };
}

const COM_DUAS = modelo("a");
const SEM_VARIAVEL = modelo("b", { nome: "aviso_geral", quantidadeDeVariaveis: 0, componentes: [{ type: "BODY", text: "Estamos de recesso." }] });
const COM_UMA = modelo("c", {
  nome: "lembrete",
  categoria: "marketing",
  quantidadeDeVariaveis: 1,
  componentes: [{ type: "BODY", text: "Oi {{1}}, tudo bem?" }],
});

beforeEach(() => {
  lidos.oficial = true;
  lidos.enviaveis = [];
  lidos.carregando = false;
});

afterEach(() => {
  cleanup();
});

describe("escolhaDe", () => {
  it("sem modelo: é o estado de quem ainda não escolheu nada", () => {
    expect(escolhaDe(undefined, [])).toBe(SEM_ESCOLHA);
    expect(SEM_ESCOLHA).toEqual({ pedido: undefined, motivo: FRASE_ESCOLHA_O_MODELO, texto: "" });
  });

  it("com as variáveis certas: o pedido pronto, com os valores aparados, e o texto que o Contato recebe (cabeçalho, corpo e rodapé)", () => {
    const completo = modelo("d", {
      componentes: [
        { type: "HEADER", format: "TEXT", text: "Seu pedido" },
        { type: "BODY", text: "Olá {{1}}, seu pedido {{2}} saiu." },
        { type: "FOOTER", text: "Escola N1" },
        { type: "BUTTONS", buttons: [{ type: "QUICK_REPLY", text: "Ok" }] },
      ],
    });
    const escolha = escolhaDe(completo, [" Helena ", " 99 "]);
    expect(escolha.motivo).toBeUndefined();
    expect(escolha.pedido).toEqual({ modeloId: "d", variaveis: ["Helena", "99"] });
    expect(escolha.texto).toBe("Seu pedido\n\nOlá Helena, seu pedido 99 saiu.\n\nEscola N1");
  });

  it("variável vazia: sem pedido, o motivo é a frase do domínio e a prévia deixa `{{n}}` onde falta", () => {
    const escolha = escolhaDe(COM_DUAS, ["Helena", "  "]);
    expect(escolha.pedido).toBeUndefined();
    expect(escolha.motivo).toBe("Preencha a variável {{2}} do modelo.");
    expect(escolha.texto).toBe("Olá Helena, seu pedido {{2}} saiu.");
  });

  it("quebra de linha numa variável: sem pedido, com a frase do domínio", () => {
    const escolha = escolhaDe(COM_DUAS, ["Helena", "9\n9"]);
    expect(escolha.pedido).toBeUndefined();
    expect(escolha.motivo).toBe("A variável {{2}} não pode ter quebra de linha nem tabulação.");
  });

  it("modelo sem variável: o pedido está pronto de saída, com a lista vazia", () => {
    const escolha = escolhaDe(SEM_VARIAVEL, []);
    expect(escolha.pedido).toEqual({ modeloId: "b", variaveis: [] });
    expect(escolha.texto).toBe("Estamos de recesso.");
  });
});

describe("SeletorDeModelo", () => {
  const ultima = (onChange: ReturnType<typeof vi.fn>): EscolhaDeModelo => onChange.mock.calls.at(-1)![0] as EscolhaDeModelo;
  const escolherModelo = (nome: string) => {
    fireEvent.click(screen.getByRole("combobox", { name: /Mensagem de modelo/ }));
    fireEvent.click(screen.getAllByRole("option").find((o) => o.textContent?.includes(nome)) as HTMLElement);
  };
  const campo = (n: number) => screen.getByLabelText(new RegExp(`Variável \\{\\{${n}\\}\\}`)) as HTMLInputElement;
  const previa = () => document.querySelector("[data-previa-do-modelo]");

  it("antes de escolher: só o Select, sem prévia nem campo, e nada foi devolvido", () => {
    const onChange = vi.fn();
    render(<SeletorDeModelo modelos={[COM_DUAS, SEM_VARIAVEL]} primeiroNome="Helena" onChange={onChange} />);
    expect(screen.getByRole("combobox", { name: /Mensagem de modelo/ })).toBeTruthy();
    expect(previa()).toBeNull();
    expect(screen.queryByLabelText(/Variável/)).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("lista cada modelo com o idioma e a categoria", () => {
    render(<SeletorDeModelo modelos={[COM_DUAS, COM_UMA]} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("combobox", { name: /Mensagem de modelo/ }));
    const opcoes = screen.getAllByRole("option").map((o) => o.textContent);
    expect(opcoes).toEqual(["modelo_apt_BR · utilidade", "lembretept_BR · marketing"]);
  });

  it("escolher o modelo pré-preenche `{{1}}` com o primeiro nome, deixa `{{2}}` vazia e devolve o que falta", () => {
    const onChange = vi.fn();
    render(<SeletorDeModelo modelos={[COM_DUAS]} primeiroNome="Helena" onChange={onChange} />);
    escolherModelo("modelo_a");

    expect(campo(1).value).toBe("Helena");
    expect(campo(2).value).toBe("");
    expect(screen.getByText("Já veio com o primeiro nome do Contato; troque se precisar.")).toBeTruthy();
    expect(previa()?.textContent).toBe("Olá Helena, seu pedido {{2}} saiu.");
    expect(ultima(onChange)).toMatchObject({ pedido: undefined, motivo: "Preencha a variável {{2}} do modelo." });
  });

  it("preencher a última variável devolve o pedido pronto, e a prévia mostra o texto final", () => {
    const onChange = vi.fn();
    render(<SeletorDeModelo modelos={[COM_DUAS]} primeiroNome="Helena" onChange={onChange} />);
    escolherModelo("modelo_a");
    fireEvent.change(campo(2), { target: { value: " 99 " } });

    expect(ultima(onChange).pedido).toEqual({ modeloId: "a", variaveis: ["Helena", "99"] });
    expect(ultima(onChange).motivo).toBeUndefined();
    expect(previa()?.textContent).toBe("Olá Helena, seu pedido 99 saiu.");
  });

  it("apagar a variável de volta desfaz o pedido", () => {
    const onChange = vi.fn();
    render(<SeletorDeModelo modelos={[COM_DUAS]} primeiroNome="Helena" onChange={onChange} />);
    escolherModelo("modelo_a");
    fireEvent.change(campo(2), { target: { value: "99" } });
    expect(ultima(onChange).pedido).toBeDefined();
    fireEvent.change(campo(2), { target: { value: "" } });
    expect(ultima(onChange).pedido).toBeUndefined();
    expect(previa()?.textContent).toBe("Olá Helena, seu pedido {{2}} saiu.");
  });

  it("sem primeiro nome: `{{1}}` fica vazia e não há a dica do primeiro nome", () => {
    render(<SeletorDeModelo modelos={[COM_DUAS]} onChange={vi.fn()} />);
    escolherModelo("modelo_a");
    expect(campo(1).value).toBe("");
    expect(screen.queryByText(/primeiro nome do Contato/)).toBeNull();
  });

  it("trocar de modelo reinicia as variáveis: o que foi digitado no outro não vaza", () => {
    const onChange = vi.fn();
    render(<SeletorDeModelo modelos={[COM_DUAS, COM_UMA]} primeiroNome="Helena" onChange={onChange} />);
    escolherModelo("modelo_a");
    fireEvent.change(campo(1), { target: { value: "Outro nome" } });
    fireEvent.change(campo(2), { target: { value: "99" } });

    escolherModelo("lembrete");
    expect(screen.queryByLabelText(/Variável \{\{2\}\}/)).toBeNull();
    expect(campo(1).value).toBe("Helena");
    expect(previa()?.textContent).toBe("Oi Helena, tudo bem?");
    expect(ultima(onChange).pedido).toEqual({ modeloId: "c", variaveis: ["Helena"] });
  });

  it("modelo sem variável: nenhum campo, e o pedido já sai pronto ao escolher", () => {
    const onChange = vi.fn();
    render(<SeletorDeModelo modelos={[SEM_VARIAVEL]} primeiroNome="Helena" onChange={onChange} />);
    escolherModelo("aviso_geral");
    expect(screen.queryByLabelText(/Variável/)).toBeNull();
    expect(previa()?.textContent).toBe("Estamos de recesso.");
    expect(ultima(onChange).pedido).toEqual({ modeloId: "b", variaveis: [] });
  });

  it("a recusa da api no campo `variaveis` aparece uma vez, junto das variáveis; a de `modeloId`, junto do modelo", () => {
    const { rerender } = render(<SeletorDeModelo modelos={[COM_DUAS]} primeiroNome="Helena" onChange={vi.fn()} />);
    escolherModelo("modelo_a");

    rerender(<SeletorDeModelo modelos={[COM_DUAS]} primeiroNome="Helena" onChange={vi.fn()} erro={{ texto: "A variável {{2}} vai até 1024 caracteres.", campo: "variaveis" }} />);
    expect(screen.getAllByText("A variável {{2}} vai até 1024 caracteres.")).toHaveLength(1);
    expect(document.querySelector("[data-seletor-de-modelo]")?.querySelectorAll("[data-erro]")).toHaveLength(0);
    expect(screen.getByRole("alert").textContent).toBe("A variável {{2}} vai até 1024 caracteres.");

    rerender(<SeletorDeModelo modelos={[COM_DUAS]} primeiroNome="Helena" onChange={vi.fn()} erro={{ texto: "Este modelo saiu do ar.", campo: "modeloId" }} />);
    expect(screen.getAllByText("Este modelo saiu do ar.")).toHaveLength(1);
    expect(document.querySelector("[data-erro]")?.textContent).toBe("Este modelo saiu do ar.");
    expect(screen.queryByText("A variável {{2}} vai até 1024 caracteres.")).toBeNull();
  });

  it("um erro de outro campo, ou sem campo, não é desenhado aqui (quem hospeda o mostra)", () => {
    render(<SeletorDeModelo modelos={[COM_DUAS]} primeiroNome="Helena" onChange={vi.fn()} erro={{ texto: "O Canal está desconectado.", campo: undefined }} />);
    escolherModelo("modelo_a");
    expect(screen.queryByText("O Canal está desconectado.")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("disabled: o Select e os campos ficam parados com o motivo", () => {
    const { rerender } = render(<SeletorDeModelo modelos={[COM_DUAS]} primeiroNome="Helena" onChange={vi.fn()} />);
    escolherModelo("modelo_a");
    rerender(<SeletorDeModelo modelos={[COM_DUAS]} primeiroNome="Helena" onChange={vi.fn()} disabled />);
    expect((screen.getByRole("combobox", { name: /Mensagem de modelo/ }) as HTMLButtonElement).disabled).toBe(true);
    // O `TextInput` do design system desliga com `readOnly` + `aria-disabled` (o valor segue legível), e diz por quê no `title`.
    for (const n of [1, 2]) {
      expect(campo(n).readOnly).toBe(true);
      expect(campo(n).getAttribute("aria-disabled")).toBe("true");
      expect(campo(n).title).toBe("Enviando a Mensagem…");
    }
  });

  it("o texto do modelo e o que foi digitado entram como texto, nunca como HTML", () => {
    const hostil = modelo("h", {
      nome: "hostil",
      componentes: [{ type: "BODY", text: "<img src=x onerror=alert(1)> {{1}} <b>negrito</b>" }],
      quantidadeDeVariaveis: 1,
    });
    render(<SeletorDeModelo modelos={[hostil]} onChange={vi.fn()} />);
    escolherModelo("hostil");
    fireEvent.change(campo(1), { target: { value: "<script>1</script>" } });

    const caixa = previa()!;
    expect(caixa.querySelector("img, b, script")).toBeNull();
    expect(caixa.textContent).toBe("<img src=x onerror=alert(1)> <script>1</script> <b>negrito</b>");
  });
});

describe("useEscolhaDeModelo", () => {
  const canal = { id: "ck_oficial", provedor: "whatsapp-cloud" };
  const montar = (chave = "ct_1:ck_oficial:0") => renderHook(({ k }) => useEscolhaDeModelo(canal, k), { initialProps: { k: chave } });
  const pronta = (m: ModeloNaLista = COM_DUAS): EscolhaDeModelo => escolhaDe(m, ["Helena", "99"].slice(0, m.quantidadeDeVariaveis));

  it("diz se o Canal é o oficial, e passa isso adiante sem mexer", () => {
    lidos.oficial = false;
    expect(montar().result.current.oficial).toBe(false);
    lidos.oficial = true;
    expect(montar().result.current.oficial).toBe(true);
  });

  it("lendo os modelos e sem nenhum ainda: `carregando` e o motivo diz que está carregando", () => {
    lidos.carregando = true;
    const { result } = montar();
    expect(result.current.carregando).toBe(true);
    expect(result.current.motivo).toBe("Carregando as Mensagens de modelo…");
  });

  it("lida e sem nenhum enviável: o motivo manda sincronizar ou aprovar na Meta", () => {
    const { result } = montar();
    expect(result.current.carregando).toBe(false);
    expect(result.current.paraEscolher).toEqual([]);
    expect(result.current.motivo).toBe(FRASE_SEM_MODELO_ENVIAVEL);
  });

  it("com modelos e sem escolha: o motivo é escolher; com o pedido pronto, não há motivo", () => {
    lidos.enviaveis = [COM_DUAS];
    const { result } = montar();
    expect(result.current.paraEscolher).toEqual([COM_DUAS]);
    expect(result.current.motivo).toBe(FRASE_ESCOLHA_O_MODELO);

    act(() => result.current.aoEscolher(pronta()));
    expect(result.current.escolha.pedido).toEqual({ modeloId: "a", variaveis: ["Helena", "99"] });
    expect(result.current.motivo).toBeUndefined();
  });

  it("escolha com variável faltando: o motivo é o do domínio", () => {
    lidos.enviaveis = [COM_DUAS];
    const { result } = montar();
    act(() => result.current.aoEscolher(escolhaDe(COM_DUAS, ["Helena", ""])));
    expect(result.current.motivo).toBe("Preencha a variável {{2}} do modelo.");
  });

  it("a escolha é do par: com outra chave ela é descartada, e volta se a chave volta", () => {
    lidos.enviaveis = [COM_DUAS];
    const { result, rerender } = montar("ct_1:ck_oficial:0");
    act(() => result.current.aoEscolher(pronta()));
    expect(result.current.escolha.pedido).toBeDefined();

    rerender({ k: "ct_1:ck_oficial:1" });
    expect(result.current.escolha).toBe(SEM_ESCOLHA);
    expect(result.current.motivo).toBe(FRASE_ESCOLHA_O_MODELO);

    rerender({ k: "ct_1:ck_oficial:0" });
    expect(result.current.escolha.pedido).toBeDefined();
  });

  it("a recusa JANELA_EXPIRADA traz os modelos e vale quando a leitura não trouxe nenhum", () => {
    const { result } = montar();
    expect(result.current.paraEscolher).toEqual([]);
    act(() => result.current.aprenderDaRecusa(new ErroDeApi(409, "Fora da janela", { codigo: "JANELA_EXPIRADA", modelos: [COM_UMA] })));
    expect(result.current.paraEscolher).toEqual([COM_UMA]);
    expect(result.current.motivo).toBe(FRASE_ESCOLHA_O_MODELO);
  });

  it("os modelos lidos vencem os da recusa; e a recusa de outra chave não vale", () => {
    lidos.enviaveis = [COM_DUAS];
    const lido = montar();
    act(() => lido.result.current.aprenderDaRecusa(new ErroDeApi(409, "Fora da janela", { codigo: "JANELA_EXPIRADA", modelos: [COM_UMA] })));
    expect(lido.result.current.paraEscolher).toEqual([COM_DUAS]);

    lidos.enviaveis = [];
    const { result, rerender } = montar("ct_1:ck_oficial:0");
    act(() => result.current.aprenderDaRecusa(new ErroDeApi(409, "Fora da janela", { codigo: "JANELA_EXPIRADA", modelos: [COM_UMA] })));
    expect(result.current.paraEscolher).toEqual([COM_UMA]);
    rerender({ k: "ct_2:ck_oficial:0" });
    expect(result.current.paraEscolher).toEqual([]);
  });

  it("só a JANELA_EXPIRADA com modelos ensina: outro código, lista vazia ou erro qualquer não mudam nada", () => {
    const { result } = montar();
    act(() => {
      result.current.aprenderDaRecusa(new ErroDeApi(409, "Outro", { codigo: "MODELO_INDISPONIVEL", modelos: [COM_UMA] }));
      result.current.aprenderDaRecusa(new ErroDeApi(409, "Fora da janela", { codigo: "JANELA_EXPIRADA", modelos: [] }));
      result.current.aprenderDaRecusa(new ErroDeApi(409, "Fora da janela", { codigo: "JANELA_EXPIRADA" }));
      result.current.aprenderDaRecusa(new Error("rede"));
      result.current.aprenderDaRecusa(undefined);
    });
    expect(result.current.paraEscolher).toEqual([]);
    expect(result.current.motivo).toBe(FRASE_SEM_MODELO_ENVIAVEL);
  });
});
