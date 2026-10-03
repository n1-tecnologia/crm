/**
 * Grava a TELA REAL do `apps/web` sendo usada como uma pessoa usaria: o
 * cursor anda até o alvo, clica, digita no ritmo de gente, rola a tela. Os
 * dados são os do servidor de demonstração (`servidor.ts`), nunca os reais.
 *
 * Saída em `public/gravacao/`: os quadros da tela (screencast do Chromium, em
 * JPEG 1,5×, para o zoom sair nítido) e `roteiro.json` — quando cada quadro
 * chegou, o caminho do cursor, os cliques e as MARCAS (título, texto e a
 * caixa em foco) que o Remotion (`video/`) transforma em zoom e legenda.
 *
 *   (raiz) node ferramentas/video-do-financeiro/gravar.mjs
 *   SONDAR=1 … também salva uma foto em cada marca, em public/gravacao/sondas/
 *
 * Precisa do servidor (porta 54330) e do web (3007) de pé — ver CONTEXT.md.
 */

import { chromium } from "playwright";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const SAIDA = join(AQUI, "public", "gravacao");
const WEB = process.env.WEB ?? "http://localhost:3007";
const API = process.env.API ?? "http://127.0.0.1:54330";
const LARGURA = 1440;
const ALTURA = 900;
const ESCALA = 1.5;
const SONDAR = process.env.SONDAR === "1";
const ARQUIVO_DE_EXEMPLO = join(AQUI, "nota-fiscal-exemplo.pdf");

rmSync(SAIDA, { recursive: true, force: true });
mkdirSync(join(SAIDA, "quadros"), { recursive: true });
if (SONDAR) mkdirSync(join(SAIDA, "sondas"), { recursive: true });

const roteiro = { largura: LARGURA, altura: ALTURA, escala: ESCALA, quadros: [], cursor: [], cliques: [], marcas: [], duracao: 0 };

/* ───────────────────────────── preparação ───────────────────────────── */

const { segredo } = await (await fetch(`${API}/demonstracao/reiniciar`, { method: "POST" })).json();
// Em português: as datas aparecem como dd/mm/aaaa, como no navegador da Mari.
const navegador = await chromium.launch({ args: ["--lang=pt-BR"] });
const contexto = await navegador.newContext({ viewport: { width: LARGURA, height: ALTURA }, deviceScaleFactor: ESCALA, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
await contexto.grantPermissions(["clipboard-read", "clipboard-write"], { origin: WEB });
// O vídeo não mostra o próprio guia abrindo por cima de tudo.
await contexto.addInitScript(() => localStorage.setItem("n1:guia-do-financeiro:mem_maryane", JSON.stringify({ vezes: 3, dispensado: true })));
const p = await contexto.newPage();
p.setDefaultTimeout(20_000);

// Aquece as rotas (o Next de desenvolvimento compila na primeira visita): a gravação não mostra o esqueleto de carregamento.
async function entrarSemGravar() {
  await p.goto(`${WEB}/entrar`, { timeout: 180_000 });
  await p.locator("input[name=email]").fill("maryane@n1.teste");
  await p.locator("input[name=senha]").fill("demonstracao");
  await p.locator("button[type=submit]").click();
  await p.waitForURL((u) => !u.pathname.startsWith("/entrar"), { timeout: 180_000 });
}
await entrarSemGravar();
for (const rota of [
  "/",
  "/estrutura/listas/lst_solicitacoes_de_pagamento",
  "/estrutura/listas/lst_solicitacoes_de_pagamento/configuracoes",
  "/estrutura/listas/lst_contas_a_pagar",
  "/estrutura/listas/lst_contas_a_receber",
  `/f/${segredo}`,
]) {
  await p.goto(`${WEB}${rota}`, { waitUntil: "networkidle", timeout: 180_000 });
}
await contexto.clearCookies();
await fetch(`${API}/demonstracao/reiniciar`, { method: "POST" });

/* ───────────────────────────── gravação ───────────────────────────── */

const t0 = performance.now();
const agora = () => (performance.now() - t0) / 1000;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const cdp = await contexto.newCDPSession(p);
let numero = 0;
cdp.on("Page.screencastFrame", ({ data, sessionId }) => {
  const arquivo = `q${String(numero++).padStart(5, "0")}.jpg`;
  writeFileSync(join(SAIDA, "quadros", arquivo), Buffer.from(data, "base64"));
  roteiro.quadros.push({ t: agora(), arquivo });
  cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
});
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 85, maxWidth: LARGURA * ESCALA, maxHeight: ALTURA * ESCALA, everyNthFrame: 1 });

let cursor = { x: LARGURA * 0.62, y: ALTURA * 0.55 };
roteiro.cursor.push({ t: 0, ...cursor });
const suave = (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);

/** O cursor anda até (x, y) como uma mão: devagar no começo e no fim. */
async function moverPara(x, y, ms) {
  const distancia = Math.hypot(x - cursor.x, y - cursor.y);
  const duracao = ms ?? Math.min(1100, 350 + distancia * 0.9);
  const passos = Math.max(6, Math.round(duracao / 16));
  const de = { ...cursor };
  for (let i = 1; i <= passos; i += 1) {
    const k = suave(i / passos);
    const nx = de.x + (x - de.x) * k;
    const ny = de.y + (y - de.y) * k;
    await p.mouse.move(nx, ny);
    roteiro.cursor.push({ t: agora(), x: nx, y: ny });
    await esperar(duracao / passos);
  }
  cursor = { x, y };
}

async function caixa(alvo) {
  await alvo.scrollIntoViewIfNeeded();
  const b = await alvo.boundingBox();
  if (!b) throw new Error(`sem caixa para ${alvo}`);
  return b;
}

/** Vai até o alvo e clica nele — o clique fica no roteiro (o Remotion desenha a onda). */
async function clicar(alvo, { pausa = 250 } = {}) {
  const b = await caixa(alvo);
  await moverPara(b.x + b.width / 2, b.y + b.height / 2);
  await esperar(120);
  roteiro.cliques.push({ t: agora(), x: cursor.x, y: cursor.y });
  await p.mouse.down();
  await esperar(70);
  await p.mouse.up();
  await esperar(pausa);
}

async function digitar(texto, atraso = 55) {
  for (const letra of texto) {
    await p.keyboard.type(letra);
    await esperar(atraso + Math.random() * 35);
  }
}

async function preencher(rotulo, texto) {
  await clicar(p.getByLabel(rotulo, { exact: false }).first(), { pausa: 120 });
  await digitar(texto);
  await esperar(250);
}

async function escolher(rotulo, opcao) {
  await clicar(p.getByLabel(rotulo, { exact: false }).first(), { pausa: 350 });
  await clicar(p.getByRole("option", { name: opcao, exact: true }).first(), { pausa: 350 });
}

async function rolar(dy, sobre) {
  if (sobre) {
    const b = await sobre.boundingBox();
    if (b) await moverPara(b.x + b.width / 2, b.y + Math.min(b.height / 2, 300));
  }
  const passos = 12;
  for (let i = 0; i < passos; i += 1) {
    await p.mouse.wheel(0, dy / passos);
    await esperar(28);
  }
  await esperar(350);
}

/** A caixa que cobre todos os alvos — para enquadrar um grupo (os cartões de totais, por exemplo). */
async function uniao(alvos, margem = 16) {
  const caixas = [];
  for (const alvo of alvos) caixas.push(await caixa(alvo));
  const x = Math.min(...caixas.map((b) => b.x)) - margem;
  const y = Math.min(...caixas.map((b) => b.y)) - margem;
  const x2 = Math.max(...caixas.map((b) => b.x + b.width)) + margem;
  const y2 = Math.max(...caixas.map((b) => b.y + b.height)) + margem;
  return { x, y, w: x2 - x, h: y2 - y };
}

/** Uma faixa da largura do conteúdo na altura do alvo — a linha inteira de uma Lista. */
async function faixa(alvo, folga = 22) {
  const b = await caixa(alvo);
  const m = await p.locator("main").first().boundingBox();
  return { x: m.x + 8, y: b.y - folga, w: m.width - 16, h: b.height + folga * 2 };
}

/** O ⋯ do topo da Lista (cada linha também tem um "Ações"): o que vem logo depois de "Configurações". */
const menuDaLista = () => p.getByRole("link", { name: "Configurações" }).locator("xpath=following::button[@aria-label='Ações'][1]");

let sonda = 0;
/**
 * Uma MARCA: o Remotion põe a legenda (título + texto) e aproxima a câmera da
 * caixa em foco durante `segundos`. A gravação espera esse tempo — é a pausa
 * de quem lê.
 */
async function marcar({ titulo, texto, foco, area, segundos = 4.5, margem = 24 }) {
  let caixaDoFoco = area;
  if (foco) {
    const b = await caixa(foco);
    caixaDoFoco = { x: b.x - margem, y: b.y - margem, w: b.width + margem * 2, h: b.height + margem * 2 };
  }
  const inicio = agora();
  roteiro.marcas.push({ inicio, fim: inicio + segundos, titulo, texto, ...(caixaDoFoco ? { foco: caixaDoFoco } : {}) });
  if (SONDAR) await p.screenshot({ path: join(SAIDA, "sondas", `${String(sonda++).padStart(2, "0")}-${titulo.slice(0, 40).replace(/[^\p{L}\p{N}]+/gu, "-")}.png`) });
  await esperar(segundos * 1000);
}

/* ───────────────────────────── o roteiro ───────────────────────────── */

try {
  // 1 — Entrar
  await p.goto(`${WEB}/entrar`, { waitUntil: "networkidle" });
  await esperar(600);
  await marcar({ titulo: "Entrar no N1", texto: "O mesmo e-mail e senha de sempre. Ninguém de fora vê o Financeiro.", foco: p.locator("form").first(), segundos: 3.5 });
  await clicar(p.locator("input[name=email]"), { pausa: 100 });
  await digitar("maryane@n1.teste", 45);
  await clicar(p.locator("input[name=senha]"), { pausa: 100 });
  await digitar("••••••••", 70);
  await clicar(p.locator("button[type=submit]"));
  await p.waitForURL((u) => !u.pathname.startsWith("/entrar"));
  await p.waitForLoadState("networkidle");
  await esperar(900);

  // 2 — Onde fica o Financeiro
  const arvore = p.locator("a[href='/estrutura/listas/lst_contas_a_pagar']").first();
  await rolar(260, arvore);
  const blocoFinanceiro = p.locator("a[href='/estrutura/listas/lst_solicitacoes_de_pagamento']").first();
  await marcar({
    titulo: "O Financeiro fica em Gestão › Financeiro",
    texto: "Três Listas: Contas a pagar, Contas a receber e Solicitações de pagamento.",
    foco: p.locator("a[href='/estrutura/listas/lst_contas_a_pagar']").first(),
    margem: 70,
  });
  await clicar(blocoFinanceiro, { pausa: 300 });
  await p.waitForLoadState("networkidle");
  await esperar(900);

  // 3 — Solicitações de pagamento
  await marcar({
    titulo: "Solicitações de pagamento",
    texto: "Cada pedido enviado pelo Formulário vira uma Solicitação aqui, com tudo o que a pessoa preencheu.",
    area: await uniao([p.locator("main").getByText("Assinatura anual do software de design").first(), p.locator("main").getByText("Coffee break do workshop de outubro").first()], 40),
    segundos: 5,
  });
  const botaoFormulario = p.getByRole("link", { name: "Abrir formulário" });
  await marcar({ titulo: "Abrir formulário", texto: "Abre a página que quem precisa de um pagamento preenche. Não pede login.", foco: botaoFormulario, segundos: 4 });
  await clicar(menuDaLista(), { pausa: 500 });
  await marcar({
    titulo: "O link para mandar",
    texto: "“Copiar link do formulário” copia o endereço para você mandar por WhatsApp ou e-mail.",
    foco: p.getByRole("menuitem", { name: /Copiar link do formulário/ }),
    margem: 40,
  });
  await clicar(p.getByRole("menuitem", { name: /Copiar link do formulário/ }), { pausa: 600 });
  await marcar({ titulo: "Link copiado", texto: "Pronto para colar na conversa.", foco: p.getByText("Link do formulário copiado.").first(), segundos: 2.8 });

  // 4 — O Formulário, como quem pede vê
  await botaoFormulario.evaluate((a) => a.removeAttribute("target"));
  await clicar(botaoFormulario, { pausa: 200 });
  await p.waitForURL(/\/f\//);
  await p.waitForLoadState("networkidle");
  await esperar(800);
  await marcar({ titulo: "A página do Formulário", texto: "É o que a pessoa vê ao abrir o link: as perguntas, separadas por seção.", foco: p.getByRole("heading", { name: "Solicitação de pagamento" }).first(), margem: 40 });
  await preencher("O que deve ser pago?", "Notebook para o time de design");
  await preencher("O que é e como será utilizado?", "Substituir o notebook da Beatriz, que está com a bateria estufada.");
  await preencher("Nome do solicitante", "Beatriz Sales");
  await preencher("WhatsApp", "11987654321");
  await escolher("Centro de Custo", "TRIA");
  await escolher("Empresa", "Tria Company");
  await escolher("Categoria de pagamento", "Administrativo");
  await marcar({ titulo: "Centro de Custo", texto: "O único obrigatório além do que deve ser pago: define quem aprova.", foco: p.locator("[id^='campo-']").filter({ has: p.getByLabel("Centro de Custo") }).first(), segundos: 3.8 });
  await escolher("Fornecedor", "CNPJ");
  await marcar({ titulo: "Perguntas que aparecem quando fazem sentido", texto: "Escolheu CNPJ? Aparece o campo do CNPJ. Escolhesse CPF, apareceria o do CPF.", foco: p.getByLabel("CNPJ", { exact: true }).first(), margem: 50 });
  await preencher("CNPJ", "12345678000195");
  await preencher("Nome do fornecedor", "Loja Exemplo de Informática");
  const [seletor] = await Promise.all([p.waitForEvent("filechooser"), clicar(p.getByRole("button", { name: "Adicionar arquivos" }).first(), { pausa: 100 })]);
  await seletor.setFiles(ARQUIVO_DE_EXEMPLO);
  await esperar(1200);
  await marcar({ titulo: "O anexo", texto: "A nota, o boleto ou o orçamento: PDF, XML ou imagem, até 25 MB.", foco: p.locator("[data-papel='Anexo']").first(), segundos: 3.8 });
  await preencher("Data Vencimento", "20102026");
  await preencher("Valor", "589000");
  await escolher("Forma de pagamento", "Chave Pix");
  await preencher("Chave pix", "financeiro@lojaexemplo.com.br");
  await clicar(p.getByRole("button", { name: "Enviar solicitação" }), { pausa: 400 });
  await p.waitForLoadState("networkidle");
  await esperar(1500);
  await marcar({ titulo: "Enviado", texto: "A pessoa recebe o número da Solicitação para acompanhar.", area: await uniao([p.getByText("Solicitação enviada").first(), p.getByText("Enviar outra solicitação").first()], 40), segundos: 4 });

  // 5 — O pedido chega no N1
  await p.goto(`${WEB}/estrutura/listas/lst_solicitacoes_de_pagamento`, { waitUntil: "networkidle" });
  await esperar(900);
  const nova = p.locator("main").getByText("Notebook para o time de design").first();
  await marcar({ titulo: "Chegou", texto: "A Solicitação nova já está na Lista, com o nome do que deve ser pago.", foco: nova, margem: 50, segundos: 3.8 });
  await clicar(nova, { pausa: 900 });
  await marcar({ titulo: "Tudo o que foi preenchido", texto: "Título, descrição e, logo abaixo, os Campos com as respostas e o anexo.", foco: p.getByRole("dialog").first(), margem: 0, segundos: 4 });
  await rolar(520, p.getByRole("dialog").getByText("Campos").first());
  {
    const dialogo = p.getByRole("dialog").first();
    const d = await dialogo.boundingBox();
    const topo = await caixa(dialogo.getByText("Campos", { exact: true }).first());
    const fim = await caixa(dialogo.getByText("Chave pix", { exact: true }).first());
    await marcar({
      titulo: "Os Campos",
      texto: "Centro de Custo, fornecedor, anexo, forma de pagamento: cada resposta no seu Campo.",
      area: { x: d.x + 8, y: topo.y - 16, w: d.width * 0.6, h: fim.y + fim.height - topo.y + 32 },
      segundos: 4.5,
    });
  }
  await p.keyboard.press("Escape");
  await esperar(500);

  // 6 — Contas a pagar
  await clicar(p.locator("a[href='/estrutura/listas/lst_contas_a_pagar']").first(), { pausa: 300 });
  await p.waitForURL(/lst_contas_a_pagar/);
  await p.waitForLoadState("networkidle");
  await esperar(900);
  const main = p.locator("main");
  await marcar({
    titulo: "Contas a pagar",
    texto: "No topo, os totais: a pagar, vencidas, aguardando autorização e pagas.",
    area: await (async () => {
      const r = await uniao([main.getByText("A pagar", { exact: true }).first(), main.getByText("Pagas", { exact: true }).first()], 20);
      return { ...r, h: r.h + 64 };
    })(),
    segundos: 4.5,
  });
  const das = main.getByText("DAS — Simples Nacional").first();
  await marcar({ titulo: "Cada conta, na sua situação", texto: "Agrupadas pelo Status. O selo amarelo avisa: tem Resumo esperando a sua conferência.", area: await faixa(das, 30), segundos: 4.5 });
  await clicar(das, { pausa: 900 });
  const conta = p.getByRole("dialog").first();
  await marcar({ titulo: "A conta aberta", texto: "Status, vencimento, etiqueta da conta e quem é responsável — à esquerda. À direita, a Atividade.", foco: conta, margem: 0, segundos: 4.5 });
  await marcar({ titulo: "O Resumo do Agente", texto: "Antes de lançar no Omie, o Agente publica o Resumo de pagamento na Atividade.", foco: conta.getByText("RESUMO DE PAGAMENTO").first().locator("xpath=ancestor::*[3]"), margem: 12, segundos: 4.5 });
  const cartao = conta.getByText(/Conferência do Resumo · Pendente/).first();
  await rolar(380, cartao);
  await marcar({ titulo: "A Conferência do Resumo", texto: "Lançamento, fornecedor, valor e vencimento lado a lado. Confira com o documento.", foco: cartao.locator("xpath=ancestor::*[2]"), margem: 8, segundos: 5 });
  await marcar({ titulo: "Conferir ou pedir ajuste", texto: "Está certo: “Conferido, pode lançar”. Algo errado: “Pedir ajuste” e escreva o quê.", foco: conta.getByRole("button", { name: "Pedir ajuste" }).locator("xpath=.."), margem: 30, segundos: 4.5 });
  await clicar(conta.getByRole("button", { name: "Conferido, pode lançar" }), { pausa: 900 });
  const confirmacao = p.getByRole("alertdialog").first();
  await marcar({ titulo: "Confirme antes de lançar", texto: "A janela repete lançamento, fornecedor, valor e vencimento. Confere? Confirme.", foco: confirmacao, margem: 14, segundos: 4.8 });
  await clicar(confirmacao.getByRole("button", { name: "Conferido, pode lançar" }), { pausa: 1300 });
  await marcar({
    titulo: "Conferido",
    texto: "A conferência fica registrada na conta, com o seu nome. Agora a conta pode ir para o Omie.",
    foco: conta.getByText(/Conferência do Resumo ·/).first().locator("xpath=ancestor::*[2]"),
    margem: 8,
    segundos: 4.2,
  });
  // O lançamento no Omie acontece quando a conta vai para "em lançamento omie".
  await rolar(-900, conta.getByText(/Conferência do Resumo ·/).first());
  await clicar(conta.locator("button[title='Mudar o Status']").first(), { pausa: 600 });
  await marcar({ titulo: "Mande para o Omie pelo Status", texto: "“em lançamento omie”: o Agente lança o título no Omie, anexa o documento e avisa na Atividade.", foco: p.getByRole("option", { name: "em lançamento omie" }).first(), margem: 30, segundos: 4.8 });
  await clicar(p.getByRole("option", { name: "em lançamento omie" }).first(), { pausa: 900 });
  const mover = p.getByRole("alertdialog").first();
  await marcar({ titulo: "Mais uma confirmação", texto: "Mudar o Status também pede confirmação: passa pelas regras da Lista e fica registrado na Atividade.", foco: mover, margem: 14, segundos: 4 });
  await clicar(mover.getByRole("button", { name: "Mover" }), { pausa: 1400 });
  await marcar({ titulo: "Em lançamento", texto: "Daqui a conta segue sozinha: lançado omie, remessa, autorização — até “pago”.", foco: conta.locator("button[title='Mudar o Status']").first().locator("xpath=ancestor::*[3]"), margem: 18, segundos: 4.2 });
  await clicar(conta.getByRole("button", { name: "Fechar" }).first(), { pausa: 900 });
  await p.getByRole("dialog").first().waitFor({ state: "hidden" });

  // 7 — Contas a receber
  await clicar(p.locator("a[href='/estrutura/listas/lst_contas_a_receber']").first(), { pausa: 300 });
  await p.waitForURL(/lst_contas_a_receber/);
  await p.waitForLoadState("networkidle");
  await esperar(900);
  await marcar({ titulo: "Contas a receber", texto: "O que entra: os mesmos totais e as contas agrupadas pela situação.", foco: p.locator("main").first(), margem: 0, segundos: 4 });
  await clicar(p.getByRole("button", { name: "Nova série de parcelas" }), { pausa: 800 });
  await marcar({ titulo: "Nova série de parcelas", texto: "Para parcelados: o valor, quantas parcelas e a primeira data — o N1 cria todas.", foco: p.getByRole("alertdialog").first(), margem: 14, segundos: 4.5 });
  await p.keyboard.press("Escape");
  await esperar(500);

  // 8 — Editar o Formulário
  await p.goto(`${WEB}/estrutura/listas/lst_solicitacoes_de_pagamento/configuracoes`, { waitUntil: "networkidle" });
  await esperar(700);
  await rolar(900, p.locator("main").first());
  await marcar({
    titulo: "Editar o Formulário",
    texto: "Configurações da Lista › Formulários: perguntas, ordem, seções, o link e quantos envios já chegaram.",
    area: await uniao([p.getByText("Formulários", { exact: true }).first(), p.getByRole("button", { name: "Novo Formulário" }).first(), p.getByRole("button", { name: "Copiar link" }).first()], 22),
    segundos: 4.5,
  });
  await clicar(p.getByRole("button", { name: /^Ações de Solicitação de pagamento/ }).first(), { pausa: 500 });
  await clicar(p.getByRole("menuitem", { name: "Editar" }).first(), { pausa: 900 });
  const editor = p.getByRole("alertdialog").first();
  {
    const e = await editor.boundingBox();
    const topo = await caixa(editor.getByText("Pergunta 1", { exact: true }).first());
    const base = await caixa(editor.getByText(/Perguntas seguidas com a mesma seção/).first());
    await marcar({
      titulo: "Cada pergunta",
      texto: "O texto, o Campo que ela preenche e se é obrigatória. As setas mudam a ordem; a lixeira tira a pergunta.",
      area: { x: e.x + 12, y: topo.y - 14, w: e.width - 24, h: base.y + base.height - topo.y + 28 },
      segundos: 5,
    });
  }
  await clicar(editor.getByLabel("Ajuda").first(), { pausa: 150 });
  await digitar("Ex.: notebook, licença de software, aluguel da sala.");
  await marcar({ titulo: "Seção e Ajuda", texto: "A Seção junta perguntas num bloco da página. A Ajuda aparece embaixo da pergunta, para quem preenche.", foco: editor.getByLabel("Ajuda").first(), margem: 60, segundos: 4.5 });
  await marcar({ titulo: "Quando a pergunta aparece", texto: "“Mostrar”: sempre, ou só quando outra pergunta tiver certa resposta — como o CNPJ que você viu.", foco: editor.getByText("Mostrar", { exact: true }).first().locator("xpath=.."), margem: 24, segundos: 4.5 });
  await clicar(editor.getByRole("button", { name: "Salvar" }), { pausa: 1100 });
  await marcar({ titulo: "Salvo", texto: "A página pública muda na hora: quem abrir o link já vê a ajuda nova.", foco: p.getByText("Formulário salvo.").first(), margem: 40, segundos: 3.5 });

  // 9 — Rever o guia
  await p.goto(`${WEB}/estrutura/listas/lst_solicitacoes_de_pagamento`, { waitUntil: "networkidle" });
  await esperar(700);
  await clicar(menuDaLista(), { pausa: 500 });
  await marcar({ titulo: "Para rever este vídeo", texto: "Menu ⋯ de qualquer Lista do Financeiro › Guia do Financeiro.", foco: p.getByRole("menuitem", { name: /Guia do Financeiro/ }), margem: 40, segundos: 4 });
  await p.keyboard.press("Escape");
  await esperar(800);
} finally {
  roteiro.duracao = agora();
  await cdp.send("Page.stopScreencast").catch(() => {});
  writeFileSync(join(SAIDA, "roteiro.json"), JSON.stringify(roteiro));
  console.log(`gravado: ${roteiro.duracao.toFixed(1)} s · ${roteiro.quadros.length} quadros · ${roteiro.marcas.length} marcas`);
  await navegador.close();
}
