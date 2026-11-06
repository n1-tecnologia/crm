---
phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
reviewed: 2026-11-06T00:00:00Z
depth: deep
files_reviewed: 22
files_reviewed_list:
  - apps/api/src/migracao-crm/colecoes.ts
  - apps/api/src/migracao-crm/formatos-antigos.ts
  - apps/api/src/migracao-crm/guardar.ts
  - apps/api/src/migracao-crm/funil.ts
  - apps/api/src/migracao-crm/pasta-meus-negocios.ts
  - apps/api/src/migracao-crm/relatorio.ts
  - apps/api/src/migracao-crm/nao-migrados.ts
  - apps/api/src/migracao-crm/crm-novo.ts
  - apps/api/src/migracao-crm/mapeador.ts
  - apps/api/src/migracao-crm/inserir.ts
  - apps/api/src/migracao-crm/migrar-crm-antigo.ts
  - apps/api/src/migracao-crm/migrar.cli.ts
  - apps/api/src/migracao-crm/CONTEXT.md
  - apps/api/migracoes/011-crm-o-que-faltava.sql
  - apps/api/migracoes/012-atividade-do-crm.sql
  - apps/api/src/persistencia/unidade-de-trabalho.ts
  - apps/api/src/persistencia/repositorio.ts
  - apps/api/src/rotas/estado.ts
  - apps/api/src/bootstrap/crm-demo.ts
  - apps/api/src/bootstrap/crm-demo.cli.ts
  - packages/dominio/src/operations/ferramentas/conversa-de-grupo.ts
  - apps/api/src/automacoes/clientes-da-lista.ts
findings:
  critical: 0
  warning: 7
  info: 8
  total: 15
status: issues_found
---

# Fase 15 — Revisão de código pré-corte (independente, só leitura)

**Data:** 2026-11-06 · **Profundidade:** deep · **Ramo:** `fase-13-gravacao-em-menos-idas-e-voltas` (HEAD `079ad9c`)

**Escopo:** o script `migrar:crm-antigo` inteiro (`apps/api/src/migracao-crm/`, código, testes e `CONTEXT.md`), as
migrações 007/008/011/012 contra as quais ele grava, `executar()`/`hidratar()`/`GET /estado`, o carregador
`bootstrap:crm-demo`, `conversa-de-grupo.ts`, `clientes-da-lista.ts` e o roteiro `15-CORTE.md` comparado com as
flags reais da CLI. Também li, para confirmar ou descartar achados: `testes/banco-crm.ts`, `persistencia/conexao.ts`,
`persistencia/sql-literal.ts`, `operations/activity.ts`, `derive-visibilidade.ts`, `flows.ts`/`grupos.ts`/`automacoes.ts`
das Ferramentas, `types/conversa-de-grupo.ts`, `node_modules/pg-connection-string/index.js` (2.14.0) e o
`unidade-de-trabalho.ts` publicado em `49f1b54`. Nada foi executado: nem banco, nem Docker, nem testes.

Cada achado diz CONFIRMADO (provado pela leitura do código) ou PLAUSÍVEL (o mecanismo existe, mas depende de dado ou
de uso que não pude ver).

---

## BLOCKER

Nenhum. Não achei caminho pelo qual uma linha saia de `plataforma.registros` sem uma cópia idêntica conferida em
`registros_crm_antigo` na mesma transação, nem algo que corrompa o `ws_n1` ou os 17 Espaços de teste com o dado que o
ensaio descreve (o `ws_n1` só tem o Funil "Padrão"). As verificações estão na seção "Conferido e sem achado".

---

## HIGH

### H-01 — O mapeador só aceita Canal e Contato que ele mesmo insere: a Conversa cujo Canal (ou Contato) já existe no CRM novo é apagada de `registros` e não migra — CONFIRMADO (código); a ocorrência é PLAUSÍVEL

**Arquivos:** `apps/api/src/migracao-crm/mapeador.ts:1016-1023` (o filtro), `:919-976` (só os Canais inseridos agora
entram em `canaisMigrados`), `:929-932` e `:494-501` (`id-ja-existe` tira o Canal ou o Contato das listas de destino);
`apps/api/src/migracao-crm/crm-novo.ts:24-69` (nunca lê os Canais e Contatos que as Conversas citam).

**O que está errado.** `mapearConversas` exige `canaisMigrados.has(canalId)` e `contatosMigrados.has(contatoId)`. Os
dois conjuntos só têm o que esta execução insere. Uma Conversa antiga que aponta para um Canal que já está em
`plataforma.canais` não entra nesse conjunto, e isso inclui o caso em que o mesmo id está no CRM antigo e no novo
(cai em `id-ja-existe`). O mesmo vale para o Contato. Essa Conversa vai para "Não migrados" como
`conversa-sem-canal-migrado` ou `conversa-sem-contato`, e mesmo assim é apagada de `registros` no `aoConfirmar`. Com o
Negócio acontece igual quando o Contato dele já existe (`negocio-sem-dono`).

**Cenário.** Desde a Fase 8 o Canal só nasce em `plataforma.canais`, e o modelo antigo o enxergava por projeção, com
o mesmo id (`canais-projetados` em `49f1b54`). Então toda Conversa 1:1 criada pela Caixa antiga em produção desde
então tem `channelId` de um Canal que já está na tabela nova e não está na coleção `channels`. O dono testa em
produção desde 2026-11-05 (a fase 14 subiu inteira). Se ele abriu alguma Conversa no `ws_n1` depois da cópia que o
ensaio usou, o `--migrar` copia a Conversa, apaga, e não a leva a `plataforma.conversas`. A Caixa nova fica sem ela, e
o único caminho de volta é tirá-la de `registros_crm_antigo` à mão. Rodar o `--seco` antes mostra a categoria, mas o
script não tem como migrar esse caso: a única saída é não cortar.

**Correção sugerida.** Em `crm-novo.ts`, ler os ids de `plataforma.canais` (com o tipo) e de `plataforma.contatos` que
as Conversas e os Negócios antigos citam. Em `planejarMigracao`, aceitar esses ids como destino válido: o Canal
existente com o tipo dele para `mapearMensagens`, e o Contato existente para a FK. Só depois disso relatar
`id-ja-existe`, e sem tirar o id dos conjuntos de destino. Antes do corte, rode o `--seco` do `ws_n1` imediatamente
antes do passo 6c e confira que `conversa-sem-canal-migrado` e `conversa-sem-contato` estão vazias.

### H-02 — "Só Conversa de Grupo fica em `registros`" não é o critério do modelo que fica: depois do corte, o `--verificar` falha e o remédio do roteiro apaga Conversas 1:1 vivas — CONFIRMADO (código); a ocorrência na janela do corte é PLAUSÍVEL

**Arquivos:** `apps/api/src/migracao-crm/colecoes.ts:35-42` (`ehConversaDeGrupo` = tem `groupIdentifier`),
`migrar-crm-antigo.ts:373-376` (a regra (b) do `--verificar`), `guardar.ts:35-39` (o apagar);
`packages/dominio/src/operations/ferramentas/conversa-de-grupo.ts:342-371` (`receiveMessage`) e `:514-543`
(`startConversation`), que criam Conversa SEM `groupIdentifier`, chamadas por `flows.ts:926`, `grupos.ts:257` e
`automacoes.ts:98`. `types/conversa-de-grupo.ts:5-6` diz com todas as letras que "o envio de Flow e as composições das
Automações seguem em `state.conversations`", e `flows.ts:858` recusa Flow em Conversa de Grupo. Roteiro:
`15-CORTE.md:212` e `:171`.

**O que está errado.** O modelo antigo que continua vivo (F14-D-05) inclui Conversas 1:1 em `registros`: o convite
para o Grupo, a Resposta de Flow e a Ação "enviar ao Contato" da Automação. O script trata toda Conversa sem
`groupIdentifier` como CRM antigo a apagar, e o `--verificar` (b) acusa como falha qualquer Conversa dessas que exista.

**Cenário.** Depois do passo 8 a API nova está no ar. Uma Automação de Grupo dispara `mensagem.enviarAoContato`, ou
alguém envia um convite de Grupo, e nasce `cnv_…` 1:1 em `registros`. O `--verificar` do passo 10 sai com 1. O
roteiro manda rodar `--guardar` ou `--migrar` de novo nesse Espaço ("repetir é seguro"). O script então copia e apaga
a Conversa viva. No `--migrar`, o mapeador ainda a manda para `conversa-sem-canal-migrado` (H-01), porque o Canal dela
está em `plataforma.canais`. O resultado é que a Conversa e as Mensagens dela somem do Grupo, do Flow e da Automação.
O mesmo acontece em qualquer execução futura do script, que fica no repositório até o plano de limpeza.

**Correção sugerida.** Trocar o critério de "fica em `registros`": por exemplo, a Conversa fica se tem
`groupIdentifier`, `envioDeFlow`/`respostaDeFlow`, ou se o Canal dela já existe só em `plataforma.canais`. Ou então
guardar no primeiro corte o conjunto de ids apagados e, nas execuções seguintes, só mexer em ids que estavam no CRM
antigo antes do corte. Ajustar o `--verificar` (b) à mesma regra. Em `15-CORTE.md` (passo 10 e a tabela "Se um passo
falhar"), escrever que um `--verificar` falho depois do passo 8 tem de ser investigado linha a linha, e nunca resolvido
com `--guardar` às cegas.

---

## MEDIUM

### M-01 — A trava de "só banco local" do `bootstrap:crm-demo` (e dos testes de banco) é contornável por `?host=` na URL — CONFIRMADO

**Arquivos:** `apps/api/src/bootstrap/crm-demo.ts:41-49`; a mesma regra em `apps/api/src/testes/banco-crm.ts:25-33`,
que protege testes que fazem `delete from plataforma.registros` e rodam `migrar()`; `node_modules/pg-connection-string/index.js`
(as linhas `for (const entry of result.searchParams…) config[...]` e `if (!config.host) config.host = hostname`).

**O que está errado.** `hostEhLocal` olha `new URL(url).hostname`. O `pg` monta a conexão com `pg-connection-string`,
que copia cada parâmetro da query para a configuração. Assim `?host=` vence o host da URL.

**Cenário.**
`DATABASE_URL='postgres://u:p@localhost:5432/postgres?host=aws-0-us-west-2.pooler.supabase.com&port=6543'`
faz `hostname === "localhost"` e a recusa passa. O `pg` conecta no pooler de produção. A linha `Banco:` também mostra
`localhost:5432`, e `construirSsl` desliga o TLS porque `HOST_LOCAL` (`conexao.ts:24`, regex sem âncora) acha
"localhost" na string. O demo então insere Contatos e Conversas de mentira em produção, e os testes apagam linhas de
`registros`. Os casos com IPv6 `[::1]`, maiúsculas, ponto final, `localhost.evil.com` e o truque de userinfo são
recusados (o erro é sempre para o lado seguro).

**Correção sugerida.** Validar o que o `pg` vai usar de fato: `parse()` de `pg-connection-string` e conferir
`config.host` (e recusar qualquer `host`/`hostaddr` na query), ou simplesmente recusar URL que tenha query. Ancorar
`HOST_LOCAL` em `conexao.ts` ao host já analisado. Nas duas CLIs, imprimir o host que vem do `parse()`.

### M-02 — Voltar a API depois do passo 8 deixa a versão antiga rodando sobre o dado já cortado — CONFIRMADO (roteiro)

**Arquivo:** `15-CORTE.md:187` e `:227`.

**O que está errado.** Se o `publicar.sh` falhar, o roteiro manda "não suba a web; `FORCAR=1` com o SHA anterior".
Nesse ponto os passos 6b e 6c já tiraram o CRM antigo de `registros`. A API `49f1b54` volta, lê o CRM antigo de
`registros` e encontra vazio. O que a tela antiga gravar a partir daí cai em `registros` e vai ser "guardado" (apagado)
na próxima execução do script.

**Correção sugerida.** No passo 8, escrever que a volta de código depois do passo 6 exige restaurar o backup do passo 2
(ou aceitar explicitamente o CRM vazio na versão antiga). Melhor ainda, ensaiar o `publicar.sh` em seco antes do passo
6, para que a falha mais provável apareça antes de qualquer escrita.

### M-03 — A aprovação do relatório (passos 4 e 5) pode estar velha quando o `--migrar` roda (6c), e o `--migrar` não se desfaz — PLAUSÍVEL

**Arquivos:** `15-CORTE.md:86-115` e `:141-150`; `migrar-crm-antigo.ts:188-199`.

**O que está errado.** O `--seco` aprovado é o do passo 4. Entre ele e o 6c, o app antigo continua no ar (o dono
testa em produção e o agendador do `ws_n1` está ligado). O `--migrar` replaneja na hora e só mostra o "Não migrados"
real depois de confirmar. Nada amarra a execução à contagem que foi aprovada.

**Correção sugerida.** Rodar o `--seco` do `ws_n1` de novo imediatamente antes do 6c e comparar com o do passo 4. Ou
acrescentar ao `--migrar` uma trava como `--esperar-linhas=<N>`, que recusa a execução se a soma das nove coleções
mudou.

### M-04 — Uma Mensagem ou um Identificador sem `id` (ou com id repetido no mesmo Contato) derruba o Espaço inteiro no `insert` — CONFIRMADO (código); a ocorrência é PLAUSÍVEL

**Arquivos:** `mapeador.ts:1125` e `:1165-1166` (`id: antiga.id`, sem conferir), `:573-574` (de-para
`<contato>/<ident.id>`), `:760` (o mesmo para a Empresa); `inserir.ts:340` (insert em `crm_de_para` sem
`on conflict`).

**O que está errado.** O `CONTEXT.md` promete que "o banco não é surpreendido". Mas uma Mensagem aninhada sem `id`
chega como NULL em `mensagens.id`, que é NOT NULL. Dois Identificadores sem `id`, ou com o mesmo `id` no mesmo Contato,
dão a mesma chave em `crm_de_para`, que é PK. Os dois casos derrubam o `--migrar` do Espaço com um erro genérico. Nada
se perde, porque tudo volta, mas o corte daquele Espaço fica travado.

**Correção sugerida.** Mandar a Mensagem sem id para o relatório com uma categoria própria. Para o Identificador sem
id ou repetido, usar no de-para uma chave que não colide (o id novo, ou o índice) e relatar o caso.

### M-05 — O roteiro promete "duas execuções simultâneas esperam uma à outra", mas a segunda morre em 10 s — CONFIRMADO

**Arquivos:** `15-CORTE.md:225`; `unidade-de-trabalho.ts:262-265` e `:439-459`; `migrar-crm-antigo.ts:237`.

**O que está errado.** O `lock_timeout` é Q/3 (10 s). A segunda execução recebe conflito, `escrever` lança
`Error("Outra alteração…")` e a CLI sai com 1. Isso é seguro, nada é escrito, mas o texto do roteiro induz a esperar,
e um `--verificar` falho logo depois pode ser lido como problema de dado.

**Correção sugerida.** Corrigir o texto: "a segunda sai com 1 e 'Outra alteração entrou antes desta'; rode de novo
depois que a primeira terminar".

---

## LOW / INFO

### L-01 — O passo 7 acusa "DIFERENTE" sempre que a Pasta "Meus negócios" sai — CONFIRMADO (latente)
`15-CORTE.md:165-171`. Do lado do `--verificar`, o filtro `^  [A-Za-z]+ [0-9]+$` também pega `folders`, `lists` e
`views` de `registros_crm_antigo`. Do lado do `--seco`, só as nove coleções entram. Com a cópia de 11-05 nenhum Espaço
tem Pasta removível, então isso não aparece hoje. Mas, se alguma Pasta esvaziou desde então, o roteiro manda parar sem
motivo. A correção é filtrar as nove coleções nos dois lados.

### L-02 — A banner `Banco:` da CLI do corte mostra o host da URL, não o que o `pg` usa — CONFIRMADO
`migrar.cli.ts:93-99`. Com `?host=` (M-01) a linha mostra um host e o script grava em outro. Imprimir `parse().host`.

### L-03 — Depois do corte, o contador global de `nextId` pode recuar abaixo de ids que foram preservados nas tabelas novas — PLAUSÍVEL
`unidade-de-trabalho.ts:532` e `operations/activity.ts:9-15` e `:64-84`. `syncIdSequence` usa o maior id que está no
estado, e Contatos, Conversas e Mensagens antigos deixam de estar nele. Se esses forem os maiores ids do Espaço (por
exemplo, Mensagens recebidas, que não geram Atividade), um `msg_`/`cnv_` novo em `registros` pode repetir o id de uma
linha migrada (`plataforma.mensagens`/`conversas`) ou de uma chave de `registros_crm_antigo`. A repetição em
`registros_crm_antigo` faz a cópia de uma execução seguinte ser pulada pelo `on conflict do nothing`. Para o `ws_n1`
não importa, porque ele não tem CRM antigo além do Funil. Sugestão: passar a `syncIdSequence` um `minimo` lido de
`registros_crm_antigo` (o maior id guardado do Espaço).

### L-04 — Matriz e filial em ciclo, divididas entre pedaços de 500, quebram a FK da matriz — CONFIRMADO (borda)
`mapeador.ts:764-772` e `inserir.ts:283-288`. O `emitir` recursivo põe A e B em ciclo um antes do outro. Num mesmo
`insert` isso passa, porque a FK é conferida no fim da instrução. Se o ciclo cair na fronteira de 500 linhas, o insert
falha e o Espaço volta inteiro. Sugestão: quebrar o ciclo (relatar `empresa-matriz-perdida` e mandar `matriz_id = null`).

### L-05 — Etapa antiga sem `id`, ou com id repetido no mesmo Funil, é engolida em silêncio no de-para — CONFIRMADO (borda)
`funil.ts:276-288`. O `on conflict do nothing` em `funnels/stages` faz a segunda Etapa ficar sem de-para, e os Negócios
dela vão para a Etapa da primeira. Recusar o Funil com o motivo "Etapa sem id ou repetida".

### L-06 — `instanteValido` do Funil devolve o texto cru — CONFIRMADO (borda)
`funil.ts:85-87`. O mapeador normaliza para ISO e o Funil não. Um formato que o `Date.parse` do V8 aceita e o
Postgres recusa derruba o Espaço no `::timestamptz`. Usar o mesmo `instante()` do mapeador.

### L-07 — `atual in MODOS` aceita chaves do protótipo — CONFIRMADO (inofensivo)
`migrar.cli.ts:71`. `toString` ou `constructor` como argumento entra como "modo", o `switch` não acha nada e a CLI sai
com 0 sem fazer nada. Trocar por `Object.hasOwn(MODOS, atual)`.

### L-08 — `CONTEXT.md` sugere `--guardar` no `ws_n1` "se o dono decidir guardar o Funil" — CONFIRMADO (doc)
`migracao-crm/CONTEXT.md:24`. No `ws_n1`, `--guardar` deixa fora do CRM novo, para sempre, tudo o que houver lá
(Contatos, Conversas), porque o script não relê `registros_crm_antigo`. O roteiro usa corretamente
`--migrar --funil=guardar`. Corrigir o texto da tabela para não induzir o erro.

---

## Conferido e sem achado

- **Perda de dado:** não achei caminho sem cópia. A cópia (`lerDoCrm`), a conferência por chave e por conteúdo
  (`c.dados = r.dados and c.ordem = r.ordem`, `guardar.ts:84-114`) e o `delete` (`aoConfirmar`) rodam na mesma
  transação, sob o `for update` da linha do Espaço. Todo escritor de `registros` passa por `executar()` (procurei
  `insert`/`delete` em `registros` em `apps/api/src`; o regime otimista espera a trava no `update` da revisão, antes de
  gravar), e o predicado do `delete` é subconjunto do conferido. O `gravar()` que roda entre a conferência e o `delete`
  só pode regravar a `ordem` de linha antiga (`reordenar`), e a cópia guarda a original. A Conversa de Grupo é copiada e
  fica: os critérios JS e SQL concordam (objeto, não array, não null). A Pasta só sai com todas as Listas sem Tarefa, e
  as chaves copiadas são exatamente as que `removerPasta` tira.
- **Transação, trava e idempotência:** há um `executar()` por Espaço, no regime `travado` (sem bypass de `regime`),
  sempre com `aoConfirmar`, o que tira o lote de saída de uma ida só. Qualquer exceção (na conferência, em `inserirPlano`
  ou na constraint adiada `empresa_exige_admin` no `commit`) cai no `rollback`. A recusa e o "nada a fazer" voltam pela
  `operacao` com `fail`, sem subir a revisão. Repetir dá "nada a fazer". Toda consulta leva `workspace_id = $1`.
- **Constraints 007/008/011:** confrontei cada `check`, NOT NULL, único e FK das tabelas que o script escreve com o
  mapeador. Fora de M-04, L-04, L-05 e L-06, cada uma tem tratamento. A ordem dos inserts respeita as FKs não adiáveis
  (sobrevivente antes do mesclado, Etapa por de-para, `em_resposta_a_id` só para Mensagem anterior). `seq` é identity e
  não é inserida.
- **SQL dinâmico:** nome de tabela e coluna só vêm de constantes, valor só por `$n`. O `jsonb_to_recordset` tem lista
  de colunas explícita, e o `literalEntreDolares` é seguro. `--espaco` é validado por regex e por existência em
  `plataforma.workspaces`. A CLI recusa nenhum modo e dois modos.
- **Dado pessoal na saída:** o relatório, o resumo e o "Não migrados" trazem só coleção, id, contagem e nomes de
  configuração. A CLI imprime só `erro.message` (as mensagens do Postgres para check, FK e unique não trazem a linha).
- **`hidratar()` e `GET /estado` com linha antiga sobrando:** a coleção desconhecida é carregada e devolvida (inclusive
  sem passar por `visibilidadePara`, que faz `...state`, comportamento igual ao de `49f1b54`). Nenhum caminho de crash
  identificado, e `planejarGravacao` preserva as chaves desconhecidas.
- **`clientes-da-lista.ts`:** leitura por `workspace_id`, em lotes de 500, sem achado.
- **Flags do roteiro:** cada comando de `15-CORTE.md` bate com `lerArgumentos` (`--espaco`, `--seco`, `--guardar`,
  `--migrar --funil=migrar|guardar`, `--verificar`) e com `migrar -- --seco`.

---

## Veredito

**Seguro com ressalvas.** Para o dado que o ensaio de 2026-11-05 descreve (o `ws_n1` só com o Funil "Padrão" e os 17
Espaços de teste por `--guardar`), o caminho de escrita é sólido. Não achei como perder uma linha sem cópia conferida,
e toda falha volta o Espaço inteiro. As ressalvas são duas. Primeiro, o mapeador não reconhece Canal e Contato que já
estão no CRM novo, e o dono testa em produção desde 11-05, então o dado de hoje pode não ser o do ensaio. Segundo, o
critério de "o que fica em `registros`" não é o do modelo que continua vivo, o que torna perigoso o remédio do passo 10.
Corrigir primeiro:

1. **H-01:** migrar a Conversa ou o Negócio cujo Canal ou Contato já existe no CRM novo. No mínimo, rodar o `--seco`
   imediatamente antes do 6c e parar se `conversa-sem-canal-migrado` ou `conversa-sem-contato` tiver item.
2. **H-02:** ajustar o critério "fica em `registros`" e o `--verificar` (b) às Conversas 1:1 de Flow, Grupo e
   Automação, e tirar do passo 10 o "rode `--guardar` de novo" às cegas.
3. **M-01:** fechar o `?host=` na trava de banco local do demo e dos testes, e mostrar na banner `Banco:` o host real.

_Revisor: Claude (gsd-code-reviewer) · Profundidade: deep · Nenhum arquivo de código foi alterado._
