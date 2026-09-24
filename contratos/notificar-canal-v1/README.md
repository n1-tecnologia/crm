# `contratos/notificar-canal-v1/`

Fixtures canônicas do contrato ponta a ponta de `automacao.notificar-canal.v1`
(AUTO-02, D5-19) entre `apps/api` (`crm-n1`) e `automation/`
(`financeiro-tria`) — o mesmo precedente de `contratos/payment-requests-v1/`,
mas no sentido oposto: ali `crm-n1` é o produtor do contrato HTTP v1 e
`automation/` o consumidor; aqui `crm-n1` é o produtor do EVENTO de outbox
(`apps/api/src/persistencia/outbox.ts::EVENTOS`) e `automation/` o consumidor
da rota `POST /webhooks/plataforma/notificar-canal`
(`../financeiro-tria/automation/src/http/notificar-canal-routes.ts`).

## Por que esta pasta existe (Critério 4, `05-VERIFICATION.md`, CR-02)

Antes deste plano (05-24, fechamento de lacunas), cada lado testava só a
própria metade: o domínio (`packages/dominio/src/operations/automations.ts`)
provava que `destinoDeCanal` resolvia um destino, e o `automation/`
(`notificar-canal-routes.ts`) provava que a rota aceitava UM payload
fabricado à mão — nenhum teste provava que os dois concordavam sobre a MESMA
Tarefa. Essa é exatamente a classe de defeito que CR-02 (`05-REVIEW.md`)
descreveu.

Estas três fixtures fecham essa lacuna: são GERADAS do seed real por
[`apps/api/src/contratos/notificar-canal.contrato.test.ts`](../../apps/api/src/contratos/notificar-canal.contrato.test.ts)
(monta o Estado, publica as Automações de Canal reais, dispara o gatilho,
deriva o evento de outbox e o DTO v1 pelo caminho real — nunca fabricados à
mão) e CONSUMIDAS por
[`../financeiro-tria/automation/src/http/notificar-canal.contrato.test.ts`](../../../financeiro-tria/automation/src/http/notificar-canal.contrato.test.ts)
(a rota real + o adapter real, sobre o MESMO par evento/DTO).

**A regra:** deriva de um lado sem o outro é vermelho em algum dos dois.

- O domínio, o DTO v1 (`apps/api/src/servicos/dto-solicitacao.ts::paraDtoV1`)
  ou o schema do outbox mudam sem a fixture ser regenerada → o teste do
  `crm-n1` (gerador/verificador) fica vermelho, porque o gerado (normalizado)
  deixa de bater com o JSON versionado.
- A rota do `automation/` (mapeamento de Campo, gate de Empresa, rótulos
  conhecidos) muda sem acompanhar a fixture já regenerada → o teste do
  `automation/` (consumidor) fica vermelho, porque a rota real recusa (ou
  aceita errado) o par que o `crm-n1` provou ser real.

## As três fixtures

| Arquivo | O que prova |
|---|---|
| `campo.gasto-novo.json` | Modo `campo` (D5-19): a Automação com `canalCampoDestinoId: fld_sp_z_whatsapp` sobre a Solicitação do Marcos Paulo — o domínio resolve `destinoTipo: "campo"` lendo `fld_sp_z_whatsapp`, e o `automation/` resolve o MESMO destino contra `requesterWhatsApp` do DTO v1 real (o mesmo Campo, dois lados, `CAMPO_ID_PARA_CHAVE` do `automation/` de-para exatamente para esse id). |
| `rotulos.gasto-novo.json` | Modo `rótulos`: a Automação com `canalDestinatariosDaEmpresa: true` sobre a mesma Solicitação — o domínio resolve os três rótulos estáveis da Integração do Marcos Paulo (`avisosPorCanal.whatsapp`, `configuracao-por-empresa.ts`), e o `automation/` prova que TODOS pertencem a `ROTULOS_CONHECIDOS` (o mapa rótulo → número do ambiente). |
| `sem-canal.tria.json` | A recusa por Empresa sem canal (WR-02): a Tria Company não declara `avisosPorCanal` — o domínio recusa as duas Automações (zero eventos reais, afirmado no teste gerador), e o `automation/` recusa `422 EMPRESA_SEM_CANAL` pelo MESMO caminho (`tenantDaEmpresa`) que protegeria qualquer Empresa sem canal, mesmo que o payload chegasse. Como não existe execução real para gerar o evento, esta fixture carrega um evento **`"sintetico": true`** — montado à mão no MESMO formato de payload (validado pelo mesmo schema `EVENTOS["automacao.notificar-canal.v1"]`), só para o `automation/` ter algo para postar contra a rota real. O consumidor remove o campo `sintetico` antes de postar (o schema `.strict()` da rota não o conhece — é um marcador de documentação, nunca parte do contrato). |

Cada arquivo é `{ versao: 1, caso, evento, tarefa, esperado }`:

- `evento` — a MESMA forma que `outbox-worker.ts::entregar` monta no corpo
  real da entrega: `{ eventId, occurredAt, ...payload }`, onde `payload` é
  exatamente `EVENTOS["automacao.notificar-canal.v1"]` (nunca o valor do
  Campo nem o número que um rótulo representa — payload pobre, doutrina de
  `apps/api/src/persistencia/outbox.ts`).
- `tarefa` — o DTO v1 (`PaymentRequestDtoV1`) que `paraDtoV1` projeta da
  MESMA Tarefa que gerou o evento — o que o `automation/` recebe de volta ao
  chamar `getTask` (via `criarPlataformaAdapter(...).getTask`, validado pelo
  schema real do adapter).
- `esperado` — o resultado que o consumidor deve produzir: `{ destinos: [...] }`
  para o modo campo, `{ rotulos: [...] }` para o modo rótulos, `{ http, code }`
  para a recusa.

## Normalização

Antes de comparar ou gravar, o gerador substitui por literais fixos o que é
identidade de INSTÂNCIA de teste, nunca o que o contrato fixa:

- `eventId`, `occurredAt` — o outbox real gera um id de linha e um instante
  de gravação; a fixture fixa os dois.
- `taskId`, `executionId`, `readableId` — gerados por sequência a partir de
  um `buildSeed()` fresco a cada execução; deterministicamente estáveis
  entre execuções (o teste roda duas vezes seguidas, sem `ATUALIZAR_CONTRATO`,
  e compara o mesmo resultado), mas fixados mesmo assim, por segurança contra
  deriva de ordem de sequência.
- `createdAt`/`updatedAt` da Tarefa — `now()` do domínio é relógio real
  (`new Date().toISOString()`), não injetável; sempre normalizado.

Nunca normalizado — é exatamente o que o contrato fixa: `campoDestinoId`,
`destinoTipo`, `rotulos`, `mensagemId`, `fields.company`,
`fields.requesterWhatsApp` (e o resto de `fields`, derivado do mesmo DTO
real).

## Como regenerar

```bash
(cd apps/api && ATUALIZAR_CONTRATO=1 npx vitest run src/contratos/notificar-canal.contrato.test.ts --testTimeout=20000)
```

Regenerar é um ato **deliberado**, feito no MESMO commit que muda o lado que
derivou (domínio, DTO v1 ou schema do outbox) — nunca um "para fazer o teste
passar" isolado. Depois de regenerar:

1. Inspecione as três fixtures reescritas: nenhum número de telefone real,
   nenhum texto de mensagem, nenhum segredo, nenhum dado pessoal real (o seed
   é fixture — ver "Dados das fixtures" abaixo).
2. Rode de novo SEM a variável para provar que a comparação passa:
   `(cd apps/api && npx vitest run src/contratos/notificar-canal.contrato.test.ts --testTimeout=20000)`.
3. Rode o teste consumidor do `automation/` — ele precisa passar DEPOIS da
   regeneração, no MESMO commit:
   `(cd ../financeiro-tria/automation && npx tsx --test --test-concurrency=1 src/http/notificar-canal.contrato.test.ts)`.

## Dados das fixtures

Inventados e inofensivos, de propósito: `Fornecedor Fictício LTDA`/
`Fornecedor Fictício Dois LTDA` (nomes fictícios, mesmo padrão de
`payment-requests-v1`), `amountCents: 123456`/`98765` (valores de exemplo),
WhatsApp de teste como texto com hífens (`whatsapp-fixture-canal-mp-01`),
nunca uma sequência de dígitos que pareça telefone real. Nenhum CPF/CNPJ
real, chave Pix real, nome de fornecedor real ou número de WhatsApp real
entra aqui — este diretório é versionado e fica no git para sempre.
