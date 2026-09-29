# Contrato HTTP v1 — `POST /v1/integrations/contas-a-pagar/*` (plataforma → `automation/`)

**Versão:** v1 própria, nasce neste plano (03-07); **v1.1** aditiva em 2026-09-29 (Plan 06-02 — ver §3 e §7). **Decisão:** superfície NOVA, **não** um 8º método do contrato de Solicitação de pagamento (`04-contrato-plataforma-v1.md`). A pesquisa da Fase 3 (`03-RESEARCH.md`, Open Question #4) deixou isto em aberto — "decisão de planejamento, não travada por nenhum documento". Está travado aqui, por quatro razões, em ordem de peso:

1. **Direção.** Os sete métodos do contrato de Solicitação são `automation/` → plataforma: o cliente é `../financeiro-tria/automation/src/adapters/plataforma.ts`, o servidor é `apps/api`. As duas rotas deste documento são o sentido oposto — plataforma → `automation/`: o servidor é o Express de `automation/`. Um "8º método" seria, literalmente, um método do adapter que CHAMA a plataforma — a direção oposta da que 03-11 (a ponte em `apps/api`) precisa. As únicas rotas daquele contrato nesta direção são os três webhooks do §8, e eles são notificação de evento (202 + receipt, resposta que não carrega resultado); estas duas rotas são um comando com resposta usável pela Automação. Forçá-las a virar webhook trocaria a semântica que o chamador precisa.
2. **§9 daquele contrato congela o v1 ao fim da Fase 2:** "qualquer mudança de forma depois disso exige uma nova versão de rota (`/v2/...`), nunca uma mutação retroativa do contrato v1". A Fase 2 acabou. Acrescentar um oitavo método é a mutação retroativa que o próprio documento proíbe.
3. **O contrato de Solicitação já se declarou fora deste fluxo.** §1 daquele documento, não-escopo explícito: "Criação ou movimentação de Tarefa entre a Lista 'Solicitações de pagamento' e a Lista 'Contas a pagar' — Fase 3" e "Motor genérico de Automações, agenda, execuções auditáveis — Fase 3".
4. **Escopo de credencial.** A base daquele contrato é `/v1/integrations/payment-requests` e os escopos são `payment-requests:read|write`. Pendurar o lançamento ali daria à credencial do pipeline de Solicitação o poder de mover dinheiro no Omie. Superfície nova, credencial nova (`PLATAFORMA_LANCAMENTO_TOKEN`), escopo mínimo — D-15 pede exatamente isso.

O que esta superfície **reusa** do contrato de Solicitação, porque não há motivo para divergir: o envelope de autenticação (`Authorization: Bearer` + `X-Request-Id`), o envelope e o vocabulário de erro (`code`/`message`/`requestId`/`retryable`, mensagens fixas sem detalhe interno) e a disciplina de idempotência (chave derivada do passo lógico, **nunca** de timestamp). O que ela não reusa: versão, base path, credencial e este documento em si — mudanças aqui não tocam `04-contrato-plataforma-v1.md`, e vice-versa.

---

## §1 Escopo e não-escopo

Este contrato cobre exatamente as duas rotas que `../financeiro-tria/automation/src/http/contas-a-pagar-routes.ts` serve:

`POST /v1/integrations/contas-a-pagar/resolver` · `POST /v1/integrations/contas-a-pagar/lancar`

**Não-escopo explícito:**

- **Conversão de Solicitação aprovada em Conta a pagar.** Isso é `converterSolicitacaoEmContaAPagar` (Plan 03-06, `packages/dominio/src/operations/conversao-de-solicitacao.ts`) — uma operação de domínio dentro da plataforma, sem HTTP nenhum. As rotas deste documento partem de uma Conta a pagar que já existe (na plataforma ou historicamente importada, Plan 03-09); elas não criam Tarefa nem decidem se uma Solicitação deveria virar conta.
- **Escrita de Status em qualquer Lista/Tarefa.** `POST /lancar` devolve o resultado do lançamento; quem move a Conta a pagar para `lançado omie` é A8, ação LOCAL do domínio (`tarefa.alterarStatus`, `packages/dominio/src/operations/automations.ts:173-188`), nunca uma chamada de volta destas rotas. `/lancar` não tem porta de escrita de Status, e `/resolver` não tem NENHUMA porta de escrita (ver §6, D3-03).
- **Emissão de nota fiscal e conciliação bancária.** Fora do escopo dos 25 Campos que estas rotas leem/lançam.
- **Extração de NF por IA a partir de anexos.** O caminho legado (`payment-automation-service.ts`) usa Gemini para preencher `numero_documento_fiscal`; aqui o campo chega opcional no corpo e o Omie aceita vazio. Trazer o Gemini para este contrato é escopo de outra decisão.

---

## §2 Autenticação

**Credencial:** `Authorization: Bearer <PLATAFORMA_LANCAMENTO_TOKEN>` — comparada em tempo constante (`timingSafeEqual` sobre o digesto sha256, nunca o valor cru) ANTES de qualquer leitura do corpo da requisição. O router é montado em `server.ts` antes do `express.json()` global, então essa ordem vale em produção, não só no teste isolado.

`PLATAFORMA_LANCAMENTO_TOKEN` é um segredo PRÓPRIO deste contrato, lido por `optionalEnv(..., "")` (nunca `requiredEnv` — o serviço não deve deixar de subir por falta dele; um token vazio nunca autentica, porque `extrairBearer` recusa um `Bearer` vazio antes de a comparação sequer rodar). Ele é distinto das outras duas credenciais de serviço já existentes no mesmo repositório:

| Variável | Sentido | Quem usa |
|---|---|---|
| `PLATAFORMA_WEBHOOK_TOKEN` | plataforma → `automation/` (webhooks do contrato de Solicitação, §8 de `04-contrato-plataforma-v1.md`) | `webhooks-plataforma.ts` |
| `PLATAFORMA_SERVICE_TOKEN` | `automation/` → plataforma (os 7 métodos do contrato de Solicitação) | `adapters/plataforma.ts` |
| `PLATAFORMA_LANCAMENTO_TOKEN` | plataforma → `automation/` (este documento) | `http/contas-a-pagar-routes.ts` |

Escopo mínimo (D-15): esta credencial só abre as duas rotas deste documento — não é a mesma que autentica os sete métodos do pipeline de Solicitação, então uma fuga dela não dá acesso ao resto do `automation/`.

**Correlação:** `X-Request-Id` por chamada; a resposta o ecoa em `error.requestId` quando há erro.

**Proibição de log:** as mesmas do §2 de `04-contrato-plataforma-v1.md` — `Authorization`, CPF/CNPJ completo, chave Pix, código de barras, Pix copia e cola nunca entram em log ou corpo de erro, nem em claro nem parcialmente. `POST /resolver` nem sequer aceita campo de pagamento no corpo (T-3-14).

---

## §3 As duas rotas

### `POST /v1/integrations/contas-a-pagar/resolver`

Não exige `Idempotency-Key` — não muta nada (§5 reserva a chave para escrita). Devolve o `DeParaDeLancamento` que `packages/dominio/src/operations/financeiro.ts` (Plan 03-04) declarou.

Corpo (o mínimo que a resolução precisa — nenhum dado de pagamento trafega aqui):

```jsonc
{
  "taskId": "tsk_cp_das",
  "centroDeCusto": "tria",
  "categoriaDePagamento": "Impostos",
  "titulo": "DAS — Simples Nacional",
  "descricao": "Imposto mensal",   // opcional
  "tagDaConta": "conta tria",       // opcional
  "pedidoDeRevisao": "é prestação comercial, não ADM",  // v1.1, opcional, máx. 500
  "codigoCategoriaConfirmado": "2.02.98"                // v1.1, opcional, ex.: 2.06.01 ou 2.02.98.01
}
```

**v1.1, opcional — `pedidoDeRevisao`:** o pedido de ajuste do Financeiro na Conferência do Resumo (Fluxo 6 do legado). Entra no FIM da consulta do RAG (`título + categoria + descrição + pedido`), como o `reviseSummary` do legado faz com a resposta ao RESUMO — sem a IA de redação: o texto do Resumo revisado é montado na plataforma. É texto livre do Financeiro: nunca aparece em log nem em `details.motivo` (T-3-14).

**v1.1, opcional — `codigoCategoriaConfirmado`:** o código que o Financeiro conferiu no Resumo (D6-10: vem da Conferência como DADO, nunca reparseado do texto). Com ele o RAG **não é chamado**; o código só é validado no plano de contas real do Omie (`ListarCategorias`): existe → `{ "veredito": "resolvida", "nome": <descrição do Omie>, "codigo", "similaridade": 1 }`; não existe → `{ "veredito": "revisar", "nome": <categoriaDePagamento>, "codigo", "similaridade": 0, "motivo": "Código <código> não existe no plano de contas do Omie." }`; plano de contas inalcançável → `revisar`, nunca aceito sem validar. Formato fora de `^\d(\.\d{2}){2,3}$` → `400 SCHEMA_INVALIDO`.

Resposta `200`:

```jsonc
{
  "dePara": {
    "contaPorTag": { "conta tria": "TRIA COMPANY - ITAU" },
    "categoriaPorCampo": {
      "Impostos": { "veredito": "resolvida", "nome": "Impostos e taxas", "codigo": "2.06.01", "similaridade": 0.91 }
    },
    "origem": "omie"
  }
}
```

O encanamento do Omie (`idContaCorrente`/`departamentoCodigo`/`codigoCategoria`) NÃO atravessa esta resposta — é consumido dentro do `automation/`, por `/lancar`.

### `POST /v1/integrations/contas-a-pagar/lancar`

Exige `Idempotency-Key` EXATAMENTE igual a `` `tria:contas-a-pagar:${corpo.taskId}` `` — a mesma string que vira `codigo_lancamento_integracao` no Omie (§5). Diferente → `400 IDEMPOTENCY_KEY_INVALIDA`.

Corpo = o de `/resolver` mais:

```jsonc
{
  "valorCentavos": 150000,               // inteiro, nunca float
  "vencimento": "2026-03-10",             // YYYY-MM-DD
  "dataDeEmissao": "2026-03-01",          // opcional, YYYY-MM-DD
  "previsaoDePagamento": "2026-03-10",    // opcional, YYYY-MM-DD
  "formaDePagamento": "Chave Pix",        // "Chave Pix" | "Boleto" | "QRCode Pix"
  "chavePix": "...",                      // conforme a forma de pagamento
  "codigoDeBarras": "...",
  "pixCopiaECola": "...",
  "fornecedor": { "tipo": "CNPJ", "documento": "...", "nome": "..." },
  "observacao": "...",                    // opcional, máx. 1000
  "numeroDocumentoFiscal": "...",         // opcional
  "anexos": [                             // opcional
    "https://...",                                    // v1: só a URL (o nome vem do fim da URL)
    { "url": "https://...", "nome": "NFS-e 21.pdf" }  // v1.1: com o nome original (1 a 200 caracteres)
  ]
}
```

`pedidoDeRevisao` e `codigoCategoriaConfirmado` (v1.1) valem aqui como em `/resolver` — o `/lancar` resolve a Categoria pela mesma peça: com `codigoCategoriaConfirmado`, o `IncluirContaPagar` leva ESSE código, mesmo que o RAG apontasse outro; fora do plano de contas, `422 REGRA_DE_DOMINIO` com o motivo e nada incluído.

**v1.1, opcional — `anexos[]` como `{ url, nome }`:** o `nome` vira o nome do arquivo DENTRO do zip e o `cNomeArquivo` do `IncluirAnexo` (normalizado: sem acento, sem espaço, minúsculas). Sem ele, o nome é o último segmento da URL — numa URL assinada do Storage, um caminho opaco. Os dois formatos convivem na mesma lista; `{ url }` sem `nome`, `nome` vazio ou campo a mais → `400 SCHEMA_INVALIDO`.

Resposta `200` (nunca `{ ok: true }` — um replay precisa confirmar o resultado sem uma segunda leitura):

```jsonc
{
  "payableId": "1234567890",
  "codigoLancamentoIntegracao": "tria:contas-a-pagar:tsk_cp_das",
  "reaproveitado": false,
  "dePara": { "...": "mesma forma de /resolver" },
  "anexos": [
    { "url": "https://...", "ok": true },
    { "url": "https://...", "nome": "NFS-e 21.pdf", "ok": false, "erro": "download anexo falhou: 403 Forbidden" }
  ]
}
```

`anexos[].nome` (v1.1) volta só quando o anexo foi pedido com nome — um pedido v1 recebe a resposta de sempre. Um anexo que não sobe não derruba o lançamento: `ok: false` e o `erro`. Com `reaproveitado: true` (o título já existia), `anexos` é `[]`: os anexos subiram no primeiro envio, e o reenvio está adiado (Fase 6).

`422 REGRA_DE_DOMINIO` quando a Categoria da Tarefa está com `veredito: "revisar"` — `details.motivo` traz o texto da recusa, nunca um dado financeiro.

---

## §4 Códigos de erro

Mesmo envelope do §3 de `04-contrato-plataforma-v1.md`. Delta sobre aquela tabela — os dois códigos que só existem aqui:

| HTTP | `code` | Motivo | `retryable` |
|---|---|---|---|
| 400 | `IDEMPOTENCY_KEY_INVALIDA` | `Idempotency-Key` não é exatamente `tria:contas-a-pagar:<taskId>` | `false` |
| 503 | `CONFIGURACAO_AUSENTE` | credencial Omie (`OMIE_TRIA_APP_KEY`/`OMIE_TRIA_APP_SECRET`) ausente para o Centro de Custo resolvido — a dependência está inutilizável, repetir não resolve | `false` |

Reusados sem alteração: `401 CREDENCIAL_AUSENTE`, `401 CREDENCIAL_INVALIDA`, `400 SCHEMA_INVALIDO`, `422 REGRA_DE_DOMINIO`, `500 ERRO_INTERNO` (não classificado, tratado como transitório só quando a fonte é explicitamente `ErroTransitorioDaPlataforma`).

`retryable` é o campo que 03-11 usa para decidir: `false` → A7 falha permanentemente e A8 não move o Status; `true` → a fila de reagendamento tenta de novo.

**Plano pós-auditoria (1.2 e 1.4).** Os erros permanentes passam a vir como `422` com `retryable: false` e um motivo legível em `error.details.motivo` (≤ 300 caracteres) — códigos novos `FORNECEDOR_NAO_RESOLVIDO`, `OMIE_RECUSOU` e `CONTA_CORRENTE_NAO_RESOLVIDA`, além dos de cima; os transitórios, `500`/`503` com `retryable: true`. A A7 saiu (1.5): quem consome é a ponte do `apps/api` (`apps/api/src/automacoes/invocar-agente.ts`), quando a conta entra em "em lançamento omie". Erro permanente → um Comentário do Agente na conta, `Não consegui lançar no Omie: <details.motivo> (<code>).` (sem `details.motivo`, a `message` do envelope), uma vez; a conta não é mais processada até um Campo mudar ou ela sair e voltar para o Status. Transitório → conta como falha seguida; na terceira, um aviso e a mesma parada. O `details.motivo` vai para a conta, nunca para o log da ponte. Prazos da ponte: `/resolver` 10 s, `/lancar` 60 s.

---

## §5 Idempotência

Uma única chave serve dois papéis — o cabeçalho HTTP e o campo do Omie:

```text
Idempotency-Key: tria:contas-a-pagar:<taskId>
codigo_lancamento_integracao: tria:contas-a-pagar:<taskId>   (o mesmo valor, dentro do Omie)
```

Determinística, derivada do passo lógico (a Tarefa), **nunca** de `Date.now()` ou de um valor aleatório — o mesmo princípio do §7 de `04-contrato-plataforma-v1.md`.

A garantia real não é uma tabela de idempotência: é a CONSULTA antes da inclusão. `contas-a-pagar-lancamento.ts` chama `ConsultarContaPagar` (via `omieAdapter.consultarContaPagarPorCodigoDeIntegracao`) ANTES de `IncluirContaPagar` — encontrado, devolve `reaproveitado: true` com o `payableId` existente; não encontrado, inclui. Isso cobre inclusive o caso em que o Omie gravou e a conexão caiu antes da resposta chegar ao chamador (V02-CUT): a segunda chamada consulta, encontra, e não inclui de novo. Nenhuma tabela de idempotência nova nasce no `automation/` para isto — seria uma segunda fonte de verdade a manter sincronizada com o que o Omie já garante.

---

## §6 Ensaio (D3-03)

A primeira semana do Agente é Ensaio: ele calcula o que lançaria e registra ao lado do que o humano lançou, **sem nenhuma escrita no Omie**. Isso não é um campo `ensaio: true` no corpo — é estrutural: 03-11 chama SÓ `POST /resolver` durante o Ensaio. O módulo que serve `/resolver` (`contas-a-pagar-resolucao.ts`) recebe, por injeção de dependência, apenas uma porta de catálogo (leitura) e uma porta de categorias (leitura); não existe porta de escrita no módulo, não existe referência a `IncluirContaPagar`. Um corpo forjado, um default errado ou uma condicional mal colocada não bastam para fazer `/resolver` lançar dinheiro, porque o endereço que 03-11 chama durante o Ensaio literalmente não sabe escrever — a propriedade é verificável por asserção de fonte (`grep`), não por revisão de código.

Depois do corte para produção, 03-11 passa a chamar `POST /lancar` com a `Idempotency-Key` de §5, e A8 (dentro de `apps/api`) move o Status a partir do resultado.

---

## §7 Versionamento e deriva

Esta superfície nasce v1 PRÓPRIA — o congelamento do contrato de Solicitação de pagamento (§9 de `04-contrato-plataforma-v1.md`) não é tocado por este documento, e este documento não é regido por aquele congelamento: são dois contratos irmãos, não um contrato e sua extensão. Uma mudança de forma aqui segue a mesma disciplina que lá — nova versão de rota (`/v2/...`), nunca mutação retroativa — mas é uma decisão independente, tomada quando (e se) esta superfície precisar mudar.

**v1.1 (aditiva, 2026-09-29).** A Conferência do Resumo (Fase 6) precisou de quatro campos novos — `pedidoDeRevisao` e `codigoCategoriaConfirmado` nos pedidos de `/resolver` e `/lancar`, `anexos[]` como `{ url, nome }` no pedido de `/lancar` e `anexos[].nome` na resposta —, e eles entraram como v1.1 no MESMO endereço, não como `/v2` (D6-05). O motivo: nenhum deles muda a forma do que já existia. A regra que torna isso seguro, e que vale para qualquer v1.x futura: **campo novo é sempre opcional e nunca muda o significado de um campo existente** — um corpo v1 continua válido e recebe exatamente a resposta de antes (os 16 exemplos v1 seguem idênticos), e os schemas continuam `.strict()`, então um produtor v1 recusa com `400` um campo v1.1 em vez de ignorá-lo em silêncio. O `/v2` continua sendo o caminho para uma mudança que quebre isso (campo que vira obrigatório, campo que muda de sentido ou de tipo). A prova são os exemplos canônicos novos em `contratos/contas-a-pagar-v1/` — `resolver.sucesso-pedido-de-revisao`, `resolver.sucesso-codigo-confirmado`, `lancar.sucesso-anexos-nomeados` —, validados contra o handler real no `automation/` (`contas-a-pagar-contrato.test.ts`) e copiados byte a byte para o `crm-n1`, onde `apps/api/src/automacoes/contrato-contas-a-pagar.test.ts` confere o hash de cada arquivo contra a cópia do produtor. Um ajuste só de endurecimento acompanhou: um anexo `""` (string vazia) passou a ser `400`, porque antes virava um download que sempre falhava — nenhum chamador mandava anexos até a v1.1.

Os tipos `DeParaDeLancamento`/`ResolucaoDeCategoria`/`OrigemDoDePara` são declarados em DOIS lugares — `packages/dominio/src/operations/financeiro.ts` (`crm-n1`) e `../financeiro-tria/automation/src/tenants/tria/contas-a-pagar-resolucao.ts` — como espelho literal, não como pacote compartilhado (mesmo princípio do §9 de `04-contrato-plataforma-v1.md`: artefatos compartilhados são COPIADOS entre os dois repositórios). Quem detecta deriva entre as duas cópias é o `.strict()` de `apps/api/src/rotas/esquemas/financeiro.ts` com o portão `Confere<Igual<…>>` (IN-10, Plan 03-04) — um campo a mais, a menos ou com outro nome quebra a compilação do lado de `apps/api`, não deste documento.
