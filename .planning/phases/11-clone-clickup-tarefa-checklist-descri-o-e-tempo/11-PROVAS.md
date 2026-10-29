# Fase 11 — Provas e decisões do dono

Registro das provas de fim de fase: o e2e e o portão rodados pelo agente contra um Postgres de Docker local (nunca contra o banco do `.env`) e as conferências que só o dono faz (produção, só leitura, e a UAT no navegador). Nenhuma URL de produção, título de Tarefa ou segredo entra aqui.

## E2E local (Task 1)

Banco: Postgres 16 em Docker (`crm-n1-pg-1108`, porta 55618), migrado do zero com `npm run migrar` (001 a 010). Contêiner removido ao fim do plano.

Comando (as duas variáveis, explícitas, apontam para `localhost:55618`):

```
cd apps/api && DATABASE_URL=<postgres local> DATABASE_URL_MIGRACAO=<postgres local> \
  npx vitest run src/rotas/operacoes.test.ts src/rotas/estado.test.ts src/seguranca/dados-de-outro-membro.test.ts \
  && npx tsc --noEmit
```

Resultado: 3 arquivos, 63 testes passados, 0 pulados; `tsc --noEmit` verde. Commit `62e4edd`.

Casos novos em `apps/api/src/rotas/operacoes.test.ts` (dentro do `describeComBanco` do caso (r)):

| Caso | O que prova |
|---|---|
| (r2) | `POST /operacoes/updateTask` com `descriptionMentions` e descrição nova: 200, `ok: true`; depois de `hidratar`, a Tarefa tem a lista com o Membro e `state.activity` traz o Registro "Descrição alterada" com `before` = descrição antiga e `after` = a nova |
| (r2b) | Membro inexistente em `descriptionMentions`: 200 com `ok: false` e diferença vazia; a descrição não é gravada |
| (r3) | `POST /operacoes/convertChecklistItem` com quatro argumentos: 400 antes de `executar()`; com três: grava a Subtarefa sob a Tarefa do Checklist, e ela volta na hidratação (Tarefa `tsk_seed_1`, Lista de Revisões, pelo Proprietário) |
| (r3b) | Contas a pagar não usa Subtarefas: a rota devolve `ok: false` com "Esta Lista não usa Subtarefas." (a mesma frase de `conversaoDeItemRecusada`) e não grava nada |

Desvio de execução (sem efeito no produto): a Lista de Contas a pagar também não usa Checklists, então o caminho feliz de (r3) usa a Tarefa de Revisões do seed e o token do Proprietário; a recusa por "Lista sem Subtarefas" ficou em (r3b).

Recorte de outro Membro: `seguranca/dados-de-outro-membro.test.ts` e `estado.test.ts` passaram no mesmo comando (T-11-21).

## Portão `npm run check`

Comando, da raiz (as duas variáveis explícitas para o Postgres local; sem URL de produção):

```
DATABASE_URL=<postgres local> DATABASE_URL_MIGRACAO=<postgres local> npm run check
```

Duas rodadas, depois do commit do e2e:

| Rodada | Exit | Observação |
|---|---|---|
| 1 | 1 | uma falha em `apps/api/src/persistencia/outbox-worker.test.ts`, caso (k) ("attempts atingindo maxTentativas vira 'failed' mesmo com status retryable": recebeu `pending`, esperava `failed`) |
| 2 | **0** | tudo verde |

Sobre a falha da rodada 1: a Fase 11 não toca nada em `apps/api/src/persistencia` (`git diff 2d1ee38..HEAD -- apps/api/src/persistencia` vazio). O arquivo passou 15/15 em três execuções isoladas e na rodada 2 inteira. É intermitência de tempo do worker de outbox sob a suíte cheia, não regressão da fase. Registrada aqui, não corrigida (fora do escopo do plano).

Resumo da rodada 2 (exit 0):

| Etapa | Resultado |
|---|---|
| `typecheck` (api, web, dominio) | verde |
| `lint` (web) | 0 erros, 2 avisos antigos (`KnowledgeDocument` em `ia/conhecimento/rotulos.ts`, `Target` em `shell/app-shell.tsx`), nenhum de arquivo desta fase |
| `verificar:tokens` | 445 definidos, 390 arquivos varridos, 0 falhas |
| `verificar:contratos` | pulado: repositório irmão `financeiro-tria` não existe nesta máquina (aviso do próprio script) |
| `@n1/api` | Test Files 153 passed, 2 skipped (155); Tests 1657 passed, 2 expected fail, 21 skipped, 1 todo (1681) |
| `@n1/web` | Test Files 92 passed (92); Tests 845 passed (845) |
| `@n1/dominio` | Test Files 113 passed (113); Tests 2197 passed (2197) |

Os 21 testes pulados do `@n1/api` são os que dependem de ambiente que o portão local não tem: `e2e/dois-servicos.test.ts` (9), `e2e/falhas-injetadas.test.ts` (8) e quatro arquivos de contrato/importação que precisam do repositório irmão (`contrato-contas-a-pagar`, `importacao/clickup/contas-a-pagar`, `importacao/clickup/contas-a-receber`, `rotas/integracao-solicitacoes`). Nenhum é desta fase e nenhum teste foi pulado para o portão passar.

Quem pode: `cd packages/dominio && npx vitest run src/quem-pode.test.ts` passou (6 testes) também depois da edição das Observações de `convertChecklistItem` e `updateTask` em `packages/dominio/CONTEXT.md`. Nenhuma linha nova (nenhuma operação nova nesta fase).

## Conferência de produção (A1)

**Premissa A1 (TAR-03):** nenhum registro de Tarefa em produção carrega a chave de Subitem (`parentItemId`). O checklist de um nível ignora a chave; se algum registro a tiver, o Item que era Subitem passa a contar como Item normal.

**O dono roda, só leitura**, no SQL Editor do Supabase do CRM N1 (o agente não alcança esse banco):

```sql
select count(*) from plataforma.registros where colecao = 'tasks' and dados::text like '%parentItemId%';
```

Se o número for diferente de zero, rodar também:

```sql
select workspace_id, id, dados->>'title' from plataforma.registros where colecao = 'tasks' and dados::text like '%parentItemId%' limit 20;
```

(Nesse caso, colar só `workspace_id` e `id`; o título fica de fora deste arquivo.)

**Número colado pelo dono:** 0 (data: 29/10/2026)

**Se diferente de zero, escolha do dono:** não se aplica. O resultado foi zero: nenhum registro de Tarefa em produção carrega a chave de Subitem, a premissa A1 está confirmada, não há ação a tomar e nenhuma `011` é necessária.

## Lista da UAT de fim de fase

Com `npm run dev` (web 3001, api 3002). Cada linha: marque `[x]` se aprovada ou escreva o ajuste pedido. A coluna "Voltar atrás" diz como desfazer o que a linha decidiu, se o dono quiser mudar.

### Os seis itens manuais de `11-VALIDATION.md`

- [x] **U1. Destaque do nome mencionado na descrição (cor e contraste).** Abrir uma Tarefa, escrever "@" na descrição, escolher alguém, salvar e conferir o nome destacado nos temas claro e escuro. Origem: 11-07 (TAR-04). Voltar atrás: trocar as variáveis de `.rico .mencao` usadas em `descricao-da-tarefa.tsx`. Aprovado pelo dono (29/10/2026).
- [x] **U2. "Abrir" leva à Subtarefa real.** Numa Lista com Subtarefas (ex.: Revisões), converter um Item e clicar em "Abrir" no aviso "Item convertido em Subtarefa: {título}."; abre a Subtarefa nova, não outra. Origem: 11-07 (TAR-02, D-05). Voltar atrás: o aviso é só texto + link em `tarefa-completa.tsx` (`linkDoAviso`). Aprovado pelo dono (29/10/2026).
- [x] **U3. Um clique e cor normal.** "Converter em Subtarefa" está na cor normal (não vermelha) e a confirmação não pede para digitar o nome; um clique em "Converter" basta. Origem: 11-07 (TAR-02, D-01). Voltar atrás: `conversao-de-item.tsx` (`ConfirmDialog` sem `destructive`). Aprovado pelo dono (29/10/2026).
- [x] **U4. Botão ausente onde não cabe.** Abrir uma Tarefa de uma Lista sem Subtarefas (ex.: Contas a pagar) e uma Tarefa no último nível (3): o botão não aparece. Origem: 11-01 + 11-07 (TAR-02, D-04/D-05). Voltar atrás: `conversaoDeItemRecusada` em `derive.ts` é a única regra. Aprovado pelo dono (29/10/2026).
- [x] **U5. O aviso aparece para a pessoa mencionada.** Mencionar um Membro na descrição, entrar como ele e conferir Notificações › "Menções a você" (e o sino/Início); tirar o nome da descrição e conferir que o aviso some. Origem: 11-04 (TAR-05). Voltar atrás: `pendingMentions` em `derive.ts` (nada é guardado por pessoa). Aprovado pelo dono (29/10/2026).
- [x] **U6. A1 respondida** (seção acima, número de produção colado). Origem: 11-01 (TAR-03). Aprovado pelo dono (29/10/2026).

### Premissas `owner-confirmation: pending` (concordo / mudar)

- [x] **P1. Padrão de trabalho nº 1 (11-04):** quem escreve o próprio nome na descrição também vê o aviso em Notificações (a descrição não tem autor para excluir). Voltar atrás: filtro em `pendingMentions`. Concordo (dono, 29/10/2026).
- [x] **P2. Padrão de trabalho nº 2 (11-02):** a recorrência copia a menção da descrição, então a pessoa é avisada de novo na próxima ocorrência. Voltar atrás: a cópia de `descriptionMentions` em `operations/collaboration.ts` (literal da próxima ocorrência). Concordo (dono, 29/10/2026).
- [x] **P3. A2 (11-03):** "N registros" na linha "Rastrear tempo" conta também o cronômetro aberto. Voltar atrás: `lancamentos` em `tempoRegistrado` (`derive.ts`). Concordo (dono, 29/10/2026).
- [x] **P4. A3 (11-03):** o total da Tarefa mãe cai quando uma Subtarefa vai para a lixeira (Subtarefa fora de "ativo" e tudo abaixo dela não soma). Voltar atrás: `minutosComSubtarefas` em `tempoRegistrado`. Concordo (dono, 29/10/2026).
- [x] **P5. A4 (11-02):** o texto da descrição no histórico é cortado em 2.000 caracteres mais "…" (2.001 no total). Voltar atrás: `LIMITE_DO_HISTORICO` em `descricao-da-tarefa.ts`. Concordo (dono, 29/10/2026).
- [x] **P6. Fronteira do `@Nome` (11-02/11-05):** o nome só conta se termina em fim de texto, espaço ou pontuação ("@João" não conta dentro de "@João Silva"); vale para descrição e Comentário. Voltar atrás: `mencionaNoTexto` em `descricao-da-tarefa.ts`. Concordo (dono, 29/10/2026).
- [x] **P7. Nome trocado de Membro (11-02):** se um Membro mudar de nome, o `@Nome antigo` no texto deixa de contar (sem destaque e sem aviso). Voltar atrás: a lista efetiva é derivada do `displayName` atual (`membrosMencionadosNaDescricao`). Concordo (dono, 29/10/2026).
- [x] **P8. Ordem das menções (11-04):** em "Menções a você", a menção da descrição entra pelo instante da última edição da descrição (ou da criação da Tarefa) e a lista mistura Comentário e descrição, mais nova primeiro; a mesma Tarefa aparece uma vez, mesmo com o nome escrito várias vezes. Voltar atrás: o instante em `pendingMentions`. Concordo (dono, 29/10/2026).

### Textos e telas novos

- [x] **T1. Confirmação de converter (11-07):** título "Converter “{Item}” em Subtarefa?", texto "A conversão não tem volta: o Item fica marcado como convertido, sai do progresso do Checklist e vira uma Subtarefa desta Tarefa.", botão "Converter". Aprovado pelo dono (29/10/2026).
- [x] **T2. Aviso depois de converter (11-07):** "Item convertido em Subtarefa: {título}." com o link "Abrir". Aprovado pelo dono (29/10/2026).
- [x] **T3. Notificações (11-04):** "Menção a você na descrição de “{título}”" com o trecho da descrição e o link para a Tarefa; o aviso de Comentário continua igual. Aprovado pelo dono (29/10/2026).
- [x] **T4. Histórico da descrição (11-06):** no Feed de Atividade e na Timeline, "Descrição alterada" mostra o botão "Ver alteração" (vira "Ocultar alteração"), que abre "Antes" e "Depois" em texto puro; descrição anterior vazia aparece como "Sem descrição"; uma edição antiga (sem texto guardado) não tem botão. Aprovado pelo dono (29/10/2026).
- [x] **T5. Linha "Rastrear tempo" (11-03/11-07):** mostra o mesmo total do editor de tempo; "Iniciar" sem registros; com tempo, algo como `1 h 15 min · 3 registros · em andamento · 1 h 35 min com Subtarefas`, e o editor mostra "Total registrado", "em andamento" e "com Subtarefas" pelos mesmos números. Aprovado pelo dono (29/10/2026).
- [x] **T6. Auditoria (11-06):** a linha "Descrição alterada" mostra "—" no lugar do texto da descrição (a Reunião também não imprime o texto inline). Aprovado pelo dono (29/10/2026).

Resposta do dono (cole abaixo): número da consulta de produção, "aprovado" ou a lista de itens (U1 a U6, P1 a P8, T1 a T6) que precisam mudar.

```
Dono, 29/10/2026:
- Consulta de produção (A1): 0.
- UAT: "aprovado" para a lista inteira (U1 a U6, P1 a P8, T1 a T6), sem ajuste pedido.
- Premissas P1 a P8: "concordo" com todas.
```

Registro do agente: as 20 linhas acima estão marcadas a partir dessa resposta do dono e de nada mais; nenhuma observação de navegador foi acrescentada por este registro.
