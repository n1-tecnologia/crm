/**
 * O cliente HTTP das três rotas públicas do Formulário (Plan 02-16,
 * `apps/api/src/rotas/formularios-publicos.ts`) — o único transporte que
 * `/f/<segredo>` usa a partir deste plano. Sem `Authorization`: quem
 * responde não é Membro, e as rotas do outro lado nascem isentas do hook de
 * autenticação pela mesma marca de config que `GET /saude` usa.
 *
 * `NEXT_PUBLIC_API_URL` é a MESMA variável que `apps/web/src/dados/transporte.ts`
 * já usa (`transporteHttp`, injetada por `sessao-provider.tsx`) — nenhuma
 * outra base URL nasce aqui. `obterFormulario` roda tanto no Server Component
 * de `f/[segredo]/page.tsx` quanto, em teoria, no navegador: como só lê a
 * variável pública, os dois ambientes resolvem para o mesmo valor sem
 * precisar de injeção. Nenhum segredo de servidor, service role ou chave de
 * Storage entra neste módulo — ele fala com o Fastify como o navegador
 * falaria, mesmo quando quem chama é o Server Component.
 */

export type TipoDePergunta =
  | "text"
  | "longText"
  | "number"
  | "currency"
  | "percent"
  | "date"
  | "dateTime"
  | "singleSelect"
  | "multiSelect"
  | "checkbox"
  | "person"
  | "phone"
  | "email"
  | "url"
  | "file"
  | "rating"
  | "relation"
  | "formula";

/** Espelha `paraPerguntaPublica` (`apps/api/src/rotas/formularios-publicos.ts`) — nunca ids de Definição, opções invisíveis ou config da Lista. */
export interface PerguntaPublica {
  readonly id: string;
  readonly label: string;
  readonly required: boolean;
  readonly kind: TipoDePergunta;
  readonly help?: string;
  readonly options?: readonly string[];
  readonly accept?: readonly string[];
  /** Checklist 1.2 — o nome da seção; perguntas seguidas com a mesma seção formam um bloco. */
  readonly section?: string;
  /** Checklist 1.3 — só aparece (e só é obrigatória) quando a pergunta `questionId` tem um destes valores. */
  readonly showWhen?: { readonly questionId: string; readonly values: readonly string[] };
  /** Checklist 1.3 — a máscara de apresentação, que vem do Campo (não do rótulo). */
  readonly mask?: "cpf" | "cnpj" | "telefone";
}

/** Espelha `paraDtoPublico` — o DTO sanitizado que atravessa a fronteira servidor → Client Component. */
export interface FormularioPublicoDto {
  readonly formId: string;
  readonly title: string;
  readonly intro?: string;
  readonly questions: readonly PerguntaPublica[];
}

export type ResultadoDeFormulario =
  | { readonly tipo: "ok"; readonly formulario: FormularioPublicoDto }
  // 404 — segredo inexistente e Formulário pausado respondem exatamente igual (T-02-03): não distinguir aqui.
  | { readonly tipo: "indisponivel" }
  // 409 — checklist 1.5: o link existe, mas o Formulário precisa de revisão de quem o enviou.
  | { readonly tipo: "desatualizado"; readonly erro: string }
  | { readonly tipo: "falha"; readonly erro: string };

export interface PedidoDeTicket {
  readonly secret: string;
  /** Ausente na primeira pergunta de arquivo; presente para os anexos seguintes da mesma submissão. */
  readonly submissionId?: string;
  readonly displayName: string;
  readonly mediaType: string;
}

export type ResultadoDeTicket =
  | {
      readonly tipo: "ok";
      readonly submissionId: string;
      readonly objectId: string;
      readonly uploadUrl: string;
      readonly token: string;
      readonly expiresAt: string;
    }
  | { readonly tipo: "indisponivel" }
  | { readonly tipo: "falha"; readonly erro: string };

export interface AnexoDeSubmissao {
  readonly questionId: string;
  readonly objectId: string;
}

export interface PedidoDeSubmissao {
  readonly secret: string;
  /** A MESMA chave em todo retry — quem chama nunca gera uma nova por tentativa. */
  readonly submissionId: string;
  readonly answers: Readonly<Record<string, string>>;
  readonly attachments?: readonly AnexoDeSubmissao[];
}

export type ResultadoDeSubmissao =
  | { readonly tipo: "ok"; readonly readableId: string }
  | { readonly tipo: "indisponivel" }
  // 400 — o próprio schema ou `submitForm` recusou; `field` aponta a pergunta quando o domínio soube qual foi.
  | { readonly tipo: "recusado"; readonly erro: string; readonly field?: string }
  // 409 — sessão de envio consumida/expirada (`retryable: false`) ou conflito de revisão (`retryable: true`).
  | { readonly tipo: "conflito"; readonly erro: string; readonly retryable: boolean }
  // Rede, 429, 5xx — falha de transporte, não recusa de domínio.
  | { readonly tipo: "falha"; readonly erro: string };

/** A frase do `apps/api` para o Formulário desatualizado (checklist 1.5), se o corpo não vier. */
export const COPY_DESATUALIZADO = "Este Formulário está desatualizado: peça a quem o enviou para revisá-lo.";

function apiUrlOuFalha(): string | undefined {
  return process.env.NEXT_PUBLIC_API_URL;
}

async function corpoDeErro(resposta: Response): Promise<string | undefined> {
  try {
    const corpo = (await resposta.json()) as { readonly error?: string };
    return corpo.error;
  } catch {
    return undefined;
  }
}

async function obterFormulario(secret: string): Promise<ResultadoDeFormulario> {
  const apiUrl = apiUrlOuFalha();
  if (!apiUrl) return { tipo: "falha", erro: "NEXT_PUBLIC_API_URL não definida." };

  let resposta: Response;
  try {
    resposta = await fetch(`${apiUrl}/v1/public/forms/${encodeURIComponent(secret)}`, { cache: "no-store" });
  } catch {
    return { tipo: "falha", erro: "Sem conexão com o servidor." };
  }

  if (resposta.status === 404) return { tipo: "indisponivel" };
  if (resposta.status === 409) return { tipo: "desatualizado", erro: (await corpoDeErro(resposta)) ?? COPY_DESATUALIZADO };
  if (!resposta.ok) return { tipo: "falha", erro: (await corpoDeErro(resposta)) ?? "O servidor não respondeu." };

  const formulario = (await resposta.json()) as FormularioPublicoDto;
  return { tipo: "ok", formulario };
}

async function pedirTicket(pedido: PedidoDeTicket): Promise<ResultadoDeTicket> {
  const apiUrl = apiUrlOuFalha();
  if (!apiUrl) return { tipo: "falha", erro: "NEXT_PUBLIC_API_URL não definida." };

  let resposta: Response;
  try {
    resposta = await fetch(`${apiUrl}/v1/public/forms/${encodeURIComponent(pedido.secret)}/uploads`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...(pedido.submissionId ? { submissionId: pedido.submissionId } : {}),
        displayName: pedido.displayName,
        mediaType: pedido.mediaType,
      }),
    });
  } catch {
    return { tipo: "falha", erro: "Sem conexão com o servidor." };
  }

  if (resposta.status === 404) return { tipo: "indisponivel" };
  if (!resposta.ok) {
    return { tipo: "falha", erro: (await corpoDeErro(resposta)) ?? "Não foi possível preparar o envio deste arquivo." };
  }

  const corpo = (await resposta.json()) as {
    submissionId: string;
    objectId: string;
    uploadUrl: string;
    token: string;
    expiresAt: string;
  };
  return { tipo: "ok", ...corpo };
}

async function enviarSubmissao(pedido: PedidoDeSubmissao): Promise<ResultadoDeSubmissao> {
  const apiUrl = apiUrlOuFalha();
  if (!apiUrl) return { tipo: "falha", erro: "NEXT_PUBLIC_API_URL não definida." };

  let resposta: Response;
  try {
    resposta = await fetch(`${apiUrl}/v1/public/forms/${encodeURIComponent(pedido.secret)}/submissions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        submissionId: pedido.submissionId,
        answers: pedido.answers,
        ...(pedido.attachments && pedido.attachments.length > 0 ? { attachments: pedido.attachments } : {}),
      }),
    });
  } catch {
    return { tipo: "falha", erro: "Sem conexão com o servidor." };
  }

  if (resposta.status === 404) return { tipo: "indisponivel" };
  if (resposta.status === 400) {
    const corpo = (await resposta.json().catch(() => undefined)) as { readonly error?: string; readonly field?: string } | undefined;
    return { tipo: "recusado", erro: corpo?.error ?? "Entrada inválida para este envio.", ...(corpo?.field ? { field: corpo.field } : {}) };
  }
  if (resposta.status === 409) {
    const corpo = (await resposta.json().catch(() => undefined)) as { readonly error?: string; readonly retryable?: boolean } | undefined;
    return { tipo: "conflito", erro: corpo?.error ?? "Esta solicitação já foi enviada.", retryable: corpo?.retryable ?? false };
  }
  if (!resposta.ok) {
    return { tipo: "falha", erro: (await corpoDeErro(resposta)) ?? "O servidor não respondeu." };
  }

  const corpo = (await resposta.json()) as { readableId: string };
  return { tipo: "ok", readableId: corpo.readableId };
}

export const transportePublico = {
  obterFormulario,
  pedirTicket,
  enviarSubmissao,
};
