# Provas da Fase 9 — o que foi conferido de fora do código

Data: 2026-10-28. Código usado: `feat/webhook-meta-instagram@a5df2df` até a seção de homologação abaixo;
a seção "Produção (09-20)" documenta o PR #2 (`tria-company/crm-n1`), o merge em `main` e o deploy
que levaram o commit `439f124` (fix de teste incluído) para o ar.
Nenhuma senha, chave, DSN ou URL com senha aparece neste arquivo.

## Como a homologação foi montada (diferente do 09-17)

O 09-17 foi pulado em 2026-10-23. Em 2026-10-28 o dono criou o projeto Supabase de homologação por conta própria e passou ao agente o acesso ao banco e à API de gerenciamento do projeto. Com isso, **a parte de banco e de Auth da homologação existe e foi conferida**. A parte de VPS, GitHub e Vercel **continua sem existir**.

| Item do 09-17 | Estado |
|---|---|
| Projeto Supabase de homologação | Feito pelo dono: `zz_hml_crm`, ref `ljmhnkxoyovvduwturgf`, região `us-east-1` (o plano dizia `us-west-2`) |
| `n1_api` no banco | Feito (abaixo) |
| `009` e `banco:conceder` | Feito (abaixo) |
| Cadastro aberto desligado | Feito (abaixo) |
| Usuários de teste | Feito (abaixo) |
| Bucket de anexos privado | Feito (abaixo) |
| Serviço `n1-crm-api-hml` na VPS, nginx, `api.env` | **Não feito** |
| Segredos do GitHub, branch `homologacao`, job `homologacao` | **Não feito** |
| Variáveis da Vercel e URL de Preview | **Não feito** |

A API foi subida **no Mac do dono**, em `127.0.0.1:3021`, ligada ao banco e ao Auth da homologação com o papel `n1_api`. Isso prova o app contra o Supabase real, mas **não** prova a VPS, o nginx nem a Vercel.

## Homologação no ar (09-17)

Parcial. Banco e Auth da homologação respondem; a API roda localmente contra eles. O serviço na VPS não existe.

## Banco fechado em homologação

Aplicado como dono do banco (`postgres`), por `npm run migrar` com TLS verificado pela CA oficial do Supabase:

- `migrar --seco`: 9 pendentes, nada aplicado. `migrar`: as nove aplicadas (`001` a `009`). Segunda rodada: "Nada a aplicar".
- `banco:conceder`: "n1_api: concessões aplicadas".
- Papel `n1_api` criado: `n1_api | f | f | f` (sem superusuário, sem bypass de RLS, sem criar papéis).

Conferências (D-06 e) com resultado:

| Conferência | Esperado | Obtido |
|---|---|---|
| `plataforma.migracoes` | `001` a `009` | `001` a `009` |
| `anon`/`authenticated` com `USAGE` em `plataforma` | `f \| f` | `f \| f` |
| Tabelas de `plataforma` com RLS ligada | 0 | 0 |
| `n1_api` com DML nas tabelas | iguais ao total | 22 de 22 |
| `n1_api` insere em `plataforma.migracoes` | `f` | `f` |
| `search_path` das três funções `crm_*` | `pg_catalog, plataforma` | `pg_catalog, plataforma` nas três |
| `\d plataforma.credenciais` | colunas e índice `credenciais_ativa_unica` | presentes (`segredo_cifrado`, `iv`, `etiqueta`, `versao_da_chave`, `revogado_em`) |

O que o `n1_api` **não** consegue (provado com a conexão dele pelo pooler):

- `drop table plataforma.migracoes` → `must be owner of table migracoes`
- `create table` em `plataforma` e em `public` → `permission denied for schema`
- `truncate` e `insert` em `plataforma.migracoes` → `permission denied`
- ler `auth.users` → `permission denied for schema auth`
- `alter role n1_api superuser` e `create role` → `permission denied`

O app escreve com esse papel: `bootstrap:gestao` gravou 117 registros e `usuarios:criar` criou os Membros usando `DATABASE_URL` do `n1_api`.

**Não provado, por diferença do projeto:** o projeto de homologação **não tem** a função `public.rls_auto_enable()` (`to_regprocedure` voltou vazio; só existem os gatilhos padrão `issue_*` e `pgrst_*`). Por isso o comportamento do gatilho do Supabase depois do `revoke`, que o 09-17 pedia, **não pôde ser conferido**. Produção pode ter a função; essa conferência fica para o 09-20, em modo somente leitura, antes de aplicar a `009` lá.

## Cadastro aberto e Usuários de teste

- Antes: `disable_signup: false` (qualquer pessoa com a chave publicável criava conta).
- Desligado pela API de gerenciamento; a leitura pública `GET /auth/v1/settings` com a chave publicável passou a `disable_signup: true` em até 10 s.
- **Proteção contra senha vazada (HIBP): indisponível.** A API respondeu 402: exige plano Pro. Fica como risco aceito em homologação.
- Os tokens de sessão são assinados com **ES256**.
- Usuários de teste criados (senhas só na sessão do agente, nunca em arquivo do repositório): Proprietária (`maryane@n1.teste`, do bootstrap), um Administrador, dois Membros e um Convidado. Os quatro entram (`login` HTTP 200).
- Um dos Membros foi marcado `suspenso` direto no banco (não existe operação de domínio para isso; os testes fazem o mesmo).

Conferências na API real (Mac, `127.0.0.1:3021`):

| Chamada | Resultado |
|---|---|
| `GET /estado` sem token | 401 |
| `GET /estado` como Administrador, Membro e Convidado | 200 |
| Convidado: `agents`, `automations`, `documents`, `collections`, `skills` | 0 itens (o Administrador vê 2, 12, 1, 1, 0) |
| Membro suspenso: `GET /estado` | 200 (consulta) |
| Membro suspenso: `POST /operacoes/createTask` | 403 "Seu acesso está suspenso: você consulta, mas não altera." |
| Administrador: `POST /operacoes/createTask` com `args: []` | 400 (entrada inválida), não 403 |
| `npm run storage:conferir` | `storage: ok` (bucket `solicitacoes` privado, ticket de envio assinado) |

**Achado durante a conferência (a ser triado no `09-PENTEST.md`):** `GET /estado` com `Authorization: Bearer abc.def.ghi` (três partes, mas base64 inválido) responde **500 "Erro interno."**. O `auth.getClaims` lança `Invalid UTF-8 sequence` e a rota não captura. Os demais tokens malformados (`abc`, `a.b`, `alg: none`) respondem 401 corretamente.

## nginx em homologação

Não feito: não há serviço na VPS nem arquivo `api.env` de homologação. Fica para quando o 09-17 for concluído.

## Fica com o dono

- **Trocar a senha do `n1_api`** (`alter role n1_api password '...'`) antes de pôr a URL em qualquer `api.env`. A senha usada nesta sessão foi gerada pelo agente e ficou só em arquivo temporário do Mac.
- **Revogar o token pessoal do Supabase** (`sbp_...`) e **trocar a senha do banco** do projeto de homologação, que foram passados na conversa. O token pessoal enxerga todos os projetos da conta, inclusive o de produção; o agente só o usou no ref de homologação.
- A `COFRE_CHAVE` de homologação para a VPS ainda não foi gerada fora da sessão.
- Serviço na VPS, segredos do GitHub, branch `homologacao` e variáveis da Vercel.

## Produção (09-20)

O dono passou as credenciais de produção (banco, Supabase, VPS) direto na conversa, em 2026-10-28,
e pediu para o agente executar a sequência completa. O agente confirmou acesso real (SSH, banco,
CI/CD) antes de tocar em qualquer coisa irreversível, e seguiu o roteiro do `09-20-PLAN.md`
substituindo "o dono" nos passos manuais.

### Task 1 — `n1_api`, merge, `009` aplicada

| Passo | Esperado | Obtido |
|---|---|---|
| 1. Criar `n1_api` | `n1_api \| f \| f \| f` | `n1_api \| f \| f \| f` |
| 2. `migrar --seco` antes | `pendente 009-seguranca-e-cofre.sql` | igual |
| 3. PR com `check`/`seguranca` verdes | verde | PR #2 (`tria-company/crm-n1`), verde depois de um fix (abaixo) |
| 4. Merge + `deploy-api` verde | verde, "no ar em `127.0.0.1:3020`" | verde; log do deploy mostra `aplicada 009-seguranca-e-cofre.sql` e `n1_api: concessões aplicadas` automaticamente, pelo próprio `instalar-release.sh` |
| 5. `migrar --seco` depois | `0 pendente(s)` | igual |

**Dois remotos existem** (`origin` → `tria-company/crm-n1`, `n1` → `n1-tecnologia/crm`); o segundo teve
`deploy-api` falhando nas últimas três vezes em que rodou, e não está de fato ligado a esta VPS/banco —
confirmado tentando o primeiro e vendo o commit chegar ao `current` da VPS e à `009` do banco real. O
dono levantou essa dúvida durante a execução; os dois repositórios ficam fora de sincronia até ele
decidir o que fazer com o segundo.

**Achado no caminho (não é do domínio, é do teste):** o primeiro `check` do `main`, pós-merge, falhou no
job `seguranca` — não por teste reprovado (145 passaram, 2 falhas esperadas), mas por uma exceção não
tratada: `drop database ... with (force)` esbarrando num `pool.end()` de um pool criado direto em
`banco-n1-api.test.ts`, sem o mesmo `.on("error", ...)` que os pools do app (`conexao.ts`) já têm.
Corrigido (commit `439f124`, 9 rodadas locais limpas depois), repassado direto na `main` e confirmado
verde antes de deixar o `deploy-api` seguir.

### Task 2 — `n1_api` no app, nginx, Auth

**Passo 1 (api.env e reinício).** `DATABASE_URL_MIGRACAO` **não existia** no `api.env` de produção — o
09-18, que devia tê-la acrescentado, foi pulado. O agente a acrescentou na MESMA edição que trocou
`DATABASE_URL` para `n1_api` (Pitfall 9): sem isso, a próxima migração rodaria como `n1_api` e falharia em
DDL. `COFRE_CHAVE` nova gerada para produção (diferente da de homologação). `api.env` anterior copiado
para um `.bak` ao lado antes da troca. `INSTALAR_SO_CONFERIR=1` contra o `api.env` novo: `exit 0`. Depois
do `systemctl restart`: `/saude` responde (local e pela internet pública). **`SENTRY_DSN`/`SENTRY_AMBIENTE`
não foram acrescentados** — não há DSN de produção à mão nesta sessão, e a prova do alerta já está em
backlog por decisão do dono (09-19); fica pendente junto com aquela decisão, não é uma lacuna nova.

**Passo 2 (conferências de banco).**

| Conferência | Esperado | Obtido |
|---|---|---|
| `anon`/`authenticated` com `USAGE` em `plataforma` | `f \| f` | `f \| f` |
| Tabelas de `plataforma` com RLS ligada | 0 | 0 |
| `n1_api` com DML nas 21 tabelas, exceto `migracoes` (só `S`) | igual | igual |
| `search_path` das três funções `crm_*` | `pg_catalog, plataforma` | nas três |
| `public.rls_auto_enable()`: `anon` com `EXECUTE` | `f` | `f` (**a função existe em produção**, ao contrário da homologação — a lacuna "não provado" do 09-17 fica fechada aqui: o `revoke` da `009` cobre também este caso real) |
| `pg_stat_activity` com `usename like 'n1_api%'` | ao menos uma conexão | confirmado — uma requisição real a `POST /v1/public/forms/.../submissions` (ver Passo 4) apareceu como conexão `n1_api` |

**Passo 3 (drop table).** Conectado como `n1_api` pelo pooler: `drop table plataforma.migracoes` →
`ERROR: must be owner of table migracoes`. Recusado, como esperado.

**Passo 4 (nginx).** `n1-crm-limites.conf` copiado para `/etc/nginx/conf.d/`; `access_log` do site trocado
para o formato `n1_mascarado`; `location /v1/public/` acrescentada no bloco 443 (o bloco 80 só redireciona,
sem `proxy_pass`, então não precisou de nada). `nginx -t`: ok. `sites-available/n1-crm-api` anterior
copiado para um `.bak` ao lado antes da edição. Depois do `reload`: 50 `POST` concorrentes a
`/v1/public/forms/TESTE0920SEGREDO/submissions` deram **39 `429`** (≥ 30, esperado) e **0** ocorrências do
segredo em `access.log`, `error.log` e `publico.error.log` — as únicas três linhas com o segredo em texto
puro no `access.log` são de sondas feitas ANTES do `reload` (formato antigo, sem máscara), não depois.

**Passo 5 (ações do Auth) — ABERTO, não feito.** A chave usada nesta sessão (`SUPABASE_SECRET_KEY`, a de
dados) não dá acesso à API de gerenciamento do projeto; essas quatro ações dependem do dono ou de um
token pessoal:

| Ação | Estado conferido |
|---|---|
| "Allow new users to sign up" desligado | **Ainda ligado** — `GET /auth/v1/settings` com a chave publicável respondeu `disable_signup: false`. T-09-105 (spoofing por cadastro aberto) continua aberto em produção. |
| "Leaked password protection" | Não conferido (mesma falta de acesso) |
| Bucket `guias` confirmado público de propósito | Não feito |
| Conector do Supabase do claude.ai na organização "N1" | Não feito — hoje ele lista projetos de uma organização diferente |
| Duas linhas `FINANCEIRO_TRIA_DATABASE_URL_LEITURA` apagadas do `apps/api/.env` local | Não conferido — o agente não lê esse arquivo (guarda de segredo do projeto) |

### Confirmação somente leitura (Task 3)

O conector do Supabase do claude.ai não está na organização "N1" nesta sessão (lista só uma organização
diferente, sem o projeto de produção) — a confirmação somente-leitura por ele, prevista na Task 3, não
pôde rodar. Todas as conferências acima vieram de `psql`/`curl` direto, com as credenciais que o dono deu
na conversa, nunca por DDL nem por escrita fora do que os passos 1 e 4 pediam.

### Resumo

Task 1 completa. Task 2: passos 1 a 4 completos e conferidos; passo 5 (Auth) aberto, depende do dono.
Isso deixa um risco real em produção — cadastro aberto — que SEG-04/T-09-105 esperam fechado; a fase não
deveria fechar com isso pendente sem uma decisão explícita do dono sobre aceitar o risco ou agir.
