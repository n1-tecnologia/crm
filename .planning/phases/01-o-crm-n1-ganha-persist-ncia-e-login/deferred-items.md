# Deferred Items — Phase 1

Descobertas fora do escopo do plano corrente, registradas em vez de corrigidas (scope boundary do executor).

## Plan 01-07

- **`apps/web/src/app/entrar/page.tsx` — `useSearchParams()` sem `<Suspense>`.** `npm run build -w @n1/web` falha em "Error occurred prerendering page /entrar" porque a página usa `useSearchParams()` diretamente, sem uma fronteira `<Suspense>` acima dela (mesmo problema que o comentário do `(shell)/layout.tsx` já descreve para as telas do shell — aqui não foi corrigido). Confirmado pré-existente: `git log -- apps/web/src/app/entrar/page.tsx` mostra o último commit em `d713253` (Phase 1, plano anterior a este), sem diff nesta execução. Fora do escopo de `01-07-PLAN.md` (`/entrar` não está em `files_modified`). Gate usado no lugar do build, conforme a ação do plano previa para esse cenário: `npm run typecheck -w @n1/web`, `npm run lint -w @n1/web`, `npm run verificar:tokens -w @n1/web`, `npm run test -w @n1/web` — todos verdes.
