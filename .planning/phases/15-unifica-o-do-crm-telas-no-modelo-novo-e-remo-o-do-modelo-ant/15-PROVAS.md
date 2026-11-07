# Fase 15 — Provas do fechamento

Este arquivo guarda o gate da Fase 15 (planos 15-01 a 15-43, menos o 15-35, que é o corte), o que foi decidido em nome do dono, as suposições adotadas, o que ainda é decisão dele, as linhas abertas do `.planning/WINDOWS.md`, as provas manuais que ninguém fez e as linhas sugeridas para o `andamento.mjs`. Foi escrito pelo plano 15-34. O ensaio final com o código final é a seção "Ensaio final" de `15-ENSAIO.md`, e o roteiro do corte é `15-CORTE.md`.

**Revisão pré-corte (plano 15-44).** Depois do 15-34, uma revisão independente do script (`15-REVIEW.md`, sem BLOCKER) achou dois HIGH e cinco MEDIUM. O 15-44 corrigiu o que mudaria o corte: o mapeador agora aceita o Canal e o Contato que já estão nas tabelas novas (H-01); o critério do que fica em `registros` deixou de ser só "Grupo" e passou a ser o mesmo, em TypeScript e SQL, no `--guardar`, `--migrar`, `--seco` e `--verificar` (H-02: a Conversa 1:1 de Flow, Automação e convite de Grupo fica); a trava "só banco local" olha o host que o `pg` usa (M-01); dado sujo não derruba o Espaço (M-04); e o `15-CORTE.md` ganhou os textos de M-02, M-03, M-05, H-02, L-01 e L-08. O ensaio foi repetido com o código corrigido sobre a mesma cópia e deu os mesmos números (seção "Ensaio pós-revisão" de `15-ENSAIO.md`). A "Disposição" de cada achado, inclusive o que ficou aberto, está no fim de `15-REVIEW.md`. O corte (15-35) depende deste plano.

**Em uma frase:** o código do CRM novo está fechado e o gate fechou verde (na 3ª rodada; nas duas primeiras só falhou o flake de baseline do `outbox-worker`), mas **nada foi cortado em produção, nenhuma tela foi aberta em navegador real, e há decisões suas pendentes** (as mais importantes estão em "O que o dono decide antes do corte", logo abaixo).

## O que o dono decide antes do corte (resumo)

1. **O Funil do `ws_n1`** (`--funil=migrar` acrescenta um Funil vazio ao lado dos 2 que o CRM novo dele já tem; `--funil=guardar` não muda nada lá). Decide-se no `--seco` do dia. Detalhe em `15-CORTE.md`.
2. **As três decisões que o orquestrador tomou por você** (próxima seção): ficar com elas, ou reverter os commits do ramo antes do corte.
3. **WINDOWS #61:** as Automações do seed apontam para Listas espelho que o seed não cria mais. Recomendação: tirar `aut_clo_proposta` do seed, ou apontá-la para uma Lista real.
4. **WINDOWS #73:** depois do corte, "Enviar Flow" a um Contato não tem a quem enviar (as Conversas 1:1 do CRM antigo saem de `registros`; desde o 15-44, as 1:1 que o Flow, a Automação e o convite de Grupo abrirem **depois** do corte ficam). Aceitar até a Sessão 7, ou pedir o seletor de Contatos com WhatsApp antes.
5. **Renovar a cópia de `~/n1-ensaio`** e repetir o ensaio, ou aceitar o ensaio sobre a cópia de 2026-11-05.
6. As decisões de produto da seção "Decisões do dono ainda pendentes" (nenhuma trava o corte).

## Como rodar o gate

- **Comando (literal, como foi rodado; o roteiro está em `gate.sh` descartável, fora do repositório):**

```bash
docker rm -f crm-n1-pg-1534 >/dev/null 2>&1
docker run -d --rm --name crm-n1-pg-1534 -e POSTGRES_PASSWORD=x -p 55734:5432 postgres:16
sleep 4; until pg_isready -h localhost -p 55734 >/dev/null 2>&1; do sleep 1; done
(cd apps/api && DATABASE_URL=postgres://postgres:x@localhost:55734/postgres DATABASE_URL_MIGRACAO=postgres://postgres:x@localhost:55734/postgres npm run --silent migrar)
DATABASE_URL=postgres://postgres:x@localhost:55734/postgres DATABASE_URL_MIGRACAO=postgres://postgres:x@localhost:55734/postgres npm run check
docker rm -f crm-n1-pg-1534 >/dev/null 2>&1
```

- **Código medido (SHA):** `f268958df226bbf600bb9831fc61f65c19ba865e` (ramo `fase-13-gravacao-em-menos-idas-e-voltas`, o commit `docs(15-43)` do STATE e do ROADMAP). As mudanças deste plano são só de documentação (`CONTEXT.md` e arquivos de `.planning/`); nenhum arquivo de código mudou depois do SHA medido.
- **Quando:** 1ª rodada `2026-11-06T23:13:45Z` a `23:17:18Z`; 2ª rodada (repetição, como o plano manda) `23:17:23Z` a `23:20:54Z`; 3ª rodada `23:27:13Z` a `23:30:49Z`.
- **Onde:** Postgres 16 de Docker descartável, **um contêiner novo por rodada**, migrado do zero até a `012`. O gate nunca fala com o banco do `.env` (produção): as duas URLs vão escritas no comando. `npm test` sozinho não foi usado como gate.
- **O que é o `npm run check`:** `typecheck` das três camadas, `eslint` da web, `verificar:tokens`, `verificar:contratos` e `npm run test` dos três workspaces.

## Resultado do gate

**Veredito: o `npm run check` fechou verde na 3ª rodada (`EXIT=0`). Nas duas primeiras, a única falha foi o flake de baseline de `outbox-worker.test.ts` (casos h a k), que a fase não tocou e que falha também rodado sozinho (evidência abaixo).** `typecheck` das três camadas, `eslint` (0 erros, os mesmos 2 avisos antigos de `rotulos.ts` e `app-shell.tsx`), `verificar:tokens` (445 tokens definidos, 403 arquivos, 0 falhas), web e domínio passaram nas rodadas. O `verificar:contratos` pulou com aviso porque o repositório irmão `financeiro-tria` não existe nesta máquina (como na Fase 14).

| Rodada | Início (UTC) | `apps/api` | `apps/web` | `packages/dominio` | Falhas |
|---|---|---|---|---|---|
| 1 | 23:13:45 | 192 de 195 arquivos passam (2 pulados), 1 falha; **2448 testes passam**, 1 falha, 21 pulados, 1 todo | 132 arquivos, **1298 testes** | 129 arquivos, **2384 testes** | `outbox-worker` (h) |
| 2 | 23:17:23 | 192 de 195 arquivos (2 pulados), 1 arquivo com falha; **2446 passam**, 3 falham, 21 pulados, 1 todo | 132 arquivos, **1298 testes** | 129 arquivos, **2384 testes** | `outbox-worker` (i), (j), (k) |
| 3 | 23:27:13 | 193 de 195 arquivos passam (2 pulados); **2449 testes passam**, 2 esperados a falhar, 21 pulados, 1 todo | 132 arquivos, **1298 testes** | 129 arquivos, **2384 testes** | nenhuma (`EXIT=0`) |

Os 21 testes pulados e os 2 arquivos pulados da api **não são testes de banco**: são os que dependem do repositório irmão `financeiro-tria`, da pasta de export do ClickUp e um `it.skip` deliberado do bucket de Storage (mesmos da Fase 14). Todos os arquivos com banco rodaram contra o Postgres de Docker.

Trecho da saída da api na 2ª rodada (o resto da saída, antes do `vitest run`, é o `typecheck` limpo, o `eslint` com os 2 avisos e `verificar:tokens` com 0 falhas):

```text
 ❯ src/persistencia/outbox-worker.test.ts (15 tests | 3 failed) 76ms
   ❯ worker de entrega (Postgres real) (6)
     × (i) resposta perdida: volta a 'pending' e a segunda tentativa reenvia a MESMA Idempotency-Key 4ms
     × (j) 422 vira 'failed' imediato, sem nova tentativa 2ms
     × (k) attempts atingindo maxTentativas vira 'failed' mesmo com status retryable 2ms
 Test Files  1 failed | 192 passed | 2 skipped (195)
      Tests  3 failed | 2446 passed | 2 expected fail | 21 skipped | 1 todo (2473)
 Test Files  132 passed (132)      Tests  1298 passed (1298)      [web]
 Test Files  129 passed (129)      Tests  2384 passed (2384)      [domínio]
```

### Flakes de baseline, com evidência

- **O que falhou:** só `src/persistencia/outbox-worker.test.ts`, sempre com `pending` no lugar do esperado (casos h a k); é o flake registrado desde as Fases 11 e 12 e medido de novo na Fase 14.
- **Rodado sozinho num Postgres de Docker novo e migrado até a `012`, três vezes, um contêiner novo por tentativa** (`2026-11-06T23:21Z`): **tentativa 1: 15 de 15 passam; tentativa 2: 12 de 15 (falham h, i, j); tentativa 3: 11 de 15 (falham h, i, j, k).** Ou seja, o arquivo é instável também isolado, em banco novo: não é interferência dos outros testes. Isso bate com as notas do orquestrador (onda 4: falhou 2 de 3 isolado; onda 15: só o (k)).
- **A fase não tocou** `outbox-worker.ts`, `outbox-worker.test.ts`, `outbox.ts` nem `conexao.ts`: `git diff` entre o commit anterior ao plano 15-01 (`b0a240e`) e o `HEAD` sobre esses quatro arquivos é vazio. O mesmo arquivo falhou no commit anterior à Fase 14 (`606cee8`).
- **Outros flakes de baseline** que apareceram durante a fase e não neste gate: `colunas-geradas.test.ts` (ordenação e planejador; passou isolado 8 de 8 nas ondas 1 a 3, na 7 e na do 15-29), `automacoes/invocar-agente.test.ts` (tempo, sem banco; passou isolado 108 de 108, 15-31), `lote-contas-a-pagar (d)` (rede). Também houve rodadas da web com `Test timed out in 5000ms` em arquivos que passam isolados e na suíte repetida (carga alta da máquina, 15-40 e onda 6): não é regressão.

### Histórico dos gates por onda (do orquestrador)

Cada onda rodou `npm run build` e `npm run check` num Postgres 16 novo (`crm-n1-pg-15`, porta 55715), mais os hooks `verify.schema-drift`, `verify.codebase-drift` e `ui.safety-gate` (todos `block:false`). Onda 5: build 0, check 0 (domínio 2430, web 1277, api 2285). Onda 6: build 0, api 2285 e domínio 2456; web com 6 timeouts de 5000 ms sob carga (4 arquivos passam isolados, a suíte repetida passou 132/132). Onda 7: só a api (colunas-geradas isolado ok; outbox-worker pré-existente; **1 falha real corrigida pelo orquestrador**, `migrar.cli.test.ts` fixava a porta do contêiner do executor, commit `cfa70fe`). Onda 8 e 9: só baseline. Onda 10: check 0 (api 2430, web 1298, domínio 2464), sem flake. Onda 11: check 0 (api 2458, web 1298, domínio 2399). Onda 12: check 0 (api 2444, web 1299, domínio 2404). Onda 13: build e check de domínio e web. Onda 14: check 0 (api 2447, web 1297, domínio 2384). Onda 15: só o `outbox-worker` (k) (api 2448, web 1298, domínio 2384).

## Decisões tomadas em nome do dono, para ele revisar

Em 2026-11-06 o dono disse, textualmente: **"pode fazer o que precisar para fechar a fase"**. O orquestrador da execução usou essa frase para responder três checkpoints que eram dele. Cada resposta foi dada **depois de conferir a evidência que o checkpoint pedia** e está gravada no SUMMARY do plano. Nada abaixo foi confirmado por você em pessoa. Antes do corte, desfazer (b) e (c) é reverter commits do ramo; (a) não deixa nada no código.

| # | Checkpoint | Resposta dada em seu nome | O que foi conferido antes | Como desfazer |
|---|---|---|---|---|
| (a) | **15-30:** o dono renova a cópia de `~/n1-ensaio` ou manda "usar a cópia de 2026-11-05" | **"usar a cópia de 2026-11-05"** | `ls -la` e `wc -l` dos quatro arquivos (nenhum conteúdo aberto): o `.dump` de 2026-11-05 11:13, o CSV de 10:11, `contagem-origem.txt` e `workspaces.csv`. O ensaio inteiro, e o final deste plano, rodaram sobre ela. | Renove a cópia (`15-ENSAIO.md`, "Como repetir com a cópia renovada") e repita o ensaio. Nada a reverter. |
| (b) | **15-32:** remover do código as 40 operações do CRM antigo (e `POST /operacoes/<nome antigo>` passa a responder 404)? | **"remover"** | As três guardas verdes no `check` do gate da onda 10, os SUMMARYs das telas trocadas (conferidos onda a onda), `15-ENSAIO.md` (ensaio ok) e o último `check` em Docker verde. | Reverter os commits do 15-32: `38f6023`, `b0f4e6a`, `5869fb8`, `5c14021`, `c06c7b1`. |
| (c) | **15-33:** seguir para a ponte dos Canais, as guardas finais, as Pastas, a limpeza do domínio e o `DataState` | **"seguir"** (vale para os planos 15-33, 15-41, 15-42 e 15-43) | O SUMMARY do 15-32 (arquivos apagados, 40 nomes em 404 sem tocar o banco, as 5 operações da Conversa de Grupo mantidas, Grupo e Flow intactos) e o gate da onda 11. | Reverter os commits do 15-33 (`f734663`, `a202f6f`, `ac00baa`, `eacb8bd`, `62d4226`, `a988c0d`, `f862962`, `6bc5757`), 15-41 (`9469015`, `faa2833`, `0e9157a`, `18023d1`, `73cdcfe`, `869f7e3`, `d3648ff`), 15-42 (`9a74cc5`, `4ecdce8`, `4efb815`, `13ac2a7`, `9de8255`, `2a5b473`, `36762c0`, `dff8891`) e 15-43 (`5d977c5`, `fce5b4c`, `88814aa`, `11e5863`, `43fd8fd`, `f268958`), do mais novo para o mais velho (os commits `docs(…)` no meio só mexem em SUMMARY, STATE e ROADMAP). |

**A licença NÃO cobriu o corte em produção (15-35).** Nenhum agente rodou, nem vai rodar, nenhum passo de `15-CORTE.md`: backup, migração, `--guardar`/`--migrar` em produção, `publicar.sh` e o push da web são só seus. Também não houve push, deploy, acesso à VM nem a qualquer banco remoto na execução desta fase.

**Efeito da resposta (b)/(c) que você deve conhecer:** 40 nomes de operação respondem 404 (não 45): as cinco da Conversa de Grupo na Caixa (`resolveConversation`, `reopenConversation`, `assignConversation`, `trashConversation`, `toggleConversationStar`) ficam, porque Grupo e Flow ainda dependem delas (WINDOWS #41, #65). `conversa-de-grupo.ts` não foi apagado. Também saiu a ponte dos Canais: `canaisMs` deixou de existir na linha `"gravacao medida"` do log de `POST /operacoes` (o formato do log mudou; `idasEVoltas` de uma gravação comum é 2 mesmo na primeira do processo).

## Fronteira de deploy (D-15-03)

Tudo da Fase 15 sobe junto, no corte, pelo `15-CORTE.md`: a `012`, o script de dados, a API e a web. Não existe ponte entre o CRM antigo e o novo (F14-D-01). **Ordem que não pode mudar:** o `migrar:crm-antigo` roda **antes** de a versão nova subir. Uma linha antiga que sobre em `plataforma.registros` volta como chave desconhecida em `GET /estado` até ser apagada (`apps/api/src/persistencia/hidratar-crm-antigo.test.ts` prova as duas metades). Depois do corte, em produção, `POST /operacoes/<nome antigo>` responde 404 e os ids antigos de Tarefa conversacional já respondiam 404 desde 2026-11-05.

O ramo `fase-13-gravacao-em-menos-idas-e-voltas` traz também commits de outras fases que ainda não estão na `main` do `n1-tecnologia/crm`: leia `git log --oneline n1/main..<sha>` antes do passo 9 do corte.

## Suposições adotadas a confirmar com o dono

Decisões que os planos tomaram dentro do que o plano deixava aberto. Se você não disser nada, ficam como estão.

1. **Ids preservados (15-28, 3.5.1).** O id antigo de Contato, Empresa, Funil, Negócio, Canal, Conversa e Mensagem vira o id novo (as colunas são `text`). Etapa, Identificador e vínculo ganham id novo, com linha em `plataforma.crm_de_para`. Por isso os Vínculos de Tarefa, a `provenance`, o escopo de Automação e a `canaisDeAtendimento` de uma Lista não são reescritos e seguem achando o registro. Só os registros que **não migram** (relatório de "Não migrados") ficam apontando para um id que não existe.
2. **Empresa do cartão (15-05, suposição A6).** A 007 não tem "vínculo principal". A Empresa do cartão e da ficha da Tarefa é o vínculo vigente `admin` mais antigo (sem admin, o vigente mais antigo; Empresa na lixeira passa a vez). Trocar a regra muda só o `order by` da consulta.
3. **"Conversas resolvidas" do Início (15-18, WINDOWS #33).** Conta as Conversas resolvidas **de que o Membro é o Atribuído** (`resolvida_em`), não as que ele clicou em resolver: o modelo novo não guarda quem resolveu. Reabrir e resolver de novo conta uma vez.
4. **Escopo de Atividade (15-09, D-15-09).** Gravam Registro de Atividade no CRM novo: mover, atribuir (e tirar o Atribuído), lixeira, restaurar, estrela e leitura (só quando mudam), transferir Identificador, consentimento, Nota e a sucessão de Membro. **Não gravam** (WINDOWS #26): criar, editar, ganhar, perder e reabrir Negócio, criar Contato e Empresa e mandá-los à lixeira. As telas antigas gravavam; depois do corte esses gestos deixam de aparecer na Auditoria.
5. **Conversa de Grupo do Membro removido passa ao Sucessor (15-36).** `removeMember` do modelo antigo passa o Atribuído das Conversas de Grupo ao Sucessor, a mesma regra do 15-03; o diálogo de remover Membro só conta as Conversas das tabelas (WINDOWS #14).
6. **Demo só em banco local (15-29).** `npm run bootstrap:crm-demo -w @n1/api -- --espaco <id>` recusa banco que não seja `localhost`/`127.0.0.1`, Espaço inválido ou inexistente e Espaço que já tem Contato. O demo é mais magro que o seed antigo (3 Canais e 16 Conversas, contra 5 e 23; sem temperatura, Tags, LinkedIn nem chat do site) e foi provado só em Docker (WINDOWS #57, #58).
7. **Liberação do Atribuído (15-03).** O plano dizia que sair de Equipe ou dos elegíveis continuava liberando a Conversa; o executor manteve RN-CXE-24 (sair de Equipe ou dos elegíveis **não** libera) e só Agente excluído ou sem `ver` libera (B23). Contrato emendado primeiro (RN-ET-09 a, RN-CXE-24, decisão B28-a).
8. **Qualificação e Origem do Contato (15-05, 15-17, 15-28).** Levam o id do Catálogo como texto; a tela mostra o rótulo só se o id existe no Catálogo. `conversa.estado` é sempre `ativo`. `contatos.origem` guarda o nome da Origem e `criado_por` é o Membro que importou. Identificador de WhatsApp é `+<dígitos>`. Risco T-15-15 aceito.
9. **Temperatura, Tags e o resto da lista da F14-D-04 (D-15-06).** Somem da tela e ficam só em `registros_crm_antigo`.
10. **Reunião (15-15, WINDOWS #29).** Perdeu Diagnóstico e Roteiro da call (`fd_*`), Temperatura, LinkedIn e TikTok: o Negócio novo não guarda Campos personalizados.
11. **Fora da janela de 24 h do WhatsApp oficial o envio desliga (15-20, WINDOWS #31):** o Canal novo não guarda modelos de Mensagem, e não há Rascunho de IA (D-15-11).

## Decisões do dono ainda pendentes

Cada uma é barata de mudar agora; nenhuma trava o corte. A coluna "Aviso" é a linha do `.planning/WINDOWS.md`. (Quando uma nota do orquestrador e o `WINDOWS.md` discordavam, valeu o arquivo: por exemplo, a nota dizia que os links de Busca/Caixa para ids antigos abririam "não encontrado" até migrar; o aviso 22 está `fixed`, porque o 15-28 preserva os ids, e só vale para o que não migra.)

| # | Pergunta | Aviso |
|---|---|---|
| 1 | **Funil do `ws_n1`:** migrar ou guardar. Adicionar um Funil vazio ao lado dos 2 que ele já tem, ou não mexer. | #60 |
| 2 | **Automação do seed `aut_clo_proposta`** (escopo `lst_funil_closer`) e as Ações `criar_tarefa` com alvo `lst_funil_sdr`/`lst_funil_closer` apontam para Listas que o seed não cria mais: num Espaço novo, `aut_clo_proposta` nasce inoperante. **Recomendação:** tirar `aut_clo_proposta` do seed, ou apontá-la para uma Lista real. | #61 |
| 3 | **Enviar Flow depois do corte:** a lista de destinatários fica vazia (as Conversas 1:1 saem de `registros`). Aceitar até a Sessão 7, ou pedir o seletor de Contatos com WhatsApp antes. | #73, #39 |
| 4 | Querer **Campos personalizados no Negócio** (devolveria o Roteiro e o Diagnóstico da Reunião)? | #29 |
| 5 | **Tag e Campo no Contato:** as Ações de Automação `contato.adicionarTag` e `contato.definirCampo` falham. | #12 |
| 6 | **Linha do tempo** de criar/editar/ganhar/perder/reabrir Negócio e de criar/lixeira de Contato e Empresa. | #26 |
| 7 | **Mensagens de modelo no Canal** (devolveria o seletor de modelo e o envio fora da janela), **Rascunho de IA** (Sessão 16), **Proprietário padrão do Canal editável**. | #20, #31 |
| 8 | **Prévia da última Mensagem** na linha da Conversa, na Caixa e no Início; filtros Sem Atribuído / Sem Fila / Adiadas feitos na api. | #18, #19, #46 |
| 9 | **Busca de Conversa pelo texto das Mensagens** (hoje só pelo título). | #23 |
| 10 | **Contagem de uso** de Tag, Campo e Catálogo no CRM; **acesso a Funil novo privado** (a Governança só reconhece Espaço, Pasta, Lista e Coleção). | #25 |
| 11 | **Quadro na ficha do Funil** (o filtro Meus está em `/crm/negocios?meus=1`, não na ficha). Favoritos de `/crm/meus-negocios` caem no 404. | #44, #45 |
| 12 | **Aviso de consentimento de marketing** do fio: aparece sempre que o consentimento vigente não é `concedido`, inclusive Contato sem registro; restringir a "revogado"? | #43 |
| 13 | **Quem resolveu a Conversa** (gravar o Ator ao resolver) em vez de contar pelo Atribuído. | #33 |
| 14 | **Painéis semeados** (SDR, Closer, Atendimento) abrem zerados até a Fonte apontar para um Funil/Fila novo (Sessão 20.3); Origem e Motivo de Perda sem linhas. | #48 |
| 15 | **Restaurar o Contato arquivado/na lixeira ao receber Mensagem** (RN-CON-13) e conferir consentimento de marketing no envio do Grupo/Flow. | #70 |
| 16 | **Nome do Funil no Registro de Atividade** de "acesso concedido a Recurso privado". | #72 |
| 17 | Os avisos da Fase 14 que seguem abertos (seção própria abaixo). | — |

## Linhas abertas do `.planning/WINDOWS.md` (fase 15)

Todas as linhas `open` da fase 15 (43) e a `waived` (#30), com o que são, se pedem decisão sua e o que o corte muda. Nenhuma foi marcada como resolvida por este plano; a nova (#73) foi aberta por ele. As corrigidas ao longo da fase (`fixed`: #13, #15, #16, #17, #22, #24, #32, #34, #35, #37, #42, #49, #50, #52, #56, #63, #66, #69) não estão aqui.

| # | Plano | O que é | Decisão sua? | O que o corte muda |
|---|---|---|---|---|
| 12 | 15-07 | Ações de Automação de Tag e Campo do Contato falham | Sim (decisão 5) | Nada |
| 14 | 15-36 | O diálogo de remover Membro não conta as Conversas de Grupo que passam ao Sucessor | Não | Some com o Grupo (Sessões 6 e 7) |
| 18 | 15-11 | Sem Atribuído, Sem Fila e Adiadas filtram só a página de 200 Conversas | Só se um Espaço passar de 200 ativas | Nada |
| 19 | 15-11 | Linha da Conversa sem prévia da última Mensagem | Sim (decisão 8) | Nada |
| 20 | 15-12 | Ficha do Canal sem Mensagens de modelo; Proprietário padrão só leitura | Sim (decisão 7) | Nada |
| 21 | 15-12 | O popup "Adicionar Canal" só escolhe; ir conectar um Canal perde o diálogo de criar Lista meio preenchido; carga da Fila conta só abertas | Não (é o D-15-12) | Nada |
| 23 | 15-14 | Busca acha Conversa só pelo título | Sim (decisão 9) | Nada |
| 25 | 15-16 | Tags, Campos e Catálogos sem o uso no CRM; sem tela para dar acesso a Funil novo privado | Sim (decisão 10) | Nada |
| 26 | 15-09 | Criar/editar/ganhar/perder/reabrir Negócio, criar Contato/Empresa e lixeira não gravam Atividade | Sim (decisão 6) | A Auditoria deixa de mostrar esses gestos |
| 27 | 15-09 | O contador e o "de N" da Auditoria contam `state.activity` inteiro mais só as páginas lidas do CRM novo | Não | Nada |
| 28 | 15-10 | `POST /crm/nomes` é leitura mas é POST: Membro suspenso recebe 403 (WR-03) | Não | Nada |
| 29 | 15-15 | Reunião sem Diagnóstico, Roteiro, Temperatura, LinkedIn, TikTok | Sim (decisão 4) | Nada |
| 30 | 15-15 | (waived) A Reunião não chama `useFunil`: o payload do Negócio já traz Funil e Etapa | Não | Nada |
| 31 | 15-20 | Fio sem Rascunho de IA nem Mensagem de modelo; fora da janela de 24 h o envio desliga | Sim (decisão 7) | Nada |
| 33 | 15-18 | "Conversas resolvidas" = resolvidas das quais o Membro é o Atribuído | Confirmar (suposição 3) | Nada |
| 36 | 15-19 | Nome do cliente de Contas a receber via `POST /crm/nomes`; "Cliente" quando falta nome; cliente só Contato | Não | Some com WR-03 |
| 38 | 15-22 | Mensagem recebida na Conversa de Grupo mostra "Participante" | Não | Some na Sessão 6 |
| 39 | 15-22 | Enviar Flow escolhe Conversa 1:1 de `state.conversations` | Ver #73 | **Depois do corte não há destinatário** (#73) |
| 40 | 15-24 | Coluna do Contato da Caixa sem ponto verde de janela, LinkedIn, Tarefa, resumo do Agente Enriquecedor e temperatura; painel Tags da Conversa saiu | Sim (devolver exige api e domínio) | Nada |
| 41 | 15-24 | A Conversa de Grupo na Caixa ainda resolve, reabre, atribui e manda à lixeira pelas operações antigas | Não | Segue até as Sessões 6 e 7 |
| 43 | 15-25 | Aviso de consentimento de marketing aparece sempre que o vigente não é `concedido` | Sim (decisão 12) | Nada |
| 44 | 15-26 | O filtro Meus está em `/crm/negocios`, não na ficha do Funil | Sim (decisão 11) | Nada |
| 45 | 15-26 | O painel do CRM perdeu o grupo "Pastas de Negócios"; favoritos de `/crm/meus-negocios` caem no 404 | Não (T-15-63 aceito) | Nada |
| 46 | 15-23 | Mensagens novas do Início sem trecho; >200 Conversas diz "nas primeiras N de M"; Leads no máximo 50 | Sim (decisão 8) | Nada |
| 47 | 15-23 | Estatísticas do Início em duas janelas, comparação por dia inteiro; zeros com aviso se a api recusa | Não | Nada |
| 48 | 15-23 | Painéis semeados abrem zerados; Origem e Motivo de Perda sem linhas; cada Widget lê até 200 | Sim (decisão 14) | Os Painéis semeados abrem zerados |
| 51 | 15-27 | A Pasta "Meus negócios" com Tarefa não sai (16 dos 17 Espaços de teste) e o script não reescreve referências de fora às Listas | Regra D-15-14 já decidida; confirmar uma vez | Pasta fica como Pasta comum |
| 53 | 15-28 | O que o `--migrar` não leva (temperatura, Tags, LinkedIn/TikTok/chat do site, Empresa sem admin, detalhes do Negócio, vínculos Empresa-Empresa…) | Sim: ler o "Não migrados" do `--seco` de cada Espaço | Fica só em `registros_crm_antigo` |
| 54 | 15-28 | Campos personalizados entram com o id da Definição como chave; Canal migrado entra desconectado; Qualificação e Origem levam o id do Catálogo | Não | Só se aplica ao que migra (no `ws_n1` da cópia, nada) |
| 55 | 15-28 | Os avisos 22, 32, 42, 49, 50 e 52 estão corrigidos por código e teste em Docker; em produção o efeito só existe depois do `--migrar` | Não | Efeito real só depois do corte |
| 57 | 15-29 | O demo é mais magro que o seed antigo | Não | Só desenvolvimento |
| 58 | 15-29 | `bootstrap:crm-demo` provado só em Docker; nenhuma tela aberta sobre o demo | Não | Só desenvolvimento |
| 59 | 15-30 | O ensaio rodou sobre a cópia de 2026-11-05 | Sim (decisão (a)) | O `--seco` do dia cobre |
| 60 | 15-30 | Funil do `ws_n1` e a Pasta em 16 Espaços de teste | Sim (decisão 1) | É o passo 5 do corte |
| 61 | 15-31 | Automações do seed apontam para Listas espelho que o seed não cria | **Sim (decisão 2)** | Só vale para Espaço novo |
| 62 | 15-31 | Saíram do seed os Envios e Respostas de Flow, a Tag "Em grupo de alunos" e o `groupsEnabled` do Canal | Não | Só seed |
| 64 | 15-31 | As Reuniões do processo comercial saíram do seed do produto | Não | Só seed |
| 65 | 15-32 | `conversa-de-grupo.ts` não pôde ser apagado (Grupo, Flow, Automação); 40 nomes em 404, não 45 | Não | Segue até as Sessões 6 e 7 |
| 67 | 15-33 | Grupo, Flow e Automação acham o Canal em `crm.canais` (lido da tabela), sem projeção | Não | Segue até as Sessões 6 e 7 |
| 68 | 15-33 | Criar/renomear Canal não confere mais nome e conta contra `chn_*` antigos; `canaisMs` saiu da medição | Não | O `--seco`/`--migrar` relatam `canal-repetido` |
| 70 | 15-42 | `receiveMessage` não reativa Contato arquivado/na lixeira (RN-CON-13); sem checagem de consentimento de marketing no envio do Grupo | Sim (decisão 15) | Nada |
| 71 | 15-42 | Nome e dono do cliente nas Automações de Contas a receber só chegam pela agenda, não por evento | Não | Nada |
| 72 | 15-42 | Registro de Atividade de "acesso concedido" nomeia o Funil por id | Sim (decisão 16) | Nada |
| 73 | 15-34 | Depois do corte "Enviar Flow" não tem Conversa 1:1 para escolher | **Sim (decisão 3)** | **Muda**: a lista de destinatários fica vazia |

## Provas manuais pendentes

O `human_verify_mode` desta fase é `end-of-phase`, e **nenhuma tela da Fase 15 foi aberta em navegador real**: os SUMMARYs registram só teste de componente com cliente falso, teste de rota e de domínio, `tsc` e `build`. Viram prova sua com `npm run dev` apontado para um Postgres local migrado até a `012` (e, se quiser dados, `npm run bootstrap:crm-demo -w @n1/api -- --espaco <id>`, só em banco local). Percorra, pelo menos:

- **Caixa de Entrada** (15-11, 15-24): lista, abas, estrela, atribuir, resolver, reabrir, mover, lixeira; a coluna do Contato.
- **O fio da Conversa** (15-20, 15-25): responder, abas por Canal e "Responder por", Nota, aviso de consentimento, a ficha da Tarefa com o fio e as três colunas.
- **Configurações da Caixa, Filas e Canais** (15-12): o popup "Adicionar Canal" das Listas, a página de conectar, a ficha do Canal.
- **Fichas de Contato, Empresa e Negócio** (15-13) e a **Reunião** (15-15): o 404 como "não encontrado", a nota da call, "Tudo que já aconteceu".
- **Meus negócios** (15-26, 15-40, 15-41, 15-43): o botão Meus em `/crm/negocios`; o **Quadro de uma Lista conversacional** (o `quadro-negocios.tsx` virou `quadro-conversacional.tsx`; arrastar entre colunas, "+" abre Nova Tarefa); a **Lista da Pasta "Meus negócios"** com Tarefas de Negócio.
- **Busca, Lixeira e Notificações** (15-14); **Início** (15-16, 15-18, 15-23: Leads, Mensagens novas, estatísticas, robô) e **Painéis semeados**, que abrem zerados (#48); **Configurações** (Funil padrão, "Crie seu primeiro Funil").
- **Ferramentas** (15-07, 15-17, 15-22, 15-38): Grupos, Comunidades, Flows, "Novo Grupo" e o link de convite; **o envio ao Grupo e o envio de Flow** e a **Conversa de Grupo na Caixa** (resolver, reabrir, atribuir, lixeira, estrela) **só têm teste de domínio, de rota e de componente** (15-32, 15-33, 15-42, 15-43).
- **IA e Contas a receber** (15-08, 15-21, 15-39, 15-19): a Âncora do Chat e do ensaio, a Nova Automação, o cliente de Contas a receber com nome.
- **Gestos da Auditoria** (15-09, 15-37) e o **diálogo de remover Membro** (15-36).
- **A volta real R4/R5 de Contas a receber** com Contato na tabela (15-42) **não foi rodada ponta a ponta**.
- **Da Fase 14, `14-PROVAS.md`:** 14-11 (nota, consentimento, transferir Identificador e "Mesclar com…" na ficha nova), 14-12 (marcar Canal da tabela numa Lista conversacional), 14-15 (cartão, tabela, cartão de Reunião e ficha da Tarefa lendo o resumo) e 14-16 (diálogo de nova Tarefa com "Primeira Mensagem", botão Criar Tarefa do fio, os três gestos da ficha da Tarefa e o diálogo de remover Membro com as contagens). O "Mesclar com…" agora pede digitar o nome do absorvido (D-15-10).

## Avisos da Fase 14 que seguem abertos

O 14-REVIEW-DISPOSITION.md ainda marca os 14 como `open` (ninguém o atualizou); o que a Fase 15 corrigiu está nos SUMMARYs.

- **Corrigidos nesta fase (D-15-07):** WR-01, WR-02, WR-05 e WR-06 (plano 15-02), e a pendência do `instantiateListTemplate` (15-01).
- **Seguem abertos:**
  - **WR-03:** `POST /tarefas-conversacionais/resumo` é leitura, mas o hook de suspensão a trata como escrita (afeta também `POST /crm/nomes`, #28 e #36).
  - **WR-04:** a falha do resumo deixa cartões, linhas e ficha em esqueleto para sempre.
  - **WR-07:** criar Tarefa com `negocioId` confere o Negócio sem travá-lo.
  - **WR-08:** recusas do domínio no gesto misto viram 409 `RECUSA_DO_DOMINIO` mesmo quando são 403 ou 404.
  - **WR-09:** "Sem Responsável" no diálogo de nova Tarefa conversacional atribui a Tarefa ao criador.
  - **IN-01:** em repetição de `removeMember`, o Sucessor pode ser um Convidado.
  - **IN-02:** a seção Notas mostra só a primeira página e anuncia "Mostrando X de Y" sem como ver o resto.
  - **IN-03:** `lidaAte` pode regredir e ir ao futuro.
  - **IN-04:** o backfill da `011` mexe em `atualizado_em` de todas as Conversas já na lixeira (a 011 já está em produção; não se corrige).
  - **IN-05:** o resumo aceita ids sem relação com Tarefas que o Membro enxerga.

## Cobertura dos requisitos (UCR)

| Requisito | Planos | Estado |
|---|---|---|
| UCR-01 | 15-01, 15-02 | Código e testes; gate |
| UCR-02 | 15-03, 15-09, 15-36 | Código e testes; diálogo não aberto em navegador |
| UCR-03 | 15-04, 15-09, 15-15, 15-37 | `012` e Atividade provadas em Docker; só local até o corte |
| UCR-04 | 15-05, 15-25 | Código e testes |
| UCR-05 | 15-06, 15-11, 15-12, 15-20, 15-24, 15-25 | Código e testes; telas não abertas |
| UCR-06 | 15-13, 15-15, 15-24, 15-26, 15-40 | Código e testes; telas não abertas |
| UCR-07 | 15-06, 15-14, 15-16, 15-18, 15-23 | Código e testes; telas não abertas |
| UCR-08 | 15-07, 15-08, 15-10, 15-17, 15-19, 15-21, 15-22, 15-38, 15-39 | Código e testes; telas não abertas |
| UCR-09 | 15-27, 15-28, 15-35 | Script provado em Docker (15-27, 15-28, ensaio); **rodar em produção é o 15-35** |
| UCR-10 | 15-30, 15-34, 15-35 | Ensaio (15-30), ensaio final e roteiro (15-34); **o corte é o 15-35, só do dono** |
| UCR-11 | 15-16, 15-29, 15-31 | Código e testes |
| UCR-12 | 15-06, 15-32, 15-33, 15-41, 15-42, 15-43 | Código e testes; guardas `sem-crm-antigo` vazias nas três camadas |

## Linhas para `docs/09-planejamento/dados/andamento.mjs`

Para você colar (o arquivo não é rastreado pelo git e tem trabalho seu em andamento; **este plano não o editou**, nem o `TAREFAS-POR-SESSAO.md`, que é gerado dos `dados/*.mjs`). Usam os ajudantes do arquivo (`feito`, `parcial`, `aguarda`). Antes de colar, lembre que `parte-c.mjs` é a fonte dos nomes e o gerador para se o `confere` não bater. **3.5.2 fica `parcial` até o corte.**

```js
  // 3.4 e 3.5 Telas no modelo novo e remoção do modelo antigo (Fase 15, planos 15-01 a 15-43)
  "3.4.1": feito("Caixa de Entrada: lista e gestos", "15-06, 15-11 e 15-24", "A lista, os contadores das abas, a estrela, atribuir, resolver, reabrir, mover e lixeira da Conversa leem e gravam `plataforma.conversas` por `/conversas`. A linha da Conversa perdeu a prévia da última Mensagem. A Conversa de Grupo segue pelo modelo antigo (F14-D-05). Nenhuma tela foi aberta em navegador real.", "2026-11-06"),
  "3.4.2": feito("Caixa de Entrada: fio e envio", "15-20 e 15-25", "O fio recebe ids e lê Contato, Canais, Conversas e Mensagens pela api; responder é `POST /mensagens` e a Nota grava em `contato_notas`. Sem Rascunho de IA (D-15-11) e sem Mensagem de modelo: fora da janela de 24 h do WhatsApp oficial o envio desliga.", "2026-11-06"),
  "3.4.3": feito("Caixa de Entrada: configurações", "15-12", "A ficha do Canal lê `GET /canais/:id` e salva por `PATCH`; a Fila e as Configurações contam por `GET /conversas`. O popup \"Adicionar Canal\" das Listas só escolhe (D-15-12); o único caminho que cria Canal é a página de conectar.", "2026-11-06"),
  "3.4.4": feito("Fichas de Contato, Empresa", "15-13", "As três fichas perderam o recuo para o modelo antigo: 404 da api é \"não encontrado\", e os sete arquivos que só serviam ao recuo foram apagados.", "2026-11-06"),
  "3.4.5": feito("Meus negócios e Reuniões", "15-15, 15-26, 15-40 e 15-41", "\"Meus negócios\" virou o filtro `?meus=1` de `/crm/negocios`; a Pasta virou uma Pasta comum e a Lista espelho saiu. A Reunião lê o Negócio novo e perdeu Diagnóstico, Roteiro e Temperatura (o Negócio novo não tem Campos personalizados).", "2026-11-06"),
  "3.4.6": feito("Busca, Lixeira e Notificações", "15-14", "Contatos, Empresas, Negócios e Conversas vêm das rotas REST; o selo de Notificações soma o `total` de `GET /conversas`. A Busca de Conversa é pelo título.", "2026-11-06"),
  "3.4.7": feito("Início, Configurações e Painel", "15-16, 15-18 e 15-23", "O Início soma no banco por `/crm/inicio/*`; o Painel lê as listas da api; `/configuracoes` lê o Funil padrão de `useFunis` (um Espaço novo nasce sem Funil, D-15-13). Os Painéis semeados abrem zerados até a Fonte apontar para um Funil novo (Sessão 20.3).", "2026-11-06"),
  "3.4.8": feito("Ferramentas: Contatos e Canais", "15-07, 15-17, 15-22 e 15-38", "Grupos, Comunidades e Flows conferem Canal e Contato nas tabelas; o servidor monta o `crm` e descarta o do navegador. O envio de Flow segue por Conversa 1:1 do modelo antigo (F14-D-05), que o corte esvazia: ver o aviso 73 do `WINDOWS.md`.", "2026-11-06"),
  "3.4.9": feito("IA: alvos, escopos e âncoras", "15-08, 15-10, 15-21 e 15-39", "A Âncora do Chat e do ensaio é nomeada por `POST /crm/nomes`; o escopo Funil da Automação é conferido em `plataforma.funis`; arquivar um Agente solta as Conversas dele nas tabelas.", "2026-11-06"),
  "3.4.10": feito("Contas a receber: o cliente", "15-19", "O cliente é um Contato de `plataforma.contatos`, conferido pelo servidor ao criar a série e ao importar; o nome aparece por `POST /crm/nomes`.", "2026-11-06"),
  "3.5.1": feito("Escrever o script de migração", "15-27, 15-28 e 15-29", "`npm run migrar:crm-antigo -w @n1/api -- --espaco <id> --seco|--guardar|--migrar|--verificar`: copia, confere e só então apaga; `--migrar` leva Contatos, Empresas, Negócios, Canais, Conversas e Mensagens com os ids antigos preservados e lista o que não migra. Provado só em Docker.", "2026-11-06"),
  "3.5.2": parcial("Rodar a migração em homologação", "15-30 e 15-34", "Ensaiada em Docker sobre a cópia de 2026-11-05 (2128 = 2128 em cada um dos 19 Espaços) e de novo com o código final; o roteiro do corte está em `15-CORTE.md`. Falta o corte em produção, que é só seu (plano 15-35).", "2026-11-06"),
  "3.5.3": feito("Tirar o CRM antigo do seed", "15-29 e 15-31", "`buildSeed()` nasce sem Contatos, Empresas, Funis, Negócios, Canais e Conversas 1:1; a demonstração é `npm run bootstrap:crm-demo` (só banco local).", "2026-11-06"),
  "3.5.4": feito("Remover o modelo antigo", "15-32, 15-33, 15-41, 15-42 e 15-43", "O `DataState` perdeu as oito coleções; 40 operações antigas respondem 404; a ponte dos Canais saiu. Sobra só a Conversa de Grupo e o Flow (F14-D-05), até as Sessões 6 e 7. Em produção o antigo só sai com o corte.", "2026-11-06"),
```

## Incidentes e limites desta rodada

- **Nada foi rodado contra produção.** O gate e o ensaio usaram só Postgres de Docker local, com as duas URLs locais escritas em cada comando; o `.env` não foi lido. Nenhum contêiner `supabase_*` nem volume alheio foi tocado. Não houve push, deploy nem acesso à VM.
- **Dado pessoal.** O ensaio final leu o `.dump` de `~/n1-ensaio` só para dentro do Docker; nada da cópia foi impresso nem colado. `15-ENSAIO.md` e `15-CORTE.md` passam na checagem de "nenhum e-mail e nenhum telefone" (`grep` devolve 0). O ponto de restauração do ensaio e os scripts descartáveis foram apagados, e nenhum contêiner ficou de pé.
- **O gate não fechou totalmente verde** (acima); a evidência de que a falha é o flake de baseline está na seção "Flakes de baseline".
