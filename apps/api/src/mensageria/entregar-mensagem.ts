/**
 * Esqueleto do RED (16-05, Task 1): o worker de saída ainda não entrega nada.
 */

import type { OutboxWorker } from "../persistencia/outbox-worker";

export function criarWorkerDeSaida(_opcoes: { readonly workerId: string }): OutboxWorker {
  return { iniciar() {}, async parar() {}, async processarUm() { return false; } };
}
