// Gera TAREFAS-POR-SESSAO.md e os dados de cronograma.html a partir de dados/index.mjs (que junta dados/parte-*.mjs).
// Uso, da raiz: node docs/09-planejamento/gerar.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SESSOES } from "./dados/index.mjs";

const aqui = dirname(fileURLToPath(import.meta.url));

const CAMADA = { dom: "domínio", banco: "banco", api: "api", web: "web", infra: "infra", dec: "decisão", voce: "você" };
const PESO = { produto: "*muda o produto*", arrumacao: "*arrumação: pode seguir a recomendação*" };

const porId = Object.fromEntries(SESSOES.map((s) => [s.id, s]));
const nomeSessao = (s) => (s.trilha ? s.n : `Sessão ${s.id}`);
const camadas = (lista) => lista.map((c) => "`" + CAMADA[c] + "`").join(" ");

const dm = (iso) => iso.split("-").reverse().slice(0, 2).join("/");
const linha = (v) => (Array.isArray(v) ? v.join(" ") : v);
const passos = (rotulo, v) =>
  Array.isArray(v) && v.length > 1
    ? [`  - **${rotulo}:**`, ...v.map((x, i) => `    ${i + 1}. ${x}`)]
    : [`  - **${rotulo}:** ${linha(v)}`];
const vazio = (v) => !v || v === "—" || (Array.isArray(v) && !v.length);

function subtarefa(t, su, i) {
  const id = `${t.id}.${i + 1}`;
  const l = [];
  if (su.decisao && su.decidido) {
    l.push(`- [x] **${id} ${su.n}** ${camadas(su.cam)} · *decidida*`);
    l.push(`  - **Decidido:** ${su.decidido}`);
    if (!vazio(su.muda)) l.push(`  - **O que muda no plano:** ${su.muda}`);
    if (!vazio(su.atencao)) l.push(`  - **Ponto de atenção:** ${su.atencao}`);
  } else if (su.decisao) {
    l.push(`- [ ] **${id} ${su.n}** ${camadas(su.cam)} · ${PESO[su.peso]}`);
    if (su.prazo) l.push(`  - **Prazo:** decidir até ${dm(su.prazo)}${su.bloqueia ? ` · destrava a Sessão ${su.bloqueia}` : ""}`);
    if (!vazio(su.ver)) l.push(`  - **Para ver na tela:** ${linha(su.ver)}`);
    if (!vazio(su.hoje)) l.push(...passos("Como é hoje", su.hoje));
    if (!vazio(su.pesquisar)) l.push(...passos("O que pesquisar", su.pesquisar));
    l.push("  - **Você decide:**");
    su.opcoes.forEach((o) => l.push(`    - ${o}`));
    l.push(`  - **O que muda depois:** ${su.muda}`);
    l.push(`  - **Recomendo:** ${su.recomendo}`);
    if (!vazio(su.tecnico)) l.push(`  - **Detalhe técnico:** ${su.tecnico}`);
  } else {
    l.push(`- [ ] **${id} ${su.n}**${su.cam.length ? " " + camadas(su.cam) : ""}`);
    if (su.prazo) l.push(`  - **Prazo:** até ${dm(su.prazo)}${su.bloqueia ? ` · destrava a Sessão ${su.bloqueia}` : ""}`);
    if (!vazio(su.hoje)) l.push(...passos("Hoje", su.hoje));
    l.push(...passos("O que fazer", su.fazer));
    l.push(`  - **Pronto quando:** ${su.pronto}`);
    if (su.nota) l.push(`  - **Atenção:** ${su.nota}`);
  }
  return l.join("\n");
}

function sessao(s) {
  const l = [];
  l.push(s.trilha ? `## ${s.n}${s.realizada ? " (realizada)" : ""}` : `## Sessão ${s.id} · ${s.n}`, "");
  l.push(s.desc, "");
  const deps = s.dep.map((x) => nomeSessao(porId[x]));
  if (s.meta) deps.push("aprovação da Meta");
  if (deps.length) l.push(`**Depende de:** ${deps.join(", ")}.`, "");
  if (s.trilha) {
    const [a, m, d] = s.inicioFixo.split("-");
    const fim = s.fimFixo ? s.fimFixo.split("-").reverse().slice(0, 2).join("/") : null;
    l.push(s.realizada ? `**Realizada em ${d}/${m}/${a}.**` : fim ? `**De ${d}/${m} a ${fim}.** Cada item tem prazo. Quando decidir um item, mande a resposta: ela é registrada aqui e as sessões afetadas são ajustadas.` : `**Data sugerida: ${d}/${m}.** Pode ser qualquer dia antes da Sessão 11.`, "");
  }
  if (s.preparo) l.push("**Antes da reunião, abra:**", ...s.preparo.map((p) => `- ${p}`), "");
  if (s.bloqueio) l.push(`> **Bloqueada:** ${s.bloqueio}`, "");
  if (s.ajuste) l.push(`> **Ajuste sugerido:** ${s.ajuste}`, "");
  if (s.nota) l.push(`> **Atenção:** ${s.nota}`, "");
  l.push("**Ponto de partida:**", ...s.partida.map((p) => `- ${p}`), "");
  if (s.vocab) {
    l.push("**O vocabulário.** Pense num funcionário novo na empresa:", "");
    l.push("| Peça | O que é | Exemplo no CRM N1 |", "|---|---|---|");
    s.vocab.forEach(([n, o, e]) => l.push(`| **${n}** | ${o} | ${e} |`));
    l.push("");
  }
  s.tarefas.forEach((t) => {
    l.push(`### ${t.id} ${t.n}`, "");
    if (t.tempo) l.push(`**Tempo:** ${t.tempo} min`, "");
    if (t.inicio && t.prazo) l.push(`**Período:** ${dm(t.inicio)} a ${dm(t.prazo)}`, "");
    l.push(`**Objetivo:** ${t.objetivo}`, "");
    l.push(`**Pronto quando:** ${t.pronto}`, "");
    if (!t.subs.length) l.push("_Nenhuma subtarefa ainda._", "");
    else l.push(t.subs.map((su, i) => subtarefa(t, su, i)).join("\n"), "");
  });
  l.push(`**A sessão fica pronta quando:** ${s.pronto}`, "", "---", "");
  return l.join("\n");
}


// Datas: dias úteis a partir de 19/10/2026, sem os feriados nacionais (a mesma conta do cronograma).
const FERIADOS = new Set(["2026-11-02", "2026-11-20", "2026-12-25", "2027-01-01"]);
const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
function fimDoPlano(modo) {
  let d = new Date(Date.UTC(2026, 9, 19)), fim = d;
  for (const s of SESSOES.filter((x) => !x.trilha)) {
    let k = 0;
    while (k < s.dias[modo]) {
      const iso = d.toISOString().slice(0, 10), w = d.getUTCDay();
      if (w !== 0 && w !== 6 && !FERIADOS.has(iso)) { k++; fim = d; }
      d = new Date(d.getTime() + 864e5);
    }
  }
  const dd = String(fim.getUTCDate()).padStart(2, "0"), mm = String(fim.getUTCMonth() + 1).padStart(2, "0");
  return `${SEMANA[fim.getUTCDay()]} ${dd}/${mm}/${fim.getUTCFullYear()}`;
}
function ajustes() {
  const seq = SESSOES.filter((x) => !x.trilha);
  const total = (m) => seq.reduce((a, s) => a + s.dias[m], 0);
  const linhas = seq.filter((s) => s.dias[0] !== s.dias[1]).map((s) => `| ${s.id} · ${s.n} | ${s.dias[0]} | **${s.dias[1]}** | ${s.ajuste || ""} |`);
  return [
    "## Prazos: plano e com ajustes",
    "",
    `O **plano** usa a velocidade medida nas Fases 06 a 08 do GSD: ${total(0)} dias úteis, com fim em **${fimDoPlano(0)}**.`,
    "",
    `O cenário **com ajustes** usa o tamanho que a conferência no código encontrou em cada sessão: ${total(1)} dias úteis, com fim em **${fimDoPlano(1)}**. É uma estimativa de escopo, mais pessimista que a velocidade do GSD. O número real deve ficar entre os dois; vale reestimar depois das Sessões 0 e 1, com a velocidade medida nelas.`,
    "",
    "| Sessão | Plano | Com ajustes | Por quê |",
    "|---|---|---|---|",
    ...linhas,
    "",
    "O cronograma em HTML mostra os dois cenários no botão **Plano / Com ajustes**."
  ].join("\n");
}

const cabecalho = `# Tarefas por sessão

Desdobramento do [PLANO-DE-IMPLEMENTACAO.md](PLANO-DE-IMPLEMENTACAO.md) em tarefas e subtarefas, conferido contra o código em 18/10/2026.

> Este arquivo é gerado. Para mudar uma tarefa, edite o \`dados/parte-*.mjs\` da sessão e rode \`node docs/09-planejamento/gerar.mjs\`. O mesmo comando atualiza o \`cronograma.html\`.

**Como ler cada item:**
- **Tarefa:** o objetivo e quando ela fica pronta.
- **Subtarefa de fazer:** o que fazer, como está hoje e como saber que ficou pronta.
- **Subtarefa de decisão:** como está hoje, o que você decide, o que muda depois de cada resposta e a minha recomendação. Cada decisão diz se **muda o produto** (precisa da sua resposta) ou é **arrumação** (pode seguir a recomendação).

Este documento é a entrada do \`/gsd-discuss-phase\` de cada sessão. Os planos detalhados (arquivos, ondas e testes) são do GSD, no \`/gsd-plan-phase\`, e não ficam aqui.

**Camadas:** \`domínio\` = \`packages/dominio\` · \`banco\` = migração em \`apps/api/migracoes\` · \`api\` = \`apps/api\` · \`web\` = \`apps/web\` · \`infra\` = servidor, ambiente e serviços · \`decisão\` = precisa de você antes de seguir · \`você\` = ação sua fora do código

---

${ajustes()}

---

`;

writeFileSync(join(aqui, "TAREFAS-POR-SESSAO.md"), cabecalho + SESSOES.map(sessao).join("\n").trimEnd() + "\n");

const html = join(aqui, "cronograma.html");
const atual = readFileSync(html, "utf8");
const marca = /\/\*DADOS:INICIO\*\/[\s\S]*?\/\*DADOS:FIM\*\//;
if (!marca.test(atual)) throw new Error("cronograma.html sem as marcas /*DADOS:INICIO*/ e /*DADOS:FIM*/");
const json = JSON.stringify(SESSOES).replace(/</g, "\\u003c");
writeFileSync(html, atual.replace(marca, () => "/*DADOS:INICIO*/" + json + "/*DADOS:FIM*/"));

// Tabela de datas do PLANO-DE-IMPLEMENTACAO.md, entre as marcas TABELA:INICIO e TABELA:FIM.
function datasDoPlano(modo) {
  const util = (d) => { const w = d.getUTCDay(); return w !== 0 && w !== 6 && !FERIADOS.has(d.toISOString().slice(0, 10)); };
  const fmt = (d) => `${SEMANA[d.getUTCDay()]} ${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  let cur = new Date(Date.UTC(2026, 9, 19));
  const linhas = [];
  for (const s of SESSOES) {
    let dias = [], d;
    if (s.trilha) {
      d = new Date(s.inicioFixo + "T00:00:00Z");
      const ate = s.fimFixo ? new Date(s.fimFixo + "T00:00:00Z") : null;
      while (ate ? d <= ate : dias.length < (s.duracao || 1)) { if (util(d)) dias.push(d); d = new Date(d.getTime() + 864e5); }
    } else {
      d = cur;
      while (dias.length < s.dias[modo]) { if (util(d)) dias.push(d); d = new Date(d.getTime() + 864e5); }
      cur = new Date(dias[dias.length - 1].getTime() + 864e5);
    }
    const dep = s.dep.map((x) => SESSOES.find((y) => y.id === x)?.sigla || x);
    if (s.meta) dep.push("aprovação Meta");
    linhas.push(s.trilha
      ? `| ${s.sigla || "—"} | *${s.n}${s.realizada ? " (realizada)" : ""}* | — | ${fmt(dias[0])} | ${fmt(dias[dias.length - 1])} | — |`
      : `| ${s.id} | ${s.n} | ${s.dias[modo]} | ${fmt(dias[0])} | ${fmt(dias[dias.length - 1])} | ${dep.join(", ") || "—"} |`);
  }
  return linhas;
}
{
  const plano = join(aqui, "PLANO-DE-IMPLEMENTACAO.md");
  const txt = readFileSync(plano, "utf8");
  const seq = SESSOES.filter((x) => !x.trilha);
  const bloco = [
    "<!-- TABELA:INICIO -->",
    "| # | Sessão | Dias | Início | Fim | Depende de |",
    "|---|---|---|---|---|---|",
    ...datasDoPlano(0),
    "",
    `**Total: ${seq.reduce((a, s) => a + s.dias[0], 0)} dias úteis, com fim em ${fimDoPlano(0)}.** Com os ajustes que a conferência no código sugere, ${seq.reduce((a, s) => a + s.dias[1], 0)} dias úteis e fim em ${fimDoPlano(1)} (ver [TAREFAS-POR-SESSAO.md](TAREFAS-POR-SESSAO.md#prazos-plano-e-com-ajustes)). Esta tabela é gerada por \`gerar.mjs\`.`,
    "<!-- TABELA:FIM -->"
  ].join("\n");
  writeFileSync(plano, txt.replace(/<!-- TABELA:INICIO -->[\s\S]*?<!-- TABELA:FIM -->/, () => bloco));
}

const nSubs = SESSOES.reduce((a, s) => a + s.tarefas.reduce((b, t) => b + t.subs.length, 0), 0);
console.log(`Gerado: ${SESSOES.length} blocos, ${nSubs} subtarefas.`);
