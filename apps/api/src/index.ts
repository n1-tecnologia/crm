/**
 * Ponto de composição do backend.
 *
 * `buildApp()` (em `app.ts`) monta o Fastify inteiro — CORS, autenticação,
 * rotas, tratamento de erro. Este arquivo só chama `carregarEnv()` e
 * `.listen()`, para separar "montar" de "escutar": é essa separação que
 * permite os testes usarem `app.inject()` sem abrir socket.
 *
 * A regra que vale desde já: nada aqui reimplementa regra de negócio. As
 * regras moram em `@n1/dominio`, que `apps/web` também consome. O backend
 * acrescenta o que o domínio não tem — persistência, autenticação,
 * transporte — e nada além.
 *
 * O worker de outbox segue a mesma separação: `criarOutboxWorker()` não
 * conhece `buildApp()`/Fastify, e só é ativado aqui quando
 * `OUTBOX_WORKER_ATIVO === "true"` (Plan 02-10). Duas instâncias do
 * processo `apps/api` podem rodar o worker ao mesmo tempo sem duplicar
 * entrega — a exclusão é do banco (`for update skip locked`), não deste
 * arquivo.
 *
 * O scheduler de Automações (Plan 03-08, AUTO-01) segue a MESMA separação:
 * `criarSchedulerWorker()` também não conhece `buildApp()`/Fastify, também
 * só é ativado aqui por env (`AUTOMACOES_WORKER_ATIVO === "true"`), e duas
 * instâncias podem rodá-lo ao mesmo tempo sem processar o mesmo dia duas
 * vezes — a exclusão é do banco (`for update skip locked` sobre
 * `plataforma.automacao_agenda`), não deste arquivo.
 *
 * A ponte do Agente (Plan 03-11, `automacoes/invocar-agente.ts`) segue a
 * MESMA separação e é a terceira peça do mesmo molde: não conhece
 * `buildApp()`/Fastify, só é ativada aqui por env
 * (`AGENTE_CONTAS_A_PAGAR_ATIVO === "true"`), e é a ÚNICA peça do processo
 * que fala com o `automation/` a respeito de Contas a pagar. O seu padrão é
 * o Ensaio de D3-03: só o literal `lancar` em `AGENTE_CONTAS_A_PAGAR_MODO`
 * liga a caneta, e mesmo ele exige credencial e URL presentes — durante a
 * primeira semana o erro barato é não lançar, o erro caro é lançar. O bloco
 * da ponte entra ANTES do bloco do agendador porque este último precisa da
 * sua `rodarAgenda`, se ela existir.
 */

import { buildApp } from "./app";
import { carregarEnv } from "./persistencia/conexao";
import { criarOutboxWorker } from "./persistencia/outbox-worker";
import { criarSchedulerWorker } from "./automacoes/scheduler-worker";
import { criarPonteDoAgente, lerCnpjPorEmpresa, resolverModo, type PonteDoAgente } from "./automacoes/invocar-agente";

carregarEnv();

const porta = Number(process.env.PORT ?? 3002);
const host = process.env.HOST ?? "127.0.0.1";

const app = buildApp({ logger: true });

let ponte: PonteDoAgente | undefined;

if (process.env.AGENTE_CONTAS_A_PAGAR_ATIVO === "true") {
  const destinoUrl = process.env.AGENTE_CONTAS_A_PAGAR_URL;
  const token = process.env.PLATAFORMA_LANCAMENTO_TOKEN;
  const workspaceId = process.env.AGENTE_CONTAS_A_PAGAR_ESPACO_ID;
  const listId = process.env.AGENTE_CONTAS_A_PAGAR_LISTA_ID;
  if (!destinoUrl || !token || !workspaceId || !listId) {
    throw new Error(
      "AGENTE_CONTAS_A_PAGAR_ATIVO=true exige AGENTE_CONTAS_A_PAGAR_URL, PLATAFORMA_LANCAMENTO_TOKEN, " +
        "AGENTE_CONTAS_A_PAGAR_ESPACO_ID e AGENTE_CONTAS_A_PAGAR_LISTA_ID no ambiente (ver apps/api/.env.example).",
    );
  }
  const { modo, aviso: avisoDoModo } = resolverModo(process.env.AGENTE_CONTAS_A_PAGAR_MODO);
  if (avisoDoModo) app.log.warn(avisoDoModo);
  const { mapa: cnpjPorEmpresa, aviso: avisoDoCnpj } = lerCnpjPorEmpresa(process.env.AGENTE_CONTAS_A_PAGAR_CNPJ_POR_EMPRESA);
  if (avisoDoCnpj) app.log.warn(avisoDoCnpj);
  const intervaloMs = process.env.AGENTE_CONTAS_A_PAGAR_INTERVALO_MS ? Number(process.env.AGENTE_CONTAS_A_PAGAR_INTERVALO_MS) : undefined;
  ponte = criarPonteDoAgente({
    destinoUrl,
    token,
    workspaceId,
    listId,
    modo,
    cnpjPorEmpresa,
    ...(intervaloMs !== undefined ? { intervaloMs } : {}),
    registrar: (nivel, mensagem, dados) => {
      app.log[nivel](dados ?? {}, mensagem);
    },
  });
  ponte.iniciar();
  app.log.info(`ponte do Agente de lançamento ativa (modo=${modo})`);
  process.on("SIGTERM", () => {
    ponte?.parar();
  });
}

if (process.env.OUTBOX_WORKER_ATIVO === "true") {
  const destinoUrl = process.env.OUTBOX_DESTINO_URL;
  const token = process.env.OUTBOX_TOKEN;
  if (!destinoUrl || !token) {
    throw new Error(
      "OUTBOX_WORKER_ATIVO=true exige OUTBOX_DESTINO_URL e OUTBOX_TOKEN no ambiente (ver apps/api/.env.example).",
    );
  }
  const worker = criarOutboxWorker({
    destinoUrl,
    token,
    workerId: process.env.OUTBOX_WORKER_ID ?? `apps-api-${process.pid}`,
  });
  worker.iniciar();
  app.log.info("outbox worker ativo");
  process.on("SIGTERM", () => {
    worker.parar();
  });
}

if (process.env.AUTOMACOES_WORKER_ATIVO === "true") {
  const intervaloMs = process.env.AUTOMACOES_INTERVALO_MS ? Number(process.env.AUTOMACOES_INTERVALO_MS) : undefined;
  const janelaDias = process.env.AUTOMACOES_JANELA_DIAS ? Number(process.env.AUTOMACOES_JANELA_DIAS) : undefined;
  const atorMemberId = process.env.AUTOMACOES_ATOR_MEMBER_ID;
  const schedulerWorker = criarSchedulerWorker({
    workerId: process.env.AUTOMACOES_WORKER_ID || `apps-api-agenda-${process.pid}`,
    ...(intervaloMs !== undefined ? { intervaloMs } : {}),
    ...(janelaDias !== undefined ? { janelaDias } : {}),
    // Padrão ligado (Task 2, D3-03): a primeira volta REAL de cada
    // (Espaço, Lista) mede e não grava, até liberação explícita.
    ensaioNaPrimeiraVolta: process.env.AUTOMACOES_ENSAIO_PRIMEIRA_VOLTA !== "false",
    // Vazio (padrão): o Membro do Papel "Agente do pipeline" (D-15) —
    // nunca uma sessão humana. Só sobrescrito por operação/teste manual.
    ...(atorMemberId ? { resolverAtor: async () => atorMemberId } : {}),
    // Plan 03-11 — ausente a ponte, o valor é `undefined` e o agendador cai
    // no seu padrão (`runScheduledAutomations`), exatamente como 03-08 desenhou.
    rodarAgenda: ponte?.rodarAgenda,
    registrar: (nivel, mensagem, dados) => {
      app.log[nivel](dados ?? {}, mensagem);
    },
  });
  schedulerWorker.iniciar();
  app.log.info("scheduler de Automações ativo");
  process.on("SIGTERM", () => {
    schedulerWorker.parar();
  });
}

await app.listen({ port: porta, host });
app.log.info(`apps/api ouvindo em http://${host}:${porta}`);
