/**
 * `POST /operacoes/<op de Ferramenta>` confere Canal e Contato em `plataforma.canais` e
 * `plataforma.contatos`, dentro da transação (Fase 15, 3.4.8, UCR-08). O servidor lê as
 * tabelas pelo `LER_DO_CRM_DAS_FERRAMENTAS` e SUBSTITUI o `crm` que veio do navegador
 * (T-15-20): quem decide é o domínio, com o que o servidor leu.
 *
 * A projeção dos Canais para o estado antigo fica DESLIGADA: é o que prova que a
 * conferência não depende dela, que some na 3.5.4.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { encerrar, pool } from "../persistencia/conexao";
import type { DataState } from "@n1/dominio";
import type { Canal } from "@n1/dominio/crm/canais";
import { criarRepositorioDeContatosPg } from "../repositorios/crm/contatos";
import { resolverContatosPorWhatsapp } from "../repositorios/crm/contatos-de-participantes";
import { confirmarContatosDosParticipantes, lerContatosDosParticipantes } from "./gesto-no-crm/ferramentas";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearCanal } from "../testes/banco-crm";
import {
  appDoEspaco,
  limparEspacoDeVazamento,
  montarEspacoDeVazamento,
  semearEspacoDeVazamento,
  TOKENS_DE_VAZAMENTO,
  type EspacoDeVazamento,
} from "../testes/espaco-de-vazamento";

vi.mock("../persistencia/canais-projetados", async (importarOriginal) => ({
  ...(await importarOriginal<typeof import("../persistencia/canais-projetados")>()),
  carregarCanaisProjetados: async () => [],
}));

const CANAL_NAO_ENCONTRADO = "Canal não encontrado.";

describeComBanco("POST /operacoes — as Ferramentas conferem Canal e Contato nas tabelas, sem a projeção (15-07, 3.4.8)", () => {
  let espaco: EspacoDeVazamento;
  let outroEspaco: string;
  let canalId: string;
  let canalDesconectadoId: string;
  let canalDeOutroEspacoId: string;

  const chamar = (nome: string, args: unknown[]) =>
    appDoEspaco(espaco).inject({
      method: "POST",
      url: `/operacoes/${nome}`,
      headers: { authorization: `Bearer ${TOKENS_DE_VAZAMENTO.administrador}` },
      payload: { args },
    });

  const corpo = (resposta: { json: () => unknown }) => resposta.json() as { ok: boolean; error?: string; value?: Record<string, unknown> & { id: string; canalId?: string } };

  const gruposNoBanco = async (): Promise<number> => {
    const { rows } = await pool().query<{ n: string }>("select count(*)::text as n from plataforma.registros where workspace_id = $1 and colecao = 'grupos'", [espaco.workspaceId]);
    return Number(rows[0]?.n ?? 0);
  };

  beforeAll(async () => {
    await prepararBancoCrm();
    espaco = montarEspacoDeVazamento("ferramentas");
    await semearEspacoDeVazamento(espaco);
    outroEspaco = novoEspacoDeTeste("ferramentasb");
    const ws = espaco.workspaceId;
    canalId = await semearCanal(ws, { nome: "WhatsApp das turmas", tipo: "whatsapp", provedor: "whatsapp-cloud", identificadorExterno: "+5511933330001", conexao: "conectada" });
    canalDesconectadoId = await semearCanal(ws, { nome: "WhatsApp parado", tipo: "whatsapp", provedor: "whatsapp-cloud", identificadorExterno: "+5511933330002", conexao: "desconectada" });
    canalDeOutroEspacoId = await semearCanal(outroEspaco, { nome: "De outro Espaço", tipo: "whatsapp", provedor: "whatsapp-cloud", identificadorExterno: "+5511933330003", conexao: "conectada" });
  });

  afterAll(async () => {
    await limparEspacoDeVazamento(espaco);
    await limparEspaco(outroEspaco);
    await encerrar();
  });

  describe("criarGrupo (o traçador)", () => {
    it("cria o Grupo com um Canal que só existe em plataforma.canais, e o Grupo guarda o id do Canal da tabela", async () => {
      const resposta = await chamar("criarGrupo", [{ nome: "Turma da tabela", canalId }]);
      expect(resposta.statusCode, resposta.body.slice(0, 300)).toBe(200);
      const c = corpo(resposta);
      expect(c.ok, c.error).toBe(true);
      expect(c.value?.canalId).toBe(canalId);
      const { rows } = await pool().query<{ canal_id: string }>(
        "select dados->>'canalId' as canal_id from plataforma.registros where workspace_id = $1 and colecao = 'grupos' and id = $2",
        [espaco.workspaceId, c.value?.id],
      );
      expect(rows[0]?.canal_id).toBe(canalId);
    });

    it("um Canal desconectado da tabela é recusado com a frase de sempre", async () => {
      const antes = await gruposNoBanco();
      const c = corpo(await chamar("criarGrupo", [{ nome: "Turma parada", canalId: canalDesconectadoId }]));
      expect(c.ok).toBe(false);
      expect(c.error).toMatch(/desconectado/);
      expect(await gruposNoBanco()).toBe(antes);
    });

    it("um Canal de outro Espaço é recusado", async () => {
      const c = corpo(await chamar("criarGrupo", [{ nome: "Turma alheia", canalId: canalDeOutroEspacoId }]));
      expect(c.ok).toBe(false);
      expect(c.error).toBe(CANAL_NAO_ENCONTRADO);
    });

    it("um `crm` forjado no corpo (Canal que não existe na tabela, \"conectado\") não passa, nem repetido (T-15-20)", async () => {
      const forjado = {
        canais: [
          {
            id: "fantasma",
            nome: "Canal fantasma",
            tipo: "whatsapp",
            provedor: "whatsapp-cloud",
            identificadorExterno: "+5500000000000",
            conexao: "conectada",
            estado: "ativo",
          },
        ],
        contatos: [],
      };
      const antes = await gruposNoBanco();
      for (let tentativa = 0; tentativa < 2; tentativa += 1) {
        const resposta = await chamar("criarGrupo", [{ nome: "Turma fantasma", canalId: "fantasma" }, forjado]);
        expect(resposta.statusCode).toBe(200);
        const c = corpo(resposta);
        expect(c.ok).toBe(false);
        expect(c.error).toBe(CANAL_NAO_ENCONTRADO);
      }
      expect(await gruposNoBanco()).toBe(antes);
    });

    it("o `crm` forjado também não rebaixa nem promove um Canal real: vale o da tabela", async () => {
      const forjadoArquivado = { canais: [{ id: canalId, nome: "WhatsApp das turmas", tipo: "whatsapp", provedor: "whatsapp-cloud", estado: "arquivado", conexao: "desconectada" }], contatos: [] };
      const c = corpo(await chamar("criarGrupo", [{ nome: "Turma que vale", canalId }, forjadoArquivado]));
      expect(c.ok, c.error).toBe(true);
    });
  });

  describe("Comunidade e Flow (as demais operações, Task 3)", () => {
    it("criarComunidade e sincronizarComunidade conferem o Canal da tabela, e o Grupo de avisos guarda o id dele", async () => {
      const criada = corpo(await chamar("criarComunidade", [{ nome: "Mentoria da tabela", canalId }]));
      expect(criada.ok, criada.error).toBe(true);
      const comunidade = criada.value?.comunidade as { id: string; canalId: string };
      const avisos = criada.value?.grupoDeAvisos as { canalId: string };
      expect(comunidade.canalId).toBe(canalId);
      expect(avisos.canalId).toBe(canalId);
      const sincronizada = corpo(await chamar("sincronizarComunidade", [comunidade.id]));
      expect(sincronizada.ok, sincronizada.error).toBe(true);
      expect((sincronizada.value as unknown as { sincronizacao: { estado: string } }).sincronizacao.estado).toBe("sincronizado");
    });

    it("criarComunidade com um Canal desconectado ou de outro Espaço é recusada, mesmo com `crm` forjado dizendo o contrário", async () => {
      const forjar = (id: string) => ({ canais: [{ id, nome: "Forjado", tipo: "whatsapp", provedor: "whatsapp-cloud", estado: "ativo", conexao: "conectada" }], contatos: [] });
      const parado = corpo(await chamar("criarComunidade", [{ nome: "Parada", canalId: canalDesconectadoId }, forjar(canalDesconectadoId)]));
      expect(parado.ok).toBe(false);
      expect(parado.error).toMatch(/desconectado/);
      const alheio = corpo(await chamar("criarComunidade", [{ nome: "Alheia", canalId: canalDeOutroEspacoId }, forjar(canalDeOutroEspacoId)]));
      expect(alheio.ok).toBe(false);
      expect(alheio.error).toBe(CANAL_NAO_ENCONTRADO);
    });

    it("criarFlow com Canal da tabela passa; com Canal de outro Espaço, recusa", async () => {
      const ok = corpo(await chamar("criarFlow", [{ nome: "Pesquisa da tabela", categoria: "pesquisa", canalId }]));
      expect(ok.ok, ok.error).toBe(true);
      expect(ok.value?.canalId).toBe(canalId);
      const alheio = corpo(await chamar("criarFlow", [{ nome: "Pesquisa alheia", categoria: "pesquisa", canalId: canalDeOutroEspacoId }]));
      expect(alheio.ok).toBe(false);
      expect(alheio.error).toBe("Escolha um Canal ativo.");
    });

    it("sincronizarFlow de um Flow cujo Canal só existia no estado antigo o deixa órfão: o servidor olha a tabela", async () => {
      const seed = await pool().query<{ id: string }>("select id from plataforma.registros where workspace_id = $1 and colecao = 'flows' order by id limit 1", [espaco.workspaceId]);
      const flowId = seed.rows[0]?.id;
      expect(flowId).toBeTruthy();
      const c = corpo(await chamar("sincronizarFlow", [flowId]));
      expect(c.ok, c.error).toBe(true);
      expect((c.value as unknown as { sincronizacao: { estado: string } }).sincronizacao.estado).toBe("orfao");
    });
  });

  describe("Contatos conferidos em plataforma.contatos (Task 3)", () => {
    let anaId: string;
    let biaId: string;
    let semWhatsappId: string;
    let deOutroEspacoId: string;

    const novoContato = async (ws: string, nome: string, whatsapp?: string): Promise<string> => {
      const repo = criarRepositorioDeContatosPg(pool());
      const contato = await repo.inserir(ws, { nome, modoCriacao: "manual", proprietarioId: "mem_teste", criadoPor: "mem_teste" });
      if (whatsapp) await repo.inserirIdentificador(ws, contato.id, { tipo: "whatsapp", valor: whatsapp, principal: true });
      return contato.id;
    };

    const participantesDoGrupo = async (grupoId: string): Promise<string[]> => {
      const { rows } = await pool().query<{ ids: string[] | null }>(
        "select array(select p->>'contactId' from jsonb_array_elements(dados->'participacoes') p where p->>'contactId' is not null) as ids from plataforma.registros where workspace_id = $1 and colecao = 'grupos' and id = $2",
        [espaco.workspaceId, grupoId],
      );
      return rows[0]?.ids ?? [];
    };

    beforeAll(async () => {
      anaId = await novoContato(espaco.workspaceId, "Ana da tabela", "5511988880001");
      biaId = await novoContato(espaco.workspaceId, "Bia da tabela", "5511988880002");
      semWhatsappId = await novoContato(espaco.workspaceId, "Sem WhatsApp");
      deOutroEspacoId = await novoContato(outroEspaco, "De outro Espaço", "5511988880003");
    });

    it("criarGrupo com Participantes que só existem em plataforma.contatos cria as Participações com o id deles", async () => {
      const c = corpo(await chamar("criarGrupo", [{ nome: "Turma com Contatos", canalId, participantesIniciaisContactIds: [anaId], administradoresContactIds: [biaId] }]));
      expect(c.ok, c.error).toBe(true);
      expect((await participantesDoGrupo(c.value!.id)).sort()).toEqual([anaId, biaId].sort());
    });

    it("um Contato sem WhatsApp ou de outro Espaço é recusado, mesmo com `crm` forjado dizendo que está ativo", async () => {
      const forjado = {
        canais: [],
        contatos: [
          { id: deOutroEspacoId, nome: "De outro Espaço", estado: "ativo", whatsapp: "5511988880003" },
          { id: "fantasma", nome: "Fantasma", estado: "ativo", whatsapp: "5511900000000" },
        ],
      };
      const sem = corpo(await chamar("criarGrupo", [{ nome: "Sem WhatsApp", canalId, participantesIniciaisContactIds: [semWhatsappId] }]));
      expect(sem.ok).toBe(false);
      expect(sem.error).toMatch(/identidade de WhatsApp/);
      for (const id of [deOutroEspacoId, "fantasma"]) {
        const alheio = corpo(await chamar("criarGrupo", [{ nome: "Alheio", canalId, participantesIniciaisContactIds: [id] }, forjado]));
        expect(alheio.ok).toBe(false);
        expect(alheio.error).toBe("Um dos Contatos escolhidos não está ativo.");
      }
    });

    it("adicionarParticipantes confere o Contato na tabela; repetir o mesmo Contato conta como já estava", async () => {
      const criado = corpo(await chamar("criarGrupo", [{ nome: "Turma para adicionar", canalId }]));
      expect(criado.ok, criado.error).toBe(true);
      const grupoId = criado.value!.id;
      const primeira = corpo(await chamar("adicionarParticipantes", [grupoId, { contactIds: [anaId] }]));
      expect(primeira.ok, primeira.error).toBe(true);
      expect((primeira.value as unknown as { adicionados: unknown[] }).adicionados).toHaveLength(1);
      const segunda = corpo(await chamar("adicionarParticipantes", [grupoId, { contactIds: [anaId] }]));
      expect(segunda.ok, segunda.error).toBe(true);
      expect((segunda.value as unknown as { jaEstavam: number }).jaEstavam).toBe(1);
      const alheio = corpo(await chamar("adicionarParticipantes", [grupoId, { contactIds: [deOutroEspacoId] }]));
      expect(alheio.ok).toBe(false);
      expect(alheio.error).toBe("Um dos Contatos não está ativo.");
    });

    it("removerParticipante grava o nome do Contato da tabela no Registro", async () => {
      const criado = corpo(await chamar("criarGrupo", [{ nome: "Turma para remover", canalId, participantesIniciaisContactIds: [anaId] }]));
      const grupoId = criado.value!.id;
      const { rows } = await pool().query<{ id: string }>(
        "select p->>'id' as id from plataforma.registros r, jsonb_array_elements(r.dados->'participacoes') p where r.workspace_id = $1 and r.colecao = 'grupos' and r.id = $2 and p->>'contactId' = $3",
        [espaco.workspaceId, grupoId, anaId],
      );
      const c = corpo(await chamar("removerParticipante", [grupoId, rows[0]?.id]));
      expect(c.ok, c.error).toBe(true);
      const registro = await pool().query<{ detail: string }>(
        "select dados->>'detail' as detail from plataforma.registros where workspace_id = $1 and colecao = 'activity' and dados->>'action' = 'Participante removido' and dados->>'objectId' = $2",
        [espaco.workspaceId, grupoId],
      );
      expect(registro.rows[0]?.detail).toBe("Ana da tabela");
    });
  });

  describe("importarGruposDoCanal cria o Contato do Participante desconhecido em plataforma.contatos (15-17, 3.4.8)", () => {
    // O provedor simulado tem uma chave só: o número do Canal do seed do domínio.
    const NUMERO_DO_CANAL_DO_PROVEDOR = "+5511987654321";
    // Fornecedores Full Face (5 Participantes) e Ex-alunos 2024 (4): nove números distintos.
    const NUMERO_CONHECIDO = "5511970002474";
    const JIDS_DO_PROVEDOR = ["120363301111111111@g.us", "120363302222222222@g.us"];
    const DESCONHECIDOS = ["5511970003711", "5511970004948", "5511999001122", "5511999003344", "5511970006185", "5511970007422", "5511970008659", "5511999005566"];
    let canalDoProvedorId: string;
    let conhecidoId: string;

    const contatosDoEspaco = async (): Promise<number> => {
      const { rows } = await pool().query<{ n: string }>("select count(*)::text as n from plataforma.contatos where workspace_id = $1", [espaco.workspaceId]);
      return Number(rows[0]?.n ?? 0);
    };

    const identificadoresWhatsapp = async (): Promise<Array<{ valor: string; principal: boolean; contato_id: string; modo_criacao: string; proprietario_id: string; estado: string; nome: string | null }>> => {
      const { rows } = await pool().query(
        `select i.valor, i.principal, i.contato_id, c.modo_criacao, c.proprietario_id, c.estado, c.nome
           from plataforma.contato_identificadores i
           join plataforma.contatos c on c.workspace_id = i.workspace_id and c.id = i.contato_id
          where i.workspace_id = $1 and i.tipo = 'whatsapp' and c.modo_criacao = 'automatico_automacao'
          order by i.valor`,
        [espaco.workspaceId],
      );
      return rows;
    };

    const participacoesDosGrupos = async (): Promise<Array<{ contactId: string | null; numero: string }>> => {
      const { rows } = await pool().query<{ contact_id: string | null; numero: string }>(
        `select p->>'contactId' as contact_id, p->>'identificadorExternoDoParticipante' as numero
           from plataforma.registros r, jsonb_array_elements(r.dados->'participacoes') p
          where r.workspace_id = $1 and r.colecao = 'grupos' and r.dados->>'identificadorExterno' = any($2::text[])`,
        [espaco.workspaceId, JIDS_DO_PROVEDOR],
      );
      return rows.map((r) => ({ contactId: r.contact_id, numero: r.numero }));
    };

    beforeAll(async () => {
      canalDoProvedorId = await semearCanal(espaco.workspaceId, { nome: "WhatsApp do provedor", tipo: "whatsapp", provedor: "whatsapp-cloud", identificadorExterno: NUMERO_DO_CANAL_DO_PROVEDOR, conexao: "conectada" });
      await pool().query("update plataforma.canais set proprietario_padrao_id = $3 where workspace_id = $1 and id = $2", [espaco.workspaceId, canalDoProvedorId, espaco.membros.b.id]);
      const repo = criarRepositorioDeContatosPg(pool());
      const conhecido = await repo.inserir(espaco.workspaceId, { nome: "Fornecedor que já existe", modoCriacao: "manual", proprietarioId: "mem_teste", criadoPor: "mem_teste" });
      await repo.inserirIdentificador(espaco.workspaceId, conhecido.id, { tipo: "whatsapp", valor: `+${NUMERO_CONHECIDO}`, principal: true });
      conhecidoId = conhecido.id;
    });

    it("o conhecido vira Participação com o id dele; cada desconhecido gera 1 Contato e 1 Identificador whatsapp principal, e a Participação aponta para esse id", async () => {
      const antes = await contatosDoEspaco();
      const resposta = await chamar("importarGruposDoCanal", [canalDoProvedorId]);
      expect(resposta.statusCode, resposta.body.slice(0, 300)).toBe(200);
      const c = corpo(resposta);
      expect(c.ok, c.error).toBe(true);

      expect(await contatosDoEspaco()).toBe(antes + DESCONHECIDOS.length);
      const criados = await identificadoresWhatsapp();
      expect(criados.map((i) => i.valor)).toEqual(DESCONHECIDOS.map((n) => `+${n}`).sort());
      expect(criados.every((i) => i.principal && i.estado === "ativo" && i.nome === null)).toBe(true);
      // O Proprietário vem do Canal (primeiro elo da cadeia DO-CXE-05).
      expect(criados.every((i) => i.proprietario_id === espaco.membros.b.id)).toBe(true);

      const participacoes = (await participacoesDosGrupos()).filter((p) => p.contactId !== null);
      expect(participacoes).toHaveLength(DESCONHECIDOS.length + 1);
      expect(participacoes.find((p) => p.numero === NUMERO_CONHECIDO)?.contactId).toBe(conhecidoId);
      const porNumero = new Map(criados.map((i) => [i.valor, i.contato_id]));
      for (const numero of DESCONHECIDOS) expect(participacoes.find((p) => p.numero === numero)?.contactId).toBe(porNumero.get(`+${numero}`));
    });

    it("importar de novo (repetir) não cria Contato nem Participação duplicados", async () => {
      const contatosAntes = await contatosDoEspaco();
      const participacoesAntes = (await participacoesDosGrupos()).length;
      const c = corpo(await chamar("importarGruposDoCanal", [canalDoProvedorId]));
      expect(c.ok, c.error).toBe(true);
      expect((c.value as unknown as { importados: unknown[] }).importados).toHaveLength(0);
      expect(await contatosDoEspaco()).toBe(contatosAntes);
      expect((await participacoesDosGrupos()).length).toBe(participacoesAntes);
    });

    it("uma recusa do domínio (Canal desconectado) não deixa Contato novo na tabela", async () => {
      await pool().query("delete from plataforma.registros where workspace_id = $1 and colecao = 'grupos' and dados->>'identificadorExterno' = any($2::text[])", [espaco.workspaceId, JIDS_DO_PROVEDOR]);
      await pool().query("delete from plataforma.contatos where workspace_id = $1 and modo_criacao = 'automatico_automacao'", [espaco.workspaceId]);
      await pool().query("update plataforma.canais set conexao = 'desconectada' where workspace_id = $1 and id = $2", [espaco.workspaceId, canalDoProvedorId]);
      const antes = await contatosDoEspaco();
      const c = corpo(await chamar("importarGruposDoCanal", [canalDoProvedorId]));
      await pool().query("update plataforma.canais set conexao = 'conectada' where workspace_id = $1 and id = $2", [espaco.workspaceId, canalDoProvedorId]);
      expect(c.ok).toBe(false);
      expect(await contatosDoEspaco()).toBe(antes);
    });

    it("um `contatosACriar` forjado no corpo não cria Contato (T-15-42): vale o que o servidor gerou", async () => {
      await pool().query("delete from plataforma.registros where workspace_id = $1 and colecao = 'grupos' and dados->>'identificadorExterno' = any($2::text[])", [espaco.workspaceId, JIDS_DO_PROVEDOR]);
      await pool().query("delete from plataforma.contatos where workspace_id = $1 and modo_criacao = 'automatico_automacao'", [espaco.workspaceId]);
      const forjado = { canais: [], contatos: [], contatosACriar: DESCONHECIDOS.map((n) => ({ id: `forjado-${n}`, nome: "Forjado", whatsapp: n })) };
      const c = corpo(await chamar("importarGruposDoCanal", [canalDoProvedorId, forjado]));
      expect(c.ok, c.error).toBe(true);
      const { rows } = await pool().query<{ n: string }>("select count(*)::text as n from plataforma.contatos where workspace_id = $1 and id like 'forjado-%'", [espaco.workspaceId]);
      expect(Number(rows[0]?.n)).toBe(0);
      expect((await participacoesDosGrupos()).some((p) => p.contactId?.startsWith("forjado-"))).toBe(false);
    });
  });

  describe("importações simultâneas do mesmo Grupo (15-17, UCR-08, concorrência)", () => {
    const NUMEROS = ["5511970002474", "5511970003711", "5511970004948", "5511999001122", "5511999003344", "5511970006185", "5511970007422", "5511970008659", "5511999005566"];
    const JIDS = ["120363301111111111@g.us", "120363302222222222@g.us"];
    let espacoB: EspacoDeVazamento;
    let canalB: string;

    const chamarB = (args: unknown[]) =>
      appDoEspaco(espacoB).inject({
        method: "POST",
        url: "/operacoes/importarGruposDoCanal",
        headers: { authorization: `Bearer ${TOKENS_DE_VAZAMENTO.administrador}` },
        payload: { args },
      });

    beforeAll(async () => {
      espacoB = montarEspacoDeVazamento("ferramentasc");
      await semearEspacoDeVazamento(espacoB);
      canalB = await semearCanal(espacoB.workspaceId, { nome: "WhatsApp da corrida", tipo: "whatsapp", provedor: "whatsapp-cloud", identificadorExterno: "+5511987654321", conexao: "conectada" });
    });

    afterAll(async () => {
      await limparEspacoDeVazamento(espacoB);
    });

    it("duas chamadas simultâneas deixam 1 Contato por número e 1 Participação por número", async () => {
      const [a, b] = await Promise.all([chamarB([canalB]), chamarB([canalB])]);
      expect(a.statusCode, a.body.slice(0, 300)).toBe(200);
      expect(b.statusCode, b.body.slice(0, 300)).toBe(200);
      const ia = (corpo(a).value as unknown as { importados: unknown[] } | undefined)?.importados.length ?? -1;
      const ib = (corpo(b).value as unknown as { importados: unknown[] } | undefined)?.importados.length ?? -1;
      // Uma depois da outra (trava do Espaço): quem entrou primeiro importa os dois Grupos, a outra só os encontra.
      expect([ia, ib].sort()).toEqual([0, 2]);

      const contatos = await pool().query<{ valor: string; n: string }>(
        `select i.valor, count(*)::text as n
           from plataforma.contato_identificadores i
          where i.workspace_id = $1 and i.tipo = 'whatsapp'
          group by i.valor order by i.valor`,
        [espacoB.workspaceId],
      );
      expect(contatos.rows.map((r) => r.valor)).toEqual(NUMEROS.map((n) => `+${n}`).sort());
      expect(contatos.rows.every((r) => r.n === "1")).toBe(true);
      const total = await pool().query<{ n: string }>("select count(*)::text as n from plataforma.contatos where workspace_id = $1 and modo_criacao = 'automatico_automacao'", [espacoB.workspaceId]);
      expect(Number(total.rows[0]?.n)).toBe(NUMEROS.length);

      const participacoes = await pool().query<{ numero: string; n: string; contatos: string }>(
        `select p->>'identificadorExternoDoParticipante' as numero, count(*)::text as n, count(distinct p->>'contactId')::text as contatos
           from plataforma.registros r, jsonb_array_elements(r.dados->'participacoes') p
          where r.workspace_id = $1 and r.colecao = 'grupos' and r.dados->>'identificadorExterno' = any($2::text[]) and p->>'contactId' is not null
          group by p->>'identificadorExternoDoParticipante' order by 1`,
        [espacoB.workspaceId, JIDS],
      );
      expect(participacoes.rows.map((r) => r.numero)).toEqual([...NUMEROS].sort());
      expect(participacoes.rows.every((r) => r.n === "1" && r.contatos === "1")).toBe(true);
      const grupos = await pool().query<{ n: string }>("select count(*)::text as n from plataforma.registros where workspace_id = $1 and colecao = 'grupos' and dados->>'identificadorExterno' = any($2::text[])", [espacoB.workspaceId, JIDS]);
      expect(Number(grupos.rows[0]?.n)).toBe(2);
    });

    it("repetir a importação depois da corrida não cria Contato nem Participação novos", async () => {
      const contar = async () => {
        const c = await pool().query<{ n: string }>("select count(*)::text as n from plataforma.contatos where workspace_id = $1", [espacoB.workspaceId]);
        const p = await pool().query<{ n: string }>(
          "select count(*)::text as n from plataforma.registros r, jsonb_array_elements(r.dados->'participacoes') p where r.workspace_id = $1 and r.colecao = 'grupos'",
          [espacoB.workspaceId],
        );
        return [Number(c.rows[0]?.n), Number(p.rows[0]?.n)];
      };
      const antes = await contar();
      const resposta = await chamarB([canalB]);
      expect(resposta.statusCode, resposta.body.slice(0, 300)).toBe(200);
      expect((corpo(resposta).value as unknown as { importados: unknown[] }).importados).toHaveLength(0);
      expect(await contar()).toEqual(antes);
    });
  });

  describe("o Contato do Participante nos eventos do provedor (15-17, 3.4.8)", () => {
    const membro = () => ({ id: espaco.membros.a.id, workspaceId: espaco.workspaceId, state: "ativo" as const });

    const comCliente = async <T>(corpoDoGesto: (cliente: import("pg").PoolClient) => Promise<T>): Promise<T> => {
      const cliente = await pool().connect();
      try {
        await cliente.query("begin");
        const resultado = await corpoDoGesto(cliente);
        await cliente.query("commit");
        return resultado;
      } catch (erro) {
        await cliente.query("rollback");
        throw erro;
      } finally {
        cliente.release();
      }
    };

    const canalFalso = (extra: Partial<Canal> = {}): Canal => ({ id: "canal-x", proprietarioPadraoId: null, filaPadraoId: null, origemPadraoId: null, ...extra }) as Canal;

    it("resolverContatosPorWhatsapp acha com e sem o `+`, resolve o mesclado ao sobrevivente e não enxerga outro Espaço", async () => {
      const repo = criarRepositorioDeContatosPg(pool());
      const ws = espaco.workspaceId;
      const sobrevivente = await repo.inserir(ws, { nome: "Sobrevivente", modoCriacao: "manual", proprietarioId: "mem_teste", criadoPor: "mem_teste" });
      const absorvido = await repo.inserir(ws, { nome: "Absorvido", modoCriacao: "manual", proprietarioId: "mem_teste", criadoPor: "mem_teste" });
      await repo.inserirIdentificador(ws, absorvido.id, { tipo: "whatsapp", valor: "+5511966660001", principal: true });
      await pool().query("update plataforma.contatos set estado = 'mesclado', mesclado_em_id = $3, mesclado_em = now() where workspace_id = $1 and id = $2", [ws, absorvido.id, sobrevivente.id]);
      const semMais = await repo.inserir(ws, { nome: "Sem o mais", modoCriacao: "manual", proprietarioId: "mem_teste", criadoPor: "mem_teste" });
      await repo.inserirIdentificador(ws, semMais.id, { tipo: "whatsapp", valor: "5511966660002", principal: true });
      const alheio = await repo.inserir(outroEspaco, { nome: "Alheio", modoCriacao: "manual", proprietarioId: "mem_teste", criadoPor: "mem_teste" });
      await repo.inserirIdentificador(outroEspaco, alheio.id, { tipo: "whatsapp", valor: "+5511966660003", principal: true });

      const achados = await comCliente((c) => resolverContatosPorWhatsapp(c, ws, ["5511966660001", "5511966660002", "5511966660003", "5511966660004", "5511966660001"]));
      expect(achados).toHaveLength(2);
      const doAbsorvido = achados.find((c) => c.whatsapp === "+5511966660001");
      expect(doAbsorvido).toMatchObject({ id: sobrevivente.id, nome: "Sobrevivente", estado: "ativo" });
      expect(achados.find((c) => c.whatsapp === "5511966660002")).toMatchObject({ id: semMais.id });
      expect(await comCliente((c) => resolverContatosPorWhatsapp(c, ws, []))).toEqual([]);
    });

    it("lerContatosDosParticipantes gera um id novo por número sem Contato e nenhum para quem já tem", async () => {
      const repo = criarRepositorioDeContatosPg(pool());
      const ws = espaco.workspaceId;
      const existente = await repo.inserir(ws, { nome: "Já existe", modoCriacao: "manual", proprietarioId: "mem_teste", criadoPor: "mem_teste" });
      await repo.inserirIdentificador(ws, existente.id, { tipo: "whatsapp", valor: "+5511955550001", principal: true });
      const lido = await comCliente((c) => lerContatosDosParticipantes(c, ws, ["5511955550001", "5511955550002", "5511955550003"]));
      expect(lido.contatos.map((c) => c.id)).toEqual([existente.id]);
      expect(lido.contatosACriar.map((c) => c.whatsapp).sort()).toEqual(["5511955550002", "5511955550003"]);
      expect(new Set(lido.contatosACriar.map((c) => c.id)).size).toBe(2);
      expect(lido.contatosACriar.every((c) => c.id !== existente.id && /^[0-9a-f-]{36}$/.test(c.id))).toBe(true);
    });

    it("confirmarContatosDosParticipantes insere só os que o estado usa, com o Proprietário da cadeia e a Origem pelo nome", async () => {
      const ws = espaco.workspaceId;
      const usado = { id: "11111111-1111-4111-8111-111111111111", nome: "+55 11 95555-0010", whatsapp: "5511955550010" };
      const usadoNoPedido = { id: "22222222-2222-4222-8222-222222222222", nome: "+55 11 95555-0011", whatsapp: "5511955550011" };
      const naoUsado = { id: "33333333-3333-4333-8333-333333333333", nome: "+55 11 95555-0012", whatsapp: "5511955550012" };
      const estado = {
        grupos: [{ participacoes: [{ contactId: usado.id }, { canalParticipanteId: "canal-x" }], pedidosDeEntrada: [{ contactId: usadoNoPedido.id }] }],
        queues: [{ id: "fila-x", defaultContactOwnerMemberId: "mem_da_fila" }],
        inbox: { defaultContactOwnerMemberId: "mem_da_caixa" },
        workspace: { ownerMemberId: "mem_do_espaco" },
        catalog: [{ id: "origem-x", kind: "origem", name: "Grupo de WhatsApp" }],
      } as unknown as DataState;
      const lido = { contatosACriar: [usado, usadoNoPedido, naoUsado] };

      const inseridos = await comCliente((c) => confirmarContatosDosParticipantes(c, membro(), estado, canalFalso({ filaPadraoId: "fila-x", origemPadraoId: "origem-x" }), lido));
      expect(inseridos).toBe(2);
      const { rows } = await pool().query<{ id: string; proprietario_id: string; origem: string | null; modo_criacao: string; criado_por: string }>(
        "select id, proprietario_id, origem, modo_criacao, criado_por from plataforma.contatos where workspace_id = $1 and id = any($2::text[]) order by id",
        [ws, [usado.id, usadoNoPedido.id, naoUsado.id]],
      );
      expect(rows.map((r) => r.id)).toEqual([usado.id, usadoNoPedido.id]);
      expect(rows.every((r) => r.proprietario_id === "mem_da_fila" && r.origem === "Grupo de WhatsApp" && r.modo_criacao === "automatico_automacao" && r.criado_por === espaco.membros.a.id)).toBe(true);
      const ident = await pool().query<{ valor: string; valor_exibido: string; verificado: boolean; principal: boolean }>(
        "select valor, valor_exibido, verificado, principal from plataforma.contato_identificadores where workspace_id = $1 and contato_id = $2",
        [ws, usado.id],
      );
      expect(ident.rows).toEqual([{ valor: "+5511955550010", valor_exibido: "+55 11 95555-0010", verificado: true, principal: true }]);
    });

    it("sem nenhum Contato usado, nada é inserido e o Canal nem é exigido", async () => {
      const estado = { grupos: [{ participacoes: [], pedidosDeEntrada: [] }] } as unknown as DataState;
      const lido = { contatosACriar: [{ id: "44444444-4444-4444-8444-444444444444", nome: "x", whatsapp: "5511955550020" }] };
      expect(await comCliente((c) => confirmarContatosDosParticipantes(c, membro(), estado, undefined, lido))).toBe(0);
      expect(await comCliente((c) => confirmarContatosDosParticipantes(c, membro(), estado, undefined, undefined))).toBe(0);
    });

    it("se o Identificador já é de outro Contato, a transação inteira cai: nem o Contato novo fica (rede de contato_identificadores_unico)", async () => {
      const repo = criarRepositorioDeContatosPg(pool());
      const ws = espaco.workspaceId;
      const dono = await repo.inserir(ws, { nome: "Dono do número", modoCriacao: "manual", proprietarioId: "mem_teste", criadoPor: "mem_teste" });
      await repo.inserirIdentificador(ws, dono.id, { tipo: "whatsapp", valor: "+5511955550030", principal: true });
      const novo = { id: "55555555-5555-4555-8555-555555555555", nome: "x", whatsapp: "5511955550030" };
      const estado = { grupos: [{ participacoes: [{ contactId: novo.id }], pedidosDeEntrada: [] }], queues: [], inbox: {}, workspace: { ownerMemberId: "mem_do_espaco" }, catalog: [] } as unknown as DataState;
      await expect(comCliente((c) => confirmarContatosDosParticipantes(c, membro(), estado, canalFalso(), { contatosACriar: [novo] }))).rejects.toThrow(/contato_identificadores_unico/);
      const { rows } = await pool().query("select 1 from plataforma.contatos where workspace_id = $1 and id = $2", [ws, novo.id]);
      expect(rows).toHaveLength(0);
    });
  });

  describe("resumidosPorIds (T-15-21, T-15-22)", () => {
    it("devolve só Contatos do Espaço, com o WhatsApp principal (senão o mais antigo)", async () => {
      const repo = criarRepositorioDeContatosPg(pool());
      const ws = espaco.workspaceId;
      const comDois = await repo.inserir(ws, { nome: "Dois números", modoCriacao: "manual", proprietarioId: "mem_teste", criadoPor: "mem_teste" });
      await repo.inserirIdentificador(ws, comDois.id, { tipo: "whatsapp", valor: "5511977770001", principal: false });
      await repo.inserirIdentificador(ws, comDois.id, { tipo: "whatsapp", valor: "5511977770002", principal: true });
      const semPrincipal = await repo.inserir(ws, { nome: "Sem principal", modoCriacao: "manual", proprietarioId: "mem_teste", criadoPor: "mem_teste" });
      await repo.inserirIdentificador(ws, semPrincipal.id, { tipo: "whatsapp", valor: "5511977770003", principal: false });
      await repo.inserirIdentificador(ws, semPrincipal.id, { tipo: "whatsapp", valor: "5511977770004", principal: false });
      const semNada = await repo.inserir(ws, { nome: "Sem nada", sobrenome: "Nenhum", modoCriacao: "manual", proprietarioId: "mem_teste", criadoPor: "mem_teste" });
      const alheio = await repo.inserir(outroEspaco, { nome: "Alheio", modoCriacao: "manual", proprietarioId: "mem_teste", criadoPor: "mem_teste" });
      const lidos = await repo.resumidosPorIds(ws, [comDois.id, semPrincipal.id, semNada.id, alheio.id, "inexistente", comDois.id]);
      const porId = new Map(lidos.map((c) => [c.id, c]));
      expect(lidos).toHaveLength(3);
      expect(porId.get(comDois.id)).toMatchObject({ nome: "Dois números", estado: "ativo", whatsapp: "5511977770002" });
      expect(porId.get(semPrincipal.id)?.whatsapp).toBe("5511977770003");
      expect(porId.get(semNada.id)).toMatchObject({ nome: "Sem nada Nenhum", whatsapp: null });
      expect(porId.has(alheio.id)).toBe(false);
    });

    it("lista vazia não consulta, e mais de 500 ids é erro", async () => {
      const repo = criarRepositorioDeContatosPg(pool());
      expect(await repo.resumidosPorIds(espaco.workspaceId, [])).toEqual([]);
      const muitos = Array.from({ length: 501 }, (_, i) => `id-${i}`);
      await expect(repo.resumidosPorIds(espaco.workspaceId, muitos)).rejects.toThrow(/500/);
    });
  });
});
