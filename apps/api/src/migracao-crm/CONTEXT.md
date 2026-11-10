# migracao-crm — o script `migrar:crm-antigo`

Ler primeiro: [`../../../../CONTEXT.md`](../../../../CONTEXT.md), [`../../CONTEXT.md`](../../CONTEXT.md) e
[`../persistencia/CONTEXT.md`](../persistencia/CONTEXT.md)

## O que é

O script de dados do corte da Fase 15 (UCR-09): tira o CRM em inglês (Contato, Empresa, Negócio, Funil,
Canal, Conversa e os Vínculos) de `plataforma.registros`, guardando uma cópia em
`plataforma.registros_crm_antigo`, e leva ao CRM novo o que o `ws_n1` precisa. É **temporário**: a pasta sai
do repositório num plano de limpeza depois do corte aceito.

Mora aqui, e não em `importacao/`, porque `importacao/` não tem SQL (o `CONTEXT.md` de lá proíbe). Roda
fora do processo da API, na mão do dono, e **nunca** é chamado por rota nem por agendador.

## Os comandos

Da raiz do repositório, com **exatamente um** modo por execução (não existe modo padrão) e `--espaco`
sempre explícito (não existe "todos os Espaços"):

| Comando | O que faz |
|---|---|
| `npm run migrar:crm-antigo -w @n1/api -- --espaco ws_n1 --seco` | Relatório: contagem por coleção, o Funil com as Etapas, o que aponta para ele, a Pasta "Meus negócios" e o que cada modo faria. A sessão é `begin read only`: o Postgres recusa qualquer escrita. |
| `… --espaco <id> --guardar` | Copia as nove coleções para `registros_crm_antigo`, confere e apaga de `registros` o CRM antigo (D-15-01). Não cria linha no CRM novo. Serve aos 17 Espaços de teste e ao Espaço vazio. **No `ws_n1` não é o caminho de "guardar o Funil"** (L-08): `--guardar` tira de `registros` tudo o que houver de CRM antigo lá (Contatos, Conversas...) sem levar nada ao CRM novo, e o script não relê `registros_crm_antigo`, então o que saiu assim só volta por um script novo. Quem quer guardar o Funil no `ws_n1` usa `--migrar --funil=guardar`, que o guarda e leva ao CRM novo o que cabe. |
| `… --espaco ws_n1 --migrar --funil=migrar` | Faz o `--guardar`, leva o Funil e as Etapas para `plataforma.funis`/`etapas` (D-15-04) e, na mesma transação, Contatos, Empresas, Negócios, Canais, Conversas e Mensagens (15-28). |
| `… --espaco ws_n1 --migrar --funil=guardar` | Faz o `--guardar` e leva o que cabe, **sem** Funil (D-15-13): como não há Funil, nenhum Negócio migra. |
| `… --espaco <id> --verificar` | Confere, sem escrever, a pós-condição; sai com 1 se algo não bate. |

Saída: `0` ok, `1` falha da verificação ou erro inesperado, `2` erro de uso (argumento, Espaço inexistente,
recusa antes de escrever). Antes de qualquer escrita o script imprime o host e a porta que o `pg` usa (sem usuário nem
senha; `persistencia/host-local.ts`, o `?host=` da URL conta) e o Espaço.

## O que cada modo faz

**`--guardar`** roda numa única `executar()` do Espaço (a trava padrão): trava a linha do Espaço, sobe a
`revisao`, e desfaz tudo em qualquer falha. Dentro dela, nesta ordem (F14-D-03):

1. `lerDoCrm` copia as nove coleções para `registros_crm_antigo` (`dados` e `ordem` como estão,
   `on conflict do nothing`) e **confere**: toda linha a apagar tem uma cópia idêntica, e toda linha copiada
   tem cópia com a mesma chave. Uma divergência lança e a transação inteira volta.
2. A `operacao` (pura) tira só a Pasta "Meus negócios" do estado, se for o caso (abaixo). Ela **não** toca
   nas nove coleções antigas.
3. `aoConfirmar` apaga de `registros` por SQL: as oito coleções inteiras e as Conversas do CRM antigo (abaixo).

**O que fica em `registros` (15-44, H-02).** Grupo e Flow ficam no modelo antigo até as Sessões 6 e 7 (F14-D-05),
e esse modelo também abre Conversa **1:1**, sem `groupIdentifier`: o convite de Grupo, a Resposta de Flow e a Ação
"enviar ao Contato" da Automação (`receiveMessage` e `startConversation`, em `conversa-de-grupo.ts`), sempre com um
Contato de `plataforma.contatos`. Por isso "sem Grupo" não basta. A Conversa é **do CRM antigo** (copiada, migrada
quando há destino, apagada de `registros`) só quando NÃO é de Grupo e o `contactId` dela **é um id da coleção
`contacts` antiga do MESMO Espaço**. Todo o resto é **copiado mas NUNCA apagado nem migrado**: a Conversa de Grupo
(`groupIdentifier` objeto), a 1:1 de Flow/Automação/convite (Contato fora de `contacts`) e qualquer Conversa que não dá
para classificar (`contactId` ausente, nulo, vazio ou que não é texto): nunca se apaga o que não se sabe classificar.
O critério existe em TypeScript (`ehConversaDoCrmAntigo`, que o mapeador usa) e em SQL (`SQL_E_CONVERSA_DO_CRM_ANTIGO`, com
um `exists` sobre `contacts` do mesmo `workspace_id`) e é **o mesmo** no `--guardar`, no `--migrar`, no `--seco` e no
`--verificar` (b); `colecoes.test.ts` confere que os dois concordam numa tabela de casos. O resultado e o `--seco` dizem
quantas ficaram e por quê (de Grupo / 1:1 de Flow, Automação ou convite). **Limitação conhecida:** um Contato cujo id
existe nas duas coleções antes do corte é tratado como antigo. **Alternativa rejeitada:** decidir pelo Canal (o da
Conversa existe só em `plataforma.canais`): desde a Fase 8 toda Conversa da Caixa antiga também cita um Canal que está
na tabela nova, com o mesmo id, então o Canal não separa a Conversa de Flow da antiga.

**Pasta "Meus negócios" (D-15-14).** Achada pelo id do seed (`fld_meus_negocios`), nunca pelo nome. Se
**todas** as Listas dela estão vazias (nenhuma Tarefa, em qualquer estado), a Pasta, as Listas e as
Visualizações delas são copiadas e removidas (o Conjunto de Status vive dentro da Lista e sai junto). Se
**alguma** tem Tarefa, nada da Pasta sai e o resultado lista as Listas e as contagens, para o dono decidir.
O script não toca em Tarefa. Referências de fora (uma Automação com escopo numa dessas Listas, por exemplo)
não são reescritas.

**`--migrar`** é o `--guardar` mais o Funil e o mapeador de entidades (abaixo). Recusa, **antes de escrever
qualquer coisa**, só o Espaço com Funil antigo e sem `--funil`. (Até o 15-27 ele também recusava o Espaço com
Contatos, Empresas, Negócios, Canais ou Conversas: o 15-28 tirou essa recusa.)

O Funil entra com o **id antigo** e as Etapas com **id novo**. `crm_de_para` guarda a ponte:
`('funnels', <funil>, 'funis', <funil>)` e `('funnels/stages', '<funil>/<etapa antiga>', 'etapas',
<etapa nova>)`. O padrão (`padrao = true`) só vai ao Funil elegível (ativo e não privado) se o Espaço ainda
não tem Funil padrão: o do `defaultFunnelId` antigo, se ainda estiver gravado, senão o primeiro pela ordem.
Tudo sob o mesmo `pg_advisory_xact_lock(hashtext('funil-padrao:'||ws))` do serviço de Funis, que reconfere
o padrão. Um Funil **não migra** (e o resultado diz por quê, com o id e o nome) se não tem nome ou Etapa, se
o id já existe, se o nome está em uso por Funil ativo ou arquivado (`nome em uso`) ou se repete nome de
Etapa. Ele continua na cópia.

A decisão do Funil vale **antes da primeira escrita**: depois de um `--guardar`, o Funil já saiu de
`registros` e o script não o lê mais de `registros_crm_antigo`. Para trazê-lo depois é preciso recriá-lo
pela tela de Funis.

**O mapeador de entidades (15-28).** Dentro da mesma `executar()`, `lerDoCrm` lê as nove coleções de
`registros` e o que o CRM novo do Espaço já tem (`crm-novo.ts`), e `planejarMigracao` (puro, `mapeador.ts`)
decide as linhas novas, o de-para e o relatório. O `aoConfirmar` insere o Funil e **depois** o plano
(`inserirPlano`), e só então apaga de `registros`. Detalhes na seção "O mapeador" abaixo.

**`--verificar`** confere em `begin read only`: (a) nenhuma linha das oito coleções sem Grupo em `registros`;
(b) em `conversations` de `registros`, nenhuma Conversa **do CRM antigo** (só ficam as de Grupo e as 1:1 de Flow/Automação,
o mesmo critério do `--guardar`; a 1:1 de Flow não é falha); (c) nenhuma linha órfã em `crm_de_para` (a
Etapa se confere pelo Funil); (d) imprime a contagem por coleção de `registros_crm_antigo`. A contagem de
(d) é a base de comparação com o `--seco` de antes da escrita: o roteiro do ensaio (15-30) e do corte
(15-34/15-35) guarda as duas e confere que são iguais.

**Repetir não muda nada.** Rodar `--guardar` ou `--migrar` de novo no mesmo Espaço não copia, não apaga e
não insere: o resultado diz "nada a fazer" e nem a revisão do Espaço sobe.

## O mapeador (15-28)

**Ids preservados.** O id antigo vira o id novo (as colunas são `text`): Contato, Empresa, Funil, Negócio,
Canal, Conversa e Mensagem. Por isso o Vínculo de Tarefa, a `provenance`, o escopo de Automação e a
`canaisDeAtendimento` de uma Lista, que estão em `registros` e **não são reescritos**, seguem achando o
registro (WINDOWS #22, #32, #42, #49, #52). Têm id **novo** os que não têm chave única no Espaço: a Etapa
(`funnels/stages`, 15-27), o Identificador de Contato e de Empresa e o vínculo Contato-Empresa. Toda linha
migrada tem uma linha em `crm_de_para` (`colecao_antiga`, `id_antigo`, `tabela_nova`, `id_novo`); os aninhados
levam o pai no `id_antigo` (`contacts/identifiers` = `<contato>/<identificador>`, `companies/identifiers`,
`conversations/messages` = `<conversa>/<mensagem>`), que é o que o `--verificar` usa para achar a origem.

**Ordem dos inserts** (as chaves estrangeiras): Canais → Contatos sobreviventes → Contatos mesclados →
Identificadores → Empresas (matriz antes da filial) → Identificadores de Empresa → `contato_empresa` → [Funis e
Etapas, que `inserirFunis` já pôs] → Negócios → Conversas → Mensagens (em ordem de `createdAt`, porque a `seq`
é uma identity) → notas, consentimentos e marcações → `crm_de_para`. Um `insert ... select` por tabela e por
pedaço de 500 linhas, com `jsonb_to_recordset` e lista de colunas explícita (`inserir.ts`); nome de tabela e de
coluna só de constantes, valor só por parâmetro.

**Destino que já está nas tabelas novas (15-44, H-01).** O Canal e o Contato que as Conversas e os Negócios antigos
citam e que **já estão** em `plataforma.canais`/`plataforma.contatos` do Espaço (`crm-novo.ts` os lê, com o tipo do
Canal) valem como destino: a Conversa migra para `plataforma.conversas` com as Mensagens, apontando para o Canal
e o Contato existentes, que **não** são inseridos nem alterados (o id repetido continua no relatório como
`id-ja-existe`, mas não tira o id do destino). Antes disso a Conversa de Canal criado pela Fase 8 caía em
`conversa-sem-canal-migrado` e era apagada de `registros` sem migrar. Canal ou Contato que não existe em lugar nenhum
continua indo ao relatório (`conversa-sem-canal-migrado`, `conversa-sem-contato`).

**O banco não é surpreendido.** O que uma constraint da 007/008/011 recusaria é decidido no mapeador e o item vai
para o relatório, em vez de derrubar a transação do Espaço no `commit`:

| Regra do banco | O que o mapeador faz |
|---|---|
| `empresa_exige_admin` (no commit) | Empresa fora da lixeira sem vínculo `admin` vigente não migra (nem os Negócios dela). Na lixeira migra. |
| `contatos_mesclado_ck` + FK não adiável | Sobrevivente antes do absorvido; absorvido sem sobrevivente que migre entra `arquivado`. |
| `negocios_dono_ck` | Empresa se tem; senão o Contato principal (ou o primeiro que migrou); senão fica no relatório. Os demais Contatos do Negócio não têm onde morar. |
| FK composta Funil+Etapa | O Negócio só migra para um Funil/Etapa que passam a existir; o `etapa_id` vira o id novo lendo `funnels/stages`. Com `--funil=guardar` nenhum Negócio migra. |
| `conversas_lixeira_ck` + `conversas_na_lixeira_em_ck` | Na lixeira entra `resolvida`, `na_lixeira` e com `na_lixeira_em`. |
| `conversas_nao_resolvida_uq` | Duas abertas/pendentes no mesmo par Contato+Canal: a mais recente entra. Se o CRM novo já ocupa o par, a antiga fica de fora. |
| `canais_nome_uq`, `canais_conta_uq` | Só entre Canais ativos; o segundo vai para o relatório. O Canal entra `desconectada`, com o provedor padrão do tipo. |
| `contato_identificadores_unico` | O segundo Identificador igual (no CRM antigo ou já no novo) vai para o relatório. O valor segue a forma canônica do CRM novo (`+55…` no WhatsApp). |
| Mensagem sem `id` (`mensagens.id` é NOT NULL) | Vai para `mensagem-sem-id` (coleção `conversations` e o id da Conversa); as outras Mensagens dela migram. |
| Identificador de Contato ou de Empresa sem `id`, ou com `id` repetido no mesmo pai (PK de `crm_de_para`) | Migra; a chave de de-para ganha um sufixo (`<pai>/sem-id#<posição>`) para não colidir, e o primeiro trecho segue sendo o pai (o `--verificar` acha a origem por ele). |
| `mensagens_*` | Recebida sem id externo ganha `migrado:<id>` e o ator `integration` do Canal; enviada sempre tem `status_entrega`; interna não tem id externo; a resposta só aponta para Mensagem anterior da mesma Conversa; Mensagem sem texto nem anexo fica de fora. |

**O que vai para o relatório de não migrados** (`nao-migrados.ts`, só coleção e id, nunca nome, telefone,
e-mail ou texto): temperatura (D-15-06), Tags, foto, cópia pré-mesclagem, proveniência, Identificadores de
LinkedIn/TikTok/chat do site, consentimento de canal sem destino, Empresa mesclada/sem nome/sem admin, vínculos
Empresa-Empresa e "distinto de", marca de Empresa principal do Contato, anexos e comentários de Empresa e
Negócio, requisitos e transições de Etapa, código legível/campos/histórico de Etapas do Negócio, valor
inválido, Canal LinkedIn/chat do site (e as Conversas deles), modelos de Mensagem, rascunhos (D-15-11), Mensagem
de Flow (migra sem o Flow). Tudo isso continua em `registros_crm_antigo`. O `--seco` imprime a **mesma conta**
antes de escrever; o resumo do `--migrar` a repete depois.

**Qualificação e Origem do Contato** levam o **id do Catálogo** como texto (`contatos.qualificacao`,
`origem`): a tela mostra o rótulo quando o id existe no Catálogo (15-05). Os campos personalizados de
Contato e Empresa entram em `campos_adicionais` com o **id da Definição** como chave (a definição mora em
`registros`, não aqui); valor de lista fica de fora.

## Regras que não mudam

- **Nunca loga dado pessoal.** Relatório, resumo e erro têm só ids, contagens e nomes de configuração
  (Funil, Etapa, Lista, Pasta). Nome de pessoa, telefone, e-mail e texto de Mensagem nunca. Em erro
  inesperado a CLI imprime só `erro.message`.
- **Não importa tipos do modelo antigo de `@n1/dominio`.** `formatos-antigos.ts` descreve só os campos que o
  script lê, para ele continuar compilando depois que a 3.5.4 apagar `Contact`, `Deal` etc. A guarda
  `sem-crm-antigo.test.ts` da api barra o código que leia o CRM antigo pelo `state`.
- **Toda leitura das coleções antigas é por SQL** em `plataforma.registros`. As linhas antigas saem de
  `registros` só pelo SQL do `aoConfirmar`.
- **Um Espaço por execução.** `--espaco` é obrigatório, validado contra `^ws_[a-z0-9_]+$` e contra
  `plataforma.workspaces`. Toda consulta leva `workspace_id = $1`.
- **Nada sai de `registros` antes de estar copiado e conferido** (F14-D-03). Não existe script de desfazer
  (D-15-02): a rede é o backup manual do corte (`pg_dump -Fc --schema=plataforma`, restaurado e conferido em
  Docker) mais a cópia.
- **Valores só por `$n`**; nome de tabela e de coluna só de constantes (T-15-66).
- **Nunca rode contra um banco que não seja o que você quer escrever.** Os testes usam só Postgres de Docker
  (`describeComBanco`, host local). A trava "só local" (demo, testes de banco) olha o host que o `pg` USA, não só o
  da URL: `persistencia/host-local.ts` recusa qualquer URL com `?…` (`?host=` e `?hostaddr=` trocam o destino) e
  só aceita `localhost`, `127.0.0.1` e `[::1]` exatos (15-44, M-01). Em produção quem roda é o dono, no corte.

## Os arquivos

| Arquivo | O que faz |
|---|---|
| `colecoes.ts` | As nove coleções, `ehConversaDeGrupo`, `ehConversaDoCrmAntigo` e os mesmos critérios em SQL, `ErroDeUso`, `validarEspaco`. |
| `formatos-antigos.ts` | Interfaces estruturais mínimas do que o script lê (sem import do domínio). |
| `guardar.ts` | `copiarParaRegistrosCrmAntigo`, `conferirCopia`, `contarDoAlvo`, `apagarDoRegistros`, `contarGuardadas`. |
| `funil.ts` | `planejarFunis` (puro), `inserirFunis` (lock do padrão, `crm_de_para`) e as leituras por SQL. |
| `pasta-meus-negocios.ts` | `planejarPasta`, `chavesDaPasta`, `removerPasta` (puros). |
| `relatorio.ts` | `montarRelatorio` (o `--seco`) e `montarResumoDeEscrita`: texto puro, sem dado pessoal; inclui a seção "Linhas nas tabelas novas" e "Não migrados". |
| `mapeador.ts` | `planejarMigracao` (puro): linhas antigas → linhas das tabelas novas, de-para e não migrados. |
| `nao-migrados.ts` | As categorias do relatório (rótulo em português) e `agruparNaoMigrados`. |
| `inserir.ts` | `inserirPlano`: um `insert` em lote por tabela, na ordem das FKs. |
| `crm-novo.ts` | As leituras por SQL do mapeador: as linhas antigas e o que o CRM novo do Espaço já tem (inclusive os Canais e Contatos que as Conversas e Negócios citam). |
| `migrar-crm-antigo.ts` | `guardarCrmAntigo`, `migrarCrmAntigo`, `relatorioSeco`, `verificar`, `emTransacaoSoLeitura`. |
| `migrar.cli.ts` | A CLI: `lerArgumentos` (pura), `principal` (devolve o código de saída). |
| `fixtures/registros-antigos-minimos.json` | CRM antigo SINTÉTICO congelado (nove coleções, uma Conversa de Grupo, a Pasta e uma Tarefa espelho) para os testes. |
| `fixtures/crm-antigo-do-seed.json` | O `buildSeed()` sintético de antes da 3.5.3, congelado: as nove coleções (39 Contatos, 12 Empresas, 30 vínculos, 4 Funis, 19 Negócios, 5 Canais, 23 Conversas) e os 64 `links`. Gerado UMA vez por um script descartável (não está no repositório) a partir de `@n1/dominio/seed`, em 2026-11-06, sobre o commit `cfa70fe`. Nunca de dado de produção nem de `~/n1-ensaio`. |

Os testes de banco rodam só em Postgres de Docker; sem ele, `describeComBanco` pula. Um arquivo "skipped"
não prova nada.

## O que falta (fora deste script)

- **15-34 / 15-35 — o corte.** Rodar o `--seco` e o `--guardar`/`--migrar` no `ws_n1` e nos 17 Espaços de
  teste, em produção, pelo dono, atrás de backup. Este script só foi provado em Docker. O que o corte precisa
  fazer com o mapeador:
  - rodar o `--seco` do `ws_n1` **de novo imediatamente antes** do `--migrar` e conferir que é igual ao do passo 4 e que
    `conversa-sem-canal-migrado` e `conversa-sem-contato` não têm item (M-03; o roteiro `15-CORTE.md` tem o comando);
  - ler o "Não migrados" do `--seco` de cada Espaço **antes** de escrever, e decidir se o que ficou de fora
    (temperatura, Tags, Canal do chat do site e LinkedIn e as Conversas deles, Negócio de Empresa sem admin...)
    é aceitável: o `--migrar` não é desfazível (D-15-02);
  - rodar o `--migrar` Espaço por Espaço (a transação de cada um é independente) e o `--verificar` em seguida. Nunca duas
    execuções ao mesmo tempo no mesmo Espaço: a segunda espera a trava por ~10 s e, se a primeira não terminou, sai com 1
    ("Outra alteração entrou antes desta") sem escrever (M-05);
  - um `--verificar` que falha depois da publicação da API (passo 8) se investiga **linha a linha**, nunca se resolve com
    `--guardar` às cegas (H-02); e voltar o código da API depois do `--guardar`/`--migrar` exige restaurar o backup (M-02);
  - o `--seco` e o `--verificar` do roteiro comparam só as nove coleções: quando a Pasta "Meus negócios" sai,
    `registros_crm_antigo` também guarda `folders`, `lists` e `views` (L-01);
  - guardar a contagem de `registros_crm_antigo` do `--seco` e conferir com a do `--verificar`.
- Nenhuma referência em `registros` é reescrita: os ids de Contato, Empresa, Funil, Negócio, Canal, Conversa e
  Mensagem são preservados. Ficam apontando para um id que **não existe** mais (abrem "não encontrado") só os
  registros que não migraram (vão para o relatório) e qualquer referência a Etapa, Identificador ou vínculo
  antigo (ids novos). Conferido nos tipos de `@n1/dominio`: fora de `types/crm.ts`, nenhuma coleção guarda
  `stageId` nem id de Identificador ou de vínculo; a única referência, `Message.viaIdentifierId`, o mapeador troca
  pelo id novo.
- O script e esta pasta saem do repositório num plano de limpeza depois do corte aceito.
