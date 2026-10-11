---
phase: 07-crm-contatos-empresas-funis-e-negocios
reviewed: 2026-10-11T17:25:30Z
depth: standard
files_reviewed: 115
files_reviewed_list:
  - CONTEXT.md
  - apps/api/CONTEXT.md
  - apps/api/migracoes/007-crm.sql
  - apps/api/src/app.test.ts
  - apps/api/src/app.ts
  - apps/api/src/e2e/crm-fluxo.test.ts
  - apps/api/src/persistencia/migrar-seco.test.ts
  - apps/api/src/persistencia/migrar.cli.ts
  - apps/api/src/persistencia/migrar.ts
  - apps/api/src/repositorios/CONTEXT.md
  - apps/api/src/repositorios/crm/admin-da-empresa.test.ts
  - apps/api/src/repositorios/crm/contatos.ts
  - apps/api/src/repositorios/crm/empresas.ts
  - apps/api/src/repositorios/crm/funis.ts
  - apps/api/src/repositorios/crm/membros.ts
  - apps/api/src/repositorios/crm/negocios.ts
  - apps/api/src/repositorios/crm/sql.ts
  - apps/api/src/repositorios/crm/vinculos.ts
  - apps/api/src/rotas/CONTEXT.md
  - apps/api/src/rotas/crm/comum.ts
  - apps/api/src/rotas/crm/contatos.test.ts
  - apps/api/src/rotas/crm/contatos.ts
  - apps/api/src/rotas/crm/empresas.test.ts
  - apps/api/src/rotas/crm/empresas.ts
  - apps/api/src/rotas/crm/funis.test.ts
  - apps/api/src/rotas/crm/funis.ts
  - apps/api/src/rotas/crm/index.ts
  - apps/api/src/rotas/crm/negocios.test.ts
  - apps/api/src/rotas/crm/negocios.ts
  - apps/api/src/servicos/CONTEXT.md
  - apps/api/src/servicos/crm/acesso.ts
  - apps/api/src/servicos/crm/contatos.test.ts
  - apps/api/src/servicos/crm/contatos.ts
  - apps/api/src/servicos/crm/empresas.test.ts
  - apps/api/src/servicos/crm/empresas.ts
  - apps/api/src/servicos/crm/funis.test.ts
  - apps/api/src/servicos/crm/funis.ts
  - apps/api/src/servicos/crm/negocios.test.ts
  - apps/api/src/servicos/crm/negocios.ts
  - apps/api/src/servicos/crm/resultado.ts
  - apps/api/src/servicos/crm/transacao.test.ts
  - apps/api/src/servicos/crm/transacao.ts
  - apps/api/src/testes/banco-crm.ts
  - apps/web/CONTEXT.md
  - apps/web/package.json
  - apps/web/src/app/(shell)/crm/contatos/[contato]/page.tsx
  - apps/web/src/app/(shell)/crm/contatos/page.tsx
  - apps/web/src/app/(shell)/crm/empresas/[empresa]/page.tsx
  - apps/web/src/app/(shell)/crm/empresas/page.tsx
  - apps/web/src/app/(shell)/crm/funis/[funil]/page.tsx
  - apps/web/src/app/(shell)/crm/funis/page.tsx
  - apps/web/src/app/(shell)/crm/negocios/[negocio]/page.tsx
  - apps/web/src/app/(shell)/crm/negocios/page.tsx
  - apps/web/src/dados/crm/cliente-crm.test.ts
  - apps/web/src/dados/crm/cliente-crm.ts
  - apps/web/src/dados/crm/contatos.test.ts
  - apps/web/src/dados/crm/contatos.ts
  - apps/web/src/dados/crm/empresas.test.ts
  - apps/web/src/dados/crm/empresas.ts
  - apps/web/src/dados/crm/funis.test.ts
  - apps/web/src/dados/crm/funis.ts
  - apps/web/src/dados/crm/negocios.test.ts
  - apps/web/src/dados/crm/negocios.ts
  - apps/web/src/dados/crm/sessao.ts
  - apps/web/src/features/crm/cartao-de-negocio.tsx
  - apps/web/src/features/crm/ciclo-de-vida.tsx
  - apps/web/src/features/crm/create-record-dialog.tsx
  - apps/web/src/features/crm/dialogo-de-encerramento.test.tsx
  - apps/web/src/features/crm/dialogo-de-encerramento.tsx
  - apps/web/src/features/crm/dialogos-de-funil.test.tsx
  - apps/web/src/features/crm/editor-de-campos-adicionais.tsx
  - apps/web/src/features/crm/editor-de-enderecos.tsx
  - apps/web/src/features/crm/etapas-do-funil.tsx
  - apps/web/src/features/crm/ficha-de-contato.test.tsx
  - apps/web/src/features/crm/ficha-de-contato.tsx
  - apps/web/src/features/crm/ficha-de-empresa.test.tsx
  - apps/web/src/features/crm/ficha-de-empresa.tsx
  - apps/web/src/features/crm/ficha-de-funil.test.tsx
  - apps/web/src/features/crm/ficha-de-funil.tsx
  - apps/web/src/features/crm/ficha-de-negocio.test.tsx
  - apps/web/src/features/crm/ficha-de-negocio.tsx
  - apps/web/src/features/crm/formulario-de-contato.test.tsx
  - apps/web/src/features/crm/formulario-de-contato.tsx
  - apps/web/src/features/crm/formulario-de-empresa.test.tsx
  - apps/web/src/features/crm/formulario-de-empresa.tsx
  - apps/web/src/features/crm/formulario-de-funil.test.tsx
  - apps/web/src/features/crm/formulario-de-funil.tsx
  - apps/web/src/features/crm/formulario-de-negocio.tsx
  - apps/web/src/features/crm/legado/ficha-de-contato-legado.tsx
  - apps/web/src/features/crm/legado/ficha-de-empresa-legado.tsx
  - apps/web/src/features/crm/migrate-funnel-dialog.tsx
  - apps/web/src/features/crm/negocios-do-registro.test.tsx
  - apps/web/src/features/crm/negocios-do-registro.tsx
  - apps/web/src/features/crm/paginas-de-empresa.test.tsx
  - apps/web/src/features/crm/quadro-do-funil.test.tsx
  - apps/web/src/features/crm/quadro-do-funil.tsx
  - apps/web/src/features/crm/remove-stage-dialog.tsx
  - apps/web/src/features/crm/seletor-de-proprietario.tsx
  - apps/web/src/features/crm/seletor-de-registro.tsx
  - apps/web/src/features/crm/vinculos-da-empresa.tsx
  - package-lock.json
  - packages/dominio/CONTEXT.md
  - packages/dominio/src/crm/comum.ts
  - packages/dominio/src/crm/contatos.test.ts
  - packages/dominio/src/crm/contatos.ts
  - packages/dominio/src/crm/empresas.test.ts
  - packages/dominio/src/crm/empresas.ts
  - packages/dominio/src/crm/funis.test.ts
  - packages/dominio/src/crm/funis.ts
  - packages/dominio/src/crm/negocios.test.ts
  - packages/dominio/src/crm/negocios.ts
  - packages/dominio/src/crm/normalizacao.test.ts
  - packages/dominio/src/crm/normalizacao.ts
  - packages/dominio/src/crm/permissoes.test.ts
  - packages/dominio/src/crm/permissoes.ts
findings:
  critical: 0
  warning: 4
  info: 8
  total: 12
status: issues_found
---

# Fase 07: Relatório de Revisão de Código

**Revisado em:** 2026-10-11T17:25:30Z
**Profundidade:** standard
**Arquivos revisados:** 115
**Status:** issues_found

## Resumo

Foram lidos integralmente o domínio (`packages/dominio/src/crm/*`), a migração `007-crm.sql`, os repositórios, serviços e rotas de `apps/api`, a camada de dados e os componentes/páginas de `apps/web` da Fase 7. Os dois arquivos de `legado/` foram conferidos por `diff` contra as páginas de origem em `00db2064`: só a assinatura mudou (`params` → prop), e por isso não foram revisados em profundidade. No `package-lock.json` as entradas de `swr@2.5.1` e `use-sync-external-store@1.7.0` estão consistentes com `apps/web/package.json`. Como pedido, os achados do `07-SECURITY.md` (isolamento por `workspace_id`, `.strict()`, `ilike` escapado, nome de constraint fora do corpo) não foram repetidos; o foco foi correção, integridade transacional, tratamento de erro, concorrência e manutenibilidade.

Avaliação geral: a arquitetura está coerente com o `CONTEXT.md` raiz (as mesmas funções de validação rodam na tela e no serviço; o serviço pré-checa e o SQLSTATE traduzido é a rede). Não encontrei defeito que corrompa dado ou quebre o fluxo principal — nenhum achado Critical. Os quatro avisos são: (1) uma data bem formada mas inexistente atravessa o zod e estoura em `::date` como 500; (2) duas corridas sem rede no banco (último admin da Empresa e ciclo de matriz); (3) ordem de travamento invertida em `definirPadrao` e em `migrarNegocios`, que pode terminar em deadlock e 500; (4) as fichas de Contato e Empresa enviam `proprietarioId` mesmo sem mudança, o que faz uma edição qualquer falhar com 409 se o Proprietário deixou de ser Membro ativo. Os itens Info são inconsistências e duplicações de manutenção.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: Data bem formada mas inexistente vira 500 em `::date` (dataNascimento, inicio e fim do vínculo)

**File:** `apps/api/src/rotas/crm/comum.ts:32`, `apps/api/src/rotas/crm/contatos.ts:61`, `apps/api/src/rotas/crm/empresas.ts:116`, `apps/api/src/rotas/crm/empresas.ts:129`, `apps/api/src/repositorios/crm/contatos.ts:255`, `apps/api/src/repositorios/crm/contatos.ts:270`, `apps/api/src/repositorios/crm/vinculos.ts:215`, `apps/api/src/repositorios/crm/vinculos.ts:264`
**Issue:** `DATA_CIVIL` só confere a forma `^\d{4}-\d{2}-\d{2}$`. Um corpo com `"dataNascimento": "2024-13-45"`, `"inicio": "2024-02-31"` ou `"fim": "2024-00-10"` passa pelo zod, nenhum serviço de Contato ou de Empresa valida o calendário (diferente de Negócio, que tem `validarDataPrevista` no domínio), e o valor chega em `$4::date` / `$6::date` / `$3::date`. O Postgres lança `22008` (`date/time field value out of range`), que não está em `SQLSTATE_TRADUZIVEIS` de `transacao.ts:23`, então `comTransacao` relança e o `setErrorHandler` responde `500 Erro interno.` para um erro de entrada do cliente — e o log do processo recebe stack de um caso que deveria ser 400. A tela usa `input type="date"` no Contato, mas a api é pública para qualquer cliente e o vínculo recebe texto livre.
**Fix:** Exportar a checagem de calendário no domínio e usá-la nos três pontos (ou num `refine` de `DATA_CIVIL`), por exemplo:
```ts
// packages/dominio/src/crm/comum.ts
export function validarDataCivil(data: string, campo: string): OperationResult<void> {
  const [ano, mes, dia] = data.split("-").map(Number);
  const d = new Date(Date.UTC(ano ?? 0, (mes ?? 1) - 1, dia ?? 1));
  const existe = /^\d{4}-\d{2}-\d{2}$/.test(data) && d.getUTCFullYear() === ano && d.getUTCMonth() === (mes ?? 1) - 1 && d.getUTCDate() === dia;
  return existe ? ok(undefined) : fail("Use uma data válida no formato AAAA-MM-DD.", campo);
}
// apps/api/src/rotas/crm/comum.ts
export const DATA_CIVIL = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((d) => validarDataCivil(d, "data").ok, "Use uma data válida no formato AAAA-MM-DD.");
```
e fazer `validarDataPrevista` de `negocios.ts` delegar para a mesma função.

### WR-02: Duas corridas entre agregados sem rede no banco: último admin da Empresa e ciclo de matriz

**File:** `apps/api/src/servicos/crm/contatos.ts:404-412`, `apps/api/src/servicos/crm/empresas.ts:667-671`, `apps/api/src/servicos/crm/empresas.ts:683-687`, `apps/api/src/repositorios/crm/vinculos.ts:63-85`, `apps/api/migracoes/007-crm.sql:263-277`, `apps/api/src/servicos/crm/empresas.ts:549-552`
**Issue:** O cabeçalho de `transacao.ts` promete que "o SQLSTATE é a rede contra a corrida", mas há dois casos em que a pré-checagem roda sob o lock de um agregado e a escrita conflitante sob o lock de outro, e o banco não segura nenhum dos dois:
1. `contatos.enviarParaLixeira` trava só a linha do Contato A e chama `empresasEmQueEhUnicoAdmin` (que ignora outro admin `na_lixeira`); em paralelo `empresas.editarVinculo`/`encerrarVinculo` trava só a Empresa E e roda `validarRetiradaDeAdmin` sobre `listarDaEmpresa`, onde A ainda aparece `ativo`. As duas transações passam, as duas commitam, e E fica `ativo` tendo como único admin vigente um Contato na lixeira — o estado que `adminsVigentes` (domínio) define como "sem admin". O constraint trigger `crm_confere_admin` não vê `contatos.estado`, então não recusa. Depois disso a tela mostra a Empresa sem admin e "Trocar admin" é o único caminho.
2. `empresas.editar` valida a matriz com `ancestraisDe` sem travar a matriz candidata. Duas edições simultâneas (E1.matriz = E2 e E2.matriz = E1) passam na validação e commitam um ciclo; `ancestraisDe` só não trava por causa do teto de 50 níveis, e `detalhar`/`filiaisDe` passam a mostrar hierarquia circular.
**Fix:** Serializar pelo lado da Empresa nos dois casos: em `enviarParaLixeira`/`excluirPermanentemente` de Contato, travar as Empresas em que ele é admin vigente antes da pré-checagem (`select e.id from plataforma.empresas e join plataforma.contato_empresa v ... where v.contato_id = $2 and v.admin and v.fim is null for update of e`) e só então chamar `empresasEmQueEhUnicoAdmin`; em `conferirMatriz`, ler a matriz candidata com `obter(..., { travar: true })` e, no caso de edição, travar também a própria Empresa (já travada por `escrita`) — assim duas edições cruzadas se enfileiram e a segunda enxerga o ciclo. Alternativa mais forte para o caso 1: estender `crm_confere_admin` na 007 (ou numa 008) para exigir `oc.estado <> 'na_lixeira'` no `exists` e disparar também em `update of estado on contatos`.

### WR-03: Ordem de travamento invertida em `definirPadrao` e em `migrarNegocios` pode terminar em deadlock (40P01) e 500

**File:** `apps/api/src/servicos/crm/funis.ts:302-316`, `apps/api/src/servicos/crm/funis.ts:503-507`, `apps/api/src/servicos/crm/funis.ts:147-169`, `apps/api/src/servicos/crm/transacao.ts:23`
**Issue:** `definirPadrao` passa por `escrita`, que trava a linha do Funil alvo (`for update`) ANTES de `travarPadrao` (advisory lock por Espaço) e antes do retorno antecipado `if (funil.padrao)`. Cenário: T1 chama `POST /funis/F0/padrao` com F0 já padrão (a tela esconde o botão, mas a api aceita) — trava F0, espera o advisory; T2 chama `POST /funis/F1/padrao` — trava F1, pega o advisory, e `desmarcarPadrao` tenta atualizar F0, que T1 segura. T1 espera T2, T2 espera T1: o Postgres aborta uma das duas com `40P01`, que não é traduzido e vira `500 Erro interno.`. `migrarNegocios` tem o mesmo padrão com dois Funis: A→B e B→A simultâneos travam origem e destino em ordens opostas.
**Fix:** Em `definirPadrao`, pegar o advisory antes da linha: fazer a transação chamar `repositorio.travarPadrao(ws)` como primeira instrução (passar a `escrita` uma opção `antesDeTravar`, ou não usar `escrita` nesta ação) e mover o `if (funil.padrao) return` para antes de qualquer lock adicional. Em `migrarNegocios`, travar os dois Funis em ordem determinística (`[funil.id, entrada.paraFunilId].sort()`), ou reutilizar `travarPadrao`-like advisory por Espaço para serializar migrações. Além disso, traduzir `40P01` e `40001` em `transacao.ts` para `409` com "Outra operação mexeu neste Funil ao mesmo tempo. Tente de novo." — é a mesma categoria de "rede contra a corrida" que o arquivo já documenta.

### WR-04: As fichas de Contato e Empresa enviam `proprietarioId` em toda edição, e uma edição qualquer falha com 409 se o Proprietário deixou de ser Membro ativo

**File:** `apps/web/src/features/crm/formulario-de-contato.tsx:139`, `apps/web/src/features/crm/ficha-de-contato.tsx:96`, `apps/web/src/features/crm/ficha-de-empresa.tsx:151`, `apps/api/src/servicos/crm/contatos.ts:284-288`, `apps/api/src/servicos/crm/empresas.ts:537-541`
**Issue:** `valoresDoContato` e `valoresDeEdicao` pré-preenchem `proprietarioId` com o atual, e `montarEdicaoDeContato` (`contatos.tsx:139`) e o `editarEmpresa` da ficha (`empresa.tsx:151`) o incluem no `PATCH` mesmo sem mudança. No serviço, `entrada.proprietarioId !== undefined` dispara `resolverProprietario`, que exige Membro `ativo` do Espaço. Quando o Proprietário foi suspenso/removido depois do cadastro, qualquer "Salvar alterações" (até trocar só a descrição) responde `409 PROPRIETARIO_INVALIDO` apontando para um campo que a pessoa não tocou — e o `SeletorDeProprietario` com `rotuloVazio={null}` nem lista o id atual, então o `Select` fica sem opção correspondente. A ficha de Negócio já faz o certo (`montarEdicaoDeNegocio` só manda o que mudou, `ficha-de-negocio.tsx:217`).
**Fix:** Nos dois montadores, enviar `proprietarioId` só quando diferente do atual:
```ts
// formulario-de-contato.tsx — montarEdicaoDeContato(valores, identificadoresExistentes, proprietarioAtual)
...(valores.proprietarioId !== "" && valores.proprietarioId !== proprietarioAtual ? { proprietarioId: valores.proprietarioId } : {}),
// ficha-de-empresa.tsx — DialogoDeEdicao.salvar
...(valores.proprietarioId !== empresa.proprietarioId ? { proprietarioId: valores.proprietarioId } : {}),
```
e, no `SeletorDeProprietario`, incluir a opção do id atual (rotulada com o nome do store, ou "Membro inativo") quando ele não estiver entre os ativos, para o `Select` nunca ficar sem valor.

## Info

### IN-01: `inserir` de Contato e de Empresa grava `""` onde `atualizar` grava `null`

**File:** `apps/api/src/repositorios/crm/contatos.ts:182-192`, `apps/api/src/repositorios/crm/contatos.ts:246`, `apps/api/src/repositorios/crm/empresas.ts:192-198`, `apps/api/src/repositorios/crm/empresas.ts:179`
**Issue:** Os dois repositórios documentam "texto vazio é sem valor no banco" e aplicam `textoOuNulo` no `UPDATE`, mas o `INSERT` usa `linha.nome ?? null` sem passar pelo mesmo filtro. `TEXTO_CURTO` do zod faz `trim()` mas aceita `""`, então `POST /contatos { nome: "", identificadores: [...] }` grava `nome = ''` (a ficha mostra célula vazia em vez de "—"), enquanto um `PATCH` com o mesmo valor grava `NULL`. Além disso `contatos.ts:246` devolve o texto sem `trim()` enquanto `funis.ts:197` e `negocios.ts:152` devolvem aparado.
**Fix:** Aplicar `textoOuNulo` também nas colunas de texto do `INSERT` (nome, sobrenome, idioma, fusoHorario, descricao, origem, qualificacao / nomeFantasia, razaoSocial, descricao, origem) e unificar o helper nos três repositórios (um só, em `sql.ts`, que apare e anule).

### IN-02: Três derivações diferentes do "Identificador principal" do Contato

**File:** `apps/api/src/repositorios/crm/contatos.ts:249`, `apps/api/src/repositorios/crm/negocios.ts:158-163`, `apps/api/src/servicos/crm/negocios.ts:178`, `apps/api/src/repositorios/crm/vinculos.ts:167`
**Issue:** A lista de Contatos usa `email_principal ?? telefone_principal`; a lista de Negócios usa uma subconsulta `order by (tipo = 'email') desc, criado_em limit 1` (qualquer tipo principal, inclusive WhatsApp/Instagram); `detalhar` em `servicos/crm/negocios.ts` usa `principal email ?? qualquer principal`. Um Contato só com WhatsApp aparece como "Contato sem nome" na lista de Contatos e nos vínculos, mas com o número no quadro e na ficha do Negócio.
**Fix:** Escolher uma regra (a do domínio, `nomeDeExibicaoDoContato`, recebe um único identificador) e centralizar a subconsulta num fragmento SQL compartilhado em `sql.ts`, usado por `contatos.listar`, `vinculos.listarDaEmpresa` e `negocios.listar`.

### IN-03: `pais` do Identificador de Empresa é validado de forma diferente no domínio e na borda

**File:** `packages/dominio/src/crm/empresas.ts:161-162`, `apps/api/src/rotas/crm/empresas.ts:53`, `apps/web/src/features/crm/ficha-de-empresa.tsx:313-323`
**Issue:** O domínio só exige país não vazio e o põe em maiúsculas; a rota exige `length(2)`. Na ficha de Empresa, "Adicionar Identificador" com documento fiscal e país "BRA" passa na pré-validação do domínio e volta da api como `400 Entrada inválida: ...` genérico, no `Toast`, em vez de no campo — exatamente o que o formulário de criação (`formulario-de-empresa.tsx:127`) evita com uma regex própria.
**Fix:** Mover a regra para o domínio (`/^[A-Z]{2}$/` em `validarIdentificadorDeEmpresa`, com `field: "pais"`) e deixar a rota só espelhá-la; tirar a regex duplicada de `montarNovaEmpresa`.

### IN-04: Comentários de `comum.ts` apontam para linhas erradas da 007

**File:** `packages/dominio/src/crm/comum.ts:10-12`, `apps/api/migracoes/007-crm.sql:72-74`, `apps/api/migracoes/007-crm.sql:421`
**Issue:** O cabeçalho diz "`EstadoCrm` → `contatos_estado_ck` (007:69)", "`ModoDeCriacao` (007:70-71)" e "`SituacaoNegocio` (007:404)"; na migração as constraints estão nas linhas 72, 73-74 e 421. Referência por número de linha num arquivo imutável envelhece a cada edição do topo.
**Fix:** Referenciar pelo nome da constraint (já é feito) e tirar os números de linha.

### IN-05: `window.location.pathname` lido durante o render em três hooks de URL

**File:** `apps/web/src/features/crm/create-record-dialog.tsx:31`, `apps/web/src/features/crm/migrate-funnel-dialog.tsx:38`, `apps/web/src/features/crm/remove-stage-dialog.tsx:38`
**Issue:** Os três hooks fazem `typeof window === "undefined" ? "" : window.location.pathname` em vez de `usePathname()`, que as páginas vizinhas já usam (`contatos/page.tsx:71`). Funciona, mas é um valor lido fora do ciclo do React (não reage à navegação do App Router, só ao re-render) e difere do padrão do resto do código.
**Fix:** `const pathname = usePathname();` nos três.

### IN-06: Duplicação entre os três `page.tsx` de lista e entre as fichas

**File:** `apps/web/src/app/(shell)/crm/contatos/page.tsx:64-121`, `apps/web/src/app/(shell)/crm/empresas/page.tsx:73-189`, `apps/web/src/app/(shell)/crm/funis/page.tsx:43-87`, `apps/web/src/features/crm/ficha-de-contato.tsx:143`, `apps/web/src/features/crm/ficha-de-empresa.tsx:282`, `apps/web/src/features/crm/ficha-de-negocio.tsx:114`, `apps/web/src/features/crm/negocios-do-registro.tsx:41`, `apps/web/src/features/crm/quadro-do-funil.tsx:62`, `apps/web/src/features/crm/migrate-funnel-dialog.tsx:55`, `apps/web/src/features/crm/remove-stage-dialog.tsx:55`, `apps/api/src/rotas/crm/empresas.ts:48`, `apps/api/src/rotas/crm/funis.ts:35`, `apps/api/src/rotas/crm/negocios.ts:35`
**Issue:** `estadoDaUrl`, `VAZIO_POR_ESTADO`, o `useEffect` de espera da busca, `agir` e `trocarEstado` são copiados nas três listas; `LinhaDeDado` existe em três fichas; `PILULA_DA_SITUACAO` em três arquivos; `plural` em dois diálogos; e cada rota da api redeclara `const ID = z.string().min(1).max(64)` que já existe em `PARAMS_ID` de `comum.ts`. Uma mudança de regra (por exemplo, o teto do id ou a frase de vazio) precisa ser feita em vários lugares.
**Fix:** Extrair `useEstadoDaUrl`/`useBuscaComEspera` e `AcoesDaLinhaDeLista` para `features/crm/`, `LinhaDeDado` e `PILULA_DA_SITUACAO` para um módulo de apresentação compartilhado, `plural` para `shell/format`, e exportar `ID` de `rotas/crm/comum.ts`.

### IN-07: Totais do quadro somam valores de moedas diferentes como BRL

**File:** `apps/web/src/features/crm/quadro-do-funil.tsx:67-95`, `apps/web/src/features/crm/quadro-do-funil.tsx:281-289`, `apps/web/src/app/(shell)/crm/negocios/page.tsx:39-40`
**Issue:** `totaisDoQuadro` e `valorDaColuna` somam `negocio.valor` de todos os abertos e formatam o resultado como `MOEDA_DOS_TOTAIS = "BRL"`, embora a api aceite qualquer `moeda` ISO (`negocios.ts:37`) e o formulário permita digitá-la. Um Negócio de USD 1.000 entra no cabeçalho como R$ 1.000.
**Fix:** Somar só os Negócios em BRL (ou por moeda, mostrando uma linha por moeda) e, enquanto a moeda não vem de catálogo, indicar no cabeçalho "em BRL; N Negócios em outras moedas não somados".

### IN-08: `chamarCrm` concatena `NEXT_PUBLIC_API_URL` sem conferir que existe

**File:** `apps/web/src/dados/crm/cliente-crm.ts:64`
**Issue:** Com a variável ausente, a URL vira `undefined/contatos?...` e o erro que chega à tela é "Sem conexão com o servidor." ou um 404 do próprio Next, o que esconde um erro de configuração do deploy.
**Fix:** Ler a base uma vez no módulo e falhar cedo: `const BASE = process.env.NEXT_PUBLIC_API_URL; if (!BASE) throw new Error("NEXT_PUBLIC_API_URL não configurada.");` (ou devolver `ErroDeApi(0, "A api não está configurada neste ambiente.")`).

---

_Revisado em: 2026-10-11T17:25:30Z_
_Revisor: Claude (gsd-code-reviewer)_
_Profundidade: standard_
