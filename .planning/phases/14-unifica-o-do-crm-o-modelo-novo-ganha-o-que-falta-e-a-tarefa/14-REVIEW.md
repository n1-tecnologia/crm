---
phase: 14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa
reviewed: 2026-11-05T00:00:00Z
depth: standard
files_reviewed: 74
files_reviewed_list:
  - apps/api/migracoes/011-crm-o-que-faltava.sql
  - apps/api/src/persistencia/unidade-de-trabalho.ts
  - apps/api/src/repositorios/crm/consentimentos.ts
  - apps/api/src/repositorios/crm/contatos.ts
  - apps/api/src/repositorios/crm/conversas.ts
  - apps/api/src/repositorios/crm/marcacoes.ts
  - apps/api/src/repositorios/crm/mesclagem.ts
  - apps/api/src/repositorios/crm/negocios.ts
  - apps/api/src/repositorios/crm/notas.ts
  - apps/api/src/repositorios/crm/referencias.ts
  - apps/api/src/repositorios/crm/sucessao.ts
  - apps/api/src/repositorios/crm/tarefas-conversacionais.ts
  - apps/api/src/rotas/crm/consentimentos.ts
  - apps/api/src/rotas/crm/contatos.ts
  - apps/api/src/rotas/crm/conversas.ts
  - apps/api/src/rotas/crm/index.ts
  - apps/api/src/rotas/crm/mesclagem.ts
  - apps/api/src/rotas/crm/notas.ts
  - apps/api/src/rotas/crm/sucessao.ts
  - apps/api/src/rotas/crm/tarefas-conversacionais.ts
  - apps/api/src/rotas/esquemas/estrutura.ts
  - apps/api/src/rotas/esquemas/tarefas-conversacionais.ts
  - apps/api/src/rotas/operacoes.ts
  - apps/api/src/rotas/resposta-recortada.ts
  - apps/api/src/servicos/crm/consentimentos.ts
  - apps/api/src/servicos/crm/contatos.ts
  - apps/api/src/servicos/crm/conversas.ts
  - apps/api/src/servicos/crm/empresas.ts
  - apps/api/src/servicos/crm/gesto-misto.ts
  - apps/api/src/servicos/crm/mensagens.ts
  - apps/api/src/servicos/crm/mesclagem.ts
  - apps/api/src/servicos/crm/negocios.ts
  - apps/api/src/servicos/crm/notas.ts
  - apps/api/src/servicos/crm/sucessao.ts
  - apps/api/src/servicos/crm/tarefas-conversacionais.ts
  - apps/api/src/testes/banco-crm.ts
  - apps/web/src/app/(shell)/configuracoes/membros/page.tsx
  - apps/web/src/app/(shell)/crm/contatos/[contato]/page.tsx
  - apps/web/src/app/(shell)/estrutura/listas/[lista]/page.tsx
  - apps/web/src/dados/crm/consentimentos.ts
  - apps/web/src/dados/crm/contatos.ts
  - apps/web/src/dados/crm/notas.ts
  - apps/web/src/dados/crm/sucessao.ts
  - apps/web/src/dados/crm/tarefas-conversacionais.ts
  - apps/web/src/features/crm/ciclo-de-vida.tsx
  - apps/web/src/features/crm/consentimentos-do-contato.tsx
  - apps/web/src/features/crm/conversation-thread.tsx
  - apps/web/src/features/crm/ficha-de-contato.tsx
  - apps/web/src/features/crm/mesclar-contato-dialog.tsx
  - apps/web/src/features/crm/notas-do-contato.tsx
  - apps/web/src/features/crm/transferir-identificador-dialog.tsx
  - apps/web/src/features/estrutura/cartao-conversacional.tsx
  - apps/web/src/features/estrutura/cartao-de-tarefa.tsx
  - apps/web/src/features/estrutura/container-settings.tsx
  - apps/web/src/features/estrutura/create-container-dialog.tsx
  - apps/web/src/features/estrutura/nova-tarefa-conversacional-dialog.tsx
  - apps/web/src/features/estrutura/tabela-de-tarefas.tsx
  - apps/web/src/features/estrutura/tarefa-completa.tsx
  - packages/dominio/src/crm/consentimentos.ts
  - packages/dominio/src/crm/contatos.ts
  - packages/dominio/src/crm/conversas.ts
  - packages/dominio/src/crm/mesclagem.ts
  - packages/dominio/src/crm/negocios.ts
  - packages/dominio/src/crm/notas.ts
  - packages/dominio/src/crm/resumo-da-tarefa.ts
  - packages/dominio/src/derive-conversacional.ts
  - packages/dominio/src/operations/canais.ts
  - packages/dominio/src/operations/contacts.ts
  - packages/dominio/src/operations/index.ts
  - packages/dominio/src/operations/registro.ts
  - packages/dominio/src/operations/structure.ts
  - packages/dominio/src/operations/tarefa-conversacional-nas-tabelas.ts
  - packages/dominio/src/operations/tarefas-conversacionais.ts
  - packages/dominio/src/operations/tasks.ts
  - packages/dominio/src/operations/vinculos-da-mesclagem.ts
findings:
  critical: 0
  warning: 9
  info: 5
  total: 14
status: issues_found
---

# Phase 14: Code Review Report

**Reviewed:** 2026-11-05
**Depth:** standard (static reading only; no test run, no database)
**Files Reviewed:** 74
**Status:** issues_found

## Summary

Os pontos de maior risco foram lidos de ponta a ponta: a `011`, `executar()`/`executarGestoMisto`, os serviços e repositórios de mesclagem, Tarefa conversacional, Conversas, Notas, Consentimentos e Sucessão, as rotas, as operações do domínio e os componentes da web.

O que está sólido: toda consulta nova leva `workspace_id` e valores `$n` (a única interpolação em SQL é de constantes). O Papel é exigido antes de qualquer leitura. O Espaço e o autor vêm sempre da sessão. A recusa viaja como valor e o SQLSTATE é a rede. A ordem Contato antes de Conversa em `mover`, `restaurar` e `mesclar` é consistente. O `AO_CONFIRMAR` de `removeMember` e o `LER_DO_CRM` sobrescrevem o que o navegador mandou. A `011` é idempotente e o nome do check `contatos_estado_ck` bate com o da `007`.

Não achei nada que justifique BLOCKER: nenhum furo de tenant, injeção ou perda de dado. Os achados abaixo são condições de corrida e de ordem de trava que a fase introduziu (ou tornou alcançáveis), um caminho que vira 500, duas falhas de UX na leitura em lote e algumas arestas de regra.

Itens que o `14-PROVAS.md` já lista como abertos (ids antigos respondendo 404, `instantiateListTemplate` sem `canais`, leituras antigas que ficaram, Conversas liberadas e não passadas ao Sucessor, colisão pela mais recente, Atividade só na mesclagem etc.) não foram repetidos. O WR-06 retoma o item aberto 2 de `FRASES_DE_CONTATOS` para mostrar que a premissa dele ("se algum plano futuro usar") já não vale.

## Warnings

### WR-01: Escritas que referenciam um Contato sem travá-lo escapam para o Contato recém-mesclado

**File:** `apps/api/src/servicos/crm/conversas.ts:424-426`, `apps/api/src/servicos/crm/negocios.ts:146-152`, `apps/api/src/servicos/crm/empresas.ts:215-222`
**Issue:** `notas`, `consentimentos`, `mover`, `restaurar` e a Tarefa travam o Contato (`obter(..., { travar: true })`) justamente para que nada escape para um Contato que acabou de ser absorvido (`notas.ts` e `consentimentos.ts` dizem isso no cabeçalho). Três portas que escrevem uma linha com FK para o Contato leem o estado sem `for update`:

- `abrirConversaNoCliente`, usado por `POST /conversas`;
- `conferirContato` de `POST /negocios` e `PATCH /negocios/:id`;
- `carregarContato` do vínculo Contato-Empresa.

Sequência: a mesclagem trava o absorvido X e ainda não confirmou. `POST /conversas` lê X como `ativo` (leitura sem trava, READ COMMITTED) e faz o `insert` em `conversas`. O `insert` toma `FOR KEY SHARE` em X pela FK e espera a mesclagem. Quando ela confirma, a mesclagem só alterou colunas que não são chave, a FK passa, e a Conversa (ou o Negócio, ou o vínculo) nasce em um Contato `mesclado`. A mesclagem já tinha movido tudo, então essa linha nunca é movida. Isso quebra a RN-CON-14 (terminal e somente leitura) sem erro algum. A janela é estreita, mas é a corrida que o travamento do resto da fase quis fechar.
**Fix:** travar o Contato nas três portas, na mesma ordem que `mover` (Contato antes de Conversa). Em `abrirConversaNoCliente`:
```ts
const contato = await contatos.obter(membro.workspaceId, entrada.contatoId, { travar: true });
```
Em `conferirContato` e `carregarContato` basta aceitar um `{ travar: true }` e passá-lo quando o `cliente` é uma transação (todas já rodam em `comTransacao`). Na Tarefa, `lerParaConversa` já trava, então ela não muda.

### WR-02: Deadlock possível entre o gesto misto (trava do Espaço primeiro) e o REST de Canal (trava do Canal primeiro)

**File:** `apps/api/src/servicos/crm/canais.ts:162-179, 223, 248, 265` (ordem Canal, depois Espaço) contra `apps/api/src/servicos/crm/conversas.ts:444-462` e `servicos/crm/tarefas-conversacionais.ts:343-354, 406-417` (ordem Espaço, depois Canal)
**Issue:** `persistencia/CONTEXT.md` fixa "a linha do Espaço primeiro" e avisa que inverter a ordem abre deadlock com o REST de Canal. O REST de Canal, porém, faz o contrário: `escrita()` trava a linha do Canal (`obter(..., { travar: true })`) e só depois chama `avancarRevisaoDoEspaco`, que dá `update` na linha do Espaço.

O gesto misto da Fase 14 segura a linha do Espaço (trava do `executar()`) e, em `gravarNoCrm`, insere em `conversas` e `mensagens`, ambas com FK para `canais`. Essas FKs pedem `FOR KEY SHARE` na linha do Canal, que conflita com o `FOR UPDATE` do REST de Canal.

Cenário: um Administrador edita, arquiva ou desconecta o Canal C ao mesmo tempo em que alguém cria uma Tarefa conversacional (ou troca o Canal) por C com Conversa nova. O REST de Canal segura C e espera o Espaço. O gesto segura o Espaço e espera C. O Postgres detecta o deadlock em cerca de 1 s e derruba uma das duas com `40P01`. Esse código não está em `SQLSTATE_TRADUZIVEIS`, então vira 500 e a conexão é destruída. Nenhum dado corrompe, mas o contrato escrito no CONTEXT não é cumprido pelo código que a própria fase deixou convivendo.
**Fix:** fazer o REST de Canal respeitar a ordem do CONTEXT. Em `canais.ts`, `escrita()` e `criar` devem travar o Espaço antes do Canal:
```ts
await cliente.query("select 1 from plataforma.workspaces where workspace_id = $1 for update", [membro.workspaceId]);
```
Isso deve ser feito antes de `repositorio.obter(..., { travar: true })`. Alternativa: traduzir `40P01` em 409 transitório em `executarGestoMisto` e em `comTransacao`.

### WR-03: `POST /tarefas-conversacionais/resumo` é leitura, mas o hook de suspensão a trata como escrita

**File:** `apps/api/src/rotas/crm/index.ts:90` com `apps/api/src/plugins/autenticacao.ts:63-70`; rota em `apps/api/src/rotas/crm/tarefas-conversacionais.ts:91`
**Issue:** `recusarSuspensoNaEscrita` libera só `GET`/`HEAD`/`OPTIONS`. O resumo é `POST` (por causa do corpo com até 200 Vínculos), embora `podeNoCrm` permita `ler` a Membro `suspenso` (item 2 da matriz) e o corpo do hook diga "o Membro suspenso lê o CRM". Um Membro suspenso recebe 403 `SUSPENSO` no resumo, e o cartão, a tabela e a ficha da Tarefa conversacional não têm como mostrar Contato, Canal, última Mensagem nem Negócio. Combinado com o WR-04, a tela fica em esqueleto para sempre.
**Fix:** dar à rota de resumo uma saída do hook. Por exemplo, `config: { somenteLeitura: true }` na rota e `if (METODOS_DE_LEITURA.has(request.method) || request.routeOptions.config.somenteLeitura) return;` no hook. Outra opção é registrar o resumo fora do escopo que tem o `preValidation`.

### WR-04: Falha do resumo deixa cartões, linhas e ficha em esqueleto para sempre

**File:** `apps/web/src/dados/crm/tarefas-conversacionais.ts:99-119, 148-159`; consumidores `cartao-conversacional.tsx:108-143`, `tarefa-completa.tsx:294, 579`
**Issue:** `useBuscaDoResumo` calcula `erro`, mas `useResumoDaTarefa` devolve apenas `porTarefa.get(taskId)`, que é `undefined` quando a busca falha. Nenhum consumidor lê `erro` (`ProvedorDoResumoDasTarefas` o põe no contexto e ninguém o usa). O cartão trata `resumo === undefined` como "ainda carregando" e mostra o esqueleto; a ficha mantém "Lendo o Contato e o Negócio desta Tarefa…" no menu e nas ações.

Uma resposta 403, 5xx ou queda de rede nunca vira mensagem nem botão de tentar de novo. Em 5xx e na rede o SWR repete e a tela continua em esqueleto. Em 4xx não repete e o esqueleto fica para sempre.
**Fix:** expor o erro por Tarefa e tratá-lo na tela. Por exemplo, `useResumoDaTarefa` devolve `{ resumo, erro }` ou um resumo marcado `indisponivel`. O cartão mostra "Não foi possível carregar o Contato" (e a ficha, a razão em `disabledReason`) em vez do esqueleto.

### WR-05: O resumo não suspende Contato nem Conversa na lixeira (RN-TAR-15) e só olha o primeiro Vínculo

**File:** `apps/api/src/repositorios/crm/tarefas-conversacionais.ts:97-105`; `packages/dominio/src/derive-conversacional.ts` (`vinculosDoCrmDaTarefa`, `primeiro(...)[0]`)
**Issue:** a leitura antiga suspendia a exibição quando o alvo estava na lixeira (RN-TAR-15): `contatoAlcancado` devolvia `undefined` para Contato `naLixeira` e `conversaDaTarefa` pulava Conversa `naLixeira`, caindo no próximo Vínculo. O SQL novo faz isso só para o Negócio (`n.estado <> 'na_lixeira'`).

- O Contato (`c`/`ef`) volta mesmo `na_lixeira`.
- A Conversa (`cv`) e o Canal dela voltam mesmo com a Conversa na lixeira. A "última Mensagem" já filtra `cx.estado = 'ativo'`, então o cartão mostra Canal sem mensagem.
- Com o Contato na lixeira o cartão exibe o nome dele normalmente, e todo gesto de escrita da Tarefa devolve `CONTATO_INATIVO`.
- `vinculosDoCrmDaTarefa` pega o primeiro Vínculo de cada tipo. A leitura antiga percorria todos até achar um válido, então um Vínculo velho que aponta para um alvo na lixeira ou inexistente esconde um Vínculo bom que vem depois.
**Fix:** no SQL, acrescentar `and ef.estado <> 'na_lixeira'` e `and cv.estado = 'ativo'` nos respectivos `left join`, ou devolver o estado para a tela suspender. Se o primeiro Vínculo é suficiente por decisão, registrar isso em `14-PROVAS.md`; hoje o texto diz o contrário.

### WR-06: Excluir de vez o sobrevivente de uma mesclagem vira 500 (FK `contatos_mesclado_em_fk` sem frase)

**File:** `apps/api/src/servicos/crm/contatos.ts:80-99, 498-533`; `apps/api/migracoes/011-crm-o-que-faltava.sql:55-57`
**Issue:** `DELETE /contatos/:id/permanente` deixa excluir um Contato que está na lixeira e não tem Negócio, Conversa nem Empresa em que seja único admin. Um sobrevivente de mesclagem pode estar nesse estado, porque a mesclagem move as Conversas e os Negócios do absorvido para ele e ele pode não ter nenhum. Os absorvidos continuam apontando para ele por `mesclado_em_id`, e a FK `contatos_mesclado_em_fk` é `NO ACTION`. O `delete` falha com `23503`. `FRASES_DE_CONTATOS` não tem esse constraint, então `traduzirErroDePg` devolve `undefined` e o erro sobe como 500 genérico.

O item aberto 2 do `14-PROVAS.md` diz que isso só vale "se algum plano futuro usar essas constraints". Já vale: a rota existe e é alcançável por qualquer Membro com `excluir_permanentemente`.
**Fix:** pré-checar em `excluirPermanentemente`, antes do `delete`: `select count(*) from plataforma.contatos where workspace_id = $1 and mesclado_em_id = $2`. Recusar com 409 `CONTATO_COM_MESCLADOS` ("Este Contato absorveu outros Contatos e não pode ser excluído de vez"). Acrescentar também em `FRASES_DE_CONTATOS`:
```ts
contatos_mesclado_em_fk: { codigo: "CONTATO_COM_MESCLADOS", error: "Outros Contatos foram mesclados neste e ele não pode ser excluído de vez." },
```

### WR-07: Criar Tarefa com `negocioId` confere o Negócio sem travá-lo

**File:** `apps/api/src/servicos/crm/tarefas-conversacionais.ts:313-318`
**Issue:** `vincularNegocio` trava o Negócio ("não vai para a lixeira entre a conferência e o Vínculo", linha 444). `criar` faz a mesma conferência (`estado === "ativo"` e `contatoId` do Contato da Tarefa) com `obter` sem trava. O gesto segura o Espaço, mas as rotas REST de Negócio (`lixeira`, `PATCH` com troca de Contato) não pegam a linha do Espaço. Entre a leitura e o `commit`, o Negócio pode ir para a lixeira ou mudar de Contato, e a Tarefa nasce com um Vínculo que a regra do próprio serviço recusaria.
**Fix:** `obter(workspaceId, entrada.negocioId, { travar: true })` na linha 314, como em `vincularNegocio`.

### WR-08: Recusas do domínio no gesto misto viram 409 `RECUSA_DO_DOMINIO` mesmo quando são 403 ou 404

**File:** `apps/api/src/servicos/crm/gesto-misto.ts:102`, com `servicos/crm/tarefas-conversacionais.ts:258-261, 365-419`
**Issue:** toda recusa de `operacao` volta como 409 com o mesmo código. Para a Tarefa conversacional isso engloba "Tarefa não encontrada.", `taskWriteRefusal` (permissão de escrita na Tarefa), "Esta Tarefa não tem Contato vinculado." e "Esta Lista é operacional". O cliente não consegue distinguir "não existe" de "não pode" de "estado inválido", e um 404 ou 403 de verdade nunca aparece. Há também um problema de ordem: `lerDoCrm` roda antes da operação e pode responder 400, 404 ou 409 sobre Contato e Canal antes de o domínio recusar a Tarefa. Por exemplo, trocar o Canal de uma Tarefa de Lista operacional recebe "Escreva a primeira Mensagem" (400) em vez de "Lista operacional".
**Fix:** deixar o serviço mapear a frase do domínio para status e código: passar uma função `recusaDoDominio?: (erro, campo) => Recusa` em `GestoMisto`, ou checar `taskWriteRefusal` e a existência da Tarefa em `lerDoCrm` antes de qualquer leitura do CRM e devolver 404 e 403 ali.

### WR-09: "Sem Responsável" no diálogo de nova Tarefa conversacional atribui a Tarefa ao criador

**File:** `apps/web/src/features/estrutura/nova-tarefa-conversacional-dialog.tsx:172`; `packages/dominio/src/operations/tarefa-conversacional-nas-tabelas.ts:107`
**Issue:** o diálogo oferece a opção "Sem Responsável" (valor `""`). Ao escolhê-la, `assignees` simplesmente não vai no corpo (`responsavelId ? { assignees: [...] } : {}`). A operação do domínio faz `input.assignees ?? [memberActor(actingMemberId)]`, então a Tarefa nasce atribuída a quem a criou, ao contrário do que a tela diz. O comportamento já existia na operação antiga, mas a fase reescreveu os dois lados e manteve a divergência.
**Fix:** mandar a escolha vazia como lista vazia (`assignees: []`) e fazer o domínio distinguir ausente de vazio. A rota já aceita `assignees` com `.max(50)`.

## Info

### IN-01: Em repetição de `removeMember`, o Sucessor pode ser um Convidado

**File:** `apps/api/src/rotas/operacoes.ts:276-280`
**Issue:** o domínio recusa Sucessor com Papel base Convidado, mas só depois do ramo `member.state === "removido"` (replay devolve `ok` sem olhar o Sucessor). O `AO_CONFIRMAR` confere apenas "Membro ativo". Num replay de remoção, um Administrador pode passar a posse dos Contatos, Empresas e Negócios remanescentes a um Convidado. É uma ação só de Administrador, mas contraria a regra que o domínio aplica no primeiro caminho.
**Fix:** repetir a checagem do domínio no `aoConfirmar`: o Papel do Sucessor em `state.roles` não pode ter `base === "convidado"`.

### IN-02: A seção Notas mostra só a primeira página e anuncia "Mostrando X de Y" sem como ver o resto

**File:** `apps/web/src/features/crm/notas-do-contato.tsx:58, 100-103`; `apps/web/src/dados/crm/notas.ts:46-48`
**Issue:** `useNotasDoContato` pede `GET /contatos/:id/notas` sem `limite` nem `deslocamento`, então vem a página padrão de 50. Com mais notas, a tela mostra "Mostrando 50 de N" e não há botão de carregar mais. As notas mais antigas ficam inalcançáveis na ficha nova. O mesmo vale para a `moverNotas` da mesclagem, que pode empilhar notas de dois Contatos.
**Fix:** paginação "Mostrar mais" (como `useContatos`) ou subir o `limite` para `LIMITES_CRM.paginaMaxima`.

### IN-03: `lidaAte` pode regredir e ir ao futuro

**File:** `apps/api/src/repositorios/crm/marcacoes.ts:54-55`; `packages/dominio/src/crm/conversas.ts` (`validarMarcacao`)
**Issue:** `lida_ate = coalesce($5, lida_ate)` grava o valor que chegar. Duas abas do mesmo Membro, ou um reenvio atrasado, podem mover o ponto de leitura para trás e reacender mensagens já lidas. Um `lidaAte` no futuro marca como lida toda mensagem que chegar até lá. O domínio só valida o formato.
**Fix:** `lida_ate = greatest(coalesce($5, lida_ate), lida_ate)` e limitar `lidaAte` a `agora + folga` em `validarMarcacao`.

### IN-04: O backfill da `011` mexe em `atualizado_em` de todas as Conversas já na lixeira

**File:** `apps/api/migracoes/011-crm-o-que-faltava.sql:120-122`
**Issue:** `conversas` tem o trigger `before update` `crm_toque_atualizado_em`. O `update ... set na_lixeira_em = atualizado_em` copia o valor antigo (correto), mas o trigger em seguida regrava `atualizado_em = now()` em toda linha afetada. A lista da Lixeira ordena por `atualizado_em desc`, então todas passam a parecer tocadas no dia da migração. A data certa fica só em `na_lixeira_em`.
**Fix:** a `011` só roda em bancos locais e é imutável depois de aplicada; se for corrigir, é antes da Fase 15. Desligar o trigger por transação (`alter table ... disable trigger conversas_atualizado_em` e reativar) ou fazer a Lixeira ordenar por `na_lixeira_em`.

### IN-05: O resumo aceita ids sem relação com Tarefas que o Membro enxerga

**File:** `apps/api/src/servicos/crm/tarefas-conversacionais.ts:529-539`; `apps/api/src/repositorios/crm/tarefas-conversacionais.ts:80-133`
**Issue:** o serviço exige `ler contato` e `ler conversa`, mas não confere que `taskId` existe nem que o Membro enxerga a Tarefa (a ficha usa `memberSeesTask`, B38a). Os ids de Contato, Conversa e Negócio do corpo vão direto ao SQL, escopados só por Espaço. Qualquer Membro com `ler` obtém nome de Contato, nome do Canal, os 140 primeiros caracteres da última Mensagem e título e Etapa do Negócio para qualquer combinação de ids, sem passar por `GET /conversas` ou `GET /mensagens`. Hoje todo Papel com `ler` já alcança esses recursos (escopo `próprios` fica para uma fase futura, D-10), então não há vazamento novo. Se esse escopo chegar, o resumo vira atalho que o contorna.
**Fix:** registrar a dependência em `permissoes.ts` ou no CONTEXT. No dia em que existir escopo por registro, o resumo precisa partir do Vínculo da Tarefa lido do estado hidratado (como `tarefaEContato` faz), não dos ids do corpo.

---

_Reviewed: 2026-11-05_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
