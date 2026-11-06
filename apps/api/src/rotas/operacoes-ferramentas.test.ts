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
import { criarRepositorioDeContatosPg } from "../repositorios/crm/contatos";
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
