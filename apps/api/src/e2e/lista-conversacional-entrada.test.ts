/**
 * A Lista conversacional recebe a Mensagem, ponta a ponta (Sessão 5, 5.1.5), contra o Postgres LOCAL (Docker):
 *
 *   DATABASE_URL=postgres://postgres:x@localhost:55750/postgres \
 *   DATABASE_URL_MIGRACAO=postgres://postgres:x@localhost:55750/postgres npx vitest run src/e2e/lista-conversacional-entrada.test.ts
 *
 * Um Canal simulado, marcado como Canal de atendimento da Lista `lst_pos_venda` do seed, recebe `POST /webhooks/mensageria/:canalId`
 * do provedor de teste. O processador cria Contato, Conversa e Mensagem e, no passo seguinte, a Tarefa do Contato na Lista:
 * a primeira mensagem de um número novo cria uma Tarefa, as seguintes e a repetição do mesmo webhook não criam outra, um Canal
 * fora da Lista não cria nenhuma, e, se o passo da Tarefa falha, a linha volta à fila e a passada seguinte termina o serviço
 * sem duplicar a Mensagem nem a Tarefa.
 */

import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildSeed } from "@n1/dominio/seed";
import { ok } from "@n1/dominio/state";
import { buildApp } from "../app";
import { criarProcessadorDeEntrada } from "../mensageria/processador-de-entrada";
import { CABECALHO_DO_SEGREDO, TIPO_DO_SEGREDO_DO_WEBHOOK } from "../mensageria/provedor";
import { encerrar, pool } from "../persistencia/conexao";
import { semear } from "../persistencia/repositorio";
import { executar } from "../persistencia/unidade-de-trabalho";
import { guardarCredencial, type ChavesDoCofre } from "../servicos/cofre";
import { criarServicoDaTarefaDaMensagem, type ServicoDaTarefaDaMensagem } from "../servicos/crm/tarefa-da-mensagem";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearCanal } from "../testes/banco-crm";

const chaves: ChavesDoCofre = { atual: { versao: 1, chave: randomBytes(32) } };
const SEGREDO = "s1-do-canal-da-lista";
const LISTA = "lst_pos_venda";
const WHATSAPP_DA_ANA = "+5511987654321";

const corpo = (idExterno: string, conteudo = "oi") => ({
  eventos: [{ tipo: "mensagem", idExterno, remetente: { tipo: "whatsapp", valor: WHATSAPP_DA_ANA, nomeExibido: "Ana Souza" }, conteudo }],
});

describeComBanco("Sessão 5 ponta a ponta: a Mensagem recebida cria a Tarefa na Lista conversacional do Canal", () => {
  const ws = novoEspacoDeTeste("listaentrada");
  let canalDaLista: string;
  let canalForaDaLista: string;

  const app = () => buildApp({ logger: false, workspaceId: ws, webhooksDeMensageria: { chaves } });

  const receber = async (canalId: string, payload: unknown) => {
    const resposta = await app().inject({ method: "POST", url: `/webhooks/mensageria/${canalId}`, headers: { [CABECALHO_DO_SEGREDO]: SEGREDO }, payload: payload as object });
    expect(resposta.statusCode).toBe(200);
  };

  const processarTudo = async (tarefaDaMensagem?: ServicoDaTarefaDaMensagem) => {
    const processador = criarProcessadorDeEntrada({ workerId: "teste-lista", chaves, ...(tarefaDaMensagem ? { tarefaDaMensagem } : {}) });
    let n = 0;
    while (await processador.processarUm()) n += 1;
    return n;
  };

  const tarefasDoContato = async () =>
    (
      await pool().query<{ id: string; titulo: string }>(
        `select t.dados->>'id' as id, t.dados->>'title' as titulo
           from plataforma.registros t
           join plataforma.registros l on l.workspace_id = t.workspace_id and l.colecao = 'links' and l.dados->>'fromId' = t.dados->>'id' and l.dados->>'toType' = 'contact'
           join plataforma.contatos c on c.workspace_id = l.workspace_id and c.id::text = l.dados->>'toId'
          where t.workspace_id = $1 and t.colecao = 'tasks' and t.dados->>'listId' = $2`,
        [ws, LISTA],
      )
    ).rows;

  const linhas = async () =>
    (await pool().query<{ estado: string; resultado: string | null }>("select estado, resultado from plataforma.webhooks_recebidos where workspace_id = $1 order by recebido_em", [ws])).rows;

  const mensagens = async () => Number((await pool().query<{ n: string }>("select count(*) as n from plataforma.mensagens where workspace_id = $1", [ws])).rows[0]!.n);

  beforeAll(async () => {
    await prepararBancoCrm();
    const cliente = await pool().connect();
    try {
      await semear(cliente, ws, buildSeed());
    } finally {
      cliente.release();
    }
    const novoCanal = async (nome: string, numero: string) => {
      const id = await semearCanal(ws, { nome, tipo: "whatsapp", provedor: "whatsapp-nao-oficial", identificadorExterno: numero, conexao: "conectada", conexaoSimulada: true, configuradoPor: "mem_thiago" });
      await guardarCredencial(pool(), chaves, { workspaceId: ws, donoTipo: "canal", donoId: id, tipo: TIPO_DO_SEGREDO_DO_WEBHOOK, segredo: SEGREDO });
      return id;
    };
    canalDaLista = await novoCanal("Comercial", "+5511977770001");
    canalForaDaLista = await novoCanal("Suporte", "+5511977770002");
    await executar(ws, (state) => {
      const lista = state.lists.find((l) => l.id === LISTA);
      if (!lista) throw new Error("o seed precisa de lst_pos_venda");
      lista.canaisDeAtendimento = [canalDaLista];
      return ok(undefined);
    });
  });

  afterAll(async () => {
    await pool().query("delete from plataforma.credenciais where workspace_id = $1", [ws]);
    await limparEspaco(ws);
    await encerrar();
  });

  it("a primeira Mensagem de um número novo cria Contato, Conversa, Mensagem e UMA Tarefa na Lista", async () => {
    await receber(canalDaLista, corpo("e1"));
    expect(await processarTudo()).toBe(1);

    expect(await tarefasDoContato()).toEqual([{ id: expect.any(String), titulo: "Ana Souza" }]);
    expect(await mensagens()).toBe(1);
    expect((await linhas()).at(-1)).toEqual({ estado: "processado", resultado: "tarefa:criada" });
  });

  it("a segunda Mensagem do mesmo número, e a repetição do mesmo webhook, não criam outra Tarefa", async () => {
    await receber(canalDaLista, corpo("e2", "e agora?"));
    await receber(canalDaLista, corpo("e2", "e agora?"));
    await processarTudo();

    expect(await tarefasDoContato()).toHaveLength(1);
    expect(await mensagens()).toBe(2);
    const estados = (await linhas()).slice(1);
    expect(estados.every((l) => l.estado === "processado")).toBe(true);
    // Nenhuma das duas mexeu em Tarefa: o `resultado` só diz o que aconteceu de fora do comum.
    expect(estados.every((l) => l.resultado === null || !l.resultado.startsWith("tarefa:criada"))).toBe(true);
  });

  it("um Canal que nenhuma Lista conversacional atende grava a Mensagem e não cria Tarefa", async () => {
    const antes = (await tarefasDoContato()).length;
    await receber(canalForaDaLista, { eventos: [{ tipo: "mensagem", idExterno: "f1", remetente: { tipo: "whatsapp", valor: "+5511912345678", nomeExibido: "Bia Lima" }, conteudo: "oi" }] });
    await processarTudo();

    expect(await tarefasDoContato()).toHaveLength(antes);
    expect(await mensagens()).toBe(3);
  });

  it("se o passo da Tarefa falha, a linha volta à fila; a passada seguinte cria a Tarefa uma vez e não duplica a Mensagem", async () => {
    const real = criarServicoDaTarefaDaMensagem({ pool: () => pool() });
    let tentativas = 0;
    const quebraUmaVez: ServicoDaTarefaDaMensagem = {
      async aplicar(entrada) {
        tentativas += 1;
        if (tentativas === 1) throw new Error("falha do passo da Tarefa");
        return real.aplicar(entrada);
      },
    };
    const antes = (await tarefasDoContato()).length;
    const mensagensAntes = await mensagens();
    await receber(canalDaLista, { eventos: [{ tipo: "mensagem", idExterno: "g1", remetente: { tipo: "whatsapp", valor: "+5511955554444", nomeExibido: "Caio Dias" }, conteudo: "oi" }] });

    const processador = criarProcessadorDeEntrada({ workerId: "teste-lista-falha", chaves, tarefaDaMensagem: quebraUmaVez, registrar: () => undefined });
    expect(await processador.processarUm()).toBe(true);
    // A Mensagem foi gravada antes da falha; a linha não foi dada como processada.
    expect(await mensagens()).toBe(mensagensAntes + 1);
    expect((await linhas()).at(-1)!.estado).toBe("pendente");
    expect(await tarefasDoContato()).toHaveLength(antes);

    // O backoff põe a linha no futuro: traz de volta para a passada seguinte.
    await pool().query("update plataforma.webhooks_recebidos set disponivel_em = now() where workspace_id = $1 and estado = 'pendente'", [ws]);
    expect(await processador.processarUm()).toBe(true);

    expect((await linhas()).at(-1)).toEqual({ estado: "processado", resultado: "tarefa:criada" });
    expect(await mensagens()).toBe(mensagensAntes + 1);
    expect(await tarefasDoContato()).toHaveLength(antes + 1);
  });
});
