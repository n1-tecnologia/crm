/**
 * `npm run projetos:configurar -w @n1/api -- --membro=<id> [flags]`
 *
 * Cria o Espaço "Produto e Tecnologia" e o Processo de Projetos do manual
 * (`docs/07-processos/processo-de-projetos.md`). Reaplicar cria só o que falta; divergência
 * recusa, sem sobrescrever.
 *
 * Sem flag, roda em `--dry-run`: hidrata, calcula o diff, mostra e faz rollback.
 *
 * Flags (`--chave=valor` ou booleanas):
 *   --dry-run         padrão; não grava
 *   --apply           grava de verdade, dentro da Unidade de Trabalho
 *   --membro=<id>     OBRIGATÓRIO: quem assina na Atividade e ganha `administrar`
 *   --workspace=<id>  padrão WORKSPACE_ID do ambiente, ou "ws_n1"
 *   --clientes=<a;b>  opções do Campo Cliente, separadas por ";" (ajustáveis depois pela tela)
 *   --espaco=<id>     usa este Espaço existente, com o nome do manual, em vez de criar um
 *   --inspecionar     só lê: mostra os Espaços com o nome do manual (não exige --membro)
 *
 * Disciplina de saída: só contagens e ids. Código de saída 1 quando recusa.
 */

import { OPCAO_PROVISORIA_DE_CLIENTE } from "@n1/dominio/processo-de-projetos-evolver";
import { carregarEnv, encerrar } from "../persistencia/conexao";
import { configurarProcessoDeProjetos, inspecionarEspacoDoProcesso } from "./processo-de-projetos";

carregarEnv();

const argv = process.argv.slice(2);
const valorDe = (chave: string): string | undefined =>
  argv.find((a) => a.startsWith(`--${chave}=`))?.slice(chave.length + 3);

const workspaceId = valorDe("workspace") ?? process.env.WORKSPACE_ID ?? "ws_n1";
const dryRun = !argv.includes("--apply");
const clientes = valorDe("clientes")?.split(";");
const espacoExistenteId = valorDe("espaco");

/** Só host, porta e base: é para conferir o alvo antes do `--apply`, sem expor credencial. */
function bancoAlvo(): string {
  try {
    const url = new URL(process.env.DATABASE_URL ?? "");
    return `${url.hostname}${url.port ? `:${url.port}` : ""}${url.pathname}`;
  } catch {
    return "DATABASE_URL ausente ou inválida";
  }
}

if (argv.includes("--inspecionar")) {
  console.log("modo         inspeção (somente leitura)");
  console.log(`banco        ${bancoAlvo()}`);
  console.log(`workspace    ${workspaceId}`);
  const espacos = await inspecionarEspacoDoProcesso(workspaceId);
  if (espacos.length === 0) console.log("nenhum Espaço com o nome do manual");
  const linhaDaLista = (l: (typeof espacos)[number]["listasDiretas"][number]) =>
    `${l.id} "${l.nome}" · ${l.estado} · Status próprios: ${l.statusProprios} · Campos próprios: ${l.camposProprios} · Tarefas: ${l.tarefas} · Subtarefas: ${l.subtarefas}`;
  for (const e of espacos) {
    console.log(`\nEspaço       ${e.id} "${e.nome}"`);
    console.log(`  estado     ${e.estado} · privado: ${e.privado ? "sim" : "não"} · descrição: ${e.temDescricao ? "preenchida" : "vazia"}`);
    console.log(`  criado     ${e.criadoEm} por ${e.criadoPor}`);
    console.log(`  bloqueios  ${e.bloqueios.join(", ") || "nenhum"}`);
    console.log(`  concessões ${e.concessoes}`);
    console.log(`  Campos     ${e.campos.length}${e.campos.length > 0 ? `: ${e.campos.join("; ")}` : ""}`);
    for (const l of e.listasDiretas) console.log(`  Lista      ${linhaDaLista(l)}`);
    for (const p of e.pastas) {
      console.log(`  Pasta      ${p.id} "${p.nome}" · ${p.estado} · privada: ${p.privada ? "sim" : "não"} · Campos: ${p.campos}`);
      for (const l of p.listas) console.log(`    Lista    ${linhaDaLista(l)}`);
    }
  }
  await encerrar();
  process.exit(0);
}

const actingMemberId = valorDe("membro");
if (!actingMemberId) {
  console.error("recusado     informe --membro=<id>: é quem assina a configuração na Atividade.");
  process.exit(1);
}

console.log(`modo         ${dryRun ? "dry-run (nada gravado)" : "apply"}`);
console.log(`banco        ${bancoAlvo()}`);
console.log(`workspace    ${workspaceId}`);
console.log(`membro       ${actingMemberId}`);

const resultado = await configurarProcessoDeProjetos({
  workspaceId,
  actingMemberId,
  dryRun,
  ...(clientes ? { clientes } : {}),
  ...(espacoExistenteId ? { espacoExistenteId } : {}),
});
if (!resultado.ok) {
  console.error(`recusado     ${resultado.error}`);
  await encerrar();
  process.exit(1);
}

const porTipo = new Map<string, number>();
for (const id of resultado.diff.criados) {
  const tipo = id.split("_")[0] ?? id;
  porTipo.set(tipo, (porTipo.get(tipo) ?? 0) + 1);
}
const NOMES: Readonly<Record<string, string>> = {
  spc: "Espaço", fld: "Pasta", lst: "Listas", fd: "Campos", st: "Status", viw: "Visualizações", tpl: "Modelo de Tarefa", tt: "Tipo de Tarefa", grt: "Concessões",
};
console.log(`espaço       ${resultado.diff.espacoId}${resultado.diff.descricaoDoEspacoPreenchida ? " (descrição estava vazia: preenchida com a do manual)" : ""}`);
console.log(`criados      ${resultado.diff.criados.length}`);
for (const [tipo, n] of porTipo) console.log(`  ${(NOMES[tipo] ?? tipo).padEnd(18)} ${n}`);
for (const id of resultado.diff.criados.filter((c) => c.startsWith("grt_"))) console.log(`  concessão          ${id}`);
console.log(`conferidos   ${resultado.diff.conferidos.length}`);
console.log(`divergentes  ${resultado.diff.divergentes.length}`);
if (!clientes && resultado.diff.criados.includes("fd_pp_cliente")) {
  console.log(`aviso        Campo Cliente nasce com a opção provisória "${OPCAO_PROVISORIA_DE_CLIENTE}"; passe --clientes ou ajuste pela tela.`);
}

await encerrar();
