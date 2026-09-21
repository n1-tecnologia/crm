/**
 * A tabela de "Campos condicionais" do UI-SPEC (`02-UI-SPEC.md`, seção
 * "Formulário público"), traduzida em duas funções puras — sem DOM, sem
 * `PerguntaPublica`, sem conhecer o transporte. Operam por RÓTULO, não por
 * id: o DTO público não expõe `definitionId` (T-02-03), e o rótulo é o único
 * jeito de decidir CONFIGURAÇÃO de visibilidade sem vazar estrutura interna.
 * `formulario.tsx` é quem traduz entre `pergunta.id` (o que ele usa para
 * montar `respostas` e o payload de envio) e `pergunta.label` (o que estas
 * funções leem).
 */

/** Respostas atuais, indexadas por RÓTULO da pergunta — não por id. */
export type RespostasPorRotulo = Readonly<Record<string, string>>;

interface RegraCondicional {
  /** O rótulo da pergunta que decide (o "gatilho"): `Fornecedor` ou `Forma de pagamento`. */
  readonly gatilho: string;
  /** O valor do gatilho que revela os campos abaixo. */
  readonly valor: string;
  /** Os rótulos revelados quando `respostas[gatilho] === valor`. */
  readonly revela: readonly string[];
}

/** A tabela literal de "Campos condicionais" do UI-SPEC — nada aqui nasce de configuração. */
const REGRAS: readonly RegraCondicional[] = [
  { gatilho: "Fornecedor", valor: "CPF", revela: ["CPF"] },
  { gatilho: "Fornecedor", valor: "CNPJ", revela: ["CNPJ"] },
  { gatilho: "Forma de pagamento", valor: "Chave Pix", revela: ["Chave pix"] },
  { gatilho: "Forma de pagamento", valor: "Boleto", revela: ["Código de barras", "Boleto"] },
  { gatilho: "Forma de pagamento", valor: "QRCode Pix", revela: ["Pix copia e cola", "QR Code"] },
  { gatilho: "Forma de pagamento", valor: "Cartão", revela: ["Link de pagamento"] },
];

/**
 * Os rótulos CONDICIONAIS (CPF/CNPJ/Chave pix/Código de barras/Boleto/Pix
 * copia e cola/QR Code/Link de pagamento) que estão visíveis para as
 * respostas atuais. Uma pergunta não-condicional (fora desta tabela) não é
 * decidida por esta função — `formulario.tsx` sempre a renderiza.
 */
export function camposVisiveis(respostas: RespostasPorRotulo): ReadonlySet<string> {
  const visiveis = new Set<string>();
  for (const regra of REGRAS) {
    if (respostas[regra.gatilho] === regra.valor) {
      for (const rotulo of regra.revela) visiveis.add(rotulo);
    }
  }
  return visiveis;
}

/**
 * Ao trocar `campo` (um gatilho, ex.: `Forma de pagamento`) para `valorNovo`,
 * devolve os rótulos que ficariam ocultos por essa troca E que já têm valor
 * digitado — é exatamente a lista que abre a confirmação `Trocar forma de
 * pagamento?` (UI-SPEC, "Ocultar não apaga silenciosamente o que já foi
 * digitado"). Um campo que perderia a visibilidade mas está vazio não entra:
 * não há nada para perder.
 */
export function camposInvalidadosPor(campo: string, valorNovo: string, respostas: RespostasPorRotulo): readonly string[] {
  const antes = camposVisiveis(respostas);
  const depois = camposVisiveis({ ...respostas, [campo]: valorNovo });
  return [...antes].filter((rotulo) => !depois.has(rotulo) && (respostas[rotulo] ?? "").trim() !== "");
}
