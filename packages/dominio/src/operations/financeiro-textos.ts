/**
 * Os textos canônicos da Conferência do Resumo (Fase 6, `06-CONTEXT.md`
 * §specifics) — contrato entre o domínio, a ponte do `apps/api` e a tela:
 * os três escrevem e leem as MESMAS strings, e nenhum deles as monta à mão.
 *
 * Moram num arquivo próprio, e não em `./financeiro.ts`, por causa do ciclo:
 * `./financeiro.ts` chama `solicitarConferenciaDoResumo` de `./ai.ts`, e
 * `./ai.ts` precisa das respostas canônicas (`conferido`/`ajuste`) na
 * decisão. Os dois importam daqui; `./financeiro.ts` reexporta
 * `TEXTOS_DA_CONFERENCIA` para quem já o procura lá.
 *
 * Puro: nenhuma dependência, nenhum I/O.
 */

/** O resultado de um anexo no `/lancar` — o que a confirmação conta e lista. */
export interface AnexoDoLancamento {
  readonly nome: string;
  readonly ok: boolean;
  /**
   * Por que o anexo não subiu. A partir do contrato v1.2 é um `CodigoDoAnexo`
   * (lista fechada: `ANEXO_HOST_NAO_PERMITIDO`, `ANEXO_DOWNLOAD_FALHOU`,
   * `ANEXO_TEMPO_ESGOTADO`, `ANEXO_GRANDE_DEMAIS`, `ANEXO_OMIE_RECUSOU`),
   * nunca erro de rede cru.
   */
  readonly erro?: string;
  /** v1.2 (aditivo): no título reaproveitado, o anexo já estava lá — não subiu de novo. */
  readonly jaExistia?: boolean;
}

export interface DadosDoLancado {
  readonly payableId: string;
  readonly conta: string;
  readonly categoria: string;
  readonly codigo: string;
  readonly reaproveitado: boolean;
  readonly anexos: ReadonlyArray<AnexoDoLancamento>;
  /**
   * Quantos anexos a ponte pediu no `/lancar` (06-11, aditivo). Sem ele, o
   * total é o que o Omie respondeu. Com ele, a confirmação nunca diz "sem
   * anexos" quando havia anexos pedidos (crm:IN-03).
   */
  readonly anexosPedidos?: number;
}

/** Os campos que o `/lancar` compara no título reaproveitado — a lista do contrato v1.2 (`TITULO_EXISTENTE_DIVERGENTE`). */
export type CampoDivergente = "valor" | "vencimento" | "categoria" | "fornecedor" | "contaCorrente";

const ROTULO_DO_CAMPO: Readonly<Record<CampoDivergente, string>> = {
  valor: "valor",
  vencimento: "vencimento",
  categoria: "categoria",
  fornecedor: "fornecedor",
  contaCorrente: "conta corrente",
};

/** O trecho de anexos da confirmação, pelo status real (crm:IN-03). */
function trechoDosAnexos(d: DadosDoLancado): { readonly resumo: string; readonly semResposta: number } {
  const pedidos = Math.max(d.anexosPedidos ?? 0, d.anexos.length);
  if (pedidos === 0) return { resumo: "sem anexos", semResposta: 0 };
  // Título reaproveitado de um `automation/` v1.1: a resposta não diz nada sobre os anexos.
  if (d.anexos.length === 0) return { resumo: "anexos do primeiro envio", semResposta: 0 };
  const confirmados = d.anexos.filter((a) => a.ok).length;
  const jaEstavam = d.anexos.filter((a) => a.ok && a.jaExistia).length;
  const noTitulo = jaEstavam === 0 ? "" : jaEstavam === 1 ? ", 1 já estava no título" : `, ${jaEstavam} já estavam no título`;
  return { resumo: `anexos ${confirmados} de ${pedidos}${noTitulo}`, semResposta: pedidos - d.anexos.length };
}

const PEDIDO_DE_CONFERENCIA = 'responda "ok" para eu lançar, ou diga o que ajustar.';

/**
 * O pedido quando a Conferência NÃO aceita o "ok" pelo fio (06-18,
 * crm2:WR-03): `AGENTE_CONTAS_A_PAGAR_CONFERENCIA_POR_COMENTARIO=false`.
 * Nenhum texto promete o "ok" que não vale; o ajuste pelo fio continua aberto.
 */
const PEDIDO_PELO_BOTAO = 'use o botão "Conferido, pode lançar", no card da conta, para eu lançar, ou responda aqui o que ajustar.';

/** O pedido da Conferência: pelo fio (padrão) ou só pelo botão. */
const pedidoDaConferencia = (porComentario: boolean): string => (porComentario ? PEDIDO_DE_CONFERENCIA : PEDIDO_PELO_BOTAO);

/** D6-04 — no lugar do pedido, quando ninguém vai conferir (Integração manual). */
const CONFERENCIA_DISPENSADA = "Integração manual: a conferência deste Resumo é dispensada.";

/** A última linha do Resumo: o pedido a quem confere ("confira" ou "confira de novo"), ou a dispensa. */
const pedidoOuDispensa = (financeiro: string, confira: string, porComentario: boolean, dispensada: boolean): string =>
  dispensada ? CONFERENCIA_DISPENSADA : `${financeiro}, ${confira}: ${pedidoDaConferencia(porComentario)}`;

export const TEXTOS_DA_CONFERENCIA = {
  /**
   * Depois do bloco do RESUMO, na primeira publicação. `porComentario`
   * (06-18): `false` troca o pedido do "ok" pelo do botão; o padrão é o texto
   * de sempre, byte a byte. `dispensada` (D6-04): a linha diz que a
   * conferência é dispensada, sem pedir nada a ninguém.
   */
  chamada: (financeiro: string, porComentario = true, dispensada = false): string =>
    `\n\n${pedidoOuDispensa(financeiro, "confira", porComentario, dispensada)}`,
  /** Depois do bloco do RESUMO, quando um revisor pediu ajuste. */
  revisado: (nome: string, pedido: string, financeiro: string, porComentario = true, dispensada = false): string =>
    `\n\nRevisado a pedido de ${nome}: "${pedido}".\n${pedidoOuDispensa(financeiro, "confira de novo", porComentario, dispensada)}`,
  /** Depois do bloco do RESUMO, quando a conta mudou depois da conferência. */
  dadosMudaram: (financeiro: string, porComentario = true, dispensada = false): string =>
    `\n\nOs dados da conta mudaram depois da conferência.\n${pedidoOuDispensa(financeiro, "confira de novo", porComentario, dispensada)}`,
  /**
   * Depois do bloco do RESUMO, quando a Conferência anterior foi superada
   * (`registrarFalhaDoLancamento(…, { superarConferencia: true })`, depois de
   * `CONTA_DIVERGENTE`): o Resumo novo responde no MESMO fio (06-18,
   * crm2:IN-01). O `confira: ` sem "de novo" é de propósito — é o pedido de
   * sempre para o Resumo que substitui o anterior.
   */
  superada: (financeiro: string, porComentario = true, dispensada = false): string =>
    `\n\nEste Resumo substitui o anterior, que não serve mais ao lançamento.\n${pedidoOuDispensa(financeiro, "confira", porComentario, dispensada)}`,
  /**
   * Resposta do Agente no fio a um "ok" de quem não confere este Resumo
   * (06-18, crm2:WR-03): quem confere pelo fio é quem confere pelo clique
   * (`podeDecidirAConferencia`). Sai uma vez por resposta.
   */
  okDeQuemNaoConfere: (aprovador: string): string => `Esta resposta não confere o Resumo: quem confere é ${aprovador} ou um Administrador.`,
  /**
   * Resposta do Agente no fio a um "ok" de quem confere, quando a
   * Conferência não aceita o "ok" pelo fio
   * (`AGENTE_CONTAS_A_PAGAR_CONFERENCIA_POR_COMENTARIO=false`, 06-18,
   * crm2:WR-03). Sai uma vez por resposta.
   */
  okPeloFioDesligado:
    'Esta resposta não confere o Resumo: aqui a conferência é pelo botão "Conferido, pode lançar", no card da conta. Para pedir ajuste, responda neste fio o que mudar.',
  /**
   * Recusa de `dispensarConferenciaDoResumo` (06-18, crm2:CR-01): no estado
   * da gravação, a conta não é mais "Manual" — a dispensa D6-04 não cabe, e o
   * Resumo vai a uma pessoa.
   */
  recusaDispensaSemManual: "A conta não é mais de Integração manual: esta Conferência não se dispensa, e o Resumo vai para conferência.",
  /**
   * Recusa de `dispensarConferenciaDoResumo` (06-21, crm2:CR-01 residual —
   * 06-REVIEW-3 Crítico): há, no fio da Conferência vigente, uma resposta de
   * Membro ainda não processada (ajuste ou aprovação). Remarcar "Manual"
   * NUNCA dispensa por cima dessa resposta — ela decide.
   */
  recusaDispensaComRespostaPendente: "Há uma resposta no fio ainda não lida: esta Conferência não se dispensa por Integração manual — a resposta decide.",
  /**
   * 06-19 (crm2:WR-04) — a porta de teste G3 (`avisarId` com `avisarEstrito`)
   * aponta para quem não é Membro ativo: a operação recusa sem efeito, em vez
   * de avisar o Financeiro real.
   */
  recusaAvisarInativo: "O Membro indicado para receber os avisos não é um Membro ativo: nada foi gravado.",
  /** Resposta canônica no fio: Conferência aprovada. */
  conferido: (nome: string): string => `✅ Resumo conferido por ${nome}`,
  /** Resposta canônica no fio: ajuste pedido. */
  ajuste: (nome: string, motivo: string): string => `🔁 Ajuste pedido por ${nome}: ${motivo}`,
  /**
   * Recusa de `decideProcessApproval` (06-11, crm:WR-08): a impressão de
   * lançamento mudou depois do Resumo, e decidir agora afirmaria a conferência
   * de dados que não são os da conta. A tela e a ponte mostram esta string.
   */
  recusaDesatualizada: "Os dados da conta mudaram depois deste Resumo; aguarde o Resumo novo.",
  /**
   * Recusa de APROVAR (06-11, crm:WR-03): a Categoria veio `ausente` do de-para
   * (`9.99.99` é preenchimento) ou o código está fora da forma do contrato.
   * Pedir ajuste continua aberto — é o caminho que esta string indica.
   */
  recusaSemCodigo:
    "Este Resumo não tem o código da Categoria no Omie, e sem ele não há o que conferir. Peça ajuste com o código da Categoria (ex.: 2.04.01).",
  /**
   * Confirmação no fio depois de o Omie devolver o título. Os anexos pelo
   * status real (06-11, crm:IN-03): `sem anexos` só quando nenhum foi pedido;
   * `anexos do primeiro envio` quando o título reaproveitado não diz nada
   * deles; senão `anexos n de m` (com `k já estavam no título`), uma linha por
   * anexo que não subiu e uma pelos que ficaram sem resposta do Omie.
   */
  lancado: (d: DadosDoLancado): string => {
    const { resumo, semResposta } = trechoDosAnexos(d);
    const primeira = `✅ Lançado no Omie — título ${d.payableId} · ${d.conta} · ${d.categoria} (${d.codigo}) · ${resumo}${d.reaproveitado ? " (título já existia)" : ""}`;
    const falhas = d.anexos.filter((a) => !a.ok).map((a) => `• ${a.nome}: não subiu (${a.erro ?? "motivo não informado"})`);
    const faltantes = semResposta === 0 ? [] : [semResposta === 1 ? "• 1 anexo sem resposta do Omie" : `• ${semResposta} anexos sem resposta do Omie`];
    return [primeira, ...falhas, ...faltantes].join("\n");
  },
  /**
   * O `motivo` de `registrarFalhaDoLancamento` para o 422
   * `TITULO_EXISTENTE_DIVERGENTE` (contrato v1.2): o título que o Omie já tem
   * não bate com o pedido. A Menção (`avisadoDaConferencia`) e a volta a
   * "para pagar" vêm de `registrarFalhaDoLancamento` (D6-03). Só o id do
   * título e os NOMES dos campos — nunca um valor (a regra do contrato para
   * `details`).
   */
  tituloDivergente: (payableId: string, campos: ReadonlyArray<CampoDivergente>): string =>
    `o título ${payableId} já existe no Omie com outros dados${campos.length > 0 ? ` (${campos.map((c) => ROTULO_DO_CAMPO[c]).join(", ")})` : ""}: exclua-o ou corrija-o no Omie e mova a conta de novo para "em lançamento omie"`,
  /**
   * O `motivo` de `registrarFalhaDoLancamento` para o 422 `CONTA_DIVERGENTE`
   * (contrato v1.2): a conta corrente conferida no Resumo não é a que o
   * `automation/` resolve agora. A Menção e a volta a "para pagar" vêm de lá
   * (D6-03). Só os rótulos das contas, nenhum valor.
   */
  contaDivergente: (conferida: string, resolvida: string): string =>
    `a conta corrente conferida no Resumo (${conferida}) não é a que o Omie usaria agora (${resolvida}); confira o de-para de contas antes de mover a conta de novo`,
  /** Modo `conferencia` da ponte, com a conta em "em lançamento omie" e o Resumo conferido. */
  modoConferencia: "Resumo conferido. Neste ambiente o lançamento no Omie está desligado (modo conferência): nada foi lançado, a conta fica aqui.",
  /** Falha permanente no lançamento (D6-03). */
  falha: (motivo: string, code: string): string => `Não consegui lançar no Omie: ${motivo} (${code}). A conta voltou para "para pagar".`,
  /**
   * A mesma falha quando a conta NÃO voltou (não estava em "em lançamento
   * omie", ou a mudança de Status foi recusada): o aviso não afirma o que não
   * aconteceu.
   */
  falhaSemVolta: (motivo: string, code: string, recusa?: string): string =>
    `Não consegui lançar no Omie: ${motivo} (${code}).${recusa ? ` A conta não voltou para "para pagar": ${recusa}` : ""}`,
} as const;

/**
 * Os prefixos das mensagens que o próprio processo escreve no fio.
 *
 * Deixou de ser o filtro das respostas (06-11, crm:WR-04): um revisor que
 * escreve "⚠️ o valor está errado" ou "✅" está respondendo, e o emoji
 * inicial não o torna mensagem do processo. O filtro agora é a autoria e
 * `FORMAS_CANONICAS_DO_FIO`. Continua exportado por compatibilidade (API
 * pública de `@n1/dominio/operations`).
 */
export const PREFIXOS_DO_PROCESSO: readonly string[] = ["✅", "🔁", "📋", "⚠️"];

/**
 * As formas exatas das respostas que `decideProcessApproval` publica no fio
 * em nome do DECISOR (`conferido` e `ajuste`, autor Membro): as únicas
 * mensagens do processo escritas por um Membro. As do Agente (o RESUMO, os
 * avisos "⚠️", a confirmação do lançamento) saem pela autoria, não por aqui
 * (`respostasDeConferenciaPendentes`, 06-11, crm:WR-04).
 */
export const FORMAS_CANONICAS_DO_FIO: readonly RegExp[] = [/^✅ Resumo conferido por /u, /^🔁 Ajuste pedido por /u];
