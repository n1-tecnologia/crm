---
phase: 12-clone-clickup-grava-o-mais-r-pida
reviewed: 2026-11-02T00:00:00Z
depth: standard
files_reviewed: 22
files_reviewed_list:
  - apps/api/src/importacao/clickup/corrigir-data-de-pagamento-cr.ts
  - apps/api/src/importacao/clickup/importar-contas-a-pagar.ts
  - apps/api/src/importacao/clickup/importar-contas-a-receber.ts
  - apps/api/src/importacao/financeiro/importar.ts
  - apps/api/src/observabilidade/medicao-da-gravacao.ts
  - apps/api/src/observabilidade/medir-gravacao.cli.ts
  - apps/api/src/observabilidade/medir-gravacao.ts
  - apps/api/src/persistencia/repositorio.ts
  - apps/api/src/persistencia/unidade-de-trabalho.ts
  - apps/api/src/rotas/operacoes.ts
  - apps/api/src/servicos/convidar-membro.ts
  - apps/web/src/app/(shell)/estrutura/listas/[lista]/page.tsx
  - apps/web/src/dados/guarda-de-navegacao.ts
  - apps/web/src/dados/operacoes-que-esperam.ts
  - apps/web/src/dados/store.ts
  - apps/web/src/dados/transporte.ts
  - apps/web/src/features/estrutura/financeiro/contas-view.tsx
  - apps/web/src/features/estrutura/tabela-de-tarefas.tsx
  - apps/web/src/features/estrutura/tarefa-completa.tsx
  - apps/web/src/features/estrutura/task-panel.tsx
  - apps/web/src/features/shell/app-shell.tsx
  - apps/web/src/features/shell/linha-da-arvore.tsx
findings:
  critical: 0
  warning: 7
  info: 4
  total: 11
status: issues_found
---

# Fase 12: Relatório de revisão de código

**Revisado:** 2026-11-02
**Profundidade:** standard (com o diff `2924973..HEAD` de cada arquivo)
**Arquivos revisados:** 22
**Status:** issues_found

## Resumo

O caminho de erro de `executar()` está correto: `rollback` e `release(true)` cobrem todos os desvios. O `55P03` na trava devolve a conexão sã ao pool, e qualquer outro erro destrói a conexão. Não achei vazamento de conexão nem de trava. A medição nunca vaza para o corpo da resposta, e o `aoMedir` que lança é engolido.

Os problemas estão no store da web e na fronteira com o servidor. A fila serial de D-16 não tem teto de tempo. Há dois caminhos de erro (`catch` genérico e re-hidratação que falha em silêncio) que descartam uma gravação já confirmada, ou deixam `confirmado` meio aplicado. Gravações enfileiradas carregam ids "assados" que nada reconcilia se o id do servidor divergir do local. Não encontrei defeito que perca dado de forma silenciosa e certa, então não há BLOCKER. Os WR-01 a WR-05 são os que eu corrigiria antes do deploy.

Os listeners de `AcompanhanteDaRevisao` (intervalo, `visibilitychange`, `focus`, `beforeunload`) e os da guarda de navegação são todos removidos no cleanup do `useEffect`. Não achei listener vazado. As chaves de React (`task.id`, `child.id`) só remontam se o id do servidor for diferente do local, o que é o mesmo risco do WR-05.

## Avisos

### WR-01: `enviar()` engole qualquer exceção e deixa `confirmado` possivelmente meio aplicado, sem re-hidratar

**Arquivo:** `apps/web/src/dados/store.ts:351-356, 396-403`
**Problema:** `aplicarDiferenca(get().confirmado, …)` muta `confirmado` em lugar, e só depois vem o `set({ revisaoDoServidor })`. Se `aplicarDiferenca` lançar no meio (diff malformado, ordem inconsistente), ou se `resposta.json()` falhar depois de o servidor já ter commitado, cai no `catch` genérico. Esse `catch` só mostra "Recarregue a página". `confirmado` fica parcialmente mutado, `revisaoDoServidor` fica velho, e `terminar()` reconstrói `data` sobre esse `confirmado` quebrado. A gravação já commitada some da tela. O servidor tem a mudança e o cliente mostra um estado que nenhum servidor teve, ao contrário do que o cabeçalho do arquivo promete ("o cliente nunca fica com um estado que o servidor não tem"). Quem descobre é o poll de 5 s, e só quando `pendentes === 0`.
**Correção:** no `catch`, tentar a re-hidratação antes de devolver o erro.
```ts
} catch {
  try { await hidratarAgora(); } catch { /* o erro abaixo já avisa */ }
  const erro = "Não foi possível confirmar a gravação. …";
  set((estado) => ({ lastResult: { ok: false, error: erro, at: Date.now() }, revision: estado.revision + 1 }));
  return { ok: false, error: erro };
}
```

### WR-02: Revisão defasada com `hidratarAgora()` que falha ou é ignorada apaga da tela uma gravação confirmada

**Arquivo:** `apps/web/src/dados/store.ts:334-346, 289-305`
**Problema:** no ramo `revisaoAnterior !== revisaoDoServidor`, o código faz `await hidratarAgora()` e devolve `resposta.resultado`, com a gravação commitada no servidor. `hidratarAgora` retorna sem alterar nada em dois casos: `GET /estado` devolve `falha` (rede), ou `r.revisao < revisaoDoServidor`. Nesses casos `confirmado` continua o antigo e `revisaoDoServidor` continua velho. `terminar()` tira a pendente e `refazerPendentes` faz `data = confirmado`, e a mudança que o servidor guardou desaparece da tela, com `ok: true` devolvido a `runConfirmado`. Ela volta no próximo poll (5 s), ou a cada gravação seguinte, que repete o ciclo.
**Correção:** depois de `hidratarAgora()`, conferir `get().revisaoDoServidor >= resposta.revisao`. Se não for, tentar de novo ou devolver `ok: false` com a mensagem de "não foi possível atualizar". Não tratar como confirmado.

### WR-03: A fila serial não tem prazo: um pedido pendurado trava todas as gravações, a re-hidratação e o poll

**Arquivo:** `apps/web/src/dados/store.ts:421-448`; `apps/web/src/dados/transporte.ts:117, 192`
**Problema:** `processarFila` espera cada `enviar()` por inteiro. `gravarUma` e `hidratar` usam `fetch` sem `AbortController` nem prazo, e `obterToken()` também não tem prazo. Antes da fase cada gravação era independente. Agora uma única conexão meio-aberta (TCP sem RST, aba em rede móvel) segura a fila inteira. Todo `run()` seguinte fica "Salvando…" para sempre, `pendentes > 0` bloqueia `verificarRevisao`, e o `beforeunload` pergunta ao sair sem que nada esteja em andamento. As promessas de `runConfirmado` desses itens nunca resolvem. O servidor agora tem prazos (`statement_timeout`, `idle_in_transaction`), mas o lado do cliente não.
**Correção:** `AbortSignal.timeout(…)` (por exemplo 45 s, acima do `query_timeout` de 30 s) em `gravarUma`, `hidratar` e `revisaoAtual`, tratando o abort como `{ tipo: "falha", erro: "O servidor demorou demais." }`. Como o servidor pode ter commitado, a falha por prazo deve re-hidratar (ver WR-01).

### WR-04: Exceção em `terminar()`/`refazerPendentes()` deixa a promessa sem resolver e a fila parada

**Arquivo:** `apps/web/src/dados/store.ts:421-448`
**Problema:** o ramo `gravar` do laço não tem `try/catch` (só o ramo `rehidratar` tem). `terminar()` chama `structuredClone(confirmado)`, `syncIdSequence` e `set(...)`, que dispara os ouvintes do zustand de forma síncrona. Se qualquer um lançar depois de `tirar(pendente)` e antes de `pendente.concluir(...)`, a exceção sobe por `processarFila` (chamada com `void`, vira unhandled rejection). `finally` zera `emVoo`, mas o `concluir` dessa pendente nunca roda, e os itens restantes ficam parados até alguém chamar `processarFila` de novo. No ramo `rehidratar` o `catch` chama `refazerPendentes(false)` de novo, e se ele lançou uma vez, lança outra, sem proteção.
**Correção:** chamar `pendente.concluir(resultado)` em um `finally` dentro de `terminar` (ou antes de `refazerPendentes`), e embrulhar o corpo do laço em `try/catch` que garanta `sairDaFila(item)` e seguir para o próximo item.

### WR-05: Pendentes enfileiradas carregam ids locais "assados"; nada reconcilia quando o id do servidor diverge, e as ações de status continuam ligadas na linha "Salvando…"

**Arquivo:** `apps/web/src/dados/store.ts:228-239, 480-493`; `apps/web/src/features/estrutura/tabela-de-tarefas.tsx:163, 444-449`
**Problema:** o próprio `operacoes-que-esperam.ts` e o cabeçalho de `idsNaoConfirmados` admitem que "o id local pode não ser o do servidor" (a ponte, o agendador ou outra pessoa consomem ids). Quando isso acontece com a pendente p1 (criar), o servidor dá o id Y e o cliente tinha X. Uma p2 já enfileirada sobre X (por exemplo `changeTaskStatus(task X)`) segue com `args` fixos, tanto no envio quanto no `refazer` sobre o `confirmado` novo. Se X existir no servidor como outro registro, p2 age no registro errado, nos dois lados, sem erro. A guarda de D-15 só desabilita abrir (link, painel, página). Em `tabela-de-tarefas.tsx` a ação rápida "Concluir" e o menu de Status da linha em "Salvando…" continuam ativos e geram p2 sobre o id pendente.
**Correção:** (a) desabilitar também os gestos que gravam sobre a linha `salvando` (`disabledReason: MOTIVO_SALVANDO` em "Concluir" e nos itens de Status); (b) em `terminar()`, comparar o `value.id` local da pendente com o que o servidor devolveu e, se divergir, descartar com erro as pendentes seguintes que referenciem o id local, em vez de enviá-las.

### WR-06: As importações em regime `otimista` seguram a linha do Espaço do `update` até o `commit`, e a tela passa a perder gravações com 409

**Arquivo:** `apps/api/src/persistencia/unidade-de-trabalho.ts:444-465`; `apps/api/src/importacao/clickup/importar-contas-a-pagar.ts:215-220` (e as outras três importações)
**Problema:** o comentário de D-10 justifica o `otimista` dizendo que travar no começo "seguraria a linha do `ws_n1` desde o começo". Mas o `update plataforma.workspaces … revisao` do otimista toma a mesma trava da linha e a segura durante `gravar()`, os eventos e o `commit` (com `DATABASE_QUERY_TIMEOUT_MS=0`, sem `statement_timeout`). Qualquer gravação da tela nesse intervalo espera `lock_timeout` (10 s), vira 409, e o cliente agora **reverte uma mudança que já tinha mostrado** (store D-14). Antes da fase a tela esperava o servidor e simplesmente demorava. A janela é menor que a da importação inteira, mas não é nula, e o `gravar` de um lote grande é a parte lenta.
**Correção:** documentar a janela no `CONTEXT.md` e no comentário (a importação deve rodar fora do horário de uso). Se for relevante, o 409 por `lock_timeout` poderia ser distinguido no cliente ("o Espaço está ocupado, tente de novo") em vez de reverter em silêncio.

### WR-07: `transporteHttp.gravar` continua enviando as chamadas seguintes depois de o servidor recusar uma, e o store mascara a recusa

**Arquivo:** `apps/web/src/dados/transporte.ts:177-183`; `apps/web/src/dados/store.ts:329-365, 396`
**Problema:** o comentário diz "paramos na primeira resposta que não for `diferenca`", mas uma recusa de domínio chega como `tipo: "diferenca"` com `resultado.ok === false`, então o laço não para e a chamada 2 vai ao servidor mesmo com a 1 recusada. No store, `ultimo = resposta.resultado` é sobrescrito pela chamada 2 se for `ok`: `lastResult` ficou com o erro da primeira, mas `enviar` devolve `ok: true`. `terminar(pendente, ok)` então roda `refazerPendentes(false)`, que pode sobrescrever `lastResult` com um erro de outra pendente, e `runConfirmado` resolve com sucesso para um gesto que falhou pela metade. Hoje nenhuma tela usa duas chamadas por `run` (o comentário diz isso), então o risco é latente.
**Correção:** em `transporteHttp.gravar`, interromper também quando `resposta.tipo === "diferenca" && !resposta.resultado.ok`. No store, retornar na primeira resposta com `resultado.ok === false`.

## Informativos

### IN-01: Comentário de `aoTerminar` ficou desatualizado

**Arquivo:** `apps/api/src/servicos/convidar-membro.ts:30-35`
**Problema:** diz que "conflito de revisão repete o callback", o que só vale no regime `otimista`. `convidarMembro` usa o regime padrão (`travado`), de uma tentativa só, e o callback roda uma vez.
**Correção:** trocar por "uma tentativa só (regime `travado`); o callback roda uma vez por chamada".

### IN-02: `enviarEspacoALixeira` pode deixar um Espaço de teste ativo no Espaço real

**Arquivo:** `apps/api/src/observabilidade/medir-gravacao.ts:176-186`
**Problema:** se `restoreContainer` for aplicado no servidor mas a resposta falhar (rede), o `catch` troca para `espaco-novo`. O Espaço antigo ficou restaurado (ativo), mas `this.espacos` ainda o marca `naLixeira: true`. O `limpar()` o pula e o `ZZ-MEDICAO-…-lixeira` fica ativo em produção. É um caso de borda, mas o comando roda em `ws_n1`.
**Correção:** no `catch`, marcar o Espaço como `naLixeira: false` antes de trocar de caminho (o `limpar()` o reenvia à lixeira, e um `trashContainer` num Espaço já na lixeira falha sem estrago).

### IN-03: `somaDasEtapas` não tem o `?? 0` que `resumirGesto` usa para o mesmo campo

**Arquivo:** `apps/api/src/observabilidade/medicao-da-gravacao.ts:192-199` (compare com `:204`)
**Problema:** `resumirGesto` tolera campo ausente com `a.medicao[etapa] ?? 0`, mas `somaDasEtapas` faz `soma += medicao[etapa]` direto. Uma linha de log sem uma etapa dá `NaN` em `foraDasEtapasMs`, que contamina `mediana` e `pior`. Hoje as linhas vêm do mesmo código, então só aparece se o contrato mudar.
**Correção:** `soma += medicao[etapa] ?? 0`.

### IN-04: O CLI aceita `--repeticoes`, `--workspace` e `--membro` sem `=` e ignora o valor

**Arquivo:** `apps/api/src/observabilidade/medir-gravacao.cli.ts:55-82`
**Problema:** `lerArgumentos` valida só o nome (`CONHECIDOS`). `--repeticoes` sozinho passa, `valorDe` devolve `undefined` e vira o padrão 10 sem avisar. O mesmo vale para `--workspace` e `--membro` sozinhos: o comando mede o Espaço padrão enquanto quem o chamou achava que estava escolhendo outro. Quem digitou `--workspace ws_outro` (com espaço em vez de `=`) cai em "argumento desconhecido", o que protege esse caso, mas a forma sem valor passa.
**Correção:** rejeitar `--chave` sem `=` (exceto `--confirmar-espaco`).

---

_Revisado: 2026-11-02_
_Revisor: Claude (gsd-code-reviewer)_
_Profundidade: standard_
