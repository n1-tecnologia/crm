// @vitest-environment jsdom
/**
 * 14-15 Task 2 — o cartão da Tarefa conversacional, as células Contato e Canal
 * da tabela e o cartão de Reunião leem o RESUMO da api (`useResumoDaTarefa`),
 * não `contatoDaTarefa`, `canalDaTarefa`, `ultimaMensagemDaTarefa` nem
 * `negocioDaTarefa`. O estado é falso e só tem o que a leitura por ids pede
 * (`links`) e o que o cartão ainda lê dele (Tipo e responsável); a api é o hook
 * mockado. Sem resumo ainda, o cartão mostra o esqueleto; sem Contato no
 * resumo, não cai para a leitura antiga (D-01).
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { PAPEL_DO_VINCULO } from "@n1/dominio/derive-conversacional";
import type { ResumoDaTarefaConversacional } from "@n1/dominio/crm/resumo-da-tarefa";
import type { DataState } from "@n1/dominio/state";
import type { Link, Task } from "@n1/dominio/types";

const { estado, resumos } = vi.hoisted(() => ({
  estado: { atual: undefined as unknown },
  resumos: new Map<string, unknown>(),
}));

vi.mock("@/dados/store", async (original) => {
  const real = await original<typeof import("@/dados/store")>();
  return { ...real, useData: <T,>(seletor: (dados: DataState) => T): T => seletor(estado.atual as DataState) };
});

vi.mock("@/dados/crm/tarefas-conversacionais", () => ({
  useResumoDaTarefa: (taskId: string) => resumos.get(taskId),
}));

import { CartaoConversacional, dadosDoCartaoConversacional } from "./cartao-conversacional";
import { CartaoDeTarefa } from "./cartao-de-tarefa";
import { CelulaDoCanal, CelulaDoContato } from "./tabela-de-tarefas";

function task(id: string, extra: Partial<Task> = {}): Task {
  return { id, listId: "l1", title: `Tarefa ${id}`, assignees: [], taskTypeId: "tt1", tagIds: [], dependencies: [], checklists: [], priority: "semPrioridade", lifecycle: "ativo", ...extra } as unknown as Task;
}

function vinculo(taskId: string, toType: Link["toType"], toId: string, role: string): Link {
  return { id: `v_${taskId}_${toType}`, fromType: "task", fromId: taskId, toType, toId, role } as unknown as Link;
}

function definirEstado(tarefas: Task[], links: Link[]): DataState {
  const dados = {
    tasks: tarefas,
    links,
    members: [],
    taskTypes: [{ id: "tt1", name: "Reunião", icon: "calendar" }],
    workspace: { locale: { tag: "pt-BR", timeZone: "America/Sao_Paulo", currency: "BRL", firstDayOfWeek: 1 } },
  } as unknown as DataState;
  estado.atual = dados;
  return dados;
}

const RESUMO: ResumoDaTarefaConversacional = {
  taskId: "t1",
  contato: { id: "c9", nome: "Marina Alves" },
  canal: { id: "k1", nome: "Comercial", tipo: "whatsapp", provedor: "whatsapp-cloud", conexao: "conectada" },
  ultimaMensagem: { trecho: "Pode me ligar amanhã?", direcao: "recebida", criadoEm: new Date().toISOString() },
  negocio: { id: "n1", titulo: "Proposta anual", etapa: "Negociação" },
};

const acoes = { onOpen: () => undefined, onDragStart: () => undefined, onDragEnd: () => undefined };

afterEach(() => {
  cleanup();
  resumos.clear();
});

describe("dadosDoCartaoConversacional — quem é conversacional", () => {
  it("(a) a Tarefa que aponta para um Contato (por id) é conversacional, sem ler Contato do estado", () => {
    const t = task("t1");
    const dados = definirEstado([t], [vinculo("t1", "contact", "c9", PAPEL_DO_VINCULO.contato)]);
    expect(dadosDoCartaoConversacional(dados, t)?.task).toBe(t);
  });

  it("(a) sem Vínculo com Contato, não é: o quadro cai no cartão de Tarefa", () => {
    const t = task("t1");
    const dados = definirEstado([t], [vinculo("t1", "deal", "n1", PAPEL_DO_VINCULO.negocio)]);
    expect(dadosDoCartaoConversacional(dados, t)).toBeUndefined();
  });
});

describe("CartaoConversacional — o que o resumo mostra", () => {
  it("(b) mostra o nome do Contato, o Canal com o selo do provedor e o trecho da última Mensagem", () => {
    const t = task("t1");
    const dados = definirEstado([t], [vinculo("t1", "contact", "c9", PAPEL_DO_VINCULO.contato)]);
    resumos.set("t1", RESUMO);
    render(<CartaoConversacional data={dadosDoCartaoConversacional(dados, t)!} {...acoes} />);
    expect(screen.getByText("Marina Alves")).toBeTruthy();
    expect(screen.getByText("Comercial")).toBeTruthy();
    expect(screen.getByText("oficial")).toBeTruthy();
    expect(screen.getByText("Pode me ligar amanhã?")).toBeTruthy();
  });

  it("(b) o texto da Mensagem é texto, não HTML (T-14-38)", () => {
    const t = task("t1");
    const dados = definirEstado([t], [vinculo("t1", "contact", "c9", PAPEL_DO_VINCULO.contato)]);
    resumos.set("t1", { ...RESUMO, ultimaMensagem: { ...RESUMO.ultimaMensagem!, trecho: '<img src=x onerror="alert(1)">' } });
    const { container } = render(<CartaoConversacional data={dadosDoCartaoConversacional(dados, t)!} {...acoes} />);
    expect(container.querySelector("img[src='x']")).toBeNull();
    expect(screen.getByText('<img src=x onerror="alert(1)">')).toBeTruthy();
  });

  it("(c) sem resumo ainda: o esqueleto, sem nome nem Mensagem inventados", () => {
    const t = task("t1");
    const dados = definirEstado([t], [vinculo("t1", "contact", "c9", PAPEL_DO_VINCULO.contato)]);
    const { container } = render(<CartaoConversacional data={dadosDoCartaoConversacional(dados, t)!} {...acoes} />);
    expect(container.querySelector(".esqueleto")).not.toBeNull();
    expect(screen.queryByText("Sem mensagem trocada ainda.")).toBeNull();
  });

  it("(d) resumo sem Contato nem Mensagem: o que a api disse, sem voltar à leitura antiga (D-01)", () => {
    const t = task("t1");
    const dados = definirEstado([t], [vinculo("t1", "contact", "c9", PAPEL_DO_VINCULO.contato)]);
    resumos.set("t1", { taskId: "t1", contato: null, canal: null, ultimaMensagem: null, negocio: null });
    render(<CartaoConversacional data={dadosDoCartaoConversacional(dados, t)!} {...acoes} />);
    expect(screen.getByText("Contato indisponível")).toBeTruthy();
    expect(screen.getByText("Sem mensagem trocada ainda.")).toBeTruthy();
  });
});

describe("a tabela e o cartão de Reunião leem o resumo", () => {
  it("(e) as células Contato e Canal da linha vêm do resumo", () => {
    definirEstado([task("t1")], []);
    resumos.set("t1", RESUMO);
    render(
      <table>
        <tbody>
          <tr>
            <CelulaDoContato taskId="t1" />
            <CelulaDoCanal taskId="t1" />
          </tr>
        </tbody>
      </table>,
    );
    expect(screen.getByText("Marina Alves")).toBeTruthy();
    expect(screen.getByText("Comercial")).toBeTruthy();
  });

  it("(e) sem resumo, as células ficam no travessão", () => {
    definirEstado([task("t1")], []);
    render(
      <table>
        <tbody>
          <tr>
            <CelulaDoContato taskId="t1" />
            <CelulaDoCanal taskId="t1" />
          </tr>
        </tbody>
      </table>,
    );
    expect(screen.getAllByText("—")).toHaveLength(2);
  });

  it("(f) o cartão de Tarefa de uma Reunião mostra o título do Negócio do resumo", () => {
    const t = task("t1");
    const dados = definirEstado([t], [vinculo("t1", "deal", "n1", PAPEL_DO_VINCULO.negocio)]);
    resumos.set("t1", RESUMO);
    render(<CartaoDeTarefa state={dados} task={t} {...acoes} />);
    expect(screen.getByText(/Reunião · Proposta anual/)).toBeTruthy();
  });
});
