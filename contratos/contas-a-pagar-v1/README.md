# `contratos/contas-a-pagar-v1/`

Exemplos canônicos das duas rotas que a ponte do Agente de lançamento
(`crm-n1`, `apps/api/src/automacoes/invocar-agente.ts`) chama neste backend:
`POST /v1/integrations/contas-a-pagar/resolver` e `.../lancar`
(`src/http/contas-a-pagar-routes.ts`).

## Quem é dono de quê

O PRODUTOR é este repositório: os arquivos nascem aqui e
`src/http/contas-a-pagar-contrato.test.ts` prova que cada um é exatamente o que
o handler real devolve. O CRM N1 **copia a pasta verbatim** (mesma convenção de
`payment-requests-v1/`, no sentido inverso) e prova do lado de lá que a ponte
classifica cada exemplo do jeito certo. Não é pacote npm: é cópia, e a
igualdade entre as duas cópias é conferida por hash, não por import.

## Formato

Um arquivo por caso, `<rota>.<categoria>.json`:

```json
{
  "descricao": "...",
  "requisicao": { "metodo": "POST", "caminho": "/v1/integrations/contas-a-pagar/lancar", "headers": { ... }, "body": { ... } },
  "resposta": { "status": 422, "corpo": { ... } }
}
```

## O que a ponte decide com isto

| HTTP | `retryable` | O que fazer |
|---|---|---|
| 200 | — | `/lancar`: `payableId` é o `codigo_lancamento_omie`; `reaproveitado: true` (o título já existia) também é sucesso. |
| 422 | `false` | Permanente: comentar `error.details.motivo` na conta e não repetir até um Campo mudar. |
| 503 | `false` | `CONFIGURACAO_AUSENTE` — permanente (credencial do Omie ausente). |
| 400/401 | `false` | Defeito do chamador (corpo, chave, token). |
| 500 | `true` | Transitório: repetir depois — é seguro, o `/lancar` consulta o Omie antes de incluir. |

`error.message` é fixo por `error.code`; o que varia vem só em
`error.details.motivo`: texto em português, até 300 caracteres, sem segredo e
sem chave Pix, código de barras ou valor. Trate-o como texto opaco — a redação
pode mudar; quem decide é `code` + `retryable`.

Códigos permanentes: `REGRA_DE_DOMINIO` (Categoria sem confiança),
`CENTRO_DE_CUSTO_NAO_ROTEADO`, `CONTA_CORRENTE_NAO_RESOLVIDA`,
`FORNECEDOR_NAO_RESOLVIDO`, `OMIE_RECUSOU`, `CONFIGURACAO_AUSENTE`.
Transitórios: `OMIE_INDISPONIVEL`, `DEPENDENCIA_INDISPONIVEL`.

## v1.1 (aditiva)

Quatro campos OPCIONAIS, sem rota nova e sem mudar o significado de nenhum
campo existente — um corpo v1 continua valendo e recebendo a mesma resposta:

| Onde | Campo | O que faz |
|---|---|---|
| `/resolver` e `/lancar` | `pedidoDeRevisao` (até 500 caracteres) | Pedido de ajuste do Financeiro: entra no fim da consulta do RAG. Nunca aparece em log nem em `details.motivo`. |
| `/resolver` e `/lancar` | `codigoCategoriaConfirmado` (`2.06.01`, `2.02.98.01`) | Código conferido pelo Financeiro: o RAG não é chamado; o código é validado no plano de contas do Omie (`resolvida` com similaridade 1, ou `revisar` com o motivo). |
| `/lancar`, pedido | `anexos[]` como `{ url, nome }` | Além da `string` da v1: o anexo sobe com esse nome (dentro do zip e no `cNomeArquivo`). |
| `/lancar`, resposta | `anexos[].nome` | Devolvido só quando o anexo veio nomeado. |

Exemplos: `resolver.sucesso-pedido-de-revisao`,
`resolver.sucesso-codigo-confirmado` e `lancar.sucesso-anexos-nomeados`.

## v1.2 (aditiva)

Anexos do `/lancar` seguros e honestos (fase 6, plano 06-07). Sem rota nova;
o que muda no PEDIDO é endurecimento de segurança, e a única mudança na
RESPOSTA é a forma de `anexos[]` (sem `url`, `erro` como código) — ver §7 de
`docs/08-migracao-financeiro/05-contrato-lancamento-contas-a-pagar-v1.md`.

| Onde | O que muda |
|---|---|
| `/lancar`, pedido | `anexos[].url` (string ou `{ url, nome }`) é URL absoluta com até 2048 caracteres; a lista tem no máximo 20 itens; `nome` é aparado e tem de 1 a 200 caracteres (só espaços é 400). |
| `/lancar`, download | Só `https:` de um hostname exato em `CONTAS_A_PAGAR_ANEXOS_HOSTS` (produção: o host do Storage do Supabase da plataforma). Fora da lista, a URL nem é tocada. Variável vazia ⇒ todo anexo sai `ANEXO_HOST_NAO_PERMITIDO` e o título ainda lança. Redirecionamento recusado; prazo de 15 s e teto de 15 MB por anexo; orçamento total de 35 s para os anexos (abaixo dos 60 s da ponte). |
| `/lancar`, resposta | Cada anexo é `{ nome, ok, jaExistia?, erro? }`. `nome` sempre presente: o do pedido, ou o último segmento do caminho da URL (sem query) para um anexo `string`. **Sem `url`** (a URL assinada carrega token). |
| `/lancar`, resposta | `erro` é um de cinco códigos: `ANEXO_HOST_NAO_PERMITIDO`, `ANEXO_DOWNLOAD_FALHOU`, `ANEXO_TEMPO_ESGOTADO`, `ANEXO_GRANDE_DEMAIS`, `ANEXO_OMIE_RECUSOU` — nunca status HTTP, texto de rede ou do Omie. `ok: false` ⇔ `erro` presente. |
| `/lancar`, `reaproveitado` | O backend lê os anexos do título (`ListarAnexo`) e sobe só os que faltam, pelo nome; os que já estavam voltam `{ ok: true, jaExistia: true }`. Nunca `anexos: []` quando havia anexos pedidos. `jaExistia` só aparece com `ok: true`. |

Falha de anexo continua sem falhar o lançamento: o título sai, o anexo vem
`ok: false` com o código.

Exemplos novos: `lancar.sucesso-anexos-com-falhas` (os cinco códigos),
`lancar.sucesso-reaproveitado-com-anexos` (`jaExistia`) e
`lancar.erro-400-schema-invalido-anexos`. `lancar.sucesso-anexos-nomeados`
passou à forma v1.2 da resposta (o pedido é o mesmo).

## Dados

Inventados: token `token-de-exemplo-nunca-real`, Tarefa `tsk_00001a`, CNPJ de
exemplo `11.222.333/0001-81`, `Fornecedor Fictício LTDA`, URLs em
`https://exemplo.invalid/`. Nenhum dado real entra
aqui — esta pasta fica no git para sempre.
