/**
 * Publica `saida/financeiro.mp4` e `saida/financeiro.jpg` no bucket público
 * `guias` do Storage do Supabase — é de lá que o Guia do Financeiro toca o
 * vídeo. Cria o bucket (público, só mp4/jpg) se ainda não existir; sobrescreve
 * os arquivos. Escreve em PRODUÇÃO: quem roda é o dono.
 *
 *   SUPABASE_URL=… SUPABASE_SECRET_KEY=… node publicar-no-storage.mjs
 *
 * (Ou na VPS, onde o api.env já tem as duas — ver CONTEXT.md.)
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) throw new Error("Defina SUPABASE_URL e SUPABASE_SECRET_KEY.");
const BUCKET = "guias";
const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const { data: existente } = await supabase.storage.getBucket(BUCKET);
if (!existente) {
  const { error } = await supabase.storage.createBucket(BUCKET, { public: true, allowedMimeTypes: ["video/mp4", "image/jpeg"], fileSizeLimit: "50MB" });
  if (error) throw new Error(`criar o bucket: ${error.message}`);
}
for (const [nome, tipo] of [["financeiro.mp4", "video/mp4"], ["financeiro.jpg", "image/jpeg"]]) {
  const { error } = await supabase.storage.from(BUCKET).upload(nome, readFileSync(join(AQUI, "saida", nome)), { contentType: tipo, upsert: true, cacheControl: "3600" });
  if (error) throw new Error(`enviar ${nome}: ${error.message}`);
  console.log(supabase.storage.from(BUCKET).getPublicUrl(nome).data.publicUrl);
}
