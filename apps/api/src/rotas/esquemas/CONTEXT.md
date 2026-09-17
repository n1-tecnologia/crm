# esquemas

Ler primeiro: [`../../../CONTEXT.md`](../../../CONTEXT.md) e [`../CONTEXT.md`](../CONTEXT.md)

A FORMA dos `args` de `POST /operacoes/:nome` — um arquivo por módulo de
`packages/dominio/src/operations/`, cada um espelhando o tipo TypeScript da
assinatura real das operações desse módulo. Validação de TRANSPORTE, nunca
regra de negócio: uma regra ("título não pode ficar vazio", "e-mail precisa
ser válido", limites numéricos) continua exclusivamente no domínio.

## Regras

1. Um arquivo por módulo do domínio, exportando UMA constante em caixa alta
   com `satisfies Esquemas` (o tipo parcial de `fragmentos.ts`).
2. Objetos são `.strict()` — a única exceção documentada é `inviteMember`
   (`.strip()`, T-1-08, Plan 01-15): fica de propósito fora de `ESQUEMAS`
   porque `SERVICOS.inviteMember` (`apps/api/src/rotas/operacoes.ts`) já
   valida com `.strip()`, o único ponto que descarta `userId` do corpo.
3. Parâmetro posicional opcional no fim de uma assinatura → `opcional()`
   (`fragmentos.ts`); campo `T | null` → `.nullable()`; campo `?:` →
   `.optional()`.
4. Todo `z.enum` que espelha uma união nomeada do domínio entra no
   `Confere<[Igual<…>]>` do arquivo que o declara (`fragmentos.ts` faz isso
   para os fragmentos compartilhados) — um membro a mais ou a menos deixa de
   compilar (IN-10).
5. Fragmentos usados por dois módulos ou mais vivem só em `fragmentos.ts` —
   nunca duplicados entre arquivos de módulo.
6. `esquemas-de-argumentos.ts` compõe os módulos (`{ ...TAREFAS, ...
   }`); ninguém dentro desta pasta importa dele. Sem ciclo:
   `fragmentos.ts` → `<modulo>.ts` → `esquemas-de-argumentos.ts` →
   `operacoes.ts`.

## Arquivos

Ao fim deste plano (01-12):

| Arquivo | Módulo do domínio |
|---|---|
| `fragmentos.ts` | (base — tipos, `opcional()`, fragmentos compartilhados; sem módulo próprio) |
| `tarefas.ts` | `tasks.ts` |
| `automacoes.ts` | `automations.ts` |
| `financeiro.ts` | `financeiro.ts` |

Acrescentados pelos Plans 01-13/14/15 (onda 2, em paralelo):

| Arquivo | Módulo do domínio |
|---|---|
| `negocios.ts` | `deals.ts` |
| `conversas.ts` | `conversations.ts` |
| `contatos.ts` | `contacts.ts` |
| `ia.ts` | `ai.ts` |
| `pastas-de-chat.ts` | `chat-folders.ts` |
| `construtor-de-agentes.ts` | `agent-builder.ts` |
| `configuracao.ts` | `configuration.ts` |
| `colaboracao.ts` | `collaboration.ts` |
| `planejamento.ts` | `planning.ts` |
| `escala.ts` | `scale.ts` |
| `membros.ts` | `members.ts` |
| `estrutura.ts` | `structure.ts` |

O Plan 01-16 fecha a composição (`ESQUEMAS satisfies EsquemasCompletos`),
remove o fallback estrutural `ARGUMENTOS_GENERICOS` e limpa a rota.
