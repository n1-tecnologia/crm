# Provas da Fase 9 — o que foi conferido de fora do código

Data: 2026-10-28. Código usado: `feat/webhook-meta-instagram@aff971d` (nada foi publicado em branch remota).
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
