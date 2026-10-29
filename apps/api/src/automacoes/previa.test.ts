/**
 * 10-15 — a prévia do relógio (`automacoes:previa`): por Lista candidata, por
 * onde entra, o regime, o ator, a lixeira vencida e as séries por calendário.
 * Só lê. Casos de banco contra Postgres LOCAL (`describeComBanco`); o formato
 * da tabela é puro e roda sem banco.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DataState } from "@n1/dominio";
import { buildSeed } from "@n1/dominio/seed";
import { encerrar, pool } from "../persistencia/conexao";
import { semear as semearEstadoInteiro } from "../persistencia/repositorio";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm } from "../testes/banco-crm";
import { relogioFixo } from "../testes/relogio";
import { criarSchedulerWorker } from "./scheduler-worker";
import { candidatosDaLixeira, formatarAgenda, formatarPrevia, type LinhaDaAgenda, type LinhaDaPrevia, previaDaAgenda, SEM_ATOR_NA_PREVIA, voltasRecentes } from "./previa";

const DIA_MS = 86_400_000;
const PROPRIETARIO = "mem_thiago";

/** (a) Automação por vencimento · (b) só série por calendário · (c) só lixeira. */
const LISTA_COM_AUTOMACAO = "lst_propostas";
const LISTA_SO_RECORRENCIA = "lst_revisoes";
const LISTA_SO_LIXEIRA = "lst_prospeccao";

const iso = (t: number): string => new Date(t).toISOString();

/** O Espaço do seed com as três Listas do caso montadas por cima: duas Tarefas vencidas na lixeira e uma dentro da retenção. */
function espacoDaPrevia(hoje: Date): DataState {
  const estado = buildSeed();
  const retencao = estado.workspace.trashPolicy.retentionDays;

  const molde = estado.automations.find((a) => a.id === "aut_revisao");
  const [versao] = molde?.versions ?? [];
  if (!molde || !versao) throw new Error("o seed perdeu aut_revisao");
  estado.automations.push({
    ...molde,
    id: "aut_teste_previa",
    lifecycle: "ativo",
    scopeType: "list",
    scopeId: LISTA_COM_AUTOMACAO,
    versions: [{ ...versao, state: "publicada", trigger: { kind: "condicaoTemporal", temporalPredicate: JSON.stringify({ dueDateOffsetDays: 0 }) } }],
  });

  for (const t of estado.tasks) {
    if (t.listId !== LISTA_SO_LIXEIRA) continue;
    // Só estas três ficam na lixeira da Lista: duas vencidas e uma dentro do prazo.
    if (t.id === "tsk_seed_11" || t.id === "tsk_seed_12") {
      t.lifecycle = "naLixeira";
      t.trashedAt = iso(hoje.getTime() - (retencao + 10) * DIA_MS);
    } else if (t.id === "tsk_seed_10") {
      t.lifecycle = "naLixeira";
      t.trashedAt = iso(hoje.getTime() - 3 * DIA_MS);
    } else if (t.lifecycle === "naLixeira") {
      t.lifecycle = "ativo";
      delete t.trashedAt;
    }
  }
  return estado;
}

async function gravarEspaco(workspaceId: string, estado: DataState): Promise<void> {
  const cliente = await pool().connect();
  try {
    await semearEstadoInteiro(cliente, workspaceId, estado);
  } finally {
    cliente.release();
  }
}

/** O que a prévia NÃO pode mexer: registros, agenda e a revisão do Espaço. */
async function fotografiaDoBanco(workspaceId: string): Promise<{ registros: number; agenda: number; revisao: string }> {
  const r = await pool().query<{ registros: string; agenda: string; revisao: string }>(
    `select (select count(*) from plataforma.registros where workspace_id = $1)::text as registros,
            (select count(*) from plataforma.automacao_agenda where workspace_id = $1)::text as agenda,
            (select revisao from plataforma.workspaces where workspace_id = $1)::text as revisao`,
    [workspaceId],
  );
  const linha = r.rows[0];
  if (!linha) throw new Error("fotografiaDoBanco: Espaço sem linha");
  return { registros: Number(linha.registros), agenda: Number(linha.agenda), revisao: linha.revisao };
}

function linhaDa(linhas: readonly LinhaDaPrevia[], listId: string): LinhaDaPrevia {
  const achada = linhas.find((l) => l.listId === listId);
  if (!achada) throw new Error(`a prévia não trouxe a Lista ${listId}: ${linhas.map((l) => l.listId).join(", ")}`);
  return achada;
}

describe("formatarPrevia", () => {
  const linha: LinhaDaPrevia = {
    workspaceId: "ws_x",
    listId: "lst_a",
    nomeDaLista: "Contas a pagar",
    entraPor: ["automacao", "lixeira"],
    regime: "ensaio",
    ator: "Thiago",
    lixeiraVencida: 4,
    seriesPorCalendario: 1,
  };

  it("imprime as oito colunas, a linha da Lista e a soma da lixeira vencida", () => {
    const texto = formatarPrevia([linha, { ...linha, listId: "lst_b", nomeDaLista: "Outra", entraPor: ["lixeira"], lixeiraVencida: 3, ator: SEM_ATOR_NA_PREVIA }]);
    for (const coluna of ["Espaço de Trabalho", "Lista", "Nome", "Entra por", "Regime", "Ator", "Lixeira vencida", "Séries"]) expect(texto).toContain(coluna);
    expect(texto).toContain("automação, lixeira");
    expect(texto).toContain(SEM_ATOR_NA_PREVIA);
    expect(texto).toContain("2 Lista(s) candidata(s)");
    expect(texto).toContain("7 Tarefa(s)");
  });
});

describe("formatarAgenda", () => {
  const linha: LinhaDaAgenda = {
    workspaceId: "ws_x",
    listId: "lst_a",
    nomeDaLista: "Contas a pagar",
    diaCivil: "2026-10-30",
    estado: "concluido",
    codigo: null,
    executadas: 2,
    falhadas: 0,
    puladas: 1,
  };

  it("imprime as colunas, uma linha por (Lista, dia) e o resumo de falhas e dos dois códigos de alerta", () => {
    const texto = formatarAgenda([
      linha,
      { ...linha, listId: "lst_b", nomeDaLista: "Outra", estado: "falhou", codigo: "SEM_ATOR" },
      { ...linha, listId: "lst_c", nomeDaLista: "Terceira", estado: "falhou", codigo: "RECUSA_DO_DOMINIO" },
      { ...linha, listId: "lst_d", nomeDaLista: "Quarta", estado: "concluido", codigo: "ENSAIO_PRIMEIRA_VOLTA" },
    ]);
    for (const coluna of ["Lista", "Nome", "Dia", "Estado", "Código", "Executadas", "Falhadas", "Puladas"]) expect(texto).toContain(coluna);
    expect(texto).toContain("2026-10-30");
    expect(texto).toContain("2 falhou");
    expect(texto).toContain("1 SEM_ATOR");
    expect(texto).toContain("1 RECUSA_DO_DOMINIO");
  });
});

describeComBanco("10-15 — a prévia do relógio lê produção sem escrever (EST-01)", () => {
  const hoje = new Date();
  const criados: string[] = [];

  beforeAll(async () => {
    await prepararBancoCrm();
  });

  afterAll(async () => {
    for (const workspaceId of criados) {
      await pool().query("delete from plataforma.automacao_agenda where workspace_id = $1", [workspaceId]);
      await limparEspaco(workspaceId);
    }
    await encerrar();
  });

  it("três Listas, três jeitos de entrar: automação (ensaio), só série por calendário (direto) e só lixeira vencida (contagem certa, ator com nome); nada é gravado", async () => {
    const workspaceId = novoEspacoDeTeste("previa");
    criados.push(workspaceId);
    const estado = espacoDaPrevia(hoje);
    await gravarEspaco(workspaceId, estado);
    const nomeDoProprietario = estado.members.find((m) => m.id === PROPRIETARIO)?.displayName;
    expect(nomeDoProprietario).toBeTruthy();

    const antes = await fotografiaDoBanco(workspaceId);
    const linhas = await previaDaAgenda({ workspaceId, hoje });
    const depois = await fotografiaDoBanco(workspaceId);

    expect(depois).toEqual(antes); // registros, agenda e revisão: a MESMA coisa.

    const a = linhaDa(linhas, LISTA_COM_AUTOMACAO);
    expect(a.workspaceId).toBe(workspaceId);
    expect(a.entraPor).toContain("automacao");
    expect(a.regime).toBe("ensaio");

    const b = linhaDa(linhas, LISTA_SO_RECORRENCIA);
    expect(b.entraPor).toEqual(["recorrencia"]);
    expect(b.regime).toBe("direto");
    expect(b.seriesPorCalendario).toBeGreaterThanOrEqual(1);
    expect(b.lixeiraVencida).toBe(0);

    const c = linhaDa(linhas, LISTA_SO_LIXEIRA);
    expect(c.nomeDaLista).toBe(estado.lists.find((l) => l.id === LISTA_SO_LIXEIRA)?.name);
    expect(c.entraPor).toEqual(["lixeira"]);
    expect(c.lixeiraVencida).toBe(2); // as duas vencidas; a terceira ainda está na retenção.
    expect(c.seriesPorCalendario).toBe(0);
    expect(c.regime).toBe("direto");
    expect(c.ator).toBe(nomeDoProprietario);
  });

  it("o texto impresso não contém o título de nenhuma Tarefa do Espaço (T-10-39)", async () => {
    const workspaceId = novoEspacoDeTeste("previa_titulos");
    criados.push(workspaceId);
    const estado = espacoDaPrevia(hoje);
    await gravarEspaco(workspaceId, estado);

    const texto = formatarPrevia(await previaDaAgenda({ workspaceId, hoje }));
    expect(texto).toContain("Lixeira vencida");
    const titulos = [...new Set(estado.tasks.map((t) => t.title))];
    expect(titulos.length).toBeGreaterThan(10);
    for (const titulo of titulos) expect(texto, `o título "${titulo}" vazou na prévia`).not.toContain(titulo);
  });

  it("o filtro de Espaço restringe a prévia a ele, e a Lista que já não existe no estado sai da prévia", async () => {
    const workspaceId = novoEspacoDeTeste("previa_orfa");
    const outroId = novoEspacoDeTeste("previa_outro");
    criados.push(workspaceId, outroId);
    const estado = espacoDaPrevia(hoje);
    const molde = estado.tasks.find((t) => t.id === "tsk_seed_11");
    if (!molde) throw new Error("o seed perdeu tsk_seed_11");
    estado.tasks.push({ ...molde, id: "tsk_orfa_previa", listId: "lst_que_nao_existe" });
    await gravarEspaco(workspaceId, estado);
    await gravarEspaco(outroId, espacoDaPrevia(hoje));

    // O candidato SQL existe (a Tarefa órfã está na lixeira)…
    expect((await candidatosDaLixeira(workspaceId)).map((p) => p.listId)).toContain("lst_que_nao_existe");
    // …mas a prévia, que confere com o estado, não a mostra.
    const linhas = await previaDaAgenda({ workspaceId, hoje });
    expect(linhas.some((l) => l.listId === "lst_que_nao_existe")).toBe(false);
    expect(linhas.every((l) => l.workspaceId === workspaceId)).toBe(true);
    expect(linhas.some((l) => l.listId === LISTA_SO_LIXEIRA)).toBe(true);
  });

  it("Lista que nenhum Membro ativo administra aparece com `sem ator`", async () => {
    const workspaceId = novoEspacoDeTeste("previa_sem_ator");
    criados.push(workspaceId);
    const estado = espacoDaPrevia(hoje);
    // Espaço privado e sem concessão: ninguém o alcança (mesma montagem de agenda-do-relogio.test.ts).
    const espaco = estado.spaces.find((s) => s.id === estado.lists.find((l) => l.id === LISTA_SO_LIXEIRA)?.parentId);
    if (!espaco) throw new Error("não achei o Espaço da Lista de lixeira");
    espaco.isPrivate = true;
    await gravarEspaco(workspaceId, estado);

    const linhas = await previaDaAgenda({ workspaceId, hoje });
    expect(linhaDa(linhas, LISTA_SO_LIXEIRA).ator).toBe(SEM_ATOR_NA_PREVIA);
  });

  it("10-16 — voltasRecentes: uma linha por (Lista, dia) com estado, código, contagens e o nome da Lista; só lê", async () => {
    const workspaceId = novoEspacoDeTeste("previa_agenda");
    criados.push(workspaceId);
    const estado = espacoDaPrevia(hoje);
    await gravarEspaco(workspaceId, estado);

    // O worker de verdade processa o dia de hoje das três Listas candidatas: a só de recorrência
    // (direto), a que tem Automação por vencimento (ensaio da primeira volta) e a só de lixeira (direto).
    // `semear()` olha o catálogo do Espaço inteiro (só `processarUm()` respeita `listId`), então
    // o primeiro worker semeia as três e os outros dois já a encontram semeada.
    const relogio = relogioFixo(hoje);
    const ator = async (): Promise<string> => PROPRIETARIO;
    let semeadas = 0;
    for (const [workerId, listId] of [["w_agenda_rec", LISTA_SO_RECORRENCIA], ["w_agenda_aut", LISTA_COM_AUTOMACAO], ["w_agenda_lix", LISTA_SO_LIXEIRA]] as const) {
      const worker = criarSchedulerWorker({ workerId, workspaceId, listId, relogio, resolverAtor: ator });
      semeadas += await worker.semear();
      expect(await worker.processarUm()).toBe(true);
    }
    expect(semeadas).toBeGreaterThanOrEqual(3); // o seed ainda traz outras Listas candidatas: ficam `pendente`.

    const antes = await fotografiaDoBanco(workspaceId);
    const voltas = await voltasRecentes({ workspaceId, dias: 2, hoje });
    const depois = await fotografiaDoBanco(workspaceId);
    expect(depois).toEqual(antes); // a consulta só lê: registros, agenda e revisão iguais.

    expect(voltas).toHaveLength(semeadas); // uma linha por (Lista, dia), as processadas e as ainda pendentes.
    expect(voltas.every((v) => v.workspaceId === workspaceId)).toBe(true);

    const rec = voltas.find((v) => v.listId === LISTA_SO_RECORRENCIA);
    expect(rec?.nomeDaLista).toBe(estado.lists.find((l) => l.id === LISTA_SO_RECORRENCIA)?.name);
    expect(rec?.estado).toBe("concluido");
    expect(rec?.codigo).toBeNull();
    expect(typeof rec?.executadas).toBe("number");
    expect(typeof rec?.falhadas).toBe("number");
    expect(typeof rec?.puladas).toBe("number");
    expect(rec?.diaCivil).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const aut = voltas.find((v) => v.listId === LISTA_COM_AUTOMACAO);
    expect(aut?.nomeDaLista).toBe(estado.lists.find((l) => l.id === LISTA_COM_AUTOMACAO)?.name);
    expect(aut?.estado).toBe("concluido");
    expect(aut?.codigo).toBe("ENSAIO_PRIMEIRA_VOLTA");
    expect(aut?.diaCivil).toBe(rec?.diaCivil);

    // Ordenado por Lista (e dia): a ordem do resultado é a do nome do id.
    expect(voltas.map((v) => v.listId)).toEqual([...voltas.map((v) => v.listId)].sort((a, b) => a.localeCompare(b)));

    // A Lista de lixeira também voltou, direto: sem código de ensaio.
    const lix = voltas.find((v) => v.listId === LISTA_SO_LIXEIRA);
    expect(lix?.estado).toBe("concluido");
    expect(lix?.codigo).toBeNull();

    // Uma linha antiga (3 dias atrás) fica fora da janela de 2 dias e entra na de 5.
    await pool().query(
      `insert into plataforma.automacao_agenda (workspace_id, list_id, dia_civil, estado, executadas, falhadas, puladas)
       values ($1, $2, ($3::date - 3), 'concluido', 0, 0, 0)`,
      [workspaceId, LISTA_SO_LIXEIRA, `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`],
    );
    expect(await voltasRecentes({ workspaceId, dias: 2, hoje })).toHaveLength(semeadas);
    const maisLonge = await voltasRecentes({ workspaceId, dias: 5, hoje });
    expect(maisLonge).toHaveLength(semeadas + 1);
    // Dentro da Lista, o dia mais antigo vem primeiro.
    const dasLixeira = maisLonge.filter((v) => v.listId === LISTA_SO_LIXEIRA).map((v) => v.diaCivil);
    expect(dasLixeira).toEqual([...dasLixeira].sort());
  });
});
