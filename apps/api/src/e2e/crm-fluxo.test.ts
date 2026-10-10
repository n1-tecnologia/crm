/**
 * O critério da Fase 7, ponta a ponta, sem navegador (ver `CONTEXT.md` desta
 * pasta): Contatos, Empresas, Funis e Negócios criados, lidos, editados e
 * excluídos pela api, com isolamento de Espaço e permissão do Papel aplicados
 * no backend — tudo por `app.inject()` sobre `buildApp()` com serviços,
 * repositórios e acesso REAIS, contra o Postgres LOCAL (`testes/banco-crm.ts`,
 * nunca o pooler do Supabase).
 *
 * Um cenário só, em `it`s sequenciais que compartilham estado:
 *
 *   (d) Administrador cria o Funil "Vendas" (vira padrão, D-13) com
 *       `exigeValorGanho`; Membro cria o Contato "Ana" e a Empresa "Alfa" com a
 *       Ana como admin (D-08); Membro cria um Negócio sem Funil → cai em
 *       "Vendas", na Etapa inicial; move; ganhar sem valor → 409
 *       `NEGOCIO_EXIGE_VALOR` (D-05); com valor → `ganho`; reabrir como Membro
 *       → 403, como Administrador → `aberto` (D-14).
 *   (e) Lixeira de Contato bloqueada (D-09, `bloqueios.empresas` e
 *       `bloqueios.negocios`); lixeira de Funil bloqueada por ser o padrão e
 *       depois por ter Negócios (D-07), resolvida pela migração dos Negócios
 *       para "Pós-venda".
 *   (f) Um Membro de OUTRO Espaço recebe 404 no Negócio e lista vazia de
 *       Contatos (D-10): o filtro é o `workspace_id` da sessão, no servidor.
 *
 * Rode com `TZ=America/Sao_Paulo` (Pitfall 5).
 */

import { afterAll, beforeAll, expect, it } from "vitest";
import { buildSeed } from "@n1/dominio/seed";
import type { BloqueiosCrm } from "@n1/dominio/crm/comum";
import { buildApp } from "../app";
import { encerrar } from "../persistencia/conexao";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearMembro } from "../testes/banco-crm";

/** Token → quem é a sessão. O `sub` é o Usuário; o `membroId` é a linha de `members` que `semearMembro` grava. */
const SESSOES = {
  "token-admin": { sub: "usuario-admin", membroId: "mem_admin" },
  "token-membro": { sub: "usuario-ana", membroId: "mem_ana" },
  "token-de-fora": { sub: "usuario-bia", membroId: "mem_bia" },
} as const;

const ADMIN = { authorization: "Bearer token-admin" };
const MEMBRO = { authorization: "Bearer token-membro" };
const DE_FORA = { authorization: "Bearer token-de-fora" };

const membroBase = buildSeed().members.find((m) => m.id === "mem_maryane")!;

/** Um `buildApp()` real por Espaço: o `workspaceId` vem da configuração do servidor, nunca do cliente (T-1-02). */
function appDoEspaco(workspaceId: string) {
  return buildApp({
    logger: false,
    workspaceId,
    verificarToken: async (token) => {
      const sessao = SESSOES[token as keyof typeof SESSOES];
      return sessao ? { sub: sessao.sub } : null;
    },
    resolverMembro: async (_workspaceId, userId) => {
      const sessao = Object.values(SESSOES).find((s) => s.sub === userId);
      return sessao ? { ...membroBase, id: sessao.membroId, userId, state: "ativo" as const } : undefined;
    },
  });
}

interface Envelope {
  ok: boolean;
  dados?: Record<string, unknown>;
  itens?: unknown[];
  total?: number;
  error?: string;
  codigo?: string;
  campo?: string;
  bloqueios?: BloqueiosCrm;
}

type Metodo = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

describeComBanco("Fase 7 ponta a ponta: o CRM inteiro pelo HTTP, com acesso e isolamento no backend", () => {
  const espacoA = novoEspacoDeTeste("fluxoa");
  const espacoB = novoEspacoDeTeste("fluxob");

  async function chamar(metodo: Metodo, url: string, headers: Record<string, string>, payload?: unknown, workspaceId = espacoA) {
    const resposta = await appDoEspaco(workspaceId).inject({
      method: metodo,
      url,
      headers,
      ...(payload !== undefined ? { payload: payload as object } : {}),
    });
    return { status: resposta.statusCode, corpo: resposta.json() as Envelope };
  }

  const dados = <T>(corpo: Envelope): T => corpo.dados as T;

  let vendasId: string;
  let etapasDeVendas: readonly { id: string; nome: string }[];
  let anaId: string;
  let alfaId: string;
  let negocioId: string;
  let posVendaId: string;
  let etapasDePosVenda: readonly { id: string; nome: string }[];

  beforeAll(async () => {
    await prepararBancoCrm();
    await semearMembro(espacoA, { id: "mem_admin", base: "administrador", state: "ativo" });
    await semearMembro(espacoA, { id: "mem_ana", base: "membro", state: "ativo" });
    await semearMembro(espacoB, { id: "mem_bia", base: "membro", state: "ativo" });
  });

  afterAll(async () => {
    await limparEspaco(espacoA);
    await limparEspaco(espacoB);
    await encerrar();
  });

  it("(d1) o Administrador cria o Funil Vendas com exigeValorGanho e ele nasce padrão (D-13); o Membro não configura Funis (D-14)", async () => {
    const recusado = await chamar("POST", "/funis", MEMBRO, { nome: "Do Membro", etapas: [{ nome: "Única" }] });
    expect(recusado.status).toBe(403);
    expect(recusado.corpo).toMatchObject({ ok: false, codigo: "PERMISSAO" });

    const criado = await chamar("POST", "/funis", ADMIN, {
      nome: "Vendas",
      exigeValorGanho: true,
      etapas: [
        { nome: "Novo", probabilidadePadrao: 10 },
        { nome: "Proposta", probabilidadePadrao: 50 },
        { nome: "Fechamento", probabilidadePadrao: 80 },
      ],
    });
    expect(criado.status).toBe(201);
    const funil = dados<{ funil: { id: string; padrao: boolean; exigeValorGanho: boolean }; etapas: { id: string; nome: string }[] }>(criado.corpo);
    expect(funil.funil.padrao).toBe(true);
    expect(funil.funil.exigeValorGanho).toBe(true);
    expect(funil.etapas.map((e) => e.nome)).toEqual(["Novo", "Proposta", "Fechamento"]);
    vendasId = funil.funil.id;
    etapasDeVendas = funil.etapas;
  });

  it("(d2) o Membro cria o Contato Ana com e-mail e a Empresa Alfa com a Ana como admin (D-08)", async () => {
    const contato = await chamar("POST", "/contatos", MEMBRO, {
      nome: "Ana",
      identificadores: [{ tipo: "email", valor: "Ana@Alfa.com.br" }],
    });
    expect(contato.status).toBe(201);
    const ficha = dados<{ contato: { id: string; nome: string; proprietarioId: string }; identificadores: { tipo: string; valor: string }[] }>(contato.corpo);
    expect(ficha.contato.nome).toBe("Ana");
    expect(ficha.contato.proprietarioId).toBe("mem_ana");
    expect(ficha.identificadores).toHaveLength(1);
    expect(ficha.identificadores[0]).toMatchObject({ tipo: "email", valor: "ana@alfa.com.br" });
    anaId = ficha.contato.id;

    const empresa = await chamar("POST", "/empresas", MEMBRO, { empresa: { nomeFantasia: "Alfa" }, admin: { contatoId: anaId, cargo: "Sócia" } });
    expect(empresa.status).toBe(201);
    const alfa = dados<{ empresa: { id: string }; vinculos: { contatoId: string; admin: boolean; cargo: string | null }[] }>(empresa.corpo);
    expect(alfa.vinculos).toHaveLength(1);
    expect(alfa.vinculos[0]).toMatchObject({ contatoId: anaId, admin: true, cargo: "Sócia" });
    alfaId = alfa.empresa.id;

    const lida = await chamar("GET", `/empresas/${alfaId}`, MEMBRO);
    expect(lida.status).toBe(200);
    expect(dados<{ empresa: { nomeFantasia: string } }>(lida.corpo).empresa.nomeFantasia).toBe("Alfa");
  });

  it("(d3) o Membro cria um Negócio sem Funil: cai em Vendas, na Etapa inicial; move para a segunda Etapa", async () => {
    const criado = await chamar("POST", "/negocios", MEMBRO, { titulo: "Contrato da Ana", contatoId: anaId });
    expect(criado.status).toBe(201);
    const negocio = dados<{ negocio: { id: string; funilId: string; etapaId: string; situacao: string }; etapa: { nome: string }; probabilidadeEfetiva: number }>(criado.corpo);
    expect(negocio.negocio.funilId).toBe(vendasId);
    expect(negocio.negocio.etapaId).toBe(etapasDeVendas[0]!.id);
    expect(negocio.negocio.situacao).toBe("aberto");
    expect(negocio.probabilidadeEfetiva).toBe(10);
    negocioId = negocio.negocio.id;

    const movido = await chamar("POST", `/negocios/${negocioId}/mover`, MEMBRO, { etapaId: etapasDeVendas[1]!.id });
    expect(movido.status).toBe(200);
    const depois = dados<{ negocio: { etapaId: string }; etapa: { nome: string }; probabilidadeEfetiva: number }>(movido.corpo);
    expect(depois.negocio.etapaId).toBe(etapasDeVendas[1]!.id);
    expect(depois.etapa.nome).toBe("Proposta");
    expect(depois.probabilidadeEfetiva).toBe(50);
  });

  it("(d4) ganhar sem valor é 409 NEGOCIO_EXIGE_VALOR (D-05); com valor vira ganho; reabrir é 403 para o Membro e 200 para o Administrador (D-14)", async () => {
    const semValor = await chamar("POST", `/negocios/${negocioId}/ganhar`, MEMBRO);
    expect(semValor.status).toBe(409);
    expect(semValor.corpo).toMatchObject({ ok: false, codigo: "NEGOCIO_EXIGE_VALOR", campo: "valor" });

    const ganho = await chamar("POST", `/negocios/${negocioId}/ganhar`, MEMBRO, { valor: "12000.00" });
    expect(ganho.status).toBe(200);
    const ganhoLido = dados<{ negocio: { situacao: string; valor: string | null; encerradoEm: string | null } }>(ganho.corpo);
    expect(ganhoLido.negocio.situacao).toBe("ganho");
    expect(ganhoLido.negocio.valor).toBe("12000.00");
    expect(ganhoLido.negocio.encerradoEm).not.toBeNull();

    const recusado = await chamar("POST", `/negocios/${negocioId}/reabrir`, MEMBRO);
    expect(recusado.status).toBe(403);
    expect(recusado.corpo).toMatchObject({ ok: false, codigo: "PERMISSAO" });

    const reaberto = await chamar("POST", `/negocios/${negocioId}/reabrir`, ADMIN);
    expect(reaberto.status).toBe(200);
    const aberto = dados<{ negocio: { situacao: string; etapaId: string; encerradoEm: string | null } }>(reaberto.corpo);
    expect(aberto.negocio.situacao).toBe("aberto");
    expect(aberto.negocio.etapaId).toBe(etapasDeVendas[1]!.id);
    expect(aberto.negocio.encerradoEm).toBeNull();
  });

  it("(e1) a lixeira da Ana é recusada com 409 CONTATO_BLOQUEADO listando a Alfa e o Negócio (D-09)", async () => {
    const recusado = await chamar("DELETE", `/contatos/${anaId}`, MEMBRO);
    expect(recusado.status).toBe(409);
    expect(recusado.corpo).toMatchObject({ ok: false, codigo: "CONTATO_BLOQUEADO" });
    expect(recusado.corpo.bloqueios?.empresas).toEqual([{ id: alfaId, nome: "Alfa" }]);
    expect(recusado.corpo.bloqueios?.negocios).toEqual({ total: 1, itens: [{ id: negocioId, titulo: "Contrato da Ana" }] });

    const aindaAtiva = await chamar("GET", `/contatos/${anaId}`, MEMBRO);
    expect(dados<{ contato: { estado: string } }>(aindaAtiva.corpo).contato.estado).toBe("ativo");
  });

  it("(e2) a lixeira de Vendas é recusada enquanto é o padrão (FUNIL_PADRAO) e, com outro padrão, enquanto tem Negócios (FUNIL_COM_NEGOCIOS, D-07)", async () => {
    const padrao = await chamar("DELETE", `/funis/${vendasId}`, ADMIN);
    expect(padrao.status).toBe(409);
    expect(padrao.corpo).toMatchObject({ ok: false, codigo: "FUNIL_PADRAO" });

    const criado = await chamar("POST", "/funis", ADMIN, {
      nome: "Pós-venda",
      etapas: [{ nome: "Onboarding", probabilidadePadrao: 90 }, { nome: "Renovação", probabilidadePadrao: 95 }],
    });
    expect(criado.status).toBe(201);
    const posVenda = dados<{ funil: { id: string; padrao: boolean }; etapas: { id: string; nome: string }[] }>(criado.corpo);
    expect(posVenda.funil.padrao).toBe(false);
    posVendaId = posVenda.funil.id;
    etapasDePosVenda = posVenda.etapas;

    const novoPadrao = await chamar("POST", `/funis/${posVendaId}/padrao`, ADMIN);
    expect(novoPadrao.status).toBe(200);
    expect(dados<{ funil: { padrao: boolean } }>(novoPadrao.corpo).funil.padrao).toBe(true);
    const vendasLido = await chamar("GET", `/funis/${vendasId}`, ADMIN);
    expect(dados<{ funil: { padrao: boolean } }>(vendasLido.corpo).funil.padrao).toBe(false);

    const comNegocios = await chamar("DELETE", `/funis/${vendasId}`, ADMIN);
    expect(comNegocios.status).toBe(409);
    expect(comNegocios.corpo).toMatchObject({ ok: false, codigo: "FUNIL_COM_NEGOCIOS" });
    expect(comNegocios.corpo.bloqueios?.negocios?.total).toBe(1);
  });

  it("(e3) migrar os Negócios de Vendas para Pós-venda libera a lixeira de Vendas (200)", async () => {
    const migrado = await chamar("POST", `/funis/${vendasId}/migrar-negocios`, ADMIN, {
      paraFunilId: posVendaId,
      mapeamento: { [etapasDeVendas[1]!.id]: etapasDePosVenda[0]!.id },
    });
    expect(migrado.status).toBe(200);
    expect(dados<{ migrados: number }>(migrado.corpo).migrados).toBe(1);

    const negocio = await chamar("GET", `/negocios/${negocioId}`, MEMBRO);
    const lido = dados<{ negocio: { funilId: string; etapaId: string }; funil: { nome: string } }>(negocio.corpo);
    expect(lido.negocio.funilId).toBe(posVendaId);
    expect(lido.negocio.etapaId).toBe(etapasDePosVenda[0]!.id);
    expect(lido.funil.nome).toBe("Pós-venda");

    const lixeira = await chamar("DELETE", `/funis/${vendasId}`, ADMIN);
    expect(lixeira.status).toBe(200);
    expect(dados<{ funil: { estado: string } }>(lixeira.corpo).funil.estado).toBe("na_lixeira");

    const ativos = await chamar("GET", "/funis", ADMIN);
    expect((ativos.corpo.itens as { funil: { id: string } }[]).map((f) => f.funil.id)).toEqual([posVendaId]);
  });

  it("(f) um Membro de outro Espaço recebe 404 no Negócio e lista vazia de Contatos (D-10)", async () => {
    const negocio = await chamar("GET", `/negocios/${negocioId}`, DE_FORA, undefined, espacoB);
    expect(negocio.status).toBe(404);
    expect(negocio.corpo).toMatchObject({ ok: false, codigo: "NEGOCIO_NAO_ENCONTRADO" });

    const contatos = await chamar("GET", "/contatos", DE_FORA, undefined, espacoB);
    expect(contatos.status).toBe(200);
    expect(contatos.corpo).toMatchObject({ ok: true, itens: [], total: 0 });

    // E o inverso: a Bia não tem Papel no Espaço A — o serviço lê `members` → `roles` DESTE
    // Espaço (D-14) e recusa com 403 mesmo que a sessão chegue resolvida.
    const semPapel = await chamar("GET", "/contatos", DE_FORA);
    expect(semPapel.status).toBe(403);
    expect(semPapel.corpo).toMatchObject({ ok: false, codigo: "PERMISSAO" });
  });
});
