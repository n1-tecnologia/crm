/**
 * Serviço de Funis e Etapas (07-04, Task 2), contra o Postgres LOCAL.
 *
 * Os casos (a)-(j) do plano: o Funil padrão que nasce sozinho (D-13), a criação
 * atômica com Etapas, definir o padrão, Etapas (posição, nome, reordenação num
 * comando), as recusas de D-07 com os caminhos remapear e migrar, o ciclo de
 * vida (D-06, RN-FUN-12/16), o Papel (D-14) e o isolamento entre Espaços.
 * Contato e Negócio de apoio entram por SQL direto: o serviço de Negócios é de
 * 07-08.
 *
 *   DATABASE_URL=postgres://postgres:x@localhost:55474/postgres npx vitest run src/servicos/crm/funis.test.ts
 */

import { afterAll, beforeAll, expect, it } from "vitest";
import type { FunilDetalhado, NovoFunil } from "@n1/dominio/crm/funis";
import type { MembroDaSessao } from "../../plugins/autenticacao";
import { encerrar, pool } from "../../persistencia/conexao";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearMembro } from "../../testes/banco-crm";
import { criarAcessoAoCrmPg } from "./acesso";
import { criarServicoDeFunis } from "./funis";
import type { ResultadoCrm } from "./resultado";

const servico = criarServicoDeFunis({ pool, acesso: criarAcessoAoCrmPg(pool) });

const sessao = (workspaceId: string, id: string): MembroDaSessao => ({ id, workspaceId, state: "ativo" });

function valor<T>(resultado: ResultadoCrm<T>): T {
  if (!resultado.ok) throw new Error(`esperava sucesso, veio ${resultado.status} ${resultado.codigo ?? ""}: ${resultado.error}`);
  return resultado.valor;
}

function recusado(resultado: ResultadoCrm<unknown>) {
  if (resultado.ok) throw new Error("esperava recusa, veio sucesso");
  return resultado;
}

const nomesDasEtapas = (detalhe: FunilDetalhado): string[] => detalhe.etapas.map((etapa) => etapa.nome);
const ordensDasEtapas = (detalhe: FunilDetalhado): number[] => detalhe.etapas.map((etapa) => etapa.ordem);

describeComBanco("ServicoDeFunis — Postgres local", () => {
  const espacos: string[] = [];

  /** Um Espaço novo, com os três Papéis. */
  async function espaco(rotulo: string) {
    const ws = novoEspacoDeTeste(rotulo);
    espacos.push(ws);
    await semearMembro(ws, { id: "mem_admin", base: "administrador", state: "ativo" });
    await semearMembro(ws, { id: "mem_ana", base: "membro", state: "ativo" });
    await semearMembro(ws, { id: "mem_convidado", base: "convidado", state: "ativo" });
    return {
      ws,
      admin: sessao(ws, "mem_admin"),
      membro: sessao(ws, "mem_ana"),
      convidado: sessao(ws, "mem_convidado"),
    };
  }
  type Contexto = Awaited<ReturnType<typeof espaco>>;

  const funil = async (c: Contexto, nome: string, etapas: readonly string[] = ["Novo", "Fim"], extras: Partial<NovoFunil> = {}) =>
    valor(await servico.criar(c.admin, { nome, etapas: etapas.map((e) => ({ nome: e })), ...extras }));

  async function semearContato(ws: string): Promise<string> {
    const r = await pool().query<{ id: string }>(
      "insert into plataforma.contatos (workspace_id, nome, proprietario_id, criado_por) values ($1, 'Contato de apoio', 'mem_admin', 'mem_admin') returning id",
      [ws],
    );
    return r.rows[0]!.id;
  }

  async function semearNegocio(
    ws: string,
    contatoId: string,
    funilId: string,
    etapaId: string,
    extras: { estado?: string; probabilidade?: number | null } = {},
  ): Promise<string> {
    const r = await pool().query<{ id: string }>(
      `insert into plataforma.negocios (workspace_id, titulo, contato_id, funil_id, etapa_id, estado, probabilidade, proprietario_id, criado_por)
       values ($1, 'Negócio de apoio', $2, $3, $4, $5, $6, 'mem_admin', 'mem_admin') returning id`,
      [ws, contatoId, funilId, etapaId, extras.estado ?? "ativo", extras.probabilidade ?? null],
    );
    return r.rows[0]!.id;
  }

  const negocioNoBanco = async (ws: string, id: string) =>
    (
      await pool().query<{ funil_id: string; etapa_id: string; probabilidade: number | null }>(
        "select funil_id, etapa_id, probabilidade from plataforma.negocios where workspace_id = $1 and id = $2",
        [ws, id],
      )
    ).rows[0];

  beforeAll(async () => {
    await prepararBancoCrm();
  });

  afterAll(async () => {
    for (const ws of espacos) await limparEspaco(ws);
    await encerrar();
  });

  it("(a) D-13: o primeiro Funil não privado nasce padrão, o seguinte não; um primeiro privado nasce sem ser", async () => {
    const c = await espaco("fpadrao");
    const primeiro = await funil(c, "Primeiro");
    const segundo = await funil(c, "Segundo");
    expect(primeiro.funil.padrao).toBe(true);
    expect(segundo.funil.padrao).toBe(false);

    const d = await espaco("fprivado");
    const privado = await funil(d, "Só da diretoria", ["A"], { privado: true });
    expect(privado.funil.padrao).toBe(false);
    expect(privado.funil.privado).toBe(true);
    const publico = await funil(d, "Público", ["A"]);
    expect(publico.funil.padrao).toBe(true);
  });

  it("(b) criar grava as Etapas com ordem 1..n; nome em uso entre ativos e arquivados é 409; o da lixeira está livre", async () => {
    const c = await espaco("fcriar");
    const vendas = await funil(c, "Vendas", ["Novo", "Proposta"]);
    expect(nomesDasEtapas(vendas)).toEqual(["Novo", "Proposta"]);
    expect(ordensDasEtapas(vendas)).toEqual([1, 2]);

    const repetido = recusado(await servico.criar(c.admin, { nome: "  vendas ", etapas: [{ nome: "A" }] }));
    expect(repetido.status).toBe(409);
    expect(repetido.codigo).toBe("FUNIL_NOME_EM_USO");
    expect(repetido.campo).toBe("nome");

    const arquivado = await funil(c, "Pós-venda", ["A"]);
    valor(await servico.arquivar(c.admin, arquivado.funil.id));
    expect(recusado(await servico.criar(c.admin, { nome: "pós-VENDA", etapas: [{ nome: "A" }] })).codigo).toBe("FUNIL_NOME_EM_USO");

    valor(await servico.enviarParaLixeira(c.admin, arquivado.funil.id));
    const livre = valor(await servico.criar(c.admin, { nome: "Pós-venda", etapas: [{ nome: "A" }] }));
    expect(livre.funil.nome).toBe("Pós-venda");

    const semEtapas = recusado(await servico.criar(c.admin, { nome: "Vazio", etapas: [] }));
    expect(semEtapas.status).toBe(400);
    const gravado = await pool().query("select 1 from plataforma.funis where workspace_id = $1 and nome = 'Vazio'", [c.ws]);
    expect(gravado.rowCount).toBe(0);
  });

  it("(c) definirPadrao troca o padrão numa transação; Funil privado ou arquivado é 409", async () => {
    const c = await espaco("fdefinir");
    const um = await funil(c, "Um");
    const dois = await funil(c, "Dois");
    const trocado = valor(await servico.definirPadrao(c.admin, dois.funil.id));
    expect(trocado.funil.padrao).toBe(true);
    const doBanco = await pool().query<{ id: string; padrao: boolean }>(
      "select id, padrao from plataforma.funis where workspace_id = $1 order by nome",
      [c.ws],
    );
    expect(doBanco.rows.map((l) => l.padrao)).toEqual([false, true]);
    expect(doBanco.rows[0]!.id).toBe(um.funil.id);

    const privado = await funil(c, "Privado", ["A"], { privado: true });
    const recusaPrivado = recusado(await servico.definirPadrao(c.admin, privado.funil.id));
    expect(recusaPrivado.status).toBe(409);
    expect(recusaPrivado.codigo).toBe("FUNIL_PRIVADO");

    valor(await servico.arquivar(c.admin, um.funil.id));
    const recusaArquivado = recusado(await servico.definirPadrao(c.admin, um.funil.id));
    expect(recusaArquivado.status).toBe(409);
    expect(recusaArquivado.codigo).toBe("FUNIL_INATIVO");
  });

  it("(d) adicionarEtapa na posição 1 desloca as outras; nome repetido é 409; reordenar troca duas num comando", async () => {
    const c = await espaco("fetapas");
    const f = await funil(c, "Vendas", ["B", "C", "D"]);

    const comPrimeira = valor(await servico.adicionarEtapa(c.admin, f.funil.id, { nome: "Primeira", posicao: 1 }));
    expect(nomesDasEtapas(comPrimeira)).toEqual(["Primeira", "B", "C", "D"]);
    expect(ordensDasEtapas(comPrimeira)).toEqual([1, 2, 3, 4]);

    const noFim = valor(await servico.adicionarEtapa(c.admin, f.funil.id, { nome: "Última", probabilidadePadrao: 90 }));
    expect(nomesDasEtapas(noFim).at(-1)).toBe("Última");
    expect(noFim.etapas.at(-1)?.probabilidadePadrao).toBe(90);

    const repetida = recusado(await servico.adicionarEtapa(c.admin, f.funil.id, { nome: " primeira " }));
    expect(repetida.status).toBe(409);
    expect(repetida.codigo).toBe("ETAPA_NOME_EM_USO");

    const ids = noFim.etapas.map((e) => e.id);
    const trocada = valor(await servico.reordenarEtapas(c.admin, f.funil.id, [ids[1]!, ids[0]!, ...ids.slice(2)]));
    expect(nomesDasEtapas(trocada).slice(0, 2)).toEqual(["B", "Primeira"]);
    expect(ordensDasEtapas(trocada)).toEqual([1, 2, 3, 4, 5]);

    const incompleta = recusado(await servico.reordenarEtapas(c.admin, f.funil.id, ids.slice(1)));
    expect(incompleta.status).toBe(409);
    expect(incompleta.codigo).toBe("ORDEM_INVALIDA");
  });

  it("(e) D-07: Etapa com Negócios (inclusive na lixeira) é 409 com a contagem; a única Etapa é 409; remapear move e apaga", async () => {
    const c = await espaco("fremover");
    const f = await funil(c, "Vendas", ["Origem", "Destino"]);
    const [origem, destino] = f.etapas as [(typeof f.etapas)[number], (typeof f.etapas)[number]];
    const contato = await semearContato(c.ws);
    const n1 = await semearNegocio(c.ws, contato, f.funil.id, origem.id, { probabilidade: 70 });
    const n2 = await semearNegocio(c.ws, contato, f.funil.id, origem.id, { estado: "na_lixeira" });

    const bloqueada = recusado(await servico.removerEtapa(c.admin, origem.id));
    expect(bloqueada.status).toBe(409);
    expect(bloqueada.codigo).toBe("ETAPA_COM_NEGOCIOS");
    expect(bloqueada.bloqueios?.negocios?.total).toBe(2);
    expect(bloqueada.error).toContain("2 Negócios");

    const remapeada = valor(await servico.remapearEtapa(c.admin, origem.id, destino.id));
    expect(nomesDasEtapas(remapeada)).toEqual(["Destino"]);
    expect(ordensDasEtapas(remapeada)).toEqual([1]);
    expect(remapeada.etapas[0]?.negocios.total).toBe(2);
    expect((await negocioNoBanco(c.ws, n1))?.etapa_id).toBe(destino.id);
    expect((await negocioNoBanco(c.ws, n1))?.probabilidade).toBe(70);
    expect((await negocioNoBanco(c.ws, n2))?.etapa_id).toBe(destino.id);

    const ultima = recusado(await servico.removerEtapa(c.admin, destino.id));
    expect(ultima.status).toBe(409);
    expect(ultima.codigo).toBe("ULTIMA_ETAPA");

    const g = await funil(c, "Sem Negócios", ["A", "B"]);
    const semNegocios = valor(await servico.removerEtapa(c.admin, g.etapas[0]!.id));
    expect(nomesDasEtapas(semNegocios)).toEqual(["B"]);
    expect(ordensDasEtapas(semNegocios)).toEqual([1]);
  });

  it("(f) D-07: Funil com Negócio não vai para a lixeira; o padrão não vai nem é arquivado; arquivar com Negócio aberto é 409", async () => {
    const c = await espaco("flixeira");
    const padrao = await funil(c, "Padrão");
    const comNegocio = await funil(c, "Com Negócio", ["A", "B"]);
    const contato = await semearContato(c.ws);
    await semearNegocio(c.ws, contato, comNegocio.funil.id, comNegocio.etapas[0]!.id);
    await semearNegocio(c.ws, contato, comNegocio.funil.id, comNegocio.etapas[1]!.id, { estado: "na_lixeira" });

    const lixeira = recusado(await servico.enviarParaLixeira(c.admin, comNegocio.funil.id));
    expect(lixeira.status).toBe(409);
    expect(lixeira.codigo).toBe("FUNIL_COM_NEGOCIOS");
    expect(lixeira.bloqueios?.negocios?.total).toBe(2);

    const arquivar = recusado(await servico.arquivar(c.admin, comNegocio.funil.id));
    expect(arquivar.status).toBe(409);
    expect(arquivar.codigo).toBe("FUNIL_COM_NEGOCIOS_ABERTOS");
    expect(arquivar.bloqueios?.negocios?.total).toBe(2);

    expect(recusado(await servico.enviarParaLixeira(c.admin, padrao.funil.id)).codigo).toBe("FUNIL_PADRAO");
    expect(recusado(await servico.arquivar(c.admin, padrao.funil.id)).codigo).toBe("FUNIL_PADRAO");
    const privatizar = recusado(await servico.editar(c.admin, padrao.funil.id, { privado: true }));
    expect(privatizar.status).toBe(409);
    expect(privatizar.codigo).toBe("FUNIL_PADRAO");
  });

  it("(g) migrarNegocios move funil e etapa juntos; mapeamento incompleto é 409; destino de outro Espaço ou inexistente é 404", async () => {
    const c = await espaco("fmigrar");
    const outro = await espaco("fmigrarb");
    await funil(c, "Padrão");
    const origem = await funil(c, "Origem", ["A", "B"]);
    const destino = await funil(c, "Destino", ["X", "Y"]);
    const contato = await semearContato(c.ws);
    const n1 = await semearNegocio(c.ws, contato, origem.funil.id, origem.etapas[0]!.id);
    const n2 = await semearNegocio(c.ws, contato, origem.funil.id, origem.etapas[0]!.id, { estado: "na_lixeira" });
    const etapaA = origem.etapas[0]!.id;

    const incompleto = recusado(await servico.migrarNegocios(c.admin, origem.funil.id, { paraFunilId: destino.funil.id, mapeamento: {} }));
    expect(incompleto.status).toBe(409);
    expect(incompleto.codigo).toBe("MIGRACAO_INVALIDA");

    const deOutroFunil = recusado(
      await servico.migrarNegocios(c.admin, origem.funil.id, {
        paraFunilId: destino.funil.id,
        mapeamento: { [etapaA]: origem.etapas[1]!.id },
      }),
    );
    expect(deOutroFunil.status).toBe(409);

    const paraSiMesmo = recusado(
      await servico.migrarNegocios(c.admin, origem.funil.id, { paraFunilId: origem.funil.id, mapeamento: { [etapaA]: etapaA } }),
    );
    expect(paraSiMesmo.status).toBe(409);

    const estranho = await funil(outro, "De outro Espaço", ["Z"]);
    const deOutroEspaco = recusado(
      await servico.migrarNegocios(c.admin, origem.funil.id, {
        paraFunilId: estranho.funil.id,
        mapeamento: { [etapaA]: estranho.etapas[0]!.id },
      }),
    );
    expect(deOutroEspaco.status).toBe(404);
    const inexistente = recusado(
      await servico.migrarNegocios(c.admin, origem.funil.id, { paraFunilId: "nao-existe", mapeamento: { [etapaA]: "x" } }),
    );
    expect(inexistente.status).toBe(404);

    const migrados = valor(
      await servico.migrarNegocios(c.admin, origem.funil.id, {
        paraFunilId: destino.funil.id,
        mapeamento: { [etapaA]: destino.etapas[1]!.id },
      }),
    );
    expect(migrados.migrados).toBe(2);
    for (const id of [n1, n2]) {
      expect(await negocioNoBanco(c.ws, id)).toMatchObject({ funil_id: destino.funil.id, etapa_id: destino.etapas[1]!.id });
    }

    const lixeira = valor(await servico.enviarParaLixeira(c.admin, origem.funil.id));
    expect(lixeira.funil.estado).toBe("na_lixeira");
  });

  it("(h) restaurar com o nome reusado é 409; excluir de vez só da lixeira e sem Negócio", async () => {
    const c = await espaco("frestaurar");
    await funil(c, "Padrão");
    const antigo = await funil(c, "Antigo", ["A"]);
    valor(await servico.enviarParaLixeira(c.admin, antigo.funil.id));
    await funil(c, "Antigo", ["A"]);
    const colisao = recusado(await servico.restaurar(c.admin, antigo.funil.id));
    expect(colisao.status).toBe(409);
    expect(colisao.codigo).toBe("FUNIL_NOME_EM_USO");

    const foraDaLixeira = await funil(c, "Ativo", ["A"]);
    const recusaAtivo = recusado(await servico.excluirPermanentemente(c.admin, foraDaLixeira.funil.id));
    expect(recusaAtivo.status).toBe(409);
    expect(recusaAtivo.codigo).toBe("FUNIL_FORA_DA_LIXEIRA");

    const apagavel = await funil(c, "Apagável", ["A"]);
    valor(await servico.enviarParaLixeira(c.admin, apagavel.funil.id));
    const apagado = valor(await servico.excluirPermanentemente(c.admin, apagavel.funil.id));
    expect(apagado.id).toBe(apagavel.funil.id);
    const restou = await pool().query("select 1 from plataforma.funis where workspace_id = $1 and id = $2", [c.ws, apagavel.funil.id]);
    const etapasRestantes = await pool().query("select 1 from plataforma.etapas where workspace_id = $1 and funil_id = $2", [c.ws, apagavel.funil.id]);
    expect(restou.rowCount).toBe(0);
    expect(etapasRestantes.rowCount).toBe(0);

    const comNegocio = await funil(c, "Com resto", ["A"]);
    valor(await servico.enviarParaLixeira(c.admin, comNegocio.funil.id));
    const contato = await semearContato(c.ws);
    await semearNegocio(c.ws, contato, comNegocio.funil.id, comNegocio.etapas[0]!.id);
    const bloqueado = recusado(await servico.excluirPermanentemente(c.admin, comNegocio.funil.id));
    expect(bloqueado.status).toBe(409);
    expect(bloqueado.codigo).toBe("FUNIL_COM_NEGOCIOS");
    expect(bloqueado.bloqueios?.negocios?.total).toBe(1);
  });

  it("(i) D-14: o Membro recebe 403 em toda escrita; o Convidado lê", async () => {
    const c = await espaco("fpapel");
    const f = await funil(c, "Vendas", ["A", "B"]);
    const etapa = f.etapas[0]!.id;
    const escritas: Array<[string, () => Promise<ResultadoCrm<unknown>>]> = [
      ["criar", () => servico.criar(c.membro, { nome: "X", etapas: [{ nome: "A" }] })],
      ["editar", () => servico.editar(c.membro, f.funil.id, { nome: "Y" })],
      ["definirPadrao", () => servico.definirPadrao(c.membro, f.funil.id)],
      ["adicionarEtapa", () => servico.adicionarEtapa(c.membro, f.funil.id, { nome: "C" })],
      ["editarEtapa", () => servico.editarEtapa(c.membro, etapa, { nome: "D" })],
      ["reordenarEtapas", () => servico.reordenarEtapas(c.membro, f.funil.id, f.etapas.map((e) => e.id).reverse())],
      ["removerEtapa", () => servico.removerEtapa(c.membro, etapa)],
      ["remapearEtapa", () => servico.remapearEtapa(c.membro, etapa, f.etapas[1]!.id)],
      ["arquivar", () => servico.arquivar(c.membro, f.funil.id)],
      ["restaurar", () => servico.restaurar(c.membro, f.funil.id)],
      ["enviarParaLixeira", () => servico.enviarParaLixeira(c.membro, f.funil.id)],
      ["excluirPermanentemente", () => servico.excluirPermanentemente(c.membro, f.funil.id)],
      ["migrarNegocios", () => servico.migrarNegocios(c.membro, f.funil.id, { paraFunilId: f.funil.id, mapeamento: {} })],
    ];
    for (const [nome, chamar] of escritas) {
      const r = recusado(await chamar());
      expect(`${nome}:${r.status}:${r.codigo}`).toBe(`${nome}:403:PERMISSAO`);
    }
    const convidadoEscreve = recusado(await servico.criar(c.convidado, { nome: "X", etapas: [{ nome: "A" }] }));
    expect(convidadoEscreve.status).toBe(403);

    const lista = valor(await servico.listar(c.convidado, { estado: "ativo", limite: 50, deslocamento: 0 }));
    expect(lista.itens.map((i) => i.funil.nome)).toEqual(["Vendas"]);
    expect(lista.itens[0]).toMatchObject({ totalEtapas: 2, negociosAbertos: 0 });
    const ficha = valor(await servico.obter(c.convidado, f.funil.id));
    expect(nomesDasEtapas(ficha)).toEqual(["A", "B"]);
    const lidoPeloMembro = valor(await servico.obter(c.membro, f.funil.id));
    expect(lidoPeloMembro.funil.nome).toBe("Vendas");
  });

  it("(j) Funil de outro Espaço é 404; privado é só gravado e não esconde nada", async () => {
    const c = await espaco("fisola");
    const outro = await espaco("fisolab");
    const deOutro = await funil(outro, "Do outro", ["A"]);
    const naoAchou = recusado(await servico.obter(c.admin, deOutro.funil.id));
    expect(naoAchou.status).toBe(404);
    expect(recusado(await servico.editar(c.admin, deOutro.funil.id, { nome: "Roubado" })).status).toBe(404);
    expect(recusado(await servico.removerEtapa(c.admin, deOutro.etapas[0]!.id)).status).toBe(404);
    expect(recusado(await servico.arquivar(c.admin, deOutro.funil.id)).status).toBe(404);

    await funil(c, "Padrão");
    const privado = await funil(c, "Privado", ["A"], { privado: true });
    expect(privado.funil.privado).toBe(true);
    const visto = valor(await servico.listar(c.membro, { estado: "ativo", limite: 50, deslocamento: 0 }));
    expect(visto.itens.map((i) => i.funil.nome).sort()).toEqual(["Padrão", "Privado"]);
    expect(visto.total).toBe(2);
  });

  it("(k) editar muda os atributos; nome em uso é 409; editarEtapa renomeia e muda a probabilidade; Funil arquivado não se edita", async () => {
    const c = await espaco("feditar");
    const um = await funil(c, "Um", ["A", "B"]);
    await funil(c, "Dois", ["A"]);
    const editado = valor(await servico.editar(c.admin, um.funil.id, { nome: "Um editado", descricao: "Texto", exigeMotivoPerda: true }));
    expect(editado.funil).toMatchObject({ nome: "Um editado", descricao: "Texto", exigeMotivoPerda: true, padrao: true });
    const limpo = valor(await servico.editar(c.admin, um.funil.id, { descricao: "" }));
    expect(limpo.funil.descricao).toBeNull();

    const colisao = recusado(await servico.editar(c.admin, um.funil.id, { nome: " DOIS " }));
    expect(colisao.status).toBe(409);
    expect(colisao.codigo).toBe("FUNIL_NOME_EM_USO");
    expect(valor(await servico.editar(c.admin, um.funil.id, { nome: "UM EDITADO" })).funil.nome).toBe("UM EDITADO");

    const renomeada = valor(await servico.editarEtapa(c.admin, um.etapas[0]!.id, { nome: "Primeira", probabilidadePadrao: 25 }));
    expect(renomeada.etapas[0]).toMatchObject({ nome: "Primeira", probabilidadePadrao: 25 });
    const igual = recusado(await servico.editarEtapa(c.admin, um.etapas[0]!.id, { nome: " b " }));
    expect(igual.status).toBe(409);
    expect(igual.codigo).toBe("ETAPA_NOME_EM_USO");
    expect(recusado(await servico.editarEtapa(c.admin, um.etapas[0]!.id, { probabilidadePadrao: 101 })).status).toBe(400);

    const dois = await funil(c, "Três", ["A"]);
    valor(await servico.arquivar(c.admin, dois.funil.id));
    const inativo = recusado(await servico.editar(c.admin, dois.funil.id, { nome: "Quatro" }));
    expect(inativo.status).toBe(409);
    expect(inativo.codigo).toBe("FUNIL_INATIVO");
    const restaurado = valor(await servico.restaurar(c.admin, dois.funil.id));
    expect(restaurado.funil.estado).toBe("ativo");
  });
});
