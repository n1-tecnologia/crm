/**
 * `POST /operacoes/definirCanaisDaLista` e `POST /operacoes/createList` conferem
 * os Canais da Lista conversacional em `plataforma.canais`, dentro da transação
 * (Fase 14, 3.3.7). O servidor lê a tabela pela opção `lerDoCrm` de `executar()`
 * e SUBSTITUI o `canais` que veio do navegador (Pitfall 12, T-14-29).
 *
 * A projeção dos Canais para o estado saiu no 15-33 (3.5.4) e o recuo ao Canal
 * antigo de `registros` saiu no 15-42: a conferência lê só a tabela.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
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

  /** 5.1.2: um Canal atende em uma Lista conversacional só, então cada Lista que o teste cria pede o seu Canal. */
  let sequencia = 0;
  const canalNovo = (nome: string): Promise<string> => {
    sequencia += 1;
    return semearCanal(espaco.workspaceId, { nome, tipo: "whatsapp", provedor: "whatsapp-cloud", identificadorExterno: `+551192220${String(sequencia).padStart(4, "0")}` });
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

  it("marcar um Canal da tabela na Lista funciona, e a Atividade usa o nome dele", async () => {
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

  it("o id de um Canal antigo de `registros` (chn_wpp) já não vale: só `plataforma.canais` confere (15-42)", async () => {
    const c = corpo(await chamar("definirCanaisDaLista", [listaId, ["chn_wpp"]]));
    expect(c.ok).toBe(false);
    expect(c.error).toBe(FRASE_DE_CANAL_INVALIDO);
    expect(await canaisDaListaNoBanco(listaId)).toEqual([canalId]);
  });

  it("createList de uma Lista conversacional com o Canal da tabela passa; com um Canal inexistente não cria nada", async () => {
    const canalDoSuporte = await canalNovo("WhatsApp do suporte");
    const criada = corpo(
      await chamar("createList", [{ name: "Suporte da loja", parentType: "space", parentId: "spc_com", modeloDeTarefa: "conversacional", canaisDeAtendimento: [canalDoSuporte] }]),
    );
    expect(criada.ok, criada.error).toBe(true);
    expect(criada.value?.canaisDeAtendimento).toEqual([canalDoSuporte]);

    // 5.1.2: o Canal que a Lista acabou de ganhar não vai para uma segunda Lista, e a recusa não deixa Lista para trás.
    const repetida = corpo(
      await chamar("createList", [{ name: "Suporte repetido", parentType: "space", parentId: "spc_com", modeloDeTarefa: "conversacional", canaisDeAtendimento: [canalDoSuporte] }]),
    );
    expect(repetida.ok).toBe(false);
    expect(repetida.error).toBe("O Canal “WhatsApp do suporte” já atende na Lista “Suporte da loja”: um Canal só atende em uma Lista conversacional.");

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
    expect(await canaisDaListaNoBanco(listaId)).toEqual([canalId]);
  });

  describe("instantiateListTemplate (Fase 15, D-15-07)", () => {
    let templateId: string;

    const listasComNome = async (nome: string): Promise<number> => {
      const { rows } = await pool().query(
        "select 1 from plataforma.registros where workspace_id = $1 and colecao = 'lists' and dados->>'name' = $2",
        [espaco.workspaceId, nome],
      );
      return rows.length;
    };

    const instanciar = (nome: string, canaisDeAtendimento: string[], extra: unknown[] = []) =>
      chamar("instantiateListTemplate", [
        templateId,
        { name: nome, parentType: "space", parentId: "spc_com", modeloDeTarefa: "conversacional", canaisDeAtendimento },
        ...extra,
      ]);

    beforeAll(async () => {
      // Um Template de Lista com `listConfig` (o caminho que exige administrar o destino), salvo de uma Lista do Espaço.
      const base = corpo(await chamar("createList", [{ name: "Base do modelo", parentType: "space", parentId: "spc_com" }]));
      expect(base.ok, base.error).toBe(true);
      const salvo = (await chamar("saveListAsTemplate", [base.value!.id, { name: "Modelo de atendimento" }])).json() as { ok: boolean; error?: string; value?: { id: string } };
      expect(salvo.ok, salvo.error).toBe(true);
      templateId = salvo.value!.id;
    });

    it("instancia a Lista com um Canal que só existe em plataforma.canais, com a projeção desligada", async () => {
      const canalDaInstancia = await canalNovo("WhatsApp instanciado");
      const resposta = await instanciar("Atendimento instanciado", [canalDaInstancia]);
      expect(resposta.statusCode, resposta.body.slice(0, 300)).toBe(200);
      const c = corpo(resposta);
      expect(c.ok, c.error).toBe(true);
      expect(c.value?.canaisDeAtendimento).toEqual([canalDaInstancia]);
      expect(await canaisDaListaNoBanco(c.value!.id)).toEqual([canalDaInstancia]);
    });

    it("um id de Canal que não existe em lugar nenhum é recusado, e nenhuma Lista nasce", async () => {
      const c = corpo(await instanciar("Atendimento fantasma", ["inexistente"]));
      expect(c.ok).toBe(false);
      expect(c.error).toBe(FRASE_DE_CANAL_INVALIDO);
      expect(await listasComNome("Atendimento fantasma")).toBe(0);
    });

    it("um `canais` forjado no corpo (Canal inexistente \"ativo\") é descartado: o servidor confere pela tabela", async () => {
      const forjado = [{ id: "inexistente", nome: "Forjado", tipo: "whatsapp", estado: "ativo" }];
      const c = corpo(await instanciar("Atendimento forjado", ["inexistente"], [forjado]));
      expect(c.ok).toBe(false);
      expect(c.error).toBe(FRASE_DE_CANAL_INVALIDO);
      expect(await listasComNome("Atendimento forjado")).toBe(0);
      // Nem para o Canal arquivado da tabela nem para o de outro Espaço.
      const arquivado = corpo(await instanciar("Atendimento forjado 2", [canalArquivadoId], [[{ id: canalArquivadoId, nome: "Forjado", tipo: "whatsapp", estado: "ativo" }]]));
      expect(arquivado.ok).toBe(false);
      expect(arquivado.error).toBe(FRASE_DE_CANAL_INVALIDO);
      const deOutro = corpo(await instanciar("Atendimento forjado 3", [canalDeOutroEspacoId], [[{ id: canalDeOutroEspacoId, nome: "Forjado", tipo: "whatsapp", estado: "ativo" }]]));
      expect(deOutro.ok).toBe(false);
      expect(deOutro.error).toBe(FRASE_DE_CANAL_INVALIDO);
    });

    it("instanciar o mesmo Template duas vezes cria duas Listas independentes, as duas conferidas pela tabela, cada uma com o seu Canal", async () => {
      const canalA = await canalNovo("WhatsApp repetido A");
      const canalB = await canalNovo("WhatsApp repetido B");
      const a = corpo(await instanciar("Atendimento repetido A", [canalA]));
      const b = corpo(await instanciar("Atendimento repetido B", [canalB]));
      expect(a.ok, a.error).toBe(true);
      expect(b.ok, b.error).toBe(true);
      expect(a.value!.id).not.toBe(b.value!.id);
      expect(await canaisDaListaNoBanco(a.value!.id)).toEqual([canalA]);
      expect(await canaisDaListaNoBanco(b.value!.id)).toEqual([canalB]);

      // 5.1.2: pedir o Canal da Lista A numa terceira Lista é recusado, e nenhuma Lista nasce.
      const terceira = corpo(await instanciar("Atendimento repetido C", [canalA]));
      expect(terceira.ok).toBe(false);
      expect(terceira.error).toContain("já atende na Lista “Atendimento repetido A”");
      expect(await listasComNome("Atendimento repetido C")).toBe(0);
    });

    it("mais de 100 itens em `canais` é 400 antes de tocar o banco (T-14-30)", async () => {
      const demais = Array.from({ length: 101 }, (_, i) => ({ id: `can_${i}` }));
      const resposta = await instanciar("Atendimento demais", [canalId], [demais]);
      expect(resposta.statusCode).toBe(400);
      expect(await listasComNome("Atendimento demais")).toBe(0);
    });
  });
});
