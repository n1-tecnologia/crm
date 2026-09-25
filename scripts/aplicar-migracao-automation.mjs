// Aplica migrações do Supabase do `automation/` (repositório irmão financeiro-tria,
// projeto qewznpnmaqhqfyhncdnx) — arquivo por arquivo, na ordem dada, numa transação só.
//
// Uso (da raiz do crm-n1):
//   node scripts/aplicar-migracao-automation.mjs --conferir            só leitura: estado do schema
//   node scripts/aplicar-migracao-automation.mjs <a.sql> [<b.sql> ...]  ensaio: roda e faz ROLLBACK
//   node scripts/aplicar-migracao-automation.mjs --apply <a.sql> ...    roda e faz COMMIT
//
// A conexão vem de AUTOMATION_DATABASE_URL (../financeiro-tria/automation/.env ou apps/api/.env) e nunca é
// impressa. Recusa `20261001120000_remove_anon_read_painel.sql` (ponto de não retorno do
// corte do painel, D4-16) e qualquer arquivo fora de financeiro-tria/supabase/migrations.

import { readFileSync } from "node:fs";
import { basename, dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const IRMAO = resolve(RAIZ, "../financeiro-tria");
const PASTA_MIGRACOES = resolve(IRMAO, "supabase/migrations");
const ARQUIVOS_ENV = [resolve(IRMAO, "automation/.env"), resolve(RAIZ, "apps/api/.env")];
const REF_PROJETO = "qewznpnmaqhqfyhncdnx";
const PROIBIDAS = ["remove_anon_read_painel"];

const CONFERENCIA = `
select
  to_regclass('public.platform_adapter_commands')::text                  as m_120000_adapter_commands,
  to_regclass('public.solicitacoes_pagamentos_origem_task_id_key')::text as m_130000_indice_origem,
  exists (select 1 from information_schema.columns where table_schema='public'
          and table_name='solicitacoes_pagamentos' and column_name='origem')              as m_130000_coluna_origem,
  to_regclass('public.platform_event_receipts')::text                    as m_140000_receipts,
  exists (select 1 from information_schema.columns where table_schema='public'
          and table_name='automation_workflow_runs' and column_name='waiting_command_id') as m_140000_waiting_command,
  case when to_regclass('public.platform_event_receipts') is null then null else
    (select string_agg(conname || ': ' || pg_get_constraintdef(oid), ' | ' order by conname)
       from pg_constraint
      where conrelid = to_regclass('public.platform_event_receipts') and contype = 'c')
  end as checks_receipts;
`;

function falhar(mensagem) {
  console.error(`ERRO: ${mensagem}`);
  process.exit(1);
}

function lerUrl() {
  let linha;
  for (const arquivo of ARQUIVOS_ENV) {
    let texto;
    try {
      texto = readFileSync(arquivo, "utf8");
    } catch {
      continue;
    }
    // DATABASE_URL só serve se apontar para o mesmo projeto — a checagem de REF_PROJETO abaixo recusa o resto.
    for (const nome of ["AUTOMATION_DATABASE_URL", "DATABASE_URL"]) {
      linha = texto.split(/\r?\n/).find((l) => new RegExp(`^\\s*(export\\s+)?${nome}\\s*=`).test(l));
      if (linha) {
        console.log(`${nome} lida de ${arquivo}`);
        break;
      }
    }
    if (linha) break;
  }
  if (!linha) falhar(`AUTOMATION_DATABASE_URL/DATABASE_URL ausente em: ${ARQUIVOS_ENV.join(", ")}`);
  const url = linha.slice(linha.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
  if (!url.startsWith("postgres")) falhar("AUTOMATION_DATABASE_URL não parece uma URI postgres");
  if (!url.includes(REF_PROJETO)) falhar(`AUTOMATION_DATABASE_URL não aponta para o projeto ${REF_PROJETO}`);
  const u = new URL(url);
  const senha = decodeURIComponent(u.password);
  console.log(`  usuário ${decodeURIComponent(u.username)} @ ${u.host} · senha com ${senha.length} caracteres, começa com "${senha.slice(0, 1)}"`);
  return url;
}

function validarArquivo(caminho) {
  const absoluto = resolve(RAIZ, caminho);
  if (!absoluto.startsWith(PASTA_MIGRACOES + sep)) falhar(`fora de ${PASTA_MIGRACOES}: ${caminho}`);
  if (!absoluto.endsWith(".sql")) falhar(`não é .sql: ${caminho}`);
  if (PROIBIDAS.some((p) => basename(absoluto).includes(p))) falhar(`migração proibida por este script: ${basename(absoluto)}`);
  const sql = readFileSync(absoluto, "utf8");
  if (/^\s*(begin|commit|rollback)\s*;/im.test(sql)) falhar(`${basename(absoluto)} controla transação própria — não suportado`);
  return { nome: basename(absoluto), sql };
}

async function conferir(cliente) {
  const { rows } = await cliente.query(CONFERENCIA);
  for (const [coluna, valor] of Object.entries(rows[0])) console.log(`  ${coluna}: ${valor}`);
}

const args = process.argv.slice(2);
const aplicar = args.includes("--apply");
const soConferir = args.includes("--conferir");
const arquivos = args.filter((a) => !a.startsWith("--")).map(validarArquivo);
if (!soConferir && arquivos.length === 0) falhar("nenhum arquivo .sql informado (ou use --conferir)");

const cliente = new pg.Client({ connectionString: lerUrl(), ssl: { rejectUnauthorized: false } });
await cliente.connect();
console.log(`conectado ao projeto ${REF_PROJETO}`);

try {
  if (soConferir) {
    console.log("conferência (só leitura):");
    await conferir(cliente);
  } else {
    console.log(aplicar ? "modo: APPLY (commit ao final)" : "modo: ensaio (rollback ao final)");
    await cliente.query("begin");
    try {
      for (const { nome, sql } of arquivos) {
        await cliente.query(sql);
        console.log(`  ok  ${nome}`);
      }
      console.log("estado dentro da transação:");
      await conferir(cliente);
      await cliente.query(aplicar ? "commit" : "rollback");
      console.log(aplicar ? "COMMIT feito." : "ROLLBACK feito — nada foi gravado.");
    } catch (erro) {
      await cliente.query("rollback").catch(() => {});
      falhar(`${erro.message} — ROLLBACK feito, nada foi gravado.`);
    }
  }
} finally {
  await cliente.end();
}
