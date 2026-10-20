/**
 * Quem assina a Política de Privacidade e os Termos e Condições.
 *
 * Os campos `null` são o que o repositório não sabe: razão social, CNPJ,
 * endereço e o e-mail que recebe pedidos de titulares. A página só mostra a
 * linha de um campo preenchido — preencher aqui é o único passo para ela
 * aparecer nos dois documentos.
 */
export const EMPRESA = {
  /** Como o documento chama a controladora. */
  nome: "Tria Company",
  /** Como o documento chama o produto. */
  produto: "N1 Digital",
  /** Razão social completa, se diferente de `nome`. */
  razaoSocial: null as string | null,
  cnpj: null as string | null,
  endereco: null as string | null,
  /** Canal que recebe pedidos de titulares (LGPD, art. 18) e pedidos de exclusão de dados. */
  emailPrivacidade: null as string | null,
  /** Nome e contato do Encarregado (LGPD, art. 41), se houver um designado. */
  encarregado: null as string | null,
} as const;

/** Data da versão vigente dos dois documentos; muda junto com o texto. */
export const VIGENTE_DESDE = "20 de outubro de 2026";
