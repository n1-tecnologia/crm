/**
 * `npm run credencial -w @n1/api -- <subcomando> [flags]`
 *
 * CLI fino de emissão/rotação/revogação de credenciais de serviço
 * (`plataforma.service_credentials`, D-15/D-20) — a identidade que o
 * `automation/` usa em `/v1/integrations/*`. Só compõe
 * `persistencia/credenciais-de-servico.ts`; nenhuma regra mora aqui.
 *
 * Subcomandos:
 *   emitir --nome=<n> --escopos=<a,b,c>   cria uma credencial nova, 'ativa'
 *   rotacionar --id=<id>                  emite a substituta, marca <id> 'rotacionando'
 *   revogar --id=<id>                     corte imediato — 'revogada' não reabre
 *
 * Disciplina de saída: o segredo aparece uma ÚNICA VEZ, na saída de `emitir`
 * e de `rotacionar` — nenhum outro comando imprime nada além de `id`,
 * `nome`, `scopes`, `state` e datas. Nunca logar `Authorization` nem o
 * segredo em nenhum outro ponto.
 */

import { carregarEnv, encerrar } from "../persistencia/conexao";
import {
  credencialPorId,
  emitirCredencial,
  marcarComoRotacionando,
  revogarCredencial,
  type CredencialResumida,
} from "../persistencia/credenciais-de-servico";

const PRAZO_DE_GRACA_SUGERIDO_DIAS = 7;

carregarEnv();
const workspaceId = process.env.WORKSPACE_ID ?? "ws_n1";

const argv = process.argv.slice(2);
const subcomando = argv[0];

function valorDe(chave: string): string | undefined {
  const prefixo = `--${chave}=`;
  const achado = argv.find((argumento) => argumento.startsWith(prefixo));
  return achado?.slice(prefixo.length);
}

function falharComUso(mensagem: string): never {
  console.error(mensagem);
  throw new SairComCodigo(1);
}

/** Sinaliza saída não-zero sem chamar `process.exit` direto — permite `encerrar()` sempre rodar antes. */
class SairComCodigo extends Error {
  constructor(readonly codigo: number) {
    super(`saída ${codigo}`);
  }
}

function imprimirSegredoUmaVez(id: string, segredo: string): void {
  console.log(`id           ${id}`);
  console.log(`segredo      ${segredo}`);
  console.log("\nEste segredo não será mostrado de novo — copie agora. O apps/api guarda só o hash dele.");
}

function imprimirResumo(linha: CredencialResumida): void {
  console.log(`id           ${linha.id}`);
  console.log(`nome         ${linha.nome}`);
  console.log(`scopes       ${linha.scopes.join(", ")}`);
  console.log(`state        ${linha.state}`);
  console.log(`created_at   ${linha.createdAt}`);
  console.log(`last_used_at ${linha.lastUsedAt ?? "—"}`);
  console.log(`revoked_at   ${linha.revokedAt ?? "—"}`);
}

async function rodarEmitir(): Promise<void> {
  const nome = valorDe("nome");
  const escoposCsv = valorDe("escopos");
  if (!nome || !escoposCsv) {
    falharComUso("uso: npm run credencial -w @n1/api -- emitir --nome=<n> --escopos=<a,b,c>");
  }
  const scopes = escoposCsv
    .split(",")
    .map((escopo) => escopo.trim())
    .filter(Boolean);
  if (scopes.length === 0) falharComUso("--escopos precisa de ao menos um escopo, separado por vírgula");

  const { id, segredo } = await emitirCredencial({ workspaceId, nome, scopes });
  imprimirSegredoUmaVez(id, segredo);
}

async function rodarRotacionar(): Promise<void> {
  const id = valorDe("id");
  if (!id) falharComUso("uso: npm run credencial -w @n1/api -- rotacionar --id=<id>");

  const antiga = await credencialPorId(id);
  if (!antiga) falharComUso(`credencial ${id} não encontrada`);
  if (antiga.state === "revogada") falharComUso(`credencial ${id} já está revogada — emita uma nova com "emitir"`);

  const { id: novoId, segredo } = await emitirCredencial({ workspaceId, nome: antiga.nome, scopes: antiga.scopes });
  await marcarComoRotacionando(id);
  imprimirSegredoUmaVez(novoId, segredo);
  console.log(
    `\nA credencial antiga (${id}) está em 'rotacionando' — revogue-a (` +
      `npm run credencial -w @n1/api -- revogar --id=${id}) em até ${PRAZO_DE_GRACA_SUGERIDO_DIAS} dias, ` +
      `quando todos os chamadores estiverem usando ${novoId}.`,
  );
}

async function rodarRevogar(): Promise<void> {
  const id = valorDe("id");
  if (!id) falharComUso("uso: npm run credencial -w @n1/api -- revogar --id=<id>");

  const antes = await credencialPorId(id);
  if (!antes) falharComUso(`credencial ${id} não encontrada`);

  await revogarCredencial(id);
  const depois = await credencialPorId(id);
  if (depois) imprimirResumo(depois);
  console.log(`\ncredencial ${id} revogada.`);
}

try {
  if (subcomando === "emitir") await rodarEmitir();
  else if (subcomando === "rotacionar") await rodarRotacionar();
  else if (subcomando === "revogar") await rodarRevogar();
  else falharComUso("uso: npm run credencial -w @n1/api -- <emitir|rotacionar|revogar> [flags]");
} catch (erro) {
  if (erro instanceof SairComCodigo) {
    await encerrar();
    process.exit(erro.codigo);
  }
  console.error(erro instanceof Error ? erro.message : String(erro));
  await encerrar();
  process.exit(1);
}

await encerrar();
