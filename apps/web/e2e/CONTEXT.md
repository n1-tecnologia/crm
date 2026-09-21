# e2e — a jornada de navegador

Ler primeiro: [`../CONTEXT.md`](../CONTEXT.md)

## O que mora aqui

Jornadas Playwright que abrem um Chromium real contra o **build de
produção** do `apps/web` — `npx playwright test` (ou `npm run test:e2e`)
builda com `next build` e sobe com `next start`, nunca `next dev`. Nenhum
teste aqui roda em watch mode: `02-VALIDATION.md` proíbe (V02-02D), e o
`webServer` de `playwright.config.ts` reflete isso na letra do comando.

## Por que produção e não `next dev`

O guia local do Next 16 (`node_modules/next/dist/docs/01-app/02-guides/testing/playwright.md`)
recomenda rodar contra o build de produção "para se assemelhar mais de perto
a como a aplicação vai se comportar" — e para esta fase o motivo é mais
concreto: `next build` prerrenderiza cada rota, e é só nesse passo que um
erro como `useSearchParams()` sem `<Suspense>` aparece. Em `next dev` a
mesma página sobe sem reclamar; em produção o build inteiro falha. `/entrar`
foi a primeira rota a provar isso neste plano (ver `02-01-SUMMARY.md`,
Desvio Rule 3).

## A regra

Nenhuma jornada desta pasta pode depender de dado de produção — nem de uma
conta real, nem de um Espaço de Trabalho específico. `fumaca.spec.ts` só
confirma que o harness sobe e navega (o `h1` de `/entrar`); a jornada do
Formulário público (`/f/[segredo]`) nasce no Plan 02-23, quando o
transporte público existir.
