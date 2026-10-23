# Itens adiados da Fase 9

## Encontrados no plano 09-04 (fora do escopo dele)

- `apps/api/src/e2e/canais-fluxo.test.ts` caso (e) ("GET /estado traz os dois Canais relacionais ao lado do seed ...") devolve 500 contra o Postgres local. A causa está em código do plano 09-02, não na `009`: `recortarMembro` (`packages/dominio/src/derive-visibilidade.ts:67`) lê `membro.userMemory.enabled` e lança `TypeError: Cannot read properties of undefined (reading 'enabled')` quando um Membro do estado hidratado não tem `userMemory`. Os outros 8 casos do arquivo e as demais 1434 provas do `apps/api` passam. Conserto sugerido: tolerar `userMemory` ausente em `recortarMembro` (ou garantir o campo na hidratação) e cobrir com teste de domínio. Dono: 09-02 / verificação da Fase 9.
