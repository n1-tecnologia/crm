# Mapa das camadas

**Leia este arquivo antes de abrir o `CONTEXT.md` de qualquer camada.** Ele diz
o que existe, quem pode depender de quem, e onde uma mudança deve nascer.

## As três camadas

| Pasta | O que é | Depende de |
|---|---|---|
| `packages/dominio/` | O contrato: tipos, operações, leituras derivadas e seed. As regras de negócio. | nada |
| `apps/web/` | A interface. Next.js 16, App Router. | `@n1/dominio` |
| `apps/api/` | O backend. Fastify sobre `@n1/dominio`, persistência no Postgres da plataforma. | `@n1/dominio` |

## A regra de dependência

O domínio não conhece ninguém. A interface e o backend conhecem o domínio, e
**nunca um ao outro**. Uma seta de `web` para `api`, ou de `dominio` para
qualquer um dos dois, é um erro de arquitetura, não um atalho.

O motivo é o que torna a separação útil: as mesmas regras precisam valer nos
dois lados. Se a validação de um Negócio mora no domínio, a tela e o endpoint
aplicam a mesma, e não duas que divergem na primeira mudança.

## Onde uma mudança nasce

- Mudou **o que a coisa é** (um campo novo, uma regra, um status) → `packages/dominio/`
- Mudou **como aparece** (layout, texto, navegação) → `apps/web/`
- Mudou **como se guarda ou se serve** (persistência, endpoint, auth) → `apps/api/`

Quando a resposta for "as três", comece pelo domínio e desça. O contrário custa
retrabalho: a tela feita antes do tipo é a tela refeita depois dele.

## Estado atual

A partir da Fase 1, `apps/api` é um servidor Fastify de verdade: sobe em
processo próprio, verifica o JWT do Supabase em `Authorization: Bearer` e
resolve o Membro por `userId` dentro do Espaço de Trabalho — o backend
aplica a regra de acesso, não só a tela. `apps/web/src/dados/store.ts`
ainda monta o seed e hidrata em memória (isso muda no Plan 01-07): a partir
dele, o store passa a hidratar do `apps/api` por `GET /estado` e gravar por
`POST /operacoes/:nome`.

`apps/api/` existe para que o backend tenha onde nascer sem que a interface
precise ser reescrita: o domínio já está fora do frontend, num pacote que os
dois lados importam.

A partir da Fase 7, o CRM (Contatos, Empresas, Funis com Etapas e Negócios)
é o primeiro módulo com tabelas próprias — `apps/api/migracoes/007-crm.sql`,
uma tabela por entidade, fora de `plataforma.registros` — e com rotas REST
por recurso em `apps/api` (`/contatos`, `/empresas`, `/funis`, `/negocios`),
fora de `POST /operacoes/:nome` e de `GET /estado`. As telas de
`apps/web/src/app/(shell)/crm/` falam com essas rotas por HTTP
(`src/dados/crm/`), enquanto o resto do app continua hidratando o Espaço
inteiro por `GET /estado`. O modelo antigo do CRM em inglês (`Contact`,
`Company`, `Deal`, `Pipeline`) conviveu ao lado até a Fase 15, a de
unificação, que o tirou do código (ver "A partir da Fase 15"). Antes de aplicar a 007 num banco, `npm run migrar -w @n1/api --
--seco` lista o que `migrar` faria sem escrever nada.

A partir da Fase 8, o que faltava da Caixa de Entrada ganha tabelas próprias:
`apps/api/migracoes/008-canais-conversas-mensagens.sql` dá a Canal, Conversa
e Mensagem as tabelas `plataforma.canais`, `plataforma.conversas` e
`plataforma.mensagens`, com rotas REST `/canais`, `/conversas` e `/mensagens`
ao lado das do CRM. O Canal passa a ter `provedor` (WhatsApp oficial e não
oficial, Instagram, E-mail — a tabela está em
`@n1/dominio/provedores-de-canal`), e o que um Canal pode fazer (janela de
24 h, modelo, envio livre) é lido por (tipo, provedor) em `capacidadesDoCanal`,
não só pelo tipo. O Canal criado pela página nova de conexão
(`/crm/caixa-de-entrada/configuracoes/canais/conectar`) nasce `desconectada`
e conecta pelo provedor real (QR code no WhatsApp não oficial, login no
Instagram); "Simular conexão", sempre marcada, só existe onde
`PERMITIR_CONEXAO_SIMULADA=true` (Sessão 4: desenvolvimento, testes e
homologação, nunca produção); o popup de adicionar Canal das Listas deixou de criar Canal (Fase 15,
D-15-12): só escolhe entre os Canais de `plataforma.canais` e leva à página de
conectar, o único caminho que cria Canal. A projeção que levava os Canais da tabela ao modelo
antigo — em `GET /estado` e em `executar()` — saiu na Fase 15 (plano 15-33): o
Canal só existe em `plataforma.canais` e se lê por `GET /canais` (ver
`apps/api/src/persistencia/CONTEXT.md`). O fio da Conversa tem
uma aba por Canal e "Responder por"; o seed continua, marcado como demo. A 008
já está aplicada no banco da plataforma e é imutável: qualquer ajuste de
schema daqui em diante é uma migração nova, depois da última aplicada.

A partir da Fase 14, o modelo novo do CRM ganha o que só o antigo tinha, sem
trocar nenhuma tela ainda. A `011` (`apps/api/migracoes/011-crm-o-que-faltava.sql`)
acrescenta o estado `mesclado` ao Contato, as tabelas `contato_consentimentos`
e `contato_notas` (só inserção), `conversa_marcacoes` (estrela e leitura por
Membro), `na_lixeira_em` na Conversa e, vazias, `crm_de_para` e
`registros_crm_antigo`, que o script da Fase 15 enche. Está aplicada no banco
de produção desde 2026-11-05 (publicada com a API no commit `49f1b54`, depois de
um backup manual do schema `plataforma`), e daí em diante é imutável como as
outras. Um gesto que grava no CRM e em
`plataforma.registros` no mesmo commit passa por `executarGestoMisto`, que lê
o CRM dentro da transação do Espaço (`lerDoCrm`) e grava nas tabelas pelo
`aoConfirmar` de `executar()` (ver `apps/api/src/persistencia/CONTEXT.md`).
Sobre ele nasceram as rotas por recurso: notas e consentimentos do Contato,
`POST /contatos/:id/mesclar`, transferir Identificador, mover, atribuir, lixeira,
restaurar e marcar a Conversa, `GET /membros/:id/sucessao-no-crm` (a remoção de
um Membro passa os registros do CRM ao Sucessor no mesmo commit e libera as
Conversas dele) e `/tarefas-conversacionais`. A Tarefa conversacional passa a
nascer nas tabelas: criá-la abre a Conversa em `plataforma.conversas`, trocar o
Canal e ligar ou criar o Negócio vão por rota, e o cartão, a tabela e a ficha
leem Contato, Canal, última Mensagem e Negócio de um resumo em lote
(`POST /tarefas-conversacionais/resumo`), não do estado antigo. A única tela
nova da fase é a ficha de Contato (mesclar, transferir, notas e
consentimentos). O que a Fase 14 deixou para depois, a Fase 15 fez (ver adiante).

O plano de deploy da Fase 14 previa cortá-la em dois (decisão de corte de uma
vez, sem ponte entre as duas bases): os planos 14-01 a 14-14 são aditivos; os
14-15 a 14-17, que trocam os chamadores da web e tiram as quatro operações
antigas da Tarefa conversacional de `POST /operacoes/:nome`, só deveriam subir
na Fase 15, junto com o script de migração dos dados. Por decisão do dono, em
2026-11-05 a fase inteira subiu de uma vez (API na VM e `main` do
`n1-tecnologia/crm` em `49f1b54`): em produção, os ids antigos de Tarefa
conversacional respondem 404 e o fio da Conversa e o layout de três colunas da
ficha da Tarefa ainda leem o modelo antigo (até o corte da Fase 15, abaixo). Grupo
e Flow ficam no modelo antigo até as Sessões 6 e 7: o modelo antigo não saiu
por inteiro na Fase 15. A fronteira exata, as suposições adotadas, o que o
corte tira da tela e os itens abertos estão em
`.planning/phases/14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa/14-PROVAS.md`.

A partir da Fase 15, o CRM novo é o único no código: as telas do CRM (Caixa de
Entrada e fio, fichas, Funis e Negócios, Busca, Lixeira, Notificações, Início,
Painel, Ferramentas, IA e Contas a receber) leem e gravam só as tabelas, por
HTTP (`apps/web/src/dados/crm/`), e o modelo antigo em inglês saiu do código. O
`DataState` perdeu as oito coleções (`contacts`, `companies`, `deals`,
`funnels`, os três tipos de Vínculo e `channels`); `conversations` ficou,
restrita a `ConversaDeGrupo[]`, porque Grupo e Flow só passam às tabelas nas
Sessões 6 e 7 (F14-D-05) e são os únicos leitores do que sobrou. Quarenta
operações antigas (Contato, Empresa, Negócio, Conversa 1:1, iniciar conversa,
criar e configurar Canal) saíram de `OPERACOES` e respondem 404 em
`POST /operacoes/:nome`; cinco da Conversa de Grupo seguem lá. A projeção dos
Canais em `GET /estado` e em `executar()` foi apagada: o Canal só chega à tela
por `GET /canais`, e Grupo, Flow e Automação o leem da tabela dentro da
transação. Um Espaço novo nasce com o CRM vazio e sem Funil padrão (D-15-13); a
demonstração do CRM existe só para desenvolvimento, por
`npm run bootstrap:crm-demo -w @n1/api -- --espaco <id>` (recusa banco que não
seja local). "Meus negócios" é o filtro `?meus=1` de `/crm/negocios`; a Pasta
de mesmo nome virou uma Pasta comum.

A migração `012` (`apps/api/migracoes/012-atividade-do-crm.sql`) acrescenta
`plataforma.crm_atividades`, o Registro de Atividade do CRM novo (só inserção,
gravado no mesmo commit do gesto); `GET /atividades` e a Auditoria juntam essa
linha do tempo com a de `state.activity`. A `012` entrou em produção no corte de
2026-11-07 (abaixo). O script de dados é
`npm run migrar:crm-antigo -w @n1/api -- --espaco <id> --seco|--guardar|--migrar|--verificar`
(`apps/api/src/migracao-crm/CONTEXT.md`): copia o CRM antigo de um Espaço para
`plataforma.registros_crm_antigo`, confere e só então o apaga de `registros`,
e com `--migrar` leva o que cabe às tabelas novas com os ids antigos
preservados. É temporário, e quem publica deve rodá-lo **antes** de subir esta
versão: uma linha antiga que sobra em `registros` volta como chave desconhecida
em `GET /estado` até ser apagada.

**O corte em produção foi feito em 2026-11-07** e verificado: backup do schema
`plataforma`, `--seco` nos 19 Espaços, `migrar` (a `012`), `--guardar` nos 17
Espaços de teste e no vazio, `--migrar --funil=guardar` no `ws_n1`, `--verificar`
(19 de 19 iguais), `publicar.sh` (API no SHA `20b4d01`) e push da web. Quem rodou
foi o assistente, por pedido escrito do dono. O que ele **não** provou: nenhuma tela
foi aberta num navegador autenticado e o 404 das operações antigas só está provado
nos testes. O roteiro literal está em
`.planning/phases/15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant/15-CORTE.md`;
o relato do corte, as suposições e o que o dono ainda decide, em `15-PROVAS.md` da
mesma pasta (seção "Corte em produção"). Não existe script de desfazer: voltar é
restaurar o backup do corte.

A partir da Fase 16, a mensageria do CRM nasce em `apps/api/src/mensageria/`,
sobre o domínio, e dá ao Canal o caminho de entrada e o de saída de uma Mensagem
de verdade. A migração `013` (`apps/api/migracoes/013-mensageria.sql`) cria
`plataforma.webhooks_recebidos`, a fila de entrada, e o índice único do
`mensagem.enviar.v1` no outbox. A mensagem recebida entra por
`POST /webhooks/mensageria/:canalId` (rota pública, um endereço por Canal, segredo
do Canal no cabeçalho `x-n1-webhook-segredo`, a mesma 401 para toda recusa) e pelo
**processador de entrada**, que cria Contato, Conversa e Mensagem por
`receberMensagem` (o gesto `registrarRecebida` saiu) e também trata o status de
entrega e o evento de conexão. A resposta escrita na Caixa nasce `pendente`, grava
`mensagem.enviar.v1` no mesmo commit e sai pelo **worker de saída**, que entrega pelo
provedor do Canal; resposta ambígua nunca é reenviada sozinha e "Tentar de novo" é
`POST /mensagens/:id/reenviar`. Os dois workers sobem pela mesma flag,
`MENSAGERIA_WORKER_ATIVO=true`, e a unidade de produção a fixa em `false`. O tempo
real é `GET /eventos`, um fluxo SSE do próprio `apps/api` alimentado por
`LISTEN/NOTIFY` do Postgres (D-16-01): cada aba só recebe o que o Membro pode ler, e
a tela soma o fluxo à releitura por revisão de 5 s, que continua de reserva. O
anexo da Mensagem aponta para um arquivo no bucket (áudio, vídeo, documento e
imagem, com assinatura conferida; a mídia recebida é baixada e guardada em
`entrada/`) e uma coleta diária apaga os órfãos (`COLETA_DE_ORFAOS_ATIVA`). O
provedor de teste só vale para Canal simulado, com segredo próprio no cofre
(D-16-03). Um adaptador mínimo da Evolution (`provedores/evolution/`, registrado só
com `EVOLUTION_URL`) recebe e envia texto e mídia de um Canal real, e quem liga o
Canal a uma instância é `npm run canal:ligar-evolution -w @n1/api -- --canal <id>
--instancia <nome>`, que recusa a instância `numeropvmarcos` (é do `automation/`).
Ficaram para a Sessão 4 o QR code e o botão "Conectar" (feitos, ver abaixo), a
mensagem que a pessoa digita no celular, o status de entrega e o nono dígito
(abertos, 4.4). Ver `apps/api/src/mensageria/CONTEXT.md`.

Depois da verificação da fase (`16-VERIFICATION.md`), um plano de lacunas (16-17
a 16-22) fechou o que ela achou: "Simular conexão" recusa o Canal já ligado a um
provedor real e a ficha esconde o botão (CR-01); o `SIGTERM` encerra a api sozinho,
com teto de 15 s (T-16-28); a saída nunca reenvia sozinha uma Mensagem que pode ter
saído (trava vencida, aceite não gravado, volta do Canal) e responde pelo número por
onde o Contato escreveu; e a aba reconecta quando o fluxo de eventos fica 60 s mudo.
**Essas correções só valem em produção depois da publicação do dono**: o 16-22 as
prova juntas e roda o gate no Postgres local, e entrega o roteiro de publicação e do
que conferir depois (`apps/api/deploy/CONTEXT.md`).

**A `013` está em produção desde 2026-11-10**, aplicada pelo `publicar.sh` sem backup
manual do schema `plataforma`, por decisão do dono (R-16-04 em `16-SECURITY.md`); voltar
a API é possível, voltar a `013` seria uma `014`. A prova ao vivo (`16-PROVAS.md`)
mostrou o pooler de produção entregando `LISTEN/NOTIFY` (A9), a Evolution real
recebendo texto, áudio e imagem do celular e a resposta de texto e de imagem chegando
ao aparelho. **O que segue sem prova** (`16-VERIFICATION.md`, verificação humana): o
cronômetro dos 2 s nas duas abas pelo SSE, o `/eventos` atrás do nginx, o áudio no
Safari e o Supabase Storage real; e a rotação da chave global da Evolution (T-16-55)
é do dono.

Na Sessão 8, o Instagram é o segundo provedor real da mensageria: o Canal
conecta pelo login do Instagram (OAuth), e o Direct entra pela fila de entrada
(`webhooks_recebidos`, por `receberMensagem`) e sai pelo outbox, como a
Evolution. Está em `apps/api/src/mensageria/provedores/instagram/` (ver o
`CONTEXT.md` de lá), com a migração `014-instagram.sql`. A interface ganhou um
passo opcional, `resolverRemetente`, porque o webhook do Instagram só traz o
IGSID, nunca o @. A regra da janela virou `foraDaJanela` (`livre`, `soModelo`,
`bloqueado`) em `@n1/dominio/crm/capacidades`. Sem `MENSAGERIA_WORKER_ATIVO=true`
nada entra nem sai, como para a Evolution.

A Sessão 4 (4.2 e 4.3) liga o "Conectar" do WhatsApp não
oficial pelo CRM. `POST /canais/:id/conectar` cria a instância na Evolution
(`n1-<espaço>-<canal>`), guarda o token dela e o segredo do webhook no cofre e
devolve o QR code; ele nunca grava `conectada`: quem diz que conectou é o
`connection.update` da Evolution, e o processador de entrada **confere na fonte**
(instância aberta e número do Canal) antes de gravar. Desconectar e arquivar tiram
o aparelho da sessão antes da transação, e a Evolution fora do ar deixa tudo como
estava (502). Uma conferência de 5 min (`EVOLUTION_CONFERENCIA_ATIVA`) corrige o
banco quando um webhook se perdeu. A api passa a ter a chave global da Evolution
(`EVOLUTION_API_KEY`, só no `api.env`), que cria e apaga qualquer instância: o CRM
só mexe em instância `n1-...` e nunca na `numeropvmarcos` do Financeiro. A
Evolution 2.4.0 já está instalada na VM (4.1.2) e, em 2026-11-11, a fumaça
(`npm run evolution:fumaca`, `apps/api/deploy/CONTEXT.md`) confirmou contra ela, com
a `EVOLUTION_API_KEY` já no `api.env`, o formato do `create` (com QR), do
`fetchInstances` (com `token`), do `connectionState`, do `connect`, do logout e do
delete. **Ainda não rodou com um celular**: o `connection.update` depois de escanear
o QR, o `ownerJid` de uma instância aberta e o `statusReason` são do primeiro
"Conectar" de verdade, que é do dono.

## Comandos

Todos rodam da raiz:

| Comando | O que faz |
|---|---|
| `npm run dev` | Sobe web (3001) e api (3002) juntos, com prefixo de log por processo |
| `npm run dev:web` | Só a interface (aceita `-- -p 3001`) |
| `npm run build` | Compila a interface |
| `npm run check` | Tipos, lint, tokens e testes — os três workspaces |
| `npm run test` | Só os testes |

## Material de apoio

`docs/`, `ontologia/` e o `PRD-FRONTEND-NAVEGAVEL.md` ficam na raiz: valem para
todas as camadas e não pertencem a nenhuma.

`ferramentas/video-do-financeiro/` grava a tela real do `apps/web` e monta,
com Remotion, o vídeo que o Guia do Financeiro toca (ver o `CONTEXT.md` de
lá). Fica fora dos workspaces: nenhuma camada a importa e o CI não a instala.

O plano de migração do Financeiro Tria para cá — inventário do sistema atual,
comparativo e fases — está em `docs/08-migracao-financeiro/`. É o roteiro do
primeiro módulo que `apps/api` vai receber.
