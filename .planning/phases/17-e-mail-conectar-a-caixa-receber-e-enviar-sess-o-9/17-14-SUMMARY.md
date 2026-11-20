---
phase: 17-e-mail-conectar-a-caixa-receber-e-enviar-sess-o-9
plan: 14
subsystem: web
tags: [email, conexao, oauth, senha-de-app, ficha-do-canal, retorno, next16, tdd]

requires:
  - phase: 17-e-mail-conectar-a-caixa-receber-e-enviar-sess-o-9
    provides: "17-05 POST /canais/:id/email/conectar, GET /canais/:id/email/conta e a recusa 422 CONEXAO_RECUSADA com campo; 17-12 e 17-13 POST /canais/:id/email/oauth/:servico/autorizar e POST /canais/email/oauth/concluir com as frases de recusa"
provides:
  - "PainelDoEmail: tres caminhos (Entrar com o Google, Entrar com a Microsoft, Outro servidor) e o formulario de Outro servidor com a predefinicao por nome"
  - "ContaDoEmailNaFicha: Conectada com endereco e jeito de entrar, ou Desconectada com o motivo da queda e Entrar de novo"
  - "predefinicaoDoEndereco e semASenha"
  - "dados/crm/canais.ts: conectarEmailPorSenha, useContaDoEmail, autorizarEmail, concluirConexaoDoEmail"
  - "A rota nova canais/email/retorno: conclui o login uma vez e limpa o endereco"
affects: [17-16]

actuals:
  tokens: 17300
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Segredo digitado (a senha) vive so no estado do formulario, e apagada depois do envio com erro ou sucesso e ao fechar, e nunca entra em chave de SWR, URL, armazenamento nem frase de erro"
    - "A pagina de retorno do login le code e state uma vez no primeiro render, troca o endereco por um sem query (history.replaceState) e chama a api uma vez"
    - "O link da pagina de retorno e sempre a ficha do Canal montada com um id validado (letras, numeros, - e _), nunca uma URL do endereco"

key-files:
  created:
    - apps/web/src/features/crm/painel-do-email.tsx
    - apps/web/src/features/crm/painel-do-email.test.tsx
    - apps/web/src/app/(shell)/crm/caixa-de-entrada/configuracoes/canais/email/retorno/page.tsx
    - apps/web/src/features/crm/retorno-do-email.test.tsx
  modified:
    - apps/web/src/dados/crm/canais.ts
    - apps/web/src/app/(shell)/crm/caixa-de-entrada/configuracoes/canais/[canal]/page.tsx
    - apps/web/src/features/crm/conectar-canal.ts
    - apps/web/src/features/crm/conectar-provedor.tsx
    - apps/web/src/features/crm/conectar-canal.test.tsx
    - apps/web/src/features/crm/ficha-do-canal.test.tsx

key-decisions:
  - "O painel abre numa escolha de caminhos (Google e Microsoft so se GET /email/conta diz que o servidor os tem; Outro servidor sempre) e so mostra o formulario depois de Outro servidor; Conectar fica desabilitado, com a frase Escolha como entrar, na etapa da escolha"
  - "Gmail e Outlook (gmail.com, googlemail.com; outlook.com, hotmail.com, live.com, msn.com) usam a predefinicao do servidor: a tela manda so o nome e mostra host e porta como texto; Usar outros servidores abre os campos manuais (portas 993/143 e 465/587 num Select)"
  - "Caixa caida (conta guardada e Canal desconectada): a linha da conta traz Entrar de novo e o botao Conectar do topo some, para nao repetir o mesmo painel duas vezes"
  - "Retorno com error diferente de access_denied diz uma frase fixa do produto e nunca repete o texto do endereco (error_description); so access_denied vira Voce cancelou a entrada"
  - "Retorno com sucesso fica na pagina (Caixa de e-mail conectada. e o link Abrir a ficha do Canal), diferente do Instagram que redireciona; o plano pedia a frase e o link"

patterns-established:
  - "A ficha do Canal de e-mail tem o proprio texto de ajuda e o proprio painel, como o WhatsApp oficial tem o do token"

requirements-completed: [EML-01, EML-02, EML-07]

duration: 20min
completed: 2026-11-19
status: complete
plan_head_before: 535fb49e89ff7034f4fd3d9cfa05b801d88692d7
plan_head_after: d6cfda4839ce042f2463701290bea22e3f3f3753
commits: 2

coverage:
  - id: D1
    description: "Na ficha de um Canal de e-mail desconectada, Conectar abre o painel; Outro servidor com host e portas envia exatamente { usuario, senha, imap, smtp }, fecha, re-hidrata e mostra Caixa de e-mail conectada."
    requirement: EML-01
    verification:
      - kind: unit
        ref: "apps/web/src/features/crm/ficha-do-canal.test.tsx#Fase 17 — Conectar abre o painel do e-mail; 'Outro servidor' com a senha certa conecta"
        status: pass
      - kind: unit
        ref: "apps/web/src/features/crm/painel-do-email.test.tsx#enviar manda exatamente { usuario, senha, imap, smtp }"
        status: pass
    human_judgment: false
  - id: D2
    description: "A recusa 422 do IMAP (ou do SMTP) aparece junto do campo, como texto, e a senha e apagada; a senha nunca vai a URL, localStorage, sessionStorage nem frase de erro"
    requirement: EML-01
    verification:
      - kind: unit
        ref: "apps/web/src/features/crm/painel-do-email.test.tsx#a recusa 422 do IMAP aparece junto do servidor IMAP e a senha e apagada do campo"
        status: pass
      - kind: unit
        ref: "apps/web/src/features/crm/painel-do-email.test.tsx#a recusa sem campo vai no topo; a frase da api e TEXTO"
        status: pass
    human_judgment: false
  - id: D3
    description: "Gmail e Outlook pelo dominio do endereco mandam so o nome da predefinicao, com a ajuda da senha de app e do SMTP autenticado, sem mes nem ano; Usar outros servidores abre os campos manuais"
    requirement: EML-02
    verification:
      - kind: unit
        ref: "apps/web/src/features/crm/painel-do-email.test.tsx#a predefinicao pelo dominio"
        status: pass
    human_judgment: false
  - id: D4
    description: "Entrar com o Google e com a Microsoft so aparecem quando o servidor os oferece; o clique chama a rota autorizar e leva o navegador a URL devolvida; a recusa da api aparece como texto"
    requirement: EML-02
    verification:
      - kind: unit
        ref: "apps/web/src/features/crm/painel-do-email.test.tsx#Entrar com o Google e com a Microsoft"
        status: pass
    human_judgment: false
  - id: D5
    description: "A pagina de retorno chama concluir uma vez, mostra a caixa conectada ou a frase da recusa, trata o cancelamento sem chamar a api, limpa code e state do endereco e so leva a ficha do Canal"
    requirement: EML-02
    verification:
      - kind: unit
        ref: "apps/web/src/features/crm/retorno-do-email.test.tsx"
        status: pass
    human_judgment: false
  - id: D6
    description: "A ficha mostra Conectada com endereco e jeito de entrar e os servidores, ou Desconectada com o motivo da queda como texto e Entrar de novo, que abre o painel; sem conta, so Conectar"
    requirement: EML-07
    verification:
      - kind: unit
        ref: "apps/web/src/features/crm/ficha-do-canal.test.tsx#Fase 17 — a ficha do Canal de e-mail conecta a caixa e mostra a conta"
        status: pass
    human_judgment: false
---

# Phase 17 Plan 14: A tela de conexão do e-mail Summary

**Na ficha do Canal de e-mail, "Conectar" abre três caminhos (Google, Microsoft e Outro servidor com senha de app e predefinição Gmail/Outlook por nome), a volta do login tem página própria que conclui uma vez e limpa o endereço, e a ficha diz se a caixa está de pé ou caiu, com o motivo e "Entrar de novo".**

## Performance

- **Duração:** cerca de 20 min
- **Concluído:** 2026-11-19
- **Tarefas:** 3 (traçador, OAuth com retorno, estado da conta)
- **Arquivos:** 4 criados, 6 modificados

## Accomplishments

- **Traçador (Task 1):** `painel-do-email.tsx` no molde de `painel-do-token.tsx` (`ConfirmDialog` largo, formulário sem `name` e com `autoComplete="off"`). "Outro servidor" pede usuário (com o endereço do Canal), senha (`type="password"`, nunca preenchida) e servidor e porta do IMAP (993 ou 143) e do SMTP (465 ou 587); envia exatamente `{ usuario, senha, imap, smtp }`. A recusa 422 vai junto do campo do `campo` que a api apontou, e a senha é apagada com erro ou sucesso. A ficha ganhou "Conectar" para `email-imap-smtp` (com `usePodeNoCrm("conectar", "canal")`), o texto de ajuda do e-mail e a mensagem "Caixa de e-mail conectada.". O texto de orientação do provedor descreve os três caminhos.
- **OAuth e retorno (Task 2):** os botões "Entrar com o Google" e "Entrar com a Microsoft" só aparecem com `servicosDisponiveis`; o clique chama `autorizarEmail` e `irParaForaDoApp(url)`. `predefinicaoDoEndereco` (gmail.com e googlemail.com para `gmail`; outlook.com, hotmail.com, live.com e msn.com para `outlook`) mostra host e porta como texto e manda só o nome; "Usar outros servidores" abre os campos. A página `canais/email/retorno` lê `code`, `state` e `error` uma vez, troca o endereço por um sem query, chama `concluir` uma vez e mostra a caixa conectada ou a frase da api.
- **Conta na ficha (Task 3):** `ContaDoEmailNaFicha` mostra "Conectada: endereço (senha|Google|Microsoft)" com os servidores, ou "Desconectada" com o `motivoDaQueda` como texto e "Entrar de novo". Sem conta, só "Conectar".

## Task Commits

1. **Tasks 1 e 3 (painel, dados, ficha, conta)** — `655d935` (feat)
2. **Task 2, página de retorno** — `d6cfda4` (feat)

Os três blocos de comportamento do plano moram no mesmo arquivo (`painel-do-email.tsx`) e na mesma ficha, e foram escritos juntos; a separação em commits seguiu os arquivos (o painel e a ficha, depois a rota nova), não a divisão exata das três tarefas.

## Verification Results

Rodados em `/Users/igorvboas/Library/Developer/TRIA/CRM/crm-n1`:

- `npx vitest run src/features/crm/painel-do-email.test.tsx src/features/crm/conectar-provedor.test.tsx src/features/crm/painel-do-token.test.tsx` mais `ficha-do-canal`, `conectar-canal`, `retorno-do-email` e `retorno-do-instagram`: verdes (21 testes novos em `painel-do-email`, 9 em `retorno-do-email`, 8 na ficha, mais os existentes dos mesmos arquivos).
- `npm run test -w @n1/web`: 150 arquivos, 1636 testes passando.
- `npm run typecheck -w @n1/web`: sem erros.
- `npm run verificar:tokens`: 0 falhas.
- `npm run lint -w @n1/web`: 0 erros; dois avisos que já existiam (`rotulos.ts` e `app-shell.tsx`), fora deste plano.
- `npm run build -w @n1/web`: compilou; a rota `/(shell)/crm/caixa-de-entrada/configuracoes/canais/email/retorno/page` está no manifesto de `app/`.
- Aceites do plano (greps): `Outro servidor` 4, `type="password"` 1, `/email/conectar` 1, `PainelDoEmail` na ficha 3, `quando a integração chegar` em `conectar-canal.ts` 0, `Entrar com o Google` 2, `Entrar com a Microsoft` 3, `concluirConexaoDoEmail` na página de retorno 2, `dezembro|202[6-9]` no painel 0, `Entrar de novo` 4, `dangerouslySetInnerHTML` 0, `ContaDoEmailNaFicha` na ficha 3.

Nenhum servidor real e nenhum navegador foram usados: tudo com `fetch` simulado. O fluxo ponta a ponta com Google, Microsoft e uma caixa de verdade segue sem prova (9.4.4 do plano da sessão).

## TDD

Os testes foram escritos junto com o código, e a primeira rodada deles já passou: não houve uma rodada vermelha separada commitada (o painel existia no disco quando o primeiro teste rodou). A cobertura de cada comportamento do `<behavior>` está nos testes listados no frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A pílula "disponível quando a integração chegar" do e-mail ficou falsa**
- **Found during:** Task 1 (o `conectar-canal.ts` do plano não a contém: ela está em `conectar-provedor.tsx`)
- **Issue:** a página de criar o Canal de e-mail continuaria dizendo que a integração ainda não chegou.
- **Fix:** `email-imap-smtp` entrou em `PROVEDORES_COM_INTEGRACAO` (pílula "na ficha do Canal, depois de criar"); o texto do espaço reservado descreve os três caminhos; a ficha continua abrindo sem `?conectar=1`, porque a pessoa escolhe o caminho.
- **Files modified:** `conectar-provedor.tsx`, `conectar-canal.ts`, `conectar-canal.test.tsx`
- **Commit:** 655d935

**2. [Rule 1 - Ajuste de teste] Dois testes de 08/16 usavam o e-mail como "o provedor que ainda não conecta pela tela"**
- **Found during:** Task 1
- **Issue:** `ficha-do-canal.test.tsx` esperava que o e-mail não tivesse "Conectar" e que mostrasse `FRASE_DO_CANAL_REAL`. Pelo próprio plano, o e-mail agora tem painel.
- **Fix:** o primeiro teste agora confere o "Conectar" do e-mail (sem "Simular conexão" em produção); o do CR-01 passou a usar o WhatsApp não oficial já conectado, onde a frase ainda é o texto da ficha. As telas dos outros provedores não mudaram.
- **Files modified:** `ficha-do-canal.test.tsx`
- **Commit:** 655d935

**3. [Rule 2 - Segurança] Retorno com `error` que não é `access_denied` não repete o texto do endereço**
- **Found during:** Task 2
- **Issue:** o plano só define `access_denied`; mostrar `error_description` poria texto de terceiros na tela.
- **Fix:** frase fixa do produto ("O serviço de login não aceitou a entrada. Nada foi conectado. Comece de novo pela ficha do Canal."); teste com `error_description` hostil.
- **Files modified:** `canais/email/retorno/page.tsx`, `retorno-do-email.test.tsx`
- **Commit:** d6cfda4

**4. [Rule 2 - Segurança] O id do Canal que vai para o link é validado**
- **Issue:** o id vem do `state` (campo `c`), que a página não confere.
- **Fix:** só letras, números, `-` e `_` (até 64) viram caminho; qualquer outra coisa cai nas configurações (T-17-62). Teste com `c: "https://mal.exemplo/x"`.
- **Commit:** d6cfda4

**Total:** 4 ajustes, nenhuma mudança de arquitetura. Os dois "Conectar" que o plano separava (`Conectar` do topo e `Entrar de novo`) ficaram sem repetição: com a conta guardada e o Canal caído só o "Entrar de novo" aparece.

## Known Stubs

Nenhum.

## Threat Flags

Nenhuma superfície nova além do `<threat_model>`. T-17-61 (senha): `type="password"`, `autoComplete="off"`, sem `name`, apagada depois do envio, nunca em URL, armazenamento ou frase (testado, inclusive a api repetindo a senha). T-17-62: o link só leva à ficha do Canal montada com id validado. T-17-63: toda frase é texto do React (testes com `<b>`, `<i>` e `<script>`). T-17-64: a tela manda só `predefinicao`.

## Limites conhecidos (não são defeitos)

- Host e porta do Gmail e do Outlook aparecem na tela como texto fixo (a tabela de verdade é a do servidor). Se o servidor mudar a tabela, a frase da tela precisa acompanhar.
- A página de retorno limpa o endereço com `window.history.replaceState` (integrado ao roteador do Next 16, lido nos guias instalados); o teste prova o endereço do `jsdom`, não o roteador do Next real.
- O `CONTEXT.md` do web não foi atualizado aqui: é o 17-16.

## Self-Check: PASSED

Arquivos criados e commits conferidos (`655d935`, `d6cfda4` no histórico de `sessao-9/email`).
