/**
 * Mesclar Contatos no modelo novo (14-09, 3.2.2) contra o Postgres LOCAL: o
 * gesto misto move tudo nas tabelas do CRM e troca os Vínculos em
 * `plataforma.registros` no mesmo commit.
 *
 *   docker run -d --rm --name crm-n1-pg-1409 -e POSTGRES_PASSWORD=x -p 55609:5432 postgres:16
 *   cd apps/api
 *   DATABASE_URL=postgres://postgres:x@localhost:55609/postgres \
 *   DATABASE_URL_MIGRACAO=postgres://postgres:x@localhost:55609/postgres \
 *     npx vitest run src/servicos/crm/mesclagem.test.ts
 *   docker rm -f crm-n1-pg-1409
 *
 * Cada caso tem o seu Espaço (o seed, dois Canais e Contatos pelo repositório).
 * Nas recusas, o que se prova é o que NÃO mudou: o retrato das duas bases antes
 * e depois tem de ser igual. O Contato `mesclado` e o da lixeira entram por SQL.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ok } from "@n1/dominio/state";
import { buildSeed } from "@n1/dominio/seed";
import type { Endereco } from "@n1/dominio/crm/comum";
import type { TipoIdentificadorContato } from "@n1/dominio/crm/contatos";
import type { MembroDaSessao } from "../../plugins/autenticacao";
import { encerrar, pool } from "../../persistencia/conexao";
import { executar } from "../../persistencia/unidade-de-trabalho";
import { semear } from "../../persistencia/repositorio";
import { criarRepositorioDeContatosPg } from "../../repositorios/crm/contatos";
import { criarRepositorioDeConversasPg } from "../../repositorios/crm/conversas";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearCanal, semearMembro } from "../../testes/banco-crm";
import { criarAcessoAoCrmPg } from "./acesso";
import { criarServicoDeMesclagem } from "./mesclagem";
import type { ResultadoCrm } from "./resultado";

const SESSAO = "mem_thiago";
const servico = criarServicoDeMesclagem({ pool, acesso: criarAcessoAoCrmPg(pool) });

const membro = (workspaceId: string, id = SESSAO): MembroDaSessao => ({ id, workspaceId, state: "ativo" });

function valor<T>(resultado: ResultadoCrm<T>): T {
  if (!resultado.ok) throw new Error(`esperava sucesso, veio ${resultado.status} ${resultado.codigo ?? ""}: ${resultado.error}`);
  return resultado.valor;
}

function recusado(resultado: ResultadoCrm<unknown>) {
  if (resultado.ok) throw new Error("esperava recusa, veio sucesso");
  return resultado;
}

const em = (iso: string): string => new Date(iso).toISOString();

describeComBanco("ServicoDeMesclagem — Postgres local", () => {
  const espacos: string[] = [];

  /** Um Espaço novo com o seed, dois Canais de WhatsApp e um Convidado. */
  async function espaco(rotulo: string) {
    const ws = novoEspacoDeTeste(rotulo);
    espacos.push(ws);
    const cliente = await pool().connect();
    try {
      await semear(cliente, ws, buildSeed());
    } finally {
      cliente.release();
    }
    await semearMembro(ws, { id: "mem_convidado_teste", base: "convidado", state: "ativo" });
    const canal1 = await semearCanal(ws, { nome: "Comercial", tipo: "whatsapp", provedor: "whatsapp-cloud", identificadorExterno: "+5511977770001", conexao: "conectada" });
    const canal2 = await semearCanal(ws, { nome: "Suporte", tipo: "whatsapp", provedor: "whatsapp-cloud", identificadorExterno: "+5511977770002", conexao: "conectada" });
    return { ws, canal1, canal2 };
  }

  async function contato(
    ws: string,
    nome: string,
    identificadores: readonly { tipo: TipoIdentificadorContato; valor: string; principal: boolean }[] = [],
    enderecos: readonly Endereco[] = [],
  ): Promise<string> {
    const repositorio = criarRepositorioDeContatosPg(pool());
    const criado = await repositorio.inserir(ws, { nome, enderecos, proprietarioId: SESSAO, criadoPor: SESSAO });
    for (const identificador of identificadores) await repositorio.inserirIdentificador(ws, criado.id, identificador);
    return criado.id;
  }

  /** Conversa do Contato no Canal, com Mensagem na hora dada (ou sem Mensagem). */
  async function conversa(ws: string, canalId: string, contatoId: string, titulo: string, mensagemEm?: string): Promise<string> {
    const criada = await criarRepositorioDeConversasPg(pool()).inserir(ws, {
      canalId,
      contatoId,
      titulo,
      filaId: null,
      atribuido: { tipo: "membro", id: SESSAO },
      participantes: [
        { id: randomUUID(), sujeito: { tipo: "contato", id: contatoId }, papel: "contato", principal: true, entrouEm: em("2026-01-01T00:00:00Z"), saiuEm: null },
        { id: randomUUID(), sujeito: { tipo: "membro", id: SESSAO }, papel: "atendente", principal: false, entrouEm: em("2026-01-01T00:00:00Z"), saiuEm: null },
      ],
      criadoPor: { tipo: "member", id: SESSAO },
    });
    if (mensagemEm !== undefined) {
      await pool().query(
        `insert into plataforma.mensagens (workspace_id, conversa_id, canal_id, direcao, ator_tipo, ator_id, conteudo, criado_em)
         values ($1, $2, $3, 'interna', 'member', $4, 'oi', $5)`,
        [ws, criada.id, canalId, SESSAO, mensagemEm],
      );
    }
    return criada.id;
  }

  async function negocio(ws: string, contatoId: string, titulo: string): Promise<string> {
    const funil = await pool().query<{ id: string }>(
      "insert into plataforma.funis (workspace_id, nome, criado_por) values ($1, $2, $3) returning id",
      [ws, `Funil ${randomUUID().slice(0, 6)}`, SESSAO],
    );
    const etapa = await pool().query<{ id: string }>(
      "insert into plataforma.etapas (workspace_id, funil_id, nome, ordem) values ($1, $2, 'Início', 1) returning id",
      [ws, funil.rows[0]!.id],
    );
    const criado = await pool().query<{ id: string }>(
      `insert into plataforma.negocios (workspace_id, titulo, contato_id, funil_id, etapa_id, proprietario_id, criado_por)
       values ($1, $2, $3, $4, $5, $6, $6) returning id`,
      [ws, titulo, contatoId, funil.rows[0]!.id, etapa.rows[0]!.id, SESSAO],
    );
    return criado.rows[0]!.id;
  }

  async function nota(ws: string, contatoId: string, conteudo: string): Promise<void> {
    await pool().query("insert into plataforma.contato_notas (workspace_id, contato_id, conteudo, autor_id) values ($1, $2, $3, $4)", [ws, contatoId, conteudo, SESSAO]);
  }

  async function consentimento(ws: string, contatoId: string, decisao: "concedido" | "revogado", registradoPor: string): Promise<void> {
    await pool().query(
      `insert into plataforma.contato_consentimentos (workspace_id, contato_id, finalidade_id, tipo_de_canal, decisao, em, origem, registrado_por)
       values ($1, $2, 'fin_marketing', 'whatsapp', $3, now(), 'verbal', $4)`,
      [ws, contatoId, decisao, registradoPor],
    );
  }

  /** Uma Empresa com os Contatos dados como vigentes (o primeiro é admin quando `admin` é verdadeiro). */
  async function empresa(ws: string, nome: string, vinculos: readonly { contatoId: string; admin: boolean }[]): Promise<string> {
    const cliente = await pool().connect();
    try {
      await cliente.query("begin");
      const criada = await cliente.query<{ id: string }>(
        "insert into plataforma.empresas (workspace_id, nome_fantasia, proprietario_id, criado_por) values ($1, $2, $3, $3) returning id",
        [ws, nome, SESSAO],
      );
      for (const vinculo of vinculos) {
        await cliente.query(
          "insert into plataforma.contato_empresa (workspace_id, contato_id, empresa_id, admin, criado_por) values ($1, $2, $3, $4, $5)",
          [ws, vinculo.contatoId, criada.rows[0]!.id, vinculo.admin, SESSAO],
        );
      }
      await cliente.query("commit");
      return criada.rows[0]!.id;
    } catch (erro) {
      await cliente.query("rollback");
      throw erro;
    } finally {
      cliente.release();
    }
  }

  /** O Vínculo Tarefa→Contato em `registros`, gravado pelo mesmo caminho das operações. */
  async function vinculoDaTarefa(ws: string, contatoId: string): Promise<void> {
    const tarefa = buildSeed().tasks[0]!;
    await executar(ws, (state) => {
      state.links.push({
        id: `lnk_${randomUUID().slice(0, 8)}`,
        fromType: "task",
        fromId: tarefa.id,
        toType: "contact",
        toId: contatoId,
        role: "contato",
        createdBy: { kind: "member", id: SESSAO },
        createdAt: em("2026-01-01T00:00:00Z"),
      });
      return ok(undefined);
    });
  }

  async function vinculosEmRegistros(ws: string): Promise<{ toId: string; fromId: string }[]> {
    const { rows } = await pool().query<{ dados: { toType: string; toId: string; fromId: string } }>(
      "select dados from plataforma.registros where workspace_id = $1 and colecao = 'links'",
      [ws],
    );
    return rows.filter((r) => r.dados.toType === "contact").map((r) => ({ toId: r.dados.toId, fromId: r.dados.fromId }));
  }

  async function atividades(ws: string, acao: string): Promise<{ objectId: string; after?: string }[]> {
    const { rows } = await pool().query<{ dados: { action: string; objectId: string; after?: string } }>(
      "select dados from plataforma.registros where workspace_id = $1 and colecao = 'activity'",
      [ws],
    );
    return rows.filter((r) => r.dados.action === acao).map((r) => ({ objectId: r.dados.objectId, ...(r.dados.after !== undefined ? { after: r.dados.after } : {}) }));
  }

  const linhasDe = async <T extends object>(sql: string, parametros: unknown[]): Promise<T[]> => (await pool().query<T>(sql, parametros)).rows;

  /** O retrato das duas bases: se uma recusa mexeu em qualquer coisa, ele muda. */
  async function retrato(ws: string): Promise<string> {
    const consultas = [
      "select id, estado, mesclado_em_id, enderecos from plataforma.contatos where workspace_id = $1 order by id",
      "select id, contato_id, principal from plataforma.contato_identificadores where workspace_id = $1 order by id",
      "select id, contato_id, situacao, participantes from plataforma.conversas where workspace_id = $1 order by id",
      "select id, contato_id from plataforma.negocios where workspace_id = $1 order by id",
      "select id, contato_id, admin, fim from plataforma.contato_empresa where workspace_id = $1 order by id",
      "select id, contato_id from plataforma.contato_notas where workspace_id = $1 order by id",
      "select id, contato_id from plataforma.contato_consentimentos where workspace_id = $1 order by id",
      "select colecao, id, dados from plataforma.registros where workspace_id = $1 and colecao in ('links', 'activity') order by colecao, id",
      "select revisao from plataforma.workspaces where workspace_id = $1",
    ];
    const partes: unknown[] = [];
    for (const sql of consultas) partes.push((await pool().query(sql, [ws])).rows);
    return JSON.stringify(partes);
  }

  beforeAll(async () => {
    await prepararBancoCrm();
  });

  afterAll(async () => {
    for (const ws of espacos) await limparEspaco(ws);
    await encerrar();
  });

  it("(a) passa ao sobrevivente Identificadores, Conversas, Negócios, notas, consentimentos e Endereços, e marca o absorvido", async () => {
    const { ws, canal1, canal2 } = await espaco("tudo");
    const b = await contato(
      ws,
      "Marina",
      [
        { tipo: "whatsapp", valor: "+5511999990002", principal: true },
        { tipo: "email", valor: "marina@exemplo.com", principal: true },
      ],
      [{ rotulo: "residencial", cidade: "Santos", principal: true }],
    );
    const a = await contato(
      ws,
      "Marina D.",
      [
        { tipo: "whatsapp", valor: "+5511999990001", principal: true },
        { tipo: "email", valor: "marina.d@exemplo.com", principal: true },
        { tipo: "instagram", valor: "marina.d", principal: true },
      ],
      [{ rotulo: "comercial", cidade: "Campinas", principal: true }],
    );
    const conversaDeA = await conversa(ws, canal1, a, "Conversa de A", "2026-02-01T10:00:00Z");
    const conversaDeB = await conversa(ws, canal2, b, "Conversa de B", "2026-02-02T10:00:00Z");
    const negocioDeA = await negocio(ws, a, "Negócio de A");
    await nota(ws, a, "nota 1 de A");
    await nota(ws, a, "nota 2 de A");
    await consentimento(ws, a, "concedido", "mem_original_1");
    await consentimento(ws, a, "revogado", "mem_original_2");
    await consentimento(ws, b, "concedido", "mem_original_3");
    await vinculoDaTarefa(ws, a);

    const detalhado = valor(await servico.mesclar(membro(ws), b, { absorvidoId: a }));

    // A resposta é só o sobrevivente detalhado.
    expect(detalhado.contato.id).toBe(b);
    expect(detalhado.contato.estado).toBe("ativo");
    expect(detalhado.identificadores).toHaveLength(5);
    expect(Object.keys(detalhado).sort()).toEqual(["contato", "identificadores", "vinculos"]);

    // O absorvido: mesclado, apontando B, e sem nada que o prenda.
    const absorvido = (await linhasDe<{ estado: string; mesclado_em_id: string; mesclado_em: Date }>(
      "select estado, mesclado_em_id, mesclado_em from plataforma.contatos where workspace_id = $1 and id = $2",
      [ws, a],
    ))[0]!;
    expect(absorvido).toMatchObject({ estado: "mesclado", mesclado_em_id: b });
    expect(absorvido.mesclado_em).toBeInstanceOf(Date);

    // Identificadores: todos de B; o principal de cada tipo que B já tinha fica de B.
    const ids = await linhasDe<{ tipo: string; valor: string; principal: boolean; contato_id: string }>(
      "select tipo, valor, principal, contato_id from plataforma.contato_identificadores where workspace_id = $1 order by tipo, valor",
      [ws],
    );
    expect(ids.every((i) => i.contato_id === b)).toBe(true);
    const principal = (tipo: string, v: string) => ids.find((i) => i.tipo === tipo && i.valor === v)!.principal;
    expect(principal("whatsapp", "+5511999990001")).toBe(false);
    expect(principal("whatsapp", "+5511999990002")).toBe(true);
    expect(principal("email", "marina.d@exemplo.com")).toBe(false);
    expect(principal("instagram", "marina.d")).toBe(true);

    // Conversas: a de A é de B, com o Participante principal apontando B; a de B segue de B.
    const conversas = await linhasDe<{ id: string; contato_id: string; situacao: string; participantes: { sujeito: { tipo: string; id: string } }[] }>(
      "select id, contato_id, situacao, participantes from plataforma.conversas where workspace_id = $1",
      [ws],
    );
    for (const id of [conversaDeA, conversaDeB]) {
      const c = conversas.find((x) => x.id === id)!;
      expect(c.contato_id).toBe(b);
      expect(c.situacao).toBe("aberta");
      expect(c.participantes.find((p) => p.sujeito.tipo === "contato")!.sujeito.id).toBe(b);
      expect(c.participantes.find((p) => p.sujeito.tipo === "membro")!.sujeito.id).toBe(SESSAO);
    }

    // Negócio, notas.
    expect((await linhasDe<{ contato_id: string }>("select contato_id from plataforma.negocios where workspace_id = $1 and id = $2", [ws, negocioDeA]))[0]!.contato_id).toBe(b);
    const notas = await linhasDe<{ contato_id: string }>("select contato_id from plataforma.contato_notas where workspace_id = $1", [ws]);
    expect(notas).toHaveLength(2);
    expect(notas.every((n) => n.contato_id === b)).toBe(true);

    // Consentimentos: B ganha cópias, A mantém os originais (só inserção).
    const consentimentos = await linhasDe<{ id: string; contato_id: string; decisao: string; registrado_por: string }>(
      "select id, contato_id, decisao, registrado_por from plataforma.contato_consentimentos where workspace_id = $1",
      [ws],
    );
    expect(consentimentos.filter((c) => c.contato_id === a)).toHaveLength(2);
    const deB = consentimentos.filter((c) => c.contato_id === b);
    expect(deB).toHaveLength(3);
    expect(deB.map((c) => c.registrado_por).sort()).toEqual(["mem_original_1", "mem_original_2", "mem_original_3"]);
    expect(new Set(consentimentos.map((c) => c.id)).size).toBe(5);

    // Endereços de A entram em B sem principal.
    const enderecos = (await linhasDe<{ enderecos: { cidade: string; principal: boolean }[] }>(
      "select enderecos from plataforma.contatos where workspace_id = $1 and id = $2",
      [ws, b],
    ))[0]!.enderecos;
    expect(enderecos.map((e) => [e.cidade, e.principal])).toEqual([
      ["Santos", true],
      ["Campinas", false],
    ]);

    // `registros`: o Vínculo da Tarefa aponta B e as duas Atividades de hoje foram gravadas.
    expect((await vinculosEmRegistros(ws)).map((v) => v.toId)).toEqual([b]);
    expect(await atividades(ws, "Contato sobrevivente da mesclagem")).toEqual([{ objectId: b }]);
    expect(await atividades(ws, "Contato mesclado")).toEqual([{ objectId: a, after: "Marina" }]);
  });

  it("(b) RN-CXE-10: com Conversa aberta nos dois no mesmo Canal, a de Mensagem mais antiga vira resolvida e a outra fica aberta em B", async () => {
    const { ws, canal1 } = await espaco("colisao");
    const b = await contato(ws, "B", [{ tipo: "whatsapp", valor: "+5511999991001", principal: true }]);
    const a = await contato(ws, "A", [{ tipo: "whatsapp", valor: "+5511999991002", principal: true }]);
    const antigaDeA = await conversa(ws, canal1, a, "Antiga de A", "2026-02-01T10:00:00Z");
    const novaDeB = await conversa(ws, canal1, b, "Nova de B", "2026-03-01T10:00:00Z");

    valor(await servico.mesclar(membro(ws), b, { absorvidoId: a }));

    const c = await linhasDe<{ id: string; contato_id: string; situacao: string; resolvida_em: Date | null }>(
      "select id, contato_id, situacao, resolvida_em from plataforma.conversas where workspace_id = $1",
      [ws],
    );
    const antiga = c.find((x) => x.id === antigaDeA)!;
    const nova = c.find((x) => x.id === novaDeB)!;
    expect(antiga).toMatchObject({ contato_id: b, situacao: "resolvida" });
    expect(antiga.resolvida_em).toBeInstanceOf(Date);
    expect(nova).toMatchObject({ contato_id: b, situacao: "aberta" });
  });

  it("(b2) a de B é a mais antiga: ela é que resolve, e a de A (pendente) fica", async () => {
    const { ws, canal1 } = await espaco("colisao2");
    const b = await contato(ws, "B", [{ tipo: "whatsapp", valor: "+5511999992001", principal: true }]);
    const a = await contato(ws, "A", [{ tipo: "whatsapp", valor: "+5511999992002", principal: true }]);
    const antigaDeB = await conversa(ws, canal1, b, "Antiga de B", "2026-02-01T10:00:00Z");
    const novaDeA = await conversa(ws, canal1, a, "Nova de A", "2026-03-01T10:00:00Z");
    await pool().query("update plataforma.conversas set situacao = 'pendente' where workspace_id = $1 and id = $2", [ws, novaDeA]);

    valor(await servico.mesclar(membro(ws), b, { absorvidoId: a }));

    const c = await linhasDe<{ id: string; contato_id: string; situacao: string }>(
      "select id, contato_id, situacao from plataforma.conversas where workspace_id = $1",
      [ws],
    );
    expect(c.find((x) => x.id === antigaDeB)).toMatchObject({ contato_id: b, situacao: "resolvida" });
    expect(c.find((x) => x.id === novaDeA)).toMatchObject({ contato_id: b, situacao: "pendente" });
  });

  it("(b3) Conversas em Canais diferentes e Conversa já resolvida não colidem: todas passam a B como estavam", async () => {
    const { ws, canal1, canal2 } = await espaco("semcolisao");
    const b = await contato(ws, "B", [{ tipo: "whatsapp", valor: "+5511999993001", principal: true }]);
    const a = await contato(ws, "A", [{ tipo: "whatsapp", valor: "+5511999993002", principal: true }]);
    const deB = await conversa(ws, canal1, b, "B no canal 1");
    const deA = await conversa(ws, canal2, a, "A no canal 2");
    const resolvidaDeA = await conversa(ws, canal1, a, "A resolvida no canal 1");
    await pool().query("update plataforma.conversas set situacao = 'resolvida', resolvida_em = now() where workspace_id = $1 and id = $2", [ws, resolvidaDeA]);

    valor(await servico.mesclar(membro(ws), b, { absorvidoId: a }));

    const c = await linhasDe<{ id: string; contato_id: string; situacao: string }>("select id, contato_id, situacao from plataforma.conversas where workspace_id = $1", [ws]);
    expect(c.every((x) => x.contato_id === b)).toBe(true);
    expect(c.find((x) => x.id === deB)!.situacao).toBe("aberta");
    expect(c.find((x) => x.id === deA)!.situacao).toBe("aberta");
    expect(c.find((x) => x.id === resolvidaDeA)!.situacao).toBe("resolvida");
  });

  it("(c) Pitfall 5: A é o único admin da Empresa e B já é vínculo não admin: B vira admin, o de A encerra e o commit passa", async () => {
    const { ws } = await espaco("admin");
    const b = await contato(ws, "B", [{ tipo: "email", valor: "b@exemplo.com", principal: true }]);
    const a = await contato(ws, "A", [{ tipo: "email", valor: "a@exemplo.com", principal: true }]);
    const e = await empresa(ws, "Acme", [
      { contatoId: a, admin: true },
      { contatoId: b, admin: false },
    ]);

    valor(await servico.mesclar(membro(ws), b, { absorvidoId: a }));

    const vinculos = await linhasDe<{ contato_id: string; admin: boolean; fim: string | null }>(
      "select contato_id, admin, fim::text as fim from plataforma.contato_empresa where workspace_id = $1 and empresa_id = $2 order by contato_id",
      [ws, e],
    );
    const deB = vinculos.filter((v) => v.contato_id === b);
    const deA = vinculos.filter((v) => v.contato_id === a);
    expect(deB).toEqual([{ contato_id: b, admin: true, fim: null }]);
    expect(deA).toHaveLength(1);
    expect(deA[0]!.fim).not.toBeNull();
  });

  it("(c2) A é o único admin e B não tem vínculo com a Empresa: o vínculo passa a B, admin; vínculo já encerrado também passa", async () => {
    const { ws } = await espaco("admin2");
    const b = await contato(ws, "B", [{ tipo: "email", valor: "b2@exemplo.com", principal: true }]);
    const a = await contato(ws, "A", [{ tipo: "email", valor: "a2@exemplo.com", principal: true }]);
    const e1 = await empresa(ws, "Acme", [{ contatoId: a, admin: true }]);
    const outra = await contato(ws, "Admin da outra", [{ tipo: "email", valor: "o@exemplo.com", principal: true }]);
    const e2 = await empresa(ws, "Beta", [
      { contatoId: outra, admin: true },
      { contatoId: a, admin: false },
    ]);
    await pool().query("update plataforma.contato_empresa set fim = current_date where workspace_id = $1 and empresa_id = $2 and contato_id = $3", [ws, e2, a]);

    valor(await servico.mesclar(membro(ws), b, { absorvidoId: a }));

    const vinculos = await linhasDe<{ empresa_id: string; contato_id: string; admin: boolean; fim: string | null }>(
      "select empresa_id, contato_id, admin, fim::text as fim from plataforma.contato_empresa where workspace_id = $1 and contato_id in ($2, $3)",
      [ws, a, b],
    );
    expect(vinculos.find((v) => v.empresa_id === e1)).toMatchObject({ contato_id: b, admin: true, fim: null });
    expect(vinculos.find((v) => v.empresa_id === e2)).toMatchObject({ contato_id: b, admin: false });
    expect(vinculos.find((v) => v.empresa_id === e2)!.fim).not.toBeNull();
  });

  it("(d) RN-CON-14: um Contato já mesclado em A passa a apontar B, sem cadeia", async () => {
    const { ws } = await espaco("cadeia");
    const b = await contato(ws, "B", [{ tipo: "email", valor: "b3@exemplo.com", principal: true }]);
    const a = await contato(ws, "A", [{ tipo: "email", valor: "a3@exemplo.com", principal: true }]);
    const c = await contato(ws, "C");
    await pool().query("update plataforma.contatos set estado = 'mesclado', mesclado_em_id = $3, mesclado_em = now() where workspace_id = $1 and id = $2", [ws, c, a]);

    valor(await servico.mesclar(membro(ws), b, { absorvidoId: a }));

    const estados = await linhasDe<{ id: string; estado: string; mesclado_em_id: string | null }>(
      "select id, estado, mesclado_em_id from plataforma.contatos where workspace_id = $1",
      [ws],
    );
    expect(estados.find((x) => x.id === c)).toMatchObject({ estado: "mesclado", mesclado_em_id: b });
    expect(estados.find((x) => x.id === a)).toMatchObject({ estado: "mesclado", mesclado_em_id: b });
    expect(estados.find((x) => x.id === b)).toMatchObject({ estado: "ativo", mesclado_em_id: null });
  });

  it("(e) sobrevivente arquivado e absorvido ativo: o sobrevivente volta a ativo", async () => {
    const { ws } = await espaco("ativar");
    const b = await contato(ws, "B");
    const a = await contato(ws, "A", [{ tipo: "email", valor: "a4@exemplo.com", principal: true }]);
    await pool().query("update plataforma.contatos set estado = 'arquivado' where workspace_id = $1 and id = $2", [ws, b]);

    const detalhado = valor(await servico.mesclar(membro(ws), b, { absorvidoId: a }));

    expect(detalhado.contato.estado).toBe("ativo");
  });

  describe("recusas: nada muda nas duas bases", () => {
    async function recusa(rotulo: string, preparar: (e: { ws: string; a: string; b: string }) => Promise<{ sobrevivente: string; absorvido: string; sessao?: string }>) {
      const { ws, canal1 } = await espaco(rotulo);
      const b = await contato(ws, "B", [{ tipo: "email", valor: `b-${rotulo}@exemplo.com`, principal: true }]);
      const a = await contato(ws, "A", [{ tipo: "email", valor: `a-${rotulo}@exemplo.com`, principal: true }]);
      await conversa(ws, canal1, a, "Conversa de A", "2026-02-01T10:00:00Z");
      await nota(ws, a, "nota");
      await vinculoDaTarefa(ws, a);
      const alvo = await preparar({ ws, a, b });
      const antes = await retrato(ws);
      const resultado = recusado(await servico.mesclar(membro(ws, alvo.sessao), alvo.sobrevivente, { absorvidoId: alvo.absorvido }));
      expect(await retrato(ws)).toBe(antes);
      return resultado;
    }

    it("(f) o mesmo Contato dos dois lados: 409", async () => {
      const r = await recusa("mesmo", async ({ a }) => ({ sobrevivente: a, absorvido: a }));
      expect(r).toMatchObject({ status: 409, codigo: "MESCLAGEM_RECUSADA" });
    });

    it("(g) absorvido já mesclado: 409", async () => {
      const r = await recusa("absmesc", async ({ ws, a, b }) => {
        const c = await contato(ws, "C");
        await pool().query("update plataforma.contatos set estado = 'mesclado', mesclado_em_id = $3, mesclado_em = now() where workspace_id = $1 and id = $2", [ws, a, c]);
        return { sobrevivente: b, absorvido: a };
      });
      expect(r).toMatchObject({ status: 409, codigo: "MESCLAGEM_RECUSADA" });
    });

    it("(h) sobrevivente na lixeira: 409", async () => {
      const r = await recusa("sobtrash", async ({ ws, a, b }) => {
        await pool().query("update plataforma.contatos set estado = 'na_lixeira' where workspace_id = $1 and id = $2", [ws, b]);
        return { sobrevivente: b, absorvido: a };
      });
      expect(r).toMatchObject({ status: 409, codigo: "MESCLAGEM_RECUSADA" });
    });

    it("(i) absorvido na lixeira: 409", async () => {
      const r = await recusa("abstrash", async ({ ws, a, b }) => {
        await pool().query("update plataforma.contatos set estado = 'na_lixeira' where workspace_id = $1 and id = $2", [ws, a]);
        return { sobrevivente: b, absorvido: a };
      });
      expect(r).toMatchObject({ status: 409, codigo: "MESCLAGEM_RECUSADA" });
    });

    it("(j) T-14-22: absorvido de outro Espaço: 404", async () => {
      const r = await recusa("outroabs", async ({ b }) => {
        const outro = await espaco("outroabs-fora");
        const deFora = await contato(outro.ws, "De fora", [{ tipo: "email", valor: "fora@exemplo.com", principal: true }]);
        return { sobrevivente: b, absorvido: deFora };
      });
      expect(r.status).toBe(404);
    });

    it("(k) T-14-22: sobrevivente de outro Espaço: 404", async () => {
      const r = await recusa("outrosob", async ({ a }) => {
        const outro = await espaco("outrosob-fora");
        const deFora = await contato(outro.ws, "De fora", [{ tipo: "email", valor: "fora2@exemplo.com", principal: true }]);
        return { sobrevivente: deFora, absorvido: a };
      });
      expect(r.status).toBe(404);
    });

    it("(l) Contato que não existe: 404", async () => {
      const r = await recusa("inexistente", async ({ b }) => ({ sobrevivente: b, absorvido: randomUUID() }));
      expect(r.status).toBe(404);
    });

    it("(m) Convidado: 403", async () => {
      const r = await recusa("convidado", async ({ a, b }) => ({ sobrevivente: b, absorvido: a, sessao: "mem_convidado_teste" }));
      expect(r.status).toBe(403);
    });
  });

  it("(n) T-14-23: mesclar A em B e B em A ao mesmo tempo: um vence, o outro recebe 409, sem deadlock", async () => {
    const { ws, canal1 } = await espaco("corrida");
    const b = await contato(ws, "B", [{ tipo: "email", valor: "cb@exemplo.com", principal: true }]);
    const a = await contato(ws, "A", [{ tipo: "email", valor: "ca@exemplo.com", principal: true }]);
    await conversa(ws, canal1, a, "A", "2026-02-01T10:00:00Z");
    await conversa(ws, canal1, b, "B", "2026-03-01T10:00:00Z");

    const resultados = await Promise.all([
      servico.mesclar(membro(ws), b, { absorvidoId: a }),
      servico.mesclar(membro(ws), a, { absorvidoId: b }),
    ]);

    expect(resultados.filter((r) => r.ok)).toHaveLength(1);
    const perdedor = resultados.find((r) => !r.ok)!;
    expect(perdedor).toMatchObject({ ok: false, status: 409 });
    const estados = await linhasDe<{ estado: string }>("select estado from plataforma.contatos where workspace_id = $1 order by estado", [ws]);
    expect(estados.map((e) => e.estado)).toEqual(["ativo", "mesclado"]);
  });
});
