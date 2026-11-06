/**
 * `POST /operacoes/<op de IA>` nomeia a Âncora do Chat e do ensaio pelas tabelas do CRM
 * novo e libera as Conversas do Agente nelas, dentro da transação (Fase 15, 3.4.9, UCR-08).
 *
 * O servidor lê `titulo`/nome de `plataforma.negocios`, `contatos`, `empresas` e `conversas`
 * pelo `LER_DO_CRM_IA` e SUBSTITUI o `nomes` que veio do navegador (T-15-24): quem decide o
 * nome gravado é a tabela. O que o Membro não pode `ler` nem aparece (T-15-23).
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { encerrar, pool } from "../persistencia/conexao";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearCanal } from "../testes/banco-crm";
import {
  appDoEspaco,
  limparEspacoDeVazamento,
  montarEspacoDeVazamento,
  semearEspacoDeVazamento,
  TOKENS_DE_VAZAMENTO,
  type EspacoDeVazamento,
} from "../testes/espaco-de-vazamento";
import { LER_DO_CRM } from "./gesto-no-crm";

interface Ancoras {
  negocio: string;
  contato: string;
  empresa: string;
  conversa: string;
  negocioDeOutroEspaco: string;
  canal: string;
  canalDeOutroEspaco: string;
}

describeComBanco("POST /operacoes — a IA nomeia a Âncora pelas tabelas e libera as Conversas do Agente nelas (15-08, 3.4.9)", () => {
  let espaco: EspacoDeVazamento;
  let outroEspaco: string;
  let ids: Ancoras;

  const chamar = (nome: string, args: unknown[], token: string = TOKENS_DE_VAZAMENTO.a) =>
    appDoEspaco(espaco).inject({
      method: "POST",
      url: `/operacoes/${nome}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { args },
    });

  const corpo = (resposta: { json: () => unknown }) =>
    resposta.json() as { ok: boolean; error?: string; value?: { id: string; anchor?: { type: string; id: string; nameAtTheTime: string } } & Record<string, unknown> };

  const sessoesNoBanco = async (): Promise<number> => {
    const { rows } = await pool().query<{ n: string }>("select count(*)::text as n from plataforma.registros where workspace_id = $1 and colecao = 'chatSessions'", [espaco.workspaceId]);
    return Number(rows[0]?.n ?? 0);
  };

  const semearNegocio = async (workspaceId: string, titulo: string, dono: string): Promise<string> => {
    const funil = (await pool().query<{ id: string }>("insert into plataforma.funis (workspace_id, nome, criado_por) values ($1, 'Funil da IA', $2) returning id", [workspaceId, dono])).rows[0]!.id;
    const etapa = (await pool().query<{ id: string }>("insert into plataforma.etapas (workspace_id, funil_id, nome, ordem) values ($1, $2, 'Etapa', 1) returning id", [workspaceId, funil])).rows[0]!.id;
    // `negocios_dono_ck`: o Negócio precisa de um Contato ou de uma Empresa.
    const dele = (await pool().query<{ id: string }>("insert into plataforma.contatos (workspace_id, nome, proprietario_id, criado_por) values ($1, 'Dono do Negócio', $2, $2) returning id", [workspaceId, dono])).rows[0]!.id;
    return (
      await pool().query<{ id: string }>(
        "insert into plataforma.negocios (workspace_id, titulo, contato_id, funil_id, etapa_id, proprietario_id, criado_por) values ($1, $2, $3, $4, $5, $6, $6) returning id",
        [workspaceId, titulo, dele, funil, etapa, dono],
      )
    ).rows[0]!.id;
  };

  beforeAll(async () => {
    await prepararBancoCrm();
    espaco = montarEspacoDeVazamento("ia");
    await semearEspacoDeVazamento(espaco);
    outroEspaco = novoEspacoDeTeste("iab");
    const ws = espaco.workspaceId;
    const dono = espaco.membros.a.id;
    const contato = (await pool().query<{ id: string }>("insert into plataforma.contatos (workspace_id, nome, sobrenome, proprietario_id, criado_por) values ($1, 'Maria', 'Souza', $2, $2) returning id", [ws, dono])).rows[0]!.id;
    // A Empresa precisa de um Contato admin vigente: a restrição é adiada até o commit.
    let empresa: string;
    const tx = await pool().connect();
    try {
      await tx.query("begin");
      empresa = (await tx.query<{ id: string }>("insert into plataforma.empresas (workspace_id, nome_fantasia, proprietario_id, criado_por) values ($1, 'Acme da tabela', $2, $2) returning id", [ws, dono])).rows[0]!.id;
      await tx.query("insert into plataforma.contato_empresa (workspace_id, contato_id, empresa_id, admin, criado_por) values ($1, $2, $3, true, $4)", [ws, contato, empresa, dono]);
      await tx.query("commit");
    } catch (erro) {
      await tx.query("rollback");
      throw erro;
    } finally {
      tx.release();
    }
    const negocio = await semearNegocio(ws, "Proposta Acme da tabela", dono);
    const canal = await semearCanal(ws, { nome: "WhatsApp da IA", tipo: "whatsapp", provedor: "whatsapp-cloud", identificadorExterno: "+5511933330101", conexao: "conectada" });
    const conversa = (
      await pool().query<{ id: string }>(
        `insert into plataforma.conversas (workspace_id, canal_id, contato_id, titulo, criado_por_tipo, criado_por_id)
         values ($1, $2, $3, 'Atendimento da Maria', 'membro', $4) returning id`,
        [ws, canal, contato, dono],
      )
    ).rows[0]!.id;
    const negocioDeOutroEspaco = await semearNegocio(outroEspaco, "Negócio alheio", dono);
    const canalDeOutroEspaco = await semearCanal(outroEspaco, { nome: "Canal alheio", tipo: "whatsapp", provedor: "whatsapp-cloud", identificadorExterno: "+5511933330102", conexao: "conectada" });
    ids = { negocio, contato, empresa, conversa, negocioDeOutroEspaco, canal, canalDeOutroEspaco };
  });

  afterAll(async () => {
    await limparEspacoDeVazamento(espaco);
    await limparEspaco(outroEspaco);
    await encerrar();
  });

  describe("createChatSession (o traçador)", () => {
    it("ancora num Negócio que só existe em plataforma.negocios e guarda o título da tabela", async () => {
      const resposta = await chamar("createChatSession", [{ title: "Sobre a proposta", anchor: { type: "deal", id: ids.negocio } }]);
      expect(resposta.statusCode, resposta.body.slice(0, 300)).toBe(200);
      const c = corpo(resposta);
      expect(c.ok, c.error).toBe(true);
      expect(c.value?.anchor).toEqual({ type: "deal", id: ids.negocio, nameAtTheTime: "Proposta Acme da tabela" });
      const { rows } = await pool().query<{ nome: string }>(
        "select dados->'anchor'->>'nameAtTheTime' as nome from plataforma.registros where workspace_id = $1 and colecao = 'chatSessions' and id = $2",
        [espaco.workspaceId, c.value?.id],
      );
      expect(rows[0]?.nome).toBe("Proposta Acme da tabela");
    });

    it("ancora no Contato, na Empresa e na Conversa com o nome de exibição da tabela", async () => {
      const contato = corpo(await chamar("createChatSession", [{ title: "Contato", anchor: { type: "contact", id: ids.contato } }]));
      expect(contato.ok, contato.error).toBe(true);
      expect(contato.value?.anchor?.nameAtTheTime).toBe("Maria Souza");
      const empresa = corpo(await chamar("createChatSession", [{ title: "Empresa", anchor: { type: "company", id: ids.empresa } }]));
      expect(empresa.ok, empresa.error).toBe(true);
      expect(empresa.value?.anchor?.nameAtTheTime).toBe("Acme da tabela");
      const conversa = corpo(await chamar("createChatSession", [{ title: "Conversa", anchor: { type: "conversation", id: ids.conversa } }]));
      expect(conversa.ok, conversa.error).toBe(true);
      expect(conversa.value?.anchor?.nameAtTheTime).toBe("Atendimento da Maria");
    });

    it("um `nomes` forjado para um id que não existe na tabela não passa, nem repetido (T-15-24)", async () => {
      const antes = await sessoesNoBanco();
      for (let tentativa = 0; tentativa < 2; tentativa += 1) {
        const resposta = await chamar("createChatSession", [{ title: "Fantasma", anchor: { type: "deal", id: "neg_fantasma" } }, { neg_fantasma: "Negócio inventado" }]);
        expect(resposta.statusCode, resposta.body.slice(0, 300)).toBe(200);
        const c = corpo(resposta);
        expect(c.ok).toBe(false);
        expect(c.error).toBe("O registro da Âncora não foi encontrado.");
      }
      expect(await sessoesNoBanco()).toBe(antes);
    });

    it("um `nomes` forjado para um id que existe não troca o nome: vale o da tabela", async () => {
      const c = corpo(await chamar("createChatSession", [{ title: "Forjado", anchor: { type: "deal", id: ids.negocio } }, { [ids.negocio]: "Nome forjado" }]));
      expect(c.ok, c.error).toBe(true);
      expect(c.value?.anchor?.nameAtTheTime).toBe("Proposta Acme da tabela");
    });

    it("um Negócio de outro Espaço é recusado, com ou sem `nomes` forjado", async () => {
      const sem = corpo(await chamar("createChatSession", [{ title: "Alheio", anchor: { type: "deal", id: ids.negocioDeOutroEspaco } }]));
      expect(sem.ok).toBe(false);
      expect(sem.error).toBe("O registro da Âncora não foi encontrado.");
      const forjado = corpo(await chamar("createChatSession", [{ title: "Alheio", anchor: { type: "deal", id: ids.negocioDeOutroEspaco } }, { [ids.negocioDeOutroEspaco]: "Negócio alheio" }]));
      expect(forjado.ok).toBe(false);
    });
  });

  describe("configureChatSession", () => {
    it("ancora uma Sessão sem Mensagem num Negócio da tabela", async () => {
      const nova = corpo(await chamar("createChatSession", [{ title: "Sessão para ancorar" }]));
      expect(nova.ok, nova.error).toBe(true);
      const c = corpo(await chamar("configureChatSession", [nova.value!.id, { anchor: { type: "deal", id: ids.negocio } }]));
      expect(c.ok, c.error).toBe(true);
      expect(c.value?.anchor).toEqual({ type: "deal", id: ids.negocio, nameAtTheTime: "Proposta Acme da tabela" });
    });

    it("recusa a Âncora de um id que não existe, mesmo com `nomes` forjado", async () => {
      const nova = corpo(await chamar("createChatSession", [{ title: "Sessão sem âncora" }]));
      const c = corpo(await chamar("configureChatSession", [nova.value!.id, { anchor: { type: "company", id: "emp_fantasma" } }, { emp_fantasma: "Empresa inventada" }]));
      expect(c.ok).toBe(false);
      expect(c.error).toBe("O registro da Âncora não foi encontrado.");
    });
  });

  describe("Agente na lixeira ou arquivado libera as Conversas dele nas tabelas (RN-AGE-20)", () => {
    const ATRIBUIDO = "select atribuido_tipo, atribuido_id from plataforma.conversas where id = $1";

    /** Uma Conversa nova (um Contato novo por Conversa: o par Contato/Canal só admite uma aberta). */
    const conversaAtribuida = async (workspaceId: string, canalId: string, tipo: "agente" | "membro", atribuidoId: string, titulo: string): Promise<string> => {
      const dono = espaco.membros.a.id;
      const contato = (await pool().query<{ id: string }>("insert into plataforma.contatos (workspace_id, nome, proprietario_id, criado_por) values ($1, $2, $3, $3) returning id", [workspaceId, titulo, dono])).rows[0]!.id;
      return (
        await pool().query<{ id: string }>(
          `insert into plataforma.conversas (workspace_id, canal_id, contato_id, titulo, atribuido_tipo, atribuido_id, criado_por_tipo, criado_por_id)
           values ($1, $2, $3, $4, $5, $6, 'membro', $7) returning id`,
          [workspaceId, canalId, contato, titulo, tipo, atribuidoId, dono],
        )
      ).rows[0]!.id;
    };
    const atribuicao = async (conversaId: string) => (await pool().query<{ atribuido_tipo: string | null; atribuido_id: string | null }>(ATRIBUIDO, [conversaId])).rows[0];
    const ADMIN = TOKENS_DE_VAZAMENTO.administrador;

    it("enviar o Agente à lixeira solta as Conversas atribuídas a ele no mesmo commit; a de Membro e a de outro Espaço ficam", async () => {
      const agente = "agt_redator";
      const doAgente1 = await conversaAtribuida(espaco.workspaceId, ids.canal, "agente", agente, "Do Agente 1");
      const doAgente2 = await conversaAtribuida(espaco.workspaceId, ids.canal, "agente", agente, "Do Agente 2");
      const deMembro = await conversaAtribuida(espaco.workspaceId, ids.canal, "membro", espaco.membros.b.id, "De um Membro");
      const doMesmoAgenteEmOutroEspaco = await conversaAtribuida(outroEspaco, ids.canalDeOutroEspaco, "agente", agente, "Do Agente alheio");

      const c = corpo(await chamar("enviarAgenteALixeira", [agente], ADMIN));
      expect(c.ok, c.error).toBe(true);

      expect(await atribuicao(doAgente1)).toEqual({ atribuido_tipo: null, atribuido_id: null });
      expect(await atribuicao(doAgente2)).toEqual({ atribuido_tipo: null, atribuido_id: null });
      expect(await atribuicao(deMembro)).toEqual({ atribuido_tipo: "membro", atribuido_id: espaco.membros.b.id });
      expect(await atribuicao(doMesmoAgenteEmOutroEspaco)).toEqual({ atribuido_tipo: "agente", atribuido_id: agente });
    });

    it("repetir o envio à lixeira não falha com 5xx, não solta de novo e não mexe no que mudou depois", async () => {
      const agente = "agt_redator";
      // Depois da lixeira alguém atribuiu uma Conversa ao mesmo Agente (por exemplo, por ele ainda existir): a repetição recusada não a solta.
      const posterior = await conversaAtribuida(espaco.workspaceId, ids.canal, "agente", agente, "Atribuída depois");
      const resposta = await chamar("enviarAgenteALixeira", [agente], ADMIN);
      expect(resposta.statusCode, resposta.body.slice(0, 300)).toBe(200);
      const c = corpo(resposta);
      expect(c.ok).toBe(false);
      expect(c.error).toBe("O Agente já está na lixeira.");
      expect(await atribuicao(posterior)).toEqual({ atribuido_tipo: "agente", atribuido_id: agente });
    });

    it("arquivar o Agente também solta as Conversas dele", async () => {
      const agente = "agt_enriquecedor";
      const conversaId = await conversaAtribuida(espaco.workspaceId, ids.canal, "agente", agente, "Do enriquecedor");
      const c = corpo(await chamar("arquivarAgente", [agente], ADMIN));
      expect(c.ok, c.error).toBe(true);
      expect(await atribuicao(conversaId)).toEqual({ atribuido_tipo: null, atribuido_id: null });
    });

    it("uma recusa do domínio não solta nada: o Assistente padrão não vai à lixeira", async () => {
      const padrao = espaco.estado.workspace.defaultAgentId;
      const conversaId = await conversaAtribuida(espaco.workspaceId, ids.canal, "agente", padrao, "Do Assistente padrão");
      const c = corpo(await chamar("enviarAgenteALixeira", [padrao], ADMIN));
      expect(c.ok).toBe(false);
      expect(await atribuicao(conversaId)).toEqual({ atribuido_tipo: "agente", atribuido_id: padrao });
    });

    it("um Convidado não administra Agente: a recusa não solta nada", async () => {
      const agente = "agt_classificador";
      const conversaId = await conversaAtribuida(espaco.workspaceId, ids.canal, "agente", agente, "Do classificador");
      const c = corpo(await chamar("enviarAgenteALixeira", [agente], TOKENS_DE_VAZAMENTO.convidado));
      expect(c.ok).toBe(false);
      expect(await atribuicao(conversaId)).toEqual({ atribuido_tipo: "agente", atribuido_id: agente });
    });

    it("liberarDoAgente devolve quantas soltou, só do Espaço e do Agente, e a segunda chamada solta zero", async () => {
      const { liberarDoAgente } = await import("../repositorios/crm/liberacao-do-agente");
      const agente = "agt_lancamento";
      const doAgente = await conversaAtribuida(espaco.workspaceId, ids.canal, "agente", agente, "Do lançamento");
      const deOutroAgente = await conversaAtribuida(espaco.workspaceId, ids.canal, "agente", "agt_sdr", "Do SDR");
      const cliente = await pool().connect();
      try {
        expect(await liberarDoAgente(cliente, espaco.workspaceId, agente)).toBe(1);
        expect(await liberarDoAgente(cliente, espaco.workspaceId, agente)).toBe(0);
        expect(await liberarDoAgente(cliente, outroEspaco, "agt_sdr")).toBe(0);
      } finally {
        cliente.release();
      }
      expect(await atribuicao(doAgente)).toEqual({ atribuido_tipo: null, atribuido_id: null });
      expect(await atribuicao(deOutroAgente)).toEqual({ atribuido_tipo: "agente", atribuido_id: "agt_sdr" });
    });
  });

  describe("ensaiarAgente nomeia a Âncora pelas tabelas", () => {
    const ensaiar = (anchor: { type: string; id: string }, nomes?: Record<string, string>) =>
      chamar("ensaiarAgente", ["agt_sdr", { texto: "Qualifique", anchor }, ...(nomes ? [nomes] : [])], TOKENS_DE_VAZAMENTO.administrador);
    const nomeDaAncora = (c: ReturnType<typeof corpo>) => (c.value as { contextComposition?: { anchor?: { name: string } } } | undefined)?.contextComposition?.anchor?.name;

    it("o Negócio e o Contato só das tabelas dão o nome delas à Âncora do ensaio", async () => {
      const negocio = corpo(await ensaiar({ type: "deal", id: ids.negocio }));
      expect(negocio.ok, negocio.error).toBe(true);
      expect(nomeDaAncora(negocio)).toBe("Proposta Acme da tabela");
      const contato = corpo(await ensaiar({ type: "contact", id: ids.contato }));
      expect(contato.ok, contato.error).toBe(true);
      expect(nomeDaAncora(contato)).toBe("Maria Souza");
    });

    it("um `nomes` forjado não vale: o id sem registro na tabela fica com o id, e o que existe fica com o nome da tabela (T-15-24)", async () => {
      const inexistente = corpo(await ensaiar({ type: "deal", id: "neg_fantasma" }, { neg_fantasma: "Nome inventado" }));
      expect(inexistente.ok, inexistente.error).toBe(true);
      expect(nomeDaAncora(inexistente)).toBe("neg_fantasma");
      const existente = corpo(await ensaiar({ type: "deal", id: ids.negocio }, { [ids.negocio]: "Nome forjado" }));
      expect(nomeDaAncora(existente)).toBe("Proposta Acme da tabela");
    });

    it("um Negócio de outro Espaço não dá o nome", async () => {
      const c = corpo(await ensaiar({ type: "deal", id: ids.negocioDeOutroEspaco }));
      expect(nomeDaAncora(c)).toBe(ids.negocioDeOutroEspaco);
    });
  });

  describe("criarAutomacao com escopo Funil confere o Funil na tabela (15-39, 3.4.9)", () => {
    const ADMIN = TOKENS_DE_VAZAMENTO.administrador;
    const automacoesNoBanco = async (): Promise<number> => {
      const { rows } = await pool().query<{ n: string }>("select count(*)::text as n from plataforma.registros where workspace_id = $1 and colecao = 'automations'", [espaco.workspaceId]);
      return Number(rows[0]?.n ?? 0);
    };
    const semearFunil = async (workspaceId: string, nome: string, estado: "ativo" | "arquivado" | "na_lixeira" = "ativo"): Promise<string> =>
      (
        await pool().query<{ id: string }>("insert into plataforma.funis (workspace_id, nome, estado, criado_por) values ($1, $2, $3, $4) returning id", [workspaceId, nome, estado, espaco.membros.a.id])
      ).rows[0]!.id;
    const criar = (nome: string, funilId: string, extra: unknown[] = []) =>
      chamar("criarAutomacao", [{ name: nome, scopeType: "funnel", scopeId: funilId }, ...extra], ADMIN);

    it("cria com o escopo num Funil que só existe em plataforma.funis, ativo ou arquivado", async () => {
      const ativo = await semearFunil(espaco.workspaceId, "Funil ativo da IA");
      const arquivado = await semearFunil(espaco.workspaceId, "Funil arquivado da IA", "arquivado");
      const a = corpo(await criar("Qualificar no funil ativo", ativo));
      expect(a.ok, a.error).toBe(true);
      expect(a.value).toMatchObject({ scopeType: "funnel", scopeId: ativo });
      const b = corpo(await criar("Qualificar no funil arquivado", arquivado));
      expect(b.ok, b.error).toBe(true);
    });

    it("recusa o Funil na lixeira e o Funil de outro Espaço", async () => {
      const antes = await automacoesNoBanco();
      const lixeira = await semearFunil(espaco.workspaceId, "Funil na lixeira da IA", "na_lixeira");
      const alheio = await semearFunil(outroEspaco, "Funil alheio da IA");
      for (const funil of [lixeira, alheio]) {
        const c = corpo(await criar(`Tentativa em ${funil}`, funil));
        expect(c.ok).toBe(false);
        expect(c.error).toBe("O escopo indicado não existe.");
      }
      expect(await automacoesNoBanco()).toBe(antes);
    });

    it("um `funis` forjado pelo navegador para um Funil que não existe na tabela é recusado, e repetido também (T-15-92)", async () => {
      const antes = await automacoesNoBanco();
      for (let tentativa = 0; tentativa < 2; tentativa += 1) {
        const resposta = await criar("Funil forjado", "fun_fantasma", [[{ id: "fun_fantasma", estado: "ativo" }]]);
        expect(resposta.statusCode, resposta.body.slice(0, 300)).toBe(200);
        const c = corpo(resposta);
        expect(c.ok).toBe(false);
        expect(c.error).toBe("O escopo indicado não existe.");
      }
      expect(await automacoesNoBanco()).toBe(antes);
    });
  });

  describe("a leitura confere `ler` antes de revelar o nome (T-15-23)", () => {
    const lerNomes = async (membro: { id: string; state: "ativo" | "suspenso" | "pendente" | "removido" }, tipo: string, id: string) => {
      const cliente = await pool().connect();
      try {
        const leitura = LER_DO_CRM.createChatSession!;
        const lido = await leitura.ler(
          cliente,
          espaco.workspaceId,
          [{ title: "t", anchor: { type: tipo, id } }],
          espaco.estado,
          { ...membro, workspaceId: espaco.workspaceId },
        );
        return leitura.argumento(lido) as Record<string, string>;
      } finally {
        cliente.release();
      }
    };

    it("um Membro ativo lê o nome", async () => {
      expect(await lerNomes({ id: espaco.membros.a.id, state: "ativo" }, "deal", ids.negocio)).toEqual({ [ids.negocio]: "Proposta Acme da tabela" });
    });

    it("um Membro que o Espaço não conhece, ou ainda pendente, não recebe o nome", async () => {
      expect(await lerNomes({ id: "mem_que_nao_existe", state: "ativo" }, "deal", ids.negocio)).toEqual({});
      expect(await lerNomes({ id: espaco.convite.id, state: "pendente" }, "contact", ids.contato)).toEqual({});
    });

    it("uma Âncora de outro tipo (Tarefa) não consulta o CRM", async () => {
      expect(await lerNomes({ id: espaco.membros.a.id, state: "ativo" }, "task", "tsk_qualquer")).toEqual({});
    });
  });
});
