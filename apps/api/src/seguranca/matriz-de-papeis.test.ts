/**
 * A matriz Papel × família de rota (Fase 9, 1.8, D-14 camada 1): o que o
 * Convidado, o Membro, o Administrador e o Membro suspenso fazem, por HTTP e
 * contra Postgres de verdade, em uma rota representativa de cada família.
 *
 * O inventário (`inventario-de-rotas.test.ts`) prova, sem banco, que TODA rota
 * recusa sessão ausente, token recusado e suspenso na escrita. Esta matriz prova
 * o outro lado: com sessão válida, cada Papel recebe exatamente o que a regra
 * diz — status, `ok` e `codigo` de cada célula da tabela `CELULAS`.
 *
 * Só Postgres local (`describeComBanco`): nada é semeado no Supabase do `.env`.
 *
 *   docker run -d --rm --name crm-n1-pg-0912 -e POSTGRES_PASSWORD=x -p 55612:5432 postgres:16
 *   DATABASE_URL=postgres://postgres:x@localhost:55612/postgres npx vitest run src/seguranca/matriz-de-papeis.test.ts
 *
 * Positivo e negativo na mesma tabela: onde o Papel não pode, a célula diz 403;
 * onde pode, diz 200/201/202 — uma matriz só de recusas passaria também com a
 * rota quebrada. A exceção é o envio de anexo da Tarefa, cujo caminho de
 * sucesso fala com o armazenamento do Supabase (Storage) e por isso não roda
 * aqui; as células dele são só de recusa.
 *
 * LACUNAS DO DOMÍNIO (09-09-SUMMARY): `removeMember` não confere quem chama. O
 * bloco final escreve a asserção do comportamento CORRETO e a marca como falha
 * conhecida (`it.fails`); quando o domínio for consertado, o Vitest avisa que
 * a marca deve sair.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { memberSeesTask } from "@n1/dominio/derive";
import type { ClienteDeLeituras, RespostaDeLeitura } from "../automacoes/cliente-leituras-financeiro";
import { FRASE_DE_SUSPENSO } from "../plugins/autenticacao";
import { encerrar } from "../persistencia/conexao";
import { describeComBanco, prepararBancoCrm } from "../testes/banco-crm";
import {
  appDoEspaco,
  limparEspacoDeVazamento,
  montarEspacoDeVazamento,
  semearEspacoDeVazamento,
  TOKENS_DE_VAZAMENTO,
  type EspacoDeVazamento,
} from "../testes/espaco-de-vazamento";

type Papel = "convidado" | "membro" | "administrador" | "proprietario" | "suspenso";

const TOKEN_DO_PAPEL: Readonly<Record<Papel, string>> = {
  convidado: TOKENS_DE_VAZAMENTO.convidado,
  membro: TOKENS_DE_VAZAMENTO.a,
  administrador: TOKENS_DE_VAZAMENTO.administrador,
  proprietario: TOKENS_DE_VAZAMENTO.proprietario,
  suspenso: TOKENS_DE_VAZAMENTO.suspenso,
};

/** As conferências que vão além de status/ok/codigo — nomeadas, para a tabela continuar sendo dado. */
type Conferencia = "convidado-sem-agentes" | "suspenso-com-dados" | "sem-url-de-upload";

interface Celula {
  readonly familia: string;
  readonly metodo: "GET" | "POST";
  /** A url pode depender do Espaço semeado (um id de Contato, uma Tarefa). */
  readonly url: (espaco: EspacoDeVazamento, papel: Papel) => string;
  readonly corpo?: (espaco: EspacoDeVazamento, papel: Papel) => unknown;
  readonly papel: Papel;
  readonly esperado: {
    readonly status: number;
    readonly ok?: boolean;
    readonly codigo?: string;
    readonly conferencia?: Conferencia;
  };
}

/** O n-ésimo Contato ativo do seed: cada célula de `trashContact` usa o seu, e nenhuma depende da outra. */
const contatoAtivo = (espaco: EspacoDeVazamento, indice: number): string => {
  const contato = espaco.estado.contacts.filter((c) => c.lifecycle === "ativo")[indice];
  if (!contato) throw new Error(`o seed precisa de ao menos ${indice + 1} Contatos ativos`);
  return contato.id;
};

const INDICE_DO_CONTATO: Readonly<Record<Papel, number>> = { convidado: 0, membro: 1, administrador: 2, proprietario: 3, suspenso: 4 };

/** O Membro da fábrica que faz o Papel. */
const membroDoPapel = (espaco: EspacoDeVazamento, papel: Papel) =>
  ({
    convidado: espaco.membros.convidado,
    membro: espaco.membros.a,
    administrador: espaco.membros.administrador,
    proprietario: espaco.membros.proprietario,
    suspenso: espaco.membros.suspenso,
  })[papel];

/**
 * Uma Tarefa que ESTE Papel não enxerga (a de um Espaço privado, por exemplo). Quem decide é o alcance, não o
 * nome do Papel: cada um recebe a sua, e o ticket de envio tem de recusar todas do mesmo jeito.
 */
const tarefaOculta = (espaco: EspacoDeVazamento, papel: Papel): string => {
  const membro = membroDoPapel(espaco, papel);
  const tarefa = espaco.estado.tasks.find((t) => !memberSeesTask(espaco.estado, membro.id, t.id));
  if (!tarefa) throw new Error(`o seed precisa de uma Tarefa que o ${papel} não enxergue`);
  return tarefa.id;
};

const CORPO_DO_TICKET = { nome: "nota.pdf", mime: "application/pdf" };

const celulas = (linhas: readonly Celula[]): readonly Celula[] => linhas;

const CELULAS = celulas([
  // POST /operacoes/:nome — o CRM antigo, pela rota genérica. A recusa do Convidado viaja em 200 (é valor, não falha de transporte).
  { familia: "operacoes", metodo: "POST", url: () => "/operacoes/trashContact", corpo: (e, p) => ({ args: [contatoAtivo(e, INDICE_DO_CONTATO[p])] }), papel: "convidado", esperado: { status: 200, ok: false } },
  { familia: "operacoes", metodo: "POST", url: () => "/operacoes/trashContact", corpo: (e, p) => ({ args: [contatoAtivo(e, INDICE_DO_CONTATO[p])] }), papel: "membro", esperado: { status: 200, ok: true } },
  { familia: "operacoes", metodo: "POST", url: () => "/operacoes/trashContact", corpo: (e, p) => ({ args: [contatoAtivo(e, INDICE_DO_CONTATO[p])] }), papel: "administrador", esperado: { status: 200, ok: true } },
  { familia: "operacoes", metodo: "POST", url: () => "/operacoes/trashContact", corpo: (e, p) => ({ args: [contatoAtivo(e, INDICE_DO_CONTATO[p])] }), papel: "suspenso", esperado: { status: 403, ok: false } },

  // POST /contatos — o CRM novo, em REST por recurso (`podeNoCrm`).
  { familia: "crm-contatos", metodo: "POST", url: () => "/contatos", corpo: () => ({ nome: "Contato da matriz" }), papel: "convidado", esperado: { status: 403, ok: false, codigo: "PERMISSAO" } },
  { familia: "crm-contatos", metodo: "POST", url: () => "/contatos", corpo: () => ({ nome: "Contato da matriz" }), papel: "membro", esperado: { status: 201, ok: true } },
  { familia: "crm-contatos", metodo: "POST", url: () => "/contatos", corpo: () => ({ nome: "Contato da matriz" }), papel: "administrador", esperado: { status: 201, ok: true } },
  { familia: "crm-contatos", metodo: "POST", url: () => "/contatos", corpo: () => ({ nome: "Contato da matriz" }), papel: "suspenso", esperado: { status: 403, ok: false, codigo: "SUSPENSO" } },

  // POST /canais — só quem administra o Espaço conecta Canal (B35).
  { familia: "crm-canais", metodo: "POST", url: () => "/canais", corpo: () => ({ provedor: "whatsapp-nao-oficial", nome: "Canal da matriz", identificador: "+55 11 97777-1212" }), papel: "convidado", esperado: { status: 403, ok: false, codigo: "PERMISSAO" } },
  { familia: "crm-canais", metodo: "POST", url: () => "/canais", corpo: () => ({ provedor: "whatsapp-nao-oficial", nome: "Canal da matriz", identificador: "+55 11 97777-1212" }), papel: "membro", esperado: { status: 403, ok: false, codigo: "PERMISSAO" } },
  { familia: "crm-canais", metodo: "POST", url: () => "/canais", corpo: () => ({ provedor: "whatsapp-nao-oficial", nome: "Canal da matriz", identificador: "+55 11 97777-1212" }), papel: "administrador", esperado: { status: 201, ok: true } },
  { familia: "crm-canais", metodo: "POST", url: () => "/canais", corpo: () => ({ provedor: "whatsapp-nao-oficial", nome: "Canal da matriz", identificador: "+55 11 97777-1212" }), papel: "suspenso", esperado: { status: 403, ok: false, codigo: "SUSPENSO" } },

  // GET /estado — todos leem; o Convidado não recebe os Agentes do Espaço (D-02); o suspenso consulta.
  { familia: "estado", metodo: "GET", url: () => "/estado", papel: "convidado", esperado: { status: 200, conferencia: "convidado-sem-agentes" } },
  { familia: "estado", metodo: "GET", url: () => "/estado", papel: "membro", esperado: { status: 200 } },
  { familia: "estado", metodo: "GET", url: () => "/estado", papel: "administrador", esperado: { status: 200 } },
  { familia: "estado", metodo: "GET", url: () => "/estado", papel: "suspenso", esperado: { status: 200, conferencia: "suspenso-com-dados" } },

  // POST /tarefas/:taskId/anexos/ticket — numa Tarefa que o Papel não enxerga, ninguém recebe URL de envio.
  { familia: "anexos", metodo: "POST", url: (e, p) => `/tarefas/${tarefaOculta(e, p)}/anexos/ticket`, corpo: () => CORPO_DO_TICKET, papel: "convidado", esperado: { status: 403, ok: false, conferencia: "sem-url-de-upload" } },
  { familia: "anexos", metodo: "POST", url: (e, p) => `/tarefas/${tarefaOculta(e, p)}/anexos/ticket`, corpo: () => CORPO_DO_TICKET, papel: "membro", esperado: { status: 403, ok: false, conferencia: "sem-url-de-upload" } },
  { familia: "anexos", metodo: "POST", url: (e, p) => `/tarefas/${tarefaOculta(e, p)}/anexos/ticket`, corpo: () => CORPO_DO_TICKET, papel: "administrador", esperado: { status: 403, ok: false, conferencia: "sem-url-de-upload" } },
  { familia: "anexos", metodo: "POST", url: (e, p) => `/tarefas/${tarefaOculta(e, p)}/anexos/ticket`, corpo: () => CORPO_DO_TICKET, papel: "suspenso", esperado: { status: 403, ok: false, codigo: "SUSPENSO", conferencia: "sem-url-de-upload" } },

  // POST /financeiro/workflows/:key/executar — a escrita do Financeiro decide por ALCANCE à Pasta Financeiro (D4-14),
  // não por Papel: no seed só o Proprietário (e quem tem Concessão em Gestão) a alcança. A célula do Proprietário é o
  // controle positivo — sem ela, "403 para todos" passaria também com a rota quebrada.
  { familia: "financeiro", metodo: "POST", url: () => "/financeiro/workflows/tria-invoice-mark-7days/executar", corpo: () => ({}), papel: "convidado", esperado: { status: 403 } },
  { familia: "financeiro", metodo: "POST", url: () => "/financeiro/workflows/tria-invoice-mark-7days/executar", corpo: () => ({}), papel: "membro", esperado: { status: 403 } },
  { familia: "financeiro", metodo: "POST", url: () => "/financeiro/workflows/tria-invoice-mark-7days/executar", corpo: () => ({}), papel: "administrador", esperado: { status: 403 } },
  { familia: "financeiro", metodo: "POST", url: () => "/financeiro/workflows/tria-invoice-mark-7days/executar", corpo: () => ({}), papel: "proprietario", esperado: { status: 202 } },
  { familia: "financeiro", metodo: "POST", url: () => "/financeiro/workflows/tria-invoice-mark-7days/executar", corpo: () => ({}), papel: "suspenso", esperado: { status: 403, ok: false, codigo: "SUSPENSO" } },
]);

/** O cliente de escrita do Financeiro: aceita tudo, sem rede. As células que chegam até ele são as de quem tem alcance. */
function clienteDeEscritaFalso(): ClienteDeLeituras {
  const aceito = { ok: true, status: 202, corpo: {} } satisfies RespostaDeLeitura<unknown>;
  return {
    async ler<T>() {
      return aceito as unknown as RespostaDeLeitura<T>;
    },
    async enviar<T>() {
      return aceito as unknown as RespostaDeLeitura<T>;
    },
    async enviarArquivo<T>() {
      return aceito as unknown as RespostaDeLeitura<T>;
    },
  };
}

describeComBanco("matriz Papel × família de rota — HTTP contra Postgres local", () => {
  let espaco: EspacoDeVazamento;
  let app: ReturnType<typeof appDoEspaco>;

  beforeAll(async () => {
    await prepararBancoCrm();
    espaco = montarEspacoDeVazamento("matriz");
    await semearEspacoDeVazamento(espaco);
    app = appDoEspaco(espaco, { financeiro: { cliente: clienteDeEscritaFalso(), clienteDeEscrita: clienteDeEscritaFalso() } });
  });

  afterAll(async () => {
    await app?.close();
    if (espaco) await limparEspacoDeVazamento(espaco);
    await encerrar();
  });

  it.each(CELULAS.map((c) => [c.familia, c.papel, c.metodo, c] as const))("%s × %s (%s)", async (_familia, papel, _metodo, celula) => {
    const resposta = await app.inject({
      method: celula.metodo,
      url: celula.url(espaco, papel),
      headers: { authorization: `Bearer ${TOKEN_DO_PAPEL[papel]}` },
      ...(celula.corpo ? { payload: celula.corpo(espaco, papel) as object } : {}),
    });
    const contexto = `${celula.metodo} ${celula.url(espaco, papel)} como ${papel}: ${resposta.body.slice(0, 200)}`;
    expect(resposta.statusCode, contexto).toBe(celula.esperado.status);

    const corpo = resposta.json() as { ok?: boolean; codigo?: string; error?: string; uploadUrl?: string; data?: { agents?: unknown[]; members?: unknown[] } };
    if (celula.esperado.ok !== undefined) expect(corpo.ok, contexto).toBe(celula.esperado.ok);
    if (celula.esperado.codigo !== undefined) expect(corpo.codigo, contexto).toBe(celula.esperado.codigo);
    // O suspenso lê a frase do acesso suspenso, e só ele.
    if (papel === "suspenso" && celula.esperado.status === 403) expect(corpo.error, contexto).toBe(FRASE_DE_SUSPENSO);
    if (papel !== "suspenso" && celula.esperado.status === 403) expect(corpo.error ?? "", contexto).not.toBe(FRASE_DE_SUSPENSO);

    switch (celula.esperado.conferencia) {
      case "convidado-sem-agentes":
        expect(corpo.data?.agents, contexto).toEqual([]);
        break;
      case "suspenso-com-dados":
        expect((corpo.data?.members ?? []).length, contexto).toBeGreaterThan(0);
        break;
      case "sem-url-de-upload":
        expect(resposta.body, contexto).not.toContain("uploadUrl");
        break;
      case undefined:
        break;
    }
  });

  it("a matriz cobre as seis famílias e os quatro estados pedidos", () => {
    expect(new Set(CELULAS.map((c) => c.familia))).toEqual(new Set(["operacoes", "crm-contatos", "crm-canais", "estado", "anexos", "financeiro"]));
    for (const papel of ["convidado", "membro", "administrador", "suspenso"] as const) {
      expect(CELULAS.filter((c) => c.papel === papel).length, papel).toBeGreaterThanOrEqual(6);
    }
  });
});

/**
 * LACUNAS CONHECIDAS DO DOMÍNIO (09-09-SUMMARY, marcadas LACUNA em `packages/dominio/CONTEXT.md`).
 * Cada caso escreve o comportamento CORRETO e seguro. `it.fails` passa enquanto a lacuna existir e
 * FALHA no dia em que o domínio for consertado — aí a marca sai. Este plano não corrige o domínio.
 * Espaço próprio: a operação perigosa muda o estado, e a matriz acima não pode depender disso.
 */
describeComBanco("lacunas conhecidas do domínio — o comportamento seguro, marcado como falha conhecida", () => {
  let espaco: EspacoDeVazamento;
  let app: ReturnType<typeof appDoEspaco>;

  beforeAll(async () => {
    await prepararBancoCrm();
    espaco = montarEspacoDeVazamento("lacunas");
    await semearEspacoDeVazamento(espaco);
    app = appDoEspaco(espaco);
  });

  afterAll(async () => {
    await app?.close();
    if (espaco) await limparEspacoDeVazamento(espaco);
    await encerrar();
  });

  // LACUNA — ver 09-09-SUMMARY, achado 1 (grave): `removeMember` não olha quem chama.
  it.fails("removeMember: o Convidado não remove outro Membro (hoje remove, e o Sucessor é ele quem escolhe)", async () => {
    const resposta = await app.inject({
      method: "POST",
      url: "/operacoes/removeMember",
      headers: { authorization: `Bearer ${TOKENS_DE_VAZAMENTO.convidado}` },
      payload: { args: [espaco.membros.b.id, espaco.membros.a.id] },
    });
    expect(resposta.statusCode).toBe(200);
    expect((resposta.json() as { ok: boolean }).ok).toBe(false);
  });

  // LACUNA — ver 09-09-SUMMARY, achado 2 (médio): `spawnNextOccurrence` não olha quem chama nem o alcance da Tarefa.
  // Não exercida aqui: exige uma Tarefa recorrente já concluída, que o seed não tem; fica para a suíte de 09-15.
  it.todo("spawnNextOccurrence: o Convidado, e o Membro que não vê a Tarefa, não criam a próxima ocorrência (LACUNA, 09-09-SUMMARY achado 2)");

  // Conferência FRACA — ver 09-09-SUMMARY, item 3: `runLancamentoAgent` não recusa Convidado nem Membro não ativo.
  // Não exercida aqui: exige um Agente com concessão sobre uma Tarefa de lançamento; fica para a suíte de 09-15.
  it.todo("runLancamentoAgent: o Convidado com `ver` na Tarefa não aciona o Agente de lançamento (conferência fraca, 09-09-SUMMARY item 3)");
});
