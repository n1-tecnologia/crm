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
 * navegador na tela).
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

const navegador = await chromium.launch({ headless: process.env.JORNADA_VISIVEL !== "1" });
const pagina = await navegador.newPage({ viewport: { width: 1600, height: 1000 } });
pagina.setDefaultTimeout(30_000);

/** Espera a gravação que o gesto provoca (`POST /operacoes/<nome>`) e confere que o servidor aceitou. */
async function gravando(nome, gesto) {
  const [resposta] = await Promise.all([
    pagina.waitForResponse((r) => r.request().method() === "POST" && r.url().includes(`/operacoes/${nome}`), { timeout: 45_000 }),
    gesto(),
  ]);
  if (resposta.status() !== 200) {
    throw new Error(`${nome}: o servidor respondeu ${resposta.status()} — ${(await resposta.text()).slice(0, 300)}`);
  }
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

async function comentar(texto, { mencionar = true } = {}) {
  const caixa = painel().getByRole("textbox", { name: "Novo comentário" });
  await caixa.click();
  await caixa.pressSequentially(texto, { delay: 5 });
  if (mencionar) {
    // A Menção como uma pessoa faz: "@", o começo do nome, e a escolha na lista.
    await caixa.pressSequentially(" @" + EMAIL.slice(0, 5), { delay: 30 });
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
 * Como `acaoDoRodape`, mas uma REGRA da Lista pode bloquear o gesto (ex.: só
 * certas pessoas movem para "pago"). Bloqueado, devolve o motivo que a tela
 * mostra no botão — é o resultado certo para quem não tem a permissão.
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
      ["Integração manual = Manual", () => escolher("Integração manual", "Manual")],
      ["Status → lançado omie", () => mudarStatus("lançado omie")],
      ["Comentário: lançado à mão", () => comentar("Lancei manualmente no Omie. Segue para remessa.", { mencionar: false })],
      ["Status → em remessa bancária", () => mudarStatus("em remessa bancária")],
      ["Status → em autorização bancária (A3: Responsável vira o Aprovador)", () => mudarStatus("em autorização bancária")],
      ["Comentário: enviado ao aprovador", () => comentar("Enviado para autorização do aprovador.", { mencionar: false })],
      ["Autorizar pagamento → aprovado", () => acaoDoRodape("Autorizar pagamento")],
      ["Comentário: autorizado", () => comentar("Pagamento autorizado. Pode pagar.", { mencionar: false })],
      [
        "Marcar como paga → pago (A2: sai do Financeiro), se a regra da Lista deixar",
        async () => {
          const bloqueio = await tentarAcaoDoRodape("Marcar como paga");
          if (bloqueio) {
            await comentar(`Autorizado. Não consigo marcar como paga: ${bloqueio}`, { mencionar: false });
            return `BLOQUEADO pela regra da Lista (resultado correto para este usuário): ${bloqueio}`;
          }
          await comentar("Pago. Comprovante arquivado.", { mencionar: false });
          return "pago";
        },
      ],
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
const so = new Set((process.env.JORNADA_SO ?? "").split(",").map((x) => x.trim()).filter(Boolean));
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

console.log(`Jornada do Financeiro como um humano — ${URL_BASE} — ${CARIMBO}`);
await entrar();

for (const c of CENARIOS) {
  if (so.size > 0 && !so.has(c.chave)) continue;
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
      const nota = await executar();
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
