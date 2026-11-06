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
e só conecta por "Simular conexão", sempre marcada, enquanto não há provedor
real; o popup de adicionar Canal das Listas deixou de criar Canal (Fase 15,
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
linha do tempo com a de `state.activity`. A `012` só existe em bancos locais:
ela entra em produção no corte. O script de dados é
`npm run migrar:crm-antigo -w @n1/api -- --espaco <id> --seco|--guardar|--migrar|--verificar`
(`apps/api/src/migracao-crm/CONTEXT.md`): copia o CRM antigo de um Espaço para
`plataforma.registros_crm_antigo`, confere e só então o apaga de `registros`,
e com `--migrar` leva o que cabe às tabelas novas com os ids antigos
preservados. É temporário, e quem publica deve rodá-lo **antes** de subir esta
versão: uma linha antiga que sobra em `registros` volta como chave desconhecida
em `GET /estado` até ser apagada.

**O corte em produção é só do dono e ainda não aconteceu.** O roteiro literal
(backup, `--seco` por Espaço, aprovação do relatório, `migrar`, `--guardar` nos
17 Espaços de teste, `--migrar` no `ws_n1`, `--verificar`, `publicar.sh`, push
da web) está em
`.planning/phases/15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant/15-CORTE.md`;
o ensaio com a cópia dos dados reais, em `15-ENSAIO.md`, e as provas, as
suposições e o que o dono ainda decide, em `15-PROVAS.md` da mesma pasta. Não
existe script de desfazer: voltar é restaurar o backup do corte.

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
