# Itens adiados da Fase 16

## Achados no plano 16-04 (fora do escopo dele)

- `apps/api/src/servicos/cofre.test.ts` > "nenhum arquivo de rotas/ importa servicos/cofre" falha: `apps/api/src/rotas/webhooks-de-mensageria.ts`
  (plano 16-03) importa `servicos/cofre` para ler o segredo do Canal. O 16-04 não toca nesses arquivos. Quem fecha: o plano
  que revisitar a rota (ou ajustar o teste para aceitar a rota publica de mensageria, que le o segredo do webhook e nao o devolve).
- `outbox-worker.test.ts` casos (h) a (k) falham quando o arquivo roda junto de `outbox.test.ts` no mesmo `vitest run`
  (baseline conhecido: a fila e a tabela inteira); isolado, os 17 passam.
