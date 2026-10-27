---
phase: 09-seguran-a-dos-dados-e-base-de-produ-o
reviewed: 2026-10-27T00:00:00Z
depth: standard
files_reviewed: 48
files_reviewed_list:
  - packages/dominio/src/derive-visibilidade.ts
  - packages/dominio/src/derive.ts
  - packages/dominio/src/url-segura.ts
  - packages/dominio/src/operations/crm-antigo.ts
  - packages/dominio/src/operations/contacts.ts
  - packages/dominio/src/operations/conversations.ts
  - packages/dominio/src/operations/deals.ts
  - packages/dominio/src/operations/financeiro.ts
  - packages/dominio/src/operations/tasks.ts
  - packages/dominio/src/operations/ferramentas/automacoes.ts
  - apps/api/migracoes/009-seguranca-e-cofre.sql
  - apps/api/deploy/conceder-n1-api.sql
  - apps/api/deploy/n1-crm-backup.sh
  - apps/api/deploy/n1-crm-backup.service
  - apps/api/deploy/n1-crm-backup.timer
  - apps/api/deploy/instalar-backup.sh
  - apps/api/deploy/restaurar-backup.sh
  - apps/api/deploy/provar-backup.sh
  - apps/api/deploy/provar-nginx.sh
  - apps/api/deploy/instalar-release.sh
  - apps/api/deploy/publicar.sh
  - apps/api/deploy/preparar-vps.sh
  - apps/api/deploy/n1-crm-api.service
  - apps/api/deploy/n1-crm-limites.conf
  - apps/api/deploy/nginx-n1-crm-api.conf
  - apps/api/deploy/evolution/docker-compose.yml
  - apps/api/deploy/evolution/evolution.env.example
  - apps/api/deploy/evolution/nginx-evolution.conf
  - apps/api/deploy/evolution/preparar-vps-evolution.sh
  - apps/api/src/app.ts
  - apps/api/src/index.ts
  - apps/api/src/observabilidade/log.ts
  - apps/api/src/observabilidade/sentry.ts
  - apps/api/src/persistencia/conexao.ts
  - apps/api/src/persistencia/conceder-n1-api.ts
  - apps/api/src/persistencia/migrar.ts
  - apps/api/src/plugins/autenticacao.ts
  - apps/api/src/rotas/operacoes.ts
  - apps/api/src/rotas/estado.ts
  - apps/api/src/servicos/cofre.ts
  - apps/api/src/servicos/convidar-membro.ts
  - apps/web/src/features/observabilidade/limpar-evento.ts
  - apps/web/src/instrumentation.ts
  - apps/web/src/instrumentation-client.ts
  - apps/web/src/app/global-error.tsx
  - apps/web/src/features/estrutura/link-publico.ts
  - .github/workflows/check.yml
  - .github/workflows/deploy-api.yml
findings:
  critical: 1
  warning: 9
  info: 9
  total: 19
status: issues_found
---

# Fase 9: Relatório de revisão de código

**Revisado:** 2026-10-27
**Profundidade:** standard (com rastreio entre arquivos nos pontos de recorte de dados)
**Arquivos:** 48 (os testes `*.test.ts` ficaram fora do escopo; só leitura, nenhum arquivo-fonte alterado)

## Resumo

O núcleo do recorte (`visibilidadePara`, `recortarRegistro`, `recortarDiferenca`,
`recortarValor`) está bem construído: parte sempre do estado inteiro, falha
fechado quando o caminho do contêiner não existe, troca o segredo de link por
`""` em vez de apagar a chave, e a rota de operações recorta `diferenca` e
`value` com um único `visibilidadePara`. O cofre usa AES-256-GCM corretamente
(IV de 12 bytes aleatório por gravação, etiqueta fixada em 16 bytes na decifra,
AAD amarrando a linha ao dono), nenhuma rota o importa e nenhuma mensagem de erro
carrega chave ou segredo. A 009 é aditiva, protegida por `pg_roles` e roda no
Postgres puro.

Os problemas reais estão nas bordas: coleções que carregam conteúdo de objetos
ocultos e **não** passam pelo recorte (uma delas é bloqueante), dois caminhos em
que dado pessoal de outro Membro ainda sai, um backup que degrada para TLS sem
verificação em silêncio, e a topologia de credenciais, que entrega ao processo da
API a senha do dono do banco.

Verificado e sem defeito: a máscara `mascararSegredoDeUrl` (testada à mão contra
17 formas de URL; as formas que escapam exigem codificação percentual feita por
quem já conhece o segredo); `trustProxy` + `X-Forwarded-For` (o IP vale o que o
nginx viu); `Membro suspenso` na rota de operações e nas famílias REST de
escrita (Financeiro, anexos, CRM, hook `preValidation` encapsulado por
`app.register`, não vaza para as rotas públicas); sudoers da VPS (argumentos
exatos); `known_hosts` fixado no deploy; `permissions: contents: read` nos dois
workflows.

## Critical Issues

### CR-01: `automationExecutions` e `agentExecutions` fora de chat saem sem recorte (conteúdo de objetos ocultos e IA do Convidado)

**File:** `packages/dominio/src/derive-visibilidade.ts:158-160` e `:185`
**Issue:** `visibilidadePara` filtra `agentExecutions` só pela Sessão de Chat
(`e.chatSessionId === undefined || ...`): toda Execução sem Sessão (origens
`acaoDireta`, `automacao`, `agente`, `caixaDeEntrada`) passa para qualquer
Membro. `automationExecutions` nem é tocada: o `...state` do retorno a entrega
inteira. Os dois tipos carregam conteúdo:

- `AutomationExecution` (`types/ai.ts:499`): `objectType`, `objectId`,
  `objectName` (o título da Tarefa/Lista), `steps[].input`/`output`.
- `AgentExecution` (`types/ai.ts:256`): `input`, `output`, `steps[].input/output`,
  `anchor` (`{type, id}` da Tarefa).

Consequências, ambas em `GET /estado` e no `diferenca` de `POST /operacoes/:nome`:

1. Uma Execução ancorada em Tarefa/Lista que o Membro não alcança (contêiner
   privado, B38) entrega o título e o texto de entrada/saída dela. O recorte de
   `activity` e `approvals` por `ocultos` existe exatamente para isto, e aqui é
   contornado.
2. D-02 (Convidado sem IA do Espaço) fica furado: as coleções
   `agents/automations/documents/collections/skills` chegam vazias, mas o
   resultado do que elas fizeram chega inteiro pelas Execuções.

O teste de `derive-visibilidade.test.ts:241` afirma que as de "outra origem"
continuam visíveis, sem checar `anchor` nem `objectId`, então a suíte fica verde
sobre o buraco.

**Fix:**
```ts
const agentExecutions = state.agentExecutions.filter((e) => {
  if (e.chatSessionId !== undefined && sessoesQueSaem.has(e.chatSessionId)) return !ocultos.add(e.id);
  if (e.anchor !== undefined && ocultos.has(e.anchor.id)) return !ocultos.add(e.id);
  if (convidado) return !ocultos.add(e.id);
  return true;
});
const automationExecutions = state.automationExecutions.filter((e) => {
  const some = (e.objectId !== undefined && ocultos.has(e.objectId)) || convidado;
  return !(some && ocultos.add(e.id));
});
// ...e acrescentar `automationExecutions` ao objeto devolvido.
```
Calcule `convidado` antes deste bloco (hoje é calculado depois) e feche também
`skillGrants`/`collectionGrants` pelo mesmo critério do Convidado.

## Warnings

### WR-01: E-mail de convite cancelado (Membro `removido`) continua saindo para todos

**File:** `packages/dominio/src/derive-visibilidade.ts:70`
**Issue:** `recortarMembro` só troca `displayName` e remove `invitedIdentity`
quando `membro.state === "pendente"`. `removeMember` (`operations/members.ts:217`)
aceita um Membro `pendente` sem recusa, e o convite grava o e-mail em
`displayName` e em `invitedIdentity` (`members.ts:518-520`). Depois de cancelar o
convite, o Membro fica `removido` com o e-mail nos dois campos, e a regra
`state === "pendente"` já não o cobre: qualquer Membro lê o e-mail (e a tela
mostra `"<e-mail> (removido)"` em `actorLabel`). É dado pessoal de terceiro que
nunca entrou no Espaço.
**Fix:** mascarar por presença de `invitedIdentity`, não por estado:
```ts
if (membro.invitedIdentity !== undefined && !administraOEspaco(state, memberId)) {
  const { invitedIdentity: _email, ...semEmail } = saida;
  saida = { ...semEmail, displayName: membro.state === "removido" ? "Convite cancelado" : NOME_DO_CONVITE_PENDENTE };
}
```
Cuidado com o Membro de serviço do pipeline (ativo, mantém `invitedIdentity` por
desenho): o e-mail dele também sairia hoje; decida se é público.

### WR-02: Membro suspenso Administrador/Proprietário mantém privilégios de leitura de admin

**File:** `packages/dominio/src/derive-visibilidade.ts:70, 209-212` (via `administraOEspaco`, `operations/ia/permissoes-ia.ts:24`)
**Issue:** `administraOEspaco` lê só o Papel e ignora `member.state`. Um
Administrador/Proprietário `suspenso` passa na autenticação para consultar
(`plugins/autenticacao.ts:117`) e então: (a) vê o e-mail dos convites
pendentes; (b) vê os Arquivos órfãos de todos (`arquivoOrfaoVisivel`) e baixa
cada um por `GET /anexos/:fileId/url`. Já os segredos de link ficam em branco
para ele, porque `containerAdminRefusal` exige `ativo`. As duas regras divergem
para o mesmo Membro.
**Fix:** em `recortarMembro` e `arquivoOrfaoVisivel`, exigir
`state.members.find(...).state === "ativo"` além do Papel (uma função
`administraOEspacoAtivo`), a mesma leitura de `containerAdminRefusal`.

### WR-03: Visão de contêiner de uma Lista oculta não é recortada

**File:** `packages/dominio/src/derive-visibilidade.ts:133`
**Issue:** só a Visão pessoal (`ownerKind === "member"`) de outro Membro sai.
Uma Visão `ownerKind: "container"` cujo `listId` está em `ocultos` chega inteira
(`name`, `filters.text`, `assigneeMemberId`...), expondo a existência e o
conteúdo do filtro de uma Lista privada. O `forms` na linha 135 já usa
`ocultos.has(f.listId)`; as Visões não.
**Fix:**
```ts
const views = state.views.filter((v) =>
  (v.ownerKind === "member" && v.ownerId !== memberId) || ocultos.has(v.listId) ? !ocultos.add(v.id) : true);
```

### WR-04: O processo da API carrega a senha do dono do banco (D-07 só vale no SQL)

**File:** `apps/api/deploy/instalar-release.sh:66`, `apps/api/src/persistencia/conexao.ts:13-26, 186-193`
**Issue:** o `api.env` aponta `DATABASE_URL` para `n1_api` e
`DATABASE_URL_MIGRACAO` para o dono. `ln -s "$API_ENV" .../apps/api/.env` +
`carregarEnv()` (que copia **todas** as chaves para `process.env`) põem a URL do
dono no ambiente do processo que atende a internet. O `n1_api` limita o que uma
injeção de SQL alcança, mas qualquer execução de código, estouro de dependência
ou vazamento de `process.env` lê a credencial de DDL, `truncate` e `drop`, que é
o que D-07 queria afastar. O serviço de backup carrega o mesmo `api.env`
inteiro (`n1-crm-backup.service:24`), incluindo `COFRE_CHAVE`, para `age` e
`rclone`.
**Fix:** guardar `DATABASE_URL_MIGRACAO` em arquivo separado (`migracao.env`,
modo 600, lido só por `instalar-release.sh` e pelo backup), fora do `.env` que o
serviço carrega; no backup, usar um `EnvironmentFile` que traga só as variáveis
`DATABASE_URL_MIGRACAO`/`DATABASE_CA_PATH`. Idealmente o backup usa um terceiro
papel `n1_backup` com `select` apenas.

### WR-05: Backup cai em TLS sem verificação quando falta `DATABASE_CA_PATH`

**File:** `apps/api/deploy/n1-crm-backup.sh:71-75` (e a documentação na linha 29)
**Issue:** a verificação do servidor é opcional. O app trata a ausência de CA como
erro (`construirSsl` lança), e aceita `DATABASE_CA_CERT` (PEM no ambiente) **ou**
`DATABASE_CA_PATH`. Um `api.env` que use `DATABASE_CA_CERT` faz o backup rodar
com `sslmode=prefer` padrão do libpq: sem verificação de cadeia, e um atacante no
caminho pode forçar texto claro ou apresentar certificado próprio, lendo a senha
do dono e o dump inteiro (dado pessoal). Falha aberta num script que é a camada
de proteção dos dados.
**Fix:**
```bash
if [ -n "${DATABASE_CA_PATH:-}" ]; then
  [ -r "$DATABASE_CA_PATH" ] || falhar "DATABASE_CA_PATH não é legível"
elif [ -n "${DATABASE_CA_CERT:-}" ]; then
  DATABASE_CA_PATH="$(mktemp)"; printf '%s\n' "$DATABASE_CA_CERT" > "$DATABASE_CA_PATH"; trap 'rm -f "$DATABASE_CA_PATH"' EXIT
else
  case "$PGHOST" in localhost|127.0.0.1) ;; *) falhar "sem CA para verificar o Postgres remoto" ;; esac
fi
export PGSSLMODE=verify-full PGSSLROOTCERT="$DATABASE_CA_PATH"
```

### WR-06: Balde por IP compartilhado pela Vercel permite negar serviço aos links públicos

**File:** `apps/api/deploy/n1-crm-limites.conf:35-37` e `apps/api/src/servicos/limite-de-taxa.ts` (comentário 7-13)
**Issue:** o próprio arquivo explica que o `GET` de `/f/<segredo>` e `/p/<segredo>`
chega ao nginx de um IP só (o servidor da Vercel, duas chamadas por visita). O
teto de 120 r/min + burst 60 e o contador em memória da API valem para **todos**
os visitantes juntos. Quem fizer ~3 requisições por segundo a
`https://<web>/f/qualquer-coisa` (cada uma gera chamadas servidor-a-servidor)
esgota o balde e todo Formulário/Tarefa pública passa a receber 429. O limite
que devia barrar a enumeração vira o vetor de DoS, e o texto registra como
"decisão do dono" sem mitigação.
**Fix:** a página da web repassa o IP do visitante em cabeçalho próprio
assinado (HMAC com segredo compartilhado) e o nginx/API chaveiam por ele; ou
protege `/f/` e `/p/` na borda da Vercel (Firewall/WAF com limite por IP real);
ou cacheia o 404 do segredo inexistente na web.

### WR-07: A prova de restauração aceita restauração parcial

**File:** `apps/api/deploy/restaurar-backup.sh:84-97`
**Issue:** erro do `pg_restore` vira só um aviso (linha 86) e o veredito
"RESTAURAÇÃO OK" depende de `count(*)` em **uma** tabela
(`plataforma.registros`). Um dump em que `credenciais`, `contatos`,
`conversas`, `mensagens` (007/008) falharam ao restaurar passa na prova. Era a
sonda SEG-09; hoje ela atesta menos do que o nome promete.
**Fix:** tratar `estados[1] != 0` como falha, ou conferir também contagens das
demais tabelas gravadas no `.contagem`:
```bash
# no backup:  for t in registros credenciais contatos conversas mensagens; do ... registros_$t=
# na restauração: comparar cada tabela e falhar se pg_restore saiu com erro
```

### WR-08: `GET /diagnostico/erro-de-prova` sem trava de ambiente

**File:** `apps/api/src/app.ts:128, 235-239`
**Issue:** a rota que lança de propósito liga com `ERRO_DE_PROVA_ATIVO=true` e
nada mais; a doc diz "nunca em produção", mas não há verificação. Ligada, qualquer
Membro autenticado (inclusive suspenso e Convidado, por ser `GET`) gera um evento
no Sentry por chamada, esgotando a cota e disparando o alerta. Uma variável
esquecida no `api.env` de produção depois da prova (09-19) deixa a rota no ar.
**Fix:** recusar em produção e exigir administrador:
```ts
const emProducao = (process.env.SENTRY_AMBIENTE ?? "").trim() === "producao";
if (erroDeProvaAtivo && !emProducao) { ... }
// e dentro do handler: if (!administraOEspaco(...)) return reply.code(403)...
```
Ou apague a rota no mesmo commit que fecha 09-19 (o comentário promete 09-22).

### WR-09: `guardarCredencial` aceita um `Pool` e perde a atomicidade

**File:** `apps/api/src/servicos/cofre.ts:123-151`
**Issue:** o parâmetro é `Pick<PoolClient, "query">`, que o `Pool` também
satisfaz. Com um `Pool`, o `update ... set revogado_em` e o `insert` correm em
conexões e transações separadas: uma falha entre eles (queda, chave inválida em
`cifrar` não, mas timeout sim) deixa o dono **sem** credencial ativa. O contrato
"a transação é de quem chama" só está no comentário.
**Fix:** tipar como `PoolClient` (que não é um `Pool`) ou fazer o próprio
serviço abrir `begin`/`commit` quando receber um `Pool`; ou fundir as duas
instruções num único CTE:
```sql
with revoga as (update plataforma.credenciais set revogado_em = now() where ... and revogado_em is null)
insert into plataforma.credenciais (...) values (...) returning id
```

## Info

### IN-01: Chave anterior com a mesma versão da atual não é rejeitada

**File:** `apps/api/src/servicos/cofre.ts:74-86, 101-105`
**Issue:** com `COFRE_CHAVE_ANTERIOR_VERSAO == COFRE_CHAVE_VERSAO`, `chaveDaVersao`
devolve sempre a atual e as linhas antigas falham em runtime com erro de
autenticação, sem apontar a configuração. **Fix:** lançar em
`lerChavesDoCofre` quando as versões forem iguais ou as chaves idênticas.
Também aceite só base64 estrito (`Buffer.from(..., "base64")` descarta caracteres
inválidos em silêncio) e recuse chave de bytes todos iguais.

### IN-02: Sentry da API não limpa `extra`, `tags` e `contexts`; mensagens de erro do `pg` passam

**File:** `apps/api/src/observabilidade/sentry.ts:75-100`
**Issue:** `limparEvento` trata `user`, `request`, `breadcrumbs`, `exception`,
mas não `tags`/`extra`/`contexts`, que o espelho da web mascara. Além disso, só
URL de link público é mascarada em `exception.values[].value`: uma mensagem do
`pg` com `Key (email)=(fulano@x.com)` sai como veio. **Fix:** copiar o
`mascararProfundo` da web e, se possível, reduzir `value` de erros de banco ao
`code`/`constraint`.

### IN-02b: `redact` do pino cobre pouco

**File:** `apps/api/src/observabilidade/log.ts:21-26`
**Issue:** `segredo`, `secret`, `token`, `senha` não cobrem `password`,
`accessToken`, `access_token`, `apiKey`, `authorization` fora de `req.headers`.
O serializador de `req` já corta cabeçalhos, mas `request.log.warn({problemas})`
e objetos livres seguem sem rede. **Fix:** acrescentar esses nomes e
`*.authorization`.

### IN-03: Chave de balde por endereço IPv6 completo

**File:** `apps/api/deploy/n1-crm-limites.conf:32-37`
**Issue:** `$binary_remote_addr` chaveia cada /128 separadamente; quem tem um /64
(o padrão residencial) contorna o limite de POST com endereços novos. **Fix:**
mapear IPv6 para o prefixo /64 antes da zona
(`map $remote_addr $n1_ip_chave { ~^(?<p>[0-9a-f:]+:[0-9a-f]+:[0-9a-f]+:[0-9a-f]+):.* $p; default $binary_remote_addr; }`).

### IN-04: `PUT/PATCH/DELETE` em `/v1/public/` não entram em nenhuma zona

**File:** `apps/api/deploy/n1-crm-limites.conf:24-33`
**Issue:** os mapas devolvem chave vazia para qualquer método fora de POST/GET/HEAD
(o `OPTIONS` é intencional). Métodos inventados chegam sem limite ao Node (404
barato, mas sem teto). **Fix:** acrescentar `PUT PATCH DELETE` à zona de envio.

### IN-05: Sessão de Chat compartilhada mantém `folderId` no `diferenca`

**File:** `packages/dominio/src/derive-visibilidade.ts:148-152` vs `:251-259`
**Issue:** `GET /estado` tira a pasta de chat da Sessão que não é do Membro, mas
`recortarDiferenca` repassa `chatSessions` sem passar por `recortarRegistro`
(que não tem caso para elas). O `folderId` de outro Membro volta pelo diff.
**Fix:** mover a regra para `recortarRegistro("chatSessions", ...)` e usá-la nos
dois lugares.

### IN-06: `recortarValor` desiste na quarta camada

**File:** `packages/dominio/src/derive-visibilidade.ts:262, 280`
**Issue:** abaixo de quatro níveis o valor volta como veio, e uma entidade
removida pela operação (já fora do estado) não é reconhecida pelo id, então o
segredo de link dela não é trocado. Hoje nenhuma operação devolve isso, mas a
barreira depende da forma do retorno. **Fix:** teste de contrato que percorra as
operações do registro e falhe se algum `value` contiver `secret` não vazio para
um Membro sem administração.

### IN-07: Detalhes de implantação

**File:** `apps/api/deploy/instalar-release.sh:44`, `apps/api/deploy/evolution/preparar-vps-evolution.sh:81-87`, `.github/workflows/*.yml`
**Issue:** (a) o teste do Pitfall 9 usa `grep '^DATABASE_URL=postgres'`, que não
casa `DATABASE_URL="postgres..."` (aspas permitidas em `EnvironmentFile`);
(b) `ufw allow` só libera a primeira `Port` de `sshd -T`, e uma segunda porta
configurada tranca o dono; (c) as Actions usam tag móvel (`@v4`) em vez de SHA;
(d) o manager e a chave global da Evolution ficam expostos pelo nginx sem limite
de taxa; (e) 009 e `conceder-n1-api.sql` são o mesmo SQL copiado (o teste
`banco-n1-api.test.ts` cobre a deriva, mas a duplicação continua).
**Fix:** ajustar o grep para aceitar aspas; liberar todas as portas do `sshd -T`;
fixar as Actions por SHA; pôr `limit_req` no site da Evolution.

### IN-08: Risco de processo para as próximas migrações (event trigger `ensure_rls`)

**File:** `apps/api/migracoes/009-seguranca-e-cofre.sql:88-105`
**Issue:** o CI roda em Postgres puro, sem o event trigger do Supabase. Uma
migração `010` que crie tabela sem o bloco "desligar RLS" passa no CI, e em
produção a tabela nasce com RLS ligada, sem policy, e `n1_api` lê zero linhas
sem erro. A 009 documenta a regra, mas nada a faz valer. **Fix:** um teste que
varra `migracoes/*.sql` posteriores à 009 e falhe se houver `create table` sem
`disable row level security`, ou uma checagem no `migrar()` que, ao final,
falhe se existir tabela de `plataforma` com `relrowsecurity`.

---

_Revisado: 2026-10-27_
_Revisor: Claude (gsd-code-reviewer)_
_Profundidade: standard_
