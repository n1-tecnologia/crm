---
status: testing
phase: 08-canais-de-comunica-o-conex-o-e-omnichannel-preparado
source: [08-VERIFICATION.md]
started: 2026-10-12T22:51:23Z
updated: 2026-10-12T22:51:23Z
---

## Current Test

number: 1
name: UAT de fim de fase, passos 1 a 3 (08-PROVAS.md, Roteiro da UAT): Administrador abre Configuracoes da Caixa de Entrada, clica em Conectar Canal, ve os quatro cartoes, abre a orientacao do WhatsApp oficial e do nao oficial e conecta Comercial e Suporte com dois numeros distintos; tenta o numero A de novo no nao oficial.
expected: |
  Quatro cartoes legiveis; orientacao com tres passos e espaco tracejado do token/QR; Canais nascem desconectados e persistem ao recarregar; a segunda tentativa com o mesmo numero e recusada com 'Esta conta ja esta conectada em outro Canal ativo.' e link para o Canal que o usa.
awaiting: user response

## Tests

### 1. UAT de fim de fase, passos 1 a 3 (08-PROVAS.md, Roteiro da UAT): Administrador abre Configuracoes da Caixa de Entrada, clica em Conectar Canal, ve os quatro cartoes, abre a orientacao do WhatsApp oficial e do nao oficial e conecta Comercial e Suporte com dois numeros distintos; tenta o numero A de novo no nao oficial.
expected: Quatro cartoes legiveis; orientacao com tres passos e espaco tracejado do token/QR; Canais nascem desconectados e persistem ao recarregar; a segunda tentativa com o mesmo numero e recusada com 'Esta conta ja esta conectada em outro Canal ativo.' e link para o Canal que o usa.
why_human: Hierarquia visual, legibilidade e compreensao da orientacao sem ajuda sao juizo humano (08-01 D5, 08-08 D6); o fluxo com JWT real do Supabase, navegador e banco da plataforma com a 008 nao e coberto por nenhum teste automatizado.
result: [pending]

### 2. UAT passos 4 e 5: Simular conexao em cada Canal; ler a lista de Canais nas Configuracoes.
expected: Canal passa a conectado com a marca 'conexao simulada' e o aviso de que nenhuma Mensagem sai da plataforma; recarregar mantem. Comercial (oficial, cadastrado), Suporte (nao oficial, cadastrado) e Comercial SP (demo) distinguiveis pelos selos.
why_human: Legibilidade da faixa de aviso e dos selos (08-09 D6, 08-01); persistencia contra o banco real.
result: [pending]

### 3. UAT passos 6 a 8: abrir um Contato do seed com WhatsApp; trocar 'Responder por' para Suporte; olhar a lista da Caixa de Entrada e o filtro Canal.
expected: Abas 'Comercial · WhatsApp oficial', 'Suporte · WhatsApp nao oficial' e 'Comercial SP · WhatsApp oficial'; topo do fio com icone, nome, selo e marca simulada; envio livre pelo nao oficial sem modelo e sem aviso de janela de 24 h (o oficial continua com eles); item da lista com icone + nome do Canal que cabe na coluna; filtro 'Suporte · WhatsApp nao oficial' filtra; atalhos WhatsApp/E-mail das fichas levam a aba certa.
why_human: Desenho das abas com rotulo longo, barra do topo, truncamento do nome na coluna real e comportamento com dois WhatsApps na tela (08-10, 08-11 D4, 08-02 D4); os testes provam texto e comportamento, nao o visual.
result: [pending]

### 4. UAT passos 9 e 10: entrar como Membro (Configuracoes e ficha do Canal); voltar como Administrador, Desconectar o Suporte e Arquivar.
expected: Membro ve 'Conectar Canal' desabilitado com a frase de quem administra e a ficha sem 'Simular conexao'; desconectar leva a ficha a desconectada; arquivar tira o Canal da lista e das abas; recarregar mantem ambos.
why_human: Depende de dois logins reais do Supabase no mesmo Espaco e do banco da plataforma.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps

