---
phase: 17-e-mail-conectar-a-caixa-receber-e-enviar-sess-o-9
plan: 11
subsystem: api
tags: [email, html, sanitize-html, xss, rastreamento, idor, no-store, tdd]

requires:
  - phase: 17-e-mail-conectar-a-caixa-receber-e-enviar-sess-o-9
    provides: "17-06 Mensagem.corpoHtml ({ objectKey, tamanhoBytes }) lido pelo repositório; 17-07 ArmazenamentoDeAnexos.baixar com teto; 17-08 TETO_DO_HTML_GUARDADO_BYTES e o HTML guardado em entrada/; 17-02 sanitize-html instalado"
provides:
  - "html.ts: limparHtmlDoEmail(html) com sanitize-html (lista curta, sem style, imagem só data: raster, links com noopener noreferrer)"
  - "ServicoDeMensagens.corpoHtml(membro, id): lê o objeto do bucket pela chave de corpo_html e devolve só o HTML limpo"
  - "GET /mensagens/:id/corpo-html: JSON { ok, dados: { html } } com Cache-Control: no-store"
affects: [17-15, 17-16]

tech-stack:
  added: []
  patterns:
    - "O HTML hostil só é limpo na hora de SERVIR; o original nunca sai nem é logado"
    - "A rota devolve JSON, nunca text/html: nada é servido como página pelo domínio da api"

key-files:
  created:
    - apps/api/src/mensageria/provedores/email/html.ts
    - apps/api/src/mensageria/provedores/email/html.test.ts
    - apps/api/src/servicos/crm/mensagens-corpo-html.test.ts
  modified:
    - apps/api/src/servicos/crm/mensagens.ts
    - apps/api/src/rotas/crm/mensagens.ts
    - apps/api/src/rotas/crm/mensagens.test.ts

key-decisions:
  - "Sem style nem <style>: o e-mail perde parte da formatação, em troca de nenhum vetor de CSS (url(), @import, expression)"
  - "Imagem só data:image/(png|jpeg|gif|webp);base64: toda imagem remota, inclusive protocolo relativo, é pixel de rastreio e some; SVG some porque executa"
  - "Objeto acima do teto do leitor responde 404 SEM_CORPO_HTML; qualquer outra falha do bucket sobe como armazenamento_indisponivel (500 genérico, sem a chave), não como 404 mudo"
  - "Chave do HTML fora de workspace/<espaço da sessão>/ responde 404: rede de segurança igual à da URL do anexo"

patterns-established:
  - "O serviço decide o acesso (exigir ler mensagem, Espaço da sessão); a rota só põe o cabeçalho e formata"

requirements-completed: [EML-03]

duration: 14min
completed: 2026-11-19
status: complete
plan_head_before: 60823d71ebfc7ff0d220d9f3ad38b1cc4f091e82
plan_head_after: 627e43b93ecf643ce575730e9cd2b6f6b8f4add2
commits: 2

actuals:
  tokens: 5800
  tasks: 2
  commits: 2

coverage:
  - id: D1
    description: "GET /mensagens/:id/corpo-html devolve o HTML do bucket já limpo (sem script nem on*, link com rel e target) com Cache-Control: no-store, em JSON"
    requirement: EML-03
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/mensagens-corpo-html.test.ts#devolve o HTML guardado já limpo"
        status: pass
      - kind: unit
        ref: "apps/api/src/rotas/crm/mensagens.test.ts#(17-11) GET /mensagens/{id}/corpo-html"
        status: pass
    human_judgment: false
  - id: D2
    description: "Sem corpo_html, Mensagem de outro Espaço, chave fora do Espaço e objeto acima do teto respondem 404; quem não é Membro responde 403"
    requirement: EML-03
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/mensagens-corpo-html.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "A limpeza neutraliza script, iframe, object, embed, form, style, svg, math, meta refresh, base, link, imagem remota ou relativa ou svg, javascript: disfarçado, style, on*, aninhamento e mantém o texto escapado"
    requirement: EML-03
    verification:
      - kind: unit
        ref: "apps/api/src/mensageria/provedores/email/html.test.ts"
        status: pass
    human_judgment: false
---

# Phase 17 Plan 11: A limpeza do HTML do e-mail e a rota que a tela usa Summary

**`GET /mensagens/:id/corpo-html` lê o HTML guardado do e-mail recebido no bucket, passa-o por `sanitize-html` (lista curta, sem `style`, imagem só `data:` raster, link com `noopener noreferrer` e `_blank`) e devolve `{ html }` em JSON com `Cache-Control: no-store`, só a quem pode ler a Mensagem no Espaço da sessão.**

## Accomplishments

- `html.ts`: `limparHtmlDoEmail` na configuração da pesquisa (D-17-13): tags de texto, tabela, `a`, `img` e `hr`; atributos só `href`/`title` em `a`, `src`/`alt`/`width`/`height` em `img`, `colspan`/`rowspan` nas células; esquemas `http`, `https`, `mailto`, `tel`; `allowProtocolRelative: false`; `nestingLimit: 20`; `a` transformada com `rel` e `target` (sobrescreve o que o e-mail trouxer); `exclusiveFilter` que descarta `img` sem `data:image/(png|jpeg|gif|webp);base64,`. O comentário do topo diz por que sem `style`, por que só `data:` em imagem e que a segunda barreira é a moldura isolada da 17-15.
- `ServicoDeMensagens.corpoHtml`: `exigir(ler, mensagem)`, Mensagem e Conversa do Espaço da sessão (outro Espaço é 404, nunca 403), `corpoHtml` presente e com a chave dentro de `workspace/<espaço>/`, `armazenamento.baixar(chave, { tetoBytes: TETO_DO_HTML_GUARDADO_BYTES })`, UTF-8 e `limparHtmlDoEmail`. Nenhum log do HTML.
- Rota `GET /mensagens/:id/corpo-html` com `PARAMS_DE_MENSAGEM`, `Cache-Control: no-store` e `responder`.
- 47 testes de vetores em `html.test.ts` (sem banco) e 9 do serviço contra o Postgres, mais 1 de rota com serviço falso.

## Task Commits

1. **Task 1 (tracer): a Mensagem com HTML guardado devolve o HTML limpo pela rota; quem não pode ler recebe 404** - `2a32a20` (feat)
2. **Task 2: a limpeza resiste aos vetores conhecidos de XSS e de rastreamento** - `627e43b` (test)

**Portão do tracer:** os `mensagens-corpo-html.test.ts`, `mensagens.test.ts` (serviço) e `rotas/crm/mensagens.test.ts` passaram juntos com `tsc --noEmit` antes de expandir; liberado.

## Verification Results

Postgres 16 próprio (container `crm-n1-pg-1711`, porta 55753, migrado até a 017 com `npm run --silent migrar`, `DATABASE_URL` e `DATABASE_URL_MIGRACAO` apontando para ele; nenhum container `supabase_*` tocado; removido no fim). Nenhum `npm install`, credencial ou servidor de e-mail reais.

- Task 1: `mensagens-corpo-html.test.ts` (9), `servicos/crm/mensagens.test.ts` e `rotas/crm/mensagens.test.ts` (sem regressão nas suítes de `mensagens`) e `npx tsc --noEmit` em `apps/api`: passam (129 testes nos três arquivos).
- Task 2: `html.test.ts` com `DATABASE_URL=` vazio (47 testes) e `tsc`: passam.
- Rodada final dos quatro arquivos (`html`, `corpo-html`, serviço e rota de `mensagens`): 176 testes passam.
- Os `<automated>` não foram rodados literalmente: a porta é a 55753 pedida pelo orquestrador (o comando do plano usa 55738), com outro nome de container e os passos separados; são os mesmos comandos e arquivos. Não rodei o `npm test` completo da api, nem o `tsc` do domínio e da web (nenhum foi tocado). O repositório não tem `lint` para a api.
- Acceptance: `/mensagens/:id/corpo-html` na rota (1+), `no-store` (1+), `limparHtmlDoEmail` no serviço (1+), `allowProtocolRelative: false` em `html.ts` (1), `noopener noreferrer` (2), `javascript:` em `html.test.ts` (3).
- A falha já registrada em `deferred-items.md` (`whatsapp-cloud.test.ts`, 503 esperando `META_APP_SECRET`) não é deste plano e não foi tocada nem rodada.

## TDD

A implementação de `html.ts` foi escrita antes dos testes e a configuração da pesquisa passou nos 47 casos do `<behavior>` na primeira rodada (a única falha foi um teste meu: o texto `' onmouseover='` dentro de um `title` entre aspas duplas é valor, não atributo; corrigi o teste, não o código). Não há fase RED observada nem commit RED separado; o plano é `type: execute`, sem gate de pares RED/GREEN. Nenhuma alteração de configuração foi necessária na Task 2 (o plano previa ajustar só se um caso falhasse).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] O serviço falso da rota ganhou o novo método**
- **Found during:** Task 1 (`tsc`)
- **Issue:** `ServicoDeMensagens` passou a exigir `corpoHtml`, e o falso de `rotas/crm/mensagens.test.ts` não o tinha (erro de tipo).
- **Fix:** o falso ganhou `corpoHtml` e um teste novo da rota (401 sem token, repasse do Membro e do id, JSON e `Cache-Control: no-store`). O arquivo não estava na lista do plano.
- **Files modified:** `apps/api/src/rotas/crm/mensagens.test.ts`
- **Commit:** `2a32a20`

### Escolhas dentro da lacuna do plano

- Objeto ausente do bucket ou outra falha de leitura NÃO vira 404: sobe como `armazenamento_indisponivel: <código>` (a mesma regra de `noArmazenamento` do resto do serviço, sem a chave). Só "acima do teto do leitor" é 404 `SEM_CORPO_HTML`, como o plano manda.
- Rede de segurança extra, igual à do anexo: chave de `corpo_html` fora de `workspace/<Espaço da sessão>/` responde 404 `SEM_CORPO_HTML` sem tocar o bucket (provado com a linha adulterada).
- O Convidado lê (a regra é a de `listar` e da URL do anexo); quem não tem Papel no Espaço recebe 403 `PERMISSAO`.
- `a` permite `rel` e `target` na lista de atributos para o `transformTags` poder sobrescrevê-los; o teste prova que `rel="opener"` e `target="_top"` do próprio e-mail não sobrevivem.
- O `CONTEXT.md` de `mensageria` não foi alterado (fora de `files_modified`); a 17-16 pode registrar a rota.

**Total deviations:** 1 auto-fixed (Rule 3); nenhuma exigiu decisão do dono.

## Auth gates

Nenhum.

## Known Stubs

Nenhum.

## Threat Flags

Nenhuma superfície nova além do `<threat_model>`. T-17-41 (XSS: lista curta, sem `style`/script; 47 testes de vetores; a segunda barreira, a moldura `sandbox`, é a 17-15), T-17-42 (rastreamento: só imagem `data:` raster, remota, `http`, `//` e SVG somem), T-17-43 (IDOR: `exigir(ler)`, Espaço da sessão, 404 para outro Espaço e chave fora do Espaço), T-17-44 (`Cache-Control: no-store`) e T-17-SC (nenhum pacote novo) estão mitigados e provados.

## Self-Check: PASSED

- Arquivos criados e alterados existem (`html.ts`, `html.test.ts`, `mensagens-corpo-html.test.ts`, `servicos/crm/mensagens.ts`, `rotas/crm/mensagens.ts`, `rotas/crm/mensagens.test.ts`).
- Commits `2a32a20` e `627e43b` são ancestrais de `HEAD`.
