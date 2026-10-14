/**
 * PIPE-07 — "o bucket está configurado neste ambiente?" respondido por um
 * comando, sem subir arquivo de verdade: as três variáveis que o Storage lê
 * (`SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_STORAGE_BUCKET` — a mesma
 * secret key do hook de autenticação; não existe uma quarta chave), o bucket
 * existe e é PRIVADO (D-04: download só por URL assinada), e a credencial
 * consegue emitir um ticket assinado de envio para um caminho de sonda que
 * nunca recebe bytes (emitir a URL não cria objeto). É o que `emitirTicket`
 * faz na primeira fase do envio real, sem a segunda fase.
 *
 * Nunca imprime URL, chave ou ticket — só nome do bucket e veredito.
 */

export interface ClienteDeStorageParaConferir {
  getBucket(nome: string): Promise<{ data: { name: string; public: boolean } | null; error: { message: string } | null }>;
  from(nome: string): {
    createSignedUploadUrl(caminho: string): Promise<{ data: unknown; error: { message: string } | null }>;
  };
}

export interface RelatorioDoStorage {
  readonly ok: boolean;
  readonly bucket?: string;
  readonly linhas: readonly string[];
}

export async function conferirStorage(
  env: Readonly<Record<string, string | undefined>>,
  cliente: () => ClienteDeStorageParaConferir,
  sonda: string = `sondas/conferir-${Date.now()}.txt`,
): Promise<RelatorioDoStorage> {
  const linhas: string[] = [];
  const faltando = (["SUPABASE_URL", "SUPABASE_SECRET_KEY", "SUPABASE_STORAGE_BUCKET"] as const).filter((nome) => !env[nome]);
  if (faltando.length > 0) {
    linhas.push(`falta no ambiente: ${faltando.join(", ")}`);
    return { ok: false, linhas };
  }
  const bucket = env.SUPABASE_STORAGE_BUCKET!;
  linhas.push(`variáveis: SUPABASE_URL, SUPABASE_SECRET_KEY e SUPABASE_STORAGE_BUCKET presentes`);

  let storage: ClienteDeStorageParaConferir;
  try {
    storage = cliente();
  } catch (erro) {
    linhas.push(`cliente do Supabase não sobe: ${erro instanceof Error ? erro.message : String(erro)}`);
    return { ok: false, bucket, linhas };
  }

  const info = await storage.getBucket(bucket);
  if (info.error || !info.data) {
    linhas.push(`bucket "${bucket}": não encontrado ou sem acesso (${info.error?.message ?? "sem dados"})`);
    return { ok: false, bucket, linhas };
  }
  if (info.data.public) {
    linhas.push(`bucket "${bucket}": existe, mas é PÚBLICO — D-04 exige privado (download só por URL assinada)`);
    return { ok: false, bucket, linhas };
  }
  linhas.push(`bucket "${bucket}": existe e é privado`);

  const ticket = await storage.from(bucket).createSignedUploadUrl(sonda);
  if (ticket.error) {
    linhas.push(`ticket de envio: a credencial não consegue assinar um envio (${ticket.error.message})`);
    return { ok: false, bucket, linhas };
  }
  linhas.push("ticket de envio: a credencial assina um envio (nenhum byte foi enviado)");
  return { ok: true, bucket, linhas };
}
