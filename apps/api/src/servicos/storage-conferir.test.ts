/** PIPE-07 — o conferidor do bucket, com cliente falso: cada veredito tem o seu motivo. */
import { describe, expect, it } from "vitest";
import { conferirStorage, type ClienteDeStorageParaConferir } from "./storage-conferir";

const ENV = { SUPABASE_URL: "https://x.supabase.co", SUPABASE_SECRET_KEY: "sb_secret_x", SUPABASE_STORAGE_BUCKET: "solicitacoes" };

function cliente(opcoes: { readonly existe?: boolean; readonly publico?: boolean; readonly assina?: boolean } = {}): () => ClienteDeStorageParaConferir {
  const { existe = true, publico = false, assina = true } = opcoes;
  return () => ({
    getBucket: async (nome) => (existe ? { data: { name: nome, public: publico }, error: null } : { data: null, error: { message: "Bucket not found" } }),
    from: () => ({ createSignedUploadUrl: async () => (assina ? { data: { signedUrl: "nunca-impressa" }, error: null } : { data: null, error: { message: "new row violates row-level security policy" } }) }),
  });
}

describe("conferirStorage", () => {
  it("confere quando as três variáveis existem, o bucket é privado e a credencial assina", async () => {
    const r = await conferirStorage(ENV, cliente());
    expect(r.ok).toBe(true);
    expect(r.linhas.join("\n")).not.toContain("nunca-impressa");
    expect(r.linhas.join("\n")).not.toContain("sb_secret");
  });

  it("diz qual variável falta, sem tocar o cliente", async () => {
    const r = await conferirStorage({ SUPABASE_URL: "https://x.supabase.co" }, () => {
      throw new Error("não devia chamar");
    });
    expect(r.ok).toBe(false);
    expect(r.linhas[0]).toContain("SUPABASE_SECRET_KEY, SUPABASE_STORAGE_BUCKET");
  });

  it("bucket inexistente, bucket público e credencial que não assina reprovam com o motivo", async () => {
    expect((await conferirStorage(ENV, cliente({ existe: false }))).linhas.at(-1)).toContain("não encontrado");
    expect((await conferirStorage(ENV, cliente({ publico: true }))).linhas.at(-1)).toContain("PÚBLICO");
    expect((await conferirStorage(ENV, cliente({ assina: false }))).linhas.at(-1)).toContain("não consegue assinar");
    expect((await conferirStorage(ENV, cliente({ assina: false }))).ok).toBe(false);
  });
});
