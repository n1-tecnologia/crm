/**
 * 15-11 Task 1 — a lista da Caixa traz, em cada item, o momento da última
 * Mensagem RECEBIDA da Conversa (`ultimaRecebidaEm`), na mesma consulta da
 * página: a janela de resposta do Canal (RN-CXE-19) se calcula na tela sem uma
 * ida por linha. Arquivo próprio para não disputar `conversas.test.ts` com os
 * planos 15-06 e 15-09. Contra o Postgres LOCAL:
 *
 *   DATABASE_URL=postgres://postgres:x@localhost:55711/postgres \
 *   DATABASE_URL_MIGRACAO=postgres://postgres:x@localhost:55711/postgres \
 *   npx vitest run src/servicos/crm/conversas-lista.test.ts
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { MembroDaSessao } from "../../plugins/autenticacao";
import { encerrar, pool } from "../../persistencia/conexao";
import { criarRepositorioDeContatosPg } from "../../repositorios/crm/contatos";
import { criarRepositorioDeMensagensPg } from "../../repositorios/crm/mensagens";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearCanal, semearMembro } from "../../testes/banco-crm";
import { criarAcessoAoCrmPg } from "./acesso";
import { criarServicoDeConversas } from "./conversas";
import type { ResultadoCrm } from "./resultado";

const servico = criarServicoDeConversas({ pool, acesso: criarAcessoAoCrmPg(pool) });

const sessao = (workspaceId: string, id: string): MembroDaSessao => ({ id, workspaceId, state: "ativo" });

function valor<T>(resultado: ResultadoCrm<T>): T {
  if (!resultado.ok) throw new Error(`esperava sucesso, veio ${resultado.status} ${resultado.codigo ?? ""}: ${resultado.error}`);
  return resultado.valor;
}

const horasAtras = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const todas = { estado: "ativo", limite: 50, deslocamento: 0 } as const;

describeComBanco("ConversaNaLista.ultimaRecebidaEm — Postgres local", () => {
  const espacos: string[] = [];

  beforeAll(async () => {
    await prepararBancoCrm();
  });

  afterAll(async () => {
    for (const ws of espacos) await limparEspaco(ws);
    await encerrar();
  });

  async function cenario(rotulo: string) {
    const ws = novoEspacoDeTeste(rotulo);
    espacos.push(ws);
    await semearMembro(ws, { id: "mem_ana", base: "membro", state: "ativo" });
    const contatos = criarRepositorioDeContatosPg(pool());
    const contato = async (nome: string, whatsapp: string) => {
      const criado = await contatos.inserir(ws, { nome, proprietarioId: "mem_ana", criadoPor: "mem_ana" });
      await contatos.inserirIdentificador(ws, criado.id, { tipo: "whatsapp", valor: whatsapp, principal: true });
      return criado.id;
    };
    const canal = await semearCanal(ws, {
      nome: "Comercial",
      tipo: "whatsapp",
      provedor: "whatsapp-nao-oficial",
      identificadorExterno: "+5511977771101",
      conexao: "conectada",
    });
    return { ws, membro: sessao(ws, "mem_ana"), contato, canal };
  }

  async function recebida(ws: string, conversaId: string, canalId: string, idExterno: string, criadoEm: string) {
    await criarRepositorioDeMensagensPg(pool()).inserirRecebida(ws, {
      conversaId,
      canalId,
      idExterno,
      criadoEm,
      conteudo: "oi",
      anexos: [],
      assunto: null,
      enderecosAdicionais: [],
      remetenteExterno: null,
      identificadorId: null,
      cargaBruta: {},
    });
  }

  it("é o criadoEm da recebida MAIS RECENTE, mesmo com uma enviada depois dela; sem recebida é null", async () => {
    const c = await cenario("ultimarecebida");
    const ana = await c.contato("Ana", "+5511966661101");
    const bia = await c.contato("Bia", "+5511966661102");
    const daAna = valor(await servico.criar(c.membro, { canalId: c.canal, contatoId: ana, mensagem: { conteudo: "Oi, Ana" } })).conversa;
    const daBia = valor(await servico.criar(c.membro, { canalId: c.canal, contatoId: bia, mensagem: { conteudo: "Oi, Bia" } })).conversa;

    // A Ana: duas recebidas (t0 e t1) e a enviada da abertura (agora, depois das duas).
    const t0 = horasAtras(5);
    const t1 = horasAtras(3);
    await recebida(c.ws, daAna.id, c.canal, "wamid.u1", t0);
    await recebida(c.ws, daAna.id, c.canal, "wamid.u2", t1);

    const lista = valor(await servico.listar(c.membro, todas));
    const itemDaAna = lista.itens.find((i) => i.id === daAna.id);
    const itemDaBia = lista.itens.find((i) => i.id === daBia.id);
    expect(itemDaAna?.ultimaRecebidaEm).toBe(t1);
    // A Bia só tem a enviada da abertura: não há recebida.
    expect(itemDaBia?.ultimaRecebidaEm).toBeNull();
  });

  it("a recebida de outra Conversa não vaza para o item", async () => {
    const c = await cenario("semvazamento");
    const ana = await c.contato("Ana", "+5511966661103");
    const bia = await c.contato("Bia", "+5511966661104");
    const daAna = valor(await servico.criar(c.membro, { canalId: c.canal, contatoId: ana, mensagem: { conteudo: "Oi" } })).conversa;
    const daBia = valor(await servico.criar(c.membro, { canalId: c.canal, contatoId: bia, mensagem: { conteudo: "Oi" } })).conversa;
    const t = horasAtras(2);
    await recebida(c.ws, daBia.id, c.canal, "wamid.v1", t);

    const lista = valor(await servico.listar(c.membro, todas));
    expect(lista.itens.find((i) => i.id === daAna.id)?.ultimaRecebidaEm).toBeNull();
    expect(lista.itens.find((i) => i.id === daBia.id)?.ultimaRecebidaEm).toBe(t);
  });
});
