# Fase 14: Unificação do CRM, o modelo novo ganha o que falta e a Tarefa conversacional - Mapa de padrões

**Mapeado:** 2026-11-04
**Arquivos analisados:** 22 (novos ou alterados)
**Análogos encontrados:** 21 / 22

Os números de linha foram conferidos nos arquivos atuais. Todos os análogos são rastreados pelo git. Esta fase não usa espelhos `.gsd`.

## Classificação dos arquivos

| Arquivo novo ou alterado | Camada | Papel | Fluxo | Análogo mais próximo | Qualidade |
|---|---|---|---|---|---|
| `apps/api/migracoes/011-*.sql` | api | migração (DDL) | batch | `apps/api/migracoes/010-carga-e-bloqueio-da-lista.sql` (cabeçalho, pós-condição) e `009-seguranca-e-cofre.sql:92-105` (desliga RLS) | role-match |
| `apps/api/src/persistencia/migracao-011.test.ts` | api | teste de migração | batch | `apps/api/src/persistencia/migracao-010.test.ts` | exato |
| `apps/api/src/testes/banco-crm.ts` (alterar `limparEspaco`) | api | utilitário de teste | CRUD | ele mesmo, lista fixa por volta da linha 80 | exato |
| `apps/api/src/persistencia/unidade-de-trabalho.ts` (+ `lerDoCrm`, 4º argumento de `aoConfirmar`) | api | serviço de persistência | request-response | ele mesmo (`aoConfirmar` em `:184`, `:596`, `:656`) | exato |
| `apps/api/src/servicos/crm/gesto-misto.ts` | api | serviço | request-response | `servicos/crm/transacao.ts` (`comTransacao`, `traduzirErroDePg`) | role-match |
| `apps/api/src/servicos/crm/{contatos,conversas,negocios,empresas}.ts` (métodos novos) | api | serviço | CRUD | `servicos/crm/conversas.ts` `mudarSituacao` (`:111-137`) | exato |
| `apps/api/src/servicos/crm/*.test.ts` (novos casos) | api | teste | CRUD | `servicos/crm/conversas.test.ts` | exato |
| `apps/api/src/repositorios/crm/{consentimentos,notas,marcacoes}.ts` | api | repositório | CRUD | `repositorios/crm/conversas.ts`, `repositorios/crm/contatos.ts` | exato |
| `apps/api/src/repositorios/crm/contatos.ts` (colunas `mesclado_*`) | api | repositório | CRUD | ele mesmo (`COLUNAS`, `LinhaDoBanco`, `rebaixarPrincipal :365`) | exato |
| `apps/api/src/repositorios/crm/conversas.ts` (`inserir` aceita `id?`, `na_lixeira_em`) | api | repositório | CRUD | ele mesmo (`LinhaNovaDeConversa :28-36`, `abertaDoPar :138`) | exato |
| `apps/api/src/rotas/crm/{contatos,conversas,negocios}.ts` (rotas novas) | api | rota REST | request-response | `apps/api/src/rotas/crm/funis.ts` | exato |
| `apps/api/src/rotas/crm/tarefas-conversacionais.ts` | api | rota REST | request-response | `rotas/crm/funis.ts` (esquemas, `responder`) e `rotas/operacoes.ts:409-422` (recorte de visibilidade) | role-match |
| `apps/api/src/rotas/operacoes.ts` (extrair helper de recorte, sucessão de Membro) | api | rota | request-response | ele mesmo | exato |
| `packages/dominio/src/crm/consentimentos.ts` + teste | dominio | regra pura | transform | `packages/dominio/src/crm/conversas.ts` `proximaSituacao` + `conversas.test.ts` | exato |
| `packages/dominio/src/crm/contatos.ts` (`validarMesclagem`, `validarTransferencia`, `EstadoDoContato`) | dominio | regra pura | transform | `crm/contatos.ts` `validarContato` (INV-CON-01) | exato |
| `packages/dominio/src/crm/conversas.ts` (`validarMover`, `validarAtribuicao`, `validarLixeira`) | dominio | regra pura | transform | `crm/conversas.ts:120-131` `proximaSituacao` | exato |
| `packages/dominio/src/operations/tarefa-conversacional-crm.ts` (operações fora de `OPERACOES`) | dominio | regra pura | transform | `sendMessageSemConferencia` (ver `packages/dominio/CONTEXT.md`, "Quem pode") e `operations/tarefas-conversacionais.ts` | role-match |
| `apps/web/...` (diálogo e botão da Tarefa conversacional chamam REST e `rehidratar()`) | web | componente | request-response | `apps/web/src/dados/crm/` (clientes HTTP do CRM) | role-match |
| teste "nada novo importa `funilDaLista`" | api ou web | teste de fonte | batch | `regime-dos-chamadores.test.ts` (indicado na RESEARCH, 3.1.4) | role-match |
| `apps/api/src/rotas/crm/index.ts` (registrar a rota nova) | api | rota | request-response | ele mesmo | exato |
| `GET /membros/:id/sucessao-no-crm` | api | rota | request-response | `rotas/crm/funis.ts` | role-match |
| Script de ensaio local da 011 (D-02) | api | processo manual | batch | RESEARCH, "Ensaio local" | sem análogo |

## Atribuição de padrões

### `apps/api/migracoes/011-*.sql` (api, migração, batch)

**Moldes:** a 010 para cabeçalho, idempotência e pós-condição. A 009 para o desligamento de RLS. As 007 e 008 para as convenções de tabela. A migração aplicada é imutável: cada correção é uma nova migração.

**Cabeçalho e pós-condição** (`010-carga-e-bloqueio-da-lista.sql:1-31`, `56-63`):
```sql
-- A Carga sai das Visualizacoes ... SO DADOS. ... Idempotente: ...
-- Roda inteira dentro da transacao de `migrar()` (begin/commit/rollback por arquivo)
...
-- POS-CONDICAO
do $$
begin
  if exists (select 1 from plataforma.registros where colecao = 'views' and dados->>'kind' = 'carga') then
    raise exception '010: ainda ha Visualizacao carga ou Lista com blocks';
  end if;
end $$;
```
O teste localiza o bloco por `TEXTO.slice(TEXTO.indexOf("-- POS-CONDICAO"))`. Mantenha o marcador `-- POS-CONDICAO`, se a 011 tiver pós-condição.

**Bloco "desliga RLS"** (`009-seguranca-e-cofre.sql:92-105`). Copie literalmente para o fim da 011, porque ela cria tabelas:
```sql
do $$
declare
  t record;
begin
  for t in
    select c.relname from pg_class c
     where c.relnamespace = 'plataforma'::regnamespace
       and c.relkind in ('r', 'p') and c.relrowsecurity
  loop
    execute format('alter table plataforma.%I disable row level security', t.relname);
  end loop;
end $$;
```

**Concessão ao `n1_api`:** a 009 concede DML por `alter default privileges`. A 011 NÃO repete `grant`. Depois de aplicar em qualquer banco, rode `npm run banco:conceder` (passo no ensaio local). Para tabelas novas, o default privileges só cobre o dono que o definiu. O `banco:conceder` é a rede.

**Convenções de tabela** (RESEARCH, "Desenho da migração 011", conferidas nas 007 e 008):
- `workspace_id text not null`.
- PK `(workspace_id, id)`.
- `id text default gen_random_uuid()::text`.
- FK composta `(workspace_id, ...)`.
- `constraint <tabela>_<regra>_ck`.
- `create ... if not exists`.
- Trigger `crm_toque_atualizado_em` onde houver `atualizado_em`.

**Conteúdo:** use o rascunho da RESEARCH como base.
- `contatos.mesclado_em_id` e `mesclado_em`, com `contatos_estado_ck` ampliado.
- Tabelas `contato_consentimentos`, `contato_notas`, `conversa_marcacoes`, `crm_de_para`, `registros_crm_antigo`.
- Acréscimos recomendados: `conversas.na_lixeira_em` com check, e índices parciais de `atribuido_id` e `fila_id`.
- NÃO ponha `webhooks_recebidos` nem coluna de Grupo/Flow.
- Os `add constraint` não têm `if not exists`. Para ficar idempotente, use `drop constraint if exists` antes, como a RESEARCH faz com `contatos_estado_ck`. Faça o mesmo em `contatos_mesclado_ck` e `contatos_mesclado_em_fk`.

---

### `apps/api/src/persistencia/migracao-011.test.ts` (api, teste de migração)

**Análogo:** `apps/api/src/persistencia/migracao-010.test.ts`

**Imports e constantes** (`:21-34`):
```typescript
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { describeComBanco, poolDoDono } from "../testes/banco-crm";
import { encerrar } from "./conexao";
import { migrar } from "./migrar";

const PASTA_DE_MIGRACOES = fileURLToPath(new URL("../../migracoes", import.meta.url));
const ARQUIVO_010 = "010-carga-e-bloqueio-da-lista.sql";
const TEXTO_010 = readFileSync(join(PASTA_DE_MIGRACOES, ARQUIVO_010), "utf8");
const ate009 = () =>
  readdirSync(PASTA_DE_MIGRACOES).filter((f) => f.endsWith(".sql") && f < ARQUIVO_010).sort();
```
Adaptação: `ARQUIVO_011`, `ate010`, banco descartável `m011_<8>`, com 001 a 010 aplicadas.

**Banco descartável** (`:42-72`):
- `urlDoBanco(nome)` usa a URL do dono local (`DATABASE_URL_MIGRACAO` se `localhost` ou `127.0.0.1`).
- `bancoAte009()` roda `create database`, cria o schema `plataforma`, cria `plataforma.migracoes (nome text primary key, aplicada_em ...)`, e aplica cada arquivo anterior pelo texto.
- Copie as três funções trocando 009 por 010.

**Casos a cobrir** (RESEARCH, "Obrigações da 011"):
- `contatos_estado_ck` aceita `mesclado` e recusa `mesclado` sem alvo.
- `contato_consentimentos` recusa `decisao = 'talvez'`.
- Idempotência do que for idempotente.
- Falha no meio, pelo `migrar()` real, não deixa linha em `plataforma.migracoes`: é o caso (e) da 010.
- `describeComBanco` pula fora do host local. `afterAll` chama `encerrar()`.

`migrar-seco.test.ts` compara com a lista dinâmica da pasta e não precisa de edição.

---

### `apps/api/src/testes/banco-crm.ts` (alterar)

`limparEspaco` apaga por lista fixa (`mensagens, conversas, canais, negocios, contato_empresa, empresa_identificadores, empresas, contato_identificadores, contatos, funis`, perto da linha 80). Os `on delete cascade` cobrem `contato_notas`, `contato_consentimentos` e `conversa_marcacoes`. Acrescente `crm_de_para` e `registros_crm_antigo`, que não têm FK.

Exports existentes a reusar: `temBancoCrm :37`, `describeComBanco :40`, `poolDoDono :51`, `prepararBancoCrm :57`, `novoEspacoDeTeste`, `semearMembro`, `semearCanal`, `limparEspaco`.

---

### `apps/api/src/servicos/crm/*` (api, serviço, CRUD de uma base só)

**Análogo:** `apps/api/src/servicos/crm/conversas.ts` `mudarSituacao` (`:111-137`). Serve para mover, atribuir, lixeira, restaurar, marcação, notas, consentimentos e transferir Identificador.

```typescript
const FRASES: FrasesDeRestricao = {
  conversas_nao_resolvida_uq: { codigo: "CONVERSA_JA_ABERTA", error: FRASE_JA_ABERTA },
};   // :70-72  (acrescente contatos_mesclado_em_fk e contato_consentimentos_*)

async function mudarSituacao(membro: MembroDaSessao, id: string, acao: AcaoDeSituacao) {
  const negado = await exigir(deps.acesso, membro, acao === "resolver" ? "resolver" : "reabrir", "conversa");
  if (negado) return { ok: false, ...negado };
  return comTransacao(deps.pool, async (cliente: PoolClient) => {
      const conversas = criarRepositorioDeConversasPg(cliente);
      const atual = await conversas.obter(membro.workspaceId, id, { travar: true });
      if (!atual) return conversaNaoEncontrada();
      const proxima = proximaSituacao(atual, acao);          // regra pura do domínio
      if (!proxima.ok) return transicaoInvalida(proxima.error);
      ...
      return sucesso({ conversa: atualizada, canal: resumoDoCanal(canal) });
    }, FRASES);
}
```
Pontos a copiar:
- `exigir(...)` vem ANTES de qualquer leitura.
- `obter(..., { travar: true })`.
- A recusa é VALOR (`recusa<never>(404, "...", { codigo })`, `:74-77`), nunca exceção.
- Sem ação nova na matriz. Mesclar, transferir, nota e consentimento usam `editar` em `contato`. Atribuir e marcar usam `editar` em `conversa`. Mover usa `mover`. Lixeira usa `enviar_para_lixeira`. Restaurar usa `restaurar` (`permissoes.ts`, `podeNoCrm :57`).

**`comTransacao` e `traduzirErroDePg`** (`servicos/crm/transacao.ts:25-67`):
- Três SQLSTATE traduzem: `23505`, `23503` e `23514`.
- A frase sai por nome de constraint, sem o nome.
- O `commit` fica DENTRO do `try`: o constraint trigger deferido da 007 só dispara nele.
- `release()` no `finally`.

**Cuidados da RESEARCH:**
- `conferirContato` (`negocios.ts:146-156`) só recusa `na_lixeira`: ajustar para recusar também `mesclado` e `arquivado`.
- Extrair `criarNegocioNoCliente(cliente, membro, entrada)` de `criar` (`negocios.ts:325-395`).
- Extrair `abrirConversaNoCliente(cliente, membro, entrada, id?)` de `conversas.ts` `criar` (`:158-199`).
- Mesclar trava por ordem determinística de id, para evitar `40P01` (Pitfall 2).
- O reaproveitamento da Conversa aberta usa `abertaDoPar` (`repositorios/crm/conversas.ts:138`).

**Teste:** molde `servicos/crm/conversas.test.ts:1-40`:
```typescript
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearCanal, semearMembro } from "../../testes/banco-crm";
const servico = criarServicoDeConversas({ pool, acesso: criarAcessoAoCrmPg(pool) });
const sessao = (workspaceId: string, id: string): MembroDaSessao => ({ id, workspaceId, state: "ativo" });
function valor<T>(r: ResultadoCrm<T>): T { if (!r.ok) throw new Error(`esperava sucesso, veio ${r.status} ...`); return r.valor; }
function recusado(r: ResultadoCrm<unknown>) { if (r.ok) throw new Error("esperava recusa, veio sucesso"); return r; }
describeComBanco("ServicoDeConversas — Postgres local", () => { const espacos: string[] = []; ... });
```
Cada caso cria o Espaço com `novoEspacoDeTeste`, registra em `espacos`, e semeia o Membro administrador. O `afterAll` limpa os Espaços e chama `encerrar()`.

---

### `apps/api/src/persistencia/unidade-de-trabalho.ts` (alterar: `lerDoCrm`)

Âncoras atuais:
- `aoConfirmar?: (cliente: PoolClient, valor: T, state: DataState) => Promise<void>` em `:184`.
- Chamado em `:656` depois de `gravar` e `gravarEventos`, antes do `commit`.
- A saída em lote de duas idas só vale com `!opcoes.aoConfirmar` (`:596`). Gestos com `aoConfirmar` perdem o ganho da Fase 13. Isso é aceito e deve ser registrado na medição.
- Projeção dos Canais: `:538`. Retirada antes de gravar: `semCanaisProjetados`, `:594`.

```typescript
await gravarEventos(cliente, workspaceId, eventos);
if (opcoes.aoConfirmar) await opcoes.aoConfirmar(cliente, resultado.value, antes.state);   // :655-656
```
Mudança proposta:
- `lerDoCrm?: (cliente) => Promise<L>` roda entre a projeção dos Canais (`:538`) e a `operacao` (`:553`).
- Os argumentos novos entram no FIM de `operacao` e de `aoConfirmar`, para não quebrar os chamadores.
- NÃO adicione campo a `MedicaoDaExecucao`: os testes de medição enumeram os campos.
- Teste ao lado: `unidade-de-trabalho.test.ts` (fakes, prova 3 idas com `aoConfirmar`) e `unidade-de-trabalho-trava.test.ts` (Postgres).

### `apps/api/src/servicos/crm/gesto-misto.ts` (novo)

Sem análogo exato. Combine o `catch` de `comTransacao` (`transacao.ts:55-62`) com o esqueleto da RESEARCH, "Gesto misto", itens 2 a 7:
- Recusa de `lerDoCrm` guardada em variável de fechamento. A `operacao` devolve `fail(frase)`, para `executar` desfazer limpo.
- `traduzirErroDePg` no `catch`.
- Provas: erro em `gravarNoCrm` deixa `plataforma.registros` e `plataforma.conversas` iguais; a `operacao` recusa e `gravarNoCrm` nunca roda; `23505` vira 409.

---

### `apps/api/src/rotas/crm/*` (rotas REST por recurso)

**Análogo:** `apps/api/src/rotas/crm/funis.ts`

**Imports** (`:22-29`):
```typescript
import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ServicoDeFunis } from "../../servicos/crm/funis";
import { PARAMS_ID, QUERY_LISTA, responder, responderLista, TEXTO_CURTO, TEXTO_LONGO } from "./comum";
```

**Esquemas `.strict()`** (`:32-80`):
```typescript
const NOVA_ETAPA = z.object({ nome: TEXTO_CURTO.min(1), ... }).strict();
const EDICAO_DE_ETAPA = z.object({ ... }).strict()
  .refine((corpo) => Object.keys(corpo).length > 0, { message: "Informe ao menos um campo para editar." });
```
O corpo nunca aceita `workspaceId`, `criadoPor`, `estado` nem ids "conferidos". O Membro atuante é SEMPRE `request.membro`. Arrays têm teto (T-07-16). Rota sem corpo NÃO declara `body` (Pitfall 4: o Fastify 5 recusa `content-type: json` sem corpo).

**Handlers** (`:109-...`; `funis.ts` dentro de `const rotas = app.withTypeProvider<ZodTypeProvider>()`):
```typescript
responder(reply, await servico.criar(request.membro, request.body), 201)
responder(reply, await servico.editar(request.membro, request.params.id, request.body))
responderLista(reply, await servico.listar(request.membro, request.query))
```
`responder` e `responderLista` ficam em `rotas/crm/comum.ts`. `QUERY_LISTA` (`comum.ts:19-27`) usa `ESTADO` de `ESTADOS_CRM`. NÃO ponha `mesclado` em `ESTADOS_CRM`: crie `EstadoDoContato = EstadoCrm | "mesclado"`. `GET /contatos` nunca lista `mesclado`.

**Teste de rota:** copie `rotas/crm/funis.test.ts` (e `contatos.test.ts`) para cada rota nova.

**`rotas/crm/tarefas-conversacionais.ts`:** a resposta usa o mesmo recorte de `POST /operacoes/:nome`. Extraia para um helper compartilhado, não copie (Pitfall 4).
```typescript
import { recortarDiferenca, recortarValor, visibilidadePara } from "@n1/dominio/derive-visibilidade";   // rotas/operacoes.ts:38
const { ocultos } = visibilidadePara(depois, request.membro.id);                                       // :419
diferenca: recortarDiferenca(resultado.diferenca, depois, request.membro.id, ocultos),                // :422
```
Complete com `recortarValor` e `maiorIdDe(depois)` do bloco final de `rotas/operacoes.ts` (~`:409-430`). Abra o trecho antes de extrair.

---

### `packages/dominio/src/crm/*` (domínio, regra pura)

**Análogo:** `packages/dominio/src/crm/conversas.ts:120-131` (`proximaSituacao`) e `:102` (`validarNovaConversa`).

```typescript
export function proximaSituacao(
  conversa: Pick<Conversa, "situacao" | "estado">,
  acao: AcaoDeSituacao,
): OperationResult<{ readonly situacao: SituacaoDaConversa }> {
  if (conversa.estado === "na_lixeira") return fail("Uma Conversa na lixeira não muda de situação.");
  if (acao === "resolver") {
    if (conversa.situacao === "resolvida") return fail("A Conversa já está resolvida.");
    return ok({ situacao: "resolvida" });
  }
  ...
}
```
`validarMesclagem`, `validarTransferencia`, `validarMover`, `validarAtribuicao`, `validarLixeira` e `consentimentoVigente` seguem esta forma:
- Entradas estruturais (`Pick<...>`).
- Devolvem `OperationResult` com `ok`/`fail`.
- Frase em português.
- Não conhecem pg nem zod.
- RN-CON-14: o sobrevivente nunca é `mesclado`.
- RN-CXE-10: na colisão fica a Conversa de Mensagem mais recente e a outra vira `resolvida`.

**Teste ao lado:** `conversas.test.ts` (`describe`, `it`, `it.each`):
```typescript
describe("proximaSituacao", () => {
  it.each(["aberta", "pendente"] as const)("resolver uma Conversa %s a resolve", (situacao) => {
    expect(proximaSituacao({ situacao, estado: "ativo" }, "resolver")).toEqual({ ok: true, value: { situacao: "resolvida" } });
  });
});
```
`validarNovaConversa` testa o campo da recusa: `{ ok: false, error: "...", field: "conteudo" }`. A regra nova de validação deve fazer o mesmo.

**Operações da Tarefa conversacional** (`operations/tarefa-conversacional-crm.ts` ou in-place em `tarefas-conversacionais.ts`). Precedente: `sendMessageSemConferencia` (variantes `…SemConferencia` fora do registro). Para tirar as 4 de `OPERACOES` (RESEARCH, Pattern 2), mexa em:
- `registro.ts` (imports `:326-330`, entradas `:674-678`).
- `esquemas/tarefas-conversacionais.ts` e seu teste.
- As linhas 311-314 da tabela "Quem pode" em `packages/dominio/CONTEXT.md`.
- `operations.test.ts` (casos 3959-4250).
- `operacoes.test.ts:735-740`.

Confira as linhas atuais antes de citar. A assinatura nova é `criarTarefaConversacional(state, membro, input, referencias)`.

---

## Padrões compartilhados

### Regra de dependência
`dominio` não importa `web` nem `api`. `web` e `api` não se conhecem. Regra de SQL e de HTTP não entra no domínio. Regra de negócio não entra na rota (`rotas/CONTEXT.md`: sem SQL e sem regra na rota).

### Recusa como valor
**Fonte:** `servicos/crm/resultado.ts` (`recusa`, `sucesso`) e `transacao.ts`. **Aplicar a:** todo serviço novo. Exceção só para o que o banco segura por SQLSTATE, traduzido por `traduzirErroDePg`.

### Acesso por Papel
**Fonte:** `exigir(deps.acesso, membro, acao, recurso)` e `podeNoCrm` (`packages/dominio/src/crm/permissoes.ts`). **Aplicar a:** todo método de serviço, antes de ler.

### Migração
Imutável depois de aplicada. Bloco de desligar RLS no fim. `npm run banco:conceder` depois de aplicar. Ensaio local descrito na RESEARCH ("Ensaio local (D-02)"): `postgres:16` em contêiner, porta `55640+NN`, sem reutilizar o `crm-n1-pg-13`.

### Testes com banco
`describeComBanco` pula fora do host local. Rodar com `DATABASE_URL=postgres://postgres:x@localhost:<porta>/postgres DATABASE_URL_MIGRACAO=<mesma> npx vitest run <arquivo>`. Limpar Espaços no `afterAll` e chamar `encerrar()`.

### `GET /estado` não muda
Nada novo entra em `hidratar()` (Pattern 3, `rotas/estado.ts`). Os Canais da 008 só aparecem por projeção em `GET /estado` e em `executar()`.

## Sem análogo

| Arquivo | Papel | Fluxo | Motivo |
|---|---|---|---|
| Script de ensaio local da 011 | processo manual | batch | O repositório não tem script de ensaio de migração sobre cópia de dados reais. Siga os passos da RESEARCH ("Ensaio local (D-02)"), com `\copy` das coleções antigas e contagens antes e depois. |

`gesto-misto.ts` tem análogo parcial (`comTransacao`). O desenho vem da RESEARCH, não de código existente.

## Metadados

**Escopo da busca de análogos:** `apps/api/migracoes`, `apps/api/src/{persistencia,servicos/crm,repositorios/crm,rotas/crm,testes}`, `packages/dominio/src/crm`.
**Arquivos lidos:** 010 (SQL), `migracao-010.test.ts`, `transacao.ts`, `rotas/crm/funis.ts` e `comum.ts`, `servicos/crm/conversas.ts` e seu teste, `unidade-de-trabalho.ts` (trechos), `009-seguranca-e-cofre.sql` (trecho), `crm/conversas.ts` (domínio) e seu teste, e a RESEARCH (`:150-340`).
**Data da extração:** 2026-11-04

## PATTERN MAPPING COMPLETE
