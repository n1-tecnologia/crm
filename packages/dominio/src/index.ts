/**
 * A porta de entrada do domínio.
 *
 * Quem consome de fora — a interface em `apps/web`, o backend em `apps/api` —
 * entra por aqui ou por um subcaminho (`@n1/dominio/operations`). O que não
 * estiver exposto neste arquivo é interno ao pacote e pode mudar sem aviso.
 *
 * `operations` e `derive` saem como espaços de nome porque são dois verbos
 * distintos sobre o mesmo estado: `operations` grava, `derive` só recompõe.
 * Mantê-los separados no ponto de importação deixa a chamada dizer qual dos
 * dois ela é.
 */

export * from "./types";
export * from "./state";
export * from "./rotulos";
export * from "./colecoes";
export * from "./usuarios-do-seed";

export * as operations from "./operations";
export * as derive from "./derive";
