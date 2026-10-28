# Plano de implementação do CRM N1

**Versão para validação, 19/10/2026.** Início em segunda, 19/10/2026, e fim previsto em quinta, 21/01/2027. As datas de cada sessão estão na [visão geral](#visão-geral).

Este plano organiza em 21 sessões, uma reunião e um levantamento tudo o que foi levantado: as tarefas já mapeadas, os pontos testados, as lacunas do modelo e os pré-requisitos que elas pressupõem. A ordem segue as dependências. Primeiro vem o que protege os dados e define quem acessa o quê. Depois a estrutura de trabalho, os canais e a IA. Por fim, a saída do protótipo.

Cada sessão vira uma fase do GSD, com o ciclo de discutir, planejar, executar e verificar.

## Como as datas foram estimadas

| Fase do GSD | Planos | Do início ao fim |
|---|---|---|
| 06 · Conferência do Resumo e anexos | 22 | 3 dias (29/09 a 01/10) |
| 07 · CRM: Contatos, Empresas, Funis e Negócios | 13 | 3 dias (09/10 a 11/10) |
| 08 · Canais: conexão e omnichannel preparado | 15 | 2 a 3 dias (12/10 a 14/10) |

Um plano leva em média de 3 a 25 minutos de execução. O que ocupa o calendário é discutir, planejar, validar e corrigir. A partir disso:

- **Sessão padrão** (domínio, banco e tela, sem dependência externa): **3 dias úteis**. São 2 dias de GSD e 1 dia para você validar e o GSD corrigir.
- **Sessão com provedor externo** (Meta, e-mail, modelo de IA): **4 dias úteis**. A Evolution ficou com 1 dia, por decisão sua: provisionar a instância é simples. Testar com número, conta e webhook reais toma tempo que não aparece na execução dos planos.
- **Sessão com decisão de escopo grande** (superadmin): **5 dias úteis**.
- Contam só dias úteis, de segunda a sexta. Os feriados nacionais ficam de fora: 02/11, 20/11, 25/12 e 01/01.
- **Não estão incluídos** os prazos de aprovação da Meta, que correm por fora. Ver [O que depende de você fora do código](#o-que-depende-de-você-fora-do-código).

## Visão geral

<!-- TABELA:INICIO -->
| # | Sessão | Dias | Início | Fim | Depende de |
|---|---|---|---|---|---|
| 0 | Fechar o v1.0 e abrir o novo marco | 1 | seg 19/10 | seg 19/10 | — |
| 1 | Segurança dos dados e base de produção | 3 | ter 20/10 | qui 22/10 | 0 |
| 2 | Clone ClickUp: ajustes e lacunas | 3 | sex 23/10 | ter 27/10 | 1 |
| 3 | Base da mensageria e unificação do CRM | 4 | qua 28/10 | ter 03/11 | 1 |
| 4 | WhatsApp não oficial (Evolution API) | 1 | qua 04/11 | qua 04/11 | 3 |
| 5 | Lista conversacional | 2 | qui 05/11 | sex 06/11 | 4 |
| 6 | Ferramentas: Grupos e Comunidades | 3 | seg 09/11 | qua 11/11 | 4 |
| 7 | WhatsApp oficial (Cloud API) e Flows | 4 | qui 12/11 | ter 17/11 | 3, 6, aprovação Meta |
| 8 | Instagram | 3 | qua 18/11 | seg 23/11 | 3, aprovação Meta |
| 9 | E-mail | 3 | ter 24/11 | qui 26/11 | 3 |
| 10 | Canal Reunião: investigação | 2 | sex 27/11 | seg 30/11 | 5 |
| 11 | Canal Reunião: implementação | 1 | ter 01/12 | ter 01/12 | 10 |
| 12 | Superadmin, usuários e permissões | 5 | qua 02/12 | ter 08/12 | 1 |
| R1 | *Reunião 1 de escopo da IA (realizada)* | — | seg 19/10 | seg 19/10 | — |
| LV | *Levantamento de escopo da IA* | — | ter 20/10 | qui 22/10 | — |
| 13 | IA: ligação com o modelo e Chat respondendo | 4 | qua 09/12 | seg 14/12 | LV |
| 14 | IA: Agentes e seus poderes | 5 | ter 15/12 | seg 21/12 | 13 |
| 15 | IA: Integrações da empresa e pessoais | 4 | ter 22/12 | seg 28/12 | 1, 14 |
| 16 | IA: Agente na Caixa de Entrada | 3 | ter 29/12 | qui 31/12 | 4, 7, 14 |
| 17 | IA: Conhecimento indexado | 3 | seg 04/01 | qua 06/01 | 13, 14 |
| 18 | IA: Automações em código e Plugins | 4 | qui 07/01 | ter 12/01 | 14, 17 |
| 19 | Saída do protótipo: LGPD, rotinas e dados reais | 3 | qua 13/01 | sex 15/01 | 1, 3, 18 |
| 20 | Painel | 4 | seg 18/01 | qui 21/01 | 3, 19 |

**Total: 65 dias úteis, com fim em qui 21/01/2027.** Com os ajustes que a conferência no código sugere, 102 dias úteis e fim em seg 15/03/2027 (ver [TAREFAS-POR-SESSAO.md](TAREFAS-POR-SESSAO.md#prazos-plano-e-com-ajustes)). Esta tabela é gerada por `gerar.mjs`.
<!-- TABELA:FIM -->

---

## Sessão 0 · Fechar o v1.0 e abrir o novo marco

O GSD está parado com a Fase 08 aguardando verificação, e as Fases 02 e 04 (Financeiro) seguem abertas. Antes de abrir trabalho novo, é preciso fechar o que está pela metade.

- Verificar a Fase 08 (`/gsd-verify-work 8`) e marcá-la concluída.
- Decidir o destino das Fases 02 e 04: terminar, mover para o novo marco ou encerrar como estão.
- Fechar o marco v1.0 (`/gsd-complete-milestone`) e abrir o v2.0 (`/gsd-new-milestone`), com as sessões deste plano como fases.

**Pronto quando:** o `ROADMAP.md` mostra o v2.0 com as sessões 1 a 17.

## Sessão 1 · Segurança dos dados e base de produção

Vem primeiro porque, a partir da Sessão 4, entram dados reais de clientes: contatos e conversas de WhatsApp. E porque há um vazamento conhecido.

- **Corrigir o vazamento:** `GET /estado` devolve as Sessões de Chat de todos os Membros para qualquer usuário logado.
- **Auditar o que existe:** verificação do login do Supabase, resolução do Membro, separação por `workspace_id` e permissões aplicadas pelo domínio no `apps/api`. A auditoria levanta o que está protegido e o que só está escondido na tela.
- **Segurança no banco (RLS):** hoje nenhuma migração tem política de acesso por linha, e toda a proteção depende do `apps/api`. Decidir se entra RLS ou se o banco fica fechado a qualquer acesso que não seja o do `apps/api`, e aplicar a decisão.
- **Cofre de credenciais:** onde ficam, cifrados, os tokens de cada Canal e Integração. É pré-requisito das Sessões 4, 7, 8 e 9, e a migração 008 deixou isso de fora de propósito.
- **Ambientes:** homologação separada de produção, backup do banco e monitoramento de erros.

**Pronto quando:** um usuário de um Espaço de Trabalho não consegue ler, por nenhuma rota, nada de outro Espaço de Trabalho nem as Sessões de Chat de outro Membro, e existe onde guardar uma credencial cifrada.

## Sessão 2 · Clone ClickUp: ajustes e lacunas

Fica aqui para dar tempo de você terminar os testes da Estrutura de Trabalho. **A lista de testes precisa fechar até 22/10, véspera do início da sessão.** Se ela crescer muito, esta sessão cresce junto.

- Limpar a UI das subpáginas.
- Otimizar o backend do CRUD de Espaço, Pasta e Lista.
- Implementar "Converter item do checklist em subtarefa".
- Remover a visualização de carga.
- **Lacunas encontradas na comparação do modelo com o artefato "Estrutura de Trabalho N1":**
  - visualizações padrão do Espaço;
  - a Lista não poder ser bloqueada;
  - uma operação para bloquear um aspecto (hoje só o seed preenche);
  - descrição da Tarefa com menções e histórico com antes e depois;
  - tempo registrado calculado no domínio.
- Os itens que você relatar nos testes.

**Pronto quando:** todos os itens acima e os relatados nos testes estão validados por você.

## Sessão 3 · Base da mensageria e unificação do CRM

Tudo o que os quatro provedores (Sessões 4, 7, 8 e 9) usam em comum fica pronto aqui, uma vez só.

- **Receber mensagens:** rota de webhook por provedor, autenticação do webhook, descarte de mensagem repetida e fila para não perder mensagens.
- **Tempo real:** mensagens novas aparecem na tela sem recarregar. Hoje não há nenhum canal empurrando dados.
- **Mídia:** áudio, imagem e documento baixados do provedor e guardados no armazenamento de arquivos, nos dois sentidos.
- **Unificação do CRM:** a Caixa de Entrada e o chat ainda usam o modelo antigo em inglês (`Contact`, `Deal`). Aqui eles passam a falar com os Contatos e Negócios das tabelas novas (migração 007), e o modelo antigo sai. Inclui levar a Tarefa conversacional para as tabelas novas, que antes estava na Sessão 5.
- **Vários Canais do mesmo tipo**, inclusive mais de um WhatsApp não oficial, com cada Conversa presa ao Canal por onde chegou.

**Pronto quando:** uma mensagem simulada chega por webhook, aparece na Caixa de Entrada sem recarregar, presa ao Contato da tabela nova, e a mídia abre.

## Sessão 4 · WhatsApp não oficial (Evolution API)

É o primeiro provedor porque destrava a Lista conversacional e as Ferramentas.

- Conectar um número por QR code, com uma instância da Evolution por número e várias ao mesmo tempo.
- Estado da conexão: conectado, desconectado ou com erro, com reconexão.
- Receber e enviar texto e mídia.
- Trocar o "Simular conexão" por conexão real.

**Pronto quando:** dois números conectados recebem e respondem mensagens pela Caixa de Entrada, cada um na sua Conversa.

## Sessão 5 · Lista conversacional

Estava bloqueada pela Evolution. O modelo (`modeloDeTarefa`, `canaisDeAtendimento`) já existe no domínio, e a Sessão 3 já leva a Tarefa conversacional para as tabelas novas. Aqui fica só o que depende do provedor real:

- A mensagem que chega pelo Canal da Lista cria ou atualiza a Tarefa.
- A resposta escrita na Tarefa sai pelo WhatsApp.
- Teste com número real.

**Pronto quando:** uma mensagem nova num número conectado gera ou atualiza a Tarefa na Lista conversacional, e responder pela Tarefa sai pelo WhatsApp.

## Sessão 6 · Ferramentas: Grupos e Comunidades

- **Seletor de número:** a seção mostra só os números conectados pela Evolution, e tudo o que aparece vem do número escolhido.
- **Telas, tabelas e backend** de Grupos e Comunidades: listar, criar, editar e gerir participantes.
- **Sincronização** com a Evolution, trocando o provedor simulado de hoje (`provedor-simulado.ts`).

**Pronto quando:** ao escolher um número, aparecem os Grupos e Comunidades reais dele, e uma mudança feita aqui aparece no WhatsApp.

> **Atenção, Flows:** WhatsApp Flows é um recurso da API oficial da Meta. A Evolution, que é a API não oficial, não cria nem envia Flows. Por isso os Flows foram para a Sessão 7 (ver [Decisões](#decisões-que-preciso-de-você)).

## Sessão 7 · WhatsApp oficial (Cloud API) e Flows

- Conectar um número pela Cloud API da Meta, receber e enviar.
- **Janela de 24 h:** fora dela, só se envia modelo de mensagem aprovado pela Meta. Isso exige tela para gerir os modelos e acompanhar a aprovação.
- **Flows:** criar e enviar, e gravar as respostas no Contato.

**Pronto quando:** um número oficial conversa pela Caixa de Entrada, um modelo aprovado sai fora da janela e um Flow enviado grava a resposta.

## Sessão 8 · Instagram

- Conectar uma conta profissional do Instagram e receber e responder mensagens diretas na Caixa de Entrada.

**Pronto quando:** uma mensagem direta chega e é respondida pela Caixa de Entrada.

## Sessão 9 · E-mail

- Conectar uma caixa de e-mail, receber e enviar, com as respostas agrupadas na mesma Conversa.

**Pronto quando:** um e-mail recebido vira Conversa, e a resposta chega ao remetente no mesmo fio.

---

## Sessão 10 · Canal Reunião: investigação

Na Lista conversacional entra um Canal novo, **Reunião**: o closer cria uma sala de vídeo e manda o link para o cliente, e um gestor pode entrar na chamada sem que o closer nem o cliente vejam. Antes de implementar, dois dias para decidir a base:

- **Testar o LiveKit:** sala, link de convidado sem conta, entrada oculta de um terceiro, celular e rede ruim, custo e gravação.
- **Levantar o custo do WebRTC próprio:** sinalização, servidores STUN e TURN e o servidor que distribui o vídeo entre três ou mais pessoas.
- **Confirmar as regras de gravação e da entrada oculta** com quem cuida de LGPD e do jurídico.

**Pronto quando:** a decisão “LiveKit ou WebRTC próprio” está tomada, e a Sessão 11 foi escrita com as tarefas e a duração que saírem dela.

## Sessão 11 · Canal Reunião: implementação

**Bloqueada até a investigação (Sessão 10) terminar.** O 1 dia no cronograma é só um marcador: a duração real e as subtarefas ainda não são conhecidas e saem da Sessão 10. Quando a investigação terminar, esta sessão é escrita e as datas seguintes são ajustadas.

## Sessão 12 · Superadmin, usuários e permissões

Vem logo antes das sessões de IA, para que os Agentes já nasçam respeitando quem pode o quê.

- **Decisão de escopo, no primeiro dia:**
  - se o superadmin fica acima dos Espaços de Trabalho, gerindo a plataforma inteira;
  - como as permissões dele convivem com o que já existe em cada Espaço de Trabalho (Membros, Papéis e concessões de acesso);
  - quais módulos cada permissão libera.
- **Modelagem de banco, back e front:** tudo novo.
- **CRUD de usuários.**
- **Ciclo de vida do usuário:** convite por e-mail, primeiro acesso, redefinição de senha, desativar sem apagar e registro do que o superadmin fez.
- **Criar Espaço de Trabalho** (empresa nova) com o primeiro Proprietário, se a plataforma vai atender mais de um cliente.

**Pronto quando:** o superadmin cria um usuário, dá a ele uma permissão, e esse usuário entra e vê só os módulos que a permissão libera.

## Reunião 1 de escopo da IA (realizada em 19/10)

Decidido:

| Assunto | Decisão | O que muda no plano |
|---|---|---|
| **Plugin** | Pacote de Skills, Conhecimento e Automações, instalado num Agente de uma vez. | Tipo novo e tela própria na Sessão 18. A aba atual “Plugins” vira “Ferramentas”. |
| **Integração** | Conexões que o time escolhe, da empresa (Omie) e pessoais (Google Agenda). Começa com Omie, Google Agenda e Miro. Composio, se der. | Sessão nova: 13 · Integrações. |
| **Conhecimento** | Banco vetorial padrão. | `pgvector` no Postgres que já usamos (Sessão 17). |
| **Automação** | Escrita em código pelo time, sem criar pela tela. O Agente aciona. Lista a definir. | Sessão 18 troca o editor visual por um catálogo em código. Fica bloqueada até a lista chegar. |
| **Habilidade** | Skill em arquivo `.md`. | Sessão 14: a Habilidade vira `SKILL.md`. |
| **Agente** | Recebe cinco poderes: Ferramenta, Conhecimento, Integração, Plugin e Skill. Avaliar framework. | Construtor com um passo por poder (Sessão 14). A escolha do framework é o primeiro item do levantamento (20/10). |

Pontos de atenção:
- **O Composio não tem o Omie** (a página do toolkit não existe). Ele tem Google Agenda e Miro e foi feito para conexões por usuário. O Omie vira Ferramenta nossa, com a chave da empresa no cofre.
- **Duas perguntas sobre Automações ficaram abertas:** se uma Automação também roda sozinha (as do Financeiro rodam por evento e horário hoje) e o que acontece com o editor e as Automações que já existem.
- **As Automações também precisam entrar como poder do Agente**, já que ele as aciona.

## Levantamento de escopo da IA (20/10 a 22/10)

Três dias de pesquisa, não de desenvolvimento. Você pesquisa cada ponto que ficou aberto na Reunião 1 e decide no dia marcado. Quando decidir um item, me mande a resposta: eu registro no planejamento (o item vira “Decidida” no cronograma) e ajusto as sessões afetadas. O que pesquisar em cada item, as opções e a minha recomendação estão em [TAREFAS-POR-SESSAO.md](TAREFAS-POR-SESSAO.md#levantamento-de-escopo-da-ia).

| Dia | Grupos | Destrava |
|---|---|---|
| ter 20/10 | **T2.1 Base da IA** (framework, modelo) · **T2.2 Integrações** (Composio, onde se conecta, de quem é a conexão pessoal) | Sessões 13 e 15 |
| qua 21/10 | **T2.3 Custo, memória e Chat** · **T2.4 Agentes e Ferramentas** (como nasce uma Ferramenta, passos do Construtor) · **T2.5 Atendimento a clientes** (como o Agente pega a Conversa, autonomia, aprovações) | Sessões 13, 14 e 16 |
| qui 22/10 | **T2.6 Automações** (roda sozinha ou só pelo Agente, editor e Automações existentes, **a lista das Automações**) · **T2.7 Arrumação** · **T2.8 Fechamento** | Sessões 14 e 18 |

## Sessão 13 · IA: ligação com o modelo e Chat respondendo

- **Ligação com o modelo:** com o framework escolhido no levantamento, o `apps/api` passa a chamar o Claude, com streaming e custo gravado.
- **Chat:** as respostas aparecem em tempo real, mais renomear, arquivar e compartilhar a Sessão.
- **Anexos e voz no Chat.**
- **Corrigir o que está quebrado:** criar Agente pelo Construtor (a API recusa com 400) e "Permitir Ferramenta", que não grava.

**Pronto quando:** uma pergunta no Chat recebe resposta do modelo, aparecendo aos poucos, e a Execução e o custo ficam registrados.

## Sessão 14 · IA: Agentes e seus poderes

- **Ferramentas executando:** cada Ferramenta ligada a uma operação do domínio, com a permissão de quem aciona o Agente.
- **Skills em `.md`:** a Habilidade vira `SKILL.md`. O Agente recebe o nome e a descrição de cada Skill e lê o conteúdo quando precisa.
- **Aprovações:** o Agente para e pede licença quando a autonomia exige, e segue depois de aprovado.
- **Construtor com um passo para cada poder**, no desenho escolhido no levantamento.

**Pronto quando:** um Agente criado pelo Construtor usa uma Ferramenta e uma Skill, para numa aprovação e conclui depois de aprovado.

## Sessão 15 · IA: Integrações da empresa e pessoais

- **Conexões em dois níveis:** da empresa (só administrador conecta) e pessoais (cada um conecta a sua, em Minha conta).
- **Ponte com o Composio** para Google Agenda e Miro, se o levantamento confirmar.
- **Omie como Ferramenta nossa**, chamando a API do Omie com a chave da empresa no cofre.
- **O Agente usa a conexão certa:** no Chat, a pessoal de quem conversa; no atendimento a cliente, só as da empresa.

**Pronto quando:** um Membro conecta a própria Google Agenda e o Agente lista os eventos dele; outro Membro não vê; o Agente consulta uma conta no Omie com a conexão da empresa.

## Sessão 16 · IA: Agente na Caixa de Entrada

O Agente atende Contatos pelos Canais conectados. A mensagem chega pelo webhook. Se a Conversa está atribuída a um Agente ativo, ele é acionado com as próprias permissões. A resposta sai direto em modo autônomo ou vira rascunho para uma pessoa aprovar, e uma pessoa pode assumir a qualquer momento.

**Pronto quando:** uma mensagem no WhatsApp, numa Conversa atribuída a um Agente, recebe resposta dele.

## Sessão 17 · IA: Conhecimento indexado

- Envio real de arquivo, captura de URL e extração de texto.
- Indexação no `pgvector` (banco vetorial padrão, decidido em 19/10) e busca por significado.
- Citação do trecho usado e atualização das Fontes.

**Pronto quando:** um Agente responde citando o trecho certo de um documento enviado.

## Sessão 18 · IA: Automações em código e Plugins

Bloqueada até a lista de Automações chegar.

- **O editor visual sai**, e as Automações que já existem continuam rodando, numa lista só de leitura.
- **Catálogo de Automações em código:** um arquivo por Automação, com descrição, parâmetros e gatilho opcional.
- **O Agente aciona Automações** que recebeu como poder.
- **As Automações da sua lista**, uma subtarefa por Automação.
- **Plugins:** pacote de Skills, Coleções de Conhecimento e Automações, instalado num Agente de uma vez.

**Pronto quando:** o Agente aciona uma Automação do catálogo, e um Plugin instalado traz de uma vez as Skills, o Conhecimento e as Automações dele.

## Sessão 19 · Saída do protótipo: LGPD, rotinas e dados reais

- **LGPD:** exportar e apagar os dados de um Contato a pedido dele, e definir por quanto tempo mensagens e Execuções ficam guardadas.
- **Rotinas em segundo plano:**
  - eliminar o que passou do prazo da lixeira (não encontrei hoje);
  - recorrência por calendário;
  - sincronizações dos provedores.
- **Dados reais:** remover os dados de demonstração e preparar a entrada dos dados reais.
- **Testes:** testes ponta a ponta dos fluxos principais.

**Pronto quando:** produção sobe sem dado de demonstração e as rotinas rodam sozinhas.

## Sessão 20 · Painel

Por último porque o Painel lê dados de todo o resto.

- 1 dia para desenhar com você o que o dashboard mostra.
- 3 dias para construir.

**Pronto quando:** o Painel desenhado está no ar com dados reais.

---

## O que depende de você fora do código

Começar **na primeira semana**, porque os prazos correm por fora e podem atrasar as Sessões 7 e 8:

| O quê | Para qual sessão | Prazo típico |
|---|---|---|
| Verificação da empresa no Meta Business e criação do app da Meta | 8 e 9 | de dias a algumas semanas |
| Número dedicado para a API oficial do WhatsApp (sem uso no app comum) | 8 | — |
| Revisão do app pela Meta para as permissões do Instagram | 9 | de 1 a 4 semanas |
| Servidor onde a Evolution API vai rodar | 5 | — |
| Chave de API da Anthropic, com limite de gasto definido | Teste dos modelos no levantamento (20/10) | — |
| Conta no Composio | Teste do Composio no levantamento (20/10) | — |
| Lista das Automações a implementar | Levantamento (22/10) e Sessão 18 | — |
| Escolha do provedor de e-mail | 10 | — |

## Decisões que preciso de você

1. **Fases 02 e 04 do Financeiro:** terminar, mover para o v2.0 ou encerrar? (Sessão 0)
2. **Superadmin:** fica acima dos Espaços de Trabalho? A plataforma vai atender mais de uma empresa? (Sessão 12)
3. **Flows do WhatsApp:** concorda em levá-los para a API oficial (Sessão 7), já que a Evolution não os suporta? Ou eles ficam fora por enquanto?
4. **E-mail:** IMAP/SMTP genérico, que serve para qualquer caixa, ou integração direta com Gmail e Outlook? (Sessão 9)
5. **Ordem:** a IA vem depois dos Canais porque os Agentes agem sobre as Conversas. Se a IA for mais urgente, as Sessões 13 a 18 podem vir logo depois da Sessão 4, e os demais Canais andam três semanas.

## Riscos para as datas

- **Aprovações da Meta** são a maior incerteza. Se não saírem até 12/11, as Sessões 7 e 8 trocam de lugar com as de IA, e o fim do plano não muda.
- **A lista de testes do Clone ClickUp** ainda está aberta. Cada lote grande de itens pode somar de 1 a 2 dias à Sessão 2.
- **Canal Reunião:** a Sessão 11 está com 1 dia só para marcar o lugar. A duração real sai da investigação (Sessão 10) e empurra todas as datas seguintes.
- **A unificação do CRM** (Sessão 3) mexe na Caixa de Entrada e no chat, que estão em uso, e é a sessão mais arriscada de quebrar algo existente.
- **Fim de ano:** as Sessões 14 a 16 caem entre 21/12 e 07/01. Se houver recesso, tudo a partir dali anda o mesmo número de dias.
- **A lista de Automações** ainda não chegou. Sem ela, a Sessão 18 não começa.
- **Escopo maior do que a velocidade do GSD sugere:** a conferência no código encontrou 382 subtarefas. Pelo tamanho de cada sessão, o plano iria a 102 dias úteis, com fim em 15/03/2027 (ver [TAREFAS-POR-SESSAO.md](TAREFAS-POR-SESSAO.md#prazos-plano-e-com-ajustes)). O número real deve ficar entre 21/01 e 15/03; vale reestimar com a velocidade medida nas Sessões 0 e 1.
