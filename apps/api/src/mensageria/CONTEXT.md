# mensageria

Ler primeiro: [`../../CONTEXT.md`](../../CONTEXT.md) e [`../CONTEXT.md`](../CONTEXT.md)

A entrada e a saída de rede das mensagens, sobre o domínio. O que uma Mensagem é e as regras de recebimento
estão em `@n1/dominio/crm/` (o tipo do que entra, `RecebidaDoProvedor`, está em `crm/recebimento`) e em
`servicos/crm/recebimento.ts` (`receberMensagem`, a única porta da recebida). Aqui mora o que fala com o
provedor de fora.

## A interface (`provedor.ts`)

`ProvedorDeMensageria` é a interface única: `verificarChamada`, `interpretarChamada`, `chaveDaChamada`
(opcional), `enviar`, `baixarMidia`, `estadoDaConexao`. Tudo que fala com provedor (webhook, fila de entrada,
saída, mídia, Evolution) é construído contra ela; as Sessões 4, 7, 8 e 9 só ligam uma implementação nova.

- `EventoDoProvedor` compõe o `RecebidaDoProvedor` do domínio e acrescenta `status`, `conexao` e `ignorado`
  (o tradutor diz por que descartou: grupo, `fromMe`, sem número).
- `ResultadoDoEnvio` separa `transitorio` de permanente e marca `ambiguo` quando o provedor pode ter enviado
  (timeout, resposta perdida): quem chama nunca reenvia sozinho um ambíguo.
- `CanalParaProvedor` junta o Canal, o segredo do webhook e a credencial já decifrada. Só existe dentro do
  `apps/api`, vive o tempo de uma chamada e nunca vai a log, a resposta nem a mensagem de erro.
- `baixarMidia` de qualquer implementação só fala com o host fixo do provedor (a das Sessões 7 e 8 recebe
  URL da Meta e confere o host). O provedor de teste não faz rede.

## O registro (`registro.ts`) e a regra D-16-03

`provedorDoCanal(canal)` devolve o provedor de teste SÓ quando `conexaoSimulada = true`. Um Canal real sem
implementação registrada lança `ErroDeProvedor("PROVEDOR_INDISPONIVEL")`: nunca cai no de teste, para o
atendente jamais ver "enviada" numa Mensagem que não saiu para o WhatsApp (MSG-05). Um Canal que deixa de ser
simulado perde o provedor de teste na hora.

`canalParaProvedor(cliente, chaves, workspaceId, canal)` lê do cofre (`servicos/cofre.ts`) o segredo do
webhook (`donoTipo: "canal"`, `tipo: "webhook_segredo"`) e, para Canal real, a credencial cujo `tipo` é o nome
do provedor. Nesta fase o registro só tem o de teste; o plano 16-11 acrescenta `whatsapp-nao-oficial`.

## O segredo do webhook

Um nome de cabeçalho só, `x-n1-webhook-segredo` (`CABECALHO_DO_SEGREDO`), para o provedor de teste e para a
Evolution (D-16-06). Não existe segredo fixo de teste: cada Canal simulado tem o seu no cofre, gerado por
`npm run canal:segredo-de-teste -w @n1/api -- --canal <id>` (mostrado uma vez, revoga o anterior, recusa Canal
real). O provedor de teste compara em tempo constante e recusa a chamada sem segredo ou com outro valor.

## O provedor de teste (`provedores/teste.ts`)

Serve ao CI e à demonstração da Caixa num Canal simulado. Corpo aceito: `{ eventos: [...] }` com três formas
(`mensagem`, `status`, `conexao`), validado por zod `.strict()`. `enviar` grava em memória e devolve
`idExterno = "teste-<uuid>"` (ou o próximo resultado programado) e recusa Canal real; `baixarMidia` lê só do
depósito em memória.

## O conjunto de contrato (`contrato-do-provedor.ts`)

`descreverContratoDoProvedor(nome, fabrica)` registra os casos que valem para qualquer implementação (segredo,
tradução de texto, corpo inválido sem exceção, envio, teto de mídia, nenhum segredo em resultado ou erro).
`provedor.test.ts` o roda contra o de teste; a Evolution (16-12) e os provedores das Sessões 4, 7, 8 e 9 rodam o
mesmo contra o seu.

## Regra de log

Nada aqui loga corpo, texto de Mensagem, telefone, segredo, credencial nem `apikey`. Log de erro leva o
código e o id interno, nunca o conteúdo.

## Mapa dos arquivos (o que os planos seguintes acrescentam)

| Arquivo | Plano | O que é |
|---|---|---|
| `provedor.ts`, `registro.ts`, `provedores/teste.ts`, `contrato-do-provedor.ts` | 16-02 | a interface, o registro, o provedor de teste, o contrato |
| processador de entrada | 16-03 | a fila de entrada e quem a esvazia |
| entregador | 16-05 | a saída pelo provedor |
| mídia | 16-10 | baixar e guardar a mídia recebida |
| avisar, ouvinte, hub de eventos | 16-07 | o tempo real (SSE) |
| `provedores/evolution/` | 16-12 | a Evolution (cliente, tradutor, provedor) |
