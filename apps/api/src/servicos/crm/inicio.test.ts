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

  const semearCanalDoEspaco = (ws: string, numero = 1) =>
    semearCanal(ws, { nome: `WhatsApp ${numero} do Início`, tipo: "whatsapp", provedor: "whatsapp-cloud", identificadorExterno: `55119${numero}${ws.slice(-8).replace(/\D/g, "0")}` });

  /** Mensagem por SQL, com o instante dado. `enviada` leva status de entrega; `recebida`, id externo (INV-CXE-09 e 7.6). */
  async function semearMensagem(
    ws: string,
    conversaId: string,
    canalId: string,
    direcao: "recebida" | "enviada" | "interna",
    criadoEm: string,
    ator: { readonly tipo: string; readonly id: string } = { tipo: "member", id: "mem_ana" },
  ): Promise<string> {
    return inserir(
      `insert into plataforma.mensagens
         (workspace_id, conversa_id, canal_id, direcao, ator_tipo, ator_id, conteudo, status_entrega, id_externo, criado_em)
       values ($1, $2, $3, $4, $5, $6, 'texto', case when $4 = 'enviada' then 'enviada' end,
               case when $4 = 'recebida' then gen_random_uuid()::text end, $7::timestamptz)
       returning id`,
      [ws, conversaId, canalId, direcao, ator.tipo, ator.id, criadoEm],
    );
  }

  const semearConversa = (
    ws: string,
    canalId: string,
    contatoId: string,
    opcoes: { readonly situacao?: string; readonly estado?: string; readonly atribuido?: string | null; readonly resolvidaEm?: string | null } = {},
  ) =>
    inserir(
      `insert into plataforma.conversas
         (workspace_id, canal_id, contato_id, titulo, situacao, estado, atribuido_tipo, atribuido_id, resolvida_em, na_lixeira_em, criado_por_tipo, criado_por_id)
       values ($1, $2, $3, 'Conversa do Início', $4, $5, $6, $7, $8::timestamptz, case when $5 = 'na_lixeira' then now() end, 'membro', 'mem_ana') returning id`,
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
  describe("leads a atender", () => {
    it("(f) só os Contatos do Membro da sessão com Qualificação pedida: quem espera há mais tempo primeiro, com o motivo e o desde", async () => {
      const ws = await novoEspaco("inileads");
      const canal1 = await semearCanalDoEspaco(ws, 1);
      const canal2 = await semearCanalDoEspaco(ws, 2);
      const Q = "qual-lead";

      // C1: nunca teve Mensagem, criado em t0.
      const c1 = await semearContato(ws, "Sem", { qualificacao: Q, criadoEm: "2026-01-10T12:00:00Z", sobrenome: "Contato" });
      // C2: Conversa aberta cuja última externa é recebida em t1 < t0 (antes houve uma enviada).
      const c2 = await semearContato(ws, "Aguardando", { qualificacao: Q, criadoEm: "2026-01-01T12:00:00Z" });
      const conversaC2 = await semearConversa(ws, canal1, c2);
      await semearMensagem(ws, conversaC2, canal1, "enviada", "2026-01-03T12:00:00Z");
      await semearMensagem(ws, conversaC2, canal1, "recebida", "2026-01-05T12:00:00Z", { tipo: "system", id: "externo" });
      // C3: a última externa é enviada (a bola está com o Contato).
      const c3 = await semearContato(ws, "Respondido", { qualificacao: Q, criadoEm: "2026-01-01T12:00:00Z" });
      const conversaC3 = await semearConversa(ws, canal1, c3);
      await semearMensagem(ws, conversaC3, canal1, "recebida", "2026-01-06T12:00:00Z", { tipo: "system", id: "externo" });
      await semearMensagem(ws, conversaC3, canal1, "enviada", "2026-01-07T12:00:00Z");
      // C4: de outro Membro. C5: outra Qualificação. C6: na lixeira.
      await semearContato(ws, "De outro", { qualificacao: Q, proprietario: "mem_bia" });
      await semearContato(ws, "Outra qualificação", { qualificacao: "qual-cliente" });
      await semearContato(ws, "Na lixeira", { qualificacao: Q, estado: "na_lixeira" });
      // C7: só tem nota interna: continua sem contato, desde o nascimento (2026-01-20).
      const c7 = await semearContato(ws, "Só nota", { qualificacao: Q, criadoEm: "2026-01-20T12:00:00Z" });
      const conversaC7 = await semearConversa(ws, canal1, c7);
      await semearMensagem(ws, conversaC7, canal1, "interna", "2026-01-21T12:00:00Z");
      // C8: Conversa RESOLVIDA com a última recebida: já teve contato e ninguém espera resposta numa aberta.
      const c8 = await semearContato(ws, "Resolvida", { qualificacao: Q });
      const conversaC8 = await semearConversa(ws, canal1, c8, { situacao: "resolvida", resolvidaEm: "2026-01-09T12:00:00Z" });
      await semearMensagem(ws, conversaC8, canal1, "recebida", "2026-01-08T12:00:00Z", { tipo: "system", id: "externo" });
      // C9: duas Conversas abertas (dois Canais) esperando: vale a que espera há mais tempo (01-02, no canal 2).
      const c9 = await semearContato(ws, "Duas", { qualificacao: Q });
      const conversaC9a = await semearConversa(ws, canal1, c9);
      await semearMensagem(ws, conversaC9a, canal1, "recebida", "2026-01-04T12:00:00Z", { tipo: "system", id: "externo" });
      const conversaC9b = await semearConversa(ws, canal2, c9);
      await semearMensagem(ws, conversaC9b, canal2, "recebida", "2026-01-02T12:00:00Z", { tipo: "system", id: "externo" });

      const leads = valor(await servico.leadsAAtender(membro(ws), [Q]));

      expect(leads).toEqual([
        { contatoId: c9, nome: "Duas", motivo: "aguardandoResposta", conversaId: conversaC9b, desde: "2026-01-02T12:00:00.000Z" },
        { contatoId: c2, nome: "Aguardando", motivo: "aguardandoResposta", conversaId: conversaC2, desde: "2026-01-05T12:00:00.000Z" },
        { contatoId: c1, nome: "Sem Contato", motivo: "semContato", conversaId: null, desde: "2026-01-10T12:00:00.000Z" },
        { contatoId: c7, nome: "Só nota", motivo: "semContato", conversaId: null, desde: "2026-01-20T12:00:00.000Z" },
      ]);
    });

    it("(g) \"meus\" é o Membro da sessão: o outro Membro vê só os dele; Qualificação fora da lista ou lista vazia não devolve nada", async () => {
      const ws = await novoEspaco("inileadsmeus");
      const deAna = await semearContato(ws, "Da Ana", { qualificacao: "q1" });
      const deBia = await semearContato(ws, "Da Bia", { qualificacao: "q1", proprietario: "mem_bia" });
      const deAnaQ2 = await semearContato(ws, "Da Ana Q2", { qualificacao: "q2", criadoEm: "2026-01-01T00:00:00Z" });

      expect(valor(await servico.leadsAAtender(membro(ws, "mem_ana"), ["q1"])).map((lead) => lead.contatoId)).toEqual([deAna]);
      expect(valor(await servico.leadsAAtender(membro(ws, "mem_bia"), ["q1"])).map((lead) => lead.contatoId)).toEqual([deBia]);
      // Mais de uma Qualificação na lista: as duas entram.
      expect(new Set(valor(await servico.leadsAAtender(membro(ws, "mem_ana"), ["q1", "q2"])).map((lead) => lead.contatoId))).toEqual(
        new Set([deAna, deAnaQ2]),
      );
      expect(valor(await servico.leadsAAtender(membro(ws), ["q-que-nao-existe"]))).toEqual([]);
      expect(valor(await servico.leadsAAtender(membro(ws), []))).toEqual([]);
    });

    it("(h) o teto é de 50 Leads, e o Espaço de outro Membro ou de fora nunca entra", async () => {
      const ws = await novoEspaco("inileadsteto");
      const outro = await novoEspaco("inileadstetob");
      for (let i = 0; i < 52; i += 1) await semearContato(ws, `Lead ${i}`, { qualificacao: "q1", criadoEm: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString() });
      await semearContato(outro, "De fora", { qualificacao: "q1" });

      const leads = valor(await servico.leadsAAtender(membro(ws), ["q1"]));

      expect(leads).toHaveLength(50);
      expect(leads[0]?.nome).toBe("Lead 0");
      expect(leads.some((lead) => lead.nome === "De fora")).toBe(false);
    });

    it("(i) sem `ler` em Contato a leitura é recusada (403) e a revisão do Espaço não sobe", async () => {
      const ws = await novoEspaco("inileadspapel");
      await semearContato(ws, "Da Ana", { qualificacao: "q1" });
      const antes = await revisaoDe(ws);

      const resultado = await servico.leadsAAtender(membro(ws, "mem_que_nao_existe"), ["q1"]);

      expect(resultado.ok).toBe(false);
      if (!resultado.ok) expect(resultado.status).toBe(403);
      expect(await revisaoDe(ws)).toBe(antes);
    });
  });

  describe("estatísticas do Membro", () => {
    const janela = { desde: "2026-03-01T00:00:00Z", ate: "2026-03-31T23:59:59Z", fuso: "America/Sao_Paulo" };

    it("(j) por dia no fuso pedido: 23h30 e 23h50 locais caem no mesmo dia local; só o que é do Membro da sessão conta", async () => {
      const ws = await novoEspaco("iniestat");
      const canal = await semearCanalDoEspaco(ws);
      const contato = await semearContato(ws, "Cliente");
      const conversa = await semearConversa(ws, canal, contato);
      const conversaNaLixeira = await semearConversa(ws, canal, await semearContato(ws, "Outro"), { situacao: "resolvida", estado: "na_lixeira", resolvidaEm: "2026-03-05T12:00:00Z" });

      // Duas às 23h30 e 23h50 locais de 09/03 (UTC-3 = 02h30 e 02h50 UTC de 10/03) e uma às 00h30 local de 10/03.
      await semearMensagem(ws, conversa, canal, "enviada", "2026-03-10T02:30:00Z");
      await semearMensagem(ws, conversa, canal, "enviada", "2026-03-10T02:50:00Z");
      await semearMensagem(ws, conversa, canal, "enviada", "2026-03-10T03:30:00Z");
      // Fora da conta: de outro Membro, interna, recebida, fora da janela, e em Conversa na lixeira.
      await semearMensagem(ws, conversa, canal, "enviada", "2026-03-10T12:00:00Z", { tipo: "member", id: "mem_bia" });
      await semearMensagem(ws, conversa, canal, "interna", "2026-03-10T12:00:00Z");
      await semearMensagem(ws, conversa, canal, "recebida", "2026-03-10T12:00:00Z", { tipo: "system", id: "externo" });
      await semearMensagem(ws, conversa, canal, "enviada", "2026-02-10T12:00:00Z");
      await semearMensagem(ws, conversaNaLixeira, canal, "enviada", "2026-03-10T12:00:00Z");

      const estatisticas = valor(await servico.estatisticas(membro(ws), janela));

      expect(estatisticas.mensagensEnviadas).toEqual([
        { dia: "2026-03-09", quantidade: 2 },
        { dia: "2026-03-10", quantidade: 1 },
      ]);
      expect(estatisticas.desde).toBe(janela.desde);
      expect(estatisticas.fuso).toBe("America/Sao_Paulo");
      // O mesmo instante em UTC cai em outro dia: o fuso é o que corta.
      const emUtc = valor(await servico.estatisticas(membro(ws), { ...janela, fuso: "UTC" }));
      expect(emUtc.mensagensEnviadas).toEqual([{ dia: "2026-03-10", quantidade: 3 }]);
    });

    it("(k) Conversas resolvidas de que o Membro é o Atribuído e Negócios ganhos dele, por dia e moeda", async () => {
      const ws = await novoEspaco("iniestatganhos");
      const canal = await semearCanalDoEspaco(ws);
      const contatos: string[] = [];
      for (let i = 0; i < 6; i += 1) contatos.push(await semearContato(ws, `C${i}`));
      // Resolvidas: duas minhas no mesmo dia, uma da Bia, uma minha fora da janela, uma minha ainda aberta.
      await semearConversa(ws, canal, contatos[0]!, { situacao: "resolvida", atribuido: "mem_ana", resolvidaEm: "2026-03-12T15:00:00Z" });
      await semearConversa(ws, canal, contatos[1]!, { situacao: "resolvida", atribuido: "mem_ana", resolvidaEm: "2026-03-12T16:00:00Z" });
      await semearConversa(ws, canal, contatos[2]!, { situacao: "resolvida", atribuido: "mem_bia", resolvidaEm: "2026-03-12T15:00:00Z" });
      await semearConversa(ws, canal, contatos[3]!, { situacao: "resolvida", atribuido: "mem_ana", resolvidaEm: "2026-02-12T15:00:00Z" });
      await semearConversa(ws, canal, contatos[4]!, { situacao: "aberta", atribuido: "mem_ana" });

      const funil = await semearFunilComEtapa(ws, 50);
      const ganho = (opcoes: Parameters<typeof semearNegocio>[3]) =>
        semearNegocio(ws, funil, contatos[5]!, { situacao: "ganho", encerradoEm: "2026-03-15T12:00:00Z", ...opcoes });
      await ganho({ valor: 1000 });
      await ganho({ valor: 500 });
      await ganho({ valor: 200, moeda: "USD" });
      await ganho({ valor: 999, proprietario: "mem_bia" });
      await ganho({ valor: 999, estado: "na_lixeira" });
      await ganho({ valor: 999, encerradoEm: "2026-02-15T12:00:00Z" });
      await semearNegocio(ws, funil, contatos[5]!, { valor: 999 });

      const estatisticas = valor(await servico.estatisticas(membro(ws), janela));

      expect(estatisticas.conversasResolvidas).toEqual([{ dia: "2026-03-12", quantidade: 2 }]);
      expect(estatisticas.negociosGanhos).toEqual([
        { dia: "2026-03-15", moeda: "BRL", quantidade: 2, valor: 1500 },
        { dia: "2026-03-15", moeda: "USD", quantidade: 1, valor: 200 },
      ]);
      // A Bia vê os dela, não os da Ana.
      const daBia = valor(await servico.estatisticas(membro(ws, "mem_bia"), janela));
      expect(daBia.conversasResolvidas).toEqual([{ dia: "2026-03-12", quantidade: 1 }]);
      expect(daBia.negociosGanhos).toEqual([{ dia: "2026-03-15", moeda: "BRL", quantidade: 1, valor: 999 }]);
    });

    it("(l) a janela máxima é de 400 dias: 400 passa, 401 é recusado (400); desde depois de ate e fuso desconhecido também", async () => {
      const ws = await novoEspaco("iniestatjanela");
      const ate = "2027-04-05T00:00:00Z";
      const diasAntes = (dias: number) => new Date(Date.parse(ate) - dias * 86_400_000).toISOString();

      expect((await servico.estatisticas(membro(ws), { desde: diasAntes(400), ate, fuso: "UTC" })).ok).toBe(true);
      for (const recusada of [
        await servico.estatisticas(membro(ws), { desde: diasAntes(401), ate, fuso: "UTC" }),
        await servico.estatisticas(membro(ws), { desde: ate, ate: diasAntes(1), fuso: "UTC" }),
        await servico.estatisticas(membro(ws), { ...janela, fuso: "Marte/Base" }),
      ]) {
        expect(recusada.ok).toBe(false);
        if (!recusada.ok) expect(recusada.status).toBe(400);
      }
    });

    it("(m) sem `ler` num recurso, só a série dele volta null; é leitura e a revisão do Espaço não sobe", async () => {
      const ws = await novoEspaco("iniestatpapel");
      const antes = await revisaoDe(ws);

      const estatisticas = valor(await servico.estatisticas(membro(ws, "mem_convidado"), janela));

      expect(estatisticas.negociosGanhos).toBeNull();
      expect(estatisticas.mensagensEnviadas).toEqual([]);
      expect(estatisticas.conversasResolvidas).toEqual([]);
      expect(await revisaoDe(ws)).toBe(antes);
    });
  });
});
