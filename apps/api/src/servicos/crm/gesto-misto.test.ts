/**
 * O gesto misto (Fase 14, 3.2.1) contra o Postgres LOCAL: o "tudo ou nada" entre
 * as tabelas do CRM e `plataforma.registros`.
 *
 *   docker run -d --rm --name crm-n1-pg-1403 -e POSTGRES_PASSWORD=x -p 55603:5432 postgres:16
 *   cd apps/api
 *   DATABASE_URL=postgres://postgres:x@localhost:55603/postgres \
 *   DATABASE_URL_MIGRACAO=postgres://postgres:x@localhost:55603/postgres \
 *     npx vitest run src/servicos/crm/gesto-misto.test.ts
 *   docker rm -f crm-n1-pg-1403
 *
 * O Espaço é o seed (`buildSeed`), um Canal entra por `semearCanal` e o Contato
 * pelo repositório de Contatos da Fase 7. Cada caso conta `registros` e
 * `conversas` antes e depois: o que se prova é o que NÃO ficou.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createList } from "@n1/dominio/operations";
import { fail } from "@n1/dominio/state";
import { buildSeed } from "@n1/dominio/seed";
import { encerrar, pool } from "../../persistencia/conexao";
import { semear } from "../../persistencia/repositorio";
import { criarRepositorioDeContatosPg } from "../../repositorios/crm/contatos";
import { criarRepositorioDeConversasPg } from "../../repositorios/crm/conversas";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearCanal } from "../../testes/banco-crm";
import { executarGestoMisto, type GestoMisto } from "./gesto-misto";
import { recusa, sucesso } from "./resultado";
import type { FrasesDeRestricao } from "./transacao";

const PROPRIETARIO = "mem_thiago";
const ESPACO_DO_SEED = "spc_com";
const FRASE_JA_ABERTA = "Já existe uma Conversa aberta deste Contato neste Canal.";
const FRASES: FrasesDeRestricao = {
  conversas_nao_resolvida_uq: { codigo: "CONVERSA_JA_ABERTA", error: FRASE_JA_ABERTA },
};

interface Lido {
  readonly contatoId: string;
  readonly canalId: string;
}

describeComBanco("executarGestoMisto — Postgres local", () => {
  const espacos: string[] = [];

  /** Um Espaço novo com o seed, um Canal e um Contato com WhatsApp. */
  async function espaco(rotulo: string) {
    const ws = novoEspacoDeTeste(rotulo);
    espacos.push(ws);
    const cliente = await pool().connect();
    try {
      await semear(cliente, ws, buildSeed());
    } finally {
      cliente.release();
    }
    const canalId = await semearCanal(ws, {
      nome: "Comercial",
      tipo: "whatsapp",
      provedor: "whatsapp-cloud",
      identificadorExterno: "+5511977770001",
      conexao: "conectada",
    });
    const repositorio = criarRepositorioDeContatosPg(pool());
    const contato = await repositorio.inserir(ws, { nome: "Maria", proprietarioId: PROPRIETARIO, criadoPor: PROPRIETARIO });
    await repositorio.inserirIdentificador(ws, contato.id, { tipo: "whatsapp", valor: "+5511999990001", principal: true });
    return { ws, canalId, contatoId: contato.id };
  }

  const contar = async (tabela: "registros" | "conversas", ws: string) =>
    Number((await pool().query<{ n: string }>(`select count(*) as n from plataforma.${tabela} where workspace_id = $1`, [ws])).rows[0]!.n);
  const revisaoDe = async (ws: string) =>
    Number((await pool().query<{ revisao: string }>("select revisao from plataforma.workspaces where workspace_id = $1", [ws])).rows[0]!.revisao);
  const listaEmRegistros = async (ws: string, nome: string) =>
    (await pool().query("select 1 from plataforma.registros where workspace_id = $1 and colecao = 'lists' and dados->>'name' = $2", [ws, nome])).rowCount;

  /** `lerDoCrm` real: trava o Contato e o Canal em ordem de id e devolve os ids lidos. */
  const lerContatoECanal =
    (ws: string, contatoId: string, canalId: string): GestoMisto<Lido, string>["lerDoCrm"] =>
    async (cliente) => {
      const contato = await cliente.query("select id from plataforma.contatos where workspace_id = $1 and id = $2 for update", [ws, contatoId]);
      if (contato.rowCount === 0) return recusa(404, "Contato não encontrado.");
      const canal = await cliente.query("select id from plataforma.canais where workspace_id = $1 and id = $2 for update", [ws, canalId]);
      if (canal.rowCount === 0) return recusa(404, "Canal não encontrado.");
      return sucesso({ contatoId, canalId });
    };

  const criarLista = (nome: string): GestoMisto<Lido, string>["operacao"] => (state) => {
    const r = createList(state, PROPRIETARIO, { name: nome, parentType: "space", parentId: ESPACO_DO_SEED });
    return r.ok ? { ok: true, value: nome } : r;
  };

  const abrirConversa =
    (ws: string): GestoMisto<Lido, string>["gravarNoCrm"] =>
    async (cliente, _valor, lido) => {
      await criarRepositorioDeConversasPg(cliente).inserir(ws, {
        canalId: lido.canalId,
        contatoId: lido.contatoId,
        titulo: "Conversa do gesto",
        filaId: null,
        atribuido: { tipo: "membro", id: PROPRIETARIO },
        participantes: [],
        criadoPor: { tipo: "member", id: PROPRIETARIO },
      });
    };

  beforeAll(async () => {
    await prepararBancoCrm();
  });

  afterAll(async () => {
    for (const ws of espacos) await limparEspaco(ws);
    await encerrar();
  });

  it("sucesso: a Conversa entra em conversas, a Lista entra em registros, a revisão sobe 1 e o resultado traz o estado depois", async () => {
    const { ws, canalId, contatoId } = await espaco("ok");
    const antes = { registros: await contar("registros", ws), conversas: await contar("conversas", ws), revisao: await revisaoDe(ws) };

    const r = await executarGestoMisto(ws, {
      lerDoCrm: lerContatoECanal(ws, contatoId, canalId),
      operacao: criarLista("Lista do gesto"),
      gravarNoCrm: abrirConversa(ws),
    });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.valor.valor).toBe("Lista do gesto");
    expect(r.valor.resultado.ok).toBe(true);
    expect(r.valor.depois.lists.some((l) => l.name === "Lista do gesto")).toBe(true);
    expect(await contar("conversas", ws)).toBe(antes.conversas + 1);
    expect(await contar("registros", ws)).toBeGreaterThan(antes.registros);
    expect(await listaEmRegistros(ws, "Lista do gesto")).toBe(1);
    expect(await revisaoDe(ws)).toBe(antes.revisao + 1);
  });

  it("erro em gravarNoCrm: a exceção sobe e nem registros nem conversas ganham linha (nem a revisão sobe)", async () => {
    const { ws, canalId, contatoId } = await espaco("erro");
    const antes = { registros: await contar("registros", ws), conversas: await contar("conversas", ws), revisao: await revisaoDe(ws) };

    await expect(
      executarGestoMisto(ws, {
        lerDoCrm: lerContatoECanal(ws, contatoId, canalId),
        operacao: criarLista("Lista que não fica"),
        gravarNoCrm: async () => {
          throw new Error("falha forçada");
        },
      }),
    ).rejects.toThrow("falha forçada");

    expect(await contar("registros", ws)).toBe(antes.registros);
    expect(await contar("conversas", ws)).toBe(antes.conversas);
    expect(await revisaoDe(ws)).toBe(antes.revisao);
    expect(await listaEmRegistros(ws, "Lista que não fica")).toBe(0);
  });

  it("erro em gravarNoCrm DEPOIS de a conversa entrar: a conversa também some", async () => {
    const { ws, canalId, contatoId } = await espaco("depois");
    const antes = { registros: await contar("registros", ws), conversas: await contar("conversas", ws) };

    await expect(
      executarGestoMisto(ws, {
        lerDoCrm: lerContatoECanal(ws, contatoId, canalId),
        operacao: criarLista("Outra lista que não fica"),
        gravarNoCrm: async (cliente, valor, lido) => {
          await abrirConversa(ws)(cliente, valor, lido);
          throw new Error("falha depois de gravar");
        },
      }),
    ).rejects.toThrow("falha depois de gravar");

    expect(await contar("conversas", ws)).toBe(antes.conversas);
    expect(await contar("registros", ws)).toBe(antes.registros);
  });

  it("a operação recusa: 409 RECUSA_DO_DOMINIO com o campo, gravarNoCrm nunca roda e nada muda", async () => {
    const { ws, canalId, contatoId } = await espaco("recusa-dominio");
    const antes = { registros: await contar("registros", ws), conversas: await contar("conversas", ws), revisao: await revisaoDe(ws) };
    let gravou = false;

    const r = await executarGestoMisto(ws, {
      lerDoCrm: lerContatoECanal(ws, contatoId, canalId),
      operacao: () => fail("recusado", "campo"),
      gravarNoCrm: async () => {
        gravou = true;
      },
    });

    expect(r).toEqual({ ok: false, status: 409, error: "recusado", codigo: "RECUSA_DO_DOMINIO", campo: "campo" });
    expect(gravou).toBe(false);
    expect(await contar("registros", ws)).toBe(antes.registros);
    expect(await contar("conversas", ws)).toBe(antes.conversas);
    expect(await revisaoDe(ws)).toBe(antes.revisao);
  });

  it("lerDoCrm recusa (404): o status dela volta como valor, a operação e gravarNoCrm não rodam e nada muda", async () => {
    const { ws, canalId } = await espaco("recusa-crm");
    const antes = { registros: await contar("registros", ws), conversas: await contar("conversas", ws) };
    let operou = false;
    let gravou = false;

    const r = await executarGestoMisto(ws, {
      lerDoCrm: lerContatoECanal(ws, "00000000-0000-0000-0000-000000000000", canalId),
      operacao: () => {
        operou = true;
        return { ok: true, value: "x" };
      },
      gravarNoCrm: async () => {
        gravou = true;
      },
    });

    expect(r).toEqual({ ok: false, status: 404, error: "Contato não encontrado." });
    expect(operou).toBe(false);
    expect(gravou).toBe(false);
    expect(await contar("registros", ws)).toBe(antes.registros);
    expect(await contar("conversas", ws)).toBe(antes.conversas);
  });

  it("23505 dentro de gravarNoCrm (Conversa aberta no par): 409 CONVERSA_JA_ABERTA com a frase, sem o nome do constraint, e a Lista não fica", async () => {
    const { ws, canalId, contatoId } = await espaco("23505");
    // O par já tem uma Conversa aberta: a escrita do gesto bate no índice único.
    const cliente = await pool().connect();
    try {
      await abrirConversa(ws)(cliente, "x", { contatoId, canalId });
    } finally {
      cliente.release();
    }
    const antes = { registros: await contar("registros", ws), conversas: await contar("conversas", ws), revisao: await revisaoDe(ws) };

    const r = await executarGestoMisto(
      ws,
      {
        lerDoCrm: lerContatoECanal(ws, contatoId, canalId),
        operacao: criarLista("Lista da corrida"),
        gravarNoCrm: abrirConversa(ws),
      },
      FRASES,
    );

    expect(r).toEqual({ ok: false, status: 409, error: FRASE_JA_ABERTA, codigo: "CONVERSA_JA_ABERTA" });
    expect(JSON.stringify(r)).not.toContain("conversas_nao_resolvida_uq");
    expect(await listaEmRegistros(ws, "Lista da corrida")).toBe(0);
    expect(await contar("registros", ws)).toBe(antes.registros);
    expect(await contar("conversas", ws)).toBe(antes.conversas);
    expect(await revisaoDe(ws)).toBe(antes.revisao);
  });

  it("gravarNoCrm devolve uma recusa: o resultado é essa recusa e nada fica", async () => {
    const { ws, canalId, contatoId } = await espaco("recusa-gravar");
    const antes = { registros: await contar("registros", ws), conversas: await contar("conversas", ws) };

    const r = await executarGestoMisto(ws, {
      lerDoCrm: lerContatoECanal(ws, contatoId, canalId),
      operacao: criarLista("Lista da recusa tardia"),
      gravarNoCrm: async (cliente, valor, lido) => {
        await abrirConversa(ws)(cliente, valor, lido);
        return recusa(409, "x", { codigo: "Y" });
      },
    });

    expect(r).toEqual({ ok: false, status: 409, error: "x", codigo: "Y" });
    expect(await contar("registros", ws)).toBe(antes.registros);
    expect(await contar("conversas", ws)).toBe(antes.conversas);
    expect(await listaEmRegistros(ws, "Lista da recusa tardia")).toBe(0);
  });
});
