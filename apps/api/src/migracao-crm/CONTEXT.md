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
| `… --espaco <id> --guardar` | Copia as nove coleções para `registros_crm_antigo`, confere e apaga de `registros` (D-15-01). Não cria linha no CRM novo. Serve aos 17 Espaços de teste e ao `ws_n1` se o dono decidir guardar o Funil. |
| `… --espaco ws_n1 --migrar --funil=migrar` | Faz o `--guardar` e leva o Funil e as Etapas para `plataforma.funis`/`etapas` (D-15-04). |
| `… --espaco ws_n1 --migrar --funil=guardar` | Faz o `--guardar` e deixa o Espaço **sem** Funil no CRM novo (D-15-13). |
| `… --espaco <id> --verificar` | Confere, sem escrever, a pós-condição; sai com 1 se algo não bate. |

Saída: `0` ok, `1` falha da verificação ou erro inesperado, `2` erro de uso (argumento, Espaço inexistente,
recusa antes de escrever). Antes de qualquer escrita o script imprime o host do banco (sem usuário nem
senha) e o Espaço.

## O que cada modo faz

**`--guardar`** roda numa única `executar()` do Espaço (a trava padrão): trava a linha do Espaço, sobe a
`revisao`, e desfaz tudo em qualquer falha. Dentro dela, nesta ordem (F14-D-03):

1. `lerDoCrm` copia as nove coleções para `registros_crm_antigo` (`dados` e `ordem` como estão,
   `on conflict do nothing`) e **confere**: toda linha a apagar tem uma cópia idêntica, e toda linha copiada
   tem cópia com a mesma chave. Uma divergência lança e a transação inteira volta.
2. A `operacao` (pura) tira só a Pasta "Meus negócios" do estado, se for o caso (abaixo). Ela **não** toca
   nas nove coleções antigas.
3. `aoConfirmar` apaga de `registros` por SQL: as oito coleções inteiras e as Conversas sem Grupo.

**Conversa de Grupo.** Grupo e Flow ficam no modelo antigo até as Sessões 6 e 7 (F14-D-05). As Conversas
com `groupIdentifier` são **copiadas** mas **continuam** em `registros`; o resultado diz quantas ficaram.

**Pasta "Meus negócios" (D-15-14).** Achada pelo id do seed (`fld_meus_negocios`), nunca pelo nome. Se
**todas** as Listas dela estão vazias (nenhuma Tarefa, em qualquer estado), a Pasta, as Listas e as
Visualizações delas são copiadas e removidas (o Conjunto de Status vive dentro da Lista e sai junto). Se
**alguma** tem Tarefa, nada da Pasta sai e o resultado lista as Listas e as contagens, para o dono decidir.
O script não toca em Tarefa. Referências de fora (uma Automação com escopo numa dessas Listas, por exemplo)
não são reescritas.

**`--migrar`** é o `--guardar` mais o Funil. Recusa, **antes de escrever qualquer coisa**:

- o Espaço com Contatos, Empresas, Vínculos, Negócios, Canais ou Conversas comuns: "Este Espaço tem
  registros do CRM antigo além do Funil; use --guardar." O mapeador dessas entidades é o plano 15-28;
- o Espaço com Funil antigo e sem `--funil`.

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

**`--verificar`** confere em `begin read only`: (a) nenhuma linha das oito coleções sem Grupo em `registros`;
(b) em `conversations` de `registros`, só Conversas de Grupo; (c) nenhuma linha órfã em `crm_de_para` (a
Etapa se confere pelo Funil); (d) imprime a contagem por coleção de `registros_crm_antigo`. A contagem de
(d) é a base de comparação com o `--seco` de antes da escrita: o roteiro do ensaio (15-30) e do corte
(15-34/15-35) guarda as duas e confere que são iguais.

**Repetir não muda nada.** Rodar `--guardar` ou `--migrar` de novo no mesmo Espaço não copia, não apaga e
não insere: o resultado diz "nada a fazer" e nem a revisão do Espaço sobe.

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
  (`describeComBanco`, host local). Em produção quem roda é o dono, no corte.

## Os arquivos

| Arquivo | O que faz |
|---|---|
| `colecoes.ts` | As nove coleções, `ehConversaDeGrupo` e o mesmo critério em SQL, `ErroDeUso`, `validarEspaco`. |
| `formatos-antigos.ts` | Interfaces estruturais mínimas do que o script lê (sem import do domínio). |
| `guardar.ts` | `copiarParaRegistrosCrmAntigo`, `conferirCopia`, `contarDoAlvo`, `apagarDoRegistros`, `contarGuardadas`. |
| `funil.ts` | `planejarFunis` (puro), `inserirFunis` (lock do padrão, `crm_de_para`) e as leituras por SQL. |
| `pasta-meus-negocios.ts` | `planejarPasta`, `chavesDaPasta`, `removerPasta` (puros). |
| `relatorio.ts` | `montarRelatorio` (o `--seco`) e `montarResumoDeEscrita`: texto puro, sem dado pessoal. |
| `migrar-crm-antigo.ts` | `guardarCrmAntigo`, `migrarCrmAntigo`, `relatorioSeco`, `verificar`, `emTransacaoSoLeitura`. |
| `migrar.cli.ts` | A CLI: `lerArgumentos` (pura), `principal` (devolve o código de saída). |
| `fixtures/registros-antigos-minimos.json` | CRM antigo SINTÉTICO congelado (nove coleções, uma Conversa de Grupo, a Pasta e uma Tarefa espelho) para os testes. |

Os testes de banco rodam só em Postgres de Docker; sem ele, `describeComBanco` pula. Um arquivo "skipped"
não prova nada.

## O que falta (fora deste script)

- **15-28 — o mapeador de entidades.** Contato, Empresa, Vínculos, Negócio, Canal, Conversa e Mensagem para
  as tabelas novas. Quando chegar, tira a recusa "além do Funil" do `--migrar`. Para isso as linhas antigas
  estão em `registros_crm_antigo` com os **ids originais**: o 15-28 preserva o id antigo como id novo
  (assim Vínculos, `provenance`, escopos e concessões em `registros` não precisam ser reescritos), troca a
  Etapa do Negócio pela linha de `crm_de_para` (`funnels/stages`) e grava o id do Catálogo na qualificação
  do Contato (15-05).
- **15-34 / 15-35 — o corte.** Rodar o `--seco` e o `--guardar`/`--migrar` no `ws_n1` e nos 17 Espaços de
  teste, em produção, pelo dono, atrás de backup. Este plano só provou o código em Docker.
- Nenhuma referência a id antigo em `registros` é reescrita por este script. Enquanto o 15-28 não preserva
  ids, links e Vínculos a Negócio, Contato ou Canal antigo abrem "não encontrado" (WINDOWS #22, #32, #42 e a
  linha do 15-40).
