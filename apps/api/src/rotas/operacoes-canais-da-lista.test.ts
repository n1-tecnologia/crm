/**
 * `POST /operacoes/definirCanaisDaLista` e `POST /operacoes/createList` conferem
 * os Canais da Lista conversacional em `plataforma.canais`, dentro da transação
 * (Fase 14, 3.3.7). O servidor lê a tabela pela opção `lerDoCrm` de `executar()`
 * e SUBSTITUI o `canais` que veio do navegador (Pitfall 12, T-14-29).
 *
 * A projeção dos Canais para `state.channels` fica DESLIGADA aqui
 * (`carregarCanaisProjetados` devolve `[]`): é o que prova que a conferência não
 * depende dela, que some na 3.5.4. O seed ainda traz os Canais antigos em
 * `registros` (`chn_wpp`), e o ramo antigo segue valendo para eles.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { encerrar, pool } from "../persistencia/conexao";
import { describeComBanco, novoEspacoDeTeste, limparEspaco, prepararBancoCrm, semearCanal } from "../testes/banco-crm";
import {
  appDoEspaco,
  limparEspacoDeVazamento,
  montarEspacoDeVazamento,
  semearEspacoDeVazamento,
  TOKENS_DE_VAZAMENTO,
  type EspacoDeVazamento,
} from "../testes/espaco-de-vazamento";

// A projeção desligada: a Lista conversacional não pode depender dela (3.3.7).
vi.mock("../persistencia/canais-projetados", async (importarOriginal) => ({
  ...(await importarOriginal<typeof import("../persistencia/canais-projetados")>()),
  carregarCanaisProjetados: async () => [],
}));

const FRASE_DE_CANAL_INVALIDO = "Canal não encontrado ou arquivado.";

describeComBanco("POST /operacoes — os Canais da Lista conferidos em plataforma.canais, sem a projeção (14-12, 3.3.7)", () => {
  let espaco: EspacoDeVazamento;
  let outroEspaco: string;
  let canalId: string;
  let canalArquivadoId: string;
  let canalDeOutroEspacoId: string;
  let listaId: string;

  const chamar = (nome: string, args: unknown[]) =>
    appDoEspaco(espaco).inject({
      method: "POST",
      url: `/operacoes/${nome}`,
      headers: { authorization: `Bearer ${TOKENS_DE_VAZAMENTO.administrador}` },
      payload: { args },
    });

  const corpo = (resposta: { json: () => unknown }) => resposta.json() as { ok: boolean; error?: string; value?: { id: string; canaisDeAtendimento?: string[] } };

  const canaisDaListaNoBanco = async (id: string): Promise<readonly string[] | undefined> => {
    const { rows } = await pool().query<{ canais: string[] | null }>(
      "select dados->'canaisDeAtendimento' as canais from plataforma.registros where workspace_id = $1 and colecao = 'lists' and id = $2",
      [espaco.workspaceId, id],
    );
    return rows[0]?.canais ?? undefined;
  };

  beforeAll(async () => {
    await prepararBancoCrm();
    espaco = montarEspacoDeVazamento("canaislista");
    await semearEspacoDeVazamento(espaco);
    outroEspaco = novoEspacoDeTeste("canaislistab");
    const ws = espaco.workspaceId;
    canalId = await semearCanal(ws, { nome: "WhatsApp da loja", tipo: "whatsapp", provedor: "whatsapp-cloud", identificadorExterno: "+5511911110001" });
    canalArquivadoId = await semearCanal(ws, { nome: "WhatsApp antigo", tipo: "whatsapp", provedor: "whatsapp-cloud", identificadorExterno: "+5511911110002" });
    await pool().query("update plataforma.canais set estado = 'arquivado', arquivado_em = now() where workspace_id = $1 and id = $2", [ws, canalArquivadoId]);
    canalDeOutroEspacoId = await semearCanal(outroEspaco, { nome: "De outro Espaço", tipo: "whatsapp", provedor: "whatsapp-cloud", identificadorExterno: "+5511911110003" });

    // Uma Lista que nasce operacional e vira conversacional, sem canais (a ordem do fluxo da tela).
    const criada = corpo(await chamar("createList", [{ name: "Atendimento da loja", parentType: "space", parentId: "spc_com" }]));
    expect(criada.ok, criada.error).toBe(true);
    listaId = criada.value!.id;
    const virada = corpo(await chamar("alterarModeloDaLista", [listaId, "conversacional"]));
    expect(virada.ok, virada.error).toBe(true);
  });

  afterAll(async () => {
    await limparEspacoDeVazamento(espaco);
    await limparEspaco(outroEspaco);
    await encerrar();
  });

  it("marcar um Canal da tabela na Lista funciona com a projeção desligada, e a Atividade usa o nome dele", async () => {
    const resposta = await chamar("definirCanaisDaLista", [listaId, [canalId]]);
    expect(resposta.statusCode, resposta.body.slice(0, 300)).toBe(200);
    const c = corpo(resposta);
    expect(c.ok, c.error).toBe(true);
    expect(await canaisDaListaNoBanco(listaId)).toEqual([canalId]);
    const { rows } = await pool().query<{ dados: { action: string; after?: string } }>(
      "select dados from plataforma.registros where workspace_id = $1 and colecao = 'activity' and dados->>'action' = 'Canais de atendimento alterados' and dados->>'objectId' = $2",
      [espaco.workspaceId, listaId],
    );
    expect(rows.map((r) => r.dados.after)).toContain("WhatsApp da loja");
  });

  it("um id que não existe em lugar nenhum é recusado, e a Lista segue com o Canal de antes", async () => {
    const c = corpo(await chamar("definirCanaisDaLista", [listaId, ["inexistente"]]));
    expect(c.ok).toBe(false);
    expect(c.error).toBe(FRASE_DE_CANAL_INVALIDO);
    expect(await canaisDaListaNoBanco(listaId)).toEqual([canalId]);
  });

  it("um `canais` forjado no corpo (Canal inexistente \"ativo\") não passa: o servidor o troca pelo que leu da tabela", async () => {
    const forjado = [{ id: "inexistente", nome: "Forjado", tipo: "whatsapp", estado: "ativo" }];
    const c = corpo(await chamar("definirCanaisDaLista", [listaId, ["inexistente"], forjado]));
    expect(c.ok).toBe(false);
    expect(c.error).toBe(FRASE_DE_CANAL_INVALIDO);
    expect(await canaisDaListaNoBanco(listaId)).toEqual([canalId]);
  });

  it("um `canais` forjado também não vale para um Canal arquivado da tabela nem para o de outro Espaço", async () => {
    const forjado = (id: string) => [{ id, nome: "Forjado", tipo: "whatsapp", estado: "ativo" }];
    const arquivado = corpo(await chamar("definirCanaisDaLista", [listaId, [canalArquivadoId], forjado(canalArquivadoId)]));
    expect(arquivado.ok).toBe(false);
    expect(arquivado.error).toBe(FRASE_DE_CANAL_INVALIDO);
    const deOutro = corpo(await chamar("definirCanaisDaLista", [listaId, [canalDeOutroEspacoId], forjado(canalDeOutroEspacoId)]));
    expect(deOutro.ok).toBe(false);
    expect(deOutro.error).toBe(FRASE_DE_CANAL_INVALIDO);
    expect(await canaisDaListaNoBanco(listaId)).toEqual([canalId]);
  });

  it("o Canal antigo de `registros` (o seed) segue aceito pelo mesmo id, sem tradução", async () => {
    const c = corpo(await chamar("definirCanaisDaLista", [listaId, ["chn_wpp"]]));
    expect(c.ok, c.error).toBe(true);
    expect(await canaisDaListaNoBanco(listaId)).toEqual(["chn_wpp"]);
  });

  it("createList de uma Lista conversacional com o Canal da tabela passa; com um Canal inexistente não cria nada", async () => {
    const criada = corpo(
      await chamar("createList", [{ name: "Suporte da loja", parentType: "space", parentId: "spc_com", modeloDeTarefa: "conversacional", canaisDeAtendimento: [canalId] }]),
    );
    expect(criada.ok, criada.error).toBe(true);
    expect(criada.value?.canaisDeAtendimento).toEqual([canalId]);

    const recusada = corpo(
      await chamar("createList", [{ name: "Suporte fantasma", parentType: "space", parentId: "spc_com", modeloDeTarefa: "conversacional", canaisDeAtendimento: ["inexistente"] }]),
    );
    expect(recusada.ok).toBe(false);
    expect(recusada.error).toBe(FRASE_DE_CANAL_INVALIDO);

    // O `canais` forjado de `createList` também é trocado.
    const forjada = corpo(
      await chamar("createList", [
        { name: "Suporte forjado", parentType: "space", parentId: "spc_com", modeloDeTarefa: "conversacional", canaisDeAtendimento: ["inexistente"] },
        [{ id: "inexistente", nome: "Forjado", tipo: "whatsapp", estado: "ativo" }],
      ]),
    );
    expect(forjada.ok).toBe(false);
    const { rows } = await pool().query("select 1 from plataforma.registros where workspace_id = $1 and colecao = 'lists' and dados->>'name' in ('Suporte fantasma', 'Suporte forjado')", [espaco.workspaceId]);
    expect(rows).toHaveLength(0);
  });

  it("mais de 100 itens em `canais` é 400 antes de tocar o banco (T-14-30)", async () => {
    const demais = Array.from({ length: 101 }, (_, i) => ({ id: `can_${i}` }));
    const resposta = await chamar("definirCanaisDaLista", [listaId, [canalId], demais]);
    expect(resposta.statusCode).toBe(400);
    expect(await canaisDaListaNoBanco(listaId)).toEqual(["chn_wpp"]);
  });
});
