// @vitest-environment jsdom
/**
 * 15-12 Task 1 (D-15-12, UCR-05) — o popup "Adicionar Canal" das Listas
 * conversacionais NÃO cria Canal: lista os Canais ativos de `plataforma.canais`
 * (`useCanais`), deixa escolher um e leva à página de conectar para criar um novo.
 * Nada vai a `/operacoes/`.
 *
 * `useCanais` é falso (os dois Canais ativos vêm do teste) e `fetch` é um espião
 * que prova que o popup, aberto e fechado, não manda nenhuma requisição.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Canal } from "@n1/dominio/crm/canais";
import { AdicionarCanalDialog } from "./adicionar-canal-dialog";
import { CanaisDeAtendimento } from "@/features/estrutura/canais-de-atendimento";

const { useCanais, podeNoCrm } = vi.hoisted(() => ({
  useCanais: vi.fn(),
  podeNoCrm: vi.fn(),
}));

vi.mock("@/dados/crm/canais", () => ({ useCanais }));
vi.mock("@/dados/crm/sessao", () => ({ usePodeNoCrm: podeNoCrm }));
vi.mock("@/dados/store", () => ({
  useData: (seletor: (data: unknown) => unknown) => seletor({ queues: [{ id: "fila_com", name: "Comercial" }], catalog: [{ id: "org_site", name: "Site", kind: "origem" }] }),
  useSession: () => ({ memberId: "mem_rafael" }),
}));

function canal(sobre: Partial<Canal>): Canal {
  return {
    id: "c1",
    nome: "Suporte do Zap",
    tipo: "whatsapp",
    provedor: "whatsapp-nao-oficial",
    identificadorExterno: "+5511977770001",
    conexao: "conectada",
    conexaoSimulada: false,
    conectadaEm: null,
    estado: "ativo",
    arquivadoEm: null,
    configuradoPor: "mem_rafael",
    filaPadraoId: null,
    proprietarioPadraoId: null,
    origemPadraoId: null,
    gruposHabilitados: false,
    criadoPor: "mem_rafael",
    criadoEm: "2026-11-01T00:00:00.000Z",
    atualizadoEm: "2026-11-01T00:00:00.000Z",
    ...sobre,
  };
}

const DOIS_CANAIS = [
  canal({ id: "c1", nome: "Suporte do Zap" }),
  canal({ id: "c2", nome: "Comercial do Zap", identificadorExterno: "+5511977770002", filaPadraoId: "fila_com" }),
];

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  useCanais.mockReset();
  useCanais.mockReturnValue({ data: { ok: true, itens: DOIS_CANAIS, total: 2 } });
  podeNoCrm.mockReset();
  podeNoCrm.mockReturnValue(undefined);
});
afterEach(() => cleanup());

describe("15-12 — o popup só escolhe", () => {
  it("(1) lista os dois Canais ativos e escolher um chama onEscolher com o id, sem nenhuma requisição", () => {
    const onEscolher = vi.fn();
    render(<AdicionarCanalDialog open onClose={vi.fn()} jaLigados={[]} onEscolher={onEscolher} />);

    expect(screen.getByText("Suporte do Zap")).toBeTruthy();
    expect(screen.getByText("Comercial do Zap")).toBeTruthy();

    fireEvent.click(screen.getByRole("radio", { name: /Comercial do Zap/ }));
    fireEvent.click(screen.getByRole("button", { name: "Marcar nesta Lista" }));

    expect(onEscolher).toHaveBeenCalledTimes(1);
    expect(onEscolher).toHaveBeenCalledWith("c2");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("(2) o botão de conectar é um link para a página de conectar", () => {
    render(<AdicionarCanalDialog open onClose={vi.fn()} jaLigados={[]} onEscolher={vi.fn()} />);

    const link = screen.getByRole("link", { name: "Conectar um Canal novo" });
    expect(link.getAttribute("href")).toBe("/crm/caixa-de-entrada/configuracoes/canais/conectar");
  });

  it("(3) borda UCR-05: fechar sem escolher não chama onEscolher nem a rede", () => {
    const onEscolher = vi.fn();
    const onClose = vi.fn();
    render(<AdicionarCanalDialog open onClose={onClose} jaLigados={[]} onEscolher={onEscolher} />);

    // Sem escolha o botão de confirmar está desligado: clicar não faz nada.
    fireEvent.click(screen.getByRole("button", { name: "Marcar nesta Lista" }));
    expect(onEscolher).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onEscolher).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("(4) borda UCR-05: um Canal já ligado à Lista não é oferecido de novo", () => {
    render(<AdicionarCanalDialog open onClose={vi.fn()} jaLigados={["c1"]} onEscolher={vi.fn()} />);

    expect(screen.queryByText("Suporte do Zap")).toBeNull();
    expect(screen.getByText("Comercial do Zap")).toBeTruthy();
  });

  it("(5) com tipo, só os Canais daquele tipo; fechado, não lê nada", () => {
    useCanais.mockReturnValue({
      data: { ok: true, itens: [...DOIS_CANAIS, canal({ id: "c3", nome: "Caixa do Suporte", tipo: "email", provedor: "email-imap-smtp", identificadorExterno: "s@x.com" })], total: 3 },
    });
    const { rerender } = render(<AdicionarCanalDialog tipo="email" open onClose={vi.fn()} jaLigados={[]} onEscolher={vi.fn()} />);
    expect(screen.getByText("Caixa do Suporte")).toBeTruthy();
    expect(screen.queryByText("Suporte do Zap")).toBeNull();

    rerender(<AdicionarCanalDialog tipo="email" open={false} onClose={vi.fn()} jaLigados={[]} onEscolher={vi.fn()} />);
    expect(useCanais).toHaveBeenLastCalledWith(expect.anything(), { pausado: true });
  });

  it("(6) sem permissão de criar Canal o link de conectar fica desligado com o motivo", () => {
    podeNoCrm.mockReturnValue("Seu Papel não conecta Canais.");
    render(<AdicionarCanalDialog open onClose={vi.fn()} jaLigados={[]} onEscolher={vi.fn()} />);

    expect(screen.queryByRole("link", { name: "Conectar um Canal novo" })).toBeNull();
    const botao = screen.getByRole("button", { name: "Conectar um Canal novo" });
    expect(botao.getAttribute("title")).toBe("Seu Papel não conecta Canais.");
  });

  it("(7) Canal desconectado e ainda não ligado aparece, mas não se escolhe", () => {
    useCanais.mockReturnValue({ data: { ok: true, itens: [canal({ id: "c9", nome: "Caído", conexao: "desconectada" })], total: 1 } });
    render(<AdicionarCanalDialog open onClose={vi.fn()} jaLigados={[]} onEscolher={vi.fn()} />);

    const opcao = screen.getByRole("radio", { name: /Caído/ });
    expect(opcao.getAttribute("aria-disabled")).toBe("true");
  });
});

describe("15-12 — a seção Canais de atendimento lê useCanais", () => {
  it("(8) mostra as contas de WhatsApp vindas de useCanais, com Setor e Origem", () => {
    render(<CanaisDeAtendimento valor={["c2"]} onChange={vi.fn()} onAdicionar={vi.fn()} />);

    // c2 está marcado, então a linha de WhatsApp já abre com as duas contas.
    expect(screen.getByRole("checkbox", { name: /Suporte do Zap/ }).getAttribute("aria-checked")).toBe("false");
    const marcado = screen.getByRole("checkbox", { name: /Comercial do Zap/ });
    expect(marcado.getAttribute("aria-checked")).toBe("true");
    expect(marcado.textContent).toContain("Setor: Comercial");
  });
});

/**
 * 5.1.2 (A) — um Canal atende em UMA Lista conversacional só. A conta que já atende em outra Lista aparece nos dois
 * pontos de escolha (o popup e a seção de contas), desligada e com o motivo; quem chama diz o motivo em `ocupadoEm`.
 */
describe("5.1.2 — a conta que já atende em outra Lista não se marca", () => {
  const MOTIVO = "O Canal “Suporte do Zap” já atende na Lista “SDR”: um Canal só atende em uma Lista conversacional.";
  const ocupadoEm = (c: Canal) => (c.id === "c1" ? MOTIVO : undefined);

  it("(9) no popup, aparece desligada com o motivo e confirmar não chama onEscolher", () => {
    const onEscolher = vi.fn();
    render(<AdicionarCanalDialog open onClose={vi.fn()} jaLigados={[]} onEscolher={onEscolher} ocupadoEm={ocupadoEm} />);

    const ocupada = screen.getByRole("radio", { name: /Suporte do Zap/ });
    expect(ocupada.getAttribute("aria-disabled")).toBe("true");
    expect(ocupada.getAttribute("title")).toBe(MOTIVO);
    expect(ocupada.textContent).toContain("Em outra Lista");
    fireEvent.click(ocupada);
    fireEvent.click(screen.getByRole("button", { name: "Marcar nesta Lista" }));
    expect(onEscolher).not.toHaveBeenCalled();

    // A outra conta segue escolhível.
    fireEvent.click(screen.getByRole("radio", { name: /Comercial do Zap/ }));
    fireEvent.click(screen.getByRole("button", { name: "Marcar nesta Lista" }));
    expect(onEscolher).toHaveBeenCalledWith("c2");
  });

  it("(10) na seção de contas, a ocupada não se marca (o clique não chama onChange) e a livre sim", () => {
    const onChange = vi.fn();
    render(<CanaisDeAtendimento valor={["c2"]} onChange={onChange} onAdicionar={vi.fn()} ocupadoEm={ocupadoEm} />);

    const ocupada = screen.getByRole("checkbox", { name: /Suporte do Zap/ });
    expect(ocupada.getAttribute("aria-disabled")).toBe("true");
    expect(ocupada.getAttribute("title")).toBe(MOTIVO);
    expect(ocupada.textContent).toContain("Em outra Lista");
    fireEvent.click(ocupada);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("(11) a conta que ESTA Lista já marcou se desmarca mesmo que o dado antigo a tenha em outra Lista também", () => {
    const onChange = vi.fn();
    render(<CanaisDeAtendimento valor={["c1", "c2"]} onChange={onChange} onAdicionar={vi.fn()} ocupadoEm={ocupadoEm} />);

    const marcada = screen.getByRole("checkbox", { name: /Suporte do Zap/ });
    expect(marcada.getAttribute("aria-checked")).toBe("true");
    expect(marcada.getAttribute("aria-disabled")).toBe("false");
    fireEvent.click(marcada);
    expect(onChange).toHaveBeenCalledWith(["c2"]);
  });
});
