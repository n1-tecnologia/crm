/**
 * Serviço de Empresas e vínculos (07-05, Task 2), contra o Postgres LOCAL.
 *
 * Os casos (a)-(i) do plano: criar Empresa + admin numa transação (D-08),
 * Identificadores (RN-EMP-05), matriz (INV-EMP-05), vínculos e a troca de admin,
 * a lixeira que encerra os vínculos (D-08, RN-EMP-09), restaurar pedindo admin,
 * a exclusão permanente (RN-EMP-10), Papel e isolamento entre Espaços. Funil,
 * Etapa e Negócio de apoio entram por SQL direto: o serviço de Negócios é de
 * 07-08.
 *
 * Rode com `TZ=America/Sao_Paulo` (Pitfall 5).
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { EmpresaDetalhada, NovaEmpresa } from "@n1/dominio/crm/empresas";
import type { MembroDaSessao } from "../../plugins/autenticacao";
import { encerrar, pool } from "../../persistencia/conexao";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearMembro } from "../../testes/banco-crm";
import { criarAcessoAoCrmPg } from "./acesso";
import { criarServicoDeContatos } from "./contatos";
import { criarServicoDeEmpresas } from "./empresas";
import type { ResultadoCrm } from "./resultado";

const acesso = criarAcessoAoCrmPg(pool);
const servico = criarServicoDeEmpresas({ pool, acesso });
const contatos = criarServicoDeContatos({ pool, acesso });

function membro(workspaceId: string, id = "mem_ana"): MembroDaSessao {
  return { id, workspaceId, state: "ativo" };
}

function valor<T>(resultado: ResultadoCrm<T>): T {
  if (!resultado.ok) throw new Error(`esperava sucesso, veio ${resultado.status} ${resultado.codigo ?? ""}: ${resultado.error}`);
  return resultado.valor;
}

function recusado(resultado: ResultadoCrm<unknown>) {
  if (resultado.ok) throw new Error("esperava recusa, veio sucesso");
  return resultado;
}

describeComBanco("ServicoDeEmpresas — Postgres local", () => {
  const ws = novoEspacoDeTeste("svcempresas");
  const outroWs = novoEspacoDeTeste("svcempresasb");
  const eu = membro(ws);
  const convidado = membro(ws, "mem_convidado");

  /** Um Contato ativo do Espaço (ou do outro, com `quem`). */
  async function contato(nome: string, quem = eu): Promise<string> {
    return valor(await contatos.criar(quem, { nome })).contato.id;
  }

  /** Uma Empresa nova com um Contato admin novo; devolve o detalhe e o id do admin. */
  async function empresa(
    nome: string,
    extra: Partial<NovaEmpresa> = {},
  ): Promise<{ detalhe: EmpresaDetalhada; id: string; adminId: string; adminContatoId: string }> {
    const adminContatoId = await contato(`Admin de ${nome}`);
    const detalhe = valor(await servico.criar(eu, { empresa: { nomeFantasia: nome, ...extra }, admin: { contatoId: adminContatoId } }));
    const admin = detalhe.vinculos.find((v) => v.admin)!;
    return { detalhe, id: detalhe.empresa.id, adminId: admin.id, adminContatoId };
  }

  const linhas = async <T extends object>(sql: string, parametros: unknown[]): Promise<T[]> =>
    (await pool().query<T>(sql, parametros)).rows;

  const quantasEmpresas = async (nome: string): Promise<number> =>
    (
      await linhas<{ n: number }>(
        "select count(*)::int as n from plataforma.empresas where workspace_id = $1 and nome_fantasia = $2",
        [ws, nome],
      )
    )[0]!.n;

  const quantosContatos = async (nome: string): Promise<number> =>
    (
      await linhas<{ n: number }>("select count(*)::int as n from plataforma.contatos where workspace_id = $1 and nome = $2", [
        ws,
        nome,
      ])
    )[0]!.n;

  const estadoDaEmpresa = async (id: string): Promise<string | undefined> =>
    (await linhas<{ estado: string }>("select estado from plataforma.empresas where workspace_id = $1 and id = $2", [ws, id]))[0]
      ?.estado;

  const vinculosNoBanco = (empresaId: string) =>
    linhas<{ id: string; contato_id: string; admin: boolean; cargo: string | null; fim: string | null }>(
      `select id, contato_id, admin, cargo, fim::text as fim from plataforma.contato_empresa
        where workspace_id = $1 and empresa_id = $2 order by criado_em, id`,
      [ws, empresaId],
    );

  const hoje = async (): Promise<string> =>
    (await linhas<{ hoje: string }>("select current_date::text as hoje", []))[0]!.hoje;

  /** Funil + Etapa + Negócio da Empresa, por SQL direto. */
  async function semearNegocio(empresaId: string, opcoes: { situacao?: string; estado?: string } = {}): Promise<string> {
    const situacao = opcoes.situacao ?? "aberto";
    const funil = await pool().query<{ id: string }>(
      "insert into plataforma.funis (workspace_id, nome, criado_por) values ($1, $2, 'mem_ana') returning id",
      [ws, `Funil ${Math.random()}`],
    );
    const etapa = await pool().query<{ id: string }>(
      "insert into plataforma.etapas (workspace_id, funil_id, nome, ordem) values ($1, $2, 'Início', 1) returning id",
      [ws, funil.rows[0]!.id],
    );
    const negocio = await pool().query<{ id: string }>(
      `insert into plataforma.negocios
         (workspace_id, titulo, empresa_id, funil_id, etapa_id, situacao, estado, encerrado_em, proprietario_id, criado_por)
       values ($1, 'Negócio de apoio', $2, $3, $4, $5, $6, case when $5 = 'aberto' then null else now() end, 'mem_ana', 'mem_ana')
       returning id`,
      [ws, empresaId, funil.rows[0]!.id, etapa.rows[0]!.id, situacao, opcoes.estado ?? "ativo"],
    );
    return negocio.rows[0]!.id;
  }

  beforeAll(async () => {
    await prepararBancoCrm();
    for (const espaco of [ws, outroWs]) {
      await semearMembro(espaco, { id: "mem_ana", base: "membro", state: "ativo" });
      await semearMembro(espaco, { id: "mem_convidado", base: "convidado", state: "ativo" });
    }
    await semearMembro(ws, { id: "mem_bia", base: "membro", state: "ativo" });
  });

  afterAll(async () => {
    await limparEspaco(ws);
    await limparEspaco(outroWs);
    await encerrar();
  });

  it("(a) criar com Contato existente grava Empresa e vínculo admin; Contato de outro Espaço ou na lixeira não grava nada", async () => {
    const adminId = await contato("Diretora Dora");
    const criada = valor(
      await servico.criar(eu, { empresa: { nomeFantasia: "Acme (a)", razaoSocial: "Acme Ltda" }, admin: { contatoId: adminId, cargo: "Diretora" } }),
    );
    expect(criada.empresa.estado).toBe("ativo");
    expect(criada.empresa.proprietarioId).toBe("mem_ana");
    expect(criada.empresa.criadoPor).toBe("mem_ana");
    expect(criada.vinculos).toHaveLength(1);
    expect(criada.vinculos[0]).toMatchObject({ contatoId: adminId, admin: true, cargo: "Diretora", fim: null });

    const deOutroEspaco = await contato("Estranho", membro(outroWs));
    const outro = recusado(await servico.criar(eu, { empresa: { nomeFantasia: "Acme (a) outro" }, admin: { contatoId: deOutroEspaco } }));
    expect(outro.status).toBe(404);
    expect(await quantasEmpresas("Acme (a) outro")).toBe(0);

    const naLixeira = await contato("Na lixeira");
    await pool().query("update plataforma.contatos set estado = 'na_lixeira' where workspace_id = $1 and id = $2", [ws, naLixeira]);
    const lixeira = recusado(await servico.criar(eu, { empresa: { nomeFantasia: "Acme (a) lixeira" }, admin: { contatoId: naLixeira } }));
    expect(lixeira.status).toBe(409);
    expect(lixeira.codigo).toBe("CONTATO_INATIVO");
    expect(await quantasEmpresas("Acme (a) lixeira")).toBe(0);

    const semNome = recusado(await servico.criar(eu, { empresa: { nomeFantasia: "  " }, admin: { contatoId: adminId } }));
    expect(semNome.status).toBe(409);
    expect(semNome.codigo).toBe("EMPRESA_SEM_NOME");
  });

  it("(b) criar com novoContato grava Contato, Empresa e vínculo juntos; Identificador em uso não deixa nenhuma das três linhas", async () => {
    const criada = valor(
      await servico.criar(eu, {
        empresa: { nomeFantasia: "Acme (b)" },
        admin: { novoContato: { nome: "Bia", identificadores: [{ tipo: "email", valor: "Bia@X.com" }] }, cargo: "Sócia" },
      }),
    );
    const admin = criada.vinculos[0]!;
    expect(admin).toMatchObject({ admin: true, cargo: "Sócia", contatoNome: "Bia" });
    const bia = valor(await contatos.obter(eu, admin.contatoId));
    expect(bia.identificadores[0]).toMatchObject({ tipo: "email", valor: "bia@x.com", principal: true });

    const repetido = recusado(
      await servico.criar(eu, {
        empresa: { nomeFantasia: "Acme (b) repetida" },
        admin: { novoContato: { nome: "Bia2", identificadores: [{ tipo: "email", valor: "bia@x.com" }] } },
      }),
    );
    expect(repetido.status).toBe(409);
    expect(repetido.codigo).toBe("IDENTIFICADOR_EM_USO");
    expect(repetido.bloqueios?.contatos?.[0]?.id).toBe(admin.contatoId);
    expect(await quantasEmpresas("Acme (b) repetida")).toBe(0);
    expect(await quantosContatos("Bia2")).toBe(0);

    const semNada = recusado(
      await servico.criar(eu, { empresa: { nomeFantasia: "Acme (b) sem contato" }, admin: { novoContato: {} } }),
    );
    expect(semNada.status).toBe(409);
    expect(await quantasEmpresas("Acme (b) sem contato")).toBe(0);
  });

  it("(c) domínio de provedor público é recusado; documento já de outra Empresa nomeia a detentora", async () => {
    const adminId = await contato("Admin (c)");
    const publico = recusado(
      await servico.criar(eu, {
        empresa: { nomeFantasia: "Acme (c) gmail", identificadores: [{ tipo: "dominio", valor: "gmail.com" }] },
        admin: { contatoId: adminId },
      }),
    );
    expect(publico.status).toBe(409);
    expect(publico.error).toContain("RN-EMP-05");
    expect(await quantasEmpresas("Acme (c) gmail")).toBe(0);

    const primeira = valor(
      await servico.criar(eu, {
        empresa: {
          nomeFantasia: "Acme (c)",
          identificadores: [
            { tipo: "dominio", valor: "https://www.Acme-C.com.br/" },
            { tipo: "documento_fiscal", valor: "12.345.678/0001-90", pais: "br" },
          ],
        },
        admin: { contatoId: adminId },
      }),
    );
    expect(primeira.identificadores.map((i) => [i.tipo, i.valor, i.principal])).toEqual([
      ["dominio", "acme-c.com.br", true],
      ["documento_fiscal", "12345678000190", true],
    ]);
    expect(primeira.identificadores[1]!.pais).toBe("BR");

    const outroAdmin = await contato("Admin (c) 2");
    const duplicado = recusado(
      await servico.criar(eu, {
        empresa: { nomeFantasia: "Acme (c) clone", identificadores: [{ tipo: "documento_fiscal", valor: "12345678000190", pais: "BR" }] },
        admin: { contatoId: outroAdmin },
      }),
    );
    expect(duplicado.status).toBe(409);
    expect(duplicado.codigo).toBe("IDENTIFICADOR_EM_USO");
    expect(duplicado.bloqueios?.empresas?.[0]?.id).toBe(primeira.empresa.id);
    expect(await quantasEmpresas("Acme (c) clone")).toBe(0);

    const adicionado = valor(await servico.adicionarIdentificador(eu, primeira.empresa.id, { tipo: "telefone", valor: "(11) 3333-4444" }));
    expect(adicionado.identificadores.some((i) => i.tipo === "telefone" && i.principal)).toBe(true);
  });

  it("(d) editar a matriz: ciclo, a própria Empresa e matriz arquivada são 409 MATRIZ_INVALIDA", async () => {
    const a = await empresa("Matriz A (d)");
    const b = await empresa("Filial B (d)", { matrizId: a.id });
    expect(b.detalhe.matriz).toMatchObject({ id: a.id, estado: "ativo" });
    expect(valor(await servico.obter(eu, a.id)).filiais.map((f) => f.id)).toEqual([b.id]);

    const ciclo = recusado(await servico.editar(eu, a.id, { matrizId: b.id }));
    expect(ciclo.status).toBe(409);
    expect(ciclo.codigo).toBe("MATRIZ_INVALIDA");
    const propria = recusado(await servico.editar(eu, a.id, { matrizId: a.id }));
    expect(propria.codigo).toBe("MATRIZ_INVALIDA");

    const arquivada = await empresa("Arquivada (d)");
    valor(await servico.arquivar(eu, arquivada.id));
    const naoAtiva = recusado(await servico.editar(eu, b.id, { matrizId: arquivada.id }));
    expect(naoAtiva.codigo).toBe("MATRIZ_INVALIDA");

    const c = await empresa("Outra matriz (d)");
    const editada = valor(await servico.editar(eu, b.id, { matrizId: c.id, descricao: "Filial do sul" }));
    expect(editada.matriz?.id).toBe(c.id);
    expect(editada.empresa.descricao).toBe("Filial do sul");
    const semMatriz = valor(await servico.editar(eu, b.id, { matrizId: "" }));
    expect(semMatriz.matriz).toBeNull();
  });

  it("(e) vínculos: repetir o par, rebaixar ou encerrar o único admin e trocar o admin", async () => {
    const e = await empresa("Acme (e)");
    const segundo = await contato("Segundo (e)");
    const com = valor(await servico.vincularContato(eu, e.id, { contatoId: segundo, cargo: "Analista" }));
    const vinculoDoSegundo = com.vinculos.find((v) => v.contatoId === segundo)!;
    expect(vinculoDoSegundo).toMatchObject({ admin: false, cargo: "Analista", fim: null });

    const repetido = recusado(await servico.vincularContato(eu, e.id, { contatoId: segundo }));
    expect(repetido.status).toBe(409);
    expect(repetido.codigo).toBe("VINCULO_JA_EXISTE");

    const rebaixar = recusado(await servico.editarVinculo(eu, e.id, e.adminId, { admin: false }));
    expect(rebaixar.status).toBe(409);
    expect(rebaixar.codigo).toBe("ULTIMO_ADMIN");
    const encerrarUnico = recusado(await servico.encerrarVinculo(eu, e.id, e.adminId, {}));
    expect(encerrarUnico.codigo).toBe("ULTIMO_ADMIN");
    expect((await vinculosNoBanco(e.id)).find((v) => v.id === e.adminId)).toMatchObject({ admin: true, fim: null });

    const cargo = valor(await servico.editarVinculo(eu, e.id, vinculoDoSegundo.id, { cargo: "Gerente" }));
    expect(cargo.vinculos.find((v) => v.id === vinculoDoSegundo.id)?.cargo).toBe("Gerente");

    const trocado = valor(
      await servico.trocarAdmin(eu, e.id, { vinculoAtualId: e.adminId, novoAdmin: { contatoId: segundo, cargo: "Diretor" } }),
    );
    const noBanco = await vinculosNoBanco(e.id);
    expect(noBanco.find((v) => v.id === e.adminId)).toMatchObject({ admin: false, fim: null });
    expect(noBanco.find((v) => v.contato_id === segundo)).toMatchObject({ admin: true, fim: null, cargo: "Diretor" });
    expect(trocado.vinculos.filter((v) => v.admin).map((v) => v.contatoId)).toEqual([segundo]);

    // Agora o antigo já não é admin: pode ser encerrado.
    const encerrado = valor(await servico.encerrarVinculo(eu, e.id, e.adminId, {}));
    expect(encerrado.vinculos.find((v) => v.id === e.adminId)?.fim).toBe(await hoje());

    // Trocar com um Contato novo (sem vínculo) insere o vínculo admin.
    const terceiro = await contato("Terceiro (e)");
    valor(await servico.trocarAdmin(eu, e.id, { vinculoAtualId: noBanco.find((v) => v.contato_id === segundo)!.id, novoAdmin: { contatoId: terceiro } }));
    const depois = await vinculosNoBanco(e.id);
    expect(depois.filter((v) => v.admin && v.fim === null).map((v) => v.contato_id)).toEqual([terceiro]);

    const naoEhAdmin = recusado(await servico.trocarAdmin(eu, e.id, { vinculoAtualId: e.adminId, novoAdmin: { contatoId: segundo } }));
    expect(naoEhAdmin.status).toBe(409);
    const inexistente = recusado(await servico.editarVinculo(eu, e.id, "nao-existe", { cargo: "X" }));
    expect(inexistente.status).toBe(404);
  });

  it("(f) a lixeira recusa Negócio aberto e filial ativa/arquivada; sem bloqueio encerra os vínculos e preserva os Contatos", async () => {
    const comNegocio = await empresa("Acme (f) negócio");
    const aberto = await semearNegocio(comNegocio.id);
    const bloqueadaPorNegocio = recusado(await servico.enviarParaLixeira(eu, comNegocio.id));
    expect(bloqueadaPorNegocio.status).toBe(409);
    expect(bloqueadaPorNegocio.codigo).toBe("EMPRESA_BLOQUEADA");
    expect(bloqueadaPorNegocio.bloqueios?.negocios?.total).toBe(1);
    expect(await estadoDaEmpresa(comNegocio.id)).toBe("ativo");
    expect((await vinculosNoBanco(comNegocio.id))[0]!.fim).toBeNull();

    // Negócio ganho ou na lixeira não bloqueia a lixeira (RN-EMP-09 só olha os abertos).
    await pool().query(
      "update plataforma.negocios set situacao = 'ganho', encerrado_em = now() where workspace_id = $1 and id = $2",
      [ws, aberto],
    );
    await semearNegocio(comNegocio.id, { estado: "na_lixeira" });
    const liberada = valor(await servico.enviarParaLixeira(eu, comNegocio.id));
    expect(liberada.empresa.estado).toBe("na_lixeira");

    const matriz = await empresa("Matriz (f)");
    const filial = await empresa("Filial (f)", { matrizId: matriz.id });
    const comFilial = recusado(await servico.enviarParaLixeira(eu, matriz.id));
    expect(comFilial.codigo).toBe("EMPRESA_BLOQUEADA");
    expect(comFilial.bloqueios?.filiais?.map((f) => f.id)).toEqual([filial.id]);
    valor(await servico.arquivar(eu, filial.id));
    expect(recusado(await servico.enviarParaLixeira(eu, matriz.id)).codigo).toBe("EMPRESA_BLOQUEADA");

    valor(await servico.enviarParaLixeira(eu, filial.id));
    const semBloqueio = valor(await servico.enviarParaLixeira(eu, matriz.id));
    expect(semBloqueio.empresa.estado).toBe("na_lixeira");
    const encerrados = await vinculosNoBanco(matriz.id);
    expect(encerrados.map((v) => v.fim)).toEqual([await hoje()]);
    const admin = valor(await contatos.obter(eu, matriz.adminContatoId));
    expect(admin.contato.estado).toBe("ativo");
    expect(recusado(await servico.enviarParaLixeira(eu, matriz.id)).codigo).toBe("TRANSICAO_INVALIDA");
  });

  it("(g) restaurar da lixeira pede o admin; de arquivada não pede", async () => {
    const e = await empresa("Acme (g)");
    valor(await servico.enviarParaLixeira(eu, e.id));

    const semAdmin = recusado(await servico.restaurar(eu, e.id, {}));
    expect(semAdmin.status).toBe(409);
    expect(semAdmin.codigo).toBe("EMPRESA_SEM_ADMIN");
    expect(await estadoDaEmpresa(e.id)).toBe("na_lixeira");

    const deOutroEspaco = await contato("Estranho (g)", membro(outroWs));
    expect(recusado(await servico.restaurar(eu, e.id, { admin: { contatoId: deOutroEspaco } })).status).toBe(404);
    expect(await estadoDaEmpresa(e.id)).toBe("na_lixeira");

    const novoAdmin = await contato("Novo admin (g)");
    const restaurada = valor(await servico.restaurar(eu, e.id, { admin: { contatoId: novoAdmin, cargo: "Gestora" } }));
    expect(restaurada.empresa.estado).toBe("ativo");
    const vinculos = await vinculosNoBanco(e.id);
    expect(vinculos).toHaveLength(2);
    expect(vinculos.filter((v) => v.fim !== null)).toHaveLength(1);
    expect(vinculos.find((v) => v.fim === null)).toMatchObject({ contato_id: novoAdmin, admin: true, cargo: "Gestora" });

    const arquivada = await empresa("Acme (g) arquivada");
    valor(await servico.arquivar(eu, arquivada.id));
    expect(await estadoDaEmpresa(arquivada.id)).toBe("arquivado");
    const volta = valor(await servico.restaurar(eu, arquivada.id, {}));
    expect(volta.empresa.estado).toBe("ativo");
    expect(recusado(await servico.restaurar(eu, arquivada.id, {})).codigo).toBe("TRANSICAO_INVALIDA");
  });

  it("(h) excluir de vez: só da lixeira, sem Negócio nem filial; os Contatos ficam", async () => {
    const ativa = await empresa("Acme (h) ativa");
    const foraDaLixeira = recusado(await servico.excluirPermanentemente(eu, ativa.id));
    expect(foraDaLixeira.status).toBe(409);
    expect(foraDaLixeira.codigo).toBe("EMPRESA_FORA_DA_LIXEIRA");

    const comNegocio = await empresa("Acme (h) negócio");
    await semearNegocio(comNegocio.id, { situacao: "perdido" });
    valor(await servico.enviarParaLixeira(eu, comNegocio.id));
    const bloqueadaPorNegocio = recusado(await servico.excluirPermanentemente(eu, comNegocio.id));
    expect(bloqueadaPorNegocio.codigo).toBe("EMPRESA_COM_NEGOCIOS");
    expect(bloqueadaPorNegocio.bloqueios?.negocios?.total).toBe(1);

    const matriz = await empresa("Matriz (h)");
    const filial = await empresa("Filial (h)", { matrizId: matriz.id });
    valor(await servico.enviarParaLixeira(eu, filial.id));
    valor(await servico.restaurar(eu, filial.id, { admin: { contatoId: filial.adminContatoId } }));
    await pool().query("update plataforma.empresas set estado = 'na_lixeira' where workspace_id = $1 and id = $2", [ws, matriz.id]);
    const bloqueadaPorFilial = recusado(await servico.excluirPermanentemente(eu, matriz.id));
    expect(bloqueadaPorFilial.codigo).toBe("EMPRESA_COM_FILIAIS");
    expect(bloqueadaPorFilial.bloqueios?.filiais?.map((f) => f.id)).toEqual([filial.id]);

    const livre = await empresa("Acme (h) livre", { identificadores: [{ tipo: "dominio", valor: "livre-h.com" }] });
    valor(await servico.enviarParaLixeira(eu, livre.id));
    expect(valor(await servico.excluirPermanentemente(eu, livre.id))).toEqual({ id: livre.id });
    expect(await estadoDaEmpresa(livre.id)).toBeUndefined();
    expect(await vinculosNoBanco(livre.id)).toHaveLength(0);
    expect(valor(await contatos.obter(eu, livre.adminContatoId)).contato.estado).toBe("ativo");
    expect(recusado(await servico.obter(eu, livre.id)).status).toBe(404);
  });

  it("(i) Membro cria e exclui; Convidado só lê; Empresa de outro Espaço é 404; a lista respeita o Espaço e a busca", async () => {
    const bia = membro(ws, "mem_bia");
    const adminId = await contato("Admin (i)");
    const criada = valor(
      await servico.criar(bia, {
        empresa: { nomeFantasia: "Acme (i) listável", identificadores: [{ tipo: "dominio", valor: "listavel-i.com" }] },
        admin: { contatoId: adminId },
      }),
    );
    expect(criada.empresa.criadoPor).toBe("mem_bia");
    expect(criada.empresa.proprietarioId).toBe("mem_bia");

    expect(recusado(await servico.criar(convidado, { empresa: { nomeFantasia: "Nao (i)" }, admin: { contatoId: adminId } })).status).toBe(403);
    expect(recusado(await servico.editar(convidado, criada.empresa.id, { descricao: "x" })).status).toBe(403);
    expect(recusado(await servico.arquivar(convidado, criada.empresa.id)).status).toBe(403);
    expect(recusado(await servico.enviarParaLixeira(convidado, criada.empresa.id)).status).toBe(403);
    expect(recusado(await servico.vincularContato(convidado, criada.empresa.id, { contatoId: adminId })).status).toBe(403);
    expect(valor(await servico.obter(convidado, criada.empresa.id)).empresa.id).toBe(criada.empresa.id);

    const doOutroEspaco = membro(outroWs);
    expect(recusado(await servico.obter(doOutroEspaco, criada.empresa.id)).status).toBe(404);
    expect(recusado(await servico.editar(doOutroEspaco, criada.empresa.id, { descricao: "x" })).status).toBe(404);
    expect(recusado(await servico.enviarParaLixeira(doOutroEspaco, criada.empresa.id)).status).toBe(404);

    const achadas = valor(await servico.listar(eu, { estado: "ativo", q: "listavel-i", limite: 10, deslocamento: 0 }));
    expect(achadas.total).toBe(1);
    expect(achadas.itens[0]).toMatchObject({ id: criada.empresa.id, nomeDeExibicao: "Acme (i) listável", dominioPrincipal: "listavel-i.com" });
    const nenhuma = valor(await servico.listar(doOutroEspaco, { estado: "ativo", q: "listavel-i", limite: 10, deslocamento: 0 }));
    expect(nenhuma.total).toBe(0);
    const curinga = valor(await servico.listar(eu, { estado: "ativo", q: "%", limite: 10, deslocamento: 0 }));
    expect(curinga.total).toBe(0);

    expect(valor(await servico.enviarParaLixeira(bia, criada.empresa.id)).empresa.estado).toBe("na_lixeira");
    expect(valor(await servico.excluirPermanentemente(bia, criada.empresa.id))).toEqual({ id: criada.empresa.id });
  });
});
