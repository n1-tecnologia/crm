# Phase 10: Clone ClickUp: Contêineres (Espaço, Pasta e Lista) - Research

**Researched:** 2026-10-28
**Domain:** domínio puro (`@n1/dominio`) + agendador Fastify/Postgres (`apps/api`) + árvore/páginas Next.js 16.3.4 (`apps/web`) — mover/reordenar contêineres, remover a Carga, Visualizações padrão e bloqueio de aspecto, migração só de dados (`010`)
**Confidence:** HIGH para tudo que é código do repositório (lido nesta sessão, com arquivo:linha); MEDIUM para o desenho de arrastar (HTML5 nativo, MDN) e para o regime de ensaio do agendador (decisão de desenho, não de fato); itens `[ASSUMED]` estão na tabela A1..A9.

## Project Constraints (from CLAUDE.md)

- `CLAUDE.md` importa `CONTEXT.md` (mapa das camadas) e `AGENTS.md`. Diretrizes que valem aqui:
  - `packages/dominio` não depende de nada; `apps/web` e `apps/api` dependem do domínio e **nunca um do outro**. Mudou "o que a coisa é" → domínio primeiro; "como aparece" → web; "como se guarda ou se serve" → api. Fase que toca as três **começa pelo domínio e desce**.
  - Next.js desta versão (16.3.4) difere do conhecido: ler `node_modules/next/dist/docs/` antes de recomendar padrão de App Router (feito para `useSearchParams`, ver Pitfall 12).
  - Migração aplicada é imutável (D-DEC-10); a próxima é a `010` (confirmado abaixo). `npm run migrar -w @n1/api -- --seco` antes de aplicar.
  - Código, comentários e docs em português. `npm run check` = tipos + lint + tokens + contratos + testes dos três workspaces.
- Memória do projeto (`MEMORY.md`): `npm test` leva 13–17 min e `lote-contas-a-pagar (d)` sempre falha por rede (use comandos por arquivo/workspace); `execute-phase` roda **sequencial** aqui (sem worktrees), então "colisão de arquivo" vira problema de **ordem**, não de merge; e2e local obrigatório para mudanças em `GET /estado`; o conector Supabase do claude.ai ainda não está na organização "N1".
- `./.claude/skills` e `./.agents/skills` não existem neste repositório (verificado) — nenhuma regra de skill de projeto a incorporar.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
D-01..D-22 de `10-CONTEXT.md` são travadas e **não foram reabertas**. Resumo operacional (o texto integral está em `10-CONTEXT.md` `<decisions>`; o planejador deve lê-lo, não este resumo):

- **D-01/D-02/D-03/D-04** — agendador visita também Listas com Tarefa recorrente por calendário e com Tarefa vencida na lixeira; Lista "só recorrência" nasce sem ensaio, Lista com Automação por vencimento mantém o ensaio; apagar `RunScheduledButton`, o item do menu "Automatizar" e reescrever o texto de `collaboration-editors.tsx`; checkpoint `[BLOCKING]` do dono sobre `AUTOMACOES_WORKER_ATIVO`; o botão só sai depois de a mudança do agendador estar publicada e a variável confirmada.
- **D-05/D-06/D-07** — abas Lista e Tabela continuam separadas; Visualização salva de tipo indisponível some da barra e volta junto; `VisualizacoesPadrao { disponiveis, inicial }`, `setContainerDefaultViews`, `VISUALIZACOES_DA_PLATAFORMA` sem migração de dados.
- **D-08..D-12** — Pastas e Listas em dois grupos (ordem por grupo); Espaços também reordenam; soltar em cima = mover (na hora se sem consequência, diálogo se houver), entre irmãos = reordenar; `moveContainer` com as recusas do D-11; **sem biblioteca nova de arrastar** (HTML5 nativo), pacote só pelo portão de legitimidade.
- **D-13/D-14** — capacidade semanal do Membro sai junto com a Carga (valor gravado é ignorado, não migrado); `carga`/`workload`/`WorkloadCell` saem.
- **D-15/D-16** — `blocks` só em Espaço e Pasta; `bloqueado` sai de `InheritanceMode`; `setContainerBlock`, `sobrescritasAbaixo`, `criarAutomacao` confere `blockedAbove(…, "automations")`.
- **D-17** — limpeza 2.1.4–2.1.10 como no documento de tarefas. **D-18/D-19** — `010` só de dados, aplicada em produção após `--seco` e conferência. **D-20** — as quatro operações novas na tabela "Quem pode"; `setMemberCapacity` sai dela. **D-21** — Fase 10 antes da 12. **D-22** — nenhum item novo da 2.7.

### Claude's Discretion
Nomes de módulos/esquemas/testes; forma interna de `reorderContainers` e `sobrescritasAbaixo`; onde mora `VISUALIZACOES_DA_PLATAFORMA`; **como classificar** Listas "só recorrência" × "com Automação por vencimento" sem duplicar regra do domínio; desenho das zonas de soltura/destaque/teclado; texto exato dos avisos e das linhas "Herdado de…/Definido aqui/Bloqueado por…"; quantos planos e em que ondas (respeitando domínio→tela e 2.1.6 → 2.5.4 → 2.6.2).

### Deferred Ideas (OUT OF SCOPE)
Tabela como planilha; Pastas e Listas misturadas na mesma ordem; confirmação em todo arrastar; converter pelo cartão do Quadro, subitens, menção na descrição, texto anterior, tempo registrado (Fase 11); medir/acelerar gravação e tabelas próprias (Fase 12); o que sobrar da 19.1 além do agendador.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EST-01 | Sem "Rodar agenda"/"Rodar automações por vencimento"; Lista só-recorrência gera a próxima ocorrência pelo agendador sem ensaio; dono confirmou agendador ligado | Findings F3–F6 (ator, ponte, 1 linha por volta, ensaio por par); § Scheduler design; § Validation |
| EST-02 | Uma só `SelecaoEmLote`; sem frases; contagem; página < 1.000 linhas; `check` passa | § Page split (1.407 → medido), ordem na página |
| EST-03 | Configurações em abas `?aba=`; sem "Aspectos configuráveis"; Espaço no formato da Pasta | Pitfall 12 (Suspense do shell já cobre `?aba=`); `container-settings.tsx` único ponto |
| EST-04 | `sem-codigo-de-regra.test.ts`; 13 textos | F12: contagem real = 13 (9 web + 4 domínio) e **um teste existente quebra** (`contas-a-receber.test.ts:129`) |
| EST-05 | `moveContainer`/`reorderContainers` + `mover-conteiner.test.ts` | § moveContainer (invariantes que o D-11 não lista), § reorder por fatias (I1), contadores `order` |
| EST-06 | Arrastar/mover na árvore, "Mover para…", ordem persiste | F1/F2 (veredito DnD; árvore **não ordena** por `order`), § DnD design |
| EST-07 | Sem Carga/capacidade; `saveView kind: carga` → 400 | F7/F8: lista exata de referências; o que NÃO rejeita a chave sobrante |
| EST-08 | Visualizações padrão do Espaço mudam as abas da Lista; `visualizacoes-padrao.test.ts` | `effectiveContainerConfig` (derive.ts:177-214), `abaDaView` tolerante |
| EST-09 | Tipo não deixa escrever `blocks` em Lista; `bloqueado` fora | F9: o que o compilador vai apontar; seeds a ajustar |
| EST-10 | `setContainerBlock` + interruptor; `bloqueio-de-aspecto.test.ts` | `definesAspect` único, vazamento de nome de contêiner privado (Security) |
| EST-11 | `010` aplicada em produção após `--seco`; contagens 0; 4 operações em "Quem pode" | F9/F10: `--seco` não conta; ordem deploy → 010; cadeia de registro |
</phase_requirements>

## Summary

A fase é majoritariamente **subtração e composição** sobre peças que já existem (`moveTask` e `setContainerFeature` são os gabaritos; `ActionMenu`, `ConfirmDialog`, `Abas` e o precedente de arrastar HTML5 já estão no repositório) e **nenhuma dependência nova é necessária**. O veredito sobre arrastar é: **HTML5 nativo basta** para o gesto de ponteiro (soltar dentro / entre irmãos), desde que o item em trânsito viva em estado React (o `dataTransfer` não é legível em `dragover`, [CITED: developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API]) e que o caminho de teclado/leitor de tela seja o menu "Mover para… / Subir / Descer", que o próprio MDN confirma que o arrastar não oferece.

A pesquisa achou **onze coisas que o CONTEXT assume de outro jeito** (tabela "Divergências" abaixo). As três que mudam o desenho do plano: (1) **o agendador não consegue executar nada em Listas fora de Contas a pagar/receber**, porque o ator dele (o "Agente do pipeline", Papel Convidado) só tem `administrar` nessas duas Listas e as três funções do relógio exigem administrar a Lista — D-01 sozinho faz cada Lista nova virar uma linha `falhou`/`RECUSA_DO_DOMINIO`; (2) com a ponte do Agente de lançamento ligada, o agendador chama **só** `runScheduledAutomations` — recorrência por calendário e expurgo da lixeira nunca rodam pela agenda; (3) `moveContainer` precisa de mais do que o D-11 lista (Tipo de Tarefa, link público, colisão de nome de Campo/Tipo no caminho novo, Formulário que pergunta Campo que deixa de valer, e `blockedAbove` **ignora o próprio nó** de destino) e `reorderContainers` **não pode** exigir a permutação completa, porque o estado que a tela tem é um recorte (privados/arquivados faltam).

**Primary recommendation:** domínio primeiro, em três planos de operação (remoções+tipos → Visualizações/bloqueio → mover/reordenar), cada um já com o esquema em `apps/api/src/rotas/esquemas/` e a linha em "Quem pode" **no mesmo plano** (o `satisfies EsquemasCompletos` quebra a compilação se separados); depois o agendador (ator por Lista decidido dentro da Unidade de Trabalho a partir de uma função pura do domínio); depois a cadeia sequencial da página da Lista (2.1.6 → 2.5.4 → 2.6.2, com o botão de 2.1.1 saindo **por último**, depois do checkpoint do dono); a `010` só roda em produção **depois** do deploy do código.

## Divergências: o que o CONTEXT assume e o código NÃO confirma

| # | CONTEXT assume | O código diz | Evidência | Impacto no plano |
|---|---|---|---|---|
| F1 | D-12: "a árvore de Chat em `app-shell.tsx` com `moveChatSessionToFolder`" é precedente de **arrastar** | A árvore de Chat **não arrasta**: move por item de menu "Mover para {pasta}". Só há `draggable` em `quadro.tsx`, `cartao-de-tarefa.tsx`, `calendario-mensal.tsx`, cartões do CRM e na página da Lista | `app-shell.tsx:933-936` (`mover` → `run(... moveChatSessionToFolder ...)`), `:953-963` (`menu={[… "Mover para …"`); `draggable` só em `quadro.tsx:263,285`, `calendario-mensal.tsx:93`, `quadro-do-funil.tsx`, `[lista]/page.tsx:1230,1262` | O precedente de **menu** é a ChatTree; o de **arrastar** é o calendário (`onDragOver`/`onDragLeave`/`onDrop` + `--acento-lavado`). O UI-SPEC já corrigiu isto (S1); o plano não deve citar a ChatTree como DnD |
| F2 | 2.3.2/D-08: "a árvore ordena por `order`" (`app-shell.tsx:645`); "ordem nova continua depois de recarregar" | Só os **Espaços** são ordenados por `order`. `foldersUnder`/`listsUnder` fazem `filter` sem `sort`; as páginas do Espaço e da Pasta também (`state.lists.filter(...)`, sem `sort`) | `app-shell.tsx:624-630` e `:641-648` (`.sort((a, b) => a.order - b.order)` só em `visibleSpaces`); `espacos/[espaco]/page.tsx:40-42`; `pastas/[pasta]/page.tsx:60-61` | Sem **ordenar por `order`** (desempate estável pela posição no array) em `foldersUnder`, `listsUnder`, nas duas páginas e em `sprintsOf` (já ordena `a.order`), `reorderContainers` grava e **nada muda na tela**. Tarefa explícita do plano (EST-06) |
| F3 | D-01: o agendador "passa a visitar" mais Listas | O ator é o Membro do Papel "Agente do pipeline" (Convidado) com `administrar` **só** em `CP.listId` e `CR.listId`. `runScheduledAutomations`, `runCalendarRecurrences` e `purgeExpiredTasks` abrem com `containerAdminRefusal` → `fail`. Em qualquer outra Lista a linha da agenda fecha `falhou`/`RECUSA_DO_DOMINIO` | `scheduler-worker.ts:337-338` (ator = `resolverMembroAgenteDoPipeline`); `solicitacao-de-pagamento-evolver.ts:113` (`const listasDoAgenteDoPipeline = (): readonly Id[] => [CP.listId, CR.listId];`) e `:528-562`; `automations.ts:761-762`, `collaboration.ts:555-556`, `tasks.ts:790-791` (`const admin = containerAdminRefusal(state, actingMemberId, "list", listId); if (admin) return fail(admin);`); `derive.ts:1074-1089` (Convidado só administra com concessão) | **Bloqueia D-01** se não houver ator por Lista. Ver § Scheduler design (opção recomendada: ator escolhido dentro de `executar()` por função pura do domínio) |
| F4 | D-01: a mudança é "quais pares o catálogo devolve" | Com `AGENTE_CONTAS_A_PAGAR_ATIVO=true` o `index.ts` passa `rodarAgenda: ponte?.rodarAgenda`; a `rodarAgenda` da ponte chama **só** `runScheduledAutomations` — para a Lista da ponte e para todas as outras ("segue o padrão do agendador" = `runScheduledAutomations`, não `agendaDoDia`). Recorrência por calendário e expurgo da lixeira **não rodam pela agenda** quando a ponte existe | `index.ts:222` (`rodarAgenda: ponte?.rodarAgenda,`); `invocar-agente.ts:1222-1241` (ambos os ramos retornam `runScheduledAutomations(...)`); `scheduler-worker.ts:184-198` (`agendaDoDia` compõe os 3 relógios, mas só é o padrão sem ponte) | A `rodarAgenda` da ponte precisa compor os três relógios (aceitar `opcoes` de `runScheduledAutomations` e chamar `runCalendarRecurrences` + `purgeExpiredTasks`). Teste: com ponte, Lista recorrente gera ocorrência |
| F5 | D-01: o worker "visita" as Listas | `iniciar()` dispara `processarUm()` **uma vez por `intervaloMs`** (padrão 1 h) e cada chamada processa **uma** linha. N pares no catálogo levam N horas por dia; com mais de ~24 pares o atraso cresce sem parar (a ordem `dia_civil, criado_em` faz o catch-up esperar) | `scheduler-worker.ts:610-621` (`setInterval(... void processarUm().finally ...)`), `:532` (`processarUm(): Promise<boolean>` devolve se processou uma linha); `.env.example:152-153` (`AUTOMACOES_INTERVALO_MS` padrão 3600000) | Trocar a volta por "drenar": `while (await processarUm())` (com teto por volta). Hoje são 2 pares; depois de D-01 serão dezenas |
| F6 | D-02: classificar o par para decidir o ensaio | `ensaioNaPrimeiraVolta` é opção **global** do worker (booleana), lida em `processarUm`: `const emEnsaio = ensaioNaPrimeiraVolta && (await primeiraVoltaPendente(...))`. Não há como decidir por par sem mudar essa linha. E "só recorrência" **não** é inofensivo quando a Lista entra pelo expurgo: a primeira volta real de `purgeExpiredTasks` **elimina de vez** (irreversível) toda Tarefa da lixeira acima do prazo | `scheduler-worker.ts:331,553`; `tasks.ts:781-808` (`purgeTask` por Tarefa vencida) | Decidir `emEnsaio` dentro do `executar()` com `state` (ver § Scheduler design) e tratar a Lista que entra **só** pela lixeira como decisão aberta (Q3) + contagem de lixeira vencida no checkpoint do dono |
| F7 | D-13: `weeklyCapacityMinutes` aparece em `membros/page.tsx` e `operations.test.ts` | A **chave literal** está em quatro lugares de código: `types/workspace.ts:128`, `seed-financeiro.ts:73`, `conversao-de-solicitacao.test.ts:130`, `operations/planning.ts:38,46,59,…`. `membros/page.tsx` e `operations.test.ts` usam os **nomes de função** (`memberCapacityMinutes`, `setMemberCapacity`, `CapacityEditor`). Faltam na lista do CONTEXT: `apps/api/.../esquemas/planejamento.test.ts` (linhas 17, 34, 83), `registro.ts` (11, 179, 544), `index.ts:187`, `planning-views.tsx:15,334` | `grep` completo desta sessão; ver tabela § Carga | Lista exata de arquivos no plano de remoção |
| F8 | D-13: conferir que `hidratar`/esquemas "não rejeitam a chave que sobrar" | **Confirmado: nada rejeita.** `hidratar` empurra `linha.dados` cru no array da coleção (sem Zod, sem projeção); os esquemas `.strict()` validam **só os `args` de `POST /operacoes`**, nunca o registro lido; `GET /estado` não tem esquema de resposta; `gravar` só regrava o que mudou (comparação canônica) | `repositorio.ts:86-100` (`state[linha.colecao]… lista.push(linha.dados)`); `esquemas-de-argumentos.ts` cabeçalho ("validação de TRANSPORTE"); `estado.ts:8-10` ("Sem schema de resposta zod") | A chave `weeklyCapacityMinutes` sobra inerte nos jsonb dos Membros; o tipo deixa de conhecê-la. Só TS: literais de objeto com a chave (seed, teste) deixam de compilar |
| F9 | D-19: "`--seco` lista o que `migrar` faria… o dono confere as contagens" | `--seco` só lista **nomes de arquivo** aplicados/pendentes; **não executa nem conta** nada do DML. A `010` é a **primeira migração com DML** (007/008/009 são só DDL) | `migrar.cli.ts:14-23`; `migrar.ts:41-56`; `grep` de `update|delete|insert` nas 007/008/009 (só `create/alter`) | O checkpoint do dono precisa de **consultas de contagem prontas** (e a `010` deve conter uma pós-condição `do $$ … raise exception` para a transação do runner desfazer se sobrar linha). Ver § Migração |
| F10 | D-20: as 4 operações "entram também no inventário/matriz de Papéis da suíte adversarial" | A suíte adversarial **não tem matriz por operação**. `inventario-de-rotas.test.ts` percorre **rotas** (`POST /operacoes/:nome` é uma só) e prova 401/401/403-suspenso com `args: []`; `matriz-de-papeis.test.ts` tem "uma rota representativa de cada família" (família `operacoes` = `trashContact`). **Nada a acrescentar falha se esquecido**; o que protege a operação nova é `quem-pode.test.ts` + `esquemas-de-argumentos.test.ts (j)` + `tsc` | `inventario-de-rotas.test.ts:246,255-257`; `matriz-de-papeis.test.ts` cabeçalho e `familia: "operacoes"` (linhas 107-111); `lacunas-do-dominio.test.ts` | Plano: acrescentar um caso **opcional** de Convidado/Membro sem administrar chamando `moveContainer`/`setContainerBlock` em `lacunas-do-dominio.test.ts` ou na família `operacoes`; não é portão |
| F11 | D-11: lista de recusas/efeitos de `moveContainer` | `moveTask` já faz mais três coisas que D-11 não cita: **Tipo de Tarefa** sem efeito no destino cai no primeiro do destino; **link público** revogado se o destino não permite; e (ontologia RN-PAS-14) colisão de nome de Campo próprio com o caminho novo rejeita; `blockedAbove` **pula o próprio nó** (`if (node.id === id) continue;`), então não olha o `blocks` do destino | `tasks.ts:545-559`; `ontologia/02-estrutura-de-trabalho/pasta.md:240` (RN-PAS-14) e `:299`; `configuration.ts:42-52`; `planning.ts:391` (`doPai` compensa exatamente isso) | Ver § moveContainer: helper compartilhado extraído de `moveTask` + recusas extras |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Regras de mover/reordenar, herança, bloqueio, Visualizações padrão, `sobrescritasAbaixo`, leituras L1–L5 | `@n1/dominio` | — | "o que a coisa é"; a tela e o endpoint aplicam a **mesma** função (regra do `CONTEXT.md` raiz) |
| Validação de transporte das 4 operações + remoção de `setMemberCapacity`/`carga` | `apps/api` (esquemas) | — | Zod `.strict()`, nenhuma regra de negócio (`esquemas/CONTEXT.md`) |
| Qual Lista o relógio visita; ator; ensaio × direto | `apps/api` (`scheduler-worker.ts`) decide **quais pares**; o domínio decide **o regime e o ator** | SQL de catálogo candidato | O catálogo SQL é só candidato (comentário `scheduler-worker.ts:263-271`); a regra mora no domínio |
| `010` (dados) | `apps/api` (migração) | Postgres | Só DML sobre `plataforma.registros`, dono do banco via `DATABASE_URL_MIGRACAO` |
| Árvore: arrastar, zonas, realce, menu de linha | `apps/web` (cliente) | domínio (L1–L3 desligam/recusam) | Estado do gesto é de UI; a recusa é do domínio |
| Diálogo "Mover para…", Configurações em abas, editor de Visualizações, interruptor | `apps/web` | domínio (leituras) | Montados na casca (`?mover=`) e em `container-settings.tsx` |
| Ordem persistida (`order`) | domínio grava; web **ordena na leitura** | Postgres `registros.dados` | Nada derivado é armazenado; a ordenação é leitura (F2) |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.3.4 | App Router, `useSearchParams`/`router.replace` | já em uso [VERIFIED: apps/web/package.json] |
| React | 19.2.8 | UI | já em uso [VERIFIED: apps/web/package.json] |
| Zod | ^4.6.1 (web) / do `apps/api` | esquemas `.strict()` das operações | padrão da pasta `esquemas/` [VERIFIED: esquemas/CONTEXT.md regra 2] |
| Vitest | ^5.0.0 (v5.0.1 rodou nesta sessão) | testes dos três workspaces | `cd packages/dominio && npx vitest run src/quem-pode.test.ts` → 6 passed, ~1 s [VERIFIED: execução nesta sessão] |
| `@testing-library/react` + jsdom | ^16.3.3 / ^30.1.0 | testes de componente; arrastar simulado por `fireEvent.dragStart/dragOver/drop` | precedente `features/crm/quadro-do-funil.test.tsx:266-322` [VERIFIED] |
| HTML5 Drag and Drop nativo | — | arrastar na árvore | sem biblioteca (D-12); 4 precedentes no repo |
| `pg` + Postgres 16 | — | agendador/migração | `postgres:16` já é o serviço do job `seguranca` [VERIFIED: .github/workflows check.yml] |

### Supporting / Alternatives
Nenhum pacote novo. **Alternativa considerada e descartada:** `dnd-kit` ou similar — não é necessário (veredito § DnD). Se o planejador discordar do veredito, o portão é o das Fases 1–2: `gsd-tools query package-legitimacy check --ecosystem npm <pkg>` mostrando `OK`, mais `checkpoint:human-verify` antes de qualquer `npm install`; **o planejador não instala por iniciativa própria** (D-12).

**Installation:** nenhuma. **Version verification:** não se aplica (nada a instalar).

## Package Legitimacy Audit

Esta fase **não instala pacote externo** (D-12 + veredito do HTML5 nativo). O seam `package-legitimacy check` não foi executado porque não há candidato. Pacotes removidos por `SLOP`: nenhum. Pacotes `SUS`: nenhum.

## Architecture Patterns

### System Architecture Diagram

```
 (dono arrasta / abre menu)                       (dono mexe nas Configurações)
          │                                                  │
          ▼                                                  ▼
  StructureTree/TreeRow ──zona(y,rect)──► L1/L2/L3 (derive: recusa? consequência?)   container-settings (abas ?aba=)
          │  recusa ─► Toast erro                            │ sobrescritasAbaixo / blockedAbove (L4/L5)
          │  sem consequência ─► runConfirmado(moveContainer)│ ─► run(setContainerDefaultViews | setContainerBlock)
          │  com consequência ─► ?mover=…&destino=… ─► MoverConteinerDialog ─► runConfirmado(moveContainer + mapeamento)
          ▼                                                  ▼
      store.rodarNaCopia ──(copia local filtrada)──► OperationResult  ──(ok)──► POST /operacoes/:nome
                                                                                     │ recusarSuspenso → 403
                                                                                     │ esquema Zod strict → 400
                                                                                     ▼
                                              executar(): hidratar(Espaço INTEIRO) → operação do domínio → gravar(diff) → revisão+1
                                                                                     ▼
                                                              plataforma.registros (lists/folders/spaces/views/tasks/activity)

 Relógio:  setInterval ─► processarUm() ─► semear(catálogo SQL candidato: automations ∪ tasks(recorrência) ∪ tasks(lixeira))
            ─► reivindicar(linha) ─► executar(workspace, state ⇒ { ator = atorDoRelogio(state, lista); regime = domínio(state, lista);
                                       agendaDoDia(state, ator, lista, dia) ; se ensaio ⇒ ok:false forçado }) ─► fecharLinha
```

### Recommended Project Structure (arquivos novos; nomes livres)
```
packages/dominio/src/
├── operations/
│   ├── mover-conteiner.test.ts          # EST-05
│   ├── visualizacoes-padrao.test.ts     # EST-08
│   ├── bloqueio-de-aspecto.test.ts      # EST-10
│   └── agenda-do-relogio.test.ts        # EST-01 (regime + ator, puros)
├── derive.ts                            # + visualizações efetivas, sobrescritasAbaixo, definesAspect, leituras L1–L5
apps/api/
├── migracoes/010-<nome>.sql             # só dados
├── src/persistencia/migracao-010.test.ts# DML contra Postgres local (poolDoDono)
└── src/automacoes/scheduler-worker.ts   # catálogo ampliado, ator/regime por Lista, drenar a volta
apps/web/src/
├── features/shell/zona-de-soltura.ts(+test)   # função PURA (y, rect, quem, alvo) → zona
├── features/shell/arrastar-na-arvore.ts(x)    # hook de estado do gesto (não incha app-shell.tsx, já 1.150 linhas)
├── features/estrutura/{selecao-em-lote,barra-de-criacao,quadro-de-tarefas,tabela-plana,mover-conteiner-dialog,editor-de-visualizacoes-padrao,cabecalho-do-aspecto}.tsx
└── features/estrutura/sem-codigo-de-regra.test.ts
```

### Pattern 1: Cadeia de registro de uma operação nova (item 6 da pergunta)

Ordem e **o teste que falha** se faltar cada elo (todos verificados nesta sessão):

| Elo | Arquivo | Se faltar |
|-----|---------|-----------|
| Tipo/assinatura | `packages/dominio/src/types/*.ts` + operação em `operations/structure.ts` ou `configuration.ts` | `tsc` |
| Registro | `operations/registro.ts`: `import {…}` do módulo **e** entrada em `OPERACOES` (ex.: import `structure` em `registro.ts:217`, entradas `setContainerFeature` `:529`) | `registro.test.ts` "operations/index.ts instrumenta TODAS as chaves" (índice) e `ehNomeDeOperacao` |
| Instrumentação | `operations/index.ts`: `export const X = instrumentar("X")` (ex.: `index.ts:166`) | `registro.test.ts:25-34` ("nenhuma esquecida") |
| Esquema Zod | `apps/api/src/rotas/esquemas/<modulo>.ts` com `satisfies Esquemas` | **`tsc` do `apps/api`** (`EsquemasCompletos = { readonly [N in NomeDeOperacao]: z.ZodType<ArgumentosDe<N>> }`, `fragmentos.ts:39`) e `esquemas-de-argumentos.test.ts (j)` (`expect(chaves.length).toBe(286)`) |
| Teste do esquema | `esquemas/<modulo>.test.ts` "(a) cobertura — as N chaves" (ex.: `estrutura.test.ts` hoje lista exatamente 8) e "(b) formas literais do web" | o teste (a) do arquivo |
| Tabela "Quem pode" | `packages/dominio/CONTEXT.md` seção `## Quem pode (1.2.4)`: `\| \`op\` \| \`operations/<arq>.ts\` \| conferência \| observação \|` | `quem-pode.test.ts` (5 asserções: sem linha, linha órfã, duplicada, "Conferência" vazia/"a conferir", e **Arquivo = módulo de onde `registro.ts` importa**) |
| Contagem | `esquemas-de-argumentos.test.ts:103-107` e comentário-cabeçalho | atualizar **286 → 289** (286 − `setMemberCapacity` + 4 novas) [VERIFIED: teste verde com 286 nesta sessão] |

Corolário de planejamento: **registro + `index.ts` + esquema + linha de "Quem pode" + teste do esquema vão no mesmo plano** que cria/remove a operação — separados, o `tsc` do `apps/api` fica vermelho no meio da onda.

### Pattern 2: Leituras puras L1–L5 compartilhadas (operação **e** tela)
O UI-SPEC pede cinco leituras no domínio. Uma única implementação por regra, chamada pela operação e pela tela: `moveContainer` chama `recusaDeMover(...)` e depois exige mapeamento; a tela chama a mesma antes de realçar/soltar. Mesma disciplina de `taskWriteRefusal` ("as operações recusam com esta frase; a tela desliga o controle com ela", `derive.ts:937-942`). Para L5, `blockedAbove` hoje devolve só a frase (`configuration.ts:42-52`): acrescentar uma irmã que devolva o contêiner `{ tipo, id, nome }`.

### Pattern 3: `moveContainer` (algoritmo e invariantes)

Vive em `structure.ts` (usa `mayBuild`, `nameTaken`, `requireContainer`, `siblingsOf`, `descendantsOf`, todos **privados** do módulo — não crie `mover.ts` à parte sem exportá-los). Ordem das verificações, com o **mesmo** texto-fonte para cada uma:

1. `requireContainer` do movido (RN-ESP-15) e `containerAdminRefusal(state, actor, tipo, id)`; destino: `mayBuild(state, actor, destino)` (é isto que "criar no destino" significa neste código: `mayBuild` = Membro ativo, não Convidado, alcança o pai; não existe verificação `criar` separada) [VERIFIED: structure.ts:19-31].
2. Destino existe e `effectiveLifecycleOfContainer(destino) === "ativo"`; movido pode estar arquivado (RN-PAS-11, `pasta.md:237`).
3. Mesmo lugar/abaixo do movido: `containerPath(state, destino.parentType, destino.parentId)` contém `id` ⇒ recusa; `parentType/parentId` iguais ⇒ recusa (a tela trata "mesmo pai" como não-alvo, A10).
4. Profundidade: Pasta com Subpastas para dentro de Pasta (RN-SUB-11); qualquer Pasta para dentro de Subpasta (`destino.parentType === "folder"` e o destino é Subpasta; RN-SUB-02). Mensagem existente a reaproveitar: `"Uma Subpasta não contém outra Pasta: a estrutura para aqui."` [VERIFIED: structure.ts:199].
5. `nameTaken(siblingsDoDestino, nome)` (RN-ESP-23/B39).
6. **Bloqueio (RN-ESP-09/B25):** para cada aspecto que **substitui** (`statusSet`, `features`, `defaultViews`) e que o movido **ou qualquer descendente** define, recusar se o destino **ou um ancestral** o bloqueia. **Atenção:** `blockedAbove(state, destType, destId, aspecto)` pula o próprio `destId` (`configuration.ts:44`); incluir `destino.blocks[aspecto]` à mão (precedente: `planning.ts:391`, `doPai`). Reusar o mesmo predicado `definesAspect(state, tipo, id, aspecto)` que `sobrescritasAbaixo` usa (um só lugar para "quem define o quê"). Para aspectos que **acumulam** (`fieldDefinitions`, `taskTypes`, `automations`) a leitura consistente com D-16 é: o que já existe permanece, logo **não** recusar (decisão A5, confirmar).
7. **Colisão de nome no caminho novo** (ontologia RN-PAS-14, `pasta.md:240`; DO-LIS-05): Campo/Tipo definido no movido ou abaixo cujo nome já é efetivo no caminho do destino (`fieldNameCollision`/`taskTypeNameCollision` já existem em `configuration.ts:78-97`, mas são privadas — exportar).
8. **Formulário ativo abaixo** que pergunta um Campo que deixaria de valer: recusar com o mesmo critério e frase-modelo de `usarCampoHerdado` (`configuration.ts:~870`: "o envio quebraria"). Sem isso o Formulário público passa a responder "não se aplica à Lista".
9. **Conjunto de Status:** calcular, **antes de mutar**, `effectiveListConfig` de cada Lista da subárvore (`descendantsOf` já devolve `lists` e `tasks`); mutar `parentType/parentId` (+`order`); recalcular. Se `from.statusSet.id !== to.statusSet.id` (o critério exato de `moveTask`, `tasks.ts:501`), exigir `StatusMapping` para cada `statusId` em uso por **qualquer** Tarefa da subárvore (todos os `lifecycle`, subtarefas incluídas) — as Listas afetadas herdam **todas do mesmo ancestral acima do movido**, logo há um único Conjunto de origem e o mapeamento por `fromStatusId` basta. Recusar com `Mapeie …` reaproveitando a frase de `moveTask`.
10. **Por Tarefa, o mesmo bloco de `moveTask`** (`tasks.ts:545-559`): B37 (`value.state = keptDefinitions.has(value.definitionId) ? "ativo" : "arquivado"`), Tipo de Tarefa fora do destino → `to.taskTypeIds[0]`, link público revogado se `!to.features.compartilhamentoPublico`. **Extrair esse laço de `moveTask` para uma função compartilhada** (ex.: `aplicarConfiguracaoEfetiva(state, tarefas, from, to, mapeamento, ator)`) e usar nas duas operações — senão as duas divergem na primeira mudança. O laço de `moveTask` troca também `item.listId`; na versão compartilhada `listId` fica de fora (no container-move ele não muda).
11. **Contador `order`** (ver Pitfall 3) e Atividade: "Lista movida" / "Pasta movida" / "Subpasta promovida a Pasta" / "Pasta rebaixada a Subpasta" com **caminho** em `before`/`after` (UI-SPEC § Atividade), exatamente como `moveTask` grava `before: previousPath` (`tasks.ts:569`).

Nada derivado é armazenado: `containerPath`, `effectiveContainerConfig`, ciclo de vida efetivo e visibilidade (B38a) são lidos ao longo do caminho (`derive.ts:43-72,177-214,995-1006`), então mudar `parentType/parentId` reconfigura a herança e a privacidade **sozinho**; o que a operação precisa é tratar o que está **armazenado** e depende do caminho (status em uso, `FieldValue.state`, `taskTypeId`, `publicShare`, `order`).

**Estruturas âncora (decisão aberta Q2):** a Pasta `MEUS_NEGOCIOS_ID = "fld_meus_negocios"` [VERIFIED: seed-comercial.ts:27] e as Listas `CP.listId`/`CR.listId` são endereçadas por constante por evoluers, ponte e CRM. O UI-SPEC (A9) as tira do arrastar, mas o domínio aceitaria o `POST`. Defesa em profundidade barata: um conjunto fechado de ids âncora que `moveContainer` recusa.

### Pattern 4: `reorderContainers` por **fatia**, não por permutação completa (I1)

O estado do Membro é um recorte (`visibilidadePara` remove contêineres privados que ele não alcança, `derive-visibilidade.ts:108-130`), a árvore esconde arquivados/lixeira, e `rodarNaCopia` executa a operação **na cópia filtrada** (`store.ts:202-232`) antes de o servidor rodar a mesma operação sobre o Espaço **inteiro**. Uma regra "faltou/sobrou id ⇒ recusa" dá resultados diferentes nos dois lados e recusa quem não vê todos os irmãos. Desenho recomendado (ajuste explícito ao D-08/2.3.2, a confirmar com o dono — A3):

- Assinatura: `reorderContainers(state, actor, tipo: "space" | "folder" | "list", pai: { type: "space" | "folder"; id } | undefined, ids: Id[])` (`pai` ausente só para `space`).
- Validar: `ids` sem repetição; todos pertencem ao grupo `(tipo, pai)`; o ator alcança cada um; recusa se pai inativo ou falhar `mayBuild(pai)` (A4: o análogo de "`editar` no pai" neste código — não existe checagem `editar` de contêiner; o grupo `WRITE_ACTIONS` de `derive.ts:953` é de Tarefa); recusa vazio.
- Aplicar por **preenchimento de vagas**: ordenar o grupo inteiro (do estado em que a operação roda) por `order` (desempate pela posição no array); as vagas ocupadas pelos `ids` recebidos são reocupadas na nova sequência; irmãos não citados (escondidos/arquivados/lixeira) **não saem do lugar**. Regravar `order` do grupo como 0..n-1 (compacta buracos). Funciona igual na cópia filtrada e no servidor.
- Atividade "Ordem alterada" no pai. `ActivityRecord.objectType` é `string` livre (`readonly objectType: string;`, `types/primitives.ts:274`), então para a ordem dos Espaços basta `objectType: "workspace"` com `objectId: state.workspace.id` — sem tipo novo.

### Pattern 5: `setContainerDefaultViews` e `setContainerBlock` (gabarito `setContainerFeature`)

`setContainerFeature` (`configuration.ts:825-865`) é o molde literal: `findContainer` → `mayConfigure` → `lifecycle === "ativo"` → `blockedAbove` → mutar → `container.modes = {…, features: … "sobrescrito" : "herdado"}` → `recordActivity` com `detail`/`before`/`after` só se mudou. Para `defaultViews`: nó mais próximo que define vence **por inteiro** (diferente de `features`, que mescla por chave: `derive.ts:208-211`); `EffectiveListConfig` ganha `views` (único construtor: `derive.ts:213`; `grep` nesta sessão não achou outro literal de `EffectiveListConfig`). Rejeitar `disponiveis` vazio e `inicial` fora de `disponiveis` (D-07). Para `setContainerBlock`: **um** predicado `definesAspect` — `statusSet` ⇒ `container.statusSet !== undefined`; `features` ⇒ `modes.features === "sobrescrito"`; `defaultViews` ⇒ `defaultViews !== undefined`; `fieldDefinitions` ⇒ alguma `FieldDefinition` ativa com `definedAtId === id`; `taskTypes` ⇒ algum `TaskType` não-padrão com `definedAtId === id`; `automations` ⇒ alguma Automação não-lixeira com `scopeType/scopeId` — usado por `sobrescritasAbaixo` (bloquear) **e** pela recusa de `moveContainer` (item 6). Só `statusSet`, `features`, `defaultViews` recusam por sobrescrita abaixo (D-16). `criarAutomacao` (`ia/automacoes-editor.ts:194`) hoje só chama `recusaDeConvidado`; acrescentar `blockedAbove` quando `scopeType` for `folder`/`list` (`AutomationScopeType` inclui `space`, `folder`, `list`, … — `types/ai.ts:486-498`) e atualizar a linha dela na tabela "Quem pode" (hoje `recusaDeConvidado`).

### Anti-Patterns to Avoid
- **Repetir a regra "tem Automação por vencimento" no SQL ou na web.** O botão de hoje já a repete na web (`bulk-status-bar.tsx:~192`: `a.versions.some((v) => v.state === "publicada" && v.trigger?.kind === "condicaoTemporal")`) e o catálogo SQL a repete em candidato; a fonte única é o domínio (`publishedVersion` pega a **última** versão publicada, `automations.ts:139-141`).
- **Dar `administrar` ao Agente do pipeline em cada Espaço** para resolver F3: a credencial de serviço dele é usada por HTTP externo (`service_credentials.member_id`); alargar o alcance dele alarga o raio de explosão. Prefira escolher o ator **dentro** do processo.
- **Ler o `dataTransfer` em `dragover`** (a loja de dados só é legível em `dragstart` e `drop`) — o item em trânsito fica em estado do `StructureTree`.
- **Reordenar gravando só `order` sem ordenar na leitura** (F2).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Arrastar na árvore | biblioteca de DnD | HTML5 nativo + função pura de zona | 4 precedentes; teclado é o menu (MDN: o arrastar não oferece teclado) |
| Mapeamento de Status ao mover | tabela nova | `StatusMapping` (`tasks.ts:455-458`) + padrão de `move-task-dialog.tsx` | já valida "mapeie todos os Status em uso" |
| B37/Tipo/link público ao mover | laço novo | **extrair de `moveTask`** (`tasks.ts:545-559`) | duas operações, uma regra |
| "Quem administra/alcança" | checagem nova | `containerAdminRefusal`, `memberReachesContainer`, `mayBuild` | privacidade B38a já embutida |
| Convenção de pegar contêiner por tipo | `findContainer` próprio | `findContainer` de `structure.ts:504`/`configuration.ts:~110` | já duplicado 2×; **exportar um** em vez de criar o 3º |
| Permutação/ordem do CRM | algoritmo novo | `PUT /funis/:id/etapas/ordem` é o precedente de forma; o algoritmo de fatia é próprio (Pattern 4) | o CRM recebe a lista completa porque o Membro vê tudo da Etapa |
| Aba na URL | estado próprio | `useSearchParams` + `router.replace(…, { scroll: false })` como em `move-task-dialog.tsx:34-48` e 7 outras telas | padrão do repo |
| Contar/validar a `010` | script ad hoc | pós-condição `do $$ … raise exception` dentro da própria migração + teste em Postgres local | a transação do runner desfaz se falhar (`migrar.ts:74-85`) |

**Key insight:** quase tudo que parece novo é recomposição de funções que o domínio já tem; o risco está nas **bordas que o compilador não vê** (herança derivada, estado armazenado dependente do caminho, recorte de visibilidade, ator do relógio).

## Runtime State Inventory

Fase de remoção/migração parcial (Carga, capacidade, `blocks` da Lista). As cinco categorias, respondidas:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `plataforma.registros` onde `colecao = 'views'` e `dados->>'kind' = 'carga'` (quantidade **desconhecida**: o conector Supabase não alcança a organização "N1", STATE/CONTEXT); `colecao = 'lists'` com a chave `blocks` — **todas** as Listas têm `blocks: {}` (criadas por `createList`, `structure.ts:358`, e por template `:269`), então a contagem "com a chave" ≈ total de Listas, e a que importa é "com `blocks` **não vazio**" (efeito nulo: Lista não tem descendente); `colecao = 'members'` com `weeklyCapacityMinutes` (fica **inerte**, F8); `plataforma.automacao_agenda`: linhas novas por Lista (D-01) | **010** (code-free de DDL): (a) `views` carga → `lista`; (b) `lists` sem `blocks`; contar antes/depois; **migração de dados**, não edição de código. Capacidade: nada a migrar (ignorada) |
| Live service config | Nenhum serviço externo guarda "carga"/capacidade. O que vive **fora do git** e muda o comportamento do agendador: variáveis da VPS (`api.env`, Fase 9 D-07) — `AUTOMACOES_WORKER_ATIVO`, `AUTOMACOES_ESPACO_ID`, `AUTOMACOES_LISTA_ID`, `AUTOMACOES_ATOR_MEMBER_ID`, `AUTOMACOES_ENSAIO_PRIMEIRA_VOLTA`, `AUTOMACOES_INTERVALO_MS`, `AGENTE_CONTAS_A_PAGAR_ATIVO` | Checkpoint do dono (D-04) lista **todas**, não só `WORKER_ATIVO` (ver § Ações do dono) |
| OS-registered state | Unidade systemd da API na VPS (`n1-crm-api`, Fase 9) lê o `api.env`; nenhuma string "carga"/"capacidade" está registrada no SO | Reiniciar o serviço ao mudar o `api.env` (já é o fluxo da Fase 9); nada a renomear |
| Secrets/env vars | Nenhum segredo renomeado. `AUTOMACOES_ATOR_MEMBER_ID` deve estar **vazio** (`.env.example:218-223`) — se estiver preenchido, o ator por Lista (F3) é ignorado | Conferir no checkpoint |
| Build artifacts | `@n1/dominio` é consumido como fonte pelos workspaces (sem artefato publicado); nenhum `egg-info`/binário com o nome antigo | None — verificado por `workspaces` em `package.json` raiz |

**Pendência herdada de STATE.md:** "antes de ligar qualquer worker de scheduler em produção: remover ou excluir do catálogo os ~14 Espaços de teste com Automações temporais ativas" (STATE.md, Blockers, WR-A/05-25). `AUTOMACOES_ESPACO_ID=ws_n1` estreita o catálogo e a semeadura a um Espaço [VERIFIED: scheduler-worker.ts:278-287, index.ts:208-209] — é a mitigação de um comando.

## Common Pitfalls

### Pitfall 1: Relógio sem ator que administre a Lista (F3)
**What goes wrong:** cada Lista nova do catálogo vira linha `falhou` com `RECUSA_DO_DOMINIO` ("Configurar a Estrutura exige administrar o contêiner…"); o dono acha que o servidor "cuida" e a recorrência nunca gera.
**Why:** `containerAdminRefusal` exige Papel Proprietário/Administrador **ou** concessão `administrar`; o Agente do pipeline é Convidado e só tem concessão em CP/CR (`solicitacao-de-pagamento-evolver.ts:528-562`).
**How to avoid:** ator escolhido por Lista dentro do `executar()` (§ Scheduler design); teste com uma Lista fora de CP/CR.
**Warning signs:** linhas `falhou`/`RECUSA_DO_DOMINIO` em `plataforma.automacao_agenda` para Listas novas; `tentativas` chegando a 3.

### Pitfall 2: Ponte ligada ⇒ recorrência e expurgo nunca rodam (F4)
Verificar `AGENTE_CONTAS_A_PAGAR_ATIVO` em produção; mesmo desligada, o teste de unidade da `rodarAgenda` da ponte deve provar que ela compõe os três relógios.

### Pitfall 3: Contador `order` duplica depois de mover
**What goes wrong:** `createSpace/Folder/List` fazem `order: <irmãos>.length` (`structure.ts:93,227,352`; templates `:121,:264`) e `siblings` **inclui lixeira** (sem filtro de `lifecycle`). Mover a Lista de ordem 1 para outro pai deixa o grupo de origem com 0,2; a próxima criação ganha `order: 2` — **duplicada**. 
**How to avoid:** `moveContainer` e `reorderContainers` renumeram o grupo de origem/destino 0..n-1 e o item movido entra no fim (`max(order)+1` do destino); trocar `length` por `max+1` nas três criações é ajuste de uma linha e fecha o buraco; teste: mover, criar, `order` único.
**Warning signs:** dois itens com o mesmo `order` no mesmo pai.

### Pitfall 4: `blocks` removido da Lista derruba o código **antigo**
`container-settings.tsx:235` faz `container.blocks[item.aspect]` para qualquer contêiner. Aplicar a `010(b)` **antes** do deploy do código novo estoura a página de Configurações de toda Lista (`undefined[...]`). Ordem obrigatória: **deploy → `--seco` + contagens → `010` → contagens = 0**. A recíproca é segura se `abaDaView` for tolerante: hoje `abaDaView` devolve `kind ?? "lista"` (`tipo-de-visualizacao.ts:22-25`), então uma salva `carga` remanescente passaria `"carga"` adiante e `ROTULO_DA_ABA["carga"]` (que deixa de existir) vira `undefined` em `view-bar.tsx:99,214`. Tornar `abaDaView` total: qualquer valor fora de `ROTULO_DA_ABA` ⇒ `"lista"`.

### Pitfall 5: `--seco` não conta (F9)
O dono espera "ver o que a `010` faria". Entregar no checkpoint as duas consultas de contagem prontas (§ Code Examples) e, depois da aplicação, a mesma pergunta com resposta 0.

### Pitfall 6: Estado do Membro é recorte (I1, F-reorder)
Ver Pattern 4. O mesmo recorte afeta o mapeamento de `moveContainer` na **cópia local**: Tarefas ocultas ao Membro não entram no cálculo local de "Status em uso", e o **servidor** (estado inteiro) pode recusar com "Mapeie…". Aceitável (a recusa do servidor aparece no diálogo, UI-SPEC S2), mas o teste de integração deve cobrir um Membro que não vê todas as Tarefas.

### Pitfall 7: Vazamento do nome de contêiner privado na recusa
`setContainerBlock` "nomeia quais" sobrescrevem (D-16) e `moveContainer` pode listar conflitos (ontologia: "rejeitada com a lista dos conflitos"). Nomear Pasta/Lista privada que o ator **não alcança** vaza informação (B38a). Nomear só as que `memberReachesContainer` e acrescentar "e N que você não alcança".

### Pitfall 8: `ActionMenu` e linha arrastável
A âncora do `Link` é arrastável por padrão ("images, links, and selections are draggable by default", MDN). Com `draggable` no `div` da linha, o arrastar que começa sobre o texto leva a **URL**, não a linha, se a âncora não receber `draggable={false}` (A10-bis do UI-SPEC). `dragleave` dispara ao cruzar filhos: limpar o realce por `dragend`/saída da árvore, não por `dragleave` de cada linha (o precedente `calendario-mensal.tsx:149-160` limpa por `dragleave` porque a célula tem filhos pouco profundos; a árvore tem botão, link, ícones).

### Pitfall 9: Testes de banco que leem o `.env` remoto
`carregarEnv()` só preenche variável **ausente** (`conexao.ts:20`), e vários arquivos usam `Boolean(process.env.DATABASE_URL)` (`scheduler-worker.test.ts:38`, `persistencia.test.ts:24`, …). Sem `DATABASE_URL` explícita, o vitest **lê o `.env` e fala com o Postgres remoto** (foi assim que ficaram os ~14 Espaços de teste em produção). Sempre prefixar: `DATABASE_URL=` (vazio ⇒ pula) ou uma URL `localhost`. Testes novos usam `describeComBanco` (`testes/banco-crm.ts:37`, só host local).

### Pitfall 10: Dois testes existentes quebram com as remoções
- `contas-a-receber.test.ts:129`: `expect(dobrada.error).toMatch(/RN-CR-07/)` — o código sai do texto (2.1.10, `financeiro.ts:1829`); trocar por trecho de frase.
- `operations.test.ts:24,90,3361-3376`: `workload` e `setMemberCapacity` saem do teste "Carga"/"Capacidade".

### Pitfall 11: Mock/literal de `List` com `blocks`
`blocks` sai de `List`: todo literal `blocks: {}` de Lista (seeds `seed.ts:2159,2173,2189` — conferir qual é Lista —, `seed-financeiro.ts:138,155,171`, `seed-comercial.ts:52,97`, `seed-pos-venda.ts:82`, `seed-contas-a-receber.ts:92`, `solicitacao-de-pagamento-evolver.ts:158`, `structure.ts:269,358`) deixa de compilar por excesso de propriedade; o `tsc` aponta todos. Não são "dados a migrar", são literais a editar. `seed.ts:291` (`marketing.blocks = { fieldDefinitions: true }`) é Espaço/Pasta — fica.

### Pitfall 12: `?aba=` e `useSearchParams` em Next 16
O guia local diz que, em build de produção, página estática com `useSearchParams` sem `<Suspense>` **quebra o build** [CITED: node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md:180-182]. Aqui já há fronteira: `app/(shell)/layout.tsx` envolve as rotas da casca em `<Suspense>` (comentário `:25-29`: "as telas e os quinze diálogos leem o endereço com `useSearchParams()`") [VERIFIED]. Logo `ContainerSettings` e o diálogo `?mover=` na casca são seguros; o e2e do Playwright roda contra o **build de produção** (`apps/web/e2e/CONTEXT.md`) — se quiser provar, é lá.

## Code Examples

> Ilustrativos; nomes livres. Valores do repositório citados abaixo foram **lidos nesta sessão**.

**Valores literais do repositório que os exemplos usam (verbatim):**
- `export type InheritanceMode = "herdado" | "sobrescrito" | "bloqueado";` [types/structure.ts:73] → vira `"herdado" | "sobrescrito"`.
- `export type ConfigurableAspect = | "statusSet" | "fieldDefinitions" | "taskTypes" | "features" | "defaultViews" | "automations";` [types/structure.ts:83-89].
- `kind: "lista" | "quadro" | "calendario" | "linhaDoTempo" | "tabela" | "carga";` [types/structure.ts:111]; web: `export type TipoDeAba = "lista" | "quadro" | "calendario" | "tabela" | "linha" | "carga";` [tipo-de-visualizacao.ts:11]; API: `const VIEW_KIND = z.enum(["lista", "quadro", "calendario", "linhaDoTempo", "tabela", "carga"]);` [esquemas/escala.ts:12].
- `readonly triggerMode: "aoConcluir" | "porCalendario";` [types/structure.ts:322]; `export type Lifecycle = "ativo" | "arquivado" | "naLixeira";` [types/primitives.ts:55].
- Coleções: `members: true` (`colecoes.ts:26`), `views: true` (`:37`), `lists: true` (`:41`), `tasks: true` (`:42`), `automations: true` (`:59`). Coluna gerada: `add column list_id text generated always as (dados->>'listId') stored;` [migracoes/002-registros-colunas-geradas.sql].
- Códigos da agenda: `MARCO_ZERO`, `ENSAIO_PRIMEIRA_VOLTA`, `LEASE_EXPIRADO`, `RECUSA_DO_DOMINIO`, `CONFLITO_DE_REVISAO`, `ERRO_INESPERADO` [scheduler-worker.ts:142].
- Cabeçalho da tabela "Quem pode": `## Quem pode (1.2.4)` e linhas `| \`setContainerFeature\` | \`operations/configuration.ts\` | \`containerAdminRefusal\` | via \`mayConfigure\` |` [packages/dominio/CONTEXT.md:59,183].

### `010` (modelo; nome do arquivo livre, número **fixo**: `010-…sql` — a pasta termina em `009-seguranca-e-cofre.sql`)
```sql
-- Só dados. Nenhum DDL. Idempotente.
update plataforma.registros
   set dados = jsonb_set(dados, '{kind}', '"lista"')
 where colecao = 'views' and dados->>'kind' = 'carga';

update plataforma.registros
   set dados = dados - 'blocks'
 where colecao = 'lists' and dados ? 'blocks';

-- Pós-condição: a transação do runner (migrar.ts: begin/commit/rollback) desfaz tudo se sobrar linha.
do $$
begin
  if exists (select 1 from plataforma.registros where colecao = 'views' and dados->>'kind' = 'carga')
     or exists (select 1 from plataforma.registros where colecao = 'lists' and dados ? 'blocks') then
    raise exception '010: ainda há Visualização carga ou Lista com blocks';
  end if;
end $$;

-- Endurecimento opcional (A6): sem isto o cliente aberto só vê o dado novo na próxima gravação.
update plataforma.workspaces set revisao = revisao + 1, atualizado_em = now();
```
Contagens **antes** (o dono roda; `--seco` só lista arquivos): `select count(*) from plataforma.registros where colecao='views' and dados->>'kind'='carga';` · `select count(*) from plataforma.registros where colecao='lists' and dados ? 'blocks';` · e a que importa: `… and dados->'blocks' <> '{}'::jsonb;` (se > 0, olhar antes de apagar — mas Lista não tem descendente, então bloquear nela nunca teve efeito).

### Catálogo candidato do agendador (as três fontes; a decisão final é do domínio)
```sql
select distinct workspace_id, list_id from plataforma.registros
 where colecao = 'tasks' and list_id is not null
   and ( dados->'recurrence'->>'triggerMode' = 'porCalendario'
      or dados->>'lifecycle' = 'naLixeira' )
```
`união` com a consulta atual de `automations`. A recorrência por calendário e a lixeira vivem na **Tarefa**, não na Lista (`runCalendarRecurrences` filtra `state.tasks`; `purgeExpiredTasks` idem), então **nenhuma consulta lê o jsonb da Lista** para isto. A série tem sempre uma Tarefa corrente carregando a Regra (a Regra é transferida à ocorrência nova e removida da anterior, `collaboration.ts:criarOcorrencia`). Usa `list_id` (coluna gerada da `002`) com `workspace_id`.

### Zona de soltura (função pura, testável sem DOM)
```ts
type Zona = "antes" | "dentro" | "depois" | null;
// y e retângulo em números: jsdom devolve getBoundingClientRect() zerado, então o teste injeta os números.
export function zonaDaSoltura(y: number, topo: number, altura: number, quem: "espaco" | "pasta" | "lista", alvo: …): Zona { /* A1 do UI-SPEC: 25/50/25 em Pasta; 50/50 em Lista e Espaço; Espaço nunca "dentro" */ }
```
Estado do gesto no `StructureTree` (`{ tipo, id, paiTipo, paiId }`), `effectAllowed = "move"` e um tipo MIME próprio só para não soltar fora do app; `onDragOver` com `preventDefault()` só quando L1/L3 não recusam; a leitura de `clientY` é permitida em `dragover` (o que não é permitido é ler o `dataTransfer`).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Botão "Rodar agenda" na Lista | Relógio do servidor (agendador) | esta fase | exige F3/F4/F5 resolvidos, senão o dono perde a função sem ganhar a automática |
| `Abas` sem ligação aba↔painel | `id`/`aria-controls`/setas (A13) | esta fase (opcional) | `Abas` é usado em 11 telas (`grep <Abas`); mudar o componente compartilhado afeta todas — testar a barra existente |
| Carga/capacidade | removidas | esta fase | `weekStartOf` fica (Linha do tempo) |

**Deprecated/outdated:** a cópia de `RunScheduledButton` da regra "tem agenda" na web; `MODE_LABEL.bloqueado`, `ASPECTS`, `REGRA_DOS_MODOS` (D-17).

## Detalhes por pergunta da missão

### 1. D-12 — HTML5 nativo na árvore (veredito: **basta**, desenho mínimo)
- **Estrutura real** (`app-shell.tsx`): `StructureTree` 605-668 → `TreeSpace` 670-732 → `TreeFolder` 767-841 → `TreeList` 843-887 → `TreeRow` 1043-1148. `TreeRow` é a linha única (`div.group/linha` com botão de expandir, `Link`/`span` inerte, `creatable` "+" e `menu` "⋯"). `menu` hoje só é passado pela `ChatTree` (`:953,985`). `MeusNegociosNoPainel` reusa `TreeFolder`/`TreeList` com `enderecos` próprio.
- **Mínimo:** (1) `draggable` no `div` da linha **somente** quando `StructureTree` passa uma prop de comportamento (a árvore do CRM não passa → continua igual); (2) `draggable={false}` no `Link`; (3) estado `arrastando` + `alvo` (zona) no `StructureTree`; (4) `onDragOver`: calcular zona com `clientY` e o `getBoundingClientRect()` da linha, `preventDefault()` só se L1/L3 não recusam, atualizar o alvo **só quando a zona muda**; (5) `onDrop`: `dentro` ⇒ L1 → L2 → `runConfirmado(moveContainer)` ou abrir `?mover=`; `antes/depois` ⇒ `reorderContainers` com a fatia visível; (6) `onDragEnd` limpa tudo; (7) `aria-busy` na árvore durante a gravação (A4).
- **Teclado/leitor de tela:** menu "⋯" por linha com `Mover para…`, `Subir`, `Descer` — `ActionMenu` já é teclável e o texto do motivo desligado já é suportado (UI-SPEC). É exigência WCAG 2.5.7 (alternativa de ponteiro único) e o MDN confirma que a API não traz caminho de teclado.
- **Toque:** não prometido (UI-SPEC I8); o menu é o caminho garantido.
- **Não precisa de pacote.** O que **faria** precisar: nada identificado — as três razões comuns (zonas entre irmãos, auto-scroll, teclado) têm resposta acima (auto-scroll é nativo do navegador; conferir na UAT). Se na UAT o arrastar em tela de toque for exigência, a rota é o portão de pacote (checkpoint humano), não decisão do planejador.
- **Erros do documento de tarefas a não herdar:** F1 (ChatTree não arrasta) e F2 (árvore não ordena por `order`).
- **Onde pôr o código:** `app-shell.tsx` já tem 1.150 linhas; extrair a função de zona e o hook de gesto para arquivos novos em `features/shell/` e deixar no `app-shell.tsx` só a ligação (props em `TreeRow`).

### 2. D-01/D-02 — agendador (design recomendado)
1. **Catálogo** (`catalogoDeListasComAgenda`, `scheduler-worker.ts:278`): três consultas candidatas (`automations` como hoje; `tasks` com recorrência por calendário; `tasks` na lixeira), unidas por `(workspace_id, list_id)`. Candidato, não decisão.
2. **Regime** (D-02) — função pura no domínio, ao lado de `listAutomationsFor` (`automations.ts:683`), p.ex. `listaTemAgendaPorVencimento(state, listId)`: `state.automations.some(a => a.lifecycle === "ativo" && a.scopeType === "list" && a.scopeId === listId && publishedVersion(a)?.trigger?.kind === "condicaoTemporal")`. É a mesma regra que `runScheduledAutomations` aplica (`:768-772`). O worker decide `emEnsaio` **dentro** do callback de `executar()`: `const emEnsaio = ensaioNaPrimeiraVolta && primeiraVolta && listaTemAgendaPorVencimento(state, listId)`. `primeiraVolta` (assíncrona) é lida antes do `executar`. "Lista com as duas coisas" fica no ensaio (a função é verdadeira). Reset de `ensaioContagem`/`foiForcadoAoEnsaio` no início do callback (o `executar` pode repetir por conflito de revisão).
3. **Ator** (F3): outra função pura, p.ex. `atorDoRelogio(state, listId, preferidoId)`: o Agente do pipeline se `containerAdminRefusal(...)` for `undefined`; senão o primeiro Membro ativo Proprietário/Administrador para quem também for `undefined` (alcança o contêiner; Espaço privado exige concessão — `derive.ts:1074-1089`); senão `undefined` ⇒ o worker fecha a linha `falhou` com um código claro. A Atividade "Próxima ocorrência criada" passa a ser autoria desse Membro humano (decisão do dono: Q1). O `resolverAtor` atual pode continuar como "preferido".
4. **Volta** (F5): `iniciar()` drena (`while (await processarUm())`, teto por volta) em vez de uma linha por `intervaloMs`.
5. **Ponte** (F4): `invocar-agente.ts:1222` passa a compor `runScheduledAutomations(…, opcoes)` + `runCalendarRecurrences` + `purgeExpiredTasks`; mais simples: `agendaDoDia` ganha parâmetro `opcoes` repassado e a ponte chama `agendaDoDia`.
6. **Compatibilidade:** CP/CR têm `MARCO_ZERO` e histórico ⇒ `primeiraVoltaPendente` falso ⇒ sem mudança de comportamento. Lista que ganha Automação por vencimento **depois** de já ter voltas reais não volta ao ensaio (lacuna aceitável; registrar).
7. **Custo:** cada linha chama `executar()` que hidrata o Espaço inteiro (~475 KB, `repositorio.ts` cabeçalho); N Listas × dias de catch-up (janela de 7) é o pior caso — aceitável, mas conta para a Fase 12.
8. **Testes:** `scheduler-worker.test.ts` contra Postgres local (casos novos: catálogo inclui Lista só-recorrente e só-lixeira; Lista fora de CP/CR é processada com ator humano; só-recorrência nasce direto; recorrência+vencimento vai a ensaio; volta drena N linhas; `rodarAgenda` da ponte compõe os três relógios) + unitários puros no domínio.

### 3. D-13 — onde a capacidade aparece
Ver F7/F8. Lista de edição: `types/workspace.ts:127-128`; `operations/planning.ts` (`DEFAULT_CAPACITY` :20, `memberCapacityMinutes` :37-39, `setMemberCapacity` :42-71 e o comentário :3); `registro.ts` (:11 comentário, :179 import, :544 entrada); `index.ts:187`; `apps/api/.../esquemas/planejamento.ts:35` + `planejamento.test.ts:17,34,83`; `membros/page.tsx` (:15 import, :347 `<th>Capacidade/sem`, :390 `<CapacityEditor`, :466-515 componente); `planning-views.tsx` (:15 import, :289-377 `CargaDeTrabalho`); `seed-financeiro.ts:73`; `conversao-de-solicitacao.test.ts:130`; `operations.test.ts` (:90 import, :3372-3376); linha de `setMemberCapacity` em `packages/dominio/CONTEXT.md:196`; contagem 286→289. Nada na leitura (hidratar/esquemas/`GET /estado`) rejeita a chave sobrante.

### 4. D-14/D-18 — Carga e a `010`
- **Formato das linhas:** `plataforma.registros(workspace_id, colecao, id, dados jsonb, ordem double precision, revisao, atualizado_em)`, PK `(workspace_id, colecao, id)` [VERIFIED: 001-plataforma.sql]. `colecao='views'` ⇒ `dados.kind`; `colecao='lists'` ⇒ `dados.blocks` (objeto `Partial<Record<ConfigurableAspect, boolean>>`, hoje `{}` em toda Lista).
- **Referências de Carga** (todas): domínio — `derive.ts:1217-1250` (`WorkloadCell`, `workload`; `weekStartOf` :1194 **fica**), `types/structure.ts:111`, `seed.ts:1980` (widget "Carga por Responsável (min)" é Painel **não** a Visualização: fica; só o grep de `workload` importa), `seed.ts:2863` (comentário); API — `esquemas/escala.ts:12,39,104`; web — `[lista]/page.tsx:48,61,110-111,126,662-666,891,997-998`, `tipo-de-visualizacao.ts:11,19`, `planning-views.tsx:5,16,289-377`, `view-bar.tsx:99,214` (usam `ROTULO_DA_ABA`, ajustam sozinhos); testes — `operations.test.ts:24,3361-3371`, `tipo-de-visualizacao.test.ts` (itera `Object.keys(ROTULO_DA_ABA)`, se ajusta), `escala.test.ts` (acrescentar `kind: carga` ⇒ falha de parse). `View.kind` é lido só em `abaDaView` (web), `saveView` (domínio, sem validação de valor) e na barra.
- **Número da próxima migração:** **`010`** [VERIFIED: `ls apps/api/migracoes` → 001…009].
- **Padrão anterior:** 007 e 008 foram DDL aplicadas após `--seco` e conferência (D-12 da 07); `migrar.cli.ts:14-23` e `migrar.ts` (transação por arquivo, `plataforma.migracoes`). A `010` é a primeira com DML ⇒ teste novo `migracao-010.test.ts` em Postgres local: inserir `views`/`lists` de teste, executar o texto da migração com `poolDoDono()` (`banco-crm.ts`), assertar zero e idempotência.
- **Ordem:** deploy → conferência → `010` (Pitfall 4).

### 5. D-11/D-16 — operações e invariantes
Ver Patterns 3–5. Pontos não óbvios: (a) **B37 só é calculado em `moveTask`** (`tasks.ts:545-548`) — não há outro lugar central; (b) tirar `readonly` de `parentType`/`parentId` (`types/structure.ts:222-223,232-233`; o doc diz 221 e 232) não quebra nenhum leitor, mas qualquer código que assumia imutabilidade (cache por pai) precisa ser lido — `grep` por `parentId` em `apps/web` mostra só filtros; (c) privacidade/grants/visibilidade são derivados do caminho — mudam sozinhos; (d) Atividades guardam `objectId/objectName`, sem caminho; (e) `Task` só guarda `listId` (`types/structure.ts:366`), sem `spaceId/folderId`; (f) referências por id de Status fora do Conjunto (`RecurrenceRule.triggerStatusId` em `types/structure.ts:329`, `View.filters.statusId`, condições de Automação) **não** são remapeadas nem por `moveTask` — lacuna conhecida, registrar; (g) paridade: `updateContainer` ao tornar privado também não "libera" Responsáveis que perdem `ver` (ontologia pede; código não faz) — `moveContainer` herda a mesma lacuna (A8).

### 6. "Quem pode" e cadeia de registro
Ver Pattern 1. Teste que falha, por elo: `tsc` (esquema), `esquemas-de-argumentos.test.ts (j)`, `esquemas/<modulo>.test.ts (a)`, `registro.test.ts`, `quem-pode.test.ts`. O `Arquivo` da linha tem de ser exatamente o módulo importado em `registro.ts` (`quem-pode.test.ts:103-113`): `operations/structure.ts` para `moveContainer`/`reorderContainers`; `operations/configuration.ts` para `setContainerDefaultViews`/`setContainerBlock`.

### 7. Página da Lista, `Abas`, colisões
- **Medido:** `[lista]/page.tsx` tem 1.407 linhas; `ListaPage` ocupa 113-1167 (1.054 linhas), `Quadro` 1179-1285 (~107), `Tabela` 1286-1407 (~122). Barras de criação por lente ~647-870 (~220 linhas). Extrair `Quadro`+`Tabela`+as três barras tira ~450 ⇒ ~955; 2.1.5 e 2.5.4 tiram ~40 ⇒ ~915; 2.6.2 devolve ~30. **Meta de 2.1.6: ≤ 950** para sobrar folga. Sem a extração das barras, só `Quadro`+`Tabela` (~230) deixa ~1.177 — **não basta**.
- **Cadeia na página (sequencial, um só arquivo):** 2.1.4 → 2.1.5 → 2.1.6 → 2.5.4 → 2.6.2 → (por último) 2.1.1. O botão de 2.1.1 **sai por último** porque D-04 exige deploy do agendador + confirmação do dono antes; na extração 2.1.6 ele viaja dentro de `BarraDeCriacao` e é apagado depois.
- **`Abas`** (`design/basicos.tsx:250`): sem `id`/`aria-controls`/setas; 11 usos. 2.1.8 antes de 2.6.2 (aba "Visualizações") e 2.6.5 (interruptor); `container-settings.tsx` (435 linhas, **único** componente das três páginas de Configurações) é tocado por 2.1.8, 2.6.2, 2.6.5 e pelo tipo `blocks` ⇒ sequencial.
- **Colisões** (arquivos tocados por mais de um plano): `[lista]/page.tsx` (2.1.1/4/5/6, 2.5.4, 2.6.2, 3 menu "Mover para…"), `container-settings.tsx` (2.1.8, 2.6.2, 2.6.5), `bulk-status-bar.tsx` (2.1.1, 2.1.4), `contas-view.tsx` (2.1.1, 2.1.4), `view-bar.tsx` (2.6.2), `app-shell.tsx` (2.3.3 + diálogo), `espacos/[espaco]/page.tsx` e `pastas/[pasta]/page.tsx` (2.1.9 + ordenar por `order` + menu), `create-container-dialog.tsx` (2.1.9 `openCreate` + 2.1.10 quatro textos), `types/structure.ts`/`derive.ts`/`registro.ts`/`index.ts`/`packages/dominio/CONTEXT.md` (todos os planos de domínio). Em execução sequencial isto é ordem, não merge.
- **`tarefa-completa.tsx`** (2.371 linhas): 2.1.10 edita **só** três cadeias (:1496, :1524, :1537); Fase 11 parte do arquivo limpo.

### 8. 2.1.10 — contagem real
No escopo da Estrutura (`apps/web/src/features/estrutura` + `app/(shell)/estrutura`), **texto visível** com `(RN-…)`, `(INV-…)`, `(B<n>)`, `(A<n>.<n>)`: **9 cadeias** (`create-container-dialog.tsx:383,428,441,442`; `tarefa-completa.tsx:1496,1524,1537`; `serie-dialog.tsx:117,150`) + **4 no domínio** (`structure.ts:430`, `financeiro.ts:1815,1829,1832`) = **13** (o número do documento confere). Os demais achados do mesmo grep no escopo são **comentários** (`task-editors.tsx:702`, `collaboration-editors.tsx:52`, `tarefa-completa.tsx:8`, `identidade-e-ciclo-de-vida.tsx:162`, `canais-de-atendimento.tsx:26`, `create-container-dialog.tsx:97,175,530`, `pastas/[pasta]/page.tsx:84,167`) e ficam. **Fora do escopo** (não tocar; o teste não olha): `apps/web/src` inteiro tem ~193 ocorrências não-comentário (IA 126, Ferramentas 42…) e `packages/dominio/src` ~100+ em IA/Ferramentas/CRM (`crm/permissoes.ts`, `crm/negocios.ts` etc.) — o parecer do dono vale para a Estrutura nesta fase (UI-SPEC I5). Cuidados: `sem-codigo-de-regra.test.ts` só vê `.tsx` das duas pastas — as 4 cadeias do domínio precisam de asserção própria; **atualizar `contas-a-receber.test.ts:129`** (Pitfall 10).

### 9. Validação — ver seção seguinte.

## Validation Architecture

> `workflow.nyquist_validation` está `true` em `.planning/config.json`. Comandos verificados nesta sessão: `cd packages/dominio && npx vitest run src/quem-pode.test.ts` (6 passed, ~1 s); `cd apps/api && DATABASE_URL= npx vitest run src/rotas/esquemas-de-argumentos.test.ts src/rotas/esquemas/estrutura.test.ts` (13 passed, ~1 s); `npx tsc --noEmit` em `packages/dominio` e `apps/api` (sem saída, <2 s). **Sempre** prefixar `DATABASE_URL=` (vazio) nos testes de `apps/api` que não precisam de banco (Pitfall 9).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 5.0.1 (três workspaces); jsdom 30 + Testing Library no `apps/web`; Playwright 1.63 só para e2e de produção |
| Config file | `packages/dominio/vitest.config.mts` (`environment: node`), `apps/web/vitest.config.mts` (`node` por padrão; `// @vitest-environment jsdom` por arquivo), `apps/api/vitest.config.mts` (`fileParallelism: false`, timeout 180 s) |
| Quick run command | por arquivo: `cd packages/dominio && npx vitest run <arq>` · `cd apps/web && npx vitest run <arq>` · `cd apps/api && DATABASE_URL= npx vitest run <arq>` |
| Full suite command | `npm run check` (raiz; 13–17 min, baseline `lote-contas-a-pagar (d)` falha por rede) — **só no fim da fase**; por onda: `npx tsc --noEmit` nos três + os arquivos tocados |

### Postgres local descartável (para testes de banco desta fase)
```
docker run -d --rm --name crm-n1-pg-1001 -e POSTGRES_PASSWORD=x -p 55701:5432 postgres:16
export DATABASE_URL=postgres://postgres:x@localhost:55701/postgres DATABASE_URL_MIGRACAO=$DATABASE_URL
cd apps/api && npm run migrar && npx vitest run <arquivo>
```
Convenção de nome/porta das fases anteriores: `crm-n1-pg-<fase><nn>` / `55600+nn` na 9 [CITED: memória gsd-gate-de-testes-baseline]; para a 10, `crm-n1-pg-10NN` / `557NN`. O Docker local está ativo (um contêiner Supabase de outro projeto roda em 54322; não usar).

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EST-01 | regime (ensaio × direto) e ator por Lista, puros | unit (domínio) | `cd packages/dominio && npx vitest run src/operations/agenda-do-relogio.test.ts` | ❌ Wave 0 |
| EST-01 | catálogo inclui só-recorrência/só-lixeira; Lista fora de CP/CR processada; drena N linhas; ponte compõe 3 relógios | integration (Postgres local) | `cd apps/api && npx vitest run src/automacoes/scheduler-worker.test.ts src/automacoes/invocar-agente.test.ts` (com `DATABASE_URL` local) | ✅ existe, casos novos ❌ |
| EST-01 | nenhuma tela tem "Rodar agenda…" | grep-as-test | `cd apps/web && npx vitest run src/features/estrutura/sem-rodar-agenda.test.ts` (lê os `.tsx`, como `sem-codigo-de-regra`) ou `! grep -rn 'Rodar agenda\|Rodar automações por vencimento' apps/web/src` | ❌ Wave 0 |
| EST-01 | agendador ligado em produção antes de o botão sair | **humano** (D-04) | log "scheduler de Automações ativo" + linha nova em `automacao_agenda` por Lista | n/a |
| EST-02 | `SelecaoEmLote` única; `BulkStatusBar` intacta | unit/jsdom | `cd apps/web && npx vitest run src/features/estrutura/bulk-status-bar.test.tsx src/features/estrutura/selecao-em-lote.test.tsx` | ✅ / ❌ |
| EST-02 | página < 1.000 linhas | shell | `test "$(wc -l < 'apps/web/src/app/(shell)/estrutura/listas/[lista]/page.tsx')" -lt 1000` | n/a |
| EST-02 | "Mostrando X de Y Tarefas." | unit/jsdom | `cd apps/web && npx vitest run src/features/estrutura/contagem-filtrada.test.tsx` | ❌ Wave 0 |
| EST-03 | `?aba=` abre a aba; desconhecida cai em `geral`; "Aspectos configuráveis" ausente | jsdom + grep | `cd apps/web && npx vitest run src/features/estrutura/container-settings.test.tsx`; `! grep -rn 'Aspectos configuráveis' apps/web/src` | ❌ Wave 0 |
| EST-04 | 9 cadeias web sem código; 4 do domínio | unit | `cd apps/web && npx vitest run src/features/estrutura/sem-codigo-de-regra.test.ts`; `cd packages/dominio && npx vitest run src/operations/contas-a-receber.test.ts src/operations/operations.test.ts` | ❌ / ✅ (editar `:129`) |
| EST-05 | mover (mesmo Conjunto, outro com/sem mapeamento, Campo arquivado, Pasta com Subpastas recusada, promoção/rebaixamento, destino que bloqueia, colisão, Formulário, Tipo, `order`) e reordenar por fatia | unit (domínio) | `cd packages/dominio && npx vitest run src/operations/mover-conteiner.test.ts` | ❌ Wave 0 |
| EST-06 | zona de soltura (pura) | unit | `cd apps/web && npx vitest run src/features/shell/zona-de-soltura.test.ts` | ❌ Wave 0 |
| EST-06 | arrastar/soltar na árvore (`fireEvent.dragStart/dragOver/drop`), ordem por `order`, árvore inerte p/ Convidado | jsdom | `cd apps/web && npx vitest run src/features/shell/arvore-arrastavel.test.tsx` | ❌ Wave 0 |
| EST-06 | mover/reordenar persiste e sobrevive ao recarregar | integration (Postgres local) | `cd apps/api && npx vitest run src/rotas/mover-conteiner.test.ts` (POST `/operacoes/moveContainer`, re-`hidratar`) | ❌ Wave 0 |
| EST-06 | arrastar no navegador real, auto-scroll, `draggable={false}` no Safari, toque | **humano** (UAT de fim de fase) | abrir a árvore | n/a |
| EST-07 | sem Carga/capacidade; `saveView kind: carga` ⇒ 400 | unit + grep | `cd apps/api && DATABASE_URL= npx vitest run src/rotas/esquemas/escala.test.ts src/rotas/esquemas/planejamento.test.ts`; `! grep -rn 'workload\|weeklyCapacityMinutes' packages apps --include='*.ts' --include='*.tsx'` | ✅ editar / grep |
| EST-08 | disponíveis/inicial herdam pelo caminho; `null` volta a herdar; recusa vazio/inicial fora; salva de tipo indisponível some e volta | unit (domínio) + jsdom | `cd packages/dominio && npx vitest run src/operations/visualizacoes-padrao.test.ts`; `cd apps/web && npx vitest run src/features/estrutura/tipo-de-visualizacao.test.ts src/features/estrutura/view-bar.test.tsx` | ❌ / ✅ editar |
| EST-09 | tipo recusa `blocks` em Lista; `bloqueado` fora | typecheck | `cd packages/dominio && npx tsc --noEmit` (+ `// @ts-expect-error` num teste de tipos) | ❌ Wave 0 |
| EST-10 | `setContainerBlock` recusa nomeando só as alcançáveis; acumulam não recusam; `criarAutomacao` recusada sob bloqueio | unit (domínio) | `cd packages/dominio && npx vitest run src/operations/bloqueio-de-aspecto.test.ts` | ❌ Wave 0 |
| EST-11 | `010`: contagens 0, idempotente, não toca outras coleções | integration (Postgres local) | `cd apps/api && npx vitest run src/persistencia/migracao-010.test.ts` | ❌ Wave 0 |
| EST-11 | 4 operações na tabela; esquemas e contagem | unit | `cd packages/dominio && npx vitest run src/quem-pode.test.ts`; `cd apps/api && DATABASE_URL= npx vitest run src/rotas/esquemas-de-argumentos.test.ts` | ✅ (editar) |
| EST-11 | `010` aplicada em produção | **humano** (D-19) | `--seco` + contagens + aplicar + contagens 0 | n/a |

### Sampling Rate
- **Por commit de tarefa:** o(s) arquivo(s) de teste tocados (≤ 5 s cada) + `npx tsc --noEmit` do workspace tocado.
- **Por onda:** `npx tsc --noEmit` nos três workspaces + `npm run lint -w @n1/web` + `npm run verificar:tokens` + os arquivos de teste da onda.
- **Gate de fase:** `npm run check` em segundo plano; comparar só o conjunto de falhas com o baseline; se sair código 124, o procedimento da memória (api sem o e2e `lote-contas-a-pagar`, depois web e domínio).
- **Suíte de segurança:** `cd apps/api && npx vitest run src/seguranca src/rotas/estado.test.ts` com Postgres local como `n1_api` (job `seguranca` do CI). Não é exigido acrescentar caso por operação (F10); acrescentar **um** caso de Convidado/Membro sem administrar para `moveContainer` e `setContainerBlock` é recomendado, não portão.

### Wave 0 Gaps
- [ ] `mover-conteiner.test.ts`, `visualizacoes-padrao.test.ts`, `bloqueio-de-aspecto.test.ts`, `agenda-do-relogio.test.ts` (domínio)
- [ ] `zona-de-soltura.test.ts`, `arvore-arrastavel.test.tsx`, `container-settings.test.tsx`, `selecao-em-lote.test.tsx`, `contagem-filtrada.test.tsx`, `sem-codigo-de-regra.test.ts`, `sem-rodar-agenda.test.ts` (web)
- [ ] `mover-conteiner.test.ts` (rota), `migracao-010.test.ts`, casos novos em `scheduler-worker.test.ts` e `invocar-agente.test.ts` (api; os de banco com `describeComBanco`)
- [ ] Framework: nada a instalar. `apps/web` já tem jsdom + Testing Library.

### Ações que só o dono pode fazer (checkpoints `[BLOCKING]`)
1. **D-04 / 2.1.3** (antes de apagar o botão). Comando pronto, por ordem: (a) no `api.env` da VPS ler `AUTOMACOES_WORKER_ATIVO`, `AUTOMACOES_ESPACO_ID`, `AUTOMACOES_LISTA_ID`, `AUTOMACOES_ATOR_MEMBER_ID` (deve estar vazio), `AUTOMACOES_ENSAIO_PRIMEIRA_VOLTA`, `AGENTE_CONTAS_A_PAGAR_ATIVO`; (b) log de produção por "scheduler de Automações ativo" (`index.ts:229`); (c) existir Membro ativo no Papel `rol_sp_agente_pipeline` com `administrar` em CP/CR (STATE.md:575 dizia que não existia); (d) tratar os ~14 Espaços de teste (STATE.md WR-A) — `AUTOMACOES_ESPACO_ID=ws_n1` resolve; (e) contar Tarefas na lixeira acima do prazo por Lista (a primeira volta real do expurgo é irreversível, F6); (f) no dia seguinte, uma linha nova em `plataforma.automacao_agenda` por Lista com agenda e nenhuma `falhou`/`RECUSA_DO_DOMINIO`.
2. **D-19 / `010`:** depois do deploy, `npm run migrar -w @n1/api -- --seco` (mostra `010` pendente), consultas de contagem (acima), aplicar, contagens = 0.
3. **UAT de fim de fase** (`human_verify_mode: end-of-phase`): Lista, Espaço, Pasta e Configurações; arrastar real (e toque/Safari, I8).

## Security Domain

> `security_enforcement` está ligado (ASVS nível 1, `security_block_on: high`).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | não muda | JWT do Supabase já exigido em `POST /operacoes` (Fase 1) |
| V3 Session Management | não muda | — |
| V4 Access Control | **sim** | domínio: `containerAdminRefusal` (administrar), `mayBuild` (criar/“editar” no pai), `memberReachesContainer` (privacidade B38a); Membro `suspenso` ⇒ 403 antes de tudo (`recusarSuspensoNaEscrita`); Convidado recusado |
| V5 Input Validation | **sim** | Zod `.strict()` com enums espelhando o domínio (`Confere<[Igual<…>]>`); `ids` do `reorderContainers` validados pelo domínio (repetidos, fora do grupo); **sem `.min()/.max()` no esquema** por regra da pasta — o domínio recusa lista vazia/enorme |
| V6 Cryptography | não muda | — |
| V8 Data Protection | **sim** | recusa que nomeia contêiner privado não alcançável (Pitfall 7); mapeamento/Atividade gravam caminho (nomes) — ocultos por `visibilidadePara` a quem não alcança |
| V13 API | sim | `POST /operacoes/:nome` único ponto de entrada; 400 genérico sem eco do Zod (`operacoes.ts:209`) |

### Known Threat Patterns for este stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Convidado/Membro sem administrar chama `moveContainer`/`setContainerBlock` direto por HTTP | Elevation of Privilege | a operação é a barreira (a tela só desliga); teste de domínio + (recomendado) caso na suíte adversarial |
| Mover contêiner para Espaço privado ou a partir dele muda quem vê (derivado do caminho) | Information Disclosure | exigir `mayBuild(destino)` (alcança) e administrar o movido; Atividade com caminho; teste com Membro que não alcança o destino ⇒ "não encontrado" |
| IDOR por id de outro Espaço de Trabalho | Tampering | o estado é por Espaço (`hidratar(workspaceId)` da sessão); `requireContainer` devolve "não encontrado" para inalcançável (RN-ESP-15) |
| Nome de Pasta/Lista privada vazando na recusa | Information Disclosure | nomear só alcançáveis + contagem dos demais |
| Ator do relógio com alcance excessivo (alargar o Agente do pipeline) | Elevation of Privilege | ator escolhido dentro do processo por função de domínio; **não** conceder `administrar` ao Agente em todos os Espaços |
| `010` apaga dado indevido | Tampering | DML restrito por `colecao` e `dados->>'kind'`; pós-condição `raise exception`; `--seco` + contagens + aplicação por quem tem `DATABASE_URL_MIGRACAO` |
| Primeira volta real do expurgo elimina Tarefas da lixeira em lote | Tampering/Repudiation | contagem prévia no checkpoint (F6, Q3); a Atividade já registra a eliminação |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | O "ator do relógio" para Listas fora de CP/CR deve ser um Membro humano que administre a Lista (autoria da Atividade "Próxima ocorrência criada" vira dele) | Pitfall 1, § Scheduler | O dono pode preferir autoria "Sistema"; exigiria variantes de domínio com `ActorRef` (mais invasivo) |
| A2 | Unidade da primeira volta: Lista que entra **só** pela lixeira (sem recorrência nem Automação) deve nascer direta ou em ensaio — aqui recomendado "direta, após contagem prévia no checkpoint" | F6, Q3 | Expurgo em lote surpreende o dono |
| A3 | `reorderContainers` por fatia (preenchimento de vagas) substitui a "permutação completa" de 2.3.2/D-08 | Pattern 4 | Se o dono exige a permutação completa, o Membro que não vê todos os irmãos fica sem reordenar |
| A4 | `mayBuild(pai)` (Membro ativo, não Convidado, que alcança o pai) é o análogo de "`editar` no pai" de 2.3.2 — não existe checagem `editar` de contêiner neste código | Pattern 4 | Se o dono quer `administrar` no pai, trocar por `containerAdminRefusal` (mais restrito) |
| A5 | Aspectos que **acumulam** (`fieldDefinitions`, `taskTypes`, `automations`) não recusam o `moveContainer` por bloqueio do destino ("os existentes ficam", D-16) | Pattern 3 passo 6 | Se o dono lê RN-PAS-14 literal (rejeitar), a recusa deve incluí-los |
| A6 | Subir `plataforma.workspaces.revisao` na `010` faz clientes abertos reidratarem (`verificarRevisao` em `store.ts:254`) | `010` | Sem isto o cliente só vê o dado novo na próxima gravação; inofensivo |
| A7 | Mover **estruturas âncora** (Meus negócios, Listas CP/CR/Solicitações) deve ser recusado no domínio | Pattern 3, Q2 | O dono arrasta Contas a pagar para outro Espaço e `solicitacoes:configurar --conferir` aponta divergência |
| A8 | `moveContainer` não "libera" Responsáveis/Observadores que perdem `ver` (paridade com `updateContainer`/privacidade) | § 5(g) | Ontologia pede a liberação; hoje nenhuma operação a faz |
| A9 | Arrastar por toque (iPadOS/Android) não é prometido | § 1 | UI-SPEC I8 já registra para a UAT |

## Open Questions

1. **Q1 — Quem assina o que o relógio faz nas Listas novas?**
   - Sabemos: o Agente do pipeline não administra essas Listas; o domínio exige administrar (F3).
   - Falta: autoria visível na Atividade (Membro humano × "Sistema").
   - Recomendação: ator humano escolhido por `atorDoRelogio` (sem tocar permissões do Agente); levar ao dono junto do checkpoint D-04.
2. **Q2 — `moveContainer` recusa estruturas âncora?** (Meus negócios, CP, CR, Solicitações.) Recomendação: sim, conjunto fechado de ids, com frase própria; confirmar com o dono.
3. **Q3 — Lista que entra só pela lixeira nasce direta ou em ensaio?** Recomendação: direta, mas só depois de o dono ver a contagem de Tarefas vencidas na lixeira por Lista.
4. **Q4 — O que conta como "consequência" no arrastar (D-10)?** D-10 lista Conjunto de Status e Campos; `moveTask` também troca o Tipo de Tarefa e revoga link público. Recomendação: L2 devolve também `tiposQueMudam` e `linksPublicosRevogados` e o arrastar abre o diálogo quando qualquer um for > 0 (acrescenta uma linha de copy ao painel âmbar; não reabre D-10).
5. **Q5 — Colisão de nome de Campo/Tipo no caminho novo** (RN-PAS-14): recusar (recomendado, ontologia explícita) ou aceitar? Hoje a criação já impede o duplicado; a movimentação precisa da mesma barreira.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node / npm | tudo | ✓ | v24.14.0 / 11.9.0 | — |
| Docker (daemon) | Postgres local para testes de banco | ✓ | 29.3.1 | sem ele os testes `describeComBanco` pulam; CI cobre (`check.yml`) |
| Postgres 16 (imagem) | `scheduler-worker`, `migracao-010`, `mover-conteiner` (rota) | ✓ (imagem baixável; nenhuma instância do projeto rodando) | `postgres:16` | — |
| Supabase de produção | aplicar `010`, contagens | ✗ para agentes (sandbox recusa `migrar`/`--apply` contra o banco real; STATE.md Blockers) | — | dono roda e cola a saída; agente prepara `--seco`/consultas |
| Conector Supabase do claude.ai | contar Visualizações `carga`/Listas em produção | ✗ (organização errada) | — | contagens saem da própria `010`/consulta do dono |
| `gsd-tools graphify` | contexto de grafo | ✗ desabilitado | — | não usado |

**Missing dependencies with no fallback:** nenhuma que bloqueie o planejamento.
**Missing with fallback:** produção e conector — checkpoints do dono.

## Sources

### Primary (HIGH confidence — lidos nesta sessão)
- Repositório: `app-shell.tsx`, `scheduler-worker.ts`, `invocar-agente.ts:1222-1241`, `index.ts`, `repositorio.ts`, `migrar.ts`, `migrar.cli.ts`, `001/002/005-*.sql`, `structure.ts`, `configuration.ts`, `tasks.ts` (`moveTask`, `purgeExpiredTasks`), `collaboration.ts` (`runCalendarRecurrences`), `automations.ts`, `derive.ts`, `derive-visibilidade.ts`, `types/structure.ts`, `registro.ts`, `index.ts`, `quem-pode.test.ts`, `esquemas-de-argumentos.ts/.test.ts`, `esquemas/{estrutura,configuracao,planejamento}.ts`, `seguranca/{inventario-de-rotas,matriz-de-papeis,lacunas-do-dominio}.test.ts`, `store.ts`, `tipo-de-visualizacao.ts`, `container-settings.tsx`, `bulk-status-bar.tsx`, `contas-view.tsx`, `view-bar.tsx`, `design/basicos.tsx`, `(shell)/layout.tsx`, `ontologia/02-estrutura-de-trabalho/{pasta,espaco}.md`, `docs/09-planejamento/TAREFAS-POR-SESSAO.md` (2.3.x), `STATE.md`, `.github/workflows`.
- Next.js local: `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md`.
- MDN HTML Drag and Drop API (https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API): links arrastáveis por padrão; `preventDefault()` em `dragover` para permitir soltar; loja de dados só legível em `dragstart`/`drop`; nenhuma menção a teclado.

### Secondary / Tertiary
Nenhuma fonte de busca na web além do MDN. Nada `[ASSUMED]` vindo de busca; os `[ASSUMED]` são desenho (tabela A1–A9).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — nada novo; versões lidas de `package.json`.
- Architecture: HIGH para domínio/api (código lido), MEDIUM para o desenho de arrastar (padrão de plataforma + precedentes do repo).
- Pitfalls: HIGH — cada um com arquivo:linha; os de ordem de deploy (4) e de ator do relógio (1) são consequência direta do código.

**Research date:** 2026-10-28
**Valid until:** 2026-11-27 (estável; revalidar `scheduler-worker.ts` se a Fase 12 mexer em `executar()`)
