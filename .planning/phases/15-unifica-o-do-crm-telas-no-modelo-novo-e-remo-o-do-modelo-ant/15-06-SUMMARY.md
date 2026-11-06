---
phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
plan: 06
subsystem: crm
tags: [conversas, mensagens, nao-lidas, swr, avatar, guardas, tdd, ucr-05, ucr-07, ucr-12]
status: complete

requires:
  - phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
    provides: "15-01 e 15-02: rotas /conversas e /mensagens ja existentes, filtro de lixeira de Conversa"
provides:
  - "GET /conversas?naoLidas=true|false (filtro no servidor, do Membro da sessao, total conta o filtrado)"
  - "apps/web/src/dados/crm/conversas.ts: chaveDeConversas, useConversas, useConversa e as oito mutacoes de Conversa por HTTP"
  - "apps/web/src/dados/crm/mensagens.ts: useMensagens e enviarMensagem"
  - "AvatarDoContato (iniciais no degrade da marca, modelo novo, sem ler o store)"
  - "tres guardas sem-crm-antigo.test.ts (dominio, api, web) com a lista CONGELADOS de hoje"
affects: [15-07, 15-08, 15-09, 15-10, 15-33, 15-43]

plan_head_before: 4e6eacb18d73b7cbee328f0b7eb5f242b3f63824
plan_head_after: 7aba590f50841da7db7bb93a72ce896f4d3d670d

actuals:
  tokens: 64257
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "filtro por Membro da sessao no WHERE reaproveitando o left join conversa_marcacoes ($3) e o mesmo criterio do subselect nao_lidas (exists / not exists, fragmento constante)"
    - "chave de SWR de ordem fixa de parametros; invalidacao por prefixo so no sucesso; leitura (lidaAte) invalida so a chave da propria Conversa"
    - "guarda de fonte que congela os arquivos que leem o modelo antigo e so confere 'nenhum arquivo novo' (a metade 'so encolhe' fica para 15-33 e 15-43)"

key-files:
  created:
    - apps/web/src/dados/crm/conversas.ts
    - apps/web/src/dados/crm/conversas.test.ts
    - apps/web/src/dados/crm/mensagens.ts
    - apps/web/src/dados/crm/mensagens.test.ts
    - apps/web/src/features/crm/avatar-do-contato.tsx
    - apps/web/src/features/crm/avatar-do-contato.test.tsx
    - packages/dominio/src/sem-crm-antigo.test.ts
    - apps/api/src/sem-crm-antigo.test.ts
    - apps/web/src/sem-crm-antigo.test.ts
  modified:
    - packages/dominio/src/crm/conversas.ts
    - apps/api/src/repositorios/crm/conversas.ts
    - apps/api/src/rotas/crm/conversas.ts
    - apps/api/src/rotas/crm/conversas.test.ts
    - apps/api/src/servicos/crm/conversas.test.ts
    - apps/api/src/rotas/CONTEXT.md
    - packages/dominio/CONTEXT.md

key-decisions:
  - "naoLidas vira condicao no WHERE (exists / not exists sobre plataforma.mensagens com direcao 'recebida' e criado_em > coalesce(mc.lida_ate, '-infinity')), sem parametro novo: usa o mc.membro_id = $3 que a consulta ja tinha, entao o Membro e sempre o da sessao"
  - "marcarConversa so com lidaAte invalida /conversas/<id> (nao a lista); com estrela invalida /conversas"
  - "enviarMensagem invalida /mensagens e /conversas em paralelo, so no sucesso"
  - "as guardas web usam piso de 100 arquivos (como a sem-listas-espelho da web); dominio e api usam 50, como o plano"

requirements-completed: [UCR-05, UCR-07, UCR-12]

coverage:
  - deliverable: "GET /conversas?naoLidas= filtra pelo Membro da sessao e o total conta o filtrado"
    verification:
      - { kind: test, ref: "apps/api/src/servicos/crm/conversas.test.ts#o filtro naoLidas é do Membro da sessão", status: pass }
      - { kind: test, ref: "apps/api/src/rotas/crm/conversas.test.ts#GET /conversas repassa naoLidas / naoLidas=talvez responde 400", status: pass }
    human_judgment: false
  - deliverable: "hooks e mutacoes de Conversa por HTTP, invalidando so no sucesso"
    verification:
      - { kind: test, ref: "apps/web/src/dados/crm/conversas.test.ts", status: pass }
    human_judgment: false
  - deliverable: "useMensagens e enviarMensagem"
    verification:
      - { kind: test, ref: "apps/web/src/dados/crm/mensagens.test.ts", status: pass }
    human_judgment: false
  - deliverable: "AvatarDoContato desenha o mesmo rosto de ContactAvatar"
    verification:
      - { kind: test, ref: "apps/web/src/features/crm/avatar-do-contato.test.tsx", status: pass }
    human_judgment: true
    rationale: "O teste confere iniciais, nome para leitor de tela e a classe do tamanho; que o desenho fique igual ao ContactAvatar na tela e juizo visual."
  - deliverable: "guardas sem-crm-antigo nas tres camadas"
    verification:
      - { kind: test, ref: "packages/dominio/src/sem-crm-antigo.test.ts", status: pass }
      - { kind: test, ref: "apps/api/src/sem-crm-antigo.test.ts", status: pass }
      - { kind: test, ref: "apps/web/src/sem-crm-antigo.test.ts", status: pass }
    human_judgment: false
---

# Phase 15 Plan 06: Base comum das telas — Conversa, Mensagem, não lidas, avatar e guardas Summary

**`GET /conversas?naoLidas=` filtra no servidor pelo Membro da sessão e chega à web por `useConversas`; `dados/crm/conversas.ts` e `mensagens.ts` dão às telas os mesmos hooks e mutações por HTTP; `AvatarDoContato` existe no modelo novo; e três guardas `sem-crm-antigo.test.ts` impedem arquivo novo de ler o CRM antigo.**

## Performance

- **Tasks:** 3 (1 tracer, 2 auto), as duas primeiras `tdd="true"`; a terceira é o teste em si
- **Files:** 9 criados, 7 modificados
- **Commits:** 6 (2 RED + 2 GREEN + guardas + CONTEXT), medidos de `plan_head_before`
- **Duração:** cerca de 15 min

## Accomplishments

- **Filtro `naoLidas` (traçador):** `FiltroDeConversas.naoLidas?: boolean` no domínio; no repositório, `exists` / `not exists` sobre `plataforma.mensagens` (`direcao = 'recebida'` e `criado_em > coalesce(mc.lida_ate, '-infinity')`) no `where`, sem parâmetro novo — o `mc` já juntava `conversa_marcacoes` pelo `$3`, o Membro da sessão. A rota aceita `naoLidas` como `z.enum(["true","false"])` dentro do `.strict()`; `talvez`, `1` e vazio dão 400 sem chegar ao serviço. O mesmo `where` serve a contagem e a página, então `total` conta o filtrado.
- **Web, Conversa:** `chaveDeConversas` monta os parâmetros numa ordem fixa (`estado, canalId, contatoId, situacao, naoLidas, comEstrela, atribuidoId, filaId, q, limite, deslocamento`), então `{ atribuidoId, naoLidas }` e `{ naoLidas, atribuidoId }` são o mesmo item de cache. `useConversas`, `useConversa`, `abrirConversa`, `resolverConversa`, `reabrirConversa`, `atribuirConversa`, `moverConversa`, `marcarConversa`, `conversaParaLixeira` e `restaurarConversa`, tudo por `chamarCrm` e `invalidarCrm("/conversas")` só no sucesso.
- **Borda UCR-05:** `marcarConversa` com só `lidaAte` invalida apenas `/conversas/<id>`; com `estrela` invalida `/conversas`. Resolver duas vezes: a segunda sobe a `ErroDeApi` da api (409) e não invalida.
- **Web, Mensagem:** `useMensagens(conversaId)` (`/mensagens?conversaId=&limite=&deslocamento=`, sem rede quando não há Conversa) e `enviarMensagem` (`POST /mensagens`, invalida `/mensagens` e `/conversas`; 403 e 409 sobem com `codigo` e nada é invalidado).
- **`AvatarDoContato({ nome, sobrenome, tamanho })`:** mesmo desenho de `ContactAvatar` (iniciais no `--degrade-marca`), nome pela `nomeDeExibicaoDoContato` do domínio, sem ler o store. `contact-card.tsx` não mudou.
- **Guardas:** regex `\b(state|data|estado|s|d)\.(contacts|companies|deals|funnels|channels|contactCompanyLinks|companyCompanyLinks|distinctFromLinks)\b` (na api, também `canais-projetados` e `acrescentarCanaisProjetados`). `CONGELADOS` colado da leitura do código de hoje: 33 arquivos no domínio, 6 na api, 57 na web. Dois testes por camada: "o teste não vê nada?" (pisos de arquivos, arquivo-sentinela `state.ts` / `app.ts` / `app/(shell)/layout.tsx`, lista não vazia) e "nenhum arquivo fora da lista lê o antigo". Provei à mão que a guarda da web acusa um arquivo novo com `state.contacts` e não acusa um com `state.conversations`.

## TDD

| Task | RED | GREEN |
|------|-----|-------|
| 1 (traçador) | `b06c3ef` | `81b4092` |
| 2 | `dc38b36` | `a7f4c77` |
| 3 (guardas) | n/a: o artefato é um teste; ele passa na hora e a prova de que falha foi feita à mão (acima) | `335fe12` |

Avaliação semântica do RED:

- **Tarefa 1, api:** o caso do serviço falhou na asserção planejada (`expected [ c2, c1 ] to deeply equal [ c1 ]`: o filtro era ignorado e as duas Conversas voltavam) e o da rota falhou com `expected 400 to be 200` (o `.strict()` ainda recusava `naoLidas`). Os dois alvos executaram.
- **Tarefa 1 e 2, web:** os módulos `conversas.ts` e `mensagens.ts` não existiam. Para o RED não ser só "falha de import" (INVALID_RED em `tdd.md`), o commit RED leva um esqueleto cujas funções lançam "não implementado"; os 11 casos de `conversas.test.ts` e os 6 de `mensagens.test.ts` executam e falham. Isso é falha por ausência da implementação, não por asserção sobre o valor — registro a diferença. Plano `type: execute`, então não rodei `gsd check tdd-red-evidence`; a avaliação é manual.
- Sem REFACTOR separado.

## Verificação

Tudo contra Postgres 16 local em Docker (`crm-n1-pg-1506`, porta 55706, 001 a 012 aplicadas), com as duas URLs explícitas; o container foi parado no fim.

- `apps/api`: `servicos/crm/conversas.test.ts` + `rotas/crm/conversas.test.ts` 87/87 (nenhum pulado); `src/servicos/crm`, `src/rotas/crm`, `src/repositorios` e as duas guardas de fonte 601/601.
- `packages/dominio`: suíte inteira 2335/2335.
- `apps/web`: `src/dados`, as duas guardas e o avatar 238/238; `tsc --noEmit` limpo nos três workspaces; `eslint` sem achados nos arquivos tocados da web; `verificar:tokens` 0 falhas.
- Critérios de aceitação: `grep -c naoLidas` na rota e no repositório >= 1; `useConversas` + `moverConversa` + `conversaParaLixeira` = 3; `useMensagens` + `enviarMensagem` = 2; `AvatarDoContato` = 1; linhas `.ts"`/`.tsx"` na guarda da web = 58 (>= 40); `conversations` na guarda da web = 0.
- Não rodei `npm test` nem `npm run check` inteiros (regra do projeto: o `npm test` fala com o banco de produção do `.env`). Rodei por arquivo, no banco local.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Mutações da web exportadas como `export function` não casavam com o critério de aceitação**
- **Found during:** Task 1, conferência dos critérios
- **Issue:** o critério pede `export async function moverConversa` e `export async function conversaParaLixeira`; a primeira versão exportava funções comuns que devolviam a Promise.
- **Fix:** as oito mutações viraram `async function` (mesmo comportamento; o retorno já era `Promise`).
- **Files modified:** `apps/web/src/dados/crm/conversas.ts`
- **Commit:** `81b4092`

**2. Arquivos fora da lista `files_modified`**
- `apps/web/src/features/crm/avatar-do-contato.test.tsx` (teste do avatar), `apps/api/src/rotas/CONTEXT.md` e `packages/dominio/CONTEXT.md` (uma frase cada sobre o filtro `naoLidas`). Só testes e documentação; nenhum código de produção fora do plano.

**Total deviations:** 1 auto-fixed (Rule 1), 0 arquiteturais. **Impact:** nenhum.

## Known Stubs

Nenhum. O esqueleto de RED que lançava "não implementado" foi substituído no GREEN de cada tarefa (confirmado: nenhum `não implementado` restante em `apps/web/src/dados/crm`).

## Threat Flags

Nenhum: T-15-18 (filtro de outro Membro) e T-15-19 (SQL do filtro) mitigados como o plano pedia — o fragmento é constante, o Membro é o `$3` da sessão e o teste de serviço cobre dois Membros (o segundo, sem marcação, vê as duas Conversas como não lidas e nenhuma como lida).

## Observações para os planos seguintes

1. As guardas só conferem "nenhum arquivo novo". A lista `CONGELADOS` não encolhe sozinha: cada plano de tela deve provar por grep que os seus arquivos saíram do regex, e 15-33 (api e web) e 15-43 (domínio) ligam a metade "sumidos" e esvaziam a lista.
2. `apps/web/src/dados/crm/canais.ts` já consta em `CONGELADOS` da web (casa o regex hoje). É código do modelo novo; vale tirá-lo da lista no plano que trocar os Canais.
3. `useConversas` ainda não filtra por "Membro da sessão" no cliente além do `atribuidoId`/`naoLidas`: quem monta Início e Notificações passa o id do Membro em `atribuidoId` quando quiser só as dele.

## Self-Check: PASSED

Arquivos criados presentes em disco, seis commits da tarefa são ancestrais de `HEAD`.
