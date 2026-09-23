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
import { createTask, setTaskFieldValue, setTaskTags } from "./tasks";

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
    weeklyCapacityMinutes: 40 * 60,
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

  it("(a) o catálogo da Solicitação continua com quatro Status, e nenhum se chama convertida", () => {
    const definicoes = CATALOGO_SOLICITACAO_DE_PAGAMENTO.statusSet.definitions;
    expect(definicoes).toHaveLength(4);
    expect(definicoes.map((d) => d.name)).toEqual(["para fazer", "em aprovação", "não aprovado", "aprovado"]);
    for (const proibido of ["convertida", "em revisão", "recebida", "em validação"]) {
      expect(definicoes.some((d) => d.name === proibido)).toBe(false);
    }
    // A mesma proibição do lado do estado materializado, não só do catálogo.
    const lista = s.lists.find((l) => l.id === LISTA_SOLICITACOES);
    expect(lista?.statusSet?.definitions).toHaveLength(4);
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
});
