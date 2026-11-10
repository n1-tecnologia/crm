/**
 * A porta de entrada da mensageria, ponta a ponta (16-03, MSG-01), contra o Postgres LOCAL (Docker, porta 55718):
 *
 *   DATABASE_URL=postgres://postgres:x@localhost:55718/postgres \
 *   DATABASE_URL_MIGRACAO=postgres://postgres:x@localhost:55718/postgres npx vitest run src/e2e/mensageria-entrada.test.ts
 *
 * Um Canal simulado com segredo no cofre recebe `POST /webhooks/mensageria/:canalId` do provedor de teste: a rota
 * grava UMA linha `pendente` em `plataforma.webhooks_recebidos` e responde 200; o processador a reivindica e
 * `receberMensagem` cria Contato, Conversa e Mensagem. Sem o cabeçalho do segredo: 401 e nada gravado.
 */

import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { buildApp } from "../app";
import { CABECALHO_DO_SEGREDO, TIPO_DO_SEGREDO_DO_WEBHOOK } from "../mensageria/provedor";
import { criarProcessadorDeEntrada } from "../mensageria/processador-de-entrada";
import { encerrar, pool } from "../persistencia/conexao";
import { guardarCredencial, type ChavesDoCofre } from "../servicos/cofre";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearCanal, semearMembro } from "../testes/banco-crm";

const chaves: ChavesDoCofre = { atual: { versao: 1, chave: randomBytes(32) } };
const SEGREDO = "s1-do-canal-simulado";
const WHATSAPP_DA_ANA = "+5511987654321";

const corpoComUmaMensagem = {
  eventos: [{ tipo: "mensagem", idExterno: "e1", remetente: { tipo: "whatsapp", valor: WHATSAPP_DA_ANA, nomeExibido: "Ana" }, conteudo: "oi" }],
};

describeComBanco("Fase 16 ponta a ponta: o webhook do provedor de teste vira Contato, Conversa e Mensagem pela fila de entrada", () => {
  const ws = novoEspacoDeTeste("msgentrada");
  let canalId: string;

  const app = () => buildApp({ logger: false, workspaceId: ws, webhooksDeMensageria: { chaves } });

  const linhas = async () =>
    (
      await pool().query<{ id: string; estado: string; provedor: string; corpo: unknown; resultado: string | null }>(
        "select id, estado, provedor, corpo, resultado from plataforma.webhooks_recebidos where workspace_id = $1 order by recebido_em",
        [ws],
      )
    ).rows;

  beforeAll(async () => {
    await prepararBancoCrm();
    await semearMembro(ws, { id: "mem_dona", base: "membro", state: "ativo" });
    canalId = await semearCanal(ws, {
      nome: "Comercial",
      tipo: "whatsapp",
      provedor: "whatsapp-nao-oficial",
      identificadorExterno: "+5511977770001",
      conexao: "conectada",
      conexaoSimulada: true,
      configuradoPor: "mem_dona",
    });
    await guardarCredencial(pool(), chaves, { workspaceId: ws, donoTipo: "canal", donoId: canalId, tipo: TIPO_DO_SEGREDO_DO_WEBHOOK, segredo: SEGREDO });
  });

  afterAll(async () => {
    await pool().query("delete from plataforma.credenciais where workspace_id = $1", [ws]);
    await limparEspaco(ws);
    await encerrar();
  });

  it("sem o cabeçalho do segredo: 401 e nenhuma linha gravada", async () => {
    const resposta = await app().inject({ method: "POST", url: `/webhooks/mensageria/${canalId}`, payload: corpoComUmaMensagem });
    expect(resposta.statusCode).toBe(401);
    expect(resposta.json()).toEqual({ ok: false, error: "Não autorizado." });
    expect(await linhas()).toHaveLength(0);
  });

  it("com o segredo do Canal: 200, uma linha pendente do provedor de teste; o processador cria Contato, Conversa e Mensagem", async () => {
    const resposta = await app().inject({
      method: "POST",
      url: `/webhooks/mensageria/${canalId}`,
      headers: { [CABECALHO_DO_SEGREDO]: SEGREDO },
      payload: corpoComUmaMensagem,
    });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ ok: true });

    const gravadas = await linhas();
    expect(gravadas).toHaveLength(1);
    expect(gravadas[0]).toMatchObject({ estado: "pendente", provedor: "teste" });

    const processador = criarProcessadorDeEntrada({ workerId: "teste-entrada", chaves });
    expect(await processador.processarUm()).toBe(true);
    expect(await processador.processarUm()).toBe(false);

    expect((await linhas())[0]).toMatchObject({ estado: "processado" });

    const contato = (
      await pool().query<{ modo_criacao: string }>(
        `select c.modo_criacao
           from plataforma.contatos c
           join plataforma.contato_identificadores i on i.workspace_id = c.workspace_id and i.contato_id = c.id
          where c.workspace_id = $1 and i.tipo = 'whatsapp' and i.valor = $2`,
        [ws, WHATSAPP_DA_ANA],
      )
    ).rows;
    expect(contato).toEqual([{ modo_criacao: "automatico_mensagem" }]);

    const conversas = (
      await pool().query<{ situacao: string }>("select situacao from plataforma.conversas where workspace_id = $1 and canal_id = $2", [ws, canalId])
    ).rows;
    expect(conversas).toEqual([{ situacao: "aberta" }]);

    const mensagens = (
      await pool().query<{ direcao: string; id_externo: string }>("select direcao, id_externo from plataforma.mensagens where workspace_id = $1", [ws])
    ).rows;
    expect(mensagens).toEqual([{ direcao: "recebida", id_externo: "e1" }]);
  });
});
