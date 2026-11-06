/**
 * `evoluirProcessoDeProjetos`: fidelidade ao manual, idempotência e os cenários
 * da seção 8 do manual, rodados pelas operações reais (`createTask`,
 * `changeTaskStatus`, `moveTask`...), que são as mesmas que a tela chama.
 *
 * O estado de partida é `buildGestaoBootstrap()`, o mesmo de produção.
 */

import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { buildGestaoBootstrap } from "./bootstrap-gestao";
import { effectiveListConfig, memberReachesContainer } from "./derive";
import { resetIdSequence, syncIdSequence } from "./operations/activity";
import { CP } from "./operations/financeiro";
import { inviteMember } from "./operations/members";
import { instantiateTaskTemplate } from "./operations/planning";
import { createFieldDefinition, overrideStatusSet, setContainerBlock, updateFieldDefinition } from "./operations/configuration";
import { archiveContainer, createFolder, createList, createSpace } from "./operations/structure";
import { addTaskComment, changeTaskStatus, createTask, moveTask, setTaskFieldValue } from "./operations/tasks";
import { CAMPOS_COMERCIAIS, CAMPOS_COMUNS, ESPACO_DO_PROCESSO, LISTAS_DO_PROCESSO, PASTA_DO_PROCESSO } from "./processo-de-projetos-catalogo";
import {
  CRITERIOS_DE_PASSAGEM,
  evoluirProcessoDeProjetos,
  inspecionarEspacosDoProcesso,
  OPCAO_PROVISORIA_DE_CLIENTE,
  REGRAS_DE_PASSAGEM,
  TEMPLATE_DO_PROCESSO_ID,
  TRAVA_DE_PASSAGEM,
} from "./processo-de-projetos-evolver";
import type { DataState } from "./state";
import type { FieldValue, Id, Task } from "./types";

const EU = CP.financeiroId; // mem_maryane, Proprietária no bootstrap.

let state: DataState;

function aplicar(opcoes = {}): void {
  const r = evoluirProcessoDeProjetos(state, EU, opcoes);
  if (!r.ok) throw new Error(r.error);
}

const lista = (numero: string) => {
  const achada = LISTAS_DO_PROCESSO.find((l) => l.numero === numero);
  if (!achada) throw new Error(`lista ${numero}`);
  return achada;
};
const estadoId = (numero: string, nome: string): Id => {
  const definicoes = state.lists.find((l) => l.id === lista(numero).id)!.statusSet!.definitions;
  const achado = definicoes.find((d) => d.name === nome);
  if (!achado) throw new Error(`estado ${nome} na lista ${numero}`);
  return achado.id;
};
const campoId = (nome: string): Id => {
  const achado = state.fieldDefinitions.find((d) => d.name === nome && d.id.startsWith("fd_pp_"));
  if (!achado) throw new Error(`campo ${nome}`);
  return achado.id;
};
const novaDemanda = (titulo = "Demanda de teste", parentTaskId?: Id): Task => {
  const r = createTask(state, EU, { listId: lista("01").id, title: titulo, ...(parentTaskId ? { parentTaskId } : {}) });
  if (!r.ok) throw new Error(r.error);
  return r.value;
};
const preencher = (task: Task, valores: Readonly<Record<string, FieldValue["value"]>>): void => {
  for (const [nome, valor] of Object.entries(valores)) {
    const r = setTaskFieldValue(state, EU, task.id, campoId(nome), valor);
    if (!r.ok) throw new Error(`${nome}: ${r.error}`);
  }
};
const entrar = (task: Task, numero: string, nome: string) => changeTaskStatus(state, EU, task.id, estadoId(numero, nome));
const entrarOk = (task: Task, numero: string, nome: string): void => {
  const r = entrar(task, numero, nome);
  if (!r.ok) throw new Error(`${nome}: ${r.error}`);
};

/** O valor mínimo que cada tipo de Campo aceita. */
function valorDe(definitionId: Id): FieldValue["value"] {
  const d = state.fieldDefinitions.find((f) => f.id === definitionId)!;
  switch (d.type) {
    // "Sim" exigiria também o plano de migração, e este helper só cuida do incondicional.
    case "singleSelect": return d.name === "Necessita migração de dados?" ? "Não" : d.options![0]!;
    case "multiSelect": return [d.options![0]!];
    case "number":
    case "currency": return 10;
    case "person": return EU;
    case "date": return "2026-12-01";
    case "dateTime": return "2026-12-01T12:00:00.000Z";
    case "url": return "https://exemplo.test/evidencia";
    default: return `texto de ${d.name}`;
  }
}

/** Preenche o que falta para entrar no Status, sem pisar no que o cenário já decidiu. */
function preencherRequisitos(task: Task, numero: string, nomeDoStatus: string): void {
  const definicao = state.lists.find((l) => l.id === lista(numero).id)!.statusSet!.definitions.find((d) => d.name === nomeDoStatus)!;
  for (const req of definicao.entryRequirements ?? []) {
    if (!req.definitionId || req.definitionId === TRAVA_DE_PASSAGEM.id || req.whenDefinitionId) continue;
    const jaTem = task.fieldValues.some((v) => v.definitionId === req.definitionId && v.state === "ativo" && v.value !== null);
    if (jaTem) continue;
    const r = setTaskFieldValue(state, EU, task.id, req.definitionId, valorDe(req.definitionId));
    if (!r.ok) throw new Error(r.error);
  }
}

const valorAtivo = (task: Task, nome: string) => task.fieldValues.find((v) => v.definitionId === campoId(nome) && v.state === "ativo")?.value;
const valorGuardado = (task: Task, nome: string) => task.fieldValues.find((v) => v.definitionId === campoId(nome));

/** Leva a Tarefa para a primeira fase seguinte, passando o Status de saída, como o manual pede. */
function moverParaProxima(task: Task, numero: string): void {
  const aqui = lista(numero);
  const i = LISTAS_DO_PROCESSO.indexOf(aqui);
  const proxima = LISTAS_DO_PROCESSO[i + 1]!;
  const saida = aqui.estados.find((e) => e.categoria === "concluido")!.nome;
  preencherRequisitos(task, numero, saida);
  entrarOk(task, numero, saida);
  const primeiro = proxima.estados.find((e) => e.categoria === "naoIniciado")!.nome;
  const r = moveTask(state, EU, task.id, proxima.id, [{ fromStatusId: estadoId(numero, saida), toStatusId: estadoId(proxima.numero, primeiro) }]);
  if (!r.ok) throw new Error(r.error);
}

beforeEach(() => {
  resetIdSequence();
  state = buildGestaoBootstrap({ workspaceId: "ws_teste_processo" });
  syncIdSequence(state);
});

describe("fidelidade ao manual", () => {
  beforeEach(() => aplicar());

  it("a hierarquia é Espaço › Pasta › 14 Listas, na ordem, com a descrição do manual", () => {
    const espaco = state.spaces.find((s) => s.id === ESPACO_DO_PROCESSO.id)!;
    expect(espaco.name).toBe("Produto e Tecnologia");
    expect(espaco.description).toContain("Centraliza a gestão de demandas");
    const pasta = state.folders.find((f) => f.id === PASTA_DO_PROCESSO.id)!;
    expect(pasta.name).toBe("Processo de Projetos");
    expect(pasta.parentId).toBe(espaco.id);
    const listas = state.lists.filter((l) => l.parentId === pasta.id).sort((a, b) => a.order - b.order);
    expect(listas.map((l) => l.name)).toEqual([
      "01. Recebimento de demandas",
      "02. Briefing e levantamento de requisitos",
      "03. Análise de viabilidade",
      "04. Definição e aprovação do escopo",
      "05. Especificação das funcionalidades",
      "06. UX/UI e prototipação",
      "07. Validação da solução",
      "08. Planejamento técnico e das entregas",
      "09. Desenvolvimento",
      "10. Testes e qualidade",
      "11. Homologação",
      "12. Implantação",
      "13. Operação assistida",
      "14. Encerramento e transição para manutenção",
    ]);
    expect(listas.every((l) => l.description && l.description.length > 40)).toBe(true);
  });

  it("não cria subpasta nem campo homônimo: 178 Campos do manual, mais a trava", () => {
    expect(state.folders.filter((f) => f.parentId === PASTA_DO_PROCESSO.id)).toEqual([]);
    const doProcesso = state.fieldDefinitions.filter((d) => d.id.startsWith("fd_pp_"));
    expect(doProcesso).toHaveLength(12 + 8 + 158 + 1);
    expect(new Set(doProcesso.map((d) => d.name)).size).toBe(doProcesso.length);
  });

  it("cada Lista tem os estados do manual, na ordem, mais Subtarefa concluída e Cancelado", () => {
    const esperados: Readonly<Record<string, number>> = { "01": 5, "02": 8, "03": 8, "04": 6, "05": 6, "06": 7, "07": 7, "08": 7, "09": 6, "10": 6, "11": 7, "12": 8, "13": 6, "14": 5 };
    for (const l of LISTAS_DO_PROCESSO) {
      const definicoes = state.lists.find((x) => x.id === l.id)!.statusSet!.definitions;
      expect(l.estados).toHaveLength(esperados[l.numero]!);
      expect(definicoes.map((d) => d.name)).toEqual([...l.estados.map((e) => e.nome), "Subtarefa concluída", "Cancelado"]);
      // RN-ESP-05, senão a Lista nem se configura pela tela depois.
      expect(definicoes.some((d) => d.category === "naoIniciado")).toBe(true);
      expect(definicoes.some((d) => d.category === "fechado")).toBe(true);
      // A ação rápida da tabela usa o primeiro terminal: nunca pode ser Cancelado nem a da Subtarefa.
      const primeiroTerminal = definicoes.find((d) => d.category === "concluido" || d.category === "fechado")!;
      expect(["Cancelado", "Subtarefa concluída"]).not.toContain(primeiroTerminal.name);
    }
  });

  it("só Não aprovada, Inviável, Cancelado e Encerrado são `fechado`", () => {
    const fechados = new Set(state.lists.filter((l) => l.parentId === PASTA_DO_PROCESSO.id).flatMap((l) => l.statusSet!.definitions.filter((d) => d.category === "fechado").map((d) => d.name)));
    expect([...fechados].sort()).toEqual(["Cancelado", "Encerrado", "Inviável", "Não aprovada"]);
  });

  it("toda seleção tem opção válida; as opções são as do manual", () => {
    for (const d of state.fieldDefinitions.filter((f) => f.id.startsWith("fd_pp_") && (f.type === "singleSelect" || f.type === "multiSelect"))) {
      expect(d.options?.length, d.name).toBeGreaterThan(0);
      expect(new Set(d.options).size, d.name).toBe(d.options!.length);
    }
    expect(state.fieldDefinitions.find((d) => d.name === "Origem" && d.id.startsWith("fd_pp_"))!.options).toEqual(["Cliente", "Comercial", "Suporte", "Direção", "Equipe interna"]);
    expect(state.fieldDefinitions.find((d) => d.id === "fd_pp_relacao_com_receita")!.options).toEqual(["Receita direta", "Expansão de contrato", "Retenção de receita", "Sem receita associada", "A confirmar"]);
    expect(state.fieldDefinitions.find((d) => d.id === "fd_pp_cliente")!.options).toEqual([OPCAO_PROVISORIA_DE_CLIENTE]);
  });

  it("todo nome e status do manual batem com o documento em disco, quando ele está aqui", () => {
    const caminho = new URL("../../../docs/07-processos/processo-de-projetos.md", import.meta.url);
    const texto = readFileSync(caminho, "utf8");
    for (const c of [...CAMPOS_COMUNS, ...CAMPOS_COMERCIAIS, ...LISTAS_DO_PROCESSO.flatMap((l) => l.campos)]) {
      expect(texto, c.nome).toContain(`| ${c.nome} |`);
    }
    for (const l of LISTAS_DO_PROCESSO) {
      expect(texto).toContain(l.descricao);
      for (const e of l.estados) expect(texto, e.nome).toContain(`| ${e.nome} | `);
    }
  });

  it("toda regra aponta para Campo que se aplica naquela Lista, e todo Status citado existe", () => {
    for (const [numero, regras] of Object.entries(REGRAS_DE_PASSAGEM)) {
      const definicoes = state.lists.find((l) => l.id === lista(numero).id)!.statusSet!.definitions;
      const aplicaveis = new Set(effectiveListConfig(state, lista(numero).id)!.fieldDefinitionIds);
      for (const nomeDoStatus of Object.keys(regras)) {
        const definicao = definicoes.find((d) => d.name === nomeDoStatus);
        expect(definicao, `${numero} ${nomeDoStatus}`).toBeDefined();
        for (const req of definicao!.entryRequirements ?? []) {
          if (req.definitionId !== TRAVA_DE_PASSAGEM.id) expect(aplicaveis.has(req.definitionId!), `${numero} ${nomeDoStatus} ${req.definitionId}`).toBe(true);
          if (req.whenDefinitionId) expect(aplicaveis.has(req.whenDefinitionId), `${numero} ${nomeDoStatus} quando ${req.whenDefinitionId}`).toBe(true);
        }
      }
    }
  });

  it("nenhum Status usa requisito de saída: é o que deixa a Subtarefa terminar", () => {
    const definicoes = LISTAS_DO_PROCESSO.flatMap((l) => state.lists.find((x) => x.id === l.id)!.statusSet!.definitions);
    expect(definicoes.filter((d) => d.exitRequirements?.length)).toEqual([]);
  });

  it("Campos comerciais só nas Listas 01, 03 e 14; a trava em nenhuma", () => {
    for (const l of LISTAS_DO_PROCESSO) {
      const aplicaveis = effectiveListConfig(state, l.id)!.fieldDefinitionIds;
      const usa = ["01", "03", "14"].includes(l.numero);
      for (const c of CAMPOS_COMERCIAIS) expect(aplicaveis.includes(c.id), `${l.numero} ${c.nome}`).toBe(usa);
      for (const c of CAMPOS_COMUNS) expect(aplicaveis.includes(c.id), `${l.numero} ${c.nome}`).toBe(true);
      for (const c of l.campos) expect(aplicaveis.includes(c.id), `${l.numero} ${c.nome}`).toBe(true);
      expect(aplicaveis).not.toContain(TRAVA_DE_PASSAGEM.id);
    }
  });

  it("as Visualizações por Lista: Quadro abre primeiro, Tabela e Encerradas salvas", () => {
    for (const l of LISTAS_DO_PROCESSO) {
      expect(effectiveListConfig(state, l.id)!.views.inicial).toBe("quadro");
      const visoes = state.views.filter((v) => v.listId === l.id);
      expect(visoes.map((v) => v.name)).toEqual(["Quadro por status", "Tabela de configuração", "Encerradas"]);
      expect(visoes.every((v) => v.ownerKind === "container" && v.ownerId === l.id)).toBe(true);
      expect(visoes.find((v) => v.name === "Encerradas")!.filters).toEqual({ statusCategory: "fechado" });
    }
  });

  it("todo critério de passagem cobre as 14 fases, e o modelo cria a Tarefa com um checklist por fase", () => {
    expect(Object.keys(CRITERIOS_DE_PASSAGEM)).toHaveLength(14);
    const r = instantiateTaskTemplate(state, EU, TEMPLATE_DO_PROCESSO_ID, lista("01").id, "Pela tela");
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) return;
    expect(r.value.title).toBe("Pela tela");
    expect(r.value.priority).toBe("normal");
    expect(r.value.statusId).toBe(estadoId("01", "Nova demanda"));
    expect(r.value.checklists).toHaveLength(14);
    expect(state.tasks.filter((t) => t.provenance?.sourceId === TEMPLATE_DO_PROCESSO_ID)).toHaveLength(1);
  });
});

describe("aplicar de novo e recusas", () => {
  it("a segunda volta não cria nada e confere tudo", () => {
    const r1 = evoluirProcessoDeProjetos(state, EU);
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    expect(r1.value.criados.length).toBeGreaterThan(300);
    const antes = JSON.stringify({ a: state.spaces, b: state.folders, c: state.lists, d: state.fieldDefinitions, e: state.views, f: state.templates, g: state.grants });
    const atividade = state.activity.length;
    const r2 = evoluirProcessoDeProjetos(state, EU);
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    expect(r2.value.criados).toEqual([]);
    expect(r2.value.divergentes).toEqual([]);
    expect(JSON.stringify({ a: state.spaces, b: state.folders, c: state.lists, d: state.fieldDefinitions, e: state.views, f: state.templates, g: state.grants })).toBe(antes);
    expect(state.activity.length).toBe(atividade);
  });

  it("não toca Tarefa nenhuma, e deixa o resto do estado como estava", () => {
    const tarefas = JSON.stringify(state.tasks);
    const listas = state.lists.length;
    const espacos = JSON.stringify(state.spaces);
    aplicar();
    expect(JSON.stringify(state.tasks)).toBe(tarefas);
    expect(state.lists.length).toBe(listas + 14);
    expect(JSON.stringify(state.spaces.filter((s) => s.id !== ESPACO_DO_PROCESSO.id))).toBe(espacos);
  });

  it("divergência recusa e não sobrescreve", () => {
    aplicar();
    state.lists.find((l) => l.id === lista("03").id)!.name = "Viabilidade (renomeada)";
    const r = evoluirProcessoDeProjetos(state, EU);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("lst_pp_03.name");
    expect(state.lists.find((l) => l.id === lista("03").id)!.name).toBe("Viabilidade (renomeada)");
  });

  it("o que falta é recriado sem mexer no resto; opção de Cliente ajustada não é divergência", () => {
    aplicar();
    const lst = state.lists.find((l) => l.id === lista("02").id)!;
    lst.statusSet!.definitions = lst.statusSet!.definitions.filter((d) => d.name !== "Cancelado");
    // A opção provisória sai pela mesma operação da tela: ela não está em uso.
    const ajuste = updateFieldDefinition(state, EU, "fd_pp_cliente", { options: ["Cliente A"] });
    expect(ajuste.ok, ajuste.ok ? "" : ajuste.error).toBe(true);
    const r = evoluirProcessoDeProjetos(state, EU);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (r.ok) expect(r.value.criados).toEqual(["st_pp_02_cancelado"]);
    expect(state.fieldDefinitions.find((d) => d.id === "fd_pp_cliente")!.options).toEqual(["Cliente A"]);
  });

  it("recusa outro Espaço com o mesmo nome, Membro inativo e quem não administra", () => {
    state.spaces.push({ ...state.spaces[0]!, id: "spc_outro", name: "produto e tecnologia" });
    const homonimo = evoluirProcessoDeProjetos(state, EU);
    expect(homonimo.ok).toBe(false);
    state.spaces.pop();

    expect(evoluirProcessoDeProjetos(state, "mem_nao_existe").ok).toBe(false);

    const convite = inviteMember(state, EU, { email: "pessoa@teste.invalid", roleId: state.roles.find((r) => r.base === "membro")!.id });
    if (!convite.ok) throw new Error(convite.error);
    const convidado = convite.value;
    convidado.state = "ativo";
    const semAdmin = evoluirProcessoDeProjetos(state, convidado.id);
    expect(semAdmin.ok).toBe(false);
    if (!semAdmin.ok) expect(semAdmin.error).toContain("Administrador ou Proprietário");
  });

  it("recusa lista de clientes vazia ou repetida, e aceita a real", () => {
    expect(evoluirProcessoDeProjetos(state, EU, { clientes: ["  "] }).ok).toBe(false);
    expect(evoluirProcessoDeProjetos(state, EU, { clientes: ["Tria", "tria"] }).ok).toBe(false);
    aplicar({ clientes: ["Tria", "Outro"] });
    expect(state.fieldDefinitions.find((d) => d.id === "fd_pp_cliente")!.options).toEqual(["Tria", "Outro"]);
  });
});

describe("os cenários da seção 8 do manual", () => {
  beforeEach(() => aplicar());

  it("demanda externa exige Cliente; interna segue sem ele", () => {
    const externa = novaDemanda("Externa");
    preencher(externa, { Solicitante: "Ana", Origem: "Cliente", "Problema a resolver": "Relatório lento" });
    const recusa = entrar(externa, "01", "Em tramitação");
    expect(recusa.ok).toBe(false);
    if (!recusa.ok) expect(recusa.error).toContain("Cliente");

    const interna = novaDemanda("Interna");
    preencher(interna, { Solicitante: "Bruno", Origem: "Equipe interna", "Problema a resolver": "Retrabalho" });
    entrarOk(interna, "01", "Em tramitação");
  });

  it("nasce em Nova demanda, lista 01, sem impacto nem receita atribuídos", () => {
    const t = novaDemanda();
    expect(t.statusId).toBe(estadoId("01", "Nova demanda"));
    expect(t.fieldValues).toEqual([]);
  });

  const qualificavel = (t: Task, relacao: readonly string[], extra: Readonly<Record<string, FieldValue["value"]>> = {}) => {
    preencher(t, {
      Solicitante: "Ana", Origem: "Equipe interna", "Tipo de demanda": "Melhoria", "Encaminhamento da triagem": "Processo de projetos",
      "Problema a resolver": "p", "Público afetado": "p", "Frequência do problema": "Diária", "Categoria do impacto": ["Operação"], "Intensidade do impacto": "Média",
      "Justificativa do impacto": "j", "Resultado esperado": "r", "Consequência de não fazer": "c", "Relação com receita": relacao,
      "Justificativa da decisão": "j", "Decisor da fase": "Direção", "Data da decisão da fase": "2026-11-06", ...extra,
    });
  };

  it("impede qualificar com Relação com receita = A confirmar, com a frase certa", () => {
    const t = novaDemanda();
    qualificavel(t, ["A confirmar"]);
    const r = entrar(t, "01", "Qualificada");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Relação com receita diferente de “A confirmar”");
    preencher(t, { "Relação com receita": ["Sem receita associada"] });
    entrarOk(t, "01", "Qualificada");
  });

  it("receita direta exige evidência, responsável, modelo e valor; recorrência exige o valor mensal", () => {
    const direta = novaDemanda("Direta");
    qualificavel(direta, ["Receita direta"]);
    const r1 = entrar(direta, "01", "Qualificada");
    expect(r1.ok).toBe(false);
    if (r1.ok) return;
    for (const nome of ["Evidência comercial", "Responsável comercial", "Modelo de cobrança"]) expect(r1.error).toContain(nome);
    preencher(direta, { "Evidência comercial": "https://exemplo.test/proposta", "Responsável comercial": EU, "Modelo de cobrança": "Única" });
    const r2 = entrar(direta, "01", "Qualificada");
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.error).toContain("Receita única prevista");
    preencher(direta, { "Receita única prevista": 1000 });
    entrarOk(direta, "01", "Qualificada");

    const recorrente = novaDemanda("Recorrente");
    qualificavel(recorrente, ["Expansão de contrato"], { "Evidência comercial": "https://exemplo.test/c", "Responsável comercial": EU, "Modelo de cobrança": "Recorrente" });
    const r3 = entrar(recorrente, "01", "Qualificada");
    expect(r3.ok).toBe(false);
    if (!r3.ok) expect(r3.error).toContain("Receita mensal adicional prevista");
    // Zero é "confirmado como zero", não vazio: conta como preenchido.
    preencher(recorrente, { "Receita mensal adicional prevista": 0 });
    entrarOk(recorrente, "01", "Qualificada");
  });

  it("retenção exige a receita em risco, em Campo separado da receita nova", () => {
    const t = novaDemanda();
    qualificavel(t, ["Retenção de receita"], { "Evidência comercial": "https://exemplo.test/e", "Responsável comercial": EU });
    const r = entrar(t, "01", "Qualificada");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Receita mensal em risco");
    preencher(t, { "Receita mensal em risco": 500 });
    entrarOk(t, "01", "Qualificada");
    expect(valorAtivo(t, "Receita única prevista")).toBeUndefined();
    expect(valorAtivo(t, "Receita mensal adicional prevista")).toBeUndefined();
  });

  it("pedido de informação exige pergunta, quem responde e prazo, e volta à análise", () => {
    const t = novaDemanda();
    preencher(t, { Solicitante: "Ana", Origem: "Equipe interna", "Problema a resolver": "p" });
    entrarOk(t, "01", "Em tramitação");
    const r = entrar(t, "01", "Aguardando informações");
    expect(r.ok).toBe(false);
    preencher(t, { "Informação pendente": "Quantos usuários?", "Responsável pelo retorno": "Ana", "Prazo para retorno": "2026-11-10" });
    entrarOk(t, "01", "Aguardando informações");
    entrarOk(t, "01", "Em tramitação");
  });

  it("duplicada e suporte encerram com vínculo e sem motivo de rejeição; rejeição de negócio exige motivo", () => {
    const base = { "Justificativa da decisão": "j", "Decisor da fase": "Direção", "Data da decisão da fase": "2026-11-06" };

    const duplicada = novaDemanda("Duplicada");
    preencher(duplicada, { ...base, "Encaminhamento da triagem": "Duplicada" });
    const semVinculo = entrar(duplicada, "01", "Não aprovada");
    expect(semVinculo.ok).toBe(false);
    if (!semVinculo.ok) expect(semVinculo.error).toContain("Demanda original");
    preencher(duplicada, { "Demanda original": "https://exemplo.test/tarefa/1" });
    entrarOk(duplicada, "01", "Não aprovada");
    expect(valorAtivo(duplicada, "Motivo da não aprovação")).toBeUndefined();

    const suporte = novaDemanda("Suporte");
    preencher(suporte, { ...base, "Encaminhamento da triagem": "Suporte" });
    expect(entrar(suporte, "01", "Não aprovada").ok).toBe(false);
    preencher(suporte, { "Destino do encaminhamento": "https://exemplo.test/chamado/9" });
    entrarOk(suporte, "01", "Não aprovada");

    const rejeitada = novaDemanda("Rejeitada");
    preencher(rejeitada, { ...base, "Encaminhamento da triagem": "Processo de projetos" });
    const r = entrar(rejeitada, "01", "Não aprovada");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Motivo da não aprovação");
    preencher(rejeitada, { "Motivo da não aprovação": "Fora de escopo" });
    entrarOk(rejeitada, "01", "Não aprovada");
  });

  it("duplicada e suporte não passam como Qualificada", () => {
    const t = novaDemanda();
    qualificavel(t, ["Sem receita associada"], { "Encaminhamento da triagem": "Suporte" });
    const r = entrar(t, "01", "Qualificada");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Encaminhamento da triagem = Processo de projetos");
  });

  it("uma Tarefa percorre as 14 Listas: valores, comentário, Subtarefa e histórico preservados; só o estado muda", () => {
    const t = novaDemanda("Projeto completo");
    preencher(t, { Cliente: OPCAO_PROVISORIA_DE_CLIENTE });
    qualificavel(t, ["Sem receita associada"]);
    const comentario = addTaskComment(state, EU, t.id, { content: "Decisão registrada" });
    expect(comentario.ok, comentario.ok ? "" : comentario.error).toBe(true);
    const sub = novaDemanda("Subtarefa", t.id);
    entrarOk(sub, "01", "Subtarefa concluída");

    const id = t.id;
    for (const l of LISTAS_DO_PROCESSO.slice(0, -1)) {
      // Saída de fase não encerra: a Tarefa continua ativa, e sai para o estado de entrada da próxima.
      const saida = l.estados.find((e) => e.categoria === "concluido")!.nome;
      const proxima = LISTAS_DO_PROCESSO[LISTAS_DO_PROCESSO.indexOf(l) + 1]!;
      const primeiro = proxima.estados.find((e) => e.categoria === "naoIniciado")!.nome;
      preencherRequisitos(t, l.numero, saida);
      entrarOk(t, l.numero, saida);
      expect(t.lifecycle, l.nome).toBe("ativo");
      const r = moveTask(state, EU, t.id, proxima.id, [
        { fromStatusId: estadoId(l.numero, saida), toStatusId: estadoId(proxima.numero, primeiro) },
        { fromStatusId: estadoId(l.numero, "Subtarefa concluída"), toStatusId: estadoId(proxima.numero, "Subtarefa concluída") },
      ]);
      expect(r.ok, r.ok ? "" : r.error).toBe(true);
      expect(t.id).toBe(id);
      expect(t.listId).toBe(proxima.id);
      expect(t.statusId).toBe(estadoId(proxima.numero, primeiro));
      expect(sub.listId).toBe(proxima.id);
      expect(sub.statusId, "a Subtarefa pronta continua pronta").toBe(estadoId(proxima.numero, "Subtarefa concluída"));
    }

    expect(state.tasks.filter((x) => x.title === "Projeto completo")).toHaveLength(1);
    expect(t.comments.map((c) => c.content)).toContain("Decisão registrada");
    expect(state.activity.filter((a) => a.objectId === id && a.action === "Tarefa movida")).toHaveLength(13);

    // Na 14, o Campo comum continua ativo, o comercial volta ativo...
    expect(valorAtivo(t, "Cliente")).toBe(OPCAO_PROVISORIA_DE_CLIENTE);
    expect(valorAtivo(t, "Relação com receita")).toEqual(["Sem receita associada"]);
    // ...e o da fase 01 está preservado, só para leitura.
    const problema = valorGuardado(t, "Problema a resolver")!;
    expect(problema.value).toBe("p");
    expect(problema.state).toBe("arquivado");
    const recusa = setTaskFieldValue(state, EU, t.id, campoId("Problema a resolver"), "outro");
    expect(recusa.ok).toBe(false);

    preencherRequisitos(t, "14", "Encerrado");
    entrarOk(t, "14", "Encerrado");
  });

  it("ao longo do caminho, o comercial sai de vista e o valor continua guardado, e não se edita fora de 01, 03 e 14", () => {
    const t = novaDemanda();
    qualificavel(t, ["Sem receita associada"]);
    moverParaProxima(t, "01");
    expect(valorAtivo(t, "Relação com receita")).toBeUndefined();
    expect(valorGuardado(t, "Relação com receita")!.value).toEqual(["Sem receita associada"]);
    expect(setTaskFieldValue(state, EU, t.id, campoId("Relação com receita"), ["A confirmar"]).ok).toBe(false);
    moverParaProxima(t, "02");
    expect(valorAtivo(t, "Relação com receita")).toEqual(["Sem receita associada"]);
  });

  it("rejeição, pausa, cancelamento e reabertura guardam as justificativas", () => {
    const t = novaDemanda();
    preencher(t, { "Situação de execução": "Pausada" });
    qualificavel(t, ["Sem receita associada"]);
    const semMotivo = entrar(t, "01", "Qualificada");
    expect(semMotivo.ok).toBe(false);
    if (!semMotivo.ok) expect(semMotivo.error).toContain("Motivo do impedimento ou pausa");
    preencher(t, { "Motivo do impedimento ou pausa": "Aguardando orçamento", "Responsável pelo desbloqueio ou retomada": EU, "Próxima revisão do impedimento ou pausa": "2026-12-01" });
    entrarOk(t, "01", "Qualificada");

    const cancelada = novaDemanda("Cancelar");
    const recusa = entrar(cancelada, "01", "Cancelado");
    expect(recusa.ok).toBe(false);
    if (!recusa.ok) expect(recusa.error).toContain("Motivo do cancelamento");
    preencher(cancelada, { "Motivo do cancelamento": "Cliente desistiu", "Decisor da fase": "Direção", "Data da decisão da fase": "2026-11-06" });
    entrarOk(cancelada, "01", "Cancelado");
    // Reabrir: volta ao estado apropriado, o histórico e a justificativa ficam.
    entrarOk(cancelada, "01", "Nova demanda");
    expect(valorAtivo(cancelada, "Motivo do cancelamento")).toBe("Cliente desistiu");
    expect(state.activity.some((a) => a.objectId === cancelada.id && a.after === "Cancelado")).toBe(true);
  });

  it("mudança de escopo volta à viabilidade: o valor da 03 reativa e a nova versão se aprova de novo", () => {
    const t = novaDemanda();
    qualificavel(t, ["Sem receita associada"]);
    moverParaProxima(t, "01");
    moverParaProxima(t, "02");
    preencher(t, { "Parecer técnico": "Primeira versão" });
    moverParaProxima(t, "03");
    moverParaProxima(t, "04");
    const naEspecificacao = lista("05").estados[0]!.nome;
    const volta = moveTask(state, EU, t.id, lista("03").id, [{ fromStatusId: estadoId("05", naEspecificacao), toStatusId: estadoId("03", "A analisar") }]);
    expect(volta.ok, volta.ok ? "" : volta.error).toBe(true);
    expect(valorAtivo(t, "Parecer técnico")).toBe("Primeira versão");
    preencher(t, { "Parecer técnico": "Segunda versão, com o escopo novo" });
    const historico = state.activity.find((a) => a.objectId === t.id && a.action === "Parecer técnico alterado");
    expect(historico?.before).toBe("Primeira versão");
    expect(historico?.after).toBe("Segunda versão, com o escopo novo");
  });

  it("falha em teste: Alta e Crítica barram; Baixa passa só com a exceção aceita", () => {
    const t = novaDemanda();
    const r = moveTask(state, EU, t.id, lista("10").id, [{ fromStatusId: estadoId("01", "Nova demanda"), toStatusId: estadoId("10", "A testar") }]);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    preencher(t, { "Falhas identificadas": "https://exemplo.test/bug/1", "Maior severidade em aberto": "Crítica" });
    entrarOk(t, "10", "Falhas identificadas");
    entrarOk(t, "10", "Em correção");
    entrarOk(t, "10", "Em reteste");
    preencher(t, {
      "Responsável pela qualidade": EU, "Versão em teste": "1.0", "Execução dos testes": "https://exemplo.test/run", "Parecer de qualidade": "ok",
      "Decisor da fase": "Direção", "Data da decisão da fase": "2026-11-06",
    });
    const critica = entrar(t, "10", "Aprovado para homologação");
    expect(critica.ok).toBe(false);
    if (!critica.ok) expect(critica.error).toContain("Nenhuma falha crítica em aberto");
    preencher(t, { "Maior severidade em aberto": "Alta" });
    expect(entrar(t, "10", "Aprovado para homologação").ok).toBe(false);
    preencher(t, { "Maior severidade em aberto": "Baixa" });
    const semExcecao = entrar(t, "10", "Aprovado para homologação");
    expect(semExcecao.ok).toBe(false);
    if (!semExcecao.ok) expect(semExcecao.error).toContain("Pendências aceitas em qualidade");
    preencher(t, { "Pendências aceitas em qualidade": "Ícone desalinhado", "Aprovador das exceções de qualidade": EU });
    entrarOk(t, "10", "Aprovado para homologação");
  });

  it("implantação Revertida ou Parcial não vira Implantado; migração exige o plano", () => {
    const t = novaDemanda();
    const r = moveTask(state, EU, t.id, lista("12").id, [{ fromStatusId: estadoId("01", "Nova demanda"), toStatusId: estadoId("12", "A planejar") }]);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    preencherRequisitos(t, "12", "Implantado");
    preencher(t, { "Necessita migração de dados?": "Sim", "Resultado da implantação": "Revertida" });
    const semPlano = entrar(t, "12", "Implantado");
    expect(semPlano.ok).toBe(false);
    if (!semPlano.ok) {
      expect(semPlano.error).toContain("Plano de migração");
      expect(semPlano.error).toContain("está Revertida");
    }
    preencher(t, { "Plano de migração": "https://exemplo.test/migracao" });
    expect(entrar(t, "12", "Implantado").ok).toBe(false);
    preencher(t, { "Resultado da implantação": "Parcial" });
    const parcial = entrar(t, "12", "Implantado");
    expect(parcial.ok).toBe(false);
    if (!parcial.ok) expect(parcial.error).toContain("está Parcial");
    preencher(t, { "Resultado da implantação": "Publicada" });
    entrarOk(t, "12", "Implantado");
  });

  it("sem resposta do cliente não há aceite: Homologado e Encerrado exigem a evidência", () => {
    const t = novaDemanda();
    const r = moveTask(state, EU, t.id, lista("11").id, [{ fromStatusId: estadoId("01", "Nova demanda"), toStatusId: estadoId("11", "A disponibilizar") }]);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    const homologar = entrar(t, "11", "Homologado");
    expect(homologar.ok).toBe(false);
    if (!homologar.ok) expect(homologar.error).toContain("Evidência do aceite de homologação");

    const r2 = moveTask(state, EU, t.id, lista("14").id, [{ fromStatusId: estadoId("11", "A disponibilizar"), toStatusId: estadoId("14", "A encerrar") }]);
    expect(r2.ok, r2.ok ? "" : r2.error).toBe(true);
    const encerrar = entrar(t, "14", "Encerrado");
    expect(encerrar.ok).toBe(false);
    if (!encerrar.ok) expect(encerrar.error).toContain("Aceite final");
  });

  it("o Espaço é privado: quem não tem concessão nem o enxerga, o Proprietário e quem aplicou sim", () => {
    const pessoa = inviteMember(state, EU, { email: "sem-acesso@teste.invalid", roleId: state.roles.find((r) => r.base === "membro")!.id });
    if (!pessoa.ok) throw new Error(pessoa.error);
    const semAcesso = pessoa.value;
    semAcesso.state = "ativo";
    expect(state.spaces.find((s) => s.id === ESPACO_DO_PROCESSO.id)!.isPrivate).toBe(true);
    expect(memberReachesContainer(state, semAcesso.id, "space", ESPACO_DO_PROCESSO.id)).toBe(false);
    expect(memberReachesContainer(state, semAcesso.id, "list", lista("01").id)).toBe(false);
    expect(memberReachesContainer(state, EU, "list", lista("14").id)).toBe(true);
    expect(state.grants.some((g) => g.id === `grt_pp_${EU}` && g.action === "administrar" && g.scope === "subarvore")).toBe(true);
  });

  it("Subtarefa termina sem os Campos do projeto, usando o Status dela", () => {
    const t = novaDemanda();
    const sub = novaDemanda("Implementar login", t.id);
    const r = moveTask(state, EU, t.id, lista("09").id, [{ fromStatusId: estadoId("01", "Nova demanda"), toStatusId: estadoId("09", "A iniciar") }]);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    entrarOk(sub, "09", "Em desenvolvimento");
    entrarOk(sub, "09", "Em revisão de código");
    expect(entrar(sub, "09", "Pronto para testes").ok).toBe(false);
    entrarOk(sub, "09", "Subtarefa concluída");
  });
});

describe("quando já existe um Espaço com o nome do manual", () => {
  const espacoManual = (descricao?: string): Id => {
    const r = createSpace(state, EU, { name: "Produto e Tecnologia", ...(descricao ? { description: descricao } : {}) });
    if (!r.ok) throw new Error(r.error);
    return r.value.id;
  };

  it("sem o id, recusa e diz como olhar e como usar", () => {
    const id = espacoManual();
    const r = evoluirProcessoDeProjetos(state, EU);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain(id);
    expect(r.error).toContain("--inspecionar");
    expect(r.error).toContain(`--espaco=${id}`);
  });

  it("com o id, põe a Pasta privada lá dentro e não muda o Espaço nem o que havia nele", () => {
    const id = espacoManual("Descrição de quem criou");
    const lista = createList(state, EU, { name: "Lista de antes", parentType: "space", parentId: id });
    if (!lista.ok) throw new Error(lista.error);
    const tarefa = createTask(state, EU, { listId: lista.value.id, title: "Tarefa de antes" });
    if (!tarefa.ok) throw new Error(tarefa.error);
    const espacoAntes = JSON.stringify(state.spaces.find((s) => s.id === id));
    const listaAntes = JSON.stringify(lista.value);
    const tarefaAntes = JSON.stringify(tarefa.value);

    const r = evoluirProcessoDeProjetos(state, EU, { espacoExistenteId: id });
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) return;
    expect(r.value.espacoId).toBe(id);
    expect(r.value.descricaoDoEspacoPreenchida).toBe(false);
    expect(r.value.criados).not.toContain(ESPACO_DO_PROCESSO.id);

    expect(state.spaces.some((s) => s.id === ESPACO_DO_PROCESSO.id)).toBe(false);
    expect(JSON.stringify(state.spaces.find((s) => s.id === id))).toBe(espacoAntes);
    expect(JSON.stringify(state.lists.find((l) => l.id === lista.value.id))).toBe(listaAntes);
    expect(JSON.stringify(state.tasks.find((t) => t.id === tarefa.value.id))).toBe(tarefaAntes);

    const pasta = state.folders.find((f) => f.id === PASTA_DO_PROCESSO.id)!;
    expect(pasta.parentId).toBe(id);
    expect(pasta.isPrivate).toBe(true);
    expect(state.grants.find((g) => g.id === `grt_pp_${EU}`)).toMatchObject({ resourceType: "folder", resourceId: pasta.id, action: "administrar" });
  });

  it("a Pasta fica fechada para quem via o Espaço aberto, e o resto dele continua visível", () => {
    const id = espacoManual();
    const lista = createList(state, EU, { name: "Lista aberta", parentType: "space", parentId: id });
    if (!lista.ok) throw new Error(lista.error);
    aplicar({ espacoExistenteId: id });
    const convite = inviteMember(state, EU, { email: "colega@teste.invalid", roleId: state.roles.find((r) => r.base === "membro")!.id });
    if (!convite.ok) throw new Error(convite.error);
    convite.value.state = "ativo";
    const colega = convite.value.id;
    expect(memberReachesContainer(state, colega, "space", id)).toBe(true);
    expect(memberReachesContainer(state, colega, "list", lista.value.id)).toBe(true);
    expect(memberReachesContainer(state, colega, "folder", PASTA_DO_PROCESSO.id)).toBe(false);
    expect(memberReachesContainer(state, colega, "list", LISTAS_DO_PROCESSO[0]!.id)).toBe(false);
    expect(memberReachesContainer(state, EU, "list", LISTAS_DO_PROCESSO[0]!.id)).toBe(true);
  });

  it("uma Tarefa nasce e anda usando o Tipo que o Espaço já tinha, sem criar outro", () => {
    const id = espacoManual();
    const tipos = state.taskTypes.filter((t) => t.definedAtId === id).map((t) => t.id);
    aplicar({ espacoExistenteId: id });
    expect(state.taskTypes.filter((t) => t.definedAtId === id).map((t) => t.id)).toEqual(tipos);
    const t = novaDemanda();
    expect(t.taskTypeId).toBe(tipos[0]);
    preencher(t, { Solicitante: "Ana", Origem: "Equipe interna", "Problema a resolver": "p" });
    entrarOk(t, "01", "Em tramitação");
  });

  it("preenche a descrição só quando está vazia, e reaplicar com o mesmo id é no-op", () => {
    const id = espacoManual();
    const r1 = evoluirProcessoDeProjetos(state, EU, { espacoExistenteId: id });
    expect(r1.ok, r1.ok ? "" : r1.error).toBe(true);
    if (!r1.ok) return;
    expect(r1.value.descricaoDoEspacoPreenchida).toBe(true);
    expect(state.spaces.find((s) => s.id === id)!.description).toBe(ESPACO_DO_PROCESSO.descricao);
    const atividade = state.activity.length;
    const r2 = evoluirProcessoDeProjetos(state, EU, { espacoExistenteId: id });
    expect(r2.ok, r2.ok ? "" : r2.error).toBe(true);
    if (!r2.ok) return;
    expect(r2.value.criados).toEqual([]);
    expect(r2.value.descricaoDoEspacoPreenchida).toBe(false);
    expect(state.activity.length).toBe(atividade);
  });

  it("recusa id de outro Espaço, id inexistente, Espaço arquivado e bloqueio de configuração", () => {
    const naoExiste = evoluirProcessoDeProjetos(state, EU, { espacoExistenteId: "spc_nao_existe" });
    expect(naoExiste.ok).toBe(false);

    const outroNome = evoluirProcessoDeProjetos(state, EU, { espacoExistenteId: state.spaces[0]!.id });
    expect(outroNome.ok).toBe(false);
    if (!outroNome.ok) expect(outroNome.error).toContain("confira o id");

    const id = espacoManual();
    const bloqueio = setContainerBlock(state, EU, "space", id, "statusSet", true);
    if (!bloqueio.ok) throw new Error(bloqueio.error);
    const bloqueado = evoluirProcessoDeProjetos(state, EU, { espacoExistenteId: id });
    expect(bloqueado.ok).toBe(false);
    if (!bloqueado.ok) expect(bloqueado.error).toContain("statusSet");
    expect(state.folders.some((f) => f.id === PASTA_DO_PROCESSO.id)).toBe(false);

    state.spaces.find((s) => s.id === id)!.lifecycle = "arquivado";
    expect(evoluirProcessoDeProjetos(state, EU, { espacoExistenteId: id }).ok).toBe(false);
  });

  it("recusa Pasta homônima e Campo do Espaço com nome do manual; Campo de Lista vizinha não atrapalha", () => {
    const id = espacoManual();
    const pasta = createFolder(state, EU, { name: "Processo de Projetos", parentType: "space", parentId: id });
    if (!pasta.ok) throw new Error(pasta.error);
    const comPasta = evoluirProcessoDeProjetos(state, EU, { espacoExistenteId: id });
    expect(comPasta.ok).toBe(false);
    if (!comPasta.ok) expect(comPasta.error).toContain(pasta.value.id);
    pasta.value.lifecycle = "naLixeira";

    const vizinha = createList(state, EU, { name: "Vizinha", parentType: "space", parentId: id });
    if (!vizinha.ok) throw new Error(vizinha.error);
    const naVizinha = createFieldDefinition(state, EU, { name: "Cliente", type: "text", definedAtType: "list", definedAtId: vizinha.value.id });
    if (!naVizinha.ok) throw new Error(naVizinha.error);
    expect(evoluirProcessoDeProjetos(structuredClone(state), EU, { espacoExistenteId: id }).ok).toBe(true);

    const campo = createFieldDefinition(state, EU, { name: "Origem", type: "text", definedAtType: "space", definedAtId: id });
    if (!campo.ok) throw new Error(campo.error);
    const comCampo = evoluirProcessoDeProjetos(state, EU, { espacoExistenteId: id });
    expect(comCampo.ok).toBe(false);
    if (!comCampo.ok) expect(comCampo.error).toContain("Origem");
  });

  it("começo à mão em produção: Lista 01 solta no Espaço aberto; a Pasta nasce ao lado, a tarefa muda e a antiga arquiva", () => {
    // O que `--inspecionar` mostrou: Espaço aberto, com descrição, sem Campos e sem
    // concessões, com a Lista 01 direto nele, 5 Status próprios, 1 Campo e 1 Tarefa.
    const id = espacoManual("Descrição de quem criou");
    const antiga = createList(state, EU, { name: "01. Recebimento de demandas", parentType: "space", parentId: id });
    if (!antiga.ok) throw new Error(antiga.error);
    const conjunto = overrideStatusSet(state, EU, "list", antiga.value.id);
    if (!conjunto.ok) throw new Error(conjunto.error);
    const campo = createFieldDefinition(state, EU, { name: "Cliente", type: "text", definedAtType: "list", definedAtId: antiga.value.id });
    if (!campo.ok) throw new Error(campo.error);
    const tarefa = createTask(state, EU, { listId: antiga.value.id, title: "Demanda de ontem" });
    if (!tarefa.ok) throw new Error(tarefa.error);
    const valor = setTaskFieldValue(state, EU, tarefa.value.id, campo.value.id, "Cliente de ontem");
    if (!valor.ok) throw new Error(valor.error);
    const listaAntes = JSON.stringify(state.lists.find((l) => l.id === antiga.value.id));
    const tarefaAntes = JSON.stringify(tarefa.value);

    // O homônimo Lista fora da Pasta e o Campo "Cliente" dela não recusam: não estão no caminho.
    const r = evoluirProcessoDeProjetos(state, EU, { espacoExistenteId: id });
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    expect(JSON.stringify(state.lists.find((l) => l.id === antiga.value.id))).toBe(listaAntes);
    expect(JSON.stringify(state.tasks.find((t) => t.id === tarefa.value.id))).toBe(tarefaAntes);
    expect(state.lists.filter((l) => l.name === "01. Recebimento de demandas")).toHaveLength(2);

    // Mover é o gesto da tela: o Status é escolhido, o valor do Campo antigo fica preservado.
    const statusAtual = state.tasks.find((t) => t.id === tarefa.value.id)!.statusId;
    const movida = moveTask(state, EU, tarefa.value.id, lista("01").id, [{ fromStatusId: statusAtual, toStatusId: estadoId("01", "Nova demanda") }]);
    expect(movida.ok, movida.ok ? "" : movida.error).toBe(true);
    if (!movida.ok) return;
    expect(movida.value.listId).toBe(lista("01").id);
    expect(movida.value.statusId).toBe(estadoId("01", "Nova demanda"));
    expect(movida.value.fieldValues.find((v) => v.definitionId === campo.value.id)).toMatchObject({ value: "Cliente de ontem", state: "arquivado" });
    // O Cliente da Pasta é outro Campo: precisa ser preenchido de novo.
    expect(valorAtivo(movida.value, "Cliente")).toBeUndefined();

    const arquivada = archiveContainer(state, EU, "list", antiga.value.id);
    expect(arquivada.ok, arquivada.ok ? "" : arquivada.error).toBe(true);
    expect(state.lists.find((l) => l.id === lista("01").id)!.lifecycle).toBe("ativo");
  });

  it("a inspeção mostra estrutura e contagens, nunca título de Tarefa nem valor de Campo", () => {
    const id = espacoManual();
    const pasta = createFolder(state, EU, { name: "Pasta de alguém", parentType: "space", parentId: id });
    if (!pasta.ok) throw new Error(pasta.error);
    const lista = createList(state, EU, { name: "Lista de alguém", parentType: "folder", parentId: pasta.value.id });
    if (!lista.ok) throw new Error(lista.error);
    const campo = createFieldDefinition(state, EU, { name: "Campo de alguém", type: "text", definedAtType: "list", definedAtId: lista.value.id });
    if (!campo.ok) throw new Error(campo.error);
    const tarefa = createTask(state, EU, { listId: lista.value.id, title: "TITULO SIGILOSO" });
    if (!tarefa.ok) throw new Error(tarefa.error);
    const valor = setTaskFieldValue(state, EU, tarefa.value.id, campo.value.id, "VALOR SIGILOSO");
    if (!valor.ok) throw new Error(valor.error);
    const sub = createTask(state, EU, { listId: lista.value.id, title: "Sub", parentTaskId: tarefa.value.id });
    if (!sub.ok) throw new Error(sub.error);

    const [inspecionado, ...resto] = inspecionarEspacosDoProcesso(state);
    expect(resto).toEqual([]);
    expect(inspecionado).toMatchObject({ id, privado: false, temDescricao: false, bloqueios: [], campos: [], listasDiretas: [] });
    expect(inspecionado!.pastas).toHaveLength(1);
    expect(inspecionado!.pastas[0]!.nome).toBe("Pasta de alguém");
    expect(inspecionado!.pastas[0]!.listas[0]).toMatchObject({ nome: "Lista de alguém", camposProprios: 1, tarefas: 1, subtarefas: 1 });
    const texto = JSON.stringify(inspecionado);
    expect(texto).not.toContain("SIGILOSO");
  });
});
