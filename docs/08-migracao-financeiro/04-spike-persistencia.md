# Spike da Fase 1 — a hidratação do `DataState` funciona

**2026-09-15.** Resultado: a aposta técnica da Fase 1 está **validada** — primeiro num Postgres local, depois no Supabase de verdade — com quatro correções de desenho que só apareceram porque o spike existiu.

## A aposta

O domínio é uma função pura sobre o estado inteiro do Espaço de Trabalho: `operacao(state, quem, entrada)` lê o grafo todo e muta o que precisa. A aposta da [Fase 1](03-plano-de-migracao.md#fase-1) é que isso continua verdadeiro com banco — hidratar o estado, rodar a operação **sem alterá-la**, gravar só o que mudou — e que assim `packages/dominio` e os 214 testes sobrevivem intactos.

Se a aposta estivesse errada, as 3–4 semanas da Fase 1 estariam erradas junto. Custou meio dia descobrir.

## Como foi provado

O argumento não é "o INSERT funcionou". É: **se o estado hidratado for idêntico ao que `buildSeed()` monta, todo teste que hoje passa sobre o seed passa sobre o banco** — sem reescrever nenhum.

`apps/api/src/persistencia/persistencia.test.ts` verifica quatro coisas contra um Postgres 17 de verdade:

| Verificação | Resultado |
|---|---|
| O estado hidratado é idêntico ao do seed (`toEqual` **e** `toStrictEqual`) | passa — fiel campo a campo, inclusive quanto a chaves ausentes |
| Uma operação grava só o que tocou | 2 linhas para um Comentário (a Tarefa e o Registro de Atividade) |
| Uma recusa do domínio não grava nada | passa — nenhuma linha muda |
| Medição com o estado 10× maior | passa |

Sem `DATABASE_URL` os quatro pulam, para `npm run check` não depender de infraestrutura.

## Números

O banco da plataforma é um projeto Supabase **próprio** (`epomplsskqpluxuujpxl`), separado do financeiro. As medições abaixo separam o que é rede do que é trabalho, porque daqui — um notebook no Brasil — cada ida e volta ao servidor custa **~234 ms**, e isso distorceria qualquer leitura.

| | Registros | Postgres local | Supabase (mediana) | Além da rede |
|---|---|---|---|---|
| Semear do zero | 908 | 72 ms | ~2.000 ms | — |
| **Hidratar** | 906 · 475 KB | **18 ms** | **316 ms** | **~82 ms** |
| Hidratar com 10× | 3.714 | 32 ms | 496 ms | ~263 ms |
| Gravar um Comentário | 2 linhas | — | — | — |

A leitura que importa é a última coluna: o custo real de hidratar o Espaço de Trabalho inteiro é da ordem de **80 ms**. O resto é a distância física entre quem pergunta e o banco — e o `apps/api` não vai rodar num notebook.

### Onde o banco está

O projeto foi criado em **us-west-2 (Oregon)** — confirmado pela tabela oficial de faixas de IP da AWS. Daqui, uma conexão a Oregon leva 250 ms; a São Paulo (`sa-east-1`), 99 ms. Como o projeto está vazio (só o schema `plataforma`), **recriá-lo em São Paulo agora custa um `npm run migrar`**. Depois, custa uma migração de dados. É decisão do dono do projeto; o plano segue igual nos dois casos.

## Os quatro achados

### 1. Coleção vazia não deixa rastro

Uma coleção sem registros não gera linha, e a hidratação devolvia `undefined` no lugar de `[]` — `state.files.push(...)` quebraria na primeira escrita.

**Correção:** o domínio passou a declarar as próprias coleções em `packages/dominio/src/colecoes.ts`. O tipo `Record<ChaveDeColecao, true>` mantém a lista honesta: acrescentar uma coleção a `DataState` sem acrescentá-la lá não compila.

### 2. O `jsonb` reordena as chaves

`{"zz":1,"a":2,"mmm":3}` volta do Postgres como `{"a":2,"zz":1,"mmm":3}`. Comparar por `JSON.stringify` acusava mudança em **todo** registro lido, e a gravação por diferença gravaria o Espaço de Trabalho inteiro a cada operação.

**Correção:** comparação canônica (chaves em ordem alfabética, recursiva) dos dois lados. De brinde, resolve `undefined` versus ausente — os dois viram a mesma forma.

### 3. Posição inteira faz um `unshift` custar a coleção inteira

O log de atividade é escrito com `state.activity.unshift(record)` — o mais novo primeiro. Com posição inteira, um registro novo deslocava os 312 existentes: **314 linhas gravadas** para um comentário.

**Correção:** posição fracionária (`double precision`). O novo recebe um valor antes do primeiro e ninguém mais se move. **314 → 2.**

A função `reordenar` faz relabeling mínimo: quem já tem posição coerente com o antecessor fica onde está. O limite conhecido é a precisão do `double` depois de ~50 inserções sucessivas no mesmo ponto; quando a fração não cabe mais, ela renumera a partir dali com inteiros.

### 4. Duas consultas em `Promise.all` no mesmo cliente são duas idas e voltas

`hidratar` buscava os registros e a revisão do Espaço de Trabalho em paralelo — mas o cliente `pg` serializa consultas numa conexão, e cada uma pagava a rede inteira. Com latência alta e instável, a mediana foi a **11.413 ms**.

**Correção:** uma consulta só, com a revisão vinda por `LEFT JOIN` em cada linha (8 bytes por registro contra uma ida e volta). **11.413 → 316 ms.** É o tipo de coisa que um Postgres local, a 0,2 ms de distância, jamais teria mostrado.

## O que ficou de pé

```
apps/api/src/persistencia/
  ../../migracoes/001-plataforma.sql   schema plataforma: registros + workspaces (apps/api/migracoes/)
  conexao.ts              o pool; lê apps/api/.env; TLS fora do localhost
  migrar.ts               aplica as migrações em ordem, uma vez cada (npm run migrar)
  repositorio.ts          hidratar, gravar por diferença, semear, reordenar
  unidade-de-trabalho.ts  executar(): transação + revisão otimista
  persistencia.test.ts    as quatro verificações
```

`plataforma.registros` guarda um registro por entidade, com `dados jsonb`. A forma genérica é deliberada: o domínio tem 45 coleções, e tipar as 45 antes de saber quais são consultadas por coluna seria decidir no escuro. As que forem — Tarefa primeiro — ganham coluna gerada depois, sem migrar dado:

```sql
alter table plataforma.registros
  add column status_id text generated always as (dados->>'statusId') stored;
```

## Concorrência

A revisão é do **Espaço de Trabalho**, não do registro: lida ao hidratar, conferida ao gravar, e a operação recomeça se alguém passou na frente (3 tentativas). É o grão certo porque é o grão que a operação enxerga — ela lê o grafo inteiro, então duas escritas simultâneas podem se invalidar mesmo tocando registros diferentes.

O custo é serializar escritas por Espaço de Trabalho. Para uma dezena de pessoas simultâneas, sobra. Quando não sobrar, o caminho é recorte por Lista — o formato do `DataState` não muda, só o `where`.

## O que vem agora na Fase 1

1. ~~Supabase Auth — `/entrar` deixa de escolher Membro e passa a autenticar.~~ **Feito** no commit `d713253`, no mesmo dia: o Membro é resolvido por `Member.userId === usuario.id`.
2. Uma rota por operação do domínio (16 módulos), com `store.ts` trocando `run()` local por `POST`.
3. Bootstrap: `seed-financeiro.ts` vira script de criação do Espaço "Gestão", sem as Tarefas fictícias.
4. Colunas geradas e índices para o que a tela de Contas a pagar filtra.

A partir daqui o trabalho segue pelo GSD: `.planning/ROADMAP.md`, Phase 1.
