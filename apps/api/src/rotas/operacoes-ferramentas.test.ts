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
});
