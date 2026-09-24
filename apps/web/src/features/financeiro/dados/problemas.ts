import "server-only";

/**
 * A leitura de `/financeiro/problemas` — a lista de problemas em aberto que
 * `automation/` já deriva (D4-06: `buildProblemRows` mora no `automation/`,
 * não no navegador). `tecnico` chega como um mapa rótulo→valor genérico
 * (os campos técnicos — TaskID, categoria, tipo — não são fixados aqui por
 * nome: quem decide as chaves é o DTO do `automation/`, e o painel técnico
 * só precisa iterar sobre o que vier, nunca precisa saber os nomes de
 * antemão).
 */

import { lerDoFinanceiro, type Leitura } from "./leitura";

export type LinhaDeProblema = {
  readonly id: string;
  readonly severidade: "sucesso" | "aviso" | "info";
  readonly titulo: string;
  readonly descricao: string;
  readonly onde: string;
  readonly idade: string;
  readonly tecnico: Readonly<Record<string, string>>;
};

export function lerProblemas(empresa?: string): Promise<Leitura<{ readonly linhas: ReadonlyArray<LinhaDeProblema> }>> {
  return lerDoFinanceiro<{ readonly linhas: ReadonlyArray<LinhaDeProblema> }>("/financeiro/problemas", { empresa });
}
