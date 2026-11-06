/**
 * Serviço do Início (15-18, 3.4.7, UCR-07), contra o Postgres LOCAL.
 *
 * O agregado do Início sai somado do servidor: panorama, Leads a atender e estatísticas
 * do Membro. O traçador é o panorama (Contatos recentes, Negócios abertos e Conversas
 * ativas não resolvidas); depois vêm os Leads e as estatísticas. Tudo é leitura: nada
 * grava e a revisão do Espaço não sobe.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { MembroDaSessao } from "../../plugins/autenticacao";
import { encerrar, pool } from "../../persistencia/conexao";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearCanal, semearMembro } from "../../testes/banco-crm";
import { criarAcessoAoCrmPg } from "./acesso";
import { criarServicoDoInicio } from "./inicio";
import type { ResultadoCrm } from "./resultado";

// A matriz de hoje não tem Papel que leia um recurso e não outro. Para provar que o bloco some POR
// RECURSO, o Convidado perde `ler` em `negocio` só neste arquivo; o resto da matriz é a de verdade.
vi.mock("@n1/dominio/crm/permissoes", async (original) => {
  const real = await original<typeof import("@n1/dominio/crm/permissoes")>();
  return {
    ...real,
    podeNoCrm: ((base, estado, acao, recurso, contexto) =>
      base === "convidado" && acao === "ler" && recurso === "negocio"
        ? "O Convidado não consulta Negócios (papel de teste)."
        : real.podeNoCrm(base, estado, acao, recurso, contexto)) satisfies typeof real.podeNoCrm,
  };
});

const acesso = criarAcessoAoCrmPg(pool);
const servico = criarServicoDoInicio({ pool, acesso });

function membro(workspaceId: string, id = "mem_ana"): MembroDaSessao {
  return { id, workspaceId, state: "ativo" };
}

function valor<T>(resultado: ResultadoCrm<T>): T {
  if (!resultado.ok) throw new Error(`esperava sucesso, veio ${resultado.status} ${resultado.codigo ?? ""}: ${resultado.error}`);
  return resultado.valor;
}

describeComBanco("ServicoDoInicio — Postgres local", () => {
  const espacos: string[] = [];

  async function inserir(sql: string, parametros: readonly unknown[]): Promise<string> {
    const { rows } = await pool().query<{ id: string }>(sql, [...parametros]);
    return rows[0]!.id;
  }

  /** Um Espaço novo por teste, com os três Membros que os casos usam. */
  async function novoEspaco(rotulo: string): Promise<string> {
    const ws = novoEspacoDeTeste(rotulo);
    espacos.push(ws);
    await semearMembro(ws, { id: "mem_ana", base: "membro", state: "ativo" });
    await semearMembro(ws, { id: "mem_bia", base: "membro", state: "ativo" });
    await semearMembro(ws, { id: "mem_convidado", base: "convidado", state: "ativo" });
    return ws;
  }

  /** Contato por SQL. `criadoEm` é um instante ISO: a ordem dos recentes depende dele. */
  const semearContato = (
    ws: string,
    nome: string | null,
    opcoes: { readonly estado?: string; readonly criadoEm?: string; readonly proprietario?: string; readonly qualificacao?: string; readonly sobrenome?: string } = {},
  ) =>
    inserir(
      `insert into plataforma.contatos (workspace_id, nome, sobrenome, estado, proprietario_id, qualificacao, criado_por, criado_em)
       values ($1, $2, $3, $4, $5, $6, 'mem_ana', coalesce($7::timestamptz, now())) returning id`,
      [ws, nome, opcoes.sobrenome ?? null, opcoes.estado ?? "ativo", opcoes.proprietario ?? "mem_ana", opcoes.qualificacao ?? null, opcoes.criadoEm ?? null],
    );

  /** Funil com UMA Etapa de probabilidade padrão `probabilidadePadrao`. */
  async function semearFunilComEtapa(ws: string, probabilidadePadrao: number): Promise<{ funilId: string; etapaId: string }> {
    const funilId = await inserir(`insert into plataforma.funis (workspace_id, nome, criado_por) values ($1, 'Funil do Início', 'mem_ana') returning id`, [ws]);
    const etapaId = await inserir(
      `insert into plataforma.etapas (workspace_id, funil_id, nome, ordem, probabilidade_padrao) values ($1, $2, 'Inicio', 1, $3) returning id`,
      [ws, funilId, probabilidadePadrao],
    );
    return { funilId, etapaId };
  }

  const semearNegocio = (
    ws: string,
    funil: { funilId: string; etapaId: string },
    contatoId: string,
    opcoes: { readonly valor?: number | null; readonly moeda?: string; readonly probabilidade?: number | null; readonly situacao?: string; readonly encerradoEm?: string; readonly proprietario?: string; readonly estado?: string } = {},
  ) =>
    inserir(
      `insert into plataforma.negocios
         (workspace_id, titulo, contato_id, funil_id, etapa_id, valor, moeda, probabilidade, situacao, encerrado_em, estado, proprietario_id, criado_por)
       values ($1, 'Negócio do Início', $2, $3, $4, $5, $6, $7, $8, $9::timestamptz, $10, $11, 'mem_ana') returning id`,
      [
        ws,
        contatoId,
        funil.funilId,
        funil.etapaId,
        opcoes.valor ?? null,
        opcoes.moeda ?? "BRL",
        opcoes.probabilidade ?? null,
        opcoes.situacao ?? "aberto",
        opcoes.encerradoEm ?? null,
        opcoes.estado ?? "ativo",
        opcoes.proprietario ?? "mem_ana",
      ],
    );

  const semearCanalDoEspaco = (ws: string) =>
    semearCanal(ws, { nome: "WhatsApp do Início", tipo: "whatsapp", provedor: "whatsapp-cloud", identificadorExterno: `55119${ws.slice(-8).replace(/\D/g, "0")}` });

  const semearConversa = (
    ws: string,
    canalId: string,
    contatoId: string,
    opcoes: { readonly situacao?: string; readonly estado?: string; readonly atribuido?: string | null; readonly resolvidaEm?: string | null } = {},
  ) =>
    inserir(
      `insert into plataforma.conversas
         (workspace_id, canal_id, contato_id, titulo, situacao, estado, atribuido_tipo, atribuido_id, resolvida_em, criado_por_tipo, criado_por_id)
       values ($1, $2, $3, 'Conversa do Início', $4, $5, $6, $7, $8::timestamptz, 'membro', 'mem_ana') returning id`,
      [
        ws,
        canalId,
        contatoId,
        opcoes.situacao ?? "aberta",
        opcoes.estado ?? "ativo",
        opcoes.atribuido ? "membro" : null,
        opcoes.atribuido ?? null,
        opcoes.resolvidaEm ?? null,
      ],
    );

  const revisaoDe = async (workspaceId: string) =>
    (await pool().query<{ revisao: string }>("select revisao from plataforma.workspaces where workspace_id = $1", [workspaceId])).rows[0]?.revisao;

  beforeAll(async () => {
    await prepararBancoCrm();
  });

  afterAll(async () => {
    for (const ws of espacos) await limparEspaco(ws);
    await encerrar();
  });

  describe("panorama", () => {
    it("(a) traçador: 5 Contatos recentes (a lixeira fora), Negócios abertos ponderados e Conversas não resolvidas; outro Espaço não entra", async () => {
      const ws = await novoEspaco("inipano");
      const outro = await novoEspaco("inipanob");

      // Seis ativos (do mais antigo ao mais novo), um na lixeira que é o MAIS novo de todos, um arquivado.
      const ativos: string[] = [];
      for (let i = 1; i <= 6; i += 1) ativos.push(await semearContato(ws, `Contato ${i}`, { criadoEm: `2026-01-0${i}T12:00:00Z` }));
      await semearContato(ws, "Na lixeira", { estado: "na_lixeira", criadoEm: "2026-02-01T12:00:00Z" });
      await semearContato(ws, "Arquivado", { estado: "arquivado", criadoEm: "2026-02-02T12:00:00Z" });

      // 1000 a 50% (da Etapa) = 500; 2000 com 10% no Negócio = 200; o ganho e o da lixeira não contam.
      const funil = await semearFunilComEtapa(ws, 50);
      await semearNegocio(ws, funil, ativos[0]!, { valor: 1000 });
      await semearNegocio(ws, funil, ativos[1]!, { valor: 2000, probabilidade: 10 });
      await semearNegocio(ws, funil, ativos[2]!, { valor: 9000, situacao: "ganho", encerradoEm: "2026-01-10T12:00:00Z" });
      await semearNegocio(ws, funil, ativos[3]!, { valor: 9000, estado: "na_lixeira" });

      // Duas abertas e uma resolvida (cada uma de um Contato: no máximo uma não resolvida por Contato e Canal).
      const canal = await semearCanalDoEspaco(ws);
      await semearConversa(ws, canal, ativos[0]!);
      await semearConversa(ws, canal, ativos[1]!);
      await semearConversa(ws, canal, ativos[2]!, { situacao: "resolvida", resolvidaEm: "2026-01-11T12:00:00Z" });

      // Dados de OUTRO Espaço, maiores, que não podem aparecer.
      const deFora = await semearContato(outro, "De fora", { criadoEm: "2026-03-01T12:00:00Z" });
      const funilDeFora = await semearFunilComEtapa(outro, 100);
      await semearNegocio(outro, funilDeFora, deFora, { valor: 777777 });
      await semearConversa(outro, await semearCanalDoEspaco(outro), deFora);

      const panorama = valor(await servico.panorama(membro(ws)));

      expect(panorama.contatosRecentes).toEqual([
        { id: ativos[5], nome: "Contato 6" },
        { id: ativos[4], nome: "Contato 5" },
        { id: ativos[3], nome: "Contato 4" },
        { id: ativos[2], nome: "Contato 3" },
        { id: ativos[1], nome: "Contato 2" },
      ]);
      expect(panorama.contatosTotal).toBe(6);
      expect(panorama.negociosAbertos).toEqual({ quantidade: 2, valorPonderado: 700, moeda: "BRL" });
      expect(panorama.conversasAbertas).toBe(2);
    });

    it("(b) um Negócio aberto em outra moeda faz o valor ponderado virar null (moedas não se somam)", async () => {
      const ws = await novoEspaco("inipanousd");
      const contato = await semearContato(ws, "Cliente");
      const funil = await semearFunilComEtapa(ws, 50);
      await semearNegocio(ws, funil, contato, { valor: 1000 });
      await semearNegocio(ws, funil, contato, { valor: 500, moeda: "USD" });

      const panorama = valor(await servico.panorama(membro(ws)));

      expect(panorama.negociosAbertos).toEqual({ quantidade: 2, valorPonderado: null, moeda: null });
    });

    it("(c) a Conversa pendente conta como não resolvida; a da lixeira e a resolvida não", async () => {
      const ws = await novoEspaco("inipanoconv");
      const canal = await semearCanalDoEspaco(ws);
      const contatos = [] as string[];
      for (let i = 0; i < 4; i += 1) contatos.push(await semearContato(ws, `C${i}`));
      await semearConversa(ws, canal, contatos[0]!, { situacao: "pendente" });
      await semearConversa(ws, canal, contatos[1]!, { situacao: "aberta" });
      await semearConversa(ws, canal, contatos[2]!, { situacao: "resolvida", resolvidaEm: "2026-01-11T12:00:00Z" });
      await semearConversa(ws, canal, contatos[3]!, { situacao: "resolvida", estado: "na_lixeira", resolvidaEm: "2026-01-11T12:00:00Z" });

      expect(valor(await servico.panorama(membro(ws))).conversasAbertas).toBe(2);
    });

    it("(d) sem `ler` num recurso, só o bloco dele volta null (os outros continuam)", async () => {
      const ws = await novoEspaco("inipanopapel");
      const contato = await semearContato(ws, "Cliente");
      const funil = await semearFunilComEtapa(ws, 50);
      await semearNegocio(ws, funil, contato, { valor: 1000 });

      const panorama = valor(await servico.panorama(membro(ws, "mem_convidado")));

      expect(panorama.negociosAbertos).toBeNull();
      expect(panorama.contatosRecentes).toEqual([{ id: contato, nome: "Cliente" }]);
      expect(panorama.contatosTotal).toBe(1);
      expect(panorama.conversasAbertas).toBe(0);
    });

    it("(e) é leitura: repetir devolve o mesmo, leituras concorrentes veem a mesma fotografia e a revisão do Espaço não sobe", async () => {
      const ws = await novoEspaco("inipanoleitura");
      const contato = await semearContato(ws, "Cliente");
      const funil = await semearFunilComEtapa(ws, 20);
      await semearNegocio(ws, funil, contato, { valor: 1000 });
      const antes = await revisaoDe(ws);

      const primeira = valor(await servico.panorama(membro(ws)));
      const concorrentes = await Promise.all([1, 2, 3, 4, 5].map(() => servico.panorama(membro(ws))));

      for (const resultado of concorrentes) expect(valor(resultado)).toEqual(primeira);
      expect(valor(await servico.panorama(membro(ws)))).toEqual(primeira);
      expect(primeira.negociosAbertos).toEqual({ quantidade: 1, valorPonderado: 200, moeda: "BRL" });
      expect(await revisaoDe(ws)).toBe(antes);
    });
  });
});
