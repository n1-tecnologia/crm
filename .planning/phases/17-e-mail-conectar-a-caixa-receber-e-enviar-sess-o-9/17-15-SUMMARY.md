---
phase: 17-e-mail-conectar-a-caixa-receber-e-enviar-sess-o-9
plan: 15
subsystem: web
tags: [email, compositor, assunto, copias, anexos, iframe, sandbox, csp, swr, tdd]

requires:
  - phase: 17-e-mail-conectar-a-caixa-receber-e-enviar-sess-o-9
    provides: "17-01 NovaMensagem.assunto/enderecosAdicionais, maxAnexosDoCanal, validarTamanhoDoEmail, assuntoDaResposta, Mensagem.corpoHtml/remetenteExterno; 17-07 POST /mensagens com assunto, copias e ate 10 arquivos; 17-11 GET /mensagens/:id/corpo-html (HTML ja limpo)"
provides:
  - "CamposDoEmail (Assunto, Para, Copia, Copia oculta) e enderecosDosCampos: varios enderecos por campo, cada um por normalizarEmail do dominio"
  - "O envio pelo fio leva assunto (pre-preenchido com Re: + o da ultima recebida) e enderecosAdicionais ao POST /mensagens, so no Canal com hasSubjectAndCopies"
  - "Compositor com lista de arquivos: ate maxAnexosDoCanal, soma conferida em 20 MB antes de qualquer ticket; os outros Canais seguem com um arquivo"
  - "useCorpoHtml + CorpoDoEmail: o e-mail formatado numa moldura iframe isolada (sandbox vazio, srcDoc, no-referrer, CSP no documento)"
  - "O fio mostra De:, Assunto, Para, Copia e Copia oculta de cada e-mail"
affects: [17-16]

actuals:
  tokens: 13900
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "HTML de terceiro so entra num iframe sandbox='' com srcDoc: texto de atributo, nunca no DOM da aplicacao"
    - "A CSP do documento isolado e a PRIMEIRA coisa do srcDoc, sem tocar cabecalho global do Next"
    - "Campo que o Canal nao tem nao aparece nem e enviado (assunto, copias, varios arquivos): a regra e a capacidade do Canal"

key-files:
  created:
    - apps/web/src/features/crm/campos-do-email.tsx
    - apps/web/src/features/crm/campos-do-email.test.tsx
    - apps/web/src/features/crm/corpo-do-email.tsx
    - apps/web/src/features/crm/corpo-do-email.test.tsx
  modified:
    - apps/web/src/features/crm/conversation-thread.tsx
    - apps/web/src/features/crm/conversation-thread.test.tsx
    - apps/web/src/dados/crm/mensagens.ts
    - apps/web/src/dados/crm/mensagens.test.ts

key-decisions:
  - "Os campos do e-mail so aparecem numa Conversa que ja existe: a primeira Mensagem de uma Conversa nova sai por POST /conversas, que e strict e nao leva assunto nem copias; mostrar o campo ali seria prometer um envio que nao acontece"
  - "Endereco invalido e conferido ao clicar em Enviar, ANTES do dialogo de confirmacao, com a frase ao lado do campo (aria-invalid + aria-describedby); enviar() confere de novo como rede de seguranca"
  - "O arquivo que estouraria o limite (10 arquivos ou 20 MB) nao entra na lista e a frase aparece na hora, antes de qualquer ticket; o envio confere a soma de novo"
  - "O botao Remover so ganha aria-label (Remover <nome>) quando ha mais de um arquivo: com um so segue Remover, como os testes do 16-11 exigem"
  - "O srcDoc COMECA pela meta da CSP (sem doctype), como o plano manda: o documento fica em quirks mode, aceito em troca da CSP vir antes de qualquer conteudo do e-mail"
  - "Cor so por palavras-chave do sistema (Canvas, CanvasText) com color-scheme: light dentro da moldura: sem cor literal (o verificador de tokens passa) e legivel no tema escuro"

patterns-established:
  - "A moldura do e-mail nao permite que link abra (sandbox sem permissao): preco aceito de nada rodar la dentro"

requirements-completed: [EML-05, EML-03]

duration: 10min
completed: 2026-11-19
status: complete
plan_head_before: b09337d6cbfe2a5d432acb9194e8f39d3f83667e
plan_head_after: 2982d3fad7d6ea5b64c83b74dd9c9ec0efba4e04
commits: 6

coverage:
  - id: D1
    description: "O compositor do e-mail mostra Assunto (Re: + o da ultima recebida), Para, Copia e Copia oculta e leva assunto e enderecosAdicionais ao POST /mensagens; sucesso limpa texto e copias e mantem o assunto; WhatsApp sem os campos e sem as chaves no corpo"
    requirement: EML-05
    verification:
      - kind: unit
        ref: "apps/web/src/features/crm/conversation-thread.test.tsx#(43)-(47) o e-mail leva assunto, copia e copia oculta ao servidor"
        status: pass
      - kind: unit
        ref: "apps/web/src/features/crm/campos-do-email.test.tsx"
        status: pass
    human_judgment: false
  - id: D2
    description: "Endereco invalido em Copia: Confira o endereco: x@ ao lado do campo, nada e enviado e o dialogo nao abre; endereco com quebra de linha nao passa"
    requirement: EML-05
    verification:
      - kind: unit
        ref: "apps/web/src/features/crm/conversation-thread.test.tsx#(46) endereco invalido em Copia"
        status: pass
      - kind: unit
        ref: "apps/web/src/features/crm/campos-do-email.test.tsx#enderecosDosCampos"
        status: pass
    human_judgment: false
  - id: D3
    description: "No e-mail ate 10 arquivos e 20 MB (exatos passam), com um ticket e um envio ao bucket por arquivo; a frase do teto vem antes de qualquer pedido; falha no bucket mantem a lista; os outros Canais continuam com um arquivo"
    requirement: EML-05
    verification:
      - kind: unit
        ref: "apps/web/src/features/crm/conversation-thread.test.tsx#(48)-(53) o e-mail leva ate 10 arquivos e 20 MB"
        status: pass
      - kind: unit
        ref: "apps/web/src/features/crm/conversation-thread.test.tsx#(34)-(42) o compositor anexa um arquivo de verdade (16-11)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Ver e-mail formatado pede GET /mensagens/:id/corpo-html e mostra o HTML limpo so numa moldura iframe com sandbox vazio, srcDoc, no-referrer, titulo E-mail formatado e a CSP default-src 'none' como primeira coisa do documento; sem corpoHtml nada e pedido"
    requirement: EML-03
    verification:
      - kind: unit
        ref: "apps/web/src/features/crm/corpo-do-email.test.tsx"
        status: pass
      - kind: unit
        ref: "apps/web/src/features/crm/conversation-thread.test.tsx#(55)-(56)"
        status: pass
      - kind: unit
        ref: "apps/web/src/dados/crm/mensagens.test.ts#useCorpoHtml (17-15, D-17-13)"
        status: pass
    human_judgment: true
  - id: D5
    description: "Nenhum HTML de e-mail entra no DOM da aplicacao: o <b> do corpo so existe dentro do srcDoc; o fonte nao tem permissao de sandbox nem HTML cru"
    requirement: EML-03
    verification:
      - kind: unit
        ref: "apps/web/src/features/crm/corpo-do-email.test.tsx#(4) e (9)"
        status: pass
    human_judgment: false
  - id: D6
    description: "O fio mostra Assunto, Para, Copia, Copia oculta de cada e-mail e De: quando quem escreveu nao e o Contato da Conversa (D-17-15)"
    requirement: EML-03
    verification:
      - kind: unit
        ref: "apps/web/src/features/crm/conversation-thread.test.tsx#(54), (57), (58)"
        status: pass
    human_judgment: false
---

# Phase 17 Plan 15: O e-mail na Caixa de Entrada Summary

**O compositor do e-mail leva assunto, cópias, cópia oculta e até 10 arquivos (20 MB) ao servidor, e o fio mostra assunto, cópias, "De:" e o e-mail formatado numa moldura `<iframe sandbox>` sem nenhuma permissão, com a CSP no próprio documento.**

## Performance

- **Duration:** 10 min
- **Tasks:** 3 (1 tracer + 2 auto, todas TDD)
- **Files:** 4 criados, 4 modificados (só `apps/web`)

## Accomplishments

- `campos-do-email.tsx`: `CamposDoEmail` controlado (rótulos "Assunto", "Para", "Cópia", "Cópia oculta") e `enderecosDosCampos`, que separa por vírgula ou ponto e vírgula, normaliza cada endereço por `normalizarEmail` e devolve "Confira o endereço: x@" por campo. Corrigir o campo tira o aviso.
- O fio troca o campo de assunto solto (que nunca chegava ao servidor, Pitfall 11) por `CamposDoEmail`: o assunto vem como `assuntoDaResposta` do da última recebida da página, editar prende a edição à Conversa, e o envio manda `assunto` e `enderecosAdicionais` (ordem Para, Cópia, Cópia oculta) só no Canal com `hasSubjectAndCopies`. Sucesso limpa texto e endereços e mantém o assunto.
- Compositor com lista de arquivos: `maxAnexosDoCanal(capacidades)` itens, `multiple` só quando o limite passa de 1, soma conferida com `validarTamanhoDoEmail` ao escolher e de novo antes do primeiro ticket; o envio sobe um ticket e um envio ao bucket por arquivo, em sequência, e manda todos no `POST /mensagens`. Falha num arquivo grava nada e mantém a lista.
- `useCorpoHtml` (SWR, só com `ativo`, sem revalidar no foco, 404/403 sem repetir) e `CorpoDoEmail`: botão "Ver e-mail formatado"/"Ocultar e-mail formatado", carregando e erro como texto, moldura `sandbox=""` + `srcDoc` + `referrerPolicy="no-referrer"` + título "E-mail formatado". O `srcDoc` começa pela `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'">`.
- `CabecalhoDoEmailNoFio`: "De:" (só quando `remetenteExterno` não é Identificador de e-mail do Contato), "Assunto:", "Para:", "Cópia:", "Cópia oculta:" acima do texto, tudo como texto do React.

## Task Commits

1. **Task 1 (tracer): responder pela Caixa leva assunto e cópias ao servidor**: RED `16dd5fb` (test), GREEN `27e578f` (feat)
2. **Task 2: vários arquivos até 20 MB no e-mail, um nos outros Canais**: RED `04e2bf3` (test), GREEN `f4d20d0` (feat)
3. **Task 3: assunto, cópias e o e-mail formatado isolado no fio**: RED `543114e` (test), GREEN `2982d3f` (feat)

**Portão do traçador:** o `<verify>` da Task 1 (`campos-do-email.test.tsx` + `conversation-thread.test.tsx` + `tsc`) foi re-rodado de ponta a ponta antes de expandir: passou (80 testes). `⚡ Tracer verified end-to-end — expanding`.

## Verification Results

Rodados da raiz do repositório, sem Postgres, sem servidor real, sem `npm install`:

- `npm run test -w @n1/web`: **148 arquivos, 1598 testes passando**, exit 0 (inclui os 66 testes anteriores do fio, intactos, e os 16 novos do fio de e-mail, 9 de `campos-do-email`, 9 de `corpo-do-email` e 4 de `useCorpoHtml`).
- `npm run typecheck -w @n1/web` (`tsc --noEmit`): exit 0.
- `npm run verificar:tokens` (raiz): `446 definidos · 431 arquivos varridos · 0 falhas`.
- `npm run lint -w @n1/web` (`eslint .`): 0 erros, 2 avisos que já existiam e não são destes arquivos (`features/ia/conhecimento/rotulos.ts` e `features/shell/app-shell.tsx`).
- `<automated>` de cada tarefa rodado como escrito (`npx vitest run …` em `apps/web` + `tsc`): passam. Acceptance: `Cópia oculta` em `campos-do-email.tsx` = 2, `CamposDoEmail` no fio = 3, `enderecosAdicionais` no fio = 1, `maxAnexosDoCanal` = 3, `validarTamanhoDoEmail` = 3, `sandbox` em `corpo-do-email.tsx` = 2, `allow-scripts` = 0, `dangerouslySetInnerHTML` = 0 nos dois arquivos, `default-src 'none'` = 2, `corpo-html` em `mensagens.ts` = 3.
- Não rodei `npm run check` da raiz (domínio e api não foram tocados) nem a falha já registrada em `deferred-items.md` (api, `whatsapp-cloud`), que não é deste plano.

## TDD

Os três pares RED (`test(17-15)`) e GREEN (`feat(17-15)`) existem, na ordem. O RED de cada par são testes do fio (`conversation-thread.test.tsx`) que falharam por asserção do comportamento planejado: 4 de 5 na Task 1 (o quinto, o WhatsApp, é negativo e já passava), 5 de 5 na Task 2, 3 de 5 na Task 3 (os 2 negativos já passavam). Os testes de unidade dos arquivos novos (`campos-do-email.test.tsx`, `corpo-do-email.test.tsx`) e de `useCorpoHtml` só falhariam por import ou função inexistente (INVALID_RED); por isso entram no commit GREEN junto da implementação, e o RED válido é o do fio. O plano é `type: execute`, sem gate de pares do plano; `workflow.tdd_mode` está `false`, então não rodei `gsd_run check tdd-red-evidence`.

## Deviations from Plan

### Escolhas dentro da lacuna do plano (nenhuma é defeito)

- **Campos do e-mail só numa Conversa que já existe.** O plano diz "numa Conversa de Canal com `hasSubjectAndCopies`". Sem Conversa, a primeira Mensagem sai por `abrirConversa` (`POST /conversas`, esquema `strict` sem assunto nem cópias). Antes deste plano os campos apareciam também ali, mas nada que se digitava chegava ao servidor (Pitfall 11); agora não aparecem, para não prometer um envio que não acontece. **Começar um e-mail do zero pela plataforma, com assunto e cópias, não existe nesta tela**: precisaria de `assunto` e `enderecosAdicionais` em `POST /conversas` (api e domínio), fora de `files_modified`. Fica para quem planejar o envio a frio.
- **Os campos antigos "Cc"/"Cco" viraram "Cópia"/"Cópia oculta"** e ganharam o campo "Para", como o plano manda. Nenhum teste existente os usava.
- **O 11º arquivo e o que estoura 20 MB não entram na lista** (a frase aparece na hora), em vez de entrarem e só falharem no envio; o envio confere a soma de novo.
- **Reenvio depois de falha num arquivo sobe todos de novo** (um ticket novo por arquivo): os objetos já subidos ficam órfãos e a coleta diária de órfãos os apaga. Não guardei os tickets antigos porque um ticket é de uso único no servidor.
- **`CabecalhoDoEmailNoFio` mora em `corpo-do-email.tsx`**, não no fio, para o fio (1.700 linhas) não crescer mais; é o único acréscimo fora da lista de funções do plano, e o arquivo já era da lista.
- **O limite "Uma Mensagem leva até N arquivos" (e não "Um e-mail…")** aparece para um Canal com mais de um arquivo e sem `hasSubjectAndCopies` (hoje, `chatDoSite`, que tem `multimodalInOneMessage`); o teto de 20 MB só vale com `hasSubjectAndCopies`, como na api.

**Total deviations:** nenhum auto-fix de Rule 1 a 3; nenhuma decisão de arquitetura (Rule 4) foi necessária.

## Known Stubs

Nenhum.

## Threat Flags

Nenhuma superfície nova além do `<threat_model>`. T-17-65 (XSS: HTML só no `srcDoc` de um `<iframe sandbox="">`, testes (2), (4) e (9) de `corpo-do-email.test.tsx`), T-17-66 (rastreamento: `img-src data:` e `referrerPolicy="no-referrer"`), T-17-67 (endereço digitado conferido por `normalizarEmail` aqui e de novo na api), T-17-68 (10 arquivos e 20 MB conferidos antes de subir) e T-17-SC (nenhum pacote novo) mitigados e provados.

## Limites conhecidos (não são defeitos)

- Um link dentro do e-mail formatado não abre: o `sandbox` sem permissão bloqueia janela nova e navegação. É o preço de uma moldura em que nada roda.
- O documento da moldura começa pela CSP, sem doctype: fica em quirks mode.
- **Não vi esta tela num navegador.** Tudo acima é provado por testes de componente (jsdom). Como o iframe `srcdoc` com CSP em `<meta>` se comporta de fato (CSP aplicada, imagem `data:` aparecendo, estilo embutido, sem requisição ao abrir) é verificação humana, e o jsdom não executa o `srcDoc`.

## Self-Check: PASSED

- Os 8 arquivos (4 criados, 4 modificados) existem; os commits `16dd5fb`, `27e578f`, `04e2bf3`, `f4d20d0`, `543114e` e `2982d3f` são ancestrais de HEAD; `git rev-list --count` desde `plan_head_before` = 6 (medido do ledger).

---
*Phase: 17-e-mail-conectar-a-caixa-receber-e-enviar-sess-o-9*
*Completed: 2026-11-19*
