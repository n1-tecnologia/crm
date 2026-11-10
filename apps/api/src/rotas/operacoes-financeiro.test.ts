/**
 * `POST /operacoes/createReceivableSeries` confere o cliente da série em `plataforma.contatos`,
 * dentro da transação (Fase 15, 3.4.10, UCR-08). O servidor lê o Contato citado pelo `LER_DO_CRM_FINANCEIRO`
 * e SUBSTITUI o `clientes` que veio do navegador (T-15-48): quem decide se o cliente vale é a tabela.
 *
 * O Contato destes testes só existe em `plataforma.contatos`; o seed do Espaço traz outros no modelo
 * antigo (`cnt_*` em `registros`), que já não valem como cliente de uma série nova.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { encerrar, pool } from "../persistencia/conexao";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm } from "../testes/banco-crm";
import {
  appDoEspaco,
  limparEspacoDeVazamento,
  montarEspacoDeVazamento,
  semearEspacoDeVazamento,
  TOKENS_DE_VAZAMENTO,
  type EspacoDeVazamento,
} from "../testes/espaco-de-vazamento";

const FRASE_DE_CLIENTE = "Cliente não encontrado.";

describeComBanco("POST /operacoes/createReceivableSeries — o cliente conferido em plataforma.contatos (15-19, 3.4.10)", () => {
  let espaco: EspacoDeVazamento;
  let outroEspaco: string;
  let contato: string;
  let contatoNaLixeira: string;
  let contatoDeOutroEspaco: string;
  let contatoDaSegundaSerie: string;
  let dono: string;

  const chamar = (args: unknown[], token: string = TOKENS_DE_VAZAMENTO.proprietario) =>
    appDoEspaco(espaco).inject({
      method: "POST",
      url: "/operacoes/createReceivableSeries",
      headers: { authorization: `Bearer ${token}` },
      payload: { args },
    });

  const corpo = (resposta: { json: () => unknown }) => resposta.json() as { ok: boolean; error?: string; value?: Array<{ id: string; title: string }> };

  const serie = (contactId: string) => ({ contactId, centroDeCusto: "Tria Tech", valorParcela: 500, parcelas: 2, primeiroVencimento: "2030-01-31" });

  const contasNoBanco = async (): Promise<number> => {
    const { rows } = await pool().query<{ n: string }>(
      "select count(*)::text as n from plataforma.registros where workspace_id = $1 and colecao = 'tasks' and dados->>'listId' = 'lst_contas_a_receber'",
      [espaco.workspaceId],
    );
    return Number(rows[0]?.n ?? 0);
  };

  const vinculosDoCliente = async (id: string): Promise<Array<{ toType: string; role: string }>> => {
    const { rows } = await pool().query<{ dados: { toType: string; role: string } }>(
      "select dados from plataforma.registros where workspace_id = $1 and colecao = 'links' and dados->>'toId' = $2 order by id",
      [espaco.workspaceId, id],
    );
    return rows.map((r) => ({ toType: r.dados.toType, role: r.dados.role }));
  };

  const inserirContato = async (workspaceId: string, nome: string, estado = "ativo"): Promise<string> =>
    (
      await pool().query<{ id: string }>(
        "insert into plataforma.contatos (workspace_id, nome, estado, proprietario_id, criado_por) values ($1, $2, $3, $4, $4) returning id",
        [workspaceId, nome, estado, dono],
      )
    ).rows[0]!.id;

  beforeAll(async () => {
    await prepararBancoCrm();
    espaco = montarEspacoDeVazamento("financeiro");
    await semearEspacoDeVazamento(espaco);
    outroEspaco = novoEspacoDeTeste("financeirob");
    dono = espaco.membros.a.id;
    contato = await inserirContato(espaco.workspaceId, "Ana Lima");
    contatoDaSegundaSerie = await inserirContato(espaco.workspaceId, "Bruno Reis");
    contatoNaLixeira = await inserirContato(espaco.workspaceId, "Carla Dias", "na_lixeira");
    contatoDeOutroEspaco = await inserirContato(outroEspaco, "Alheio");
  });

  afterAll(async () => {
    await limparEspacoDeVazamento(espaco);
    await limparEspaco(outroEspaco);
    await encerrar();
  });

  it("(a) traçador: um Contato só da tabela vira cliente — as contas nascem com o nome lido e o Vínculo cliente leva o id novo", async () => {
    const antes = await contasNoBanco();
    const resposta = await chamar([serie(contato)]);
    expect(resposta.statusCode, resposta.body.slice(0, 300)).toBe(200);
    const c = corpo(resposta);
    expect(c.ok, c.error).toBe(true);
    expect(c.value?.map((t) => t.title)).toEqual(["1ª Parcela – Ana Lima", "2ª Parcela – Ana Lima"]);
    expect(await contasNoBanco()).toBe(antes + 2);
    expect(await vinculosDoCliente(contato)).toEqual([
      { toType: "contact", role: "cliente" },
      { toType: "contact", role: "cliente" },
    ]);
  });

  it("(b) um `clientes` forjado no corpo (Contato inexistente \"ativo\") não passa: o servidor o troca pelo que leu da tabela", async () => {
    const antes = await contasNoBanco();
    const forjado = { contatos: [{ id: "inexistente", nome: "Forjado", estado: "ativo", proprietarioId: dono }], empresas: [] };
    const c = corpo(await chamar([serie("inexistente"), forjado]));
    expect(c.ok).toBe(false);
    expect(c.error).toBe(FRASE_DE_CLIENTE);
    expect(await contasNoBanco()).toBe(antes);
  });

  it("(c) cliente na lixeira é recusado, mesmo com um `clientes` forjado que o diz ativo", async () => {
    const antes = await contasNoBanco();
    const forjado = { contatos: [{ id: contatoNaLixeira, nome: "Carla Dias", estado: "ativo", proprietarioId: dono }], empresas: [] };
    const semForja = corpo(await chamar([serie(contatoNaLixeira)]));
    expect(semForja.ok).toBe(false);
    expect(semForja.error).toBe(FRASE_DE_CLIENTE);
    const comForja = corpo(await chamar([serie(contatoNaLixeira), forjado]));
    expect(comForja.ok).toBe(false);
    expect(comForja.error).toBe(FRASE_DE_CLIENTE);
    expect(await contasNoBanco()).toBe(antes);
  });

  it("(d) o Contato de outro Espaço não é cliente deste, nem com `clientes` forjado", async () => {
    const forjado = { contatos: [{ id: contatoDeOutroEspaco, nome: "Alheio", estado: "ativo", proprietarioId: dono }], empresas: [] };
    const c = corpo(await chamar([serie(contatoDeOutroEspaco), forjado]));
    expect(c.ok).toBe(false);
    expect(c.error).toBe(FRASE_DE_CLIENTE);
  });

  it("(e) criar a mesma série duas vezes segue a regra de hoje (RN-CR-07): a segunda é recusada e não cria nada", async () => {
    const primeira = corpo(await chamar([serie(contatoDaSegundaSerie)]));
    expect(primeira.ok, primeira.error).toBe(true);
    const antes = await contasNoBanco();
    const segunda = corpo(await chamar([serie(contatoDaSegundaSerie)]));
    expect(segunda.ok).toBe(false);
    expect(segunda.error).toBe("Bruno Reis já tem a 1ª Parcela nesta Lista. Descarte a série antiga antes de criar outra.");
    expect(await contasNoBanco()).toBe(antes);
  });

  it("(f) o Contato do modelo antigo (seed, só em `registros`) já não vale como cliente de uma série nova", async () => {
    const antes = await contasNoBanco();
    const c = corpo(await chamar([serie("cnt_2")]));
    expect(c.ok).toBe(false);
    expect(c.error).toBe(FRASE_DE_CLIENTE);
    expect(await contasNoBanco()).toBe(antes);
  });
});
