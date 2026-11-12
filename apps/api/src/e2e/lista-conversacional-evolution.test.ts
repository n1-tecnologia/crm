/**
 * Responder pela Tarefa da Lista conversacional, pela Evolution (Sessão 5, 5.2.2), contra o Postgres LOCAL:
 *
 *   DATABASE_URL=postgres://postgres:x@localhost:55750/postgres \
 *   DATABASE_URL_MIGRACAO=postgres://postgres:x@localhost:55750/postgres npx vitest run src/e2e/lista-conversacional-evolution.test.ts
 *
 * O percurso é o da ficha da Tarefa: `POST /tarefas-conversacionais` cria a Tarefa num Canal Evolution e abre a Conversa com a
 * primeira Mensagem (`pendente`, com o evento de saída no mesmo commit); o worker de saída a entrega pela instância do Canal; a
 * Mensagem fica `enviada` com o `id_externo` que a Evolution devolveu. Duas execuções do MESMO percurso:
 *
 *   1. contra o servidor FALSO (`testes/servidor-falso.ts`), sempre que há Postgres local. Como a Evolution é de mentira, aqui
 *      também se prova a volta: o `messages.update` de entrega entra pelo webhook do Canal e a Mensagem fica `entregue`;
 *   2. contra uma Evolution REAL de homologação, só quando as variáveis abaixo existem. Ela MANDA a mensagem de verdade para
 *      `EVOLUTION_HOMOLOGACAO_DESTINO`, então use um número seu e uma instância que não seja a de produção nem a do
 *      `automation/` (a `numeropvmarcos`: o teste recusa o nome). Sem as variáveis, o bloco é pulado.
 *
 *        EVOLUTION_HOMOLOGACAO_URL        base da Evolution, sem barra final
 *        EVOLUTION_HOMOLOGACAO_INSTANCIA  nome de uma instância já conectada
 *        EVOLUTION_HOMOLOGACAO_APIKEY     a chave DESSA instância (não a global)
 *        EVOLUTION_HOMOLOGACAO_DESTINO    número que recebe a mensagem, no formato +5511999999999
 *
 *      O `entregue` não é provado contra a Evolution real: o `messages.update` dela vai para a URL pública da api, não para este
 *      teste. Ver o aparelho receber e o tique chegar à ficha é o passo 4 do roteiro da 5.3.1.
 *
 * A execução real NUNCA rodou até a escrita deste arquivo: foi escrita contra o formato da Evolution 2.4.0 que a fumaça
 * (`npm run evolution:fumaca`) e o servidor falso já usam.
 */

import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildSeed } from "@n1/dominio/seed";
import { ok } from "@n1/dominio/state";
import { buildApp } from "../app";
import { criarWorkerDeSaida } from "../mensageria/entregar-mensagem";
import { criarProcessadorDeEntrada } from "../mensageria/processador-de-entrada";
import { ehInstanciaDoFinanceiro } from "../mensageria/provedores/evolution/ambiente";
import { CABECALHO_DO_SEGREDO, TIPO_DO_SEGREDO_DO_WEBHOOK } from "../mensageria/provedor";
import { criarProvedorEvolution } from "../mensageria/provedores/evolution/provedor";
import { provedorDeTeste } from "../mensageria/provedores/teste";
import type { RegistroDeProvedores } from "../mensageria/registro";
import { encerrar, pool } from "../persistencia/conexao";
import { semear } from "../persistencia/repositorio";
import { executar } from "../persistencia/unidade-de-trabalho";
import { criarRepositorioDeContatosPg } from "../repositorios/crm/contatos";
import { guardarCredencial, type ChavesDoCofre } from "../servicos/cofre";
import { criarServidorFalso, type ServidorFalso } from "../testes/servidor-falso";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearCanal } from "../testes/banco-crm";

const LISTA = "lst_pos_venda";
const MEMBRO = { authorization: "Bearer token-thiago" };
const chaves: ChavesDoCofre = { atual: { versao: 1, chave: randomBytes(32) } };
const membroBase = buildSeed().members.find((m) => m.id === "mem_thiago")!;

interface Envelope {
  ok: boolean;
  dados?: { task?: { id: string }; conversa?: { id: string; aberta: boolean }; value?: { task: { id: string } } };
  itens?: Array<{ id: string; statusEntrega: string | null; idExterno: string | null; direcao: string; conteudo: string | null; motivoFalha: string | null }>;
}

/** A Evolution contra a qual o percurso roda: a URL, a instância e a chave dela, e o número que recebe. */
interface AlvoDaEvolution {
  readonly rotulo: string;
  readonly url: string;
  readonly instancia: string;
  readonly apikey: string;
  readonly destino: string;
}

const homologacao = ((): Omit<AlvoDaEvolution, "rotulo"> | undefined => {
  const url = process.env.EVOLUTION_HOMOLOGACAO_URL?.trim().replace(/\/+$/, "");
  const instancia = process.env.EVOLUTION_HOMOLOGACAO_INSTANCIA?.trim();
  const apikey = process.env.EVOLUTION_HOMOLOGACAO_APIKEY?.trim();
  const destino = process.env.EVOLUTION_HOMOLOGACAO_DESTINO?.trim();
  if (!url || !instancia || !apikey || !destino) return undefined;
  if (ehInstanciaDoFinanceiro(instancia)) throw new Error("EVOLUTION_HOMOLOGACAO_INSTANCIA aponta para a instância do Financeiro: recusado.");
  if (!/^\+\d{10,15}$/.test(destino)) throw new Error("EVOLUTION_HOMOLOGACAO_DESTINO precisa estar no formato +5511999999999.");
  return { url, instancia, apikey, destino };
})();

/** O percurso inteiro, uma vez, contra `alvo`. `aoEnviar` programa a resposta da Evolution de mentira; a real não precisa. */
function percurso(alvo: () => AlvoDaEvolution, opcoes: { readonly aoEnviar?: (idExterno: string) => void; readonly provaAEntrega: boolean }) {
  return () => {
    const ws = novoEspacoDeTeste("listaevolution");
    const SEGREDO = "s1-do-canal-da-evolution-da-lista";
    let registro: RegistroDeProvedores;
    let canalId: string;
    let contatoId: string;

    const app = () =>
      buildApp({
        logger: false,
        workspaceId: ws,
        webhooksDeMensageria: { chaves, registro },
        verificarToken: async (token) => (token === "token-thiago" ? { sub: "usuario-thiago" } : null),
        resolverMembro: async (_workspaceId, userId) => (userId === "usuario-thiago" ? { ...membroBase, userId, state: "ativo" as const } : undefined),
      });

    beforeAll(async () => {
      await prepararBancoCrm();
      const a = alvo();
      registro = { teste: provedorDeTeste, porProvedor: { "whatsapp-nao-oficial": criarProvedorEvolution({ url: a.url }) } };
      const cliente = await pool().connect();
      try {
        await semear(cliente, ws, buildSeed());
      } finally {
        cliente.release();
      }
      canalId = await semearCanal(ws, {
        nome: "WhatsApp da Lista",
        tipo: "whatsapp",
        provedor: "whatsapp-nao-oficial",
        identificadorExterno: "+5511977770001",
        conexao: "conectada",
        conexaoSimulada: false,
        configuradoPor: "mem_thiago",
      });
      const dono = { workspaceId: ws, donoTipo: "canal", donoId: canalId } as const;
      await guardarCredencial(pool(), chaves, { ...dono, tipo: TIPO_DO_SEGREDO_DO_WEBHOOK, segredo: SEGREDO });
      await guardarCredencial(pool(), chaves, { ...dono, tipo: "whatsapp-nao-oficial", segredo: JSON.stringify({ instancia: a.instancia, apikey: a.apikey }) });
      await executar(ws, (state) => {
        const lista = state.lists.find((l) => l.id === LISTA);
        if (!lista) throw new Error("o seed precisa de lst_pos_venda");
        lista.canaisDeAtendimento = [canalId];
        return ok(undefined);
      });
      const contatos = criarRepositorioDeContatosPg(pool());
      const criado = await contatos.inserir(ws, { nome: "Contato de homologação", proprietarioId: "mem_thiago", criadoPor: "mem_thiago" });
      await contatos.inserirIdentificador(ws, criado.id, { tipo: "whatsapp", valor: a.destino, principal: true });
      contatoId = criado.id;
    });

    afterAll(async () => {
      await pool().query("delete from plataforma.integration_outbox where workspace_id = $1", [ws]);
      await pool().query("delete from plataforma.credenciais where workspace_id = $1", [ws]);
      await limparEspaco(ws);
    });

    it("a primeira Mensagem da Tarefa sai pela instância do Canal e fica enviada com o id da Evolution", async () => {
      opcoes.aoEnviar?.("3EB0LISTA01");
      const criada = await app().inject({
        method: "POST",
        url: "/tarefas-conversacionais",
        headers: MEMBRO,
        payload: { listId: LISTA, contatoId, canalId, mensagem: { conteudo: "Olá, aqui é o teste da Lista conversacional." } },
      });
      expect(criada.statusCode, criada.body).toBe(201);
      const conversaId = (criada.json() as Envelope).dados!.conversa!.id;

      const worker = criarWorkerDeSaida({ workerId: "teste-lista-evolution", workspaceId: ws, chaves, registro });
      expect(await worker.processarUm()).toBe(true);

      const fio = (await app().inject({ method: "GET", url: `/mensagens?conversaId=${conversaId}`, headers: MEMBRO })).json() as Envelope;
      const enviada = fio.itens!.find((m) => m.direcao === "enviada")!;
      expect(enviada, JSON.stringify(fio.itens)).toMatchObject({ statusEntrega: "enviada", motivoFalha: null });
      expect(enviada.idExterno).toEqual(expect.stringMatching(/\S+/));
      if (opcoes.aoEnviar) expect(enviada.idExterno).toBe("3EB0LISTA01");

      if (!opcoes.provaAEntrega) return;
      // A volta: a Evolution avisa que a Mensagem chegou ao aparelho. Entra pelo webhook do Canal, como em produção.
      const a = alvo();
      const resposta = await app().inject({
        method: "POST",
        url: `/webhooks/mensageria/${canalId}`,
        headers: { [CABECALHO_DO_SEGREDO]: SEGREDO },
        payload: { event: "messages.update", instance: a.instancia, data: { keyId: enviada.idExterno, remoteJid: `${a.destino.slice(1)}@s.whatsapp.net`, fromMe: true, status: "DELIVERY_ACK", instanceId: "i" } },
      });
      expect(resposta.statusCode).toBe(200);
      const processador = criarProcessadorDeEntrada({ workerId: "teste-lista-evolution-entrada", chaves, registro });
      expect(await processador.processarUm()).toBe(true);
      const depois = (await app().inject({ method: "GET", url: `/mensagens?conversaId=${conversaId}`, headers: MEMBRO })).json() as Envelope;
      expect(depois.itens!.find((m) => m.id === enviada.id)).toMatchObject({ statusEntrega: "entregue" });
    });
  };
}

describeComBanco("Sessão 5: responder pela Tarefa, contra a Evolution de mentira", () => {
  let falso: ServidorFalso;
  beforeAll(async () => {
    falso = await criarServidorFalso();
  });
  afterAll(async () => {
    await falso.fechar();
    await encerrar();
  });

  describe(
    "percurso",
    percurso(() => ({ rotulo: "falso", url: falso.url, instancia: "inst-lista", apikey: "tok-lista", destino: "+5511987654321" }), {
      provaAEntrega: true,
      aoEnviar: (idExterno) =>
        falso.enfileirar({ kind: "ok", status: 201, corpo: { key: { remoteJid: "5511987654321@s.whatsapp.net", fromMe: true, id: idExterno }, status: "PENDING" } }),
    }),
  );
});

// Pulado sem as variáveis: roda só quando alguém aponta o teste para uma Evolution de homologação.
(homologacao ? describeComBanco : describe.skip)("Sessão 5: responder pela Tarefa, contra a Evolution de HOMOLOGAÇÃO (manda mensagem de verdade)", () => {
  afterAll(async () => {
    await encerrar();
  });
  describe("percurso", percurso(() => ({ rotulo: "homologação", ...homologacao! }), { provaAEntrega: false }));
});
