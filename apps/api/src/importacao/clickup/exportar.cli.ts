/**
 * `npm run exportar:clickup -w @n1/api [-- flags]`
 *
 * CLI fino, só composição (D-01): `carregarEnv()` → `criarClienteClickUp` →
 * `exportarClickUp` → `gerarManifesto` → `escreverManifesto`. Nenhuma regra
 * fica aqui — é o mesmo papel de `migrar.cli.ts`/`gestao.cli.ts`, com uma
 * diferença: este CLI nunca toca o Postgres (a exportação é I/O contra o
 * ClickUp e o filesystem, não o schema `plataforma`), então não há conexão
 * de banco para abrir nem encerrar.
 *
 * Flags (`--chave=valor` ou booleanas, sem biblioteca de parsing):
 *   --lista=<id>            repetível; default as 3 Listas de `LISTAS`
 *   --amostra=<n>            limiteDeTarefas; o manifesto sai com `amostra: true`
 *   --sem-anexos             anexos: "nenhuma"
 *   --sem-time-in-status     timeInStatus: "nao"
 *   --pasta=<dir>            pastaDestino; default apps/api/exportacoes/clickup/
 *   --so-manifesto           não exporta; só regenera MANIFESTO.* a partir do disco
 *
 * Orçamento de tempo (RESEARCH.md Pitfall 3): 100 requisições/minuto por
 * token. Só a Lista de Solicitação (901109104938) tem histórico de ~1.110
 * Tarefas — Comentários e `time_in_status` são POR Tarefa, não por Lista, o
 * que soma perto de 3.400 requisições e um orçamento real de 35-45 minutos.
 * Rode em segundo plano e acompanhe `exportacao.log`, na pasta de destino;
 * pode interromper a qualquer momento e rodar de novo — o próprio disco é o
 * checkpoint (Pitfall 4 de `exportar.ts`), então só o que falta é pedido de
 * novo, nunca duplicado.
 *
 * Ressalva de `time_in_status`: a API pública do ClickUp não expõe
 * histórico cronológico de status — só tempo acumulado por status, e só
 * quando o ClickApp "Total time in Status" está ligado no Workspace. Este
 * CLI grava o resultado do smoke test (disponível/indisponível) no
 * manifesto; nunca trata esse recurso como uma trilha de auditoria completa.
 *
 * Nunca imprime o token nem o corpo de uma Tarefa/Comentário — só ids,
 * caminhos e contagens (T-0-01).
 */

import { appendFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { criarClienteClickUp } from "./cliente";
import { exportarClickUp, type PoliticaDeAnexos, type ResultadoDaExportacao } from "./exportar";
import { escreverManifesto, gerarManifesto, type Manifesto } from "./manifesto";
import { carregarEnv } from "../../persistencia/conexao";

carregarEnv();

const argv = process.argv.slice(2);

function valoresDe(chave: string): readonly string[] {
  const prefixo = `--${chave}=`;
  return argv.filter((argumento) => argumento.startsWith(prefixo)).map((argumento) => argumento.slice(prefixo.length));
}

function valorDe(chave: string): string | undefined {
  return valoresDe(chave)[0];
}

function temFlag(chave: string): boolean {
  return argv.includes(`--${chave}`);
}

function commitAtual(): string {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "desconhecido";
  }
}

function formatarDuracao(ms: number): string {
  const totalDeSegundos = Math.max(0, Math.round(ms / 1000));
  const minutos = Math.floor(totalDeSegundos / 60);
  const segundos = totalDeSegundos % 60;
  return `${String(minutos).padStart(2, "0")}:${String(segundos).padStart(2, "0")}`;
}

function linhaDeTimeInStatus(manifesto: Manifesto): string {
  if (manifesto.timeInStatusDisponivel === "nao-verificado") return "time_in_status: não verificado";
  if (manifesto.timeInStatusDisponivel === true) return "time_in_status: disponível";
  const aviso = manifesto.avisos.find((linha) => linha.includes("time_in_status"));
  return `time_in_status: indisponível${aviso !== undefined ? ` (${aviso})` : ""}`;
}

const pastaDestino = valorDe("pasta") ?? fileURLToPath(new URL("../../../exportacoes/clickup/", import.meta.url));
const pastaDeSaidaDoManifesto = fileURLToPath(new URL("../../../exportacoes/", import.meta.url));
const soManifesto = temFlag("so-manifesto");
const commit = commitAtual();

let resultado: ResultadoDaExportacao | undefined;

if (!soManifesto) {
  const token = process.env.CLICKUP_API_TOKEN;
  if (token === undefined || token.length === 0) {
    console.error("CLICKUP_API_TOKEN ausente em apps/api/.env — ver apps/api/.env.example");
    process.exit(1);
  }

  mkdirSync(pastaDestino, { recursive: true });
  const caminhoDoLog = path.join(pastaDestino, "exportacao.log");
  function log(linha: string): void {
    const linhaComCarimbo = `[${new Date().toISOString()}] ${linha}`;
    console.log(linhaComCarimbo);
    appendFileSync(caminhoDoLog, `${linhaComCarimbo}\n`, "utf8");
  }

  const cliente = criarClienteClickUp({ token });
  const listas = valoresDe("lista");
  const amostra = valorDe("amostra");
  const anexos: PoliticaDeAnexos | undefined = temFlag("sem-anexos") ? "nenhuma" : undefined;
  const timeInStatus: "auto" | "nao" | undefined = temFlag("sem-time-in-status") ? "nao" : undefined;

  resultado = await exportarClickUp({
    cliente,
    pastaDestino,
    listas: listas.length > 0 ? listas : undefined,
    anexos,
    timeInStatus,
    limiteDeTarefas: amostra !== undefined ? Number(amostra) : undefined,
    log,
  });
}

const manifesto = await gerarManifesto({
  pastaExportada: pastaDestino,
  exportadoEm: new Date().toISOString(),
  commit,
});
const { json, md } = await escreverManifesto(manifesto, pastaDeSaidaDoManifesto);

for (const lista of manifesto.listas) {
  console.log(
    `lista ${lista.listId}  tarefas ${lista.tarefas} (+${lista.tarefasArquivadas} arquivadas) · comentários ${lista.comentarios} · anexos ${lista.anexosBaixados}/${lista.anexos} · time_in_status ${lista.timeInStatus}`,
  );
}
console.log(linhaDeTimeInStatus(manifesto));
console.log(`avisos: ${manifesto.avisos.length}`);
if (resultado !== undefined) {
  console.log(`requisições: ${resultado.requisicoes}`);
  console.log(`duração: ${formatarDuracao(new Date(resultado.concluidaEm).getTime() - new Date(resultado.iniciadaEm).getTime())}`);
}
console.log(`manifesto: ${md} e ${json}`);
if (manifesto.amostra) {
  console.log("AMOSTRA — este manifesto não é prova de paridade");
}
