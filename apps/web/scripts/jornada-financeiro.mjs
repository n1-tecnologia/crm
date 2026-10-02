/**
 * `JORNADA_EMAIL=… JORNADA_SENHA=… npm run jornada:financeiro -w @n1/web`
 *
 * A jornada do Financeiro feita COMO UM HUMANO, no navegador, contra a
 * plataforma rodando (web + api) e o Espaço de verdade: cria contas, preenche
 * os Campos, comenta (com Menção por "@"), muda Status, autoriza, marca como
 * paga/recebida, nega e descarta — clicando e digitando nos mesmos controles
 * que uma pessoa usa. Tudo fica GRAVADO, para ser consultado depois na tela.
 *
 * Quatro contas novas, todas com "TESTE AUTOMATIZADO" no título (nenhuma conta
 * existente é tocada):
 *   Contas a pagar  — aprovada e paga; negada pelo aprovador.
 *   Contas a receber — cobrada e recebida; cobrada e descartada (inadimplente).
 *
 * O que as Automações do Espaço fazem ao longo do caminho (Observadores,
 * Responsável que vira Aprovador, Situação de cobrança, data de pagamento…)
 * acontece de verdade e aparece na Atividade de cada conta.
 *
 * Sem Omie: a conta a pagar segue o caminho manual ("Integração manual" =
 * Manual, lançada no Omie por fora), e a API deve estar SEM a ponte do Agente
 * de lançamento ligada. A Menção dos comentários vai para o próprio usuário da
 * jornada, para não notificar o time com texto de teste.
 *
 * Variáveis: JORNADA_EMAIL, JORNADA_SENHA (obrigatórias — nunca no código),
 * JORNADA_URL (padrão http://localhost:3001), JORNADA_SAIDA (pasta das
 * capturas; padrão a pasta temporária do sistema), JORNADA_VISIVEL=1 (abre o
 * navegador na tela, no ritmo de uma pessoa, com uma faixa no topo dizendo o
 * que o robô está fazendo — a faixa é só da tela, nada dela é gravado).
 *
 * ── Conferência do Resumo (Fase 6) — `cp-conferida`, `cp-ajuste` e
 *    `cp-conferida-pelo-card` ───────────────────────────────────────────────
 *
 * Três cenários que SÓ rodam quando pedidos pelo nome
 * (`JORNADA_SO=cp-conferida` ou `npm run jornada:financeiro -w @n1/web --
 * --so=cp-conferida,cp-ajuste,cp-conferida-pelo-card`): eles precisam da
 * ponte do Agente LIGADA, e os quatro de cima pedem a API sem ela. Sem pedir,
 * nada muda para quem já roda a jornada.
 *
 *   cp-conferida — conta completa SEM Integração manual; espera o
 *     `📋 RESUMO DE PAGAMENTO` no tópico e confere como no ClickUp:
 *     "Responder" no Comentário do Resumo e "ok" no fio (06-14). Espera
 *     `✅ Resumo conferido`, o card "Conferido … · por comentário", move para
 *     "em lançamento omie" e espera o desfecho do modo da ponte (JORNADA_MODO).
 *   cp-ajuste — igual até o Resumo; RESPONDE no fio do Resumo "é prestação
 *     comercial, não ADM"; espera `🔁 Ajuste pedido por`, `Revisado a pedido
 *     de` e a Conferência nova pendente no card. Não lança.
 *   cp-conferida-pelo-card — o cp-conferida pelo CLIQUE: "Conferido, pode
 *     lançar" no card (D6-02: o clique continua oficial).
 *
 * A resposta no fio só decide vinda de um revisor que ALCANÇA a conta: o
 * Financeiro, ou um Administrador/Proprietário (`revisoresDoResumo`); a de
 * qualquer outro Membro é só um Comentário. A ponte só lê RESPOSTAS ao Resumo
 * (nunca um Comentário raiz), e só confere por comentário com
 * `AGENTE_CONTAS_A_PAGAR_CONFERENCIA_POR_COMENTARIO` vazio ou `true` — na linha
 * de partida da ponte: `conferenciaPorComentario=true`. Com `false`, o "ok" no
 * fio não confere, e o cp-conferida para em "Esperar ✅ Resumo conferido".
 *
 * Como subir a API para estes cenários (é o 06-06 quem roda):
 *   AGENTE_CONTAS_A_PAGAR_MODO=conferencia (ou lancar, com autorização do dono)
 *   AGENTE_CONTAS_A_PAGAR_SO_TITULOS_COM="TESTE AUTOMATIZADO" — a ponte não
 *     encosta em nenhuma conta real;
 *   AGENTE_CONTAS_A_PAGAR_AVISAR_ID=<Membro do usuário da jornada> — toda
 *     Menção da ponte vai para ele, e ele é o aprovador da Conferência (é o
 *     que libera os botões do card para ele).
 * Com a ponte ligada, os cenários de cima também podem receber um Resumo
 * entre o preenchimento e a "Integração manual" — inofensivo em
 * `conferencia` (zero /lancar), mas é por isso que o normal é rodá-los à parte.
 *
 *   JORNADA_MODO = conferencia (padrão) | lancar — o modo em que a ponte
 *     está. `conferencia`: depois de "em lançamento omie" espera o aviso
 *     "Neste ambiente o lançamento no Omie está desligado" e confere que a
 *     conta ficou em "em lançamento omie". `lancar`: espera `✅ Lançado no
 *     Omie` e o Status "lançado omie". Qualquer outro valor encerra (código 2).
 *   JORNADA_ESPERA_MS — quanto esperar por cada texto no tópico (padrão
 *     90000); a tela é recarregada a cada 3 s enquanto espera.
 *
 * ── `cp-dispensa-manual` (06-19, para a prova de crm2:CR-01 em 06-20) ─────
 *
 * Também só roda quando pedido pelo nome, e SOZINHO numa execução: exige a
 * API com AGENTE_CONTAS_A_PAGAR_MODO=conferencia e
 * AGENTE_CONTAS_A_PAGAR_INTEGRACAO_MANUAL=sem-conferencia (a dispensa D6-04),
 * mais as portas G2/G3 de sempre (SO_TITULOS_COM e AVISAR_ID acima), e
 * JORNADA_MODO=conferencia (o padrão). Nada vai ao Omie.
 *
 *   1. cria a conta completa, com "Integração manual" = Manual ANTES dos
 *      outros Campos (a ponte nunca vê a conta completa sem Manual);
 *   2. espera o `📋 RESUMO DE PAGAMENTO` e a resposta `✅ Resumo conferido
 *      por` do Agente do pipeline (a dispensa; o card fica escondido enquanto
 *      a conta é Manual);
 *   3. desmarca "Integração manual";
 *   4. espera um SEGUNDO Resumo, resposta no MESMO fio, com "Os dados da
 *      conta mudaram depois da conferência.", e o card "Pendente";
 *   5. move para "em lançamento omie", espera dois ciclos da ponte
 *      (JORNADA_ESPERA_CICLOS_MS, padrão 45000 — a cutucada roda ~2 s depois
 *      do movimento; o segundo ciclo cabe nesse prazo com
 *      AGENTE_CONTAS_A_PAGAR_INTERVALO_MS=30000) e confere que NÃO saiu o
 *      aviso do modo conferência nem um novo `✅ Resumo conferido`, e que o
 *      card segue "Pendente" — sem a correção de crm2:CR-01, a ponte trataria
 *      a conta como conferida e publicaria o aviso "nada foi lançado", isto
 *      é, "lançaria";
 *   6. responde "ok" no fio e espera `✅ Resumo conferido` e o aviso do modo
 *      conferência (o caminho humano funciona).
 *
 * A tela não oferece como LIMPAR um Campo de escolha única (o seletor não tem
 * opção vazia). Para desmarcar "Integração manual", a jornada faz o gesto de
 * escolher "Manual" de novo e troca, só nessa gravação, o valor por `null`
 * antes de ela sair (`pagina.route`): a mesma operação `setTaskFieldValue`,
 * com a sessão do usuário e o mesmo transporte — só o valor que a tela não
 * sabe pedir.
 *
 * ── `cp-dispensa-com-resposta` (a prova do 06-21: o Crítico do 06-REVIEW-3) ─
 *
 * Só quando pedido pelo nome, SOZINHO numa execução, e com a ponte num
 * PROCESSO À PARTE que anda só pelo relógio: a API da tela (a de JORNADA_URL)
 * SEM a ponte, e outra API (outra PORT) com AGENTE_CONTAS_A_PAGAR_MODO=
 * conferencia, AGENTE_CONTAS_A_PAGAR_INTEGRACAO_MANUAL=sem-conferencia, as
 * portas G2/G3 de sempre e AGENTE_CONTAS_A_PAGAR_INTERVALO_MS (ex.: 90000).
 * A cutucada é do processo que gravou, então as gravações da tela não cutucam
 * essa ponte — e o cenário CONFERE pelo relógio dela que nenhum ciclo leu a
 * resposta sem o "Manual": JORNADA_PONTE_INICIO_MS (o `time` da linha de
 * partida da ponte, registrada logo depois do `iniciar()`, que roda o primeiro
 * ciclo e arma o relógio) e JORNADA_PONTE_INTERVALO_MS.
 *
 *   1. cria a conta completa SEM Integração manual; espera o Resumo e o card
 *      "Pendente";
 *   2. logo depois de um tique da ponte, RESPONDE no fio pedindo ajuste
 *      ("troca a categoria para 2.04.03" — com o código na resposta, o Resumo
 *      revisado sai com ele, sem depender da IA) e marca "Integração manual" =
 *      Manual; confere que as duas gravações caíram entre os MESMOS dois
 *      tiques (senão a prova é inconclusiva e o cenário falha);
 *   3. espera `🔁 Ajuste pedido por` e falha na hora se um `✅ Resumo
 *      conferido` chegar antes dele — era o Crítico: a dispensa engolia a
 *      resposta pendente;
 *   4. espera o Resumo revisado e, depois dele, a dispensa (`✅ Resumo
 *      conferido` — a conta agora é Manual); confere a ordem no tópico
 *      (resposta → ajuste → revisado → conferido) e o card escondido.
 *
 * ── `cp-lancada-no-omie` (o passo 2B: GRAVA de verdade no Omie) ───────────
 *
 * Só com a autorização do dono, pedido pelo nome e sozinho: a API com
 * AGENTE_CONTAS_A_PAGAR_MODO=lancar e AGENTE_CONTAS_A_PAGAR_SO_TITULOS_COM
 * igual à marca do título ("TESTE AUTOMATIZADO — CP lançada no Omie (2B)") —
 * com "TESTE AUTOMATIZADO" sozinho, a ponte lançaria TAMBÉM as contas de teste
 * antigas paradas em "em lançamento omie". JORNADA_MODO=lancar e
 * JORNADA_ANEXO=<um PDF pequeno>. Valor R$ 1,00. A jornada não exclui o
 * título: conferir e excluir no Omie é o passo seguinte, fora dela.
 *
 *   anexa o PDF pela seção "Anexar arquivo" (hoje um protótipo: grava nome,
 *   tipo e tamanho, o arquivo não sobe ao Storage), preenche, espera o Resumo,
 *   responde "ok", move para "em lançamento omie" e espera `✅ Lançado no
 *   Omie` e o Status "lançado omie"; a nota do passo traz a linha inteira.
 *
 *   `cp-lancada-no-omie-de-novo` — a mesma conta depois de uma recusa (ela
 *   voltou a "para pagar"), só por JORNADA_RETOMAR=…=<conta>@0: troca o
 *   fornecedor por um que JÁ existe no Omie (JORNADA_FORNECEDOR_CNPJ e
 *   JORNADA_FORNECEDOR_NOME), espera o Resumo novo ("Os dados da conta
 *   mudaram…" — o fornecedor está na impressão de lançamento), responde "ok",
 *   move e espera o `✅ Lançado no Omie`.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const URL_BASE = process.env.JORNADA_URL ?? "http://localhost:3001";
const EMAIL = process.env.JORNADA_EMAIL;
const SENHA = process.env.JORNADA_SENHA;
const SAIDA = process.env.JORNADA_SAIDA ?? path.join(tmpdir(), "jornada-financeiro");
if (!EMAIL || !SENHA) {
  console.error("Defina JORNADA_EMAIL e JORNADA_SENHA (o usuário que faz a jornada).");
  process.exit(2);
}
// Só os literais exatos, como a ponte (D6-11): um modo digitado errado não vira o outro.
const MODO = process.env.JORNADA_MODO ?? "conferencia";
if (MODO !== "conferencia" && MODO !== "lancar") {
  console.error(`JORNADA_MODO deve ser "conferencia" ou "lancar" (veio "${MODO}").`);
  process.exit(2);
}
const ESPERA_MS = Number(process.env.JORNADA_ESPERA_MS ?? 90_000);
if (!Number.isFinite(ESPERA_MS) || ESPERA_MS <= 0) {
  console.error("JORNADA_ESPERA_MS deve ser um número de milissegundos maior que zero.");
  process.exit(2);
}
mkdirSync(SAIDA, { recursive: true });

/** Data civil de São Paulo, `aaaa-mm-dd`, somando `dias`. */
function diaCivil(dias) {
  const alvo = new Date(Date.now() + dias * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(alvo);
}
const CARIMBO = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
}).format(new Date()).replace(",", "");

const registro = [];
function passo(conta, texto, ok = true) {
  registro.push({ conta, texto, ok });
  console.log(`  ${ok ? "✔" : "✖"} ${texto}`);
}

const VISIVEL = process.env.JORNADA_VISIVEL === "1";
const navegador = await chromium.launch({ headless: !VISIVEL, slowMo: VISIVEL ? 120 : 0 });
const pagina = await navegador.newPage({ viewport: { width: 1600, height: 1000 } });
pagina.setDefaultTimeout(30_000);

/**
 * Espera a gravação que o gesto provoca (`POST /operacoes/<nome>`) e confere
 * que o servidor aceitou. Devolve a `Response` — quem precisa do corpo (ex.:
 * o Comentário aceito, em `value`) o lê; os outros ignoram.
 */
async function gravando(nome, gesto) {
  const [resposta] = await Promise.all([
    pagina.waitForResponse((r) => r.request().method() === "POST" && r.url().includes(`/operacoes/${nome}`), { timeout: 45_000 }),
    gesto(),
  ]);
  if (resposta.status() !== 200) {
    throw new Error(`${nome}: o servidor respondeu ${resposta.status()} — ${(await resposta.text()).slice(0, 300)}`);
  }
  return resposta;
}

async function entrar() {
  await pagina.goto(`${URL_BASE}/entrar`);
  await pagina.fill('input[name="email"]', EMAIL);
  await pagina.fill('input[name="senha"]', SENHA);
  await Promise.all([pagina.waitForNavigation({ timeout: 60_000 }).catch(() => {}), pagina.press('input[name="senha"]', "Enter")]);
}

const painel = () => pagina.getByRole("dialog", { name: "Conta" });
// Só o RÓTULO da linha (o <span class="app-meta …">): o texto de um valor escolhido
// (ex.: "CNPJ" no Campo Fornecedor) não pode ser confundido com o Campo "CNPJ".
const linhaDoCampo = (nome) =>
  painel()
    .locator(`xpath=.//span[contains(concat(" ", normalize-space(@class), " "), " app-meta ") and normalize-space(.)="${nome}"]/..`)
    .first();

async function fecharEditor(linha) {
  const pronto = linha.getByRole("button", { name: "Pronto" });
  if (await pronto.isVisible().catch(() => false)) await pronto.click();
}

async function escolher(nomeDoCampo, opcao) {
  const linha = linhaDoCampo(nomeDoCampo);
  await linha.getByRole("button").first().click();
  await linha.getByRole("combobox").click();
  await gravando("setTaskFieldValue", () => pagina.getByRole("option", { name: opcao, exact: true }).click());
  await fecharEditor(linha);
}

async function digitar(nomeDoCampo, valor) {
  const linha = linhaDoCampo(nomeDoCampo);
  await linha.getByRole("button").first().click();
  const campo = linha.locator("input, textarea").first();
  await campo.fill(String(valor));
  await gravando("setTaskFieldValue", () => campo.press("Enter"));
  await fecharEditor(linha);
}

async function vencimento(data) {
  const linha = linhaDoCampo("Datas");
  await linha.getByRole("button").first().click();
  const caixas = linha.getByRole("textbox");
  await gravando("", () => caixas.nth(1).fill(data));
  await fecharEditor(linha);
}

/** No modo visível, a faixa no topo da página diz o passo — `aria-hidden` e sem clique: não atrapalha o robô. */
async function legenda(texto) {
  if (!VISIVEL) return;
  await pagina
    .evaluate((t) => {
      let faixa = document.getElementById("legenda-da-jornada");
      if (!faixa) {
        faixa = document.createElement("div");
        faixa.id = "legenda-da-jornada";
        faixa.setAttribute("aria-hidden", "true");
        Object.assign(faixa.style, {
          position: "fixed", top: "8px", left: "50%", transform: "translateX(-50%)", zIndex: "2147483647",
          background: "#111827", color: "#fff", padding: "8px 14px", borderRadius: "8px",
          font: "600 14px system-ui, sans-serif", boxShadow: "0 4px 16px rgba(0,0,0,.3)", pointerEvents: "none", maxWidth: "80vw",
        });
        document.body.appendChild(faixa);
      }
      faixa.textContent = `🤖 ${t}`;
    }, texto)
    .catch(() => {});
}

async function comentar(texto, { mencionar = true } = {}) {
  const caixa = painel().getByRole("textbox", { name: "Novo comentário" });
  await caixa.click();
  // Letra por letra, como quem digita (mais devagar no modo visível, para dar para ler).
  await caixa.pressSequentially(texto, { delay: VISIVEL ? 35 : 5 });
  if (mencionar) {
    // A Menção como uma pessoa faz: "@", o começo do nome, e a escolha na lista.
    await caixa.pressSequentially(" @" + EMAIL.slice(0, 5), { delay: VISIVEL ? 120 : 30 });
    await pagina.getByRole("listbox", { name: "Pessoas para mencionar" }).getByRole("option").first().click();
  }
  await gravando("addTaskComment", () => caixa.press("Control+Enter"));
}

async function mudarStatus(nome) {
  await painel().getByRole("combobox", { name: "Mudar o Status" }).click();
  // A opção leva a categoria no nome ("descartado concluído", "lançado omie em andamento").
  const opcao = pagina.getByRole("option", { name: new RegExp(`^${nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s`) });
  // No popup da conta, mudar o Status pede confirmação ("Mover para …?" → "Mover"),
  // como para uma pessoa. A gravação só sai depois do "Mover".
  await gravando("changeTaskStatus", async () => {
    await opcao.click();
    const confirmacao = pagina.getByRole("alertdialog");
    await confirmacao.waitFor({ state: "visible", timeout: 5_000 });
    await confirmacao.getByRole("button", { name: "Mover", exact: true }).click();
  });
  await pagina.waitForTimeout(300);
  const statusAgora = await painel().getByRole("combobox", { name: "Mudar o Status" }).innerText();
  if (!statusAgora.includes(nome)) throw new Error(`o Status ficou "${statusAgora.trim()}", esperado "${nome}"`);
}

/** O botão principal do rodapé ("Autorizar pagamento", "Marcar como paga", "Iniciar cobrança", "Marcar como recebida") e a confirmação. */
async function acaoDoRodape(rotulo) {
  // Dentro do popup: a Lista por trás tem os mesmos botões em cada linha.
  await painel().getByRole("button", { name: rotulo, exact: true }).click();
  const confirmacao = pagina.getByRole("alertdialog");
  await gravando("changeTaskStatus", () => confirmacao.getByRole("button", { name: rotulo, exact: true }).click());
}

/**
 * Como `acaoDoRodape`, mas uma REGRA do Status ("Quem pode mover para cá", nas
 * configurações da Lista) pode bloquear o gesto. Bloqueado, devolve o motivo
 * que a tela mostra no botão, em vez de clicar.
 */
async function tentarAcaoDoRodape(rotulo) {
  const botao = painel().getByRole("button", { name: rotulo, exact: true });
  if (await botao.isDisabled()) return (await botao.getAttribute("title")) ?? "botão desabilitado";
  await acaoDoRodape(rotulo);
  return undefined;
}

async function novaConta(listaId, rotuloDoBotao, titulo) {
  await pagina.goto(`${URL_BASE}/estrutura/listas/${listaId}`, { timeout: 90_000 });
  await pagina.getByRole("button", { name: rotuloDoBotao, exact: true }).click();
  const nome = pagina.locator("#nova-tarefa");
  await nome.fill(titulo);
  await gravando("createTask", () => nome.press("Enter"));
  await painel().waitFor({ state: "visible" });
  const id = new URL(pagina.url()).searchParams.get("tarefa");
  if (!id) throw new Error("a conta foi criada mas o popup não abriu com o id na URL");
  return id;
}

async function capturar(nome) {
  const arquivo = path.join(SAIDA, `${nome}.png`);
  await pagina.screenshot({ path: arquivo });
  return arquivo;
}

/** Recarrega a página (o popup reabre pela `?tarefa=` da URL) — a tela só vê o que a ponte gravou depois de hidratar de novo. */
async function recarregar() {
  await pagina.reload({ timeout: 90_000 });
  await painel().waitFor({ state: "visible", timeout: 60_000 });
}

/**
 * Espera um Comentário do tópico cujo texto case com `padrao` — é assim que a
 * jornada vê a ponte trabalhar (`📋 RESUMO DE PAGAMENTO`, `✅ Resumo conferido`,
 * `Revisado a pedido de`, `✅ Lançado no Omie`, o aviso do modo conferência).
 * Recarrega a cada 3 s até `timeoutMs`. `aPartirDe` ignora os que já casavam
 * antes (ex.: o Resumo revisado vem depois do primeiro).
 */
async function esperarNoFio(padrao, timeoutMs = ESPERA_MS, { aPartirDe = 0 } = {}) {
  const inicio = Date.now();
  for (;;) {
    const achados = await painel().locator('li[id^="comentario-"]').filter({ hasText: padrao }).count();
    if (achados > aPartirDe) return `apareceu em ${Math.round((Date.now() - inicio) / 1000)} s`;
    if (Date.now() - inicio > timeoutMs) {
      throw new Error(`"${padrao.source}" não apareceu no tópico em ${Math.round(timeoutMs / 1000)} s — a ponte está ligada, no modo e no escopo certos?`);
    }
    await pagina.waitForTimeout(3_000);
    await recarregar();
  }
}

/**
 * Checklist E2 — como `esperarNoFio`, mas SEM recarregar: a tela tem de ver
 * sozinha o que a ponte grava (a consulta à revisão do Espaço, a cada 5 s).
 */
async function esperarSemRecarregar(padrao, timeoutMs = ESPERA_MS, { aPartirDe = 0 } = {}) {
  const inicio = Date.now();
  for (;;) {
    const achados = await painel().locator('li[id^="comentario-"]').filter({ hasText: padrao }).count();
    if (achados > aPartirDe) return `apareceu sem recarregar em ${Math.round((Date.now() - inicio) / 1000)} s`;
    if (Date.now() - inicio > timeoutMs) {
      throw new Error(`"${padrao.source}" não apareceu no tópico em ${Math.round(timeoutMs / 1000)} s sem recarregar — a tela está consultando a revisão (E2)?`);
    }
    await pagina.waitForTimeout(1_000);
  }
}

/** O texto da linha do Campo `nome` no popup casa com `padrao`. */
async function campoMostra(nome, padrao) {
  const texto = (await linhaDoCampo(nome).innerText()).replace(/\s+/g, " ").trim();
  if (!padrao.test(texto)) throw new Error(`"${nome}" mostra "${texto}", esperado ${padrao}`);
  return texto;
}

/** Quantos Comentários do tópico casam com `padrao` agora. */
const contarNoFio = (padrao) => painel().locator('li[id^="comentario-"]').filter({ hasText: padrao }).count();

/** O card "Conferência do Resumo" no estado esperado (o título leva o estado: "· Pendente", "· Conferido"…). */
async function cardDaConferencia(estado) {
  const titulo = `Conferência do Resumo · ${estado}`;
  await painel().getByText(titulo, { exact: true }).waitFor({ state: "visible", timeout: 15_000 });
}

/** "Conferido, pode lançar" no card, e a confirmação — `decideProcessApproval` por clique. */
async function conferirPeloCard() {
  const botao = painel().getByRole("button", { name: "Conferido, pode lançar", exact: true });
  if (await botao.isDisabled()) throw new Error(`o botão está indisponível: ${(await botao.getAttribute("title")) ?? "sem motivo"}`);
  await botao.click();
  const confirmacao = pagina.getByRole("alertdialog");
  await gravando("decideProcessApproval", () =>
    confirmacao.getByRole("button", { name: "Conferido, pode lançar", exact: true }).click(),
  );
}

/**
 * O gesto do ClickUp (06-14): "Responder" no Comentário do tópico que casa
 * com `padrao` (o ÚLTIMO — o Resumo vigente, se houver revisado), `texto`
 * digitado letra a letra na caixa "Resposta no fio", e Ctrl+Enter. Confere,
 * no Comentário que o servidor aceitou, que a resposta foi para a RAIZ do fio
 * (o PRIMEIRO `li` que casa com `padrao`) — é só ali que a ponte lê.
 */
async function responderNoFio(padrao, texto) {
  const linhas = painel().locator('li[id^="comentario-"]').filter({ hasText: padrao });
  if ((await linhas.count()) === 0) throw new Error(`nenhum Comentário do tópico casa com "${padrao.source}"`);
  const raizId = ((await linhas.first().getAttribute("id")) ?? "").replace(/^comentario-/, "");
  const linha = linhas.last();
  await linha.getByRole("button", { name: "Responder", exact: true }).click();
  const caixa = linha.getByRole("textbox", { name: "Resposta no fio" });
  await caixa.pressSequentially(texto, { delay: VISIVEL ? 35 : 5 });
  const resposta = await gravando("addTaskComment", () => caixa.press("Control+Enter"));
  const corpo = await resposta.json();
  const paiId = corpo?.value?.parentCommentId;
  if (paiId !== raizId) throw new Error(`a resposta foi para "${paiId ?? "nenhum fio"}", e não para a raiz do fio do Resumo (${raizId})`);
  return `respondido no fio (${raizId})`;
}

/** O Status do popup contém `nome`. */
async function statusDeveSer(nome) {
  const agora = await painel().getByRole("combobox", { name: "Mudar o Status" }).innerText();
  if (!agora.includes(nome)) throw new Error(`o Status está "${agora.trim()}", esperado "${nome}"`);
}

/**
 * Desmarca um Campo de escolha única. A tela não tem opção vazia no seletor
 * (ver o cabeçalho): o gesto é escolher `opcaoAtual` de novo, e a gravação
 * sai com o valor `null` no lugar dela — a mesma operação e a mesma sessão.
 * Confere depois de recarregar que a linha do Campo não mostra mais a opção.
 */
async function desmarcarEscolha(nomeDoCampo, opcaoAtual) {
  const padrao = "**/operacoes/setTaskFieldValue";
  let trocada = false;
  await pagina.route(
    padrao,
    async (rota) => {
      const corpo = rota.request().postDataJSON();
      const args = Array.isArray(corpo?.args) ? [...corpo.args] : [];
      if (args.length !== 3 || args[2] !== opcaoAtual) return rota.continue();
      args[2] = null;
      trocada = true;
      return rota.continue({ postData: JSON.stringify({ ...corpo, args }) });
    },
    { times: 1 },
  );
  try {
    await escolher(nomeDoCampo, opcaoAtual);
  } finally {
    await pagina.unroute(padrao);
  }
  if (!trocada) throw new Error(`a gravação de "${nomeDoCampo}" não saiu com o valor "${opcaoAtual}" para ser desmarcada`);
  await recarregar();
  const agora = await linhaDoCampo(nomeDoCampo).innerText();
  if (agora.includes(opcaoAtual)) throw new Error(`"${nomeDoCampo}" continua "${opcaoAtual}" depois de recarregar`);
  return `"${nomeDoCampo}" sem valor`;
}

const RESUMO = /📋 RESUMO DE PAGAMENTO/;
const CONFERIDO = /✅ Resumo conferido/;
const REVISADO = /Revisado a pedido de/;
const AJUSTE = /🔁 Ajuste pedido por/;

/**
 * Quantos Resumos revisados o tópico tinha ANTES da resposta de ajuste. Contar
 * depois de esperar o `🔁 Ajuste pedido por` erraria: a ponte decide e
 * republica na mesma passada, e o revisado novo já entraria na conta.
 */
let revisadosAntesDoAjuste = 0;
const LANCADO = /✅ Lançado no Omie/;
const MODO_CONFERENCIA = /Neste ambiente o lançamento no Omie está desligado/;
const DADOS_MUDARAM = /Os dados da conta mudaram depois da conferência\./;

/** `cp-dispensa-manual` — quanto esperar pelos dois ciclos da ponte depois do movimento (passo 5). */
const ESPERA_CICLOS_MS = Number(process.env.JORNADA_ESPERA_CICLOS_MS ?? 45_000);
if (!Number.isFinite(ESPERA_CICLOS_MS) || ESPERA_CICLOS_MS <= 0) {
  console.error("JORNADA_ESPERA_CICLOS_MS deve ser um número de milissegundos maior que zero.");
  process.exit(2);
}

/** O que o `cp-dispensa-manual` leva de um passo ao outro: o fio do Resumo e quantos "conferido" havia. */
const dispensa = { raizId: "", resumoNovoId: "", conferidosAntes: 0 };

/** O `id` do Comentário (sem o prefixo `comentario-`) do `li` do tópico. */
const idDoComentario = async (li) => ((await li.getAttribute("id")) ?? "").replace(/^comentario-/, "");

/** O card da Conferência não aparece (a conta é Manual: o Agente dispensou, ninguém confere). */
async function semCardDaConferencia() {
  const cards = await painel().getByText(/^Conferência do Resumo · /).count();
  if (cards > 0) throw new Error("o card da Conferência aparece numa conta Manual");
}

/** `cp-dispensa-com-resposta` — o relógio da ponte que roda à parte (o primeiro ciclo é o tique 0). */
const PONTE_INICIO_MS = Number(process.env.JORNADA_PONTE_INICIO_MS);
const PONTE_INTERVALO_MS = Number(process.env.JORNADA_PONTE_INTERVALO_MS);
/** Depois do tique, o ciclo já leu o Espaço: a leitura é a primeira coisa que ele faz. */
const LEITURA_DO_CICLO_MS = 5_000;
/** O que a resposta e o "Manual" levam juntos, com folga — com menos que isso até o próximo tique, espera o tique. */
const TEMPO_DAS_DUAS_GRAVACOES_MS = 50_000;
const PEDIDO_DE_AJUSTE = "troca a categoria para 2.04.03";
/** `cp-ajuste-pelo-fio` — o pedido em português solto, como o Financeiro escreve: a IA tem de ler. */
const PEDIDO_DO_FLUXO_6 = "o valor certo é 1.234,56 e o vencimento é 20/10/2026";
const comResposta = { conferidosAntes: 0, revisadosAntes: 0, antesDaResposta: 0, depoisDoManual: 0 };

const tiqueDaPonte = (t) => Math.floor((t - PONTE_INICIO_MS) / PONTE_INTERVALO_MS);
const instanteDoTique = (k) => PONTE_INICIO_MS + k * PONTE_INTERVALO_MS;
const hora = (t) => new Date(t).toISOString().slice(11, 19);

/** Espera, se preciso, até as duas gravações caberem inteiras entre a leitura de um tique e o tique seguinte. */
async function alinharComOTique() {
  let esperou = 0;
  for (;;) {
    const agora = Date.now();
    const k = tiqueDaPonte(agora);
    const desdeOTique = agora - instanteDoTique(k);
    const ateOProximo = instanteDoTique(k + 1) - agora;
    let espera = 0;
    if (desdeOTique < LEITURA_DO_CICLO_MS) espera = LEITURA_DO_CICLO_MS - desdeOTique + 250;
    else if (ateOProximo < TEMPO_DAS_DUAS_GRAVACOES_MS) espera = ateOProximo + LEITURA_DO_CICLO_MS + 250;
    if (espera === 0) return `${esperou > 0 ? `esperou ${Math.round(esperou / 1000)} s; ` : ""}tique ${k}, ${Math.round(ateOProximo / 1000)} s até o próximo`;
    esperou += espera;
    await pagina.waitForTimeout(espera);
  }
}

/** `cp-lancada-no-omie` — o PDF que a jornada anexa pela seção "Anexar arquivo" do popup. */
const ANEXO = process.env.JORNADA_ANEXO;
const lancamento = { texto: "" };

/** `cp-lancada-no-omie-de-novo` — o fornecedor que JÁ existe no Omie, e o que o tópico tinha antes da troca. */
const FORNECEDOR_CNPJ = process.env.JORNADA_FORNECEDOR_CNPJ;
const FORNECEDOR_NOME = process.env.JORNADA_FORNECEDOR_NOME;
const deNovo = { resumosAntes: 0, conferidosAntes: 0, lancadosAntes: 0 };

/** Os Comentários do tópico, na ordem da tela (cronológica: a resposta é um `li` próprio, com link para o pai). */
const comentariosDoTopico = () =>
  painel()
    .locator('li[id^="comentario-"]')
    .evaluateAll((lis) => lis.map((li) => ({ id: li.id.replace(/^comentario-/, ""), texto: li.innerText })));




/**
 * `fornecedor`: um que já existe no Omie, para o lançamento de verdade não
 * cadastrar ali o CNPJ de teste — que é de uma empresa real (2B de 2026-10-01).
 */
const passosDaContaAPagar = (valor = "123.45", fornecedor = { cnpj: "11.222.333/0001-81", nome: "Fornecedor Teste Automatizado LTDA" }) => [
  ["Centro de Custo = TRIA", () => escolher("Centro de Custo", "TRIA")],
  ["Empresa = Tria Company", () => escolher("Empresa", "Tria Company")],
  ["Categoria = Contas de consumo", () => escolher("Categoria de pagamento", "Contas de consumo")],
  ["Fornecedor = CNPJ", () => escolher("Fornecedor", "CNPJ")],
  [`CNPJ = ${fornecedor.cnpj}`, () => digitar("CNPJ", fornecedor.cnpj)],
  [`Nome do fornecedor = ${fornecedor.nome}`, () => digitar("Nome do fornecedor", fornecedor.nome)],
  ["Forma de pagamento = Chave Pix", () => escolher("Forma de pagamento", "Chave Pix")],
  ["Chave pix", () => digitar("Chave pix", "teste-integracao@triacompany.com.br")],
  [`Valor = R$ ${valor.replace(".", ",")}`, () => digitar("Valor", valor)],
  ["Vencimento em 10 dias", () => vencimento(diaCivil(10))],
];

const passosDaContaAReceber = (valor) => [
  ["Centro de Custo = TRIA", () => escolher("Centro de Custo", "TRIA")],
  ["Empresa = Tria Company", () => escolher("Empresa", "Tria Company")],
  ["Tipo de recebimento = Avulso", () => escolher("Tipo de recebimento", "Avulso")],
  ["Conta de recebimento = TRIA", () => escolher("Conta de recebimento", "TRIA")],
  [`Valor = R$ ${valor}`, () => digitar("Valor", valor)],
  ["Vencimento em 5 dias", () => vencimento(diaCivil(5))],
];

const CENARIOS = [
  {
    chave: "cp-aprovada",
    titulo: "Contas a pagar — aprovada e paga",
    lista: "lst_contas_a_pagar",
    botao: "+ Nova conta",
    nome: `TESTE AUTOMATIZADO — CP aprovada e paga · ${CARIMBO}`,
    passos: [
      ...passosDaContaAPagar(),
      ["Comentário com Menção", () => comentar("Conta de teste automatizado. Conferi a nota e os dados de pagamento.")],
      ["Captura do comentário com Menção", () => capturar("cp-aprovada-comentario-com-mencao")],
      ["Integração manual = Manual", () => escolher("Integração manual", "Manual")],
      ["Status → lançado omie", () => mudarStatus("lançado omie")],
      ["Comentário: lançado à mão", () => comentar("Lancei manualmente no Omie. Segue para remessa.", { mencionar: false })],
      ["Status → em remessa bancária", () => mudarStatus("em remessa bancária")],
      ["Status → em autorização bancária (A3: Responsável vira o Aprovador)", () => mudarStatus("em autorização bancária")],
      ["Comentário: enviado ao aprovador", () => comentar("Enviado para autorização do aprovador.", { mencionar: false })],
      ["Autorizar pagamento → aprovado", () => acaoDoRodape("Autorizar pagamento")],
      ["Comentário: autorizado", () => comentar("Pagamento autorizado. Pode pagar.", { mencionar: false })],
      // Desde 2026-09-29 o dono abriu o "pago" para qualquer pessoa (antes só o
      // Aprovador — RN-CP-04 do seed): bloqueado agora é falha, com o motivo da tela.
      [
        "Marcar como paga → pago (A2: sai do Financeiro)",
        async () => {
          const bloqueio = await tentarAcaoDoRodape("Marcar como paga");
          if (bloqueio) throw new Error(`"Marcar como paga" bloqueado: ${bloqueio}`);
        },
      ],
      ["Comentário: pago", () => comentar("Pago. Comprovante arquivado.", { mencionar: false })],
      ["Captura", () => capturar("cp-aprovada-e-paga")],
    ],
  },
  {
    chave: "cp-negada",
    titulo: "Contas a pagar — negada pelo aprovador",
    lista: "lst_contas_a_pagar",
    botao: "+ Nova conta",
    nome: `TESTE AUTOMATIZADO — CP negada · ${CARIMBO}`,
    passos: [
      ...passosDaContaAPagar(),
      ["Comentário com Menção", () => comentar("Conta de teste automatizado para o caminho da recusa.")],
      ["Integração manual = Manual", () => escolher("Integração manual", "Manual")],
      ["Status → lançado omie", () => mudarStatus("lançado omie")],
      ["Status → em autorização bancária (A3)", () => mudarStatus("em autorização bancária")],
      ["Comentário do aprovador", () => comentar("Aprovador: valor diverge do contrato, não autorizo.", { mencionar: false })],
      ["Status → negado (A4: volta ao Financeiro, com comentário)", () => mudarStatus("negado")],
      ["Captura", () => capturar("cp-negada")],
    ],
  },
  {
    chave: "cp-conferida",
    soQuandoPedido: true,
    titulo: `Contas a pagar — Resumo conferido com "ok" no fio (ponte em ${MODO})`,
    lista: "lst_contas_a_pagar",
    botao: "+ Nova conta",
    nome: `TESTE AUTOMATIZADO — CP conferida · ${CARIMBO}`,
    passos: [
      // Como cp-aprovada, sem "Integração manual": é o Agente quem publica o Resumo (D6-04).
      ...passosDaContaAPagar(),
      ["Esperar o 📋 RESUMO DE PAGAMENTO no tópico", () => esperarNoFio(RESUMO)],
      ["Card: Conferência do Resumo · Pendente", () => cardDaConferencia("Pendente")],
      ["Captura do Resumo", () => capturar("cp-conferida-resumo")],
      // O gesto do ClickUp (D6-02, 06-14): "ok" como RESPOSTA ao Resumo — a ponte lê e confere por comentário.
      ['Responder "ok" no fio do Resumo', () => responderNoFio(RESUMO, "ok")],
      ["Esperar ✅ Resumo conferido no tópico", () => esperarNoFio(CONFERIDO)],
      ["Card: Conferência do Resumo · Conferido", () => cardDaConferencia("Conferido")],
      // A linha do card, e não só "por comentário": a Atividade da decisão no tópico também diz "por comentário — ok",
      // e dois achados seriam violação do modo estrito do Playwright.
      [
        "Card: conferido por comentário",
        () => painel().getByText(/^Conferido por .+ · por comentário$/).waitFor({ state: "visible", timeout: 15_000 }),
      ],
      ["Captura do \"ok\" no fio", () => capturar("cp-conferida-ok-no-fio")],
      ["Status → em lançamento omie", () => mudarStatus("em lançamento omie")],
      ...(MODO === "lancar"
        ? [
            ["Esperar ✅ Lançado no Omie no tópico", () => esperarNoFio(LANCADO)],
            ["Status agora é lançado omie", () => statusDeveSer("lançado omie")],
          ]
        : [
            ["Esperar o aviso do modo conferência no tópico", () => esperarNoFio(MODO_CONFERENCIA)],
            ["Status continua em lançamento omie", () => statusDeveSer("em lançamento omie")],
          ]),
      ["Captura", () => capturar(`cp-conferida-${MODO}`)],
    ],
  },
  {
    chave: "cp-conferida-pelo-card",
    soQuandoPedido: true,
    titulo: `Contas a pagar — Resumo conferido pelo card (ponte em ${MODO})`,
    lista: "lst_contas_a_pagar",
    botao: "+ Nova conta",
    nome: `TESTE AUTOMATIZADO — CP conferida pelo card · ${CARIMBO}`,
    passos: [
      ...passosDaContaAPagar(),
      ["Esperar o 📋 RESUMO DE PAGAMENTO no tópico", () => esperarNoFio(RESUMO)],
      ["Card: Conferência do Resumo · Pendente", () => cardDaConferencia("Pendente")],
      ["Captura do Resumo", () => capturar("cp-conferida-pelo-card-resumo")],
      // O clique continua oficial (D6-02): o mesmo fato, com a fonte "por clique".
      ["Conferido, pode lançar (card)", () => conferirPeloCard()],
      ["Esperar ✅ Resumo conferido no tópico", () => esperarNoFio(CONFERIDO)],
      ["Card: Conferência do Resumo · Conferido", () => cardDaConferencia("Conferido")],
      ["Status → em lançamento omie", () => mudarStatus("em lançamento omie")],
      ...(MODO === "lancar"
        ? [
            ["Esperar ✅ Lançado no Omie no tópico", () => esperarNoFio(LANCADO)],
            ["Status agora é lançado omie", () => statusDeveSer("lançado omie")],
          ]
        : [
            ["Esperar o aviso do modo conferência no tópico", () => esperarNoFio(MODO_CONFERENCIA)],
            ["Status continua em lançamento omie", () => statusDeveSer("em lançamento omie")],
          ]),
      ["Captura", () => capturar(`cp-conferida-pelo-card-${MODO}`)],
    ],
  },
  {
    chave: "cp-ajuste",
    soQuandoPedido: true,
    titulo: "Contas a pagar — ajuste pedido no fio do Resumo",
    lista: "lst_contas_a_pagar",
    botao: "+ Nova conta",
    nome: `TESTE AUTOMATIZADO — CP ajuste · ${CARIMBO}`,
    passos: [
      ...passosDaContaAPagar(),
      ["Esperar o 📋 RESUMO DE PAGAMENTO no tópico", () => esperarNoFio(RESUMO)],
      ["Card: Conferência do Resumo · Pendente", () => cardDaConferencia("Pendente")],
      // Qualquer resposta de revisor ao Resumo que não é aprovação pede ajuste (Fluxo 6).
      [
        'Responder no fio: "é prestação comercial, não ADM"',
        async () => {
          revisadosAntesDoAjuste = await contarNoFio(REVISADO);
          return responderNoFio(RESUMO, "é prestação comercial, não ADM");
        },
      ],
      ["Esperar 🔁 Ajuste pedido por no tópico", () => esperarNoFio(AJUSTE)],
      [
        "Esperar o Resumo revisado (Revisado a pedido de) no tópico",
        () => esperarNoFio(REVISADO, ESPERA_MS, { aPartirDe: revisadosAntesDoAjuste }),
      ],
      ["Card: Conferência nova, Pendente", () => cardDaConferencia("Pendente")],
      ["Captura do Resumo revisado", () => capturar("cp-ajuste-resumo-revisado")],
    ],
  },
  {
    chave: "cp-dispensa-manual",
    soQuandoPedido: true,
    titulo: "Contas a pagar — dispensa (Integração manual) desmarcada: o Resumo volta para uma pessoa (crm2:CR-01)",
    lista: "lst_contas_a_pagar",
    botao: "+ Nova conta",
    nome: `TESTE AUTOMATIZADO — CP dispensa manual · ${CARIMBO}`,
    passos: [
      [
        "JORNADA_MODO = conferencia (este cenário nunca roda com a ponte lançando)",
        async () => {
          if (MODO !== "conferencia") throw new Error(`cp-dispensa-manual exige JORNADA_MODO=conferencia (veio "${MODO}")`);
        },
      ],
      // Manual ANTES dos outros Campos: a ponte nunca vê esta conta completa sem Manual.
      ["Integração manual = Manual", () => escolher("Integração manual", "Manual")],
      ...passosDaContaAPagar(),
      ["Esperar o 📋 RESUMO DE PAGAMENTO no tópico", () => esperarNoFio(RESUMO)],
      [
        "Esperar ✅ Resumo conferido (a dispensa pelo Agente do pipeline)",
        async () => {
          try {
            return await esperarNoFio(CONFERIDO);
          } catch {
            throw new Error("a ponte não dispensou: ela está em sem-conferencia?");
          }
        },
      ],
      ["Card escondido enquanto a conta é Manual", () => semCardDaConferencia()],
      [
        "Guardar o fio do Resumo",
        async () => {
          dispensa.raizId = await idDoComentario(painel().locator('li[id^="comentario-"]').filter({ hasText: RESUMO }).first());
          dispensa.conferidosAntes = await contarNoFio(CONFERIDO);
          return `fio ${dispensa.raizId}`;
        },
      ],
      ["Captura da dispensa", () => capturar("cp-dispensa-manual-dispensada")],
      ["Desmarcar Integração manual", () => desmarcarEscolha("Integração manual", "Manual")],
      ["Esperar um SEGUNDO 📋 RESUMO DE PAGAMENTO", () => esperarNoFio(RESUMO, ESPERA_MS, { aPartirDe: 1 })],
      [
        "O Resumo novo responde no MESMO fio, com \"Os dados da conta mudaram depois da conferência.\"",
        async () => {
          const novo = painel().locator('li[id^="comentario-"]').filter({ hasText: RESUMO }).last();
          dispensa.resumoNovoId = await idDoComentario(novo);
          if (!(await novo.innerText()).match(DADOS_MUDARAM)) throw new Error("o Resumo novo não diz que os dados da conta mudaram");
          const noFio = await novo.locator(`a[href="#comentario-${dispensa.raizId}"]`).count();
          if (noFio === 0) throw new Error(`o Resumo novo (${dispensa.resumoNovoId}) não responde no fio ${dispensa.raizId}`);
          return `Resumo novo ${dispensa.resumoNovoId} no fio ${dispensa.raizId}`;
        },
      ],
      ["Card: Conferência do Resumo · Pendente", () => cardDaConferencia("Pendente")],
      ["Status → em lançamento omie", () => mudarStatus("em lançamento omie")],
      [
        "Dois ciclos da ponte: nenhum aviso de \"lançaria\", nenhum ✅ Resumo conferido novo, card Pendente",
        async () => {
          await pagina.waitForTimeout(ESPERA_CICLOS_MS);
          await recarregar();
          if ((await contarNoFio(MODO_CONFERENCIA)) > 0) throw new Error('a ponte publicou o aviso do modo conferência: ela trataria a dispensa desmarcada como conferida ("lançaria")');
          const conferidos = await contarNoFio(CONFERIDO);
          if (conferidos !== dispensa.conferidosAntes) throw new Error(`apareceu um ✅ Resumo conferido novo sem resposta humana (${conferidos}, antes ${dispensa.conferidosAntes})`);
          await cardDaConferencia("Pendente");
          return `dispensa desmarcada: Resumo novo no fio (${dispensa.resumoNovoId}), nenhum aviso de "lançaria" até a resposta humana`;
        },
      ],
      ["Captura antes da resposta humana", () => capturar("cp-dispensa-manual-pendente")],
      ['Responder "ok" no fio do Resumo', () => responderNoFio(RESUMO, "ok")],
      ["Esperar ✅ Resumo conferido (a pessoa)", () => esperarNoFio(CONFERIDO, ESPERA_MS, { aPartirDe: dispensa.conferidosAntes })],
      ["Esperar o aviso do modo conferência no tópico", () => esperarNoFio(MODO_CONFERENCIA)],
      ["Status continua em lançamento omie", () => statusDeveSer("em lançamento omie")],
      ["Captura", () => capturar("cp-dispensa-manual-conferida")],
    ],
  },
  {
    chave: "cp-dispensa-com-resposta",
    soQuandoPedido: true,
    titulo: 'Contas a pagar — "Manual" marcado com uma resposta pendente no fio: a resposta decide, a dispensa espera (06-21)',
    lista: "lst_contas_a_pagar",
    botao: "+ Nova conta",
    nome: `TESTE AUTOMATIZADO — CP dispensa com resposta · ${CARIMBO}`,
    passos: [
      [
        "JORNADA_MODO = conferencia e o relógio da ponte à parte (JORNADA_PONTE_INICIO_MS, JORNADA_PONTE_INTERVALO_MS)",
        async () => {
          if (MODO !== "conferencia") throw new Error(`cp-dispensa-com-resposta exige JORNADA_MODO=conferencia (veio "${MODO}")`);
          if (!Number.isFinite(PONTE_INICIO_MS) || !Number.isFinite(PONTE_INTERVALO_MS) || PONTE_INTERVALO_MS < 2 * TEMPO_DAS_DUAS_GRAVACOES_MS) {
            throw new Error(`exige JORNADA_PONTE_INICIO_MS e JORNADA_PONTE_INTERVALO_MS (≥ ${(2 * TEMPO_DAS_DUAS_GRAVACOES_MS) / 1000} s): a ponte num processo à parte, só no relógio`);
          }
          return `ponte iniciada às ${hora(PONTE_INICIO_MS)}, um ciclo a cada ${PONTE_INTERVALO_MS / 1000} s`;
        },
      ],
      // Sem "Integração manual": o Resumo vai para uma pessoa conferir.
      ...passosDaContaAPagar(),
      ["Esperar o 📋 RESUMO DE PAGAMENTO no tópico", () => esperarNoFio(RESUMO)],
      ["Card: Conferência do Resumo · Pendente", () => cardDaConferencia("Pendente")],
      ["Captura do Resumo", () => capturar("cp-dispensa-com-resposta-resumo")],
      [
        `Logo depois de um tique da ponte: responder no fio "${PEDIDO_DE_AJUSTE}" e marcar Integração manual = Manual`,
        async () => {
          const alinhamento = await alinharComOTique();
          comResposta.conferidosAntes = await contarNoFio(CONFERIDO);
          comResposta.revisadosAntes = await contarNoFio(REVISADO);
          comResposta.antesDaResposta = Date.now();
          const respondido = await responderNoFio(RESUMO, PEDIDO_DE_AJUSTE);
          await escolher("Integração manual", "Manual");
          comResposta.depoisDoManual = Date.now();
          return `${alinhamento}; ${respondido}; resposta a partir de ${hora(comResposta.antesDaResposta)}, Manual gravado até ${hora(comResposta.depoisDoManual)}`;
        },
      ],
      [
        "As duas gravações caíram entre os MESMOS dois tiques: o ciclo seguinte lê a resposta pendente E o Manual juntos",
        async () => {
          const k = tiqueDaPonte(comResposta.antesDaResposta);
          const depoisDaLeitura = comResposta.antesDaResposta >= instanteDoTique(k) + LEITURA_DO_CICLO_MS;
          const antesDoProximo = comResposta.depoisDoManual < instanteDoTique(k + 1);
          const janela = `tique ${k} às ${hora(instanteDoTique(k))}, tique ${k + 1} às ${hora(instanteDoTique(k + 1))}`;
          if (!depoisDaLeitura || !antesDoProximo) {
            throw new Error(`prova inconclusiva: as gravações (${hora(comResposta.antesDaResposta)}–${hora(comResposta.depoisDoManual)}) não couberam entre a leitura de um tique e o seguinte (${janela})`);
          }
          return `${janela}: nenhum ciclo leu uma sem a outra`;
        },
      ],
      [
        "Esperar 🔁 Ajuste pedido por — sem nenhum ✅ Resumo conferido antes dele",
        async () => {
          const inicio = Date.now();
          for (;;) {
            const ajustes = await contarNoFio(AJUSTE);
            const conferidos = await contarNoFio(CONFERIDO);
            if (ajustes > 0) return `apareceu em ${Math.round((Date.now() - inicio) / 1000)} s`;
            if (conferidos > comResposta.conferidosAntes) {
              throw new Error("✅ Resumo conferido sem 🔁 Ajuste pedido: a ponte dispensou por cima da resposta pendente (o Crítico do 06-REVIEW-3)");
            }
            if (Date.now() - inicio > ESPERA_MS) throw new Error(`"${AJUSTE.source}" não apareceu no tópico em ${Math.round(ESPERA_MS / 1000)} s`);
            await pagina.waitForTimeout(3_000);
            await recarregar();
          }
        },
      ],
      ["Esperar o Resumo revisado (Revisado a pedido de)", () => esperarNoFio(REVISADO, ESPERA_MS, { aPartirDe: comResposta.revisadosAntes })],
      [
        "Esperar a dispensa do Resumo REVISADO (✅ Resumo conferido — agora a conta é Manual)",
        () => esperarNoFio(CONFERIDO, ESPERA_MS, { aPartirDe: comResposta.conferidosAntes }),
      ],
      [
        "A ordem no tópico: resposta → 🔁 Ajuste pedido → Resumo revisado → ✅ Resumo conferido",
        async () => {
          const itens = await comentariosDoTopico();
          const indice = (padrao, desde = 0) => itens.findIndex((c, i) => i >= desde && padrao.test(c.texto));
          const iResposta = itens.findIndex((c) => c.texto.includes(PEDIDO_DE_AJUSTE));
          const iAjuste = indice(AJUSTE, iResposta + 1);
          const iRevisado = indice(REVISADO, iAjuste + 1);
          const iConferido = indice(CONFERIDO);
          if (iResposta < 0 || iAjuste < 0 || iRevisado < 0 || iConferido < 0) {
            throw new Error(`faltou um elo no tópico (resposta ${iResposta}, ajuste ${iAjuste}, revisado ${iRevisado}, conferido ${iConferido})`);
          }
          if (iConferido < iRevisado) throw new Error(`o ✅ Resumo conferido (posição ${iConferido}) veio antes do Resumo revisado (${iRevisado}): foi dispensado o Resumo velho`);
          return `resposta ${itens[iResposta].id} → ajuste ${itens[iAjuste].id} → revisado ${itens[iRevisado].id} → conferido ${itens[iConferido].id}`;
        },
      ],
      ["Card escondido (a conta é Manual)", () => semCardDaConferencia()],
      ["Captura", () => capturar("cp-dispensa-com-resposta")],
    ],
  },
  {
    // Checklist 6.6 e E2: o ajuste pedido no fio é lido pela IA do `automation/`
    // (o `/resolver` de verdade, com a chave da OpenAI) e aplicado nos Campos
    // pelo Agente; tudo aparece sem recarregar a página. Precisa da ponte
    // ligada em `conferencia` e do `automation/` com a leitura do pedido.
    chave: "cp-ajuste-pelo-fio",
    soQuandoPedido: true,
    titulo: "Contas a pagar — ajuste pedido no fio, lido pela IA e aplicado (Fluxo 6, E2)",
    lista: "lst_contas_a_pagar",
    botao: "+ Nova conta",
    nome: `TESTE AUTOMATIZADO — CP ajuste pelo fio · ${CARIMBO}`,
    passos: [
      ...passosDaContaAPagar(),
      ["Esperar o 📋 RESUMO DE PAGAMENTO sem recarregar (E2)", () => esperarSemRecarregar(RESUMO)],
      ["Card: Conferência pendente", () => cardDaConferencia("Pendente")],
      ["Responder no fio: valor e vencimento novos", () => responderNoFio(RESUMO, PEDIDO_DO_FLUXO_6)],
      ["Esperar o Resumo revisado com \"O que mudou\" sem recarregar (E2)", () => esperarSemRecarregar(/O que mudou: /)],
      [
        "O que mudou: Valor → R$ 1.234,56 e Vencimento → 20/10/2026",
        async () => {
          const revisado = (await painel().locator('li[id^="comentario-"]').filter({ hasText: /O que mudou: / }).last().innerText()).replace(/\s+/g, " ");
          if (!/Valor: [^;]* → R\$\s?1\.234,56/.test(revisado)) throw new Error(`o Resumo revisado não diz o Valor novo: ${revisado.slice(0, 400)}`);
          if (!/Vencimento: [^;.]* → 20\/10\/2026/.test(revisado)) throw new Error(`o Resumo revisado não diz o Vencimento novo: ${revisado.slice(0, 400)}`);
          if (!/Ajustado a pedido no fio: /.test(revisado)) throw new Error("as Observações do Resumo revisado não registram o ajuste");
          return "o Resumo revisado diz o que mudou, e as Observações registram";
        },
      ],
      ["O Campo Valor mostra R$ 1.234,56", () => campoMostra("Valor", /1\.234,56/)],
      ["Card: Conferência nova pendente", () => cardDaConferencia("Pendente")],
      ["Captura", () => capturar("cp-ajuste-pelo-fio")],
    ],
  },
  {
    chave: "cp-lancada-no-omie",
    soQuandoPedido: true,
    titulo: "Contas a pagar — lançada no Omie DE VERDADE pela ponte (passo 2B, R$ 1,00)",
    lista: "lst_contas_a_pagar",
    botao: "+ Nova conta",
    nome: `TESTE AUTOMATIZADO — CP lançada no Omie (2B) · ${CARIMBO}`,
    passos: [
      [
        "JORNADA_MODO = lancar, o PDF do anexo (JORNADA_ANEXO) e o fornecedor que já existe no Omie",
        async () => {
          if (MODO !== "lancar") throw new Error(`cp-lancada-no-omie exige JORNADA_MODO=lancar (veio "${MODO}")`);
          if (!ANEXO || !existsSync(ANEXO)) throw new Error("exige JORNADA_ANEXO com o caminho de um PDF pequeno");
          // O CNPJ de teste é de uma empresa real: lançar com ele cadastraria essa empresa no Omie.
          if (!FORNECEDOR_CNPJ || !FORNECEDOR_NOME) throw new Error("exige JORNADA_FORNECEDOR_CNPJ e JORNADA_FORNECEDOR_NOME (um fornecedor que já existe no Omie)");
          return `${path.basename(ANEXO)} · ${FORNECEDOR_NOME}`;
        },
      ],
      // Antes dos Campos: a ponte só vê a conta completa, e já com o anexo.
      [
        'Anexar o PDF pela seção "Anexar arquivo" do popup',
        async () => {
          // Desde o 7.3 o anexo sobe de verdade: ticket → bytes ao bucket → confirmação no servidor.
          const [confirmacao] = await Promise.all([
            pagina.waitForResponse((r) => r.request().method() === "POST" && /\/tarefas\/[^/]+\/anexos\/confirmar$/.test(r.url()), { timeout: 90_000 }),
            painel().locator('input[type="file"][multiple]').setInputFiles(ANEXO),
          ]);
          const corpo = await confirmacao.json().catch(() => ({}));
          if (confirmacao.status() !== 200 || corpo?.ok === false) throw new Error(`o anexo não foi confirmado: ${confirmacao.status()} ${JSON.stringify(corpo).slice(0, 200)}`);
          return `anexado de verdade: ${path.basename(ANEXO)} (${corpo?.value?.fileId ?? "?"})`;
        },
      ],
      ...passosDaContaAPagar("1.00", { cnpj: FORNECEDOR_CNPJ ?? "", nome: FORNECEDOR_NOME ?? "" }),
      ["Esperar o 📋 RESUMO DE PAGAMENTO no tópico", () => esperarNoFio(RESUMO)],
      ["Card: Conferência do Resumo · Pendente", () => cardDaConferencia("Pendente")],
      ['Responder "ok" no fio do Resumo', () => responderNoFio(RESUMO, "ok")],
      ["Esperar ✅ Resumo conferido no tópico", () => esperarNoFio(CONFERIDO)],
      ["Card: Conferência do Resumo · Conferido", () => cardDaConferencia("Conferido")],
      ["Status → em lançamento omie", () => mudarStatus("em lançamento omie")],
      [
        "Esperar ✅ Lançado no Omie no tópico",
        async () => {
          const nota = await esperarNoFio(LANCADO);
          const texto = await painel().locator('li[id^="comentario-"]').filter({ hasText: LANCADO }).last().innerText();
          const linhas = texto.split("\n");
          const inicio = linhas.findIndex((l) => LANCADO.test(l));
          lancamento.texto = linhas.slice(inicio).filter((l) => l.trim() && l.trim() !== "Responder").join(" | ");
          return `${nota}: ${lancamento.texto}`;
        },
      ],
      ["Status agora é lançado omie", () => statusDeveSer("lançado omie")],
      ["Captura", () => capturar("cp-lancada-no-omie")],
    ],
  },
  {
    chave: "cp-lancada-no-omie-de-novo",
    soQuandoPedido: true,
    titulo: "Contas a pagar — a conta recusada pelo Omie, com o fornecedor corrigido, conferida de novo e lançada (passo 2B)",
    lista: "lst_contas_a_pagar",
    botao: "+ Nova conta",
    nome: `TESTE AUTOMATIZADO — CP lançada no Omie (2B) · ${CARIMBO}`,
    passos: [
      [
        "JORNADA_MODO = lancar, a conta recusada (JORNADA_RETOMAR) e o fornecedor que já existe no Omie",
        async () => {
          if (MODO !== "lancar") throw new Error(`cp-lancada-no-omie-de-novo exige JORNADA_MODO=lancar (veio "${MODO}")`);
          if (!retomar.get("cp-lancada-no-omie-de-novo")?.id) throw new Error("só roda sobre a conta recusada: JORNADA_RETOMAR=cp-lancada-no-omie-de-novo=<conta>@0");
          if (!FORNECEDOR_CNPJ || !FORNECEDOR_NOME) throw new Error("exige JORNADA_FORNECEDOR_CNPJ e JORNADA_FORNECEDOR_NOME");
          await statusDeveSer("para pagar");
          deNovo.resumosAntes = await contarNoFio(RESUMO);
          deNovo.conferidosAntes = await contarNoFio(CONFERIDO);
          deNovo.lancadosAntes = await contarNoFio(LANCADO);
          return `antes: ${deNovo.resumosAntes} Resumo(s), ${deNovo.conferidosAntes} conferido(s), ${deNovo.lancadosAntes} lançado(s)`;
        },
      ],
      [`CNPJ = ${FORNECEDOR_CNPJ ?? "?"}`, () => digitar("CNPJ", FORNECEDOR_CNPJ)],
      [`Nome do fornecedor = ${FORNECEDOR_NOME ?? "?"}`, () => digitar("Nome do fornecedor", FORNECEDOR_NOME)],
      [
        'Esperar um Resumo NOVO, com "Os dados da conta mudaram depois da conferência."',
        async () => {
          const nota = await esperarNoFio(RESUMO, ESPERA_MS, { aPartirDe: deNovo.resumosAntes });
          const novo = painel().locator('li[id^="comentario-"]').filter({ hasText: RESUMO }).last();
          if (!(await novo.innerText()).match(DADOS_MUDARAM)) throw new Error("o Resumo novo não diz que os dados da conta mudaram");
          return nota;
        },
      ],
      ["Card: Conferência do Resumo · Pendente", () => cardDaConferencia("Pendente")],
      ['Responder "ok" no fio do Resumo', () => responderNoFio(RESUMO, "ok")],
      ["Esperar ✅ Resumo conferido no tópico", () => esperarNoFio(CONFERIDO, ESPERA_MS, { aPartirDe: deNovo.conferidosAntes })],
      ["Card: Conferência do Resumo · Conferido", () => cardDaConferencia("Conferido")],
      ["Status → em lançamento omie", () => mudarStatus("em lançamento omie")],
      [
        "Esperar ✅ Lançado no Omie no tópico",
        async () => {
          const nota = await esperarNoFio(LANCADO, ESPERA_MS, { aPartirDe: deNovo.lancadosAntes });
          const texto = await painel().locator('li[id^="comentario-"]').filter({ hasText: LANCADO }).last().innerText();
          const linhas = texto.split("\n");
          const inicio = linhas.findIndex((l) => LANCADO.test(l));
          lancamento.texto = linhas.slice(inicio).filter((l) => l.trim() && l.trim() !== "Responder").join(" | ");
          return `${nota}: ${lancamento.texto}`;
        },
      ],
      ["Status agora é lançado omie", () => statusDeveSer("lançado omie")],
      ["Captura", () => capturar("cp-lancada-no-omie-de-novo")],
    ],
  },
  {
    chave: "cr-recebida",
    titulo: "Contas a receber — cobrada e recebida",
    lista: "lst_contas_a_receber",
    botao: "+ Nova conta a receber",
    nome: `TESTE AUTOMATIZADO — CR recebida · ${CARIMBO}`,
    passos: [
      ...passosDaContaAReceber("250"),
      ["Comentário com Menção", () => comentar("Conta a receber de teste automatizado. Cliente avisado do vencimento.")],
      ["Iniciar cobrança → pendente (R2b: Situação \"em cobrança\")", () => acaoDoRodape("Iniciar cobrança")],
      ["Comentário: cobrança enviada", () => comentar("Cobrança enviada ao cliente por e-mail.", { mencionar: false })],
      ["Marcar como recebida → recebido (R3: data de pagamento e Situação \"em dia\")", () => acaoDoRodape("Marcar como recebida")],
      ["Comentário: recebido", () => comentar("Recebido via Pix. Conciliado.", { mencionar: false })],
      ["Captura", () => capturar("cr-recebida")],
    ],
  },
  {
    chave: "cr-inadimplente",
    titulo: "Contas a receber — cobrada e descartada",
    lista: "lst_contas_a_receber",
    botao: "+ Nova conta a receber",
    nome: `TESTE AUTOMATIZADO — CR inadimplente · ${CARIMBO}`,
    passos: [
      ...passosDaContaAReceber("180"),
      ["Comentário com Menção", () => comentar("Conta a receber de teste automatizado para o caminho da inadimplência.")],
      ["Iniciar cobrança → pendente (R2b)", () => acaoDoRodape("Iniciar cobrança")],
      ["Comentário: sem retorno", () => comentar("Sem retorno do cliente depois de três contatos.", { mencionar: false })],
      ["Status → descartado (R6: Situação \"inadimplente\")", () => mudarStatus("descartado")],
      ["Comentário: descartado", () => comentar("Descartado: cliente inadimplente, segue para o jurídico.", { mencionar: false })],
      ["Captura", () => capturar("cr-inadimplente")],
    ],
  },
];

/**
 * JORNADA_SO=cp-aprovada,cr-recebida — roda só esses cenários.
 * JORNADA_RETOMAR=cp-aprovada=tsk_x@4,cr-inadimplente=tsk_y@9 — abre a conta que
 * parou no meio e continua do passo indicado (o número que a falha imprimiu),
 * em vez de criar outra.
 */
// `--so=a,b` na linha de comando vale o mesmo que JORNADA_SO=a,b (e se soma a ela).
const soDaLinha = process.argv.slice(2).filter((a) => a.startsWith("--so=")).map((a) => a.slice("--so=".length));
const so = new Set(
  [process.env.JORNADA_SO ?? "", ...soDaLinha]
    .join(",")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean),
);
const retomar = new Map(
  (process.env.JORNADA_RETOMAR ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => {
      const [chave, resto] = x.split("=");
      const [id, passoInicial] = (resto ?? "").split("@");
      return [chave, { id, passoInicial: Number(passoInicial ?? 0) }];
    }),
);

const pedeAPonte =
  so.has("cp-conferida") ||
  so.has("cp-ajuste") ||
  so.has("cp-conferida-pelo-card") ||
  so.has("cp-dispensa-manual") ||
  so.has("cp-dispensa-com-resposta") ||
  so.has("cp-lancada-no-omie") ||
  so.has("cp-lancada-no-omie-de-novo");
console.log(`Jornada do Financeiro como um humano — ${URL_BASE} — ${CARIMBO}${pedeAPonte ? ` — ponte em ${MODO}` : ""}`);
await entrar();

for (const c of CENARIOS) {
  if (so.size > 0 && !so.has(c.chave)) continue;
  // Os cenários da Conferência precisam da ponte ligada: só rodam quando pedidos pelo nome.
  if (c.soQuandoPedido && !so.has(c.chave)) continue;
  console.log(`\n${c.titulo}`);
  let id;
  let inicio = 0;
  try {
    const retomada = retomar.get(c.chave);
    if (retomada?.id) {
      await pagina.goto(`${URL_BASE}/estrutura/listas/${c.lista}?tarefa=${retomada.id}`, { timeout: 90_000 });
      await painel().waitFor({ state: "visible" });
      id = retomada.id;
      inicio = retomada.passoInicial;
      passo(c.chave, `Conta retomada (${id}) a partir do passo ${inicio}`);
    } else {
      id = await novaConta(c.lista, c.botao, c.nome);
      passo(c.chave, `Conta criada (${id})`);
    }
  } catch (erro) {
    passo(c.chave, `não consegui abrir/criar a conta: ${erro instanceof Error ? erro.message.split("\n")[0] : String(erro)}`, false);
    continue;
  }
  for (let i = inicio; i < c.passos.length; i += 1) {
    const [nomeDoPasso, executar] = c.passos[i];
    try {
      await legenda(`${c.titulo} — ${nomeDoPasso}`);
      const nota = await executar();
      if (VISIVEL) await pagina.waitForTimeout(500);
      passo(c.chave, `${i}. ${nomeDoPasso}${typeof nota === "string" ? ` — ${nota}` : ""}`);
    } catch (erro) {
      passo(c.chave, `${i}. ${nomeDoPasso} — ${erro instanceof Error ? erro.message.split("\n")[0] : String(erro)}`, false);
      console.log(`     para continuar desta conta: JORNADA_RETOMAR=${c.chave}=${id}@${i}`);
      await capturar(`falha-${c.chave}-passo-${i}`).catch(() => {});
      break;
    }
  }
  registro.push({ conta: c.chave, texto: "fim do cenário", ok: true, id });
}

await navegador.close();
writeFileSync(path.join(SAIDA, "registro.json"), JSON.stringify(registro, null, 2));
const falhas = registro.filter((r) => !r.ok);
console.log(`\n${falhas.length === 0 ? "RESULTADO: OK" : `RESULTADO: ${falhas.length} falha(s)`} — contas: ${registro.filter((r) => r.id).map((r) => r.id).join(", ")}`);
process.exit(falhas.length === 0 ? 0 : 1);
