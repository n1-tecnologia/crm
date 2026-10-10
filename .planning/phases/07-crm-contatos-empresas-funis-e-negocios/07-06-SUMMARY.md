---
phase: 07-crm-contatos-empresas-funis-e-negocios
plan: 06
subsystem: web-crm
tags: [next, react, swr, vitest, contatos, lixeira, ciclo-de-vida, d-09, d-15]

requires:
  - phase: 07-crm-contatos-empresas-funis-e-negocios
    provides: "07-01: chamarCrm/ErroDeApi/invalidarCrm e a lista /crm/contatos; 07-03: as 11 rotas REST de Contato, os 409 com bloqueios e o 400 VALOR_INVALIDO"
provides:
  - "dados/crm/contatos.ts: chaveDeContatos, useContatos, chaveDoContato, useContato e as 11 mutacoes de Contato, todas por chamarCrm e invalidando /contatos so no sucesso"
  - "dados/crm/sessao.ts: useMembrosAtivos, useNomeDoMembro, usePodeNoCrm (mesma podeNoCrm do dominio)"
  - "features/crm/ciclo-de-vida.tsx: seloDoEstado, AbasDeEstado, AcoesDeCicloDeVida, MensagemDeRecusa (links de bloqueios) - reaproveitaveis por Funis, Empresas e Negocios"
  - "features/crm/seletor-de-proprietario.tsx: SeletorDeProprietario (D-11)"
  - "features/crm/formulario-de-contato.tsx: FormularioDeContato, DialogoNovoContato, montarNovoContato, montarEdicaoDeContato"
  - "features/crm/editor-de-enderecos.tsx e editor-de-campos-adicionais.tsx (rascunho com erro de dominio)"
  - "features/crm/ficha-de-contato.tsx: FichaDeContato; features/crm/legado/ficha-de-contato-legado.tsx: a ficha antiga, movida com git mv"
  - "/crm/contatos com abas Ativos/Arquivados/Lixeira, busca e Mostrar mais; /crm/contatos/[contato] pela api com recuo para o modelo antigo"
affects: [07-07, 07-08, 07-09, 07-11, 07-12, 07-13]

actuals:
  tokens: 25000
  tasks: 3
  commits: 7
plan_head_before: 72f4de172ba6966ed0baeff58c60dc3eefc36c07
plan_head_after: abc24226253b2c1b1478bfde196d81ce154838ba
commits: 7

tech-stack:
  added: []
  patterns:
    - "Mutacao = gravar(caminho, verbo, corpo): chamarCrm -> invalidarCrm('/contatos') -> dados; a recusa sobe como ErroDeApi e nada invalida"
    - "Formulario como corpo controlado (valores/onChange/erros) mais montarNovoContato/montarEdicao que devolvem { ok, corpo | erros } com a validacao do dominio"
    - "Editor de rascunho: devolve (valor, erro?) e quem o usa decide quando gravar; secao da ficha remonta por key = JSON do valor do servidor"
    - "keepPreviousData no useContatos + conferencia do estado dos itens para nao piscar no Mostrar mais nem mostrar a aba errada"

key-files:
  created:
    - apps/web/src/dados/crm/contatos.ts
    - apps/web/src/dados/crm/contatos.test.ts
    - apps/web/src/dados/crm/sessao.ts
    - apps/web/src/features/crm/ciclo-de-vida.tsx
    - apps/web/src/features/crm/seletor-de-proprietario.tsx
    - apps/web/src/features/crm/formulario-de-contato.tsx
    - apps/web/src/features/crm/formulario-de-contato.test.tsx
    - apps/web/src/features/crm/editor-de-enderecos.tsx
    - apps/web/src/features/crm/editor-de-campos-adicionais.tsx
    - apps/web/src/features/crm/ficha-de-contato.tsx
    - apps/web/src/features/crm/ficha-de-contato.test.tsx
    - apps/web/src/features/crm/legado/ficha-de-contato-legado.tsx
  modified:
    - "apps/web/src/app/(shell)/crm/contatos/page.tsx"
    - "apps/web/src/app/(shell)/crm/contatos/[contato]/page.tsx"

key-decisions:
  - "FormularioDeContato e o CORPO controlado (valores, onChange, erros, comIdentificadores), sem botao de envio; criacao e edicao o embrulham num ConfirmDialog cada uma. O plano falava em valorInicial/onEnviar; a forma controlada deixa a validacao por campo e o estado de gravacao em quem envia"
  - "O que vai para a api e o que a pessoa digitou: o dominio so pre-valida (validarIdentificadorDeContato) e o servidor normaliza e e a autoridade (RN-CON-11 depende do valor canonico)"
  - "Os editores de Endereco e Campos adicionais sao de rascunho e devolvem (valor, erro?); a ficha grava por secao com 'Salvar enderecos' e 'Salvar campos adicionais' (verbo + substantivo, UI-SPEC), desligados com o motivo quando nada mudou, ha erro ou falta Papel"
  - "A lista usa keepPreviousData e confere item.estado === aba: Mostrar mais nao pisca o esqueleto, e trocar de aba nao mostra por um instante as linhas da outra"
  - "A ficha antiga saiu da rota por git mv num commit proprio (refactor) antes do RED da Task 3, para git log --follow ver o historico; a rota fica sem pagina entre ef1b5ad e abc2422"
  - "Tela so esconde (D-14): um unico motivo de escrita (usePodeNoCrm('editar')) alimenta todos os botoes da ficha, porque a matriz do dominio e a mesma para editar, arquivar, lixeira e restaurar"

patterns-established:
  - "MensagemDeRecusa: frase literal da api + listas Empresas afetadas / Filiais / Negocios afetados (e outros N) / Contato que ja usa este Identificador, links montados so pelo id"
  - "Ficha recebe o detalhado pronto por prop e a pagina le por useContato: a gravacao invalida /contatos e o dado novo volta pela mesma prop"
  - "Pagina de ficha: 404 da api verificado ANTES de data (cache velho nao sobrevive a uma exclusao externa); recuo legado so se o id existe em state.contacts"

requirements-completed: [CRM-W1]

duration: 13 min
completed: 2026-10-10
status: complete

coverage:
  - id: D1
    description: "Mutacoes de Contato por HTTP (rota certa de cada uma), invalidacao de /contatos so no sucesso e recusa com codigo e bloqueios"
    requirement: CRM-W1
    verification:
      - kind: unit
        ref: "apps/web/src/dados/crm/contatos.test.ts#(a) e (b)"
        status: pass
    human_judgment: false
  - id: D2
    description: "usePodeNoCrm/useMembrosAtivos/useNomeDoMembro com a mesma podeNoCrm do dominio (D-11, D-14)"
    requirement: CRM-W1
    verification:
      - kind: unit
        ref: "apps/web/src/dados/crm/contatos.test.ts#(c)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Formulario de Contato cria por POST /contatos com os Identificadores, pre-valida com o dominio e mostra a recusa 409 com o link do detentor sem fechar o dialogo"
    requirement: CRM-W1
    verification:
      - kind: unit
        ref: "apps/web/src/features/crm/formulario-de-contato.test.tsx#(a) e (b)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Editores de Endereco (principal unico, teto) e de Campos adicionais (chave vazia/repetida) recusam antes de enviar"
    requirement: CRM-W1
    verification:
      - kind: unit
        ref: "apps/web/src/features/crm/formulario-de-contato.test.tsx#(c)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Ficha nova: leitura (nome, Proprietario, Identificadores, Empresas), Tornar principal, edicao e Identificador novo, ciclo de vida com D-09 visivel, lixeira sem Editar, Convidado desligado, nada de Tags/Consentimentos/Mesclar"
    requirement: CRM-W1
    verification:
      - kind: unit
        ref: "apps/web/src/features/crm/ficha-de-contato.test.tsx#(a)-(h)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Recuo D-15: 404 da api com id do modelo antigo abre a ficha antiga; sem registro antigo mostra Contato nao encontrado"
    requirement: CRM-W1
    verification:
      - kind: unit
        ref: "apps/web/src/features/crm/ficha-de-contato.test.tsx#(i) e (j)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Lista /crm/contatos: abas de estado em ?estado=, busca com espera de 300 ms, Mostrar mais de 50 em 50, Restaurar/Excluir permanentemente na Lixeira, Novo Contato escondido sem permissao"
    requirement: CRM-W1
    verification:
      - kind: other
        ref: "tsc --noEmit, eslint e verificar:tokens; render temporario (apagado) da pagina cobriu aba Ativos, troca de aba e linha da Lixeira"
        status: pass
    human_judgment: true
    rationale: "Sem teste de pagina commitado e sem navegador real nesta rodada: o fluxo visual (layout, busca digitada, Mostrar mais, Toast) fica para a verificacao de fim de fase (human_verify_mode = end-of-phase)."
---

# Phase 7 Plan 06: Contatos no web sobre a api, com ficha nova e recuo para a antiga Summary

**As telas de Contato leem e gravam so por HTTP (`useContatos`/`useContato` + 11 mutacoes sobre `chamarCrm`), com abas Ativos/Arquivados/Lixeira, formulario completo, ficha enxuta sobre a 007 e a recusa D-09 aparecendo como frase literal mais links para cada Empresa e Negocio que bloqueia; ids do modelo antigo continuam abrindo a ficha antiga.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-10-10T02:54:53Z
- **Completed:** 2026-10-10T03:08:09Z
- **Tasks:** 3 (todas `tdd="true"`: RED -> GREEN, sem REFACTOR)
- **Files modified:** 14 (12 criados, 2 modificados; a ficha antiga entra como criacao do `git mv`)

## Accomplishments

- **Camada de dados:** `dados/crm/contatos.ts` (chaves que comecam por `/contatos`, `useContatos`, `useContato` que nao repete 4xx, e `criarContato`...`excluirContatoPermanentemente`) e `dados/crm/sessao.ts` (`usePodeNoCrm` usa a mesma `podeNoCrm` do dominio; a tela so esconde, o backend barra).
- **Pecas reaproveitaveis (Funis, Empresas, Negocios):** `AbasDeEstado`, `AcoesDeCicloDeVida` (Excluir = Lixeira com confirmacao, Excluir permanentemente com "nao pode ser desfeito", Arquivar sem confirmacao), `MensagemDeRecusa` e `SeletorDeProprietario`.
- **Lista:** abas em `?estado=`, busca com espera de 300 ms, "Mostrar mais" de 50 em 50 contra o servidor, contagem com plural, estados vazios por aba e por busca, linhas da Lixeira com Restaurar e Excluir permanentemente, "Novo Contato" primario e escondido para quem nao pode criar.
- **Formulario:** `DialogoNovoContato` com os 13 campos do contrato, um Identificador por tipo preenchido, erro de dominio no `Field` antes do `fetch`, recusa 409 por `MensagemDeRecusa` com o dialogo aberto e os campos preservados; `EditorDeEnderecos` e `EditorDeCamposAdicionais`.
- **Ficha:** dados, Identificadores (adicionar com validacao, tornar principal, marcar verificado, remover), Enderecos e Campos adicionais com salvar por secao, Empresas com cargo, "admin" e vigencia ("Vinculos encerrados" recolhido), edicao em dialogo sem Identificadores, ciclo de vida no cabecalho. Contato bloqueado (D-09) continua `ativo` na tela com a frase e os links.
- **Recuo D-15:** `FichaDeContatoLegado` (movida com `git mv`, historico preservado) abre quando a api responde 404 e o id existe em `state.contacts`.

## Task Commits

1. **Task 1: Mutacoes de Contato e pecas compartilhadas** - RED `0ca140c` (test) -> GREEN `98725ac` (feat)
2. **Task 2: Lista com abas e busca, formulario e editores** - RED `15b225e` (test) -> GREEN `2fe6354` (feat)
3. **Task 3: Ficha nova com a antiga como recuo** - mover `ef1b5ad` (refactor, `git mv`) -> RED `91e18f5` (test) -> GREEN `abc2422` (feat)

Base do plano (HEAD anterior ao primeiro commit): `72f4de172ba6966ed0baeff58c60dc3eefc36c07`. **Plan metadata:** commit `docs(07-06)` seguinte a este arquivo.

## Files Created/Modified

Ver `key-files` no frontmatter. Fora dele: nenhum arquivo do web importa o workspace da api (`grep -rl "@n1/api" apps/web/src` lista so um comentario antigo em `configuracoes/integracoes/page.tsx`, sem import).

## Decisions Made

Ver `key-decisions` no frontmatter. Em resumo: formulario como corpo controlado, o servidor normaliza e e a autoridade, editores de rascunho com erro de dominio, `keepPreviousData` com conferencia de estado, `git mv` em commit proprio e um unico motivo de escrita para a ficha.

## Deviations from Plan

### Auto-fixed Issues

None - nenhuma correcao de bug ou bloqueio alem do que as tarefas descrevem.

### Registros (divergencias de forma e de processo, sem mudanca de escopo)

1. **`FormularioDeContato` e controlado.** O plano dizia "com `valorInicial` e `onEnviar`"; o componente recebe `valores/onChange/erros/comIdentificadores` e nao tem botao de envio. Quem envia (o dialogo de criacao, o dialogo de edicao da ficha) embrulha em `ConfirmDialog`. `montarNovoContato` e `montarEdicaoDeContato` (exportados) concentram a pre-validacao do dominio.
2. **Assinaturas ampliadas, compativeis com o contrato.** `onChange` dos dois editores recebe `(valor, erro?)`; `AcoesDeCicloDeVida` aceita `compacto`, `avisoDaLixeira` e torna opcionais `onArquivar`/`onEnviarParaLixeira`/`onExcluirPermanentemente` (uma linha da Lixeira so restaura e exclui de vez); `AbasDeEstado` aceita `feminino` (Ativas/Arquivadas, para Empresas); `MensagemDeRecusa` aceita `acao` (botao "Migrar Negocios" do 07-07); `SeletorDeProprietario` aceita `rotuloVazio`, `disabled`.
3. **Copy segue a UI-SPEC onde difere do plano:** CTA "Criar Contato" (a 07-01 usava "Criar"), `emptyHint` da lista deixa de falar em Mensagem de Canal, "Novo Contato" passa a primario, rotulos "Salvar enderecos"/"Salvar campos adicionais" em vez de "Salvar" generico.
4. **Dois "Mostrar mais" na lista.** O `RecordList` do sistema fatia a tabela em 25 linhas com o proprio rodape; o botao da pagina (busca mais 50 no servidor) aparece abaixo enquanto `itens < total`. `RecordList` nao esta na lista de arquivos do plano e nao foi editado; um `pageSize` opcional nele resolveria a duplicidade (candidato para um plano de acabamento).
5. **Testes alem do plano, na mesma arquivo de teste:** `ficha-de-contato.test.tsx` ganhou (g) edicao com Proprietario, (h) Identificador novo com validacao e (i)/(j) a pagina `[contato]` nos dois ramos do 404 (o teste da pagina mora em `features/crm/` porque `app/` so guarda convencao de arquivo do Next). O caso (b) afirma `invalidarCrm('/contatos')` em vez de contar um segundo `GET`: o `mutate` global do SWR nao alcanca o cache isolado do `SWRConfig` do teste.
6. **Evidencia de RED.** Como em 07-02/07-03, o reporter TAP com falha de varias linhas (aqui, o dump de DOM do `@testing-library`) e rejeitado pelo classificador como `invalid_record`. Cada fase usou um alvo cuja falha e uma asserção de uma linha, executado isoladamente com `-t` (trecho sem parenteses, que seriam regex), e todos deram `RED_EVIDENCE_OK`: Task 1 "editarContato manda PATCH" (fetch 0 vezes), Task 2 "no teto de endereços" (`textContent` sem "Adicionar endereço"; precisei acrescentar essa asserção ao teste), Task 3 "(a) mostra nome..." (com `vi.waitFor` no lugar de `findBy`/`waitFor`, que anexam o dump). Os registros temporarios foram apagados antes de cada commit.
7. **RED com esqueleto.** Os RED levam esqueletos que compilam e erram (`contatos.ts`/`sessao.ts` devolvendo `undefined as never`; componentes devolvendo `null`); o GREEN os substitui.
8. **Rota sem pagina em 3 commits.** O `git mv` da ficha antiga (`ef1b5ad`) tira a pagina da rota ate `abc2422`; a divisao existe para `git log --follow` enxergar o historico (com a pagina nova no mesmo commit o git nao detecta a renomeacao). O estado final tem as duas.
9. **Guarda de branch protegida.** Como em 07-01..07-05, commits em `main` por decisao do orquestrador (`branching_strategy: none`).
10. **Verificacao no navegador nao feita** (ver coverage D7): a lista e a ficha foram exercitadas por teste de componente e por renders temporarios; nenhum `next dev` real nesta rodada.

**Total deviations:** 0 auto-fixed. **Impact:** nenhum no escopo; as assinaturas ampliadas servem os planos 07-07..07-13.

## Issues Encountered

- `-t "(c) ..."` com parenteses virou regex e nao casou nenhum teste (`unexpected_green` no classificador); resolvido com trecho do nome sem parenteses.
- Aceitacao literal `grep -rl "@n1/api" apps/web/src` nao e vazia por causa de um comentario pre-existente em `configuracoes/integracoes/page.tsx` (fora do escopo; nenhum import).

## User Setup Required

None - no external service configuration required. Nenhum pacote novo; nao houve Postgres nem container neste plano.

## Known Stubs

None. (A secao "Negocios" da ficha so chega no 07-11 e e dita no cabecalho do componente, nao renderizada como vazio.)

## Threat Flags

None - nenhuma superficie nova: sao so consumidores das rotas ja cobertas por 07-02/07-03. T-07-21 segurado: todo texto da api e texto React, links de `bloqueios` montados so com o `id`, nenhum `dangerouslySetInnerHTML`.

## Next Phase Readiness

- `ciclo-de-vida.tsx`, `sessao.ts` e `seletor-de-proprietario.tsx` estao prontos para Funis (07-07), Empresas (07-08/09) e Negocios (07-10/11); `MensagemDeRecusa` ja aceita `acao` para o botao de saida de uma recusa.
- A secao "Negocios" da ficha de Contato (`NegociosDoRegistro`) e do 07-11. O `SeletorDeRegistro` ainda nao existe (so o de Proprietario).

## Self-Check: PASSED

- Arquivos criados conferidos com `[ -f ]`: 12 de 12 presentes (ver abaixo).
- Commits na historia: `0ca140c`, `98725ac`, `15b225e`, `2fe6354`, `ef1b5ad`, `91e18f5`, `abc2422` (todos ancestrais de HEAD).
- Verificacao do plano: `cd apps/web && npx vitest run` = 41 arquivos, 365 testes verdes (`src/dados/crm src/features/crm` = 4 arquivos, 35 testes); `npm run typecheck`, `npm run lint` (0 erros, 3 avisos pre-existentes em `app-shell.tsx`/`rotulos.ts`) e `npm run verificar:tokens` verdes.
- Aceitacao: `MensagemDeRecusa`, `usePodeNoCrm`, `AbasDeEstado`, `SeletorDeProprietario`, `FichaDeContatoLegado` e `use(params)` presentes onde o plano manda; `git log --follow` mostra o historico da pagina antiga (`e97191d`, `fcf908c`...).
