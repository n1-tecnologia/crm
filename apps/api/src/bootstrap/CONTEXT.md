# Bootstrap — o dado inicial de produção

Ler primeiro: [`../../CONTEXT.md`](../../CONTEXT.md)

## O que é

`bootstrapGestao()` grava, num Espaço de Trabalho vazio, o `DataState` de
`@n1/dominio/bootstrap-gestao` (`buildGestaoBootstrap()`): o Espaço "Gestão"
› Pasta "Financeiro" › Listas "Contas a pagar" e "Contas a receber",
configuradas conforme os SPECs de processo — Status, Campos, Tags, Papéis,
Agente de lançamento, Automações — e a Maryane como única Membro,
Proprietária (D-07, D-08, D-09).

Não é seed de teste. `packages/dominio/src/seed.ts` (`buildSeed()`) é o
protótipo em memória do `apps/web`, com ~900 registros de CRM, IA e Tarefas
fictícias; este bootstrap é o oposto — só o que o Financeiro de verdade vai
usar, sem nenhuma Tarefa, Contato, Negócio ou Registro de Atividade
inventado.

**Sem Funil (D-15-13).** Um Espaço novo nasce sem Funil e sem nada do CRM:
`Workspace` não tem mais `defaultFunnelId`, e o Funil padrão do Espaço é o de
`plataforma.funis.padrao`, criado pela tela de Funis. Rodar o bootstrap de
novo recusa ("o Espaço já tem registros") e nunca cria Funil.

## Quando rodar

Uma vez, depois de `npm run migrar -w @n1/api` (schema aplicado) e de
`npm run usuarios:seed -w @n1/api` (a conta `maryane@n1.teste` existe no
Supabase Auth):

```
npm run bootstrap:gestao -w @n1/api
```

## O que NÃO faz

Não reaplica configuração por cima de dado real, e não apaga nada.
`bootstrapGestao()` só grava em Espaço de Trabalho vazio (`0` registros em
`plataforma.registros`); a segunda execução encontra registros e devolve
`{ criado: false, motivo }` sem tocar o banco. Reaplicar configuração sobre
Tarefas reais (por exemplo, uma Automação nova) é trabalho futuro — o lugar
certo é filtrar `gravar()` por coleção, não este arquivo.

## Onde mora o conteúdo

`@n1/dominio/bootstrap-gestao` — `buildGestaoBootstrap()` é puro, sem banco,
e tem os próprios testes. Este módulo só grava o que ele monta, com
`semear()` (`../persistencia/repositorio.ts`), a mesma escrita que qualquer
importação usaria.

## O demo do CRM (`bootstrap:crm-demo`, 15-29, D-15-13)

Depois da 3.5.3 o seed não cria CRM: um Espaço novo nasce sem Contato, Empresa, Funil, Negócio, Canal e Conversa,
e a Caixa de Entrada fica vazia. Para **desenvolvimento**, `crm-demo.ts` dá a um Espaço local o CRM de mentira
que o seed antigo tinha, agora nas tabelas do CRM novo (39 Contatos, 12 Empresas, 4 Funis com 23 Etapas, 19
Negócios, 3 Canais, 16 Conversas e 62 Mensagens):

```
DATABASE_URL=postgres://postgres:x@localhost:5432/postgres npm run bootstrap:crm-demo -w @n1/api -- --espaco ws_dev
```

**É só de desenvolvimento.** Nunca roda em produção nem em banco remoto:

- o host de `DATABASE_URL` tem de ser `localhost`, `127.0.0.1` ou `[::1]`, e a URL **não pode ter query** (`?host=` e `?hostaddr=`
  trocam o destino que o `pg` usa; a regra é `persistencia/host-local.ts`, a mesma de `testes/banco-crm.ts` e da CLI do corte,
  15-44, M-01), conferido
  **antes** de abrir o pool e de novo dentro de `carregarCrmDemo` antes da primeira consulta. O `apps/api/.env` aponta
  para o banco real, então rode sempre com a `DATABASE_URL` local explícita; sem ela o script recusa;
- `--espaco` é obrigatório, tem de casar `^ws_[a-z0-9_]+$` e **já existir** em `plataforma.workspaces` (o script não cria
  Espaço: use `semear(buildSeed())`, o `bootstrap:gestao` ou o fluxo de dev que o criou);
- o Espaço não pode ter **nenhum Contato**. Rodar de novo recusa ("o Espaço já tem Contatos") e não duplica nada: a
  conferência roda dentro da transação, com a linha do Espaço travada.

Saída: `0` ok, `2` recusa ou erro de uso, `1` erro inesperado. A recusa de banco remoto sai com `2` sem abrir conexão.

**Como se prova que os ids preservados acham o registro (15-31).** O seed novo guarda só os Vínculos que sobraram; o
teste dos Vínculos de `crm-demo.test.ts` lê, por isso, os 64 `links` da fixture congelada do seed de antes
(`migracao-crm/fixtures/crm-antigo-do-seed.json`), confere que todo Vínculo do seed novo está nela e exige
`procurados > 0`: assim a prova não passa vazia quando o seed deixa de ter CRM.

**De onde vêm as linhas.** `crm-demo.json` foi gerado UMA vez pelo mapeador do 15-28 (`planejarMigracao` e
`planejarFunis`) sobre a fixture sintética congelada do seed antigo (`migracao-crm/fixtures/crm-antigo-do-seed.json`),
com um script descartável fora do repositório; nunca de dado de produção. Os ids antigos foram preservados, então os
Vínculos de Tarefa, a `provenance` e os escopos que o seed novo ainda guarda em `registros` apontam para o que o demo
carrega. As Etapas têm ids fixos no JSON. O que o mapeador deixou de fora (temperatura, Tags, Canal do chat do site e
do LinkedIn e as Conversas deles...) está em `naoMigrados` do JSON, só como coleção, id e categoria. **Este arquivo não
importa nada de `migracao-crm/`** (que sai do repositório depois do corte) nem do modelo antigo do domínio: só lê o JSON.

**Como grava.** Uma lista de colunas constante por tabela (`COLUNAS_POR_TABELA`), um `insert ... select` por tabela e
por pedaço de 500 linhas com `jsonb_to_recordset`, na ordem das chaves estrangeiras (Funis, Etapas, Canais, Contatos —
sobreviventes antes dos mesclados —, Identificadores, Empresas, vínculos, Negócios, Conversas, Mensagens, consentimentos),
numa transação só. Nome de tabela e de coluna vêm só de constantes, todo valor entra por `$n` e o `workspace_id` é o
argumento, nunca um campo do JSON (T-15-73). `crm_de_para` fica vazio: o demo não é uma migração.

**Os Canais do demo nascem `desconectada`**, como os da migração: a Caixa mostra as Conversas, mas nada envia nem
recebe de verdade. Para refazer o demo num Espaço, apague o CRM do Espaço (ou crie outro); o script nunca apaga.

## Os comandos dos Canais de mensageria (Fase 16)

Dois comandos de linha cuidam do que a tela de conexão ainda não faz (desde a Sessão 4 o "Conectar" com QR liga a instância
que o CRM cria; `canal:ligar-evolution` segue para a que o dono criou à mão). Nenhum deles é de desenvolvimento
só: os dois falam com o banco que o `DATABASE_URL` apontar, então rode-os sabendo qual é. Os testes rodam só contra
Postgres local e contra a Evolution falsa de `testes/servidor-falso.ts`.

**`evolution:fumaca` (Sessão 4).** `npm run evolution:fumaca -w @n1/api` confere, contra a Evolution configurada, cada chamada que o
"Conectar" pelo CRM faz, com uma instância descartável `n1-fumaca-...` sem número que ela mesma apaga. Não usa o banco. Sai 0
(tudo certo), 1 (algum passo falhou) ou 2 (faltou `EVOLUTION_URL`, `EVOLUTION_API_KEY` ou `API_URL_PUBLICA`). O último passo
espera até ~10 s a instância sair da lista da Evolution, que a mantém ~1 s depois do `DELETE`. Ver
`mensageria/CONTEXT.md`.

**`canal:segredo-de-teste` (16-02, D-16-03).** `npm run canal:segredo-de-teste -w @n1/api -- --canal <id>` gera o
segredo do webhook de um Canal **simulado**, guarda no cofre (`donoTipo: "canal"`, `tipo: "webhook_segredo"`), revoga o
anterior e o mostra uma única vez, com o caminho, o cabeçalho e um `curl` de exemplo. Canal real é recusado (sai com 2):
o WhatsApp de verdade se liga pelo comando abaixo.

**`canal:ligar-evolution` (16-13, D-16-05, D-16-06, MSG-06).**
`npm run canal:ligar-evolution -w @n1/api -- --canal <id> --instancia <nome> [--seco] [--url-publica <url>]` liga um
Canal `whatsapp-nao-oficial` à instância da Evolution do dono. Lê a instância com a chave global
(`GET /instance/fetchInstances?instanceName=`), exige `connectionState` `open`, confere o número conectado com o do
Canal (`conferirNumeroConectado`, que tolera o nono dígito brasileiro), gera o segredo do webhook, aponta o webhook da
instância para `<API_URL_PUBLICA>/webhooks/mensageria/<canalId>` com o segredo no cabeçalho `x-n1-webhook-segredo` e,
numa transação, guarda no cofre o segredo e a credencial do Canal (`tipo: "whatsapp-nao-oficial"`, JSON
`{ instancia, apikey }`), marca o Canal `conectada` com `conexao_simulada = false` (`conexao_confirmada`), sobe a
revisão do Espaço e reenfileira as Mensagens `pendente` do Canal.

- **Nunca liga a `numeropvmarcos`.** Essa instância é do `automation/` (extratos e avisos do Financeiro): o comando a
  recusa, sem diferença de maiúsculas e espaços, antes de qualquer chamada à rede ou ao banco, com código 2. Nenhum
  teste nem fixture configura webhook ou guarda credencial dela.
- **O cofre guarda o token da instância, nunca a chave global.** A global cria e apaga instâncias, inclusive a do
  Financeiro. Se `fetchInstances` não devolver o token, o comando recusa e explica; usar outra credencial no lugar é
  decisão do dono (RESEARCH, A10), não do comando.
- **Ordem e falha no meio.** Tudo o que pode recusar vem antes do `webhook/set`; ele vem antes da transação. Se o
  `webhook/set` falha, nada é gravado. Se a transação falha depois dele, a instância já aponta para um segredo que o
  banco não tem: as chamadas dela recebem 401 até o comando rodar de novo (a saída avisa), nunca um Canal `conectada`
  sem webhook.
- **Rodar de novo é seguro.** Troca o segredo (o anterior é revogado), reaponta o webhook e deixa o Canal `conectada`.
- **`--seco`** percorre o mesmo caminho até a conferência do número e para: mostra a versão da Evolution (`GET /`), o
  estado da instância, se o número confere (só os 4 últimos dígitos) e a URL do webhook que seria configurada, sem
  escrever na Evolution, no banco nem no cofre (nem pede a `COFRE_CHAVE`).
- **Saída.** Nenhuma linha mostra a chave global, o token da instância ou o segredo do webhook; do número, só o final.
  Sai com `0` ok, `2` recusa ou erro de uso, `1` erro inesperado.
- **Ambiente.** `EVOLUTION_URL` (base da Evolution), `EVOLUTION_API_KEY` (a chave **global** da Evolution: passe-a só na
  linha de comando, não no `api.env` do runtime, que só precisa de `EVOLUTION_URL`), `API_URL_PUBLICA` (o endereço público
  da API, ou `--url-publica`) e `COFRE_CHAVE`, que tem de ser **a mesma do `api.env` de produção**: o runtime decifra o
  que o comando cifrou. O comando grava no banco do `DATABASE_URL`; para ligar o Canal de produção, rode-o com a
  `DATABASE_URL` e a `COFRE_CHAVE` de produção, de uma máquina com acesso ao banco.

**`canal:atualizar-webhook-evolution` (Sessão 4, 4.4.5).**
`npm run canal:atualizar-webhook-evolution -w @n1/api -- --canal <id> | --todos [--espaco <id>] [--seco] [--url-publica <url>]`
reaplica, nas instâncias da Evolution já ligadas, a lista atual de eventos do webhook (`EVENTOS_DO_WEBHOOK`): o tique, a Mensagem
apagada e a editada entraram na 4.4.5, e uma instância conectada antes guarda a lista velha. Para cada Canal `whatsapp-nao-oficial`
ativo e não simulado lê a credencial `{ instancia, apikey }` e o segredo do webhook do cofre e chama `POST /webhook/set/<instância>`
com o token da instância e o endereço de sempre. **Não escreve no banco, não troca o segredo** (isso é do `canal:ligar-evolution`),
não usa a chave global e nunca toca a `numeropvmarcos`. Canal sem credencial ou sem segredo é pulado com o motivo; a Evolution que
falha num Canal não derruba os outros e o comando sai com 1. `--seco` percorre o caminho sem chamar a Evolution. A saída traz só o id
do Canal e o nome da instância. Ambiente: `EVOLUTION_URL`, `API_URL_PUBLICA`, `COFRE_CHAVE` e o `DATABASE_URL` de quem tem o cofre.

## Bootstrap × evolver (Plan 02-08)

Dois módulos deste diretório resolvem problemas diferentes, e nenhum dos dois
substitui o outro:

| | `gestao.ts` (Fase 1) | `solicitacoes.ts` (Fase 2) |
|---|---|---|
| Quando roda | uma vez, Espaço vazio | quantas vezes precisar, Espaço já vivo |
| Guarda | `count(*) > 0` recusa tudo | criar-ou-conferir por id; divergência recusa, nada é sobrescrito |
| Sobre o quê grava | o `DataState` inteiro (`semear()`) | só os elementos do catálogo que faltam (`executar()`/Unidade de Trabalho) |
| Toca Tarefa/Comentário? | Espaço está vazio — não há o que tocar | nunca — é a garantia central do evolver (V02-01A) |

`bootstrapGestao()` não serve para acrescentar a Lista "Solicitações de
pagamento" a um "Gestão" que já tem "Contas a pagar" em produção — a guarda
de Espaço vazio recusa. É para isso que o **evolver** existe:
`evoluirConfiguracaoDeSolicitacoes` (`@n1/dominio`) materializa o catálogo do
Plan 02-06 sobre o `DataState` já bootstrapado, e `configurarSolicitacoes()`
(`solicitacoes.ts`) é quem chama esse evolver contra o Postgres — em
`--dry-run` (hidrata, calcula o diff, faz `rollback`) ou `--apply` (grava de
verdade, dentro da mesma Unidade de Trabalho que qualquer operação usa).

**`--dry-run` é o padrão do CLI** (`npm run solicitacoes:configurar -w
@n1/api`): aplicar de verdade exige a flag `--apply` explícita — um acidente
de automação nunca grava sem essa intenção.

## O Membro de serviço "Agente do pipeline" (plano pós-auditoria, 2.2)

`solicitacoes:configurar` passa sempre `membroDeServico` ao evolver: quando
nenhum Membro ativo ocupa o Papel `rol_sp_agente_pipeline`, ele nasce por
`inviteMember` (e-mail de serviço `EMAIL_DO_AGENTE_DO_PIPELINE`, domínio
`.invalid`) e é ativado ali mesmo — sem `userId`, nenhum JWT resolve para
ele. Em seguida ganha, por `grantGovernanceAccess` (com motivo), `administrar`
nas Listas de Contas a pagar e a receber: é o que `runScheduledAutomations`
exige para o agendador rodar a agenda em nome dele, e o que a ponte do
lançamento precisa para ver a conta, publicar o Resumo e mover o Status. O
Papel continua Convidado. `--membro` precisa ser Administrador ou
Proprietário. Depois do `--apply`, tire `AUTOMACOES_ATOR_MEMBER_ID` do comando
da API: o agendador e a ponte passam a assinar pelo Membro de serviço
(`resolverMembroAgenteDoPipeline`, que só aceita Membro `ativo`).

## `contas-a-pagar:configurar` (plano pós-auditoria, 2.1 e 1.5)

`configurarContasAPagar()` (`contas-a-pagar.ts`) é o terceiro evolver do
mesmo molde, para a Lista "Contas a pagar" que já opera em `ws_n1`: aplica
`evoluirConfiguracaoDeContasAPagar` (`@n1/dominio/contas-a-pagar-evolver`),
que acrescenta à saída de "para pagar" o que o Omie exige (Categoria de
pagamento, Fornecedor, Nome do fornecedor) por `updateStatus`, e pausa a A7
legada por `pausarAutomacao` — as mesmas operações da tela. Só acrescenta:
um requisito que o catálogo não prevê é divergência, e nada é gravado.

```
npm run contas-a-pagar:configurar -w @n1/api            # dry-run (padrão)
npm run contas-a-pagar:configurar -w @n1/api -- --apply # grava
```

## O Processo de Projetos

`npm run projetos:configurar -w @n1/api -- --membro=<id>` materializa o manual
`docs/07-processos/processo-de-projetos.md`: Espaço "Produto e Tecnologia" ›
Pasta "Processo de Projetos" › 14 Listas. Mesmo molde dos outros evolvers:
dry-run por padrão, `--apply` explícito, ids literais, reaplicar só cria o que
falta e divergência recusa. Não toca Tarefa. `--membro` é obrigatório para a
Atividade não sair assinada por quem não aplicou, e a saída mostra o banco alvo.

`processo-de-projetos-catalogo.ts` foi gerado do `.md` do manual; as regras de
passagem e os motivos das decisões de mapeamento estão no cabeçalho de
`processo-de-projetos-evolver.ts`.
