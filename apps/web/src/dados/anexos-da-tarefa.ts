/**
 * O anexo de verdade da Tarefa (checklist 7.3), do lado do navegador: pede o
 * ticket ao `apps/api`, sobe os bytes direto ao bucket e pede a confirmação —
 * só então o arquivo vira anexo da Tarefa ou valor do Campo de arquivo
 * (`apps/api/src/rotas/anexos-da-tarefa.ts`). E o download por URL assinada
 * nova, que todo anexo usa.
 */

import { clienteDoNavegador } from "@/autenticacao/cliente-navegador";
import { enviarBytesAoBucket, recusaDoArquivoNoNavegador } from "./envio-ao-bucket";

export interface DependenciasDoAnexo {
  readonly apiUrl: string | undefined;
  readonly token: () => Promise<string | undefined>;
  readonly fetch: typeof fetch;
  readonly enviarBytes: (uploadUrl: string, file: File, aoProgredir: (percentual: number) => void) => Promise<boolean>;
}

function dependenciasPadrao(): DependenciasDoAnexo {
  return {
    apiUrl: process.env.NEXT_PUBLIC_API_URL,
    token: async () => (await clienteDoNavegador().auth.getSession()).data.session?.access_token,
    fetch: (...args) => fetch(...args),
    enviarBytes: (uploadUrl, file, aoProgredir) => enviarBytesAoBucket(uploadUrl, file, aoProgredir),
  };
}

export type ResultadoDoEnvioDeArquivo = { readonly ok: true; readonly fileId: string } | { readonly ok: false; readonly erro: string };

type RespostaDoPost = { readonly ok: true; readonly corpo: unknown } | { readonly ok: false; readonly erro: string };

async function postar(deps: DependenciasDoAnexo, url: string, token: string, corpo: unknown): Promise<RespostaDoPost> {
  try {
    const resposta = await deps.fetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(corpo),
    });
    const json: unknown = await resposta.json().catch(() => ({}));
    if (!resposta.ok) {
      const erro = (json as { readonly error?: unknown }).error;
      return { ok: false, erro: typeof erro === "string" && erro ? erro : `O servidor respondeu ${resposta.status}.` };
    }
    return { ok: true, corpo: json };
  } catch {
    return { ok: false, erro: "Sem conexão com o servidor. Tente de novo." };
  }
}

/**
 * Envia um arquivo para a Tarefa: como anexo dela (sem `campoId`) ou como
 * valor do Campo de arquivo `campoId`. Devolve o id do Arquivo criado, ou a
 * frase do que deu errado — nunca lança.
 */
export async function enviarArquivoDaTarefa(
  taskId: string,
  file: File,
  opcoes: { readonly campoId?: string; readonly aoProgredir?: (percentual: number) => void } = {},
  deps: DependenciasDoAnexo = dependenciasPadrao(),
): Promise<ResultadoDoEnvioDeArquivo> {
  const recusa = recusaDoArquivoNoNavegador(file);
  if (recusa) return { ok: false, erro: recusa };
  if (!deps.apiUrl) return { ok: false, erro: "O servidor não está configurado nesta tela." };
  const token = await deps.token();
  if (!token) return { ok: false, erro: "Sua sessão expirou. Entre de novo." };

  const base = `${deps.apiUrl}/tarefas/${encodeURIComponent(taskId)}/anexos`;
  const destino = opcoes.campoId ? { campoId: opcoes.campoId } : {};

  const ticket = await postar(deps, `${base}/ticket`, token, { nome: file.name, mime: file.type, ...destino });
  if (!ticket.ok) return { ok: false, erro: ticket.erro };
  const { submissionId, objectId, uploadUrl } = ticket.corpo as { readonly submissionId?: string; readonly objectId?: string; readonly uploadUrl?: string };
  if (!submissionId || !objectId || !uploadUrl) return { ok: false, erro: "O servidor não preparou o envio deste arquivo." };

  const subiu = await deps.enviarBytes(uploadUrl, file, opcoes.aoProgredir ?? (() => {}));
  if (!subiu) return { ok: false, erro: "O arquivo não chegou ao armazenamento. Tente de novo." };

  const confirmacao = await postar(deps, `${base}/confirmar`, token, { submissionId, objectId, ...destino });
  if (!confirmacao.ok) return { ok: false, erro: confirmacao.erro };
  // A confirmação devolve o resultado da operação: uma recusa do domínio vem com 200 e `ok: false`.
  const resultado = confirmacao.corpo as { readonly ok?: boolean; readonly value?: { readonly fileId?: string }; readonly error?: string };
  if (resultado.ok !== true || !resultado.value?.fileId) return { ok: false, erro: resultado.error ?? "Não foi possível anexar o arquivo." };
  return { ok: true, fileId: resultado.value.fileId };
}

/**
 * Pede ao `apps/api` uma URL assinada nova para baixar o arquivo. Nunca lê
 * nem devolve outra coisa do corpo além da própria URL.
 */
export async function pedirUrlDeDownload(fileId: string, deps: DependenciasDoAnexo = dependenciasPadrao()): Promise<string | undefined> {
  if (!deps.apiUrl) return undefined;
  const token = await deps.token();
  if (!token) return undefined;
  try {
    const resposta = await deps.fetch(`${deps.apiUrl}/anexos/${encodeURIComponent(fileId)}/url`, { headers: { authorization: `Bearer ${token}` } });
    if (!resposta.ok) return undefined;
    const corpo = (await resposta.json()) as { readonly url?: string };
    return corpo.url;
  } catch {
    return undefined;
  }
}
