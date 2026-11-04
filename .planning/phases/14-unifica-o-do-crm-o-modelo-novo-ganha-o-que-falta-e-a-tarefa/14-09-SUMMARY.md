---
phase: 14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa
plan: 09
subsystem: api
tags: [crm, contatos, mesclagem, gesto-misto, rn-con-14, rn-cxe-10, vitest, postgres]

requires:
  - phase: 14-03
    provides: executarGestoMisto (lerDoCrm, operacao, gravarNoCrm) e a recusa como valor
  - phase: 14-04
    provides: Contato mesclado somente leitura; o helper escrita recusa o absorvido
  - phase: 14-06
    provides: contato_notas e o parametro tambem (travas em ordem de id)
  - phase: 14-08
    provides: contato_consentimentos, so insercao
provides:
  - validarMesclagem e conversasQueResolvemNaColisao (packages/dominio/src/crm/mesclagem.ts)
  - reapontarContatoNosVinculos (compartilhada com mergeContacts) e mesclarContatoNoEspaco, fora de OPERACOES
  - repositorios/crm/mesclagem.ts, servicos/crm/mesclagem.ts (ServicoDeMesclagem, codigo MESCLAGEM_RECUSADA)
  - POST /contatos/:id/mesclar e OpcoesDeCrm.mesclagem
affects: [14-11, 14-17]

tech-stack:
  added: []
  patterns:
    - "gesto misto com gravarNoCrm sem recusa: tudo o que podia recusar ja foi pre-checado em lerDoCrm, e a rede do SQLSTATE traduz o que sobrar"
    - "Vinculos da mesclagem como funcao pura unica, usada pela operacao antiga e pela do modelo novo"
    - "uma instrucao SQL por efeito (repositorio sem regra), a ordem e as regras no servico"

key-files:
  created:
    - packages/dominio/src/crm/mesclagem.ts
    - packages/dominio/src/crm/mesclagem.test.ts
    - packages/dominio/src/operations/vinculos-da-mesclagem.ts
    - packages/dominio/src/operations/vinculos-da-mesclagem.test.ts
    - apps/api/src/repositorios/crm/mesclagem.ts
    - apps/api/src/servicos/crm/mesclagem.ts
    - apps/api/src/servicos/crm/mesclagem.test.ts
    - apps/api/src/rotas/crm/mesclagem.ts
    - apps/api/src/rotas/crm/mesclagem.test.ts
  modified:
    - packages/dominio/src/operations/contacts.ts
    - packages/dominio/src/operations/index.ts
    - packages/dominio/CONTEXT.md
    - apps/api/src/rotas/crm/index.ts
    - apps/api/src/rotas/CONTEXT.md

key-decisions:
  - "Consentimentos do absorvido sao COPIADOS (linhas novas, registrado_por original); os originais ficam no absorvido. Notas e Conversas sao movidas."
  - "Vinculo com Empresa que colide com um vigente do sobrevivente funde (admin = admin de um OU do outro) e o do absorvido e ENCERRADO, nao apagado; os demais, vigentes ou encerrados, passam ao sobrevivente."
  - "Colisao de Conversa segue RN-CXE-10 (fica a de Mensagem mais recente; empate pelo id), nao 'a do absorvido' da 3.2.2 (OQ3, a confirmar com o dono)."
  - "A colisao de Conversa e lida em gravarNoCrm, depois das travas, e nao em lerDoCrm: fica mais perto da escrita, e o 23505 vira 409 pela tabela de frases se uma Conversa entrar no meio."
  - "mesclar nao reusa detalhar de servicos/crm/contatos.ts (nao exportada, fora de files_modified): le Contato, Identificadores e vinculos pelos mesmos repositorios."

patterns-established:
  - "Teste de gesto misto com retrato das duas bases antes e depois da recusa (contatos, identificadores, conversas, negocios, vinculos, notas, consentimentos, registros e revisao)."

requirements-completed: [UNI-05]

coverage:
  - id: D1
    description: "validarMesclagem recusa o mesmo Contato e qualquer lado na lixeira ou mesclado, e diz o estado do sobrevivente; conversasQueResolvemNaColisao devolve todas menos a de Mensagem mais recente"
    requirement: UNI-05
    verification:
      - kind: unit
        ref: "packages/dominio/src/crm/mesclagem.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "reapontarContatoNosVinculos serve a mergeContacts e a mesclagem nova; os testes antigos de mergeContacts passam sem edicao; mesclarContatoNoEspaco reaponta Vinculos e ancoras de Chat e grava as duas Atividades, fora de OPERACOES"
    requirement: UNI-05
    verification:
      - kind: unit
        ref: "packages/dominio/src/operations/vinculos-da-mesclagem.test.ts; contacts.test.ts; operations.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Mesclar move Identificadores (principal rebaixado se o sobrevivente ja tem), Conversas e Participante, Negocios, notas e Enderecos (sem principal), copia consentimentos, marca o absorvido mesclado e troca o Vinculo em registros, no mesmo commit"
    requirement: UNI-05
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/mesclagem.test.ts#(a)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Colisao de Conversa (RN-CXE-10), admin unico (Pitfall 5), sem cadeia (RN-CON-14) e sobrevivente arquivado que volta a ativo"
    requirement: UNI-05
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/mesclagem.test.ts#(b), (b2), (b3), (c), (c2), (d), (e)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Recusas (mesmo Contato, mesclado, lixeira, outro Espaco, inexistente, Convidado) deixam as duas bases identicas; mesclar A em B e B em A juntos da um sucesso e um 409, sem 40P01"
    requirement: UNI-05
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/mesclagem.test.ts#(f) a (n)"
        status: pass
    human_judgment: false
  - id: D6
    description: "POST /contatos/:id/mesclar: sobrevivente e o :id, corpo estrito, recusa com status e frase sem nome de constraint"
    requirement: UNI-05
    verification:
      - kind: integration
        ref: "apps/api/src/rotas/crm/mesclagem.test.ts (serviço falso, 11 casos)"
        status: pass
    human_judgment: false

actuals:
  tokens: 65000
  tasks: 3
  commits: 6
plan_head_before: 5dfa5e25d2c86fbd5de305c74018f3c56e1efab2
plan_head_after: fb3b757d6b1111f71c3f078a7b6e3c28b69fc8ea
commits: 6

duration: 12min
completed: 2026-11-04
status: complete
---

# Phase 14 Plan 09: Mesclar Contatos no modelo novo Summary

**`POST /contatos/:id/mesclar` junta dois Contatos nas duas bases num commit só (gesto misto): move Identificadores, Conversas, Negócios, vínculos com Empresa, Endereços e notas, copia os consentimentos, troca os Vínculos de `registros` pela mesma função pura da `mergeContacts` antiga e marca o absorvido `mesclado`, com colisão de Conversa e admin único resolvidos e provados contra Postgres 16.**

## Performance

- **Duration:** 12 min
- **Tasks:** 3 (todas TDD: RED e GREEN em commits separados)
- **Files:** 14 (9 criados, 5 alterados)

## Accomplishments

- Domínio: `validarMesclagem` (RN-CON-14) e `conversasQueResolvemNaColisao` (RN-CXE-10) puras, e `reapontarContatoNosVinculos` extraída de `mergeContacts` (mesmo comportamento, mesma chave de dedupe, o mais antigo fica) e usada pelas duas mesclagens. `mesclarContatoNoEspaco` fica fora de `OPERACOES`: os dois Contatos chegam em `referencias`, lidos pelo servidor.
- Serviço: `lerDoCrm` trava os dois Contatos em ordem de id (`for update`, `order by id`), dá 404 para quem não é deste Espaço e 409 `MESCLAGEM_RECUSADA` com `campo`; `gravarNoCrm` resolve a colisão de Conversa antes de mover, move tudo, copia consentimentos e marca o absorvido por último.
- O caso "o absorvido era o único admin da Empresa" passa no commit: o vínculo do sobrevivente vira admin (ou o do absorvido passa para ele) antes de o constraint trigger deferido da 007 conferir.
- Rota casca com corpo `.strict()`; `rotas/CONTEXT.md` e `packages/dominio/CONTEXT.md` descrevem o gesto, a irreversibilidade e o que fica de fora (restaurar cópia e marcar como distintos).

## Task Commits

1. **Task 1 (domínio):** `c3e4bda` (test, RED: módulos ausentes) e `a298f54` (feat, GREEN)
2. **Task 2 (serviço e repositório):** `8556a99` (test, RED: módulo ausente) e `8e74cc0` (feat, GREEN, 17 casos contra Postgres)
3. **Task 3 (rota):** `d23db66` (test, RED: 10 de 11 falham, a rota não existe) e `fb3b757` (feat, GREEN)

## TDD Gate Compliance

- **RED** (`c3e4bda`, `8556a99`, `d23db66`): as duas primeiras falham por `Cannot find module` do alvo ainda inexistente; a da rota falha por 404/400 de rota ausente. Nenhuma falha de fixture ou sintaxe. O classificador `check tdd-red-evidence` não foi rodado (o vitest não persiste TAP/JUnit aqui).
- **GREEN:** domínio 304/304 nos arquivos do plano e 2314/2314 no pacote; `mesclagem.test.ts` do serviço 17/17; rota 11/11.
- **REFACTOR:** nenhum commit.

## Decisions Made

Ver `key-decisions`. As que os próximos planos precisam saber:

- O Contato `mesclado` NÃO recebe de volta o que moveu: as Mensagens ficam na Conversa (que passou ao sobrevivente), e os consentimentos do absorvido ficam congelados nele, mais uma cópia no sobrevivente.
- `conversa_marcacoes` (estrela e leitura) não é tocada: é da Conversa e do Membro.
- A mesclagem não grava nada no Registro de Atividade do CRM novo (ele não existe); só as duas Atividades de `registros`, pela operação pura (OQ5).

## Deviations from Plan

### Auto-fixed Issues

None. Duas escolhas dentro do plano, sem desvio de contrato:

- O teste semeia o Vínculo `tarefa→contato` empurrando um `Link` em `state.links` dentro de `executar()`, e não por `createTask` com `alvoConferido`: o objetivo é um Vínculo qualquer em `registros` apontando o absorvido, e o `createTask` exigiria uma Lista conversacional só para isso.
- `detalhar` de `servicos/crm/contatos.ts` não é exportada e o arquivo está fora de `files_modified`; o serviço monta o `ContatoDetalhado` com os mesmos três repositórios (Contato, Identificadores, vínculos).

**Total deviations:** 0. **Impact:** nenhum.

## Issues Encountered

- `src/persistencia/outbox-worker.test.ts` (casos h, i, j, k) falha de forma intermitente quando roda no mesmo lote que o resto de `persistencia` (reproduzido num banco novo, sem meus testes, com 2 a 4 falhas por rodada); sozinho passa 15/15, e `persistencia` sem ele passa 166/166. É a baseline já registrada no 14-07, não é deste plano (nada em `persistencia/` mudou) e não foi corrigida.

## Verification

Postgres 16 descartável (`crm-n1-pg-1409`, porta 55609, migrado até 011, removido ao fim):

- `servicos/crm/mesclagem.test.ts` + `gesto-misto.test.ts` + guarda D-06 da api: 26/26.
- `src/persistencia` sem o `outbox-worker`: 19 arquivos, 166 testes; `outbox-worker` sozinho: 15/15; `rotas/operacoes.test.ts` + `estado.test.ts`: 48/48.
- `servicos/crm` + `rotas/crm` + `repositorios` + guarda: 26 arquivos, 448 testes.
- Sem banco: `apps/api` 1314 passam (639 pulados, 1 todo); `packages/dominio` 2314/2314; `apps/web` 935/935.
- `tsc --noEmit` limpo em domínio, api e web; `verificar:tokens` limpo; `verificar:contratos` pulou (repositório irmão ausente, aviso conhecido).
- Critérios de aceite: `reapontarContatoNosVinculos` em `contacts.ts` 2, `export function mesclarContatoNoEspaco` 1, `mesclarContatoNoEspaco` em `registro.ts` 0; `for update` e `order by id` no repositório 2 e 1, `executarGestoMisto` no serviço 2, `workspace_id = $1` no repositório 17 (>= 10); rota, registro em `rotasDeCrm` e `mesclar` em `rotas/CONTEXT.md` presentes.

## Known Stubs

None.

## Threat Flags

None. T-14-22 (IDOR): `travarDois` filtra por `workspace_id`, testes de outro Espaço dão 404 com as duas bases idênticas. T-14-23 (corrida): a trava do Espaço enfileira as mesclagens cruzadas, `validarMesclagem` recusa o `mesclado`, e o teste `Promise.all` dá um sucesso e um 409 sem `40P01`. T-14-24: o serviço não lê nem loga o conteúdo das notas e dos consentimentos; a resposta é só o sobrevivente.

## Next Phase Readiness

Para 14-11 (tela de mesclar) e 14-17 (corte):

- A tela chama `POST /contatos/:id/mesclar` com `{ absorvidoId }`; o `:id` é quem fica. A resposta (200) é o `ContatoDetalhado` do sobrevivente.
- `mesclarContatoNoEspaco` e `reapontarContatoNosVinculos` saem pelo barril `@n1/dominio/operations`; a segunda também serve à `mergeContacts`, que só sai no corte do 14-17.
- Em aberto, para o dono: (OQ3) a colisão de Conversa segue RN-CXE-10 (fica a de Mensagem mais recente) e não "a do absorvido" da 3.2.2; (novo) depois de mesclar, o sobrevivente pode passar de 20 Identificadores e de 10 Endereços (os tetos são só da edição; o banco não os impõe), e a edição seguinte de Endereços pede para enxugar.
- Aplicar a 011 em produção continua esperando a Fase 15 (`npm run banco:conceder` depois).

## Self-Check: PASSED

- Arquivos criados existem (9 de 9) e os 6 commits (`c3e4bda`, `a298f54`, `8556a99`, `8e74cc0`, `d23db66`, `fb3b757`) são ancestrais de `HEAD`.
- Migrações 001 a 011 intocadas; nada fora de `files_modified` foi alterado, além deste SUMMARY, do STATE e do ROADMAP.
