---
phase: "15"
slug: "unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
block_on: high
created: "2026-11-07"
---

# Phase 15 — Security

> Contrato de segurança da fase: registro de ameaças, riscos aceitos e trilha de auditoria.
> Registro montado dos `<threat_model>` dos 43 planos que o têm (98 ameaças, IDs `T-15-01` a `T-15-98`, sem repetição) e verificado **estaticamente** (leitura e grep, sem rodar teste nem tocar em banco) por três auditores em paralelo, por faixa de planos.

---

## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| navegador → `POST /operacoes/:nome` | os `args` (inclusive um `canais` forjado) chegam do cliente |
| teste → banco | o `.env` aponta para produção |
| navegador → rotas REST do CRM | ids e escritas concorrentes de vários Membros |
| api → Postgres | travas e erros do banco |
| Administrador → `POST /operacoes/removeMember` | escolhe o Sucessor |
| api → navegador | `GET /membros/:id/sucessao-no-crm` revela contagens |
| gesto REST → `crm_atividades` | ator e objeto gravados pelo servidor |
| navegador → `POST /tarefas-conversacionais/resumo` | até 200 trios de ids do cliente |
| navegador → `GET /conversas` | filtros do cliente |
| navegador → `POST /operacoes/<op de Ferramenta>` | `crm` forjado pelo cliente |
| navegador → `POST /operacoes/<op da IA>` | âncora e nomes do cliente |
| navegador → Auditoria | lista o que o Papel pode ver |
| navegador → `POST /crm/nomes` | até 200 ids arbitrários |
| navegador → `PATCH /canais/:id` | edição de configuração do Canal |
| navegador → `GET /contatos/:id`, `/empresas/:id`, `/negocios/:id` | id da URL |
| navegador → rotas de lista com `q` e `estado` | termo de busca do cliente |
| navegador → rotas do CRM a partir de ids de Vínculo | o Vínculo está em `registros`, o registro na tabela |
| CLI `bootstrap:gestao` → banco | cria um Espaço real |
| provedor (simulado) → operação | números de participantes externos |
| navegador → `POST /operacoes/<op>` | `crm` forjado |
| navegador → `GET /crm/inicio/*` | janela, fuso e qualificações do cliente |
| navegador → `POST /operacoes/createReceivableSeries` | `clientes` forjado |
| CLI de importação → banco | catálogo de clientes |
| navegador → `POST /mensagens`, `POST /conversas` | texto e ids do cliente |
| navegador → rotas de leitura do CRM | dados do Espaço do Membro |
| navegador → `POST /conversas/:id/*`, `PATCH /contatos/:id` | gestos e edição do cliente |
| navegador → `POST /contatos/:id/notas` | texto da nota |
| navegador → `GET /negocios?proprietarioId=` | filtro do cliente |
| dono (CLI) → banco | o script escreve dados reais quando rodado no corte |
| `plataforma.registros_crm_antigo` | guarda dado pessoal dos Espaços |
| `registros` (JSON antigo) → tabelas novas | dado de formato livre virando linha com constraint |
| desenvolvedor (CLI) → banco | carrega dados de demonstração |
| cópia de produção (dado pessoal) → Docker local | dado real fora do banco de origem |
| seed → ambiente de desenvolvimento e testes | dados sintéticos |
| navegador antigo (cache) → `POST /operacoes/<nome antigo>` | durante e depois do corte |
| `GET /estado` → navegador | o que a tela recebe depois que a ponte sai |
| testes → banco | o `.env` aponta para produção |
| cópia real → Docker | dado pessoal no ensaio final |
| dono → produção | backup, script, publicação |
| domínio antigo → `registros` | Conversas de Grupo trocando de Atribuído |
| navegador → `GET /atividades` | filtro e cursor do cliente |
| navegador → `GET /contatos` | filtro novo |
| navegador → `POST /operacoes/criarAutomacao` | escopo e `funis` do cliente |
| navegador → `GET /canais` | Canais da Lista lidos das tabelas |
| Membro → `moveContainer` | gesto de mover na árvore |
| domínio → telas e api | funções exportadas que alguém ainda poderia chamar |
| `hidratar()` → `GET /estado` | linhas antigas que sobrarem em `registros` |

---

## Threat Register

| Threat ID | Plan | Category | Component | Severity | Disposition | Mitigation (plano) | Evidência (auditoria 2026-11-07) | Status |
|-----------|------|----------|-----------|----------|-------------|--------------------|----------------------------------|--------|
| T-15-01 | 15-01 | Tampering | `gesto-no-crm` (posição do `lido`) | high | mitigate | `comLidoDoCrm` sobrescreve sempre a posição com `argumento(lido)` lido pelo servidor no mesmo cliente; teste de rota com `canais` forjado recusado (Task 1) | operacoes.ts:259,375 `comLidoDoCrm` sobrescreve `lido`; `operacoes-canais-da-lista.test.ts:96,104` (canais forjado) | closed |
| T-15-02 | 15-01 | Tampering | `rotas/operacoes.test.ts` abrindo o banco do `.env` | high | mitigate | `describeComBanco` (só host local) e comando de teste com as duas URLs locais; prova "pulado sem `DATABASE_URL`" (Task 3) | testes/banco-crm.ts:30-32 `temBancoCrm` só host local; `describeComBanco` pula fora dele | closed |
| T-15-03 | 15-01 | Denial of Service | composição das tabelas | low | mitigate | nome repetido em dois módulos lança na carga do módulo (falha no teste, nunca em produção silenciosa) | gesto-no-crm/index.ts:28 `compor` lança se o nome repete em dois módulos | closed |
| T-15-04 | 15-02 | Tampering | escrita referenciando Contato recém-mesclado (WR-01) | medium | mitigate | `for update` nas três portas; prova de dois clientes (Tasks 1 e 2) | `for update` no Contato em conversas.ts:487, negocios.ts:153, empresas.ts:219; testes nos três | closed |
| T-15-05 | 15-02 | Denial of Service | deadlock REST de Canal × gesto misto (WR-02) | high | mitigate | trava do Espaço antes do Canal; `40P01` → 409 transitório; prova com `nowait` (Task 2) | canais.ts:161 trava o Espaço antes do Canal; transacao.ts:40 `40P01`→409; canais.test.ts:260 (nowait) | closed |
| T-15-06 | 15-02 | Information Disclosure | 500 com detalhe do Postgres (WR-06) | medium | mitigate | pré-checagem e frase fixa sem nome de constraint; T-07-06 | contatos.ts:550 pré-checagem `CONTATO_COM_MESCLADOS`; frase fixa em :100; contatos.test.ts:362,385 | closed |
| T-15-07 | 15-02 | Information Disclosure | resumo mostrando Contato/Conversa na lixeira (WR-05) | low | mitigate | filtros nos `join`; casos de teste | repositorios/crm/tarefas-conversacionais.ts:135,137 filtram lixeira e conversa ativa; teste :779 | closed |
| T-15-08 | 15-03 | Elevation of Privilege | Sucessor recebendo Conversas | medium | mitigate | o domínio valida o Sucessor na primeira remoção (Membro `ativo`, sem base Convidado); o `update` só roda dentro do gesto misto travado; IN-01 (replay) registrado como aberto por D-15-07 | dominio/operations/members.ts:238-244 valida Sucessor; gesto-no-crm/membros.ts:21 reconfere `ativo` | closed |
| T-15-09 | 15-03 | Information Disclosure | contagens da sucessão | low | accept | a rota já exige o Papel que gerencia Membros (Fase 14) e devolve só números | aceito: servicos/crm/sucessao.ts exige Administrador/Proprietário ativo, devolve só contagens | closed (aceito) |
| T-15-10 | 15-03 | Repudiation | contrato e código divergindo | medium | mitigate | regras-chave emendadas no passo 1 da Task 1, antes do código; ocorrências secundárias na Task 2; decisão nova datada em `DECISOES-E-PENDENCIAS.md` | ontologia/DECISOES-E-PENDENCIAS.md:217-219,637 (decisão B28-a datada); RN-ET-09 e RN-CXE-24 emendadas | closed |
| T-15-11 | 15-04 | Repudiation | `crm_atividades` usada para apagar histórico | high | mitigate | repositório só com `registrarAtividade`/`listar` (grep sem `update`/`delete`); sem FK (sobrevive à eliminação); `migracao-012.test.ts` (f) | repositorios/crm/atividades.ts só exporta `registrarAtividade`/`listar`; 012 sem FK; migracao-012.test.ts:221 (f) | closed |
| T-15-13 | 15-04 | Spoofing | ator vindo do corpo | medium | mitigate | `ator_id = membro.id` da sessão no serviço; nenhum esquema de rota aceita ator | toda chamada usa `ator: {kind:'member', id: membro.id}`; nenhuma rota aceita ator; `/atividades` `.strict()` | closed |
| T-15-14 | 15-04 | Information Disclosure | conteúdo da Nota no `detalhe` da Atividade | medium | mitigate | `detalhe` nunca leva o conteúdo; só a ação e o nome de exibição do Contato | notas.ts:78-84 sem `detalhe`/conteúdo; notas.test.ts:148 (h) | closed |
| T-15-15 | 15-05 | Information Disclosure | resumo devolvendo Empresa e Atribuído para ids sem Tarefa visível (IN-05) | medium | accept | todo Papel com `ler` no CRM já alcança esses recursos (sem escopo "próprios"); escopo por `workspace_id` da sessão continua; IN-05 aberto por D-15-07 e registrado no SUMMARY | aceito: permissoes.ts:25 (escopo 'próprios' não existe); escopo por `workspace_id` da sessão vale; IN-05 aberto por D-15-07 | closed (aceito) |
| T-15-16 | 15-05 | Information Disclosure | resumo com dado de outro Espaço | high | mitigate | todo `join` com `workspace_id = $1`; caso de teste de Espaço vizinho no `describeComBanco` | repositorios/crm/tarefas-conversacionais.ts:122-170 `workspace_id = $1` em todo join; testes :808,:866 | closed |
| T-15-17 | 15-05 | Tampering | mesclagem por clique acidental | low | mitigate | confirmação por nome digitado (D-15-10); a rota continua exigindo `editar` | mesclar-contato-dialog.tsx:53,58 confirmação por nome; rota exige `editar` (mesclagem.ts:97); ficha-de-contato.test.tsx:609 | closed |
| T-15-18 | 15-06 | Information Disclosure | `naoLidas` de outro Membro | medium | mitigate | o filtro usa só o Membro da sessão (`$3`), nunca um id do cliente; caso de teste com dois Membros | repositorios/crm/conversas.ts:208-214 join `mc` com `$3`; servicos passa `membro.id`; conversas.test.ts:680 | closed |
| T-15-19 | 15-06 | Tampering | SQL do filtro | medium | mitigate | fragmento constante, sem valor do cliente no texto; zod `.strict()` recusa valor fora de `true`/`false` | conversas.ts:210 fragmento constante; rotas/crm/conversas.ts:50 enum + `.strict()`; teste :330 (400) | closed |
| T-15-20 | 15-07 | Tampering | `crm` do navegador nas operações de Ferramentas | high | mitigate | `comLidoDoCrm` sobrescreve a posição com o que o servidor leu; teste de rota com `crm` forjado | operacoes.ts:375 `comLidoDoCrm` + ferramentas.ts:125-190; operacoes-ferramentas.test.ts:97,123 (crm forjado) | closed |
| T-15-21 | 15-07 | Information Disclosure | `resumidosPorIds` lendo Contato de outro Espaço | high | mitigate | `where workspace_id = $1` com o Espaço da sessão; ids vindos de `args`/`state` do próprio Espaço; caso de teste com Contato de outro Espaço | repositorios/crm/contatos.ts:452-466 `workspace_id = $1`; testes de outro Espaço :195-215,:532 | closed |
| T-15-22 | 15-07 | Denial of Service | `resumidosPorIds` com lista enorme | low | mitigate | teto de 500 ids | contatos.ts:135,454 `TETO_DE_CONTATOS_RESUMIDOS = 500` lança acima; teste :556 | closed |
| T-15-23 | 15-08 | Information Disclosure | nome de registro do CRM na âncora sem permissão | high | mitigate | `ler` confere `podeNoCrm` antes de ler o nome; sem permissão devolve vazio e a operação recusa sem citar o nome | gesto-no-crm/ia.ts:105 `recusaDeLer` antes de ler nome; operacoes-ia.test.ts:343 | closed |
| T-15-24 | 15-08 | Tampering | `nomes` forjados pelo navegador | high | mitigate | posição sobrescrita pelo servidor (`comLidoDoCrm`); caso de rota com nome forjado | ia.ts:114-120 `argumento: lido.nomes ?? {}` via `comLidoDoCrm`; testes :135,:281 (nomes forjados) | closed |
| T-15-25 | 15-08 | Tampering | liberar Conversas de outro Espaço | medium | mitigate | `update` com `workspace_id = $1` da sessão e `atribuido_tipo = 'agente'` | liberacao-do-agente.ts:24 `workspace_id = $1 and atribuido_tipo = 'agente'`; ligado em `AO_CONFIRMAR_IA` | closed |
| T-15-26 | 15-09 | Denial of Service | estrela/leitura inundando a tabela | medium | mitigate | grava só quando o valor muda; teste de repetição | servicos/crm/conversas.ts:423,428 só registra se a estrela muda ou `lidaAte` avança; conversas.test.ts | closed |
| T-15-27 | 15-09 | Information Disclosure | dado pessoal em `antes`/`depois`/`detalhe` | high | mitigate | só nomes de exibição e rótulos; nunca valor de Identificador nem texto de Mensagem; revisão nos testes | chamadas passam só nomes de exibição/rótulos (contatos.ts:463, consentimentos.ts:102); contatos.test.ts:488. Ver ressalva 6 | closed |
| T-15-28 | 15-09 | Repudiation | gesto recusado registrando Atividade | low | mitigate | `registrarAtividade` só no caminho de sucesso; caso de teste | atividade gravada após o sucesso dentro de `comTransacao`; testes 'recusado não grava' em conversas.test.ts | closed |
| T-15-29 | 15-10 | Information Disclosure | nome de qualquer id do banco | high | mitigate | `workspace_id = $1` da sessão em toda consulta; `podeNoCrm` por tipo; id desconhecido e tipo negado → `null`; caso de teste entre Espaços | repositorios/crm/nomes.ts:45,56 `workspace_id = $1`; servicos/crm/nomes.ts:56-66 `podeNoCrm`; nomes.test.ts:136,187 | closed |
| T-15-30 | 15-10 | Denial of Service | lote grande | low | mitigate | teto 200 no zod; uma consulta por tipo | rotas/crm/nomes.ts zod `.max(200)`; servicos/crm/nomes.ts:37 reconfere; nomes.test.ts:233,256 | closed |
| T-15-31 | 15-11 | Information Disclosure | Caixa listando Conversa fora do Espaço | high | mitigate | a lista vem só de `GET /conversas`, que filtra pelo Espaço da sessão (Fase 8/14); a web não monta filtro de Espaço | inbox-columns.tsx:342 `useConversas`; dados/crm/conversas.ts:61-75 sem Espaço; repositorio `c.workspace_id = $1`:193 | closed |
| T-15-32 | 15-11 | Tampering | texto vindo da api renderizado como HTML | medium | mitigate | `contatoNome` e título renderizados como texto React (sem `dangerouslySetInnerHTML`) | nenhum `dangerouslySetInnerHTML` real em apps/web/src; inbox-columns.test.tsx:327-332 (`<img onerror>` vira texto) | closed |
| T-15-33 | 15-12 | Elevation of Privilege | Membro sem permissão editando Canal | medium | mitigate | a api já exige a permissão de gerir Canais (Fase 8); a tela só desliga o botão com `recusaDeGerirCanais` | servicos/crm/canais.ts:152 `exigir(..., 'canal')` em toda escrita; [canal]/page.tsx:105-108 `usePodeNoCrm`. Ver ressalva 7 | closed |
| T-15-34 | 15-12 | Tampering | Canal `conectada` criado fora da página de conectar | medium | mitigate | D-15-12: o popup não cria; prova por grep (sem import da operação antiga) e teste | adicionar-canal-dialog.tsx sem import de criação; único `criarCanal` em conectar-provedor.tsx:25,83; teste :72-106 | closed |
| T-15-35 | 15-13 | Information Disclosure | recuo abrindo registro antigo sem passar pela regra de acesso da api | medium | mitigate | o recuo sai; só a api decide (404 para id de outro Espaço ou inexistente) | páginas [contato]/[empresa]/[negocio] mostram 404 sem recuo ao registro antigo; `features/crm/legado/` apagada | closed |
| T-15-36 | 15-14 | Information Disclosure | Busca revelando registro sem permissão | medium | mitigate | só as rotas REST, que aplicam Papel e Espaço; nada do CRM vem do store | buscar/page.tsx:104-126 lê só `useContatos/Empresas/Negocios/Conversas`; busca-e-lixeira-do-crm.test.tsx:163,187,243 | closed |
| T-15-37 | 15-14 | Denial of Service | busca disparando a cada tecla | low | mitigate | só com 2+ caracteres e `keepPreviousData` do SWR | buscar/page.tsx:68,200 `MIN_QUERY = 2`, `pausado`; `keepPreviousData`; teste :195 | closed |
| T-15-38 | 15-15 | Information Disclosure | Vínculo apontando para registro sem permissão | low | mitigate | os hooks chamam a api, que aplica Papel e Espaço; 403/404 viram estado vazio | reunioes/[reuniao]/page.tsx:151-159 hooks da api; 403/404 → vazio; reuniao.test.tsx:356 | closed |
| T-15-39 | 15-15 | Tampering | texto de nota renderizado como HTML | medium | mitigate | texto React puro, sem `dangerouslySetInnerHTML` | reunioes/[reuniao]/page.tsx:772 via `ActivityTimeline` (texto); sem `dangerouslySetInnerHTML` fora de teste | closed |
| T-15-40 | 15-16 | Tampering | bootstrap criando CRM antigo num Espaço novo | medium | mitigate | o bootstrap não cria Funil; teste de domínio e de api; a guarda de `sem-crm-antigo` cobre o resto | bootstrap-gestao.ts:102-104,141 não cria Funil; testes de domínio e api; guarda `sem-crm-antigo.test.ts` nas 3 camadas | closed |
| T-15-41 | 15-16 | Elevation of Privilege | concessão de acesso a Funil antigo pela Governança | low | mitigate | o ramo sai; o Funil novo segue `privado` + Papel no servidor | governance-access-dialog.tsx:213-224 sem ramo de Funil; nenhum leitor de `state.funnels`. Ver ressalva 3 | closed |
| T-15-42 | 15-17 | Tampering | ids de Contato a criar vindos do navegador | high | mitigate | `contatosACriar` só do `ler` do servidor (`randomUUID`), posição sobrescrita; teste de rota | ferramentas.ts:87 `randomUUID()`; operacoes.ts:259-263,375 sobrescreve; operacoes-ferramentas.test.ts:344 | closed |
| T-15-43 | 15-17 | Tampering | Contato duplicado por corrida | medium | mitigate | trava do Espaço em `executar()`; `contato_identificadores_unico` como rede; prova com `Promise.all` | unidade-de-trabalho.ts:14-19 `for update` no Espaço; 007:115 `contato_identificadores_unico`; teste `Promise.all` :381 | closed |
| T-15-44 | 15-17 | Information Disclosure | número de telefone em log | medium | mitigate | erros e logs só com ids e contagens | contatos-de-participantes.ts:41,87 erro sem número; sem console/log no módulo; participacoes.ts:125-130 | closed |
| T-15-45 | 15-18 | Information Disclosure | agregados de outro Espaço ou de outro Membro | high | mitigate | `workspace_id` e Membro sempre da sessão; esquema `.strict()` recusa `membroId`; caso entre Espaços | rotas/crm/inicio.ts:33-60 `.strict()`; servicos usam `membro.workspaceId/id`; testes rota :85,123,179 | closed |
| T-15-46 | 15-18 | Denial of Service | janela enorme nas estatísticas | medium | mitigate | teto de 400 dias; `group by` por dia | dominio/crm/inicio.ts:32 janela máx. 400 dias, :125-134; `group by`; `.max(QUALIFICACOES_MAXIMAS)`; teste :423 | closed |
| T-15-47 | 15-18 | Tampering | fuso usado no SQL | medium | mitigate | fuso validado contra a lista IANA e passado como `$n` | dominio/crm/inicio.ts:115-117 `Intl.supportedValuesOf('timeZone')`; repositorio fuso `$5::text`; teste :153 | closed |
| T-15-48 | 15-19 | Tampering | cliente forjado pelo navegador | high | mitigate | posição sobrescrita pelo servidor; teste de rota | gesto-no-crm/financeiro.ts:36-46 sobrescreve posição 1 com leitura da tabela; operacoes-financeiro.test.ts:101,110,122 | closed |
| T-15-49 | 15-19 | Information Disclosure | nome de cliente de outro Espaço | medium | mitigate | `POST /crm/nomes` só do Espaço da sessão (15-10) | financeiro.ts:41-43 vazio sem `podeNoCrm` ler; servicos/crm/nomes.ts:44-65; use-nomes-dos-clientes.ts | closed |
| T-15-50 | 15-20 | Tampering | XSS por texto de Mensagem recebida | high | mitigate | renderização como texto React, sem `dangerouslySetInnerHTML`; teste com texto contendo `<script>` aparecendo literal | sem `dangerouslySetInnerHTML`/`innerHTML` em apps/web/src; conversation-thread.test.tsx:431-434 (`<script>` literal) | closed |
| T-15-51 | 15-20 | Tampering | envio duplicado | low | mitigate | botão desligado durante o envio; teste de duplo clique | conversation-thread.tsx:240,476-477 `enviandoRef` + botão desligado; testes :380, :608, :706 | closed |
| T-15-52 | 15-20 | Elevation of Privilege | enviar fora da janela ou sem consentimento | medium | mitigate | quem decide é a api (regras da Fase 8/14); a tela só mostra a recusa | servicos/crm/mensagens.ts:141 409 `JANELA_EXPIRADA`; :147 consentimento; a tela só mostra a recusa (:464) | closed |
| T-15-53 | 15-21 | Information Disclosure | nome de registro sem permissão na âncora | medium | mitigate | `POST /crm/nomes` devolve `null` sem permissão; a tela mostra "Registro indisponível" | servicos/crm/nomes.ts:44-65 `null` sem permissão; ancora-do-chat.tsx:44,112 'Registro indisponível'; testes :189,:292 | closed |
| T-15-54 | 15-22 | Information Disclosure | nome de Participante sem permissão | low | mitigate | nomes só por `POST /crm/nomes` (Espaço e Papel da sessão) | ferramentas/participacoes.tsx:39,44-48 nome só de `useNomesDoCrm`; `null` sem link; ferramentas-no-crm-novo.test.tsx | closed |
| T-15-55 | 15-22 | Tampering | Participação com Contato forjado | medium | mitigate | o servidor relê o `crm` (15-07/15-17); a tela não decide | gesto-no-crm/ferramentas.ts:127-135,156-188 toda op de Ferramenta lê o servidor e sobrescreve `crm`; teste :206 | closed |
| T-15-56 | 15-23 | Information Disclosure | widget do Painel com dado sem permissão | medium | mitigate | as listas vêm das rotas com Papel e Espaço; a regra `scopeVisible` do Painel continua | paineis/[painel]/page.tsx:193 403→`semAcesso`; listas por rotas com `exigir`; derive.ts:858-861 `scopeVisible` | closed |
| T-15-57 | 15-23 | Repudiation | número errado apresentado como total | low | mitigate | marca "Parcial" quando `total` > lido | paineis/[painel]/page.tsx:117 `parcial: total > itens.length`, :198-202; painel-no-crm-novo.test.tsx:166 | closed |
| T-15-58 | 15-24 | Elevation of Privilege | gesto sem permissão | medium | mitigate | a api decide (`podeNoCrm`); a tela só desliga por `usePodeNoCrm` com a mesma função do domínio | API `exigir` em conversas.ts:167,224,292,345 e contatos.ts:166; web `usePodeNoCrm` só desliga o item | closed |
| T-15-59 | 15-24 | Tampering | qualificação com id fora do Catálogo | low | mitigate | a api confere a qualificação (Fase 7); a tela só oferece itens do Catálogo | ABERTO: só a metade da tela existe (coluna-do-contato.tsx:86); a api não confere o Catálogo (rotas/crm/contatos.ts:82 `TEXTO_CURTO`; 007:16 texto livre). Ver ressalva 2 | open — below high threshold (non-blocking) |
| T-15-60 | 15-25 | Tampering | XSS no texto de nota | medium | mitigate | texto React puro | nenhum sink de HTML em apps/web/src; a Nota vai direto à api (conversation-thread.test.tsx:285-296) | closed |
| T-15-61 | 15-25 | Information Disclosure | nome de Vínculo sem permissão | low | mitigate | `POST /crm/nomes` devolve `null`; a tela mostra "Registro indisponível" | tarefa-completa.tsx:300-312,2132-2146 `useNomesDoCrm`; `null` → `NOME_INDISPONIVEL`; teste :378 (n) | closed |
| T-15-62 | 15-26 | Information Disclosure | filtro por Proprietário revelando Negócio sem permissão | low | mitigate | o filtro só restringe; a api continua aplicando Papel, Funil privado e Espaço | repositorios/crm/negocios.ts:176-188 filtro só restringe, `workspace_id = $1` sempre; servicos :407 `exigir ler`. Ver ressalva 3 | closed |
| T-15-63 | 15-26 | Denial of Service | rota apagada quebrando favoritos | low | accept | 404 do app; "Meus negócios" do menu leva ao quadro do Funil | aceito: páginas `crm/meus-negocios` apagadas; app-shell.tsx:158 leva a `/crm/negocios?meus=1` | closed (aceito) |
| T-15-64 | 15-27 | Tampering | script escrevendo no Espaço errado | high | mitigate | `--espaco` obrigatório, regex e existência; uma `executar()` por Espaço; `workspace_id = $1` em toda consulta; o CLI imprime host e Espaço antes de escrever | migrar.cli.ts:84,114-117 `--espaco` obrigatório; colecoes.ts:91-97 regex; migrar-crm-antigo.ts:147-150 existência; banner de Banco/Espaço | closed |
| T-15-65 | 15-27 | Repudiation / Denial of Service | perda de dado ao apagar `registros` | high | mitigate | cópia byte a byte + contagem igual antes do `delete`, na mesma transação; rollback em qualquer falha; `--verificar`; backup manual do corte (15-34) | migrar-crm-antigo.ts:214-216 cópia → `conferirCopia` (guardar.ts:82-115) → `apagarDoRegistros` no mesmo `executar()`; `--verificar` :365 | closed |
| T-15-66 | 15-27 | Tampering | SQL dinâmico | high | mitigate | valores sempre `$n`; nomes de tabela e coluna só de constantes | guardar.ts:38-45 usa `$1..$6`; os únicos `${}` em SQL são constantes tipadas (crm-novo.ts:44) | closed |
| T-15-67 | 15-27 | Information Disclosure | relatório com dado pessoal | high | mitigate | `montarRelatorio` só recebe ids, contagens e nomes de configuração; teste com campos pessoais na entrada | relatorio.ts:1-9 só ids, contagens e nomes de configuração; guardar.ts:78-114 erro só com contagens; relatorio.test.ts:114,195 | closed |
| T-15-68 | 15-27 | Elevation of Privilege | teste abrindo produção | high | mitigate | `describeComBanco` (host local) e comandos com as duas URLs locais | testes/banco-crm.ts:31-32 `describeComBanco = hostEhLocal(...)`; host-local.ts:45-58 recusa query string; migrar.cli.test.ts:68 | closed |
| T-15-69 | 15-28 | Tampering | SQL de inserção em lote | high | mitigate | colunas de constantes; valores por `$n`/`jsonb_to_recordset` | inserir.ts:3-8,268-277 colunas de constantes; valores por `$1` e `$2::jsonb` | closed |
| T-15-70 | 15-28 | Denial of Service | uma Empresa sem admin derrubando o Espaço no `commit` | medium | mitigate | pré-validação no mapeador, item vai ao relatório | mapeador.ts:722-727 manda 'empresa-sem-admin' ao relatório; mapeador.test.ts:258 | closed |
| T-15-71 | 15-28 | Information Disclosure | fixture com dado real | high | mitigate | gerada só de `buildSeed()` (sintético); prohibition explícita | migracao-crm/CONTEXT.md:195 e fixture sintética; origem em `seed.ts` (cfa70fe); nenhum `.dump`/csv versionado | closed |
| T-15-72 | 15-29 | Tampering | `bootstrap:crm-demo` rodado em produção | high | mitigate | recusa de host não local antes de conectar; recusa de Espaço com Contato; teste | crm-demo.cli.ts:81 `exigirBancoLocal` antes do `pool()`; crm-demo.ts:45-47,347-349; testes :182,264,285 | closed |
| T-15-73 | 15-29 | Tampering | SQL por substituição de texto | high | mitigate | colunas constantes, valores `$n`, `workspace_id` como parâmetro | crm-demo.ts:287 tabela/colunas de constantes, `workspace_id` como `$1` (:301) | closed |
| T-15-74 | 15-30 | Information Disclosure | cópia com dado pessoal | high | mitigate | fica em `~/n1-ensaio` (fora do repositório); `15-ENSAIO.md` só com números; contêiner apagado por `trap` | `~/n1-ensaio` fora do repositório; 15-ENSAIO.md só com números; limpeza por `trap` (:30,:292) | closed |
| T-15-75 | 15-30 | Tampering | ensaio escrevendo em produção | high | mitigate | o executor só usa URLs locais escritas no comando; a leitura de produção é do dono, na checkpoint, em sessão somente leitura | 15-ENSAIO.md:20,205,296 toda chamada com URLs locais; leitura de produção é do dono, em sessão só de leitura (:193). Controle de processo | closed |
| T-15-76 | 15-31 | Tampering | código de produção usando o construtor antigo | low | mitigate | só testes de código que sai o chamam; guarda `sem-crm-antigo` lista o arquivo e o 15-43 o apaga | `seed-crm-antigo.ts` não existe; sem-crm-antigo.test.ts:76 afirma a ausência; só `*.test.tsx` importam o auxiliar de teste | closed |
| T-15-77 | 15-31 | Elevation of Privilege | gate rodando contra produção | high | mitigate | URLs locais escritas no comando; nunca `npm test` sozinho | URLs locais no comando literal de 15-PROVAS.md:27-29,35; host-local.ts:43 `hostEhLocal`; banco-crm.ts:29,50. Ver ressalva 8 | closed |
| T-15-78 | 15-32 | Tampering | operação antiga gravando CRM antigo em `registros` depois do corte | high | mitigate | os nomes saem de `OPERACOES`; 404 provado; `--verificar` no corte pega qualquer linha que reapareça | rotas/operacoes.ts:272 404 via `ehNomeDeOperacao`; nenhum dos 40 nomes em `OPERACOES`; testes `operacoes-antigas-*`; `verificar()` :376 | closed |
| T-15-79 | 15-32 | Denial of Service | remoção quebrando uma tela não migrada | medium | mitigate | checkpoint do dono com a evidência das guardas; `tsc` e gate completos | script `typecheck` nos 3 workspaces; gate verde na 3ª rodada (15-PROVAS.md:40). Ver ressalva 5 | closed |
| T-15-95 | 15-33 | Denial of Service | tela que ainda lia Canal pelo `state.channels` projetado | medium | mitigate | guarda final da web (lista congelada vazia) e `npm run check` no fim deste plano; todas as telas leem `useCanais` desde os planos 15-11 a 15-40 | web sem-crm-antigo.test.ts:25 `CONGELADOS=[]`; 0 usos de `state/data.channels`; 39 arquivos usam `useCanais` | closed |
| T-15-82 | 15-34 | Tampering | gate rodando contra produção | high | mitigate | URLs locais escritas no comando; comando literal em `15-PROVAS.md` | mesmo controle de T-15-77 (comando literal com URLs locais; `hostEhLocal`). Ver ressalva 8 | closed |
| T-15-83 | 15-34 | Information Disclosure | dado pessoal em `15-ENSAIO.md`/`15-CORTE.md` | high | mitigate | só números e nomes de configuração; contêiner apagado | regex de e-mail/telefone/CPF/CNPJ/JWT/URL com senha em 15-ENSAIO/CORTE/PROVAS devolve 0; nenhum `.dump`/`.env` versionado | closed |
| T-15-84 | 15-34 | Tampering | roteiro executado fora de ordem | medium | mitigate | `15-CORTE.md` numerado, com conferência por passo e a regra "parar se o passo falhar" | 15-CORTE.md passos 1-10 com Conferir/Esperado/pare; regra 4 'Parar se o passo falhar'. Ver ressalva 9 | closed |
| T-15-85 | 15-35 | Repudiation / Denial of Service | perda de dado no corte | high | mitigate | backup restaurado e conferido antes (passo 2); cópia em `registros_crm_antigo`; `--verificar`; decisão registrada | 15-CORTE.md:54-77 backup + restauração + contagem; `conferirCopia` guardar.ts:87; `verificar()`; 15-PROVAS.md:262 | closed |
| T-15-86 | 15-35 | Tampering | executor agindo em produção | high | mitigate | todas as ações de produção são checkpoints do dono; o executor só registra | tarefas de checkpoint em 15-35-PLAN.md:74,100; corte feito pelo assistente com autorização do dono (15-PROVAS.md:260). Ver ressalva 1 | closed |
| T-15-87 | 15-36 | Repudiation | diálogo prometendo liberar o que o banco passa ao Sucessor | medium | mitigate | tipo único do domínio (`@n1/dominio/crm/sucessao`); teste de componente confere texto e contagem; grep sem `conversasLiberadas` nas três camadas | tipo único `SucessaoNoCrm` (dominio/crm/sucessao.ts); membro-sucessao-no-crm.test.tsx (a)(c); sem `conversasLiberadas` | closed |
| T-15-88 | 15-36 | Elevation of Privilege | Conversa de Grupo passada a um Sucessor inválido no replay | low | mitigate | `removeMember` só troca o Atribuído depois da validação do Sucessor que já existe (Membro `ativo`, sem base Convidado); repetir não muda nada (teste) | members.ts:237-246 valida Sucessor antes da troca :309-311; members-remocao.test.ts:105,144 | closed |
| T-15-12 | 15-37 | Information Disclosure | `GET /atividades` entre Espaços e Papéis | high | mitigate | `workspace_id` da sessão em todo `where`; `exigir`/`podeNoCrm` por tipo; caso de vazamento entre Espaços e de Papel sem `ler` (Task 2) | atividades.ts:124 `workspace_id = $1` da sessão; `podeNoCrm` por tipo; rota `.strict()`; testes (b)(c)(d) | closed |
| T-15-89 | 15-37 | Denial of Service | página de Atividade sem teto | low | mitigate | `limite` com teto `LIMITES_DE_ATIVIDADE.paginaMaxima` no esquema; caso de 400 | rotas/crm/atividades.ts:30 `.max(paginaMaxima)` (200); dominio/crm/atividades.ts:73 reconfere; teste 400 `it.each` | closed |
| T-15-90 | 15-38 | Tampering | valor de `comIdentificador` montando SQL | medium | mitigate | `z.enum` dos tipos do domínio e valor sempre por `$n`; caso de 400 | rotas/crm/contatos.ts:48 `z.enum(TIPOS_IDENTIFICADOR_CONTATO)`; repositorio :279-282 `$n`; contatos.test.ts:160 | closed |
| T-15-91 | 15-38 | Information Disclosure | filtro revelando Contato de outro Espaço | medium | mitigate | o `exists` amarra `i.workspace_id = c.workspace_id` e a lista já filtra pelo Espaço da sessão | repositorios/crm/contatos.ts:280 `exists` amarra `ci.workspace_id = c.workspace_id`; lista `c.workspace_id = $1`; teste :629 | closed |
| T-15-92 | 15-39 | Tampering | `funis` forjados pelo navegador | high | mitigate | posição sobrescrita pelo servidor (`comLidoDoCrm`); caso de rota com Funil forjado, repetido | gesto-no-crm/ia.ts:118-127 lê o Funil da tabela; operacoes.ts:375 sobrescreve `funis`; teto 200; operacoes-ia.test.ts:330 | closed |
| T-15-93 | 15-39 | Information Disclosure | escopo apontando Funil de outro Espaço | medium | mitigate | a leitura lista só os Funis do Espaço da sessão; Funil de fora não existe para o domínio | ia.ts:123 `obter(workspaceId, scopeId)` filtra `workspace_id = $1` (funis.ts:239); operacoes-ia.test.ts:318 | closed |
| T-15-94 | 15-40 | Tampering | volta de um caminho que cria Negócio/Conversa no modelo antigo pela Lista | medium | mitigate | os quatro componentes apagados; guarda `sem-listas-espelho.test.ts` atualizada na mesma mudança; `npm run check` no fim | `deal-card`, `deal-screen`, `iniciar-conversa-dialog` apagados; `sem-listas-espelho.test.ts` `CONGELADOS=[]` | closed |
| T-15-96 | 15-41 | Tampering | ex-Pasta fixa movida ou reorganizada nos Espaços de teste com Tarefas espelho | low | accept | as permissões de mover continuam as da Estrutura (Papel e Espaço); nada é apagado; os Espaços de teste ficam como o relatório do corte os lista (D-15-14) | aceito: 15-41-PLAN.md:151; `ehEstruturaFixa` não lista mais a Pasta (estruturas-fixas.ts:33); `moveContainer` mantém Papel/Espaço | closed (aceito) |
| T-15-97 | 15-42 | Denial of Service | derivação apagada que uma tela ainda chamava | medium | mitigate | grep antes de cada remoção e `tsc` da api e da web em cada tarefa; chamador achado para o executor e vai ao SUMMARY | grep das derivações apagadas só acha comentários; `responseWindowOpenUntil` mantida (derive.ts:613); `typecheck` nos 3 workspaces | closed |
| T-15-98 | 15-42 | Denial of Service | teste que ainda monta o CRM antigo quebrando o `tsc` quando o 15-43 encolher o `DataState` | medium | mitigate | Task 3 limpa os testes das três camadas com grep de aceitação vazio e gate em Docker; o 15-43 Task 1 ainda trata, pelo `tsc`, o que o grep não alcança | grep em packages e apps só acha o cast deliberado de hidratar-crm-antigo.test.ts:84; guardas de domínio e web passam | closed |
| T-15-80 | 15-43 | Information Disclosure | linhas antigas voltando no `GET /estado` | high | mitigate | o corte apaga as linhas antes de publicar (D-15-02) e roda `--verificar`; `hidratar-crm-antigo.test.ts` prova que a linha antiga volta enquanto existir e some depois de `apagarDoRegistros`; a guarda e o `tsc` impedem leitura nova | hidratar-crm-antigo.test.ts:68,90 (linha volta e some após `apagarDoRegistros`); `--guardar` 08:18-08:20 antes de `publicar.sh` 08:22; 19/19 `--verificar` | closed |
| T-15-81 | 15-43 | Denial of Service | remoção quebrando Grupo/Flow | medium | mitigate | `ConversaDeGrupo` mantém o que Grupo/Flow usam; o teste de `hidratar` confere a Conversa de Grupo; testes de Ferramentas no gate | types/conversa-de-grupo.ts:87 `ConversaDeGrupo` é o tipo de `state.conversations`; hidratar-crm-antigo.test.ts:77,100 | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — só ameaças abertas em `high` ou acima contam para `threats_open`*
*Disposition: mitigate (implementação exigida) · accept (risco documentado) · transfer (terceiro)*

**Contagem:** 98 ameaças — 93 fechadas por mitigação, 4 aceitas, 1 aberta abaixo do limiar (T-15-59). Por severidade: 36 high, 41 medium, 21 low. `threats_open: 0`.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-15-01 | T-15-09 | A rota de contagens da sucessão já exige o Papel que gerencia Membros (Fase 14) e devolve só números | Plano 15-03 (disposição `accept` no `threat_model`) | 2026-11-07 |
| AR-15-02 | T-15-15 | O resumo devolve Empresa e Atribuído para ids sem Tarefa visível (IN-05); todo Papel com `ler` no CRM já alcança esses recursos (não existe escopo "próprios") e o escopo por `workspace_id` da sessão vale. IN-05 segue aberto por D-15-07 | Plano 15-05 (disposição `accept` no `threat_model`) | 2026-11-07 |
| AR-15-03 | T-15-63 | Rota apagada quebra favoritos: 404 do app; "Meus negócios" do menu leva ao quadro do Funil | Plano 15-26 (disposição `accept` no `threat_model`) | 2026-11-07 |
| AR-15-04 | T-15-96 | Ex-Pasta fixa movida nos Espaços de teste com Tarefas espelho: a permissão de mover continua a da Estrutura (Papel e Espaço), nada é apagado, os Espaços de teste ficam como o relatório do corte os lista (D-15-14) | Plano 15-41 (disposição `accept` no `threat_model`) | 2026-11-07 |

*Os quatro aceites vêm da disposição `accept` escrita pelos planos; o auditor confirmou que as justificativas continuam verdadeiras no código. O dono não os reconfirmou um a um. O "pass all" do UAT (2026-11-07) cobre o item 2 da fase, mas não cita estes quatro.*

*Risco aberto sem aceite formal:* **T-15-59** (low, abaixo do limiar `high`, não bloqueia) — ver ressalva 2.

---

## Ressalvas dos auditores

Nenhuma bloqueia (`threats_open: 0`), mas o dono deve conhecê-las:

1. **T-15-86 (high) — desvio da mitigação declarada.** O controle declarado era "todas as ações de produção são checkpoints do dono; o executor só registra". O assistente executou o corte em produção (migrar 012, `--guardar`/`--migrar`, `publicar.sh`, push em `main`) com base na mensagem do dono "pode fazer tudo isso ai e fazer o corte" (`15-PROVAS.md:260`, `15-35-SUMMARY` "Desvios"). O passo 1 (avisar a equipe) foi pulado. O corte foi verificado (backup restaurado antes, 19/19 `--verificar`, contagens conferidas). O auditor fechou a ameaça porque ela trata de ação não autorizada e a autorização está documentada. O dono passou o UAT da fase, teste 4 (decisões tomadas em seu nome e execução do corte pelo assistente), com um "pass all" em bloco em 2026-11-07, sem detalhar item a item.
2. **T-15-59 (low, aberta, não bloqueia).** A mitigação declarada ("a api confere a qualificação, Fase 7") não é verdadeira: a Fase 7 deixou `qualificacao` como texto livre (`007-crm.sql:16`). Um Membro com `editar contato` pode gravar qualquer texto. Impacto: integridade de dados dentro do próprio Espaço, não vazamento entre Espaços. Saída: validar contra o Catálogo em `servicos/crm/contatos`, ou aceitar o risco e reescrever o plano.
3. **T-15-41 e T-15-62 (low, mantidas fechadas).** Os dois textos de mitigação dizem que a api aplica "Funil privado", mas no código `privado` só é guardado (`servicos/crm/funis.ts:17`; Fase 7 D-10 adiou a visibilidade). Papel e Espaço são aplicados; os vetores reivindicados estão fechados.
4. **T-15-02 (comentário desatualizado).** `rotas/operacoes.test.ts:269` diz que o arquivo não carrega o `.env`, mas importa `testes/banco-crm.ts`, que o lê. A guarda vale: `temBancoCrm` é falso para host remoto.
5. **T-15-79 e checkpoints 15-32/15-33/15-42.** As respostas "remover" e "seguir" foram dadas pelo orquestrador, citando a licença geral "pode fazer o que precisar para fechar a fase" (`15-32-SUMMARY.md:121`, `15-42-SUMMARY.md:62,119`). As proteções técnicas existem (guardas, `tsc`, gate verde). O UAT teste 4 cobre essa confirmação e foi passado em bloco ("pass all"), sem revisão item a item.
6. **T-15-27 (borda, impacto baixo).** `servicos/crm/conversas.ts:141-146` grava `objeto_nome = conversa.titulo`. Para Contato sem nome o título cai no valor do Identificador, então um telefone pode ir para `crm_atividades.objeto_nome`. É a mesma string do título visível. Notas, contatos e sucessão usam "Contato sem nome".
7. **T-15-33 (nome no plano).** O plano cita `recusaDeGerirCanais`, que não existe no repositório. O controle real na tela é `usePodeNoCrm`; o que fecha a ameaça é `exigir` no servidor (`canais.ts:152`).
8. **T-15-77 e T-15-82 são controles de procedimento para os testes de banco mais antigos.** Vários testes da api ainda usam só `Boolean(process.env.DATABASE_URL)` como guarda (`bootstrap/gestao.test.ts:21`, `rotas/financeiro.test.ts:393`, `rotas/classificacoes.test.ts:231`, outros). `npm test` sozinho, com o `.env` de produção, poderia alcançar produção. A guarda estrutural (`hostEhLocal`) cobre só os auxiliares do CRM e o bootstrap de demonstração. Isso confere com a mitigação declarada ("nunca `npm test` sozinho"), por isso fica fechada como escrita.
9. **T-15-84 (menor).** O corte executado rodou os passos 3 e 4 antes do 2 (backup). Os três são só de leitura e o backup veio antes da primeira escrita, sem impacto.

### Sinalizações sem ID de ameaça

- **`DATABASE_SSL_INSECURE=true`** esteve ligado no corte (`pg_dump`, migração e script). Fica na configuração local do dono; o UAT teste 7 foi passado em bloco ("pass all") e lido como aceite consciente. Nada foi alterado.
- **`HOST_LOCAL` sem âncora** em `apps/api/src/persistencia/conexao.ts:24,38`: `/localhost|127\.0\.0\.1/.test(connectionString)` pula o TLS para qualquer URL que apenas contenha "localhost". É a mesma fraqueza que M-01 corrigiu em `host-local.ts`. Está nos itens abertos de `15-44-SUMMARY.md`, sem ID.
- **Linhas antigas em `registros`** são servidas por `GET /estado` como chave desconhecida até o script do corte apagá-las. O corte rodou (`registros` = 22119 depois), então o resíduo só vale para outro banco que não rodou `migrar:crm-antigo`.
- **`crm_atividades` é só inserção por convenção de código** (`012` diz "Sem trigger no banco"); o papel `n1_api` recebe update e delete pelos privilégios padrão da 009. T-15-11 está satisfeita como declarada (acesso só pelo repositório), mas nada no banco impede um update/delete se outro código obtiver o pool.
- **Funil `privado` não é aplicado em nenhuma leitura**: os Negócios de um Funil privado ficam visíveis a qualquer Papel com `ler negocio`. É anterior e foi adiado pela Fase 7 (D-10), mas o texto das ameaças da Fase 15 o trata como controle.
- **`migrar.cli.ts` não tem trava de host nem confirmação**; a única proteção é a linha impressa `Banco: host · Espaço` (desenho de T-15-64). Com o `.env` apontando para produção, `npm run migrar:crm-antigo` sem URLs explícitas gravaria em produção.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-07 | 98 | 97 | 1 (non-blocking) | gsd-security-auditor ×3 (lotes: planos 01–15, 16–30, 31–44), ASVS 1, verificação estática |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-07 (auditoria estática por agentes; a ressalva 2 segue aberta e as 1 e 5 só passaram em bloco no UAT)
