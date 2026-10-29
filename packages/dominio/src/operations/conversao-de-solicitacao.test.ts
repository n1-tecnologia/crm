/**
 * D3-08: a prova de que uma Solicitação aprovada vira uma Conta a pagar DENTRO
 * da plataforma — com os Campos que têm equivalente, o vencimento só no campo
 * nativo, o anexo por referência e a Automação A9 acordando sobre uma Tarefa
 * já completa.
 *
 * O bootstrap é `buildGestaoBootstrap` (a configuração do Financeiro COM as
 * sete Automações e sem Tarefas fictícias) mais
 * `evoluirConfiguracaoDeSolicitacoes`, que materializa a Lista de origem. É o
 * mesmo par de `importacao.test.ts` e de `importacao-contas-a-pagar.test.ts`.
 *
 * Dois Membros entram como fixture do arquivo, porque o bootstrap de produção
 * só tem a Maryane: o Aprovador (com a mesma concessão que o seed de fixtures
 * lhe dá — `editar` na Lista de Contas a pagar, e só nela) e a Pessoa da conta
 * (Convidada, cuja visibilidade é DERIVADA do Campo Pessoa, 03-05). Sem os
 * dois, o caso de A9 não teria o que afirmar.
 *
 * Fixtures inventadas, no molde dos fictícios de `../seed-financeiro.ts`:
 * nenhum CPF, CNPJ, chave Pix ou código de barras real entra no repositório —
 * nem sequer no formato deles.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildGestaoBootstrap } from "../bootstrap-gestao";
import { CATALOGO_SOLICITACAO_DE_PAGAMENTO, SOL } from "../solicitacao-de-pagamento";
import { evoluirConfiguracaoDeSolicitacoes, LISTA_ID as LISTA_SOLICITACOES } from "../solicitacao-de-pagamento-evolver";
import type { DataState } from "../state";
import type { FieldValue, Id, Member, Task, TaskDate } from "../types";
import {
  CAMPO_DE_VENCIMENTO_DA_SOLICITACAO,
  CAMPOS_DE_ARQUIVO,
  CAMPOS_SEM_EQUIVALENTE,
  contaAPagarDeSolicitacao,
  converterSolicitacaoEmContaAPagar,
  DE_PARA_DE_CAMPOS,
  PAPEL_DO_VINCULO,
} from "./conversao-de-solicitacao";
import { CP } from "./financeiro";
import { changeTaskStatus, createTask, listWriteRefusal, setTaskFieldValue, setTaskTags, trashTask } from "./tasks";
import { memberSeesTask } from "../derive";

const AGORA = "2026-09-23T12:00:00.000Z";
const OPERADOR: Id = "mem_maryane";
const PESSOA: Id = "mem_pessoa_da_conta";
const APROVADOR: Id = CP.aprovadorId;

const VENCIMENTO = "2026-04-10";
const TITULO = "Papelaria Aurora ME — material de escritório";
const DESCRICAO = "Material de escritório do trimestre, aprovado na reunião de março.";

/* ── Os 25 Campos da Solicitação, pelos ids literais do catálogo ────────── */
const SP = {
  centroDeCusto: "fld_sp_a_centro_de_custo" as Id,
  bu: "fld_sp_b_bu" as Id,
  empresa: "fld_sp_c_empresa" as Id,
  categoria: "fld_sp_d_categoria_de_pagamento" as Id,
  pessoa: "fld_sp_e_pessoa" as Id,
  fornecedor: "fld_sp_f_fornecedor" as Id,
  cnpj: "fld_sp_g_cnpj" as Id,
  cpf: "fld_sp_h_cpf" as Id,
  nomeFornecedor: "fld_sp_i_nome_do_fornecedor" as Id,
  anexo: "fld_sp_j_anexo" as Id,
  dataEmissao: "fld_sp_k_data_de_emissao" as Id,
  dataVencimento: "fld_sp_l_data_vencimento" as Id,
  forma: "fld_sp_m_forma_de_pagamento" as Id,
  chavePix: "fld_sp_n_chave_pix" as Id,
  codigoBarras: "fld_sp_o_codigo_de_barras" as Id,
  pixCopiaECola: "fld_sp_p_pix_copia_e_cola" as Id,
  linkDePagamento: "fld_sp_q_link_de_pagamento" as Id,
  boleto: "fld_sp_r_boleto" as Id,
  qrCode: "fld_sp_s_qr_code" as Id,
  valor: "fld_sp_t_valor" as Id,
  integracaoManual: "fld_sp_u_integracao_manual" as Id,
  equipe: "fld_sp_w_equipe" as Id,
  solicitante: "fld_sp_x_nome_do_solicitante" as Id,
  produto: "fld_sp_y_produto" as Id,
  whatsapp: "fld_sp_z_whatsapp" as Id,
} as const;

/** Ids de `WorkspaceFile` fictícios — um objeto no Storage, dois Valores de Campo. */
const ARQUIVO_NOTA: Id = "fil_nota_ficticia";
const ARQUIVO_BOLETO: Id = "fil_boleto_ficticio";
const ARQUIVO_QRCODE: Id = "fil_qrcode_ficticio";

/**
 * O que `setTaskFieldValue` não escreve na origem: os três Campos de arquivo
 * (tipo `file` não está no `switch`) e Produto (`multiSelect` com `opcoes: []`
 * — LACUNA-SP-Y). Empurrados direto em `fieldValues`, no mesmo caminho que
 * `submitForm` usa para anexo.
 */
const CAMPOS_EMPURRADOS: readonly Id[] = [SP.anexo, SP.boleto, SP.qrCode, SP.produto];

function camposBase(): Record<Id, FieldValue["value"]> {
  return {
    [SP.centroDeCusto]: "TRIA",
    [SP.bu]: "Tria Tech",
    [SP.empresa]: "Tria Company",
    [SP.categoria]: "Administrativo",
    [SP.pessoa]: PESSOA,
    [SP.fornecedor]: "CNPJ",
    [SP.cnpj]: "cnpj-ficticio-0001",
    [SP.cpf]: "cpf-ficticio-0002",
    [SP.nomeFornecedor]: "Papelaria Aurora ME",
    [SP.anexo]: [ARQUIVO_NOTA],
    [SP.dataEmissao]: "2026-03-02",
    [SP.forma]: "Boleto",
    [SP.chavePix]: "chave-pix-ficticia",
    [SP.codigoBarras]: "codigo-de-barras-ficticio",
    [SP.pixCopiaECola]: "pix-copia-e-cola-ficticio",
    [SP.boleto]: [ARQUIVO_BOLETO],
    [SP.qrCode]: [ARQUIVO_QRCODE],
    [SP.valor]: 1234.56,
    [SP.integracaoManual]: "Manual",
    [SP.solicitante]: "Maryane Generozo",
    [SP.whatsapp]: "+55 11 90000-0000",
  };
}

function membroDeFixture(id: Id, displayName: string, roleId: Id): Member {
  return {
    id,
    workspaceId: "ws_n1",
    userId: `usr_${id}`,
    displayName,
    state: "ativo",
    roleId,
    joinedAt: AGORA,
    availability: { value: "disponivel", at: AGORA, origin: "membro" },
    userMemory: { enabled: true, items: [] },
  };
}

function valorDe(task: Task, definitionId: Id): FieldValue["value"] | undefined {
  return task.fieldValues.find((v) => v.definitionId === definitionId && v.state === "ativo")?.value;
}

describe("converterSolicitacaoEmContaAPagar", () => {
  let s: DataState;

  function solicitacaoAprovada(
    overrides: {
      readonly campos?: Readonly<Record<Id, FieldValue["value"]>>;
      readonly remover?: readonly Id[];
      readonly semVencimento?: boolean;
      readonly tagIds?: readonly Id[];
      readonly semTag?: boolean;
    } = {},
  ): Task {
    const dueDate: TaskDate = { form: "civilDay", value: VENCIMENTO };
    const r = createTask(s, OPERADOR, {
      listId: LISTA_SOLICITACOES,
      title: TITULO,
      statusId: SOL.status.aprovado,
      ...(overrides.semVencimento ? {} : { dueDate }),
    });
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    const task = r.value;
    task.description = DESCRICAO;

    const campos: Record<Id, FieldValue["value"]> = { ...camposBase(), ...(overrides.campos ?? {}) };
    for (const id of overrides.remover ?? []) delete campos[id];

    for (const [definitionId, valor] of Object.entries(campos)) {
      if (CAMPOS_EMPURRADOS.includes(definitionId)) {
        task.fieldValues.push({ definitionId, value: valor, state: "ativo" });
        continue;
      }
      const f = setTaskFieldValue(s, OPERADOR, task.id, definitionId, valor);
      expect(f.ok, f.ok ? "" : `${definitionId}: ${f.error}`).toBe(true);
    }

    if (!overrides.semTag) {
      const t = setTaskTags(s, OPERADOR, task.id, overrides.tagIds ?? [SOL.tags.contaTria]);
      expect(t.ok, t.ok ? "" : t.error).toBe(true);
    }
    return task;
  }

  beforeEach(() => {
    s = buildGestaoBootstrap({ agora: AGORA });
    const evoluida = evoluirConfiguracaoDeSolicitacoes(s, OPERADOR);
    expect(evoluida.ok, evoluida.ok ? "" : evoluida.error).toBe(true);

    // Fixture de Membros: o bootstrap de produção tem só a Maryane.
    s.members.push(membroDeFixture(APROVADOR, "Marcos Paulo", "role_mem"));
    s.members.push(membroDeFixture(PESSOA, "Aurora Nogueira", "role_conv"));
    s.grants.push({
      id: "gr_fixture_aprovador",
      workspaceId: s.workspace.id,
      subjectKind: "member",
      subjectId: APROVADOR,
      action: "editar",
      resourceType: "list",
      resourceId: CP.listId,
      scope: "subarvore",
      origin: "concessaoDireta",
      grantedBy: OPERADOR,
      grantedAt: AGORA,
    });

    // Os três objetos de Storage que os Campos de arquivo referenciam.
    for (const [id, nome] of [
      [ARQUIVO_NOTA, "nota-fiscal.pdf"],
      [ARQUIVO_BOLETO, "boleto.pdf"],
      [ARQUIVO_QRCODE, "qrcode.png"],
    ] as const) {
      s.files.push({
        id,
        workspaceId: s.workspace.id,
        name: nome,
        mediaType: "document",
        sizeBytes: 1024,
        objectKey: `obj/${id}`,
        state: "enviado",
        createdBy: { kind: "member", id: OPERADOR },
        createdAt: AGORA,
      });
    }
  });

  it("(a) o catálogo da Solicitação continua sem `convertida` — D5-06 acrescentou o 5º Status `em revisão`", () => {
    const definicoes = CATALOGO_SOLICITACAO_DE_PAGAMENTO.statusSet.definitions;
    expect(definicoes).toHaveLength(5);
    expect(definicoes.map((d) => d.name)).toEqual(["para fazer", "em aprovação", "não aprovado", "aprovado", "em revisão"]);
    for (const proibido of ["convertida", "recebida", "em validação"]) {
      expect(definicoes.some((d) => d.name === proibido)).toBe(false);
    }
    // A mesma proibição do lado do estado materializado, não só do catálogo.
    const lista = s.lists.find((l) => l.id === LISTA_SOLICITACOES);
    expect(lista?.statusSet?.definitions).toHaveLength(5);
  });

  it("(b) o de-para fecha os 25 Campos: 21 pares + 3 sem equivalente + 1 vencimento nativo", () => {
    expect(DE_PARA_DE_CAMPOS).toHaveLength(21);
    expect(CAMPOS_SEM_EQUIVALENTE).toHaveLength(3);
    expect(DE_PARA_DE_CAMPOS.length + CAMPOS_SEM_EQUIVALENTE.length + 1).toBe(
      CATALOGO_SOLICITACAO_DE_PAGAMENTO.campos.length,
    );

    const origem = new Set(CATALOGO_SOLICITACAO_DE_PAGAMENTO.campos.map((c) => c.id));
    const destino = new Set<Id>(Object.values(CP.fields));
    for (const par of DE_PARA_DE_CAMPOS) {
      expect(origem.has(par.de), `origem desconhecida: ${par.de}`).toBe(true);
      expect(destino.has(par.para), `destino fora de CP.fields: ${par.para}`).toBe(true);
    }
    for (const id of CAMPOS_SEM_EQUIVALENTE) expect(origem.has(id)).toBe(true);
    expect(origem.has(CAMPO_DE_VENCIMENTO_DA_SOLICITACAO)).toBe(true);

    // Nenhum Campo citado duas vezes, de nenhum dos dois lados.
    expect(new Set(DE_PARA_DE_CAMPOS.map((p) => p.de)).size).toBe(21);
    expect(new Set(DE_PARA_DE_CAMPOS.map((p) => p.para)).size).toBe(21);
    // Os 25 da origem são exatamente pares + órfãos + vencimento, sem sobra.
    const cobertos = new Set<Id>([
      ...DE_PARA_DE_CAMPOS.map((p) => p.de),
      ...CAMPOS_SEM_EQUIVALENTE,
      CAMPO_DE_VENCIMENTO_DA_SOLICITACAO,
    ]);
    expect(cobertos.size).toBe(CATALOGO_SOLICITACAO_DE_PAGAMENTO.campos.length);
    for (const campo of CATALOGO_SOLICITACAO_DE_PAGAMENTO.campos) expect(cobertos.has(campo.id)).toBe(true);

    // Os três Campos de arquivo são pares, não órfãos.
    expect(CAMPOS_DE_ARQUIVO).toHaveLength(3);
    for (const id of CAMPOS_DE_ARQUIVO) expect(DE_PARA_DE_CAMPOS.some((p) => p.de === id)).toBe(true);
  });

  it("(c) a Solicitação aprovada vira Conta a pagar em “para pagar”, com título, descrição e os Campos do de-para", () => {
    const solicitacao = solicitacaoAprovada();
    const r = converterSolicitacaoEmContaAPagar(s, OPERADOR, solicitacao.id);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) throw new Error("unreachable");

    const conta = r.value;
    expect(conta.listId).toBe(CP.listId);
    expect(conta.statusId).toBe(CP.status.paraPagar);
    expect(conta.taskTypeId).toBe(CP.taskTypeId);
    expect(conta.assignees.map((a) => a.id)).toContain(CP.financeiroId);
    expect(conta.title).toBe(TITULO);
    expect(conta.description).toBe(DESCRICAO);

    expect(valorDe(conta, CP.fields.centroDeCusto)).toBe("TRIA");
    expect(valorDe(conta, CP.fields.bu)).toBe("Tria Tech");
    expect(valorDe(conta, CP.fields.empresa)).toBe("Tria Company");
    expect(valorDe(conta, CP.fields.categoria)).toBe("Administrativo");
    expect(valorDe(conta, CP.fields.pessoa)).toBe(PESSOA);
    expect(valorDe(conta, CP.fields.fornecedor)).toBe("CNPJ");
    expect(valorDe(conta, CP.fields.cnpj)).toBe("cnpj-ficticio-0001");
    expect(valorDe(conta, CP.fields.cpf)).toBe("cpf-ficticio-0002");
    expect(valorDe(conta, CP.fields.nomeFornecedor)).toBe("Papelaria Aurora ME");
    expect(valorDe(conta, CP.fields.dataEmissao)).toBe("2026-03-02");
    expect(valorDe(conta, CP.fields.forma)).toBe("Boleto");
    expect(valorDe(conta, CP.fields.chavePix)).toBe("chave-pix-ficticia");
    expect(valorDe(conta, CP.fields.codigoBarras)).toBe("codigo-de-barras-ficticio");
    expect(valorDe(conta, CP.fields.pixCopiaECola)).toBe("pix-copia-e-cola-ficticio");
    expect(valorDe(conta, CP.fields.valor)).toBe(1234.56);
    expect(valorDe(conta, CP.fields.integracaoManual)).toBe("Manual");
    expect(valorDe(conta, CP.fields.solicitante)).toBe("Maryane Generozo");
    expect(valorDe(conta, CP.fields.whatsapp)).toBe("+55 11 90000-0000");

    // Os 21 pares preenchidos na origem chegaram todos ao destino.
    const preenchidos = DE_PARA_DE_CAMPOS.filter((p) => valorDe(conta, p.para) !== undefined);
    expect(preenchidos).toHaveLength(21);

    // A leitura inversa acha a Conta a partir da Solicitação.
    expect(contaAPagarDeSolicitacao(s, solicitacao.id)?.id).toBe(conta.id);
  });

  it("(d) o vencimento chega só no campo nativo — nenhum Valor de Campo o duplica (D3-04)", () => {
    const solicitacao = solicitacaoAprovada({ campos: { [SP.dataVencimento]: VENCIMENTO } });
    const r = converterSolicitacaoEmContaAPagar(s, OPERADOR, solicitacao.id);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) throw new Error("unreachable");

    expect(r.value.dueDate).toEqual({ form: "civilDay", value: VENCIMENTO });
    expect(JSON.stringify(r.value.fieldValues)).not.toContain(VENCIMENTO);
  });

  it("(e) os Campos de arquivo copiam ids — nada é reenviado ao Storage", () => {
    const solicitacao = solicitacaoAprovada();
    const arquivosAntes = s.files.length;

    const r = converterSolicitacaoEmContaAPagar(s, OPERADOR, solicitacao.id);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) throw new Error("unreachable");

    expect(valorDe(r.value, CP.fields.anexo)).toEqual([ARQUIVO_NOTA]);
    expect(valorDe(r.value, CP.fields.boleto)).toEqual([ARQUIVO_BOLETO]);
    expect(valorDe(r.value, CP.fields.qrCode)).toEqual([ARQUIVO_QRCODE]);
    expect(s.files.length).toBe(arquivosAntes);

    // O Valor da origem continua apontando para o mesmo objeto: a cópia é por referência.
    const origem = s.tasks.find((t) => t.id === solicitacao.id);
    expect(valorDe(origem!, SP.anexo)).toEqual([ARQUIVO_NOTA]);
  });

  it("(f) A9 enxerga a Tarefa COMPLETA: a Pessoa do Campo entra como Observadora", () => {
    const solicitacao = solicitacaoAprovada();
    const execucoesAntes = s.automationExecutions.length;

    const r = converterSolicitacaoEmContaAPagar(s, OPERADOR, solicitacao.id);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) throw new Error("unreachable");

    expect(s.automationExecutions.length).toBeGreaterThanOrEqual(execucoesAntes + 1);
    expect(r.value.observerMemberIds).toContain(CP.financeiroId);
    expect(r.value.observerMemberIds).toContain(APROVADOR);
    // A9 só alcança a Pessoa por `fromFieldDefinitionId`, e o Campo só existe
    // depois do laço do de-para.
    expect(r.value.observerMemberIds).toContain(PESSOA);

    // A prova de que o gatilho foi ADIADO, não duplicado: A9 rodou UMA vez, e
    // sobre a Tarefa já completa. Com `runAutomations` ligado na criação, a
    // primeira volta correria antes do Campo Pessoa existir e esta contagem
    // seria 2 — a Pessoa entraria como Observadora, mas por acidente da
    // segunda volta, não por desenho.
    const deA9 = s.automationExecutions.filter((e) => e.automationId === "aut_cp_a9" && e.objectId === r.value.id);
    expect(deA9).toHaveLength(1);
  });

  it("(g) a Tag `conta *` é resolvida pelo NOME na Lista de destino, nunca por id literal", () => {
    const solicitacao = solicitacaoAprovada();
    const r = converterSolicitacaoEmContaAPagar(s, OPERADOR, solicitacao.id);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) throw new Error("unreachable");

    expect(r.value.tagIds).toHaveLength(1);
    const tagDaConta = s.tags.find((t) => t.id === r.value.tagIds[0]);
    expect(tagDaConta?.name).toBe("conta tria");
    // É a Tag do catálogo de Contas a pagar, não a da Solicitação.
    expect(r.value.tagIds[0]).not.toBe(SOL.tags.contaTria);
  });

  it("(h) o Vínculo `task→task`, a `provenance` e os dois Registros respondem de onde veio e para onde foi", () => {
    const solicitacao = solicitacaoAprovada();
    const r = converterSolicitacaoEmContaAPagar(s, OPERADOR, solicitacao.id);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    const conta = r.value;

    const vinculos = s.links.filter((l) => l.fromId === solicitacao.id && l.toId === conta.id);
    expect(vinculos).toHaveLength(1);
    expect(vinculos[0]?.fromType).toBe("task");
    expect(vinculos[0]?.toType).toBe("task");
    expect(vinculos[0]?.role).toBe(PAPEL_DO_VINCULO);
    expect(vinculos[0]?.createdBy).toEqual({ kind: "member", id: OPERADOR });

    expect(conta.provenance).toMatchObject({ kind: "task", sourceId: solicitacao.id, sourceName: TITULO });

    const naConta = s.activity.filter((a) => a.objectId === conta.id && a.action === "Conta a pagar criada por conversão");
    const naSolicitacao = s.activity.filter((a) => a.objectId === solicitacao.id && a.action === "Convertida em Conta a pagar");
    expect(naConta).toHaveLength(1);
    expect(naSolicitacao).toHaveLength(1);
    expect(naConta[0]?.detail).toContain(solicitacao.readableId ?? solicitacao.id);
    expect(naSolicitacao[0]?.detail).toContain(conta.readableId ?? conta.id);
    expect(naConta[0]?.actor).toEqual({ kind: "member", id: OPERADOR });

    // Nenhum Registro transitório da montagem sobrou na Conta.
    const transitorios = s.activity.filter(
      (a) => a.objectId === conta.id && ["Tarefa criada", "Tags alteradas"].includes(a.action),
    );
    expect(transitorios).toHaveLength(0);
    expect(s.activity.some((a) => a.objectId === conta.id && a.action.endsWith(" alterado"))).toBe(false);
  });

  /* ── As bordas onde a conversão custa dinheiro ─────────────────────────── */

  it("(i) converter duas vezes dá UMA conta só, e a segunda não queima um número de conta (T-3-11)", () => {
    const solicitacao = solicitacaoAprovada();
    const primeira = converterSolicitacaoEmContaAPagar(s, OPERADOR, solicitacao.id);
    expect(primeira.ok, primeira.ok ? "" : primeira.error).toBe(true);
    if (!primeira.ok) throw new Error("unreachable");

    const antes = {
      tasks: s.tasks.length,
      links: s.links.length,
      activity: s.activity.length,
      readable: s.workspace.taskReadableId.next,
    };

    const segunda = converterSolicitacaoEmContaAPagar(s, OPERADOR, solicitacao.id);
    expect(segunda.ok).toBe(false);
    if (segunda.ok) throw new Error("unreachable");
    expect(segunda.error).toContain(primeira.value.readableId ?? primeira.value.id);

    expect(s.tasks.length).toBe(antes.tasks);
    expect(s.links.length).toBe(antes.links);
    expect(s.activity.length).toBe(antes.activity);
    // A guarda roda ANTES de `createTask`: nenhum identificador legível é
    // consumido por uma operação que falhou.
    expect(s.workspace.taskReadableId.next).toBe(antes.readable);

    const geradas = s.tasks.filter((t) => t.listId === CP.listId && t.provenance?.sourceId === solicitacao.id);
    expect(geradas).toHaveLength(1);
  });

  it("(j) a barreira sobrevive à lixeira: a Conta apagada continua barrando a reconversão", () => {
    const solicitacao = solicitacaoAprovada();
    const primeira = converterSolicitacaoEmContaAPagar(s, OPERADOR, solicitacao.id);
    expect(primeira.ok, primeira.ok ? "" : primeira.error).toBe(true);
    if (!primeira.ok) throw new Error("unreachable");

    const lixo = trashTask(s, OPERADOR, primeira.value.id);
    expect(lixo.ok, lixo.ok ? "" : lixo.error).toBe(true);
    expect(s.tasks.find((t) => t.id === primeira.value.id)?.lifecycle).toBe("naLixeira");

    const segunda = converterSolicitacaoEmContaAPagar(s, OPERADOR, solicitacao.id);
    // Dinheiro em dobro é pior que uma conta apagada por engano.
    expect(segunda.ok).toBe(false);
    expect(contaAPagarDeSolicitacao(s, solicitacao.id)?.id).toBe(primeira.value.id);
  });

  it("(k) a Forma de pagamento que o destino não enumera vira LACUNA, não rollback", () => {
    const solicitacao = solicitacaoAprovada({ campos: { [SP.forma]: "Cartão" } });
    const antesDaConversao = s.activity.length;

    const r = converterSolicitacaoEmContaAPagar(s, OPERADOR, solicitacao.id);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) throw new Error("unreachable");

    // A conta nasce; o Campo que não cabe fica vazio, e RN-CP-02 a segura em
    // "para pagar" até alguém decidir.
    expect(valorDe(r.value, CP.fields.forma)).toBeUndefined();
    const lacunas = s.activity.filter((a) => a.objectId === r.value.id && a.action === "Lacuna de conversão");
    expect(lacunas).toHaveLength(1);
    expect(lacunas[0]?.detail).toContain("opcao_sem_equivalente");
    expect(lacunas[0]?.detail).toContain("Forma de pagamento");

    // Uma opção irrepresentável não derruba a conversão inteira: as outras 20
    // correspondências continuam preenchidas.
    const preenchidos = DE_PARA_DE_CAMPOS.filter((p) => valorDe(r.value, p.para) !== undefined);
    expect(preenchidos).toHaveLength(20);

    // Nenhum Registro produzido PELA CONVERSÃO carrega o valor — só o nome do
    // Campo (D-25). A trilha da própria Solicitação, onde o valor de fato
    // mora, é anterior e não é conversão.
    const daConversao = s.activity.slice(0, s.activity.length - antesDaConversao);
    expect(daConversao.length).toBeGreaterThan(0);
    expect(JSON.stringify(daConversao)).not.toContain("Cartão");
  });

  it("(l) Link de pagamento, Equipe e Produto viram três lacunas, cada uma com o NOME do Campo", () => {
    const solicitacao = solicitacaoAprovada({
      campos: {
        [SP.linkDePagamento]: "https://pagamento.exemplo.test/fatura/1",
        [SP.equipe]: 3,
        [SP.produto]: ["Mentoria Exemplo"],
      },
    });
    const antesDaConversao = s.activity.length;

    const r = converterSolicitacaoEmContaAPagar(s, OPERADOR, solicitacao.id);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) throw new Error("unreachable");

    const lacunas = s.activity.filter((a) => a.objectId === r.value.id && a.action === "Lacuna de conversão");
    expect(lacunas).toHaveLength(3);
    const detalhes = lacunas.map((a) => a.detail ?? "").sort();
    expect(detalhes.every((d) => d.startsWith("campo_sem_equivalente: "))).toBe(true);
    for (const nome of ["Link de pagamento", "Equipe", "Produto"]) {
      expect(detalhes.some((d) => d.endsWith(nome))).toBe(true);
    }

    // O NOME do Campo, nunca o valor.
    const daConversao = JSON.stringify(s.activity.slice(0, s.activity.length - antesDaConversao));
    expect(daConversao).not.toContain("pagamento.exemplo.test");
    expect(daConversao).not.toContain("Mentoria Exemplo");
  });

  it("(m) o que NÃO é lacuna desfaz tudo: nenhuma Conta meio montada fica no estado", () => {
    const solicitacao = solicitacaoAprovada();
    // Campo arquivado não é "a Lista não representa o valor": é recusa de
    // verdade, do outro lado da fronteira.
    const definicao = s.fieldDefinitions.find((d) => d.id === CP.fields.cnpj);
    expect(definicao).toBeDefined();
    definicao!.lifecycle = "arquivado";

    const antes = {
      tasks: s.tasks.length,
      links: s.links.length,
      activity: s.activity.length,
      readable: s.workspace.taskReadableId.next,
    };

    const r = converterSolicitacaoEmContaAPagar(s, OPERADOR, solicitacao.id);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    // A recusa cita o `definitionId`, nunca o valor (T-3-12b).
    expect(r.error).toContain(CP.fields.cnpj);
    expect(r.error).not.toContain("cnpj-ficticio-0001");

    expect(s.tasks.length).toBe(antes.tasks);
    expect(s.links.length).toBe(antes.links);
    expect(s.activity.length).toBe(antes.activity);
    expect(s.workspace.taskReadableId.next).toBe(antes.readable);
    expect(contaAPagarDeSolicitacao(s, solicitacao.id)).toBeUndefined();
  });

  it("(n) guardas de origem: Status errado, Lista errada e Tarefa inexistente não criam nada", () => {
    const emAprovacao = solicitacaoAprovada();
    const mudanca = changeTaskStatus(s, OPERADOR, emAprovacao.id, SOL.status.emAprovacao);
    expect(mudanca.ok, mudanca.ok ? "" : mudanca.error).toBe(true);

    let antes = s.tasks.length;
    const porStatus = converterSolicitacaoEmContaAPagar(s, OPERADOR, emAprovacao.id);
    expect(porStatus.ok).toBe(false);
    if (porStatus.ok) throw new Error("unreachable");
    expect(porStatus.error).toContain("em aprovação");
    expect(s.tasks.length).toBe(antes);

    // Uma Conta a pagar qualquer não é uma Solicitação.
    const outraLista = createTask(s, OPERADOR, { listId: CP.listId, title: "Conta avulsa" });
    expect(outraLista.ok, outraLista.ok ? "" : outraLista.error).toBe(true);
    if (!outraLista.ok) throw new Error("unreachable");
    antes = s.tasks.length;
    const porLista = converterSolicitacaoEmContaAPagar(s, OPERADOR, outraLista.value.id);
    expect(porLista.ok).toBe(false);
    expect(s.tasks.length).toBe(antes);

    const inexistente = converterSolicitacaoEmContaAPagar(s, OPERADOR, "tsk_que_nao_existe");
    expect(inexistente.ok).toBe(false);
    expect(s.tasks.length).toBe(antes);
  });

  it("(o) quem não enxerga a Solicitação não a converte, mesmo podendo criar em Contas a pagar (T-3-12)", () => {
    const solicitacao = solicitacaoAprovada();
    // O Aprovador alcança a Lista de Contas a pagar e SÓ ela: `listWriteRefusal`
    // o deixaria criar a Tarefa de destino.
    expect(listWriteRefusal(s, APROVADOR, CP.listId)).toBeUndefined();
    expect(memberSeesTask(s, APROVADOR, solicitacao.id)).toBe(false);

    const antes = s.tasks.length;
    const r = converterSolicitacaoEmContaAPagar(s, APROVADOR, solicitacao.id);
    expect(r.ok).toBe(false);
    expect(s.tasks.length).toBe(antes);
    // Nenhuma Grant nova: a conversão não amplia alcance de ninguém.
    expect(s.grants.filter((g) => g.subjectId === APROVADOR)).toHaveLength(1);
  });

  it("(p) sem vencimento em lugar nenhum, a Conta nasce sem `dueDate` e com a lacuna escrita", () => {
    const solicitacao = solicitacaoAprovada({ semVencimento: true });
    expect(solicitacao.dueDate).toBeUndefined();
    expect(valorDe(solicitacao, SP.dataVencimento)).toBeUndefined();

    const r = converterSolicitacaoEmContaAPagar(s, OPERADOR, solicitacao.id);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) throw new Error("unreachable");

    expect(r.value.dueDate).toBeUndefined();
    const lacunas = s.activity.filter((a) => a.objectId === r.value.id && a.action === "Lacuna de conversão");
    expect(lacunas).toHaveLength(1);
    expect(lacunas[0]?.detail).toContain("vencimento_ausente");
    expect(lacunas[0]?.detail).toContain("Data Vencimento");

    // Nenhum Valor de Campo da Conta carrega data de vencimento (D3-04).
    expect(JSON.stringify(r.value.fieldValues)).not.toContain(VENCIMENTO);
  });

  it("(q) o Vínculo responde nos dois sentidos com um `Link` só", () => {
    const solicitacao = solicitacaoAprovada();
    const r = converterSolicitacaoEmContaAPagar(s, OPERADOR, solicitacao.id);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    const conta = r.value;

    // "Qual conta veio desta solicitação?"
    const daSolicitacao = s.links.find((l) => l.fromType === "task" && l.fromId === solicitacao.id);
    expect(daSolicitacao?.toId).toBe(conta.id);

    // "De qual solicitação veio esta conta?" — o mesmo array, o mesmo Link.
    const daConta = s.links.find((l) => l.toType === "task" && l.toId === conta.id);
    expect(daConta?.fromId).toBe(solicitacao.id);
    expect(daConta?.id).toBe(daSolicitacao?.id);

    // E a inversa também está na `provenance`, para quando o Vínculo for removido.
    expect(conta.provenance?.sourceId).toBe(solicitacao.id);
  });
});
