---
status: partial
phase: 12-clone-clickup-grava-o-mais-r-pida
source: [12-VERIFICATION.md]
started: 2026-11-02T21:30:00Z
updated: 2026-11-02T21:56:26.759Z
---

## Current Test

[testing complete]

## Tests

### 1. Criar uma Lista na tela de produção e olhar a árvore
expected: A Lista aparece na hora, com visual de "Salvando…" e sem link, e vira link normal logo depois da resposta; uma Lista recusada pelo servidor some e o erro aparece. Antes: mesclar o PR #3 (https://github.com/n1-tecnologia/crm/pull/3) e publicar a web. A web nova não está em produção.
result: blocked
blocked_by: release-build
reason: "Dono respondeu pass, reaberto por conferência: o PR #3 seguia OPEN (não mesclado) em 2026-11-02 e a web nova não está em produção; só o preview da Vercel está verde. Refazer depois de mesclar e publicar, ou registrar que o teste foi feito no preview."

### 2. Fechar a aba e clicar em item "Salvando…" no navegador
expected: Com uma gravação a caminho, ao fechar ou recarregar a aba o navegador pergunta antes de sair; o clique (simples, cmd/ctrl+clique, Enter) numa âncora de item ainda "Salvando…" é cancelado e não leva a uma página de id inexistente. Conferir em Chrome e Safari.
result: pass

### 3. A linha "gravacao medida" do serviço real (D-03)
expected: Depois do deploy da web, criar uma Lista num Espaço seu; por ssh na VPS como `n1crm`, rodar `sudo -n /usr/bin/journalctl --no-pager -u n1-crm-api.service -n 200` filtrado por "gravacao medida" e colar UMA linha em `12-PROVAS.md` (seção "D-03 em produção (depois)"). A linha precisa ter `"regime":"travado"`, `"tentativas":1` e o nome da operação, sem e-mail nem nome de registro.
result: blocked
blocked_by: release-build
reason: "Dono respondeu pass, reaberto por conferência: 12-PROVAS.md (seção D-03 em produção (depois)) registra NÃO OBSERVADO, sem a linha gravacao medida. Depende de publicar a web (teste 1)."

### 4. Decidir sobre o pedido isolado mais lento (b-ganho-basta)
expected: O dono decide se aceita o resultado como está (o pedido isolado ficou 11% a 17% mais lento, cerca de 51 ms por gravação por causa da ida e volta da trava; o ganho está na tela e sob disputa, e só foi provado por teste), OU manda recuperar a ida e volta (opções b1 e b2 do Pitfall 9 em `12-PROVAS.md`, cerca de 51,4 ms por gravação).
result: pass

### 5. Triar os avisos de revisão de código WR-01 a WR-07
expected: Cada um fica corrigido, adiado com motivo ou aceito, em `12-REVIEW-DISPOSITION.md` (hoje os 11 achados estão "open"). Em especial WR-01 (o `catch` genérico de `enviar()` não re-hidrata), WR-02 (re-hidratação ignorada ou falha apaga da tela uma gravação confirmada), WR-03 (a fila serial não tem prazo de rede) e WR-05 (ações de status ligadas na linha "Salvando…") antes de publicar a web.
result: blocked
blocked_by: other
reason: "Dono respondeu pass, reaberto por conferência: 12-REVIEW-DISPOSITION.md segue com os 11 achados em open (open: 11), em todas as branches. Falta registrar corrigido, adiado com motivo ou aceito para cada um."

## Summary

total: 5
passed: 2
issues: 0
pending: 0
skipped: 0
blocked: 3

## Gaps
