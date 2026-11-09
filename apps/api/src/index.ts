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
 * O processador da fila de entrada da mensageria (Fase 16, 16-03) é do mesmo molde: só sobe aqui por
 * `MENSAGERIA_WORKER_ATIVO === "true"`, e a rota `POST /webhooks/mensageria/:canalId` o acorda depois do 200. A saída
 * (Fase 16, 16-05, `criarWorkerDeSaida`) sobe junto, pela mesma variável: um segundo worker do outbox só com
 * `mensagem.enviar.v1`.
 *
 * A ponte do Agente (Plan 03-11, `automacoes/invocar-agente.ts`) segue a
 * MESMA separação e é a terceira peça do mesmo molde: não conhece
 * `buildApp()`/Fastify, só é ativada aqui por env
 * (`AGENTE_CONTAS_A_PAGAR_ATIVO === "true"`), e é a ÚNICA peça do processo
 * que fala com o `automation/` a respeito de Contas a pagar. O seu padrão é
 * o Ensaio de D3-03: só os literais `conferencia` (Resumos e conferências,
 * nunca `/lancar`) e `lancar` em `AGENTE_CONTAS_A_PAGAR_MODO` mudam o modo
 * (D6-11), e os dois exigem credencial e URL presentes — o erro barato é não
 * lançar, o erro caro é lançar. A ponte fica registrada em
 * `automacoes/ponte-ativa.ts` para a rota de operações cutucá-la depois de
 * uma gravação numa conta (D6-12). O bloco
 * da ponte entra ANTES do bloco do agendador porque este último precisa da
 * sua `rodarAgenda`, se ela existir. Ao contrário do outbox e do agendador,
 * a ponte NÃO tem exclusão pelo banco: duas pontes vivas processariam a
 * mesma conta — o que torna a recarga abaixo uma questão de dinheiro, não
 * de conforto.
 *
 * **A recarga do `vite-node --watch`** (`npm run dev`; plano pós-auditoria,
 * 1.4). A cada edição, o vite-node esvazia o cache de módulos e REEXECUTA
 * este arquivo no MESMO processo — não sobe um processo novo, e não chama
 * `import.meta.hot.dispose` numa recarga completa. Sem cuidado, a instância
 * anterior continuava viva: a ponte, o outbox e o agendador antigos seguiam
 * com os seus `setInterval` (a auditoria achou pontes empilhadas, cada uma
 * chamando o Omie), o servidor antigo segurava a porta, e o pool antigo de
 * Postgres ficava aberto. Por isso cada execução registra em `globalThis` —
 * o único objeto que sobrevive à reexecução — a função que a desmonta
 * (para os workers esperando a volta em voo, fecha o servidor, fecha o SEU
 * pool), e a execução seguinte a chama e ESPERA, antes de subir qualquer
 * coisa. Em produção o processo é único e o módulo roda uma vez só: não há
 * instância anterior, e o registro nunca é lido.
 */

import { buildApp } from "./app";
import { opcoesDoLogger } from "./observabilidade/log";
import { fecharSentry, iniciarSentry } from "./observabilidade/sentry";
import { carregarEnv, encerrar } from "./persistencia/conexao";
import { criarOutboxWorker } from "./persistencia/outbox-worker";
import { criarWorkerDeSaida } from "./mensageria/entregar-mensagem";
import { criarProcessadorDeEntrada } from "./mensageria/processador-de-entrada";
import { criarSchedulerWorker, escopoDoAgendador } from "./automacoes/scheduler-worker";
import {
  criarPonteDoAgente,
  descreverEscopo,
  lerCnpjPorEmpresa,
  lerOpcoesDeDecisao,
  lerOpcoesDeEscopo,
  recusaDasPortasDeTeste,
  resolverModo,
  type PonteDoAgente,
} from "./automacoes/invocar-agente";
import { registrarPonte } from "./automacoes/ponte-ativa";

/** A chave em `globalThis` da função que desmonta a instância em execução — ver o cabeçalho. */
const CHAVE_DA_DESMONTAGEM = "__n1ApiDesmontarInstanciaAnterior";
const registroGlobal = globalThis as unknown as Record<string, (() => Promise<void>) | undefined>;

const desmontarAnterior = registroGlobal[CHAVE_DA_DESMONTAGEM];
if (desmontarAnterior) {
  delete registroGlobal[CHAVE_DA_DESMONTAGEM];
  try {
    await desmontarAnterior();
  } catch (erro) {
    // Segue mesmo assim: se o servidor antigo não fechou, o `listen` abaixo
    // falha com EADDRINUSE e diz o que houve.
    console.warn("[apps/api] a instância anterior não desmontou por inteiro:", erro instanceof Error ? erro.message : erro);
  }
}

carregarEnv();

// Fase 9 (D-13): o monitoramento de erros sobe antes do app, para pegar também
// o que quebrar no boot. Sem `SENTRY_DSN` não faz nada (desenvolvimento).
const sentryAtivo = iniciarSentry();

const porta = Number(process.env.PORT ?? 3002);
const host = process.env.HOST ?? "127.0.0.1";

// Os acordadores da mensageria, por referência: a rota do webhook nasce em `buildApp`, antes de o processador de
// entrada existir (e ele só existe com `MENSAGERIA_WORKER_ATIVO=true`). Sem o processador, a rota só grava na fila
// e o acordador é um no-op. `saida` acorda o worker de saída logo depois do commit de uma Mensagem (o ouvinte do
// tempo real, 16-07, o chama); até lá vale o intervalo de reserva de 5 s.
const acordadores = { entrada: () => {}, saida: () => {} };

const app = buildApp({
  logger: opcoesDoLogger(),
  webhooksDeMensageria: { acordarProcessador: () => acordadores.entrada() },
});

/** O que esta instância precisa parar ao ser desmontada, e os ouvintes de SIGTERM que ela pendurou no processo. */
const paradas: Array<() => Promise<void>> = [];
const ouvintesDeSigterm: Array<() => void> = [];

/** Registra como parar um worker — na desmontagem da recarga e no SIGTERM. */
function aoEncerrar(parar: () => Promise<void>): void {
  paradas.push(parar);
  const noSigterm = () => {
    void parar();
  };
  process.on("SIGTERM", noSigterm);
  ouvintesDeSigterm.push(noSigterm);
}

// Corre junto com os outros no SIGTERM e na desmontagem da recarga: espera até
// 2 s o envio pendente, para um erro capturado logo antes do desligamento ainda
// sair (T-09-65).
if (sentryAtivo) app.log.info(`Sentry ativo (ambiente=${process.env.SENTRY_AMBIENTE?.trim() || "desenvolvimento"})`);
aoEncerrar(fecharSentry);

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
  // D6-01, D6-02, D6-04 — AGENTE_CONTAS_A_PAGAR_RESUMO_A_PARTIR_DE,
  // AGENTE_CONTAS_A_PAGAR_CONFERENCIA_POR_COMENTARIO e
  // AGENTE_CONTAS_A_PAGAR_INTEGRACAO_MANUAL; valor desconhecido vale o padrão, com aviso.
  const { avisos: avisosDasDecisoes, ...decisoes } = lerOpcoesDeDecisao(process.env);
  for (const aviso of avisosDasDecisoes) app.log.warn(aviso);
  // G2/G3 — AGENTE_CONTAS_A_PAGAR_SO_TITULOS_COM e AGENTE_CONTAS_A_PAGAR_AVISAR_ID:
  // portas de ambiente de teste; produção deixa as duas vazias. AVISAR_ID sem
  // SO_TITULOS_COM não sobe (06-13, crm:WR-01), como a falta de URL/token.
  const escopo = lerOpcoesDeEscopo(process.env);
  const recusa = recusaDasPortasDeTeste(escopo);
  if (recusa) throw new Error(recusa);
  const { soTitulosCom, avisarId } = escopo;
  const intervaloMs = process.env.AGENTE_CONTAS_A_PAGAR_INTERVALO_MS ? Number(process.env.AGENTE_CONTAS_A_PAGAR_INTERVALO_MS) : undefined;
  const atorDoAgente = process.env.AUTOMACOES_ATOR_MEMBER_ID;
  const ponteAtiva = criarPonteDoAgente({
    ...(atorDoAgente ? { resolverAtor: async () => atorDoAgente } : {}),
    destinoUrl,
    token,
    workspaceId,
    listId,
    modo,
    decisoes,
    ...(soTitulosCom ? { soTitulosCom } : {}),
    ...(avisarId ? { avisarId } : {}),
    cnpjPorEmpresa,
    ...(intervaloMs !== undefined ? { intervaloMs } : {}),
    registrar: (nivel, mensagem, dados) => {
      app.log[nivel](dados ?? {}, mensagem);
    },
  });
  ponte = ponteAtiva;
  registrarPonte(ponteAtiva, { workspaceId, listId });
  ponteAtiva.iniciar();
  aoEncerrar(async () => {
    registrarPonte(undefined);
    await ponteAtiva.parar();
  });
  app.log.info(
    `ponte do Agente de lançamento ativa (modo=${modo} resumoAPartirDe=${decisoes.resumoAPartirDe} ` +
      `conferenciaPorComentario=${decisoes.conferenciaPorComentario} integracaoManual=${decisoes.integracaoManual} ` +
      `${descreverEscopo(soTitulosCom)} avisar=${avisarId ? "membro-indicado" : "financeiro"})`,
  );
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
  aoEncerrar(() => worker.parar());
  app.log.info("outbox worker ativo");
}

if (process.env.AUTOMACOES_WORKER_ATIVO === "true") {
  const intervaloMs = process.env.AUTOMACOES_INTERVALO_MS ? Number(process.env.AUTOMACOES_INTERVALO_MS) : undefined;
  const janelaDias = process.env.AUTOMACOES_JANELA_DIAS ? Number(process.env.AUTOMACOES_JANELA_DIAS) : undefined;
  const atorMemberId = process.env.AUTOMACOES_ATOR_MEMBER_ID;
  // 10-REVIEW MEDIUM-08 — sem `AUTOMACOES_ESPACO_ID` o processo NÃO sobe: o
  // expurgo da lixeira é irreversível e, sem filtro, alcançaria todos os Espaços.
  const escopo = escopoDoAgendador(process.env);
  const schedulerWorker = criarSchedulerWorker({
    workerId: process.env.AUTOMACOES_WORKER_ID || `apps-api-agenda-${process.pid}`,
    ...escopo,
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
  aoEncerrar(() => schedulerWorker.parar());
  app.log.info({ espaco: escopo.workspaceId, lista: escopo.listId ?? "todas" }, "scheduler de Automações ativo");
}

// Fase 16 (16-03): o processador da fila de entrada da mensageria (`webhooks_recebidos`). Mesma separação do
// outbox e do agendador: não conhece `buildApp()`, só é ativado por env, e duas instâncias podem rodá-lo juntas
// (`for update skip locked`). A rota do webhook o acorda depois do 200; o intervalo de 10 s é só a reserva.
if (process.env.MENSAGERIA_WORKER_ATIVO === "true") {
  const processador = criarProcessadorDeEntrada({
    workerId: process.env.MENSAGERIA_WORKER_ID ?? `apps-api-entrada-${process.pid}`,
    registrar: (nivel, mensagem, dados) => {
      app.log[nivel](dados ?? {}, mensagem);
    },
  });
  processador.iniciar();
  acordadores.entrada = () => processador.acordar();
  aoEncerrar(() => processador.parar());
  app.log.info("processador de entrada da mensageria ativo");

  // 16-05: a saída. O worker do outbox só com `mensagem.enviar.v1`, entregando pelo provedor do Canal (nunca pelo
  // `automation/`), ao lado do processador de entrada e ligado pela MESMA variável.
  const saida = criarWorkerDeSaida({
    workerId: process.env.MENSAGERIA_WORKER_ID ? `${process.env.MENSAGERIA_WORKER_ID}-saida` : `apps-api-saida-${process.pid}`,
    registrar: (nivel, mensagem, dados) => {
      app.log[nivel](dados ?? {}, mensagem);
    },
  });
  saida.iniciar();
  acordadores.saida = () => saida.acordar();
  aoEncerrar(() => saida.parar());
  app.log.info("worker de saída da mensageria ativo");
}

// Registrada ANTES do `listen`: se ele falhar (porta ocupada), a próxima
// recarga ainda consegue parar os workers que esta instância já ligou.
registroGlobal[CHAVE_DA_DESMONTAGEM] = async () => {
  for (const ouvinte of ouvintesDeSigterm) process.off("SIGTERM", ouvinte);
  // Primeiro os workers (nada novo sai para a rede), esperando a volta em
  // voo; depois o servidor (espera as requisições em curso); por último o
  // pool DESTA instância — a próxima abre o seu, num módulo novo.
  await Promise.all(paradas.map((parar) => parar()));
  await app.close();
  await encerrar();
};

await app.listen({ port: porta, host });
app.log.info(`apps/api ouvindo em http://${host}:${porta}`);
