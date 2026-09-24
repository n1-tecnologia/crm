/**
 * Catálogo de configuração por Empresa (TEN-01, `05-CONTEXT.md` D5-03/D5-05/
 * D5-08): as 6 Empresas do Campo `Empresa` (`fd_cp_empresa`,
 * `seed-financeiro.ts`) e a Integração Omie de cada uma. Cada linha registra
 * o rótulo estável da conta e o banco de categorias — nunca `app_key`/
 * `app_secret`: a plataforma nunca chama o Omie (03-07/03-11), e um segredo
 * que ela não usa é um segredo que ela não deve guardar (D5-03/CON-10).
 *
 * `EMPRESA_NOVA` é a única opção que falta às 11 já existentes em
 * `fd_cp_empresa` — o evolver (`configuracao-por-empresa-evolver.ts`) a
 * acrescenta. Nada aqui é função nem I/O: é dado puro, no mesmo molde de
 * `solicitacao-de-pagamento.ts`, consumido pelo evolver que materializa o
 * Campo e as Integrações de verdade no `DataState`.
 */

import type { Id } from "./types";

/** A única opção que falta às 11 já existentes de `fd_cp_empresa`. */
export const EMPRESA_NOVA = "Marcos Paulo";

export interface EmpresaConfigurada {
  readonly integrationId: Id;
  /** O rótulo EXATO da opção do Campo `Empresa`. */
  readonly empresa: string;
  readonly nome: string;
  readonly contaRotulo: string;
  readonly bancoDeCategorias: string;
  /** D5-10 — rótulos de destinatário, nunca número. */
  readonly avisosPorCanal?: { readonly whatsapp: readonly string[] };
  /** D5-06 — Status do Conjunto da Lista de Solicitações que esta Empresa declara. */
  readonly statusDeclarados?: readonly string[];
}

export const CATALOGO_CONFIGURACAO_POR_EMPRESA: readonly EmpresaConfigurada[] = [
  {
    integrationId: "int_omie_tria",
    empresa: "Tria Company",
    nome: "Omie · Tria Company",
    contaRotulo: "omie-tria",
    bancoDeCategorias: "conciliador_contas_pagar_tria",
  },
  // D5-08 — FINQ/Konq entra como Empresa e Integração, e nada além disso:
  // `payment-rules.ts` do lado FINQ segue fechado (D3-01 mantém o caminho
  // FINQ fora de escopo).
  {
    integrationId: "int_omie_konq",
    empresa: "Konq Intermediações",
    nome: "Omie · Konq Intermediações (FINQ)",
    contaRotulo: "omie-finq-konq",
    bancoDeCategorias: "conciliador_contas_pagar_finq",
  },
  {
    integrationId: "int_omie_marcos_paulo",
    empresa: "Marcos Paulo",
    nome: "Omie · Marcos Paulo",
    contaRotulo: "omie-marcos-paulo",
    // Divergência conhecida de banco de categorias: `marcos-paulo/config.ts`
    // diz `conciliador_contas_pagar_pf` e `family-office/config.ts` diz
    // `conciliador_contas_pagar_marcos_paulo` — o valor adotado é o do
    // próprio tenant; a divergência é confirmada no checkpoint do plano 05-03.
    bancoDeCategorias: "conciliador_contas_pagar_pf",
    // Os três rótulos correspondem a MP_WHATSAPP_MARI, MP_WHATSAPP_MARCOS e
    // MP_WHATSAPP_GRUPO no ambiente do `automation/`; o número nunca entra
    // aqui (D5-10) — só o rótulo estável, como a conta Omie.
    avisosPorCanal: { whatsapp: ["mari", "marcos", "grupo-financeiro"] },
  },
  {
    integrationId: "int_omie_exo_loteamento",
    empresa: "EXO Loteamento",
    nome: "Omie · EXO Loteamento",
    contaRotulo: "omie-exo-loteamento",
    bancoDeCategorias: "conciliador_contas_pagar_exo_loteamentos",
    statusDeclarados: ["em revisão"],
  },
  {
    integrationId: "int_omie_exo_participacoes",
    empresa: "EXO Participações",
    nome: "Omie · EXO Participações",
    contaRotulo: "omie-exo-participacoes",
    bancoDeCategorias: "conciliador_contas_pagar_exo_participacoes",
    statusDeclarados: ["em revisão"],
  },
  {
    integrationId: "int_omie_oliveira_participacoes",
    empresa: "Oliveira Participações",
    nome: "Omie · Oliveira Participações",
    contaRotulo: "omie-oliveira-participacoes",
    bancoDeCategorias: "conciliador_contas_pagar_oliveira_participacoes",
    statusDeclarados: ["em revisão"],
  },
];
