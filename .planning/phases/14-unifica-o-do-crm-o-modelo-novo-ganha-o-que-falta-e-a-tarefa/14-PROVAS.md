# Fase 14 — Provas do fechamento

Este arquivo guarda o gate da Fase 14 (planos 14-01 a 14-17), a fronteira de deploy, o que foi adotado sem pergunta ao dono e o que ficou para a Fase 15. Foi escrito pelo plano 14-18. O ensaio D-02 (011 sobre a cópia dos dados reais) é do plano 14-19 e tem arquivo próprio (`14-ENSAIO.md`).

## Como rodar o gate

- **Comando (literal, como foi rodado):**

```bash
docker rm -f crm-n1-pg-1418 >/dev/null 2>&1
docker run -d --rm --name crm-n1-pg-1418 -e POSTGRES_PASSWORD=x -p 55618:5432 postgres:16
sleep 4 && until pg_isready -h localhost -p 55618 >/dev/null 2>&1; do sleep 1; done
(cd apps/api && DATABASE_URL=postgres://postgres:x@localhost:55618/postgres DATABASE_URL_MIGRACAO=postgres://postgres:x@localhost:55618/postgres npm run --silent migrar)
DATABASE_URL=postgres://postgres:x@localhost:55618/postgres DATABASE_URL_MIGRACAO=postgres://postgres:x@localhost:55618/postgres npm run check
docker rm -f crm-n1-pg-1418 >/dev/null 2>&1
```

- **Código medido (SHA):** `4e099286a10bd1524be1080095d8393b6ad9e073` (ramo `fase-13-gravacao-em-menos-idas-e-voltas`, `git rev-parse HEAD` antes de rodar; é o commit `docs(14-17)` do STATE e do ROADMAP do plano 17).
- **Quando:** `1ª rodada `2026-11-04T20:42:57Z`; 2ª rodada (repetição, como o plano manda) `2026-11-04T20:46:41Z``.
- **Onde:** Postgres 16 de Docker descartável (`crm-n1-pg-1418`, porta 55618), migrado do zero até a `011`. O gate nunca fala com o banco do `.env` (produção): as duas URLs vão escritas no próprio comando (T-14-43). `npm test` sozinho não foi usado como gate.
- **O que é o `npm run check`:** `typecheck` das três camadas, `eslint` da web, `verificar:tokens`, `verificar:contratos` e `npm run test` dos três workspaces.

## Resultado do gate

**Veredito: `npm run check` não fechou verde em nenhuma das duas rodadas, e a única falha em ambas é o flake de baseline de `outbox-worker.test.ts` (casos h a k).** `typecheck` das três camadas, `eslint`, `verificar:tokens`, web (107 arquivos, 1032 testes) e domínio (120 arquivos, 2322 testes) passaram nas duas rodadas. Nenhum outro teste de `apps/api` falhou. Os dois arquivos suspeitos passam isolados em banco novo (próxima seção). Nada abaixo foi editado; só foi cortado o que veio antes do `vitest run` da api (a lista de migrações aplicadas até a `011`, o `typecheck` limpo, o `eslint` com os 2 avisos antigos de `rotulos.ts` e `app-shell.tsx` e 0 erros, `verificar:tokens` com 0 falhas). O `verificar:contratos` pulou com aviso porque o repositório irmão `financeiro-tria` não existe nesta máquina.

Os 21 testes pulados e os 2 arquivos pulados da api **não são testes de banco**: são os que dependem do repositório irmão `financeiro-tria` (`e2e/dois-servicos`, `e2e/falhas-injetadas`, `automacoes/contrato-contas-a-pagar`), da pasta de export real do ClickUp (`importacao/clickup/contas-a-pagar` e `contas-a-receber`) e um `it.skip` deliberado do bucket de Storage (`rotas/integracao-solicitacoes` (m)). Todos os arquivos com banco rodaram contra o Postgres de Docker.

### 1ª rodada (saída da api, web e domínio)

```text
> @n1/api@0.1.0 test
> vitest run


 RUN  v5.0.1 /Users/igorvboas/Library/Developer/TRIA/CRM/crm-n1/apps/api

 ❯ src/persistencia/outbox-worker.test.ts (15 tests | 1 failed) 80ms
   ❯ worker de entrega (Postgres real) (6)
     × (j) 422 vira 'failed' imediato, sem nova tentativa 6ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/persistencia/outbox-worker.test.ts > worker de entrega (Postgres real) > (j) 422 vira 'failed' imediato, sem nova tentativa
AssertionError: expected 'pending' to be 'failed' // Object.is equality

Expected: "failed"
Received: "pending"

 ❯ src/persistencia/outbox-worker.test.ts:220:26
    218|
    219|     const linha = await buscarLinha(id);
    220|     expect(linha.status).toBe("failed");
       |                          ^
    221|     expect(linha.last_error_code).toBe("HTTP_422");
    222|   });

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯


 Test Files  1 failed | 174 passed | 2 skipped (177)
      Tests  1 failed | 2073 passed | 2 expected fail | 21 skipped | 1 todo (2098)
   Start at  17:43:27
   Duration  158.67s (tests 84%, import 14%, transform 1%)

    Isolate  177 workers spawned · ~46ms startup each (spawn + environment, per file)
             at least ~8.12s faster with isolate: false — reuses workers across files instead of one per file

npm error Lifecycle script `test` failed with error:
npm error code 1
npm error path /Users/igorvboas/Library/Developer/TRIA/CRM/crm-n1/apps/api
npm error workspace @n1/api@0.1.0
npm error location /Users/igorvboas/Library/Developer/TRIA/CRM/crm-n1/apps/api
npm error command failed
npm error command sh -c vitest run


> @n1/web@0.1.0 test
> vitest run


 RUN  v5.0.1 /Users/igorvboas/Library/Developer/TRIA/CRM/crm-n1/apps/web


 Test Files  107 passed (107)
      Tests  1032 passed (1032)
   Start at  17:46:06
   Duration  17.08s (tests 43%, environment 29%, import 18%, transform 10%)

    Isolate  107 workers spawned · ~470ms startup each (spawn + environment, per file)
             at least ~5.12s faster with isolate: false — reuses workers across files instead of one per file


> @n1/dominio@0.1.0 test
> vitest run


 RUN  v5.0.1 /Users/igorvboas/Library/Developer/TRIA/CRM/crm-n1/packages/dominio


 Test Files  120 passed (120)
      Tests  2322 passed (2322)
   Start at  17:46:23
   Duration  4.21s (tests 39%, import 37%, transform 23%, worker 2%)

    Isolate  120 workers spawned · ~84ms startup each (spawn + environment, per file)
             at least ~1.04s faster with isolate: false — reuses workers across files instead of one per file

EXIT=1
```

### 2ª rodada (repetição)

```text
> @n1/api@0.1.0 test
> vitest run


 RUN  v5.0.1 /Users/igorvboas/Library/Developer/TRIA/CRM/crm-n1/apps/api

 ❯ src/persistencia/outbox-worker.test.ts (15 tests | 4 failed) 98ms
   ❯ worker de entrega (Postgres real) (6)
     × (h) 503 volta para 'pending' com available_at no futuro; attempts incrementa 9ms
     × (i) resposta perdida: volta a 'pending' e a segunda tentativa reenvia a MESMA Idempotency-Key 6ms
     × (j) 422 vira 'failed' imediato, sem nova tentativa 6ms
     × (k) attempts atingindo maxTentativas vira 'failed' mesmo com status retryable 6ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 4 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/persistencia/outbox-worker.test.ts > worker de entrega (Postgres real) > (h) 503 volta para 'pending' com available_at no futuro; attempts incrementa
AssertionError: expected +0 to be 1 // Object.is equality

- Expected
+ Received

- 1
+ 0

 ❯ src/persistencia/outbox-worker.test.ts:181:28
    179|     const linha = await buscarLinha(id);
    180|     expect(linha.status).toBe("pending");
    181|     expect(linha.attempts).toBe(1);
       |                            ^
    182|     expect(new Date(linha.available_at).getTime()).toBeGreaterThan(ant…
    183|     expect(linha.last_error_code).toBe("HTTP_503");

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/4]⎯

 FAIL  src/persistencia/outbox-worker.test.ts > worker de entrega (Postgres real) > (i) resposta perdida: volta a 'pending' e a segunda tentativa reenvia a MESMA Idempotency-Key
AssertionError: expected +0 to be 1 // Object.is equality

- Expected
+ Received

- 1
+ 0

 ❯ src/persistencia/outbox-worker.test.ts:195:28
    193|     let linha = await buscarLinha(id);
    194|     expect(linha.status).toBe("pending");
    195|     expect(linha.attempts).toBe(1);
       |                            ^
    196|
    197|     // Simula "tempo suficiente passou" sem esperar o backoff real (o …

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/4]⎯

 FAIL  src/persistencia/outbox-worker.test.ts > worker de entrega (Postgres real) > (j) 422 vira 'failed' imediato, sem nova tentativa
AssertionError: expected 'pending' to be 'failed' // Object.is equality

Expected: "failed"
Received: "pending"

 ❯ src/persistencia/outbox-worker.test.ts:220:26
    218|
    219|     const linha = await buscarLinha(id);
    220|     expect(linha.status).toBe("failed");
       |                          ^
    221|     expect(linha.last_error_code).toBe("HTTP_422");
    222|   });

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/4]⎯

 FAIL  src/persistencia/outbox-worker.test.ts > worker de entrega (Postgres real) > (k) attempts atingindo maxTentativas vira 'failed' mesmo com status retryable
AssertionError: expected 'pending' to be 'failed' // Object.is equality

Expected: "failed"
Received: "pending"

 ❯ src/persistencia/outbox-worker.test.ts:240:26
    238|
    239|     const linha = await buscarLinha(id);
    240|     expect(linha.status).toBe("failed");
       |                          ^
    241|     expect(linha.attempts).toBe(1);
    242|   });

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/4]⎯


 Test Files  1 failed | 174 passed | 2 skipped (177)
      Tests  4 failed | 2070 passed | 2 expected fail | 21 skipped | 1 todo (2098)
   Start at  17:47:04
   Duration  156.75s (tests 84%, import 15%, transform 1%)

    Isolate  177 workers spawned · ~47ms startup each (spawn + environment, per file)
             at least ~8.28s faster with isolate: false — reuses workers across files instead of one per file

npm error Lifecycle script `test` failed with error:
npm error code 1
npm error path /Users/igorvboas/Library/Developer/TRIA/CRM/crm-n1/apps/api
npm error workspace @n1/api@0.1.0
npm error location /Users/igorvboas/Library/Developer/TRIA/CRM/crm-n1/apps/api
npm error command failed
npm error command sh -c vitest run


> @n1/web@0.1.0 test
> vitest run


 RUN  v5.0.1 /Users/igorvboas/Library/Developer/TRIA/CRM/crm-n1/apps/web


 Test Files  107 passed (107)
      Tests  1032 passed (1032)
   Start at  17:49:41
   Duration  17.32s (tests 44%, environment 28%, import 17%, transform 10%)

    Isolate  107 workers spawned · ~458ms startup each (spawn + environment, per file)
             at least ~4.99s faster with isolate: false — reuses workers across files instead of one per file


> @n1/dominio@0.1.0 test
> vitest run


 RUN  v5.0.1 /Users/igorvboas/Library/Developer/TRIA/CRM/crm-n1/packages/dominio


 Test Files  120 passed (120)
      Tests  2322 passed (2322)
   Start at  17:49:59
   Duration  4.27s (tests 41%, import 35%, transform 22%, worker 2%)

    Isolate  120 workers spawned · ~83ms startup each (spawn + environment, per file)
             at least ~1.02s faster with isolate: false — reuses workers across files instead of one per file

EXIT=1
```


## Fronteira de deploy (D-01)

O corte é de uma vez e não há ponte entre o CRM antigo e o novo (D-01). Por isso a Fase 14 não sobe inteira de uma vez.

| Planos | Natureza | Pode subir antes da Fase 15? |
|---|---|---|
| 14-01 a 14-14 | Aditivos: a `011`, as rotas novas, o domínio novo, o gesto misto, a ficha nova de Contato, a Tarefa conversacional nas tabelas (rotas `/tarefas-conversacionais`, que respondem 404 para ids antigos, mas ninguém as chama ainda) | Sim. Fronteira: commit `b9c3d86` (STATE e ROADMAP do 14-14); o último commit de código é `448de4f`. A `011` é a exceção: ver abaixo |
| 14-15, 14-16 e 14-17 | Corte: a web passa a ler e gravar a Tarefa conversacional pela api; as quatro operações antigas saem de `OPERACOES` (`POST /operacoes/<nome-antigo>` passa a responder 404) | Não. Só sobem no deploy da Fase 15, junto com o script de migração |

Commits de corte, para quem for montar o deploy: `29ca833`, `44e2e9b`, `ef1ebd1`, `3221865`, `ea419f5` (14-15); `bb56bce`, `84b0b66`, `aa93b2a`, `9260095`, `70ee049` (14-16); `5f36edb`, `2bd63c2`, `39d8643`, `aa22ff7`, `e24f4e4` (14-17). Os commits `docs(…)` intercalados não mudam o código.

Por que não sobem antes: hoje o navegador em produção ainda chama as quatro operações antigas. Publicar o 14-17 faz esse gesto responder 404; publicar o 14-15 e o 14-16 faz a web mandar ids novos que a produção ainda não tem. Com a migração da Fase 15, os dois lados passam juntos.

**A `011` em produção.** Ela só está em bancos locais descartáveis. É o dono quem a aplica, no deploy da Fase 15, nesta ordem: (1) backup manual do banco (o backup diário não está ligado, plano 09-18 pulado); (2) `npm run migrar -w @n1/api -- --seco`, que lista o que `migrar` faria sem escrever nada; (3) `npm run migrar -w @n1/api`; (4) `npm run banco:conceder`. A `011` é imutável depois de aplicada: qualquer ajuste de schema é a `012`.

## Nada apagado (D-03)

A Fase 14 não apagou nada de `plataforma.registros`. As coleções do CRM antigo (`contacts`, `conversations`, `deals`, `funnels`, `channels`, `companies`, com Tags, vários Contatos por Negócio, histórico de Etapas, Requisitos de Etapa e Anexos) continuam inteiras onde estavam. A tabela `plataforma.registros_crm_antigo` (a cópia de segurança) e `plataforma.crm_de_para` (o de-para de ids) nascem **vazias** com a `011`: quem as enche é o script da 3.5.1, na Fase 15. As quatro operações antigas da Tarefa conversacional saíram do registro de operações (14-17), mas isso é código: nenhum dado foi tocado.

## Suposições e perguntas em aberto para o dono

São decisões que os planos tomaram dentro do que o plano deixava aberto, ou que divergem do texto do cronograma. Nenhuma trava a Fase 15; cada uma é barata de mudar agora e mais cara depois. Se o dono não disser nada, ficam como estão.

1. **Conversas do Membro removido são liberadas, não passadas ao Sucessor (OQ2 e A8; plano 14-10).** Ao remover um Membro, os Contatos, Empresas e Negócios dele passam ao Sucessor; as Conversas atribuídas a ele ficam sem Atribuído. Segue a regra RN-ET-09(b) e diverge do texto da 3.2.8, que mandava trocar `atribuido_id` para o Sucessor. Se o dono quiser passar as Conversas, é decisão nova.
2. **Colisão de Conversa na mesclagem (OQ3; plano 14-09).** Quando o Contato absorvido e o sobrevivente têm Conversa aberta no mesmo Canal, fica a de Mensagem mais recente (empate pelo id), como diz RN-CXE-10. O texto da 3.2.2 dizia "a do absorvido".
3. **Gestos de uma base só do CRM novo não gravam Registro de Atividade (OQ5; planos 14-05 a 14-08, 14-10).** Mover, atribuir, lixeira, restaurar, estrela, leitura, nota, transferir Identificador e consentimento não aparecem na linha do tempo de Atividade. Só a mesclagem grava (ela mexe em `registros`). Decidir se uma tabela de Atividade do CRM novo vale um plano próprio.
4. **Última Mensagem da Tarefa (OQ6; plano 14-13).** O resumo mostra a Mensagem mais recente entre as Conversas ativas do Contato no Canal da Tarefa, como era hoje, e não a da Conversa exata ligada à Tarefa.
5. **Finalidade do consentimento conferida no Catálogo em `registros` (OQ7; plano 14-08).** A tela e a rota só aceitam finalidades que existem no Catálogo `finalidadeConsentimento`, que ainda mora em `plataforma.registros`. Quando o Catálogo for para tabela própria, a conferência muda de lugar.
6. **A única tela nova da Fase 14 é a ficha nova de Contato (OQ8; plano 14-11).** Mesclar, transferir Identificador, Notas e Consentimentos só aparecem nela. As telas antigas (ficha antiga, Caixa, fio, Reunião) não mudaram até a Fase 15.
7. **"Mesclar com…" não pede para digitar o nome do absorvido (plano 14-11).** O diálogo só avisa que a mesclagem é irreversível; o diálogo antigo exigia digitar o nome. Se o dono quiser o atrito extra, é um campo a mais.
8. **Trocar o Canal da Tarefa sempre abre um diálogo de confirmação (plano 14-16).** É nele que aparece o campo da "Primeira Mensagem" (D-07). Custa um clique a mais mesmo quando já há Conversa aberta no Canal.
9. **O sobrevivente da mesclagem pode passar de 20 Identificadores e de 10 Endereços (plano 14-09).** Os tetos só existem na edição; o banco não os impõe. A edição seguinte de Endereços pede para enxugar.
10. **O diálogo e a forma da resposta de criar Tarefa (planos 14-13 e 14-16).** O diálogo pede a primeira Mensagem quando não há Conversa aberta no par Contato e Canal (D-07) e ignora a Mensagem quando há. A resposta devolve a Tarefa mais `conversa: { id, aberta }`. Contato arquivado é recusado ao criar Tarefa e ao criar Negócio pela Tarefa (`CONTATO_INATIVO`), embora `POST /negocios` aceite Contato arquivado.
11. **Negócio cujo dono é a Empresa do Contato não aparece para ligar à Tarefa (plano 14-14).** A `007` dá um dono por Negócio. Se fizer falta, é decisão à parte.
12. **Suposições do 14-01 e da pesquisa (14-RESEARCH, A1 a A9):** a `011` não traz `webhooks_recebidos` nem o índice do outbox (A1, são da Fase 16); o ensaio é a `011` sobre a cópia, e o script de dados é da Fase 15 (A2); `contato_notas` e `contato_consentimentos` usam `on delete cascade`, sem FK para Membro ou Mensagem (A7, uma política de retenção diferente pede `restrict`); mesclar, mover e atribuir reusam as ações `editar`/`mover`/`enviar_para_lixeira`/`restaurar` de `permissoes.ts` (A9).

## O que o corte tira da tela (plano 14-15)

Como não há ponte entre as duas bases (D-01) e o resumo da Tarefa (`POST /tarefas-conversacionais/resumo`) não traz esses dados, o cartão da Tarefa conversacional e a ficha dela perderam, a partir do 14-15:

- a **Empresa** do Contato (a linha da Empresa foi removida);
- a **temperatura** e a **qualificação** do Contato;
- o **estado** e o **Atribuído** da Conversa.

Voltam quando o resumo os trouxer (decisão de escopo da Fase 15 ou posterior). Os dois `Select` da ficha da Tarefa (Canal e Negócio) mostram o valor atual por id antigo e ficam em branco com ids novos até a migração. O fio da Conversa e o layout de três colunas somem da ficha da Tarefa quando ela apontar para ids novos; a Caixa nova (Fase 15) entrega.

## Provas manuais pendentes

Os `<human-check>` dos planos abaixo não rodaram: o ambiente em que eles foram executados não tinha api e estado de verdade (os testes usaram api, hooks e estado falsos). Viram prova manual do dono depois da migração, com `npm run dev` apontado para um Postgres local migrado.

- **14-11:** nota, consentimento, transferir Identificador e "Mesclar com…" na ficha nova de Contato.
- **14-12:** o plano não tinha `<human-check>`; fica registrado que marcar Canal da tabela numa Lista conversacional (e recusar um id inexistente) foi provado só por teste de rota, e a tela só passa a ser vista depois da migração.
- **14-15:** cartão, tabela, cartão de Reunião e ficha da Tarefa lendo o resumo da api.
- **14-16:** diálogo de nova Tarefa com "Primeira Mensagem", botão Criar Tarefa do fio, os três gestos da ficha da Tarefa (trocar Canal, ligar Negócio, criar Negócio) e o diálogo de remover Membro com as contagens.

## Itens abertos

1. **`instantiateListTemplate` chama `createList` sem `canais` (pendência do 14-12; confirmada no 14-17).** Arquivo e linha: `packages/dominio/src/operations/planning.ts:364`. A operação não tem entrada em `LER_DO_CRM` (`apps/api/src/rotas/operacoes.ts`). Hoje funciona porque a projeção dos Canais das tabelas em `state.channels` segue ligada. Quando a 3.5.4 desligar a projeção, uma Lista conversacional instanciada de Template com configuração passa a recusar todo Canal. Precisa de entrada em `LER_DO_CRM` (posição do argumento `canaisDeAtendimento` e leitor dos Canais) antes da 3.5.4.
2. **`FRASES_DE_CONTATOS` sem `contatos_mesclado_em_fk` e sem as `contato_consentimentos_*`.** Vale se algum plano futuro usar essas constraints por um caminho que dependa da tradução em 409.
3. **Leituras antigas que ficaram, com chamador de produção (14-17).** `contatoDaTarefa`, `canalDaTarefa`, `conversaDaTarefa` (o fio e o layout de três colunas de `tarefa-completa.tsx`), `negocioDaTarefa` (`quadro-negocios.tsx` e o cartão do Negócio), `tarefasConversacionaisDoContato` (ficha antiga do Contato), `canaisDaLista`, `canaisDaListaQueAlcancam`, `listaSemCanais` e `canaisQueAlcancam` (fio, Detalhes da Lista, diálogo de iniciar conversa). Saem na Fase 15 (3.4.2, 3.4.5 e 3.5.4); a tabela com quem chama cada uma está em `14-17-SUMMARY.md`.

## O que ficou para a Fase 15 (e para as Sessões 6 e 7)

- **Telas antigas:** 3.2.5 (o diálogo antigo de mover Conversa segue na Caixa antiga) e 3.2.7 (o fio e a Reunião ainda escrevem as notas no Contato antigo, não em `contato_notas`) estão feitas na api e na ficha nova, mas as telas antigas só trocam na 3.4. Mesma coisa para atribuir, lixeira, restaurar e estrela da Caixa antiga.
- **O script de migração de dados** (3.5.1) e seu ensaio com a cópia do dono (plano 14-19, D-02); o preenchimento de `registros_crm_antigo` e `crm_de_para`.
- **A remoção do modelo antigo** (3.5.4), incluindo a ponte `canais-projetados.ts` e as leituras da lista acima. D-05: não sai por inteiro; sobra um resto de `Conversation` (só Grupo e Flow) até a Sessão 7.
- **Grupo e Flow (D-05):** a Conversa de Grupo (6.6.5) e as Mensagens de Flow ficam no modelo antigo até as Sessões 6 e 7. A `011` não ganhou `conversas.identificador_de_grupo` nem `mensagens.flow`/`resposta_de_flow`.
- **Meus negócios (D-06):** as Listas espelho são aposentadas na troca de tela (3.4.5); a Fase 14 só garante que nada novo dependa delas (guardas `sem-listas-espelho.test.ts` nas três camadas).
- **O que some da tela até uma sessão própria (D-04):** Tags, vários Contatos por Negócio com papel, histórico de Etapas, Requisitos de Etapa e Anexos de Empresa e Negócio; continuam guardados em `registros_crm_antigo` depois do script.

## Flakes de baseline

Evidência de que as falhas acima são o baseline conhecido, e não regressão da Fase 14.

- **O que falhou no gate:** só `src/persistencia/outbox-worker.test.ts`, 1 caso na 1ª rodada ((j)) e 4 casos na 2ª ((h), (i), (j), (k): sempre `pending` no lugar do esperado). É o conjunto que o orquestrador mediu no commit anterior à fase (`606cee8`), onde falhou na 1ª de 2 rodadas da suíte inteira, e o que as notas do projeto já registram desde as Fases 11 e 12.
- **Rodando o arquivo sozinho num Postgres de Docker novo e migrado até a `011`** (`crm-n1-pg-1418`, porta 55618, `DATABASE_URL` e `DATABASE_URL_MIGRACAO` locais escritas no comando, `2026-11-04T20:50:16Z`): `outbox-worker.test.ts` **15 de 15 passam**; `colunas-geradas.test.ts` **8 de 8 passam**.
- **Uma 3ª rodada da suíte inteira de `apps/api`** (só a api, mesmo banco novo e mesmas URLs, a mais, para listar os pulados): `outbox-worker` passou, e `colunas-geradas.test.ts` falhou 2 casos ("due_date: coluna gerada ordena como dueDate.value e reflete o valor" e "o planejador escolhe o índice quando não pode varrer sequencialmente"), 2074 testes passando e 2 falhando (de 2098, com 21 pulados e 1 todo). Os dois passam isolados (8 de 8 acima). Esse par é o segundo flake de baseline registrado pelo orquestrador. O resultado dessa rodada não faz parte do gate: foi só para conferir os pulados.
- **A fase não tocou** em `outbox-worker.ts`, nos testes dele, nem em `colunas-geradas` ou na `002`. O desvio de relógio do contêiner foi medido pelo orquestrador (~+15 ms ±35 ms) e não explica nem descarta; os casos que falham são os de resposta de erro, não o de sucesso (g).

Por isso o gate é registrado como **verde exceto os dois flakes de baseline, com a evidência acima**. Se o dono preferir um `check` totalmente verde antes de publicar, a saída é repetir o comando até passar (como na Fase 12) ou investigar o relógio do contêiner; não é trabalho da Fase 14.

## Incidente de teste sem `DATABASE_URL` (plano 14-17)

Duas execuções do `vitest` de `apps/api` no plano 14-17 (a do RED e a de uma correção de teste) rodaram **sem** `DATABASE_URL` no ambiente. `apps/api/src/rotas/operacoes.test.ts` chama `carregarEnv()` no topo, que lê o `.env` (produção), e o grupo "contra o banco real" usa `describe` simples (não `describeComBanco`, que só aceita host local). Por isso essas duas execuções **podem** ter aberto o banco do `.env`. O executor não leu o `.env`.

O que esse grupo faz em um banco é restrito ao Espaço de teste `ws_rotas_teste`: um insert em `plataforma.registros` e deletes por `workspace_id`. Na segunda execução a limpeza `limparEspaco` abortou em `crm_de_para` (a `011` não está em produção, então a tabela não existe lá) e fez rollback; por isso **pode haver resíduo** desse Espaço. Na primeira execução os 26 casos do grupo apareceram como pulados e a saída foi cortada, então não foi possível confirmar se o `beforeAll` chegou a falhar.

O plano 14-18 não rodou nada contra produção, e não pode. Para o dono conferir e decidir se limpa:

```sql
select count(*) from plataforma.registros where workspace_id = 'ws_rotas_teste';
```

Sugestão não feita (fora do escopo): trocar `d` por `describeComBanco` no bloco da linha ~270 de `operacoes.test.ts`, para que ele nunca abra banco remoto. Desde o 14-17, todo comando de teste de `apps/api` leva `DATABASE_URL` e `DATABASE_URL_MIGRACAO` locais escritas no próprio comando.

## Linhas para `docs/09-planejamento/dados/andamento.mjs`

Para o dono colar (o arquivo não é rastreado pelo git e tem trabalho dele em andamento; o `TAREFAS-POR-SESSAO.md` é gerado dos `dados/*.mjs` e não se edita à mão). Usam os mesmos ajudantes do arquivo (`feito`, `parcial`, `aguarda`). Antes de colar, lembre que `parte-c.mjs` é a fonte dos nomes e o gerador para se o `confere` não bater. 3.1.5 fica `parcial` até o ensaio do 14-19.

```js
  // 3.1 Decidir o corte e dar ao modelo novo o que falta (Fase 14, planos 14-01 a 14-18)
  "3.1.1": {
    ...feito("Como fazer o corte?", "decisão D-01", "O corte é de uma vez: a Fase 14 deixa o modelo novo pronto e a Fase 15 troca todas as telas e roda o script no mesmo deploy. Não se escreveu ponte. Os planos 14-01 a 14-14 são aditivos e podem subir; 14-15 a 14-17 só sobem com a Fase 15.", "2026-11-04"),
    decidido: "Escolha A: de uma vez. Preparar tudo, ensaiar a migração num Postgres local com uma cópia dos dados reais (não há homologação) e trocar todas as telas no mesmo deploy. Sem pontes que traduzam id antigo e novo.",
  },
  "3.1.2": {
    ...feito("O que o modelo novo precisa ganhar", "decisão D-04", "Entraram notas do Contato, consentimento, mesclagem, transferir Identificador, mover Conversa, atribuir, estrela, leitura e lixeira da Conversa (planos 14-05 a 14-11).", "2026-11-04"),
    decidido: "Escolha B: só o essencial. Somem da tela até uma sessão própria: Tags, vários Contatos por Negócio com papel, histórico de Etapas, Requisitos de Etapa e Anexos de Empresa e Negócio. Continuam guardados em `registros_crm_antigo`; nada é apagado.",
  },
  "3.1.3": {
    ...feito("Quando a Conversa de Grupo", "decisão D-05", "A `011` não ganhou colunas de Grupo nem de Flow.", "2026-11-04"),
    decidido: "Escolha B: Conversas de Grupo e Mensagens de Flow ficam no modelo antigo até as Sessões 6 e 7. Aqui só os Contatos e Canais das Ferramentas passam para os ids novos. O modelo antigo não sai por inteiro na Fase 15.",
  },
  "3.1.4": {
    ...feito("Meus negócios continua", "decisão D-06", "Nada novo depende das Listas espelho (guardas `sem-listas-espelho.test.ts` nas três camadas). A troca da tela é da 3.4.5.", "2026-11-04"),
    decidido: "Escolha B: aposentar as Listas espelho. \"Meus negócios\" vira o quadro de `/crm/funis/[funil]` com o filtro \"meus\"; as Reuniões continuam como Tarefas ligadas ao Negócio novo.",
  },
  "3.1.5": parcial("Escrever a migração nova", "14-01", "A `011` existe (`011-crm-o-que-faltava.sql`): `mesclado` no Contato, `contato_consentimentos`, `contato_notas`, `conversa_marcacoes`, `na_lixeira_em` na Conversa, `crm_de_para` e `registros_crm_antigo`, com teste de migração e `--seco`. Só roda em banco local; a aplicação em produção é do dono, no deploy da Fase 15. Falta o ensaio sobre a cópia dos dados reais (plano 14-19).", "2026-11-04"),

  // 3.2 Levar ao modelo novo as operações que só existem no antigo
  "3.2.1": feito("Criar o caminho para gestos", "14-03", "`executarGestoMisto` e `lerDoCrm` (`apps/api/src/servicos/crm/gesto-misto.ts`): o CRM e `plataforma.registros` gravam no mesmo commit, com tudo ou nada provado em Postgres local. Gesto com `aoConfirmar` sai do caminho de duas idas da Fase 13 (aceito: gestos raros).", "2026-11-04"),
  "3.2.2": feito("Mesclar Contatos no modelo novo", "14-04, 14-09 e 14-11", "`POST /contatos/:id/mesclar`, o Contato absorvido some das listas e a ficha dele redireciona para o sobrevivente. Colisão de Conversa segue RN-CXE-10 (fica a de Mensagem mais recente), não \"a do absorvido\". O diálogo de \"Mesclar com…\" está na ficha nova; a prova de tela com `npm run dev` fica para depois da migração.", "2026-11-04"),
  "3.2.3": feito("Transferir um Identificador", "14-06 e 14-11", "`POST /contatos/:id/identificadores/:identificadorId/transferir`; as Conversas passadas ficam na origem. Ação \"Transferir\" na ficha nova.", "2026-11-04"),
  "3.2.4": feito("Registrar e respeitar consentimento", "14-08 e 14-11", "`GET` e `POST /contatos/:id/consentimentos`, só inserção; a regra `SEM_CONSENTIMENTO` está pronta e testada para os modelos da Sessão 7. Finalidade conferida no Catálogo em `registros`.", "2026-11-04"),
  "3.2.5": parcial("Mover uma Conversa", "14-05", "`POST /conversas/:id/mover` pronto, com e sem Conversa aberta no destino. O diálogo da Caixa antiga segue no antigo até a Fase 15 (3.4.1).", "2026-11-04"),
  "3.2.6": feito("Dar à Conversa nova", "14-05 e 14-07", "Atribuir, lixeira, restaurar, estrela e leitura por Membro, e `GET /conversas` com `atribuidoId`, `filaId`, `comEstrela`, `q`, `naoLidas` e o nome do Contato. Não gravam Registro de Atividade.", "2026-11-04"),
  "3.2.7": parcial("Guardar as notas do Contato", "14-06 e 14-11", "`GET` e `POST /contatos/:id/notas` sobre `plataforma.contato_notas`, e a seção Notas da ficha nova. O fio da Caixa e a Reunião ainda escrevem no Contato antigo até a Fase 15.", "2026-11-04"),
  "3.2.8": feito("Passar ao sucessor", "14-10 e 14-16", "Contatos, Empresas e Negócios do Membro removido passam ao Sucessor no mesmo commit; `GET /membros/:id/sucessao-no-crm` alimenta o diálogo de remoção. As Conversas atribuídas a ele ficam sem Atribuído (liberadas), diferente do texto da subtarefa: ver as perguntas em aberto em `14-PROVAS.md`.", "2026-11-04"),

  // 3.3 Levar a Tarefa conversacional para as tabelas novas
  "3.3.1": {
    ...feito("A Conversa da Tarefa pode nascer", "decisão D-07", "O diálogo de nova Tarefa pede a primeira Mensagem quando não há Conversa aberta no par Contato e Canal; havendo, reaproveita sem Mensagem nova (planos 14-13 e 14-16).", "2026-11-04"),
    decidido: "Escolha A: o diálogo pede a primeira Mensagem quando não há Conversa aberta; havendo uma, reaproveita sem mensagem nova. Mantém INV-CXE-05 e, no WhatsApp oficial fora da janela, essa Mensagem terá de ser modelo (Sessão 7).",
  },
  "3.3.2": feito("Trocar as leituras da Tarefa", "14-02 e 14-17", "`vinculosDoCrmDaTarefa` lê só os Vínculos, `alvoConferido` entra no nascimento e `derive-conversacional.test.ts` passa com o CRM antigo esvaziado do estado. As leituras antigas que o fio ainda usa (`contatoDaTarefa`, `canalDaTarefa`, `negocioDaTarefa` e vizinhas) ficam até a Fase 15.", "2026-11-04"),
  "3.3.3": feito("Criar a leitura em lote", "14-13 e 14-15", "`POST /tarefas-conversacionais/resumo` (até 200 Tarefas numa chamada) e `useResumoDasTarefas` no cartão, na tabela, no cartão de Reunião e na ficha. Perdas conscientes por não haver ponte: Empresa, temperatura, qualificação e estado/Atribuído da Conversa saíram do cartão e da ficha. Prova de tela fica para depois da migração.", "2026-11-04"),
  "3.3.4": feito("Trocar a criação da Tarefa", "14-13 e 14-16", "`POST /tarefas-conversacionais` grava a Tarefa em `registros` e a Conversa em `plataforma.conversas` no mesmo commit; a operação antiga saiu de `OPERACOES` (14-17). O diálogo antigo da Caixa e da ficha antiga do Contato passam ids antigos, que a rota nova recusa com 404 até a migração.", "2026-11-04"),
  "3.3.5": feito("Trocar o Canal da Tarefa", "14-14 e 14-16", "`POST /tarefas-conversacionais/:taskId/canal`: reaproveita a Conversa aberta no Canal novo ou abre uma; a Conversa antiga continua na Caixa. A ficha sempre abre um diálogo de confirmação.", "2026-11-04"),
  "3.3.6": feito("Ligar e criar o Negócio", "14-14 e 14-16", "`/negocio` (ligar ou desligar) e `/negocio/novo` (criar na 1ª Etapa); um Vínculo recusado não deixa Negócio. O Negócio cujo dono é a Empresa do Contato não aparece para ligar.", "2026-11-04"),
  "3.3.7": feito("Conferir os Canais da Lista", "14-12", "O servidor lê `plataforma.canais` dentro da transação (`LER_DO_CRM`) e descarta o `canais` que o navegador mandar. Pendência: `instantiateListTemplate` chama `createList` sem `canais` (`planning.ts:364`) e precisa de entrada em `LER_DO_CRM` antes da 3.5.4.", "2026-11-04"),
```
