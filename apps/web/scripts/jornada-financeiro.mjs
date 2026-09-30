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
 */

import { mkdirSync, writeFileSync } from "node:fs";
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
 * "Pedir ajuste" no card, com o motivo — o mesmo fato que uma resposta de
 * ajuste no fio. Desde o 06-14 o cp-ajuste pede o ajuste RESPONDENDO no fio;
 * este é o gesto do card, para quem quiser o ajuste pelo clique.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- sem uso desde o 06-14 (o cp-ajuste responde no fio); fica como o gesto do card
async function pedirAjustePeloCard(motivo) {
  const botao = painel().getByRole("button", { name: "Pedir ajuste", exact: true });
  if (await botao.isDisabled()) throw new Error(`o botão está indisponível: ${(await botao.getAttribute("title")) ?? "sem motivo"}`);
  await botao.click();
  const confirmacao = pagina.getByRole("alertdialog");
  const caixa = confirmacao.getByRole("textbox").first();
  await caixa.pressSequentially(motivo, { delay: VISIVEL ? 35 : 5 });
  await gravando("decideProcessApproval", () => confirmacao.getByRole("button", { name: "Pedir ajuste", exact: true }).click());
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




const passosDaContaAPagar = () => [
  ["Centro de Custo = TRIA", () => escolher("Centro de Custo", "TRIA")],
  ["Empresa = Tria Company", () => escolher("Empresa", "Tria Company")],
  ["Categoria = Contas de consumo", () => escolher("Categoria de pagamento", "Contas de consumo")],
  ["Fornecedor = CNPJ", () => escolher("Fornecedor", "CNPJ")],
  ["CNPJ", () => digitar("CNPJ", "11.222.333/0001-81")],
  ["Nome do fornecedor", () => digitar("Nome do fornecedor", "Fornecedor Teste Automatizado LTDA")],
  ["Forma de pagamento = Chave Pix", () => escolher("Forma de pagamento", "Chave Pix")],
  ["Chave pix", () => digitar("Chave pix", "teste-integracao@triacompany.com.br")],
  ["Valor = R$ 123,45", () => digitar("Valor", "123.45")],
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

const pedeAPonte = so.has("cp-conferida") || so.has("cp-ajuste") || so.has("cp-conferida-pelo-card");
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
