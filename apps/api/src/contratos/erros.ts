/**
 * Envelope de erro do contrato v1 (§3 de
 * `docs/08-migracao-financeiro/04-contrato-plataforma-v1.md`) — o mesmo
 * formato nos dois sentidos (plataforma → `automation/` e `automation/` →
 * plataforma). Ver `./CONTEXT.md` para a regra da pasta.
 *
 * `message` é sempre a frase curta e sanitizada abaixo — nunca
 * `ZodError.message` cru nem detalhe de exceção interna (mesma disciplina
 * de `apps/api/src/rotas/operacoes.ts`, `mensagemDeEntradaInvalida`): o
 * detalhe completo vai a `request.log.warn`, nunca ao corpo da resposta.
 */

export const CODIGOS_DE_ERRO = {
  SCHEMA_INVALIDO: { status: 400, retryable: false, mensagem: "Entrada inválida para esta chamada." },
  CREDENCIAL_AUSENTE: { status: 401, retryable: false, mensagem: "Credencial de serviço ausente." },
  CREDENCIAL_INVALIDA: { status: 401, retryable: false, mensagem: "Credencial de serviço ausente ou inválida." },
  ESCOPO_INSUFICIENTE: { status: 403, retryable: false, mensagem: "Credencial sem escopo para esta operação." },
  ENTIDADE_NAO_ENCONTRADA: { status: 404, retryable: false, mensagem: "Recurso não encontrado." },
  CONFLITO_DE_ORDEM: { status: 409, retryable: false, mensagem: "Transição de Status inválida para o estado atual." },
  CONFLITO_DE_REVISAO: {
    status: 409,
    retryable: true,
    mensagem: "Outra alteração entrou antes desta. Tente de novo.",
  },
  IDEMPOTENCY_KEY_REUSED: {
    status: 409,
    retryable: false,
    mensagem: "Chave de idempotência já usada com um corpo diferente.",
  },
  REQUEST_IN_PROGRESS: { status: 409, retryable: true, mensagem: "Uma chamada com a mesma chave já está em curso." },
  REGRA_DE_DOMINIO: { status: 422, retryable: false, mensagem: "Recusado por regra de negócio." },
  LIMITE_EXCEDIDO: { status: 429, retryable: true, mensagem: "Limite de chamadas excedido." },
  ERRO_INTERNO: { status: 500, retryable: true, mensagem: "Erro interno do servidor." },
  INDISPONIVEL: { status: 503, retryable: true, mensagem: "Serviço temporariamente indisponível." },
} as const;

export type CodigoDeErroV1 = keyof typeof CODIGOS_DE_ERRO;

export interface EnvelopeDeErroV1 {
  readonly error: {
    readonly code: CodigoDeErroV1;
    readonly message: string;
    readonly requestId: string;
    readonly retryable: boolean;
    readonly details?: Readonly<Record<string, string>>;
  };
}

/**
 * Monta o envelope canônico do §3. `message`, quando omitida, usa a frase
 * padrão sanitizada do código — nunca aceitar aqui a mensagem crua de uma
 * exceção ou de `ZodError`. `details`, quando presente, nunca deve carregar
 * CPF/CNPJ, chave Pix, código de barras ou conteúdo de anexo (§2).
 */
export function erroDoContrato(
  code: CodigoDeErroV1,
  requestId: string,
  message?: string,
  details?: Readonly<Record<string, string>>,
): EnvelopeDeErroV1 {
  const catalogo = CODIGOS_DE_ERRO[code];
  return {
    error: {
      code,
      message: message ?? catalogo.mensagem,
      requestId,
      retryable: catalogo.retryable,
      ...(details ? { details } : {}),
    },
  };
}

/** Status HTTP que a rota deve responder para este código — leitura direta do catálogo. */
export function statusHttpDoErro(code: CodigoDeErroV1): number {
  return CODIGOS_DE_ERRO[code].status;
}
