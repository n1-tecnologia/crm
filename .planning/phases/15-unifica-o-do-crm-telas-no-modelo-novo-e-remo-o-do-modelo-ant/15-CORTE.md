# Fase 15 — Roteiro do corte em produção (D-15-03)

> **O corte é só do dono (plano 15-35). Nada deste roteiro foi executado contra produção.** Este arquivo foi escrito pelo plano 15-34 a partir de `15-CONTEXT.md` (D-15-01 a D-15-14), de `apps/api/src/migracao-crm/CONTEXT.md`, de `apps/api/deploy/publicar.sh`, de `14-PROVAS.md` e dos ensaios em Docker (`15-ENSAIO.md`). A licença que o dono deu em 2026-11-06 ("pode fazer o que precisar para fechar a fase") **não cobre** este corte: nenhum agente roda estes passos por ele.
>
> Onde o repositório não tem o comando literal, o passo traz **A CONFIRMAR PELO DONO** em vez de um comando inventado.

## Leia antes de começar

1. **O que o corte faz.** Tira o CRM antigo (Contato, Empresa, Negócio, Funil, Canal, Conversa 1:1 do CRM antigo e os Vínculos) de `plataforma.registros`, guarda uma cópia em `plataforma.registros_crm_antigo`, leva ao CRM novo o que o `ws_n1` precisa, aplica a migração `012` (só cria a tabela vazia `plataforma.crm_atividades`) e sobe a API e a web desta versão.
2. **Não existe script de desfazer (D-15-02).** Voltar é restaurar o backup do passo 2 e perder tudo o que foi criado depois dele no CRM novo. A cópia em `registros_crm_antigo` guarda as linhas antigas, mas nada as devolve a `registros` sozinho.
3. **Ordem importa: o script de dados roda ANTES de a API nova subir.** Quem publica deve rodar o `--guardar`/`--migrar` antes do `publicar.sh`: uma linha antiga que sobra em `plataforma.registros` volta como chave desconhecida em `GET /estado` até ser apagada (`apps/api/src/persistencia/hidratar-crm-antigo.test.ts` documenta). Por isso os passos 6 e 7 vêm antes do 8.
4. **Parar se o passo falhar.** Cada passo diz o que conferir. Se a conferência não bate, pare, anote e não siga para o próximo (T-15-84). Cada execução do script é uma transação por Espaço: uma falha deixa o Espaço como estava, e repetir é seguro (a repetição diz "nada a fazer").
5. **Onde rodar.** Da raiz de um checkout deste repositório **no commit que vai subir** (os comandos `migrar:crm-antigo` só existem nele), com `npm ci` feito. Os comandos `npm run … -w @n1/api` leem o `apps/api/.env`, que aponta para produção. **Antes de qualquer escrita o script imprime a linha `Banco: <host> · Espaço: … · Modo: …` (sem usuário nem senha): leia o host e confirme que é o de produção que você quer escrever.** (**A CONFIRMAR PELO DONO:** que o `DATABASE_URL` do `.env` é o papel de runtime e o `DATABASE_URL_MIGRACAO` é o dono do banco; no ensaio o script rodou com os dois.)
6. **Anote hora e resultado de cada passo** nas linhas "Hora" e "Resultado" ao fim de cada um.
7. **Janela (D-15-03).** Não há modo manutenção. Quem abrir o CRM entre o passo 6 e o fim do passo 9 vê erro ou a Caixa vazia por alguns minutos (a API antiga ainda está no ar, mas o CRM antigo já saiu de `registros`; a web antiga ainda não foi trocada). Um navegador que já estava aberto no app antigo pode gravar CRM antigo em `registros` nesse intervalo (entre os passos 6 e 8): por isso o `--verificar` do passo 10. **Se ele falhar, não resolva com `--guardar` às cegas:** leia o passo 10, que manda investigar linha a linha.
8. **O que NÃO sai de `registros` (revisão 15-44, H-02).** Ficam, copiadas para `registros_crm_antigo` mas nunca apagadas nem migradas, (a) a Conversa de Grupo e (b) a Conversa 1:1 que o Flow, a Automação e o convite de Grupo abrem com um Contato de `plataforma.contatos` (o `contactId` dela **não** é um id da coleção `contacts` antiga do mesmo Espaço) e qualquer Conversa que não dá para classificar (`contactId` ausente). Só é "do CRM antigo" a Conversa sem Grupo cujo `contactId` **é** um id de `contacts` do mesmo Espaço. O `--seco` e o resumo de `--guardar`/`--migrar` dizem quantas ficaram e por quê; o `--verificar` não reclama delas. Na cópia de 2026-11-05 são só as 14 Conversas de Grupo (nenhuma 1:1 de Flow). Limitação conhecida: um Contato cujo id existe nas duas coleções antes do corte é tratado como antigo.

### Os Espaços

São 18 nomes além do `ws_n1`, todos de teste: os 17 que a Fase 14 mediu (`14-ENSAIO.md`) mais `ws_agendaworker_1790352062935_2haflp`, que apareceu depois e não tem nenhuma linha em `registros` (o `--guardar` nele responde "nada a fazer"). Confira a lista do dia, só leitura, antes de começar:

```bash
psql "<URL do banco de produção>" -At -c "set default_transaction_read_only = on; select workspace_id from plataforma.workspaces order by 1"
```

(**A CONFIRMAR PELO DONO:** a URL de conexão direta que você usa para o `psql` e o `pg_dump`; ela não está registrada literalmente no repositório.) Se aparecer um Espaço que não está nas listas abaixo, **pare**: ele não foi ensaiado.

```bash
# os 17 Espaços de teste da Fase 14
TESTES_17="ws_debug_automations ws_outbox_1790002249349_te7t5z ws_outbox_1790002291927_omse5x ws_outbox_1790003023016_1piqto ws_outbox_1790003053712_n8hwvy ws_outbox_1790003082199_8p285y ws_outbox_1790003204554_88m39n ws_outbox_1790003250872_a25rdn ws_outbox_1790003328681_yo1893 ws_outbox_1790206152726_hx6qku ws_spike_10x ws_spike ws_teste_classificacoes_1790201209011_rkgmin ws_teste_classificacoes_1790353187334_ws3at4 ws_teste_classificacoes_1792754637371_e6mf4d ws_teste_importar_sol_1790373466622_3ery4e_ref ws_teste_integracao_solicitacoes_1790129575792_jyorfo"
# o 18º, vazio, que a cópia de 2026-11-05 já trazia
VAZIO="ws_agendaworker_1790352062935_2haflp"
```

### Decisões que você toma uma vez, antes de escrever (passo 5)

| Decisão | O que o ensaio mostrou | Referência |
|---|---|---|
| **Funil do `ws_n1`:** `--funil=migrar` ou `--funil=guardar` | O CRM antigo do `ws_n1` na cópia é só o Funil "Padrão" do bootstrap (1 Etapa, nenhum Negócio). `--funil=guardar` não muda nada no CRM novo (continuam 2 Funis, 6 Etapas). `--funil=migrar` acrescenta um Funil vazio ao lado dos 2 que ele já tem (3 Funis, 7 Etapas, 2 linhas em `crm_de_para`). A decisão vale **antes da primeira escrita**: depois de um `--guardar` o Funil só volta recriado pela tela de Funis. | D-15-04, `15-ENSAIO.md` |
| **A Pasta "Meus negócios" nos 17 Espaços de teste (D-15-14)** — uma regra só, para os 17 | Se todas as Listas dela estão vazias, a Pasta e as Listas saem para `registros_crm_antigo`. Se **alguma** tem Tarefa espelho, **nada da Pasta sai**: ela fica como está, e o `--seco` do Espaço lista as Listas e as contagens. Na cópia, 16 dos 17 Espaços de teste têm a Pasta com 18 Tarefas em 4 Listas, então nada sai deles. **Nenhuma Pasta, Lista ou Tarefa desses Espaços é apagada à mão no corte.** A Pasta que ficar já é uma Pasta comum (o 15-41 tirou a proteção A9): quem quiser apagá-la depois faz pela tela. | D-15-14, 15-41 |
| **Aceitar a lista de "Não migrados" de cada Espaço** | O `--migrar` não se desfaz. No `ws_n1` da cópia: nenhum item. Nos Espaços de teste só se usa `--guardar`, que não leva nada ao CRM novo. | 3.5.2 |

---

## Passo 1 — Avisar a equipe e combinar o horário

- Avise quem usa o CRM: haverá alguns minutos de erro ou de Caixa vazia (item 7 acima). Combine hora de início e quem fica de fora.
- Tenha à mão: a chave de deploy `n1_crm_deploy_ci` (`ssh-add -l` deve listá-la; se não, `ssh-add ~/.ssh/n1_crm_deploy_ci` e a senha), o commit que vai subir (`git rev-parse HEAD`), um Docker funcionando e espaço em disco.
- (Opcional, recomendado) Renove a cópia em `~/n1-ensaio` e repita o ensaio de `15-ENSAIO.md` ("Como repetir com a cópia renovada"): a cópia que o ensaio usou é de 2026-11-05 e é anterior a tudo o que você fez em produção depois disso.

Conferir: horário combinado e equipe avisada.
Hora: ______  Resultado: ______

## Passo 2 — Backup, restaurado e conferido em Docker (D-15-02)

```bash
mkdir -p ~/n1-corte
pg_dump -Fc --schema=plataforma --no-owner --no-acl -f ~/n1-corte/backup-plataforma-pre-15-$(date +%Y%m%d-%H%M).dump "<URL do banco de produção>"
```

(**A CONFIRMAR PELO DONO:** como a URL de produção chega ao `pg_dump` sem ser impressa; use o `pg_dump` de versão igual ou maior que a do servidor, 17.6.)

Restaure num Postgres descartável e confira (o backup só vale se restaurar):

```bash
docker run -d --rm --name crm-n1-pg-backup -e POSTGRES_PASSWORD=x -p 127.0.0.1:55790:5432 postgres:16
until pg_isready -h localhost -p 55790; do sleep 1; done
PGPASSWORD=x pg_restore --no-owner --no-privileges -h localhost -p 55790 -U postgres -d postgres ~/n1-corte/backup-plataforma-pre-15-<AAAAMMDD-HHMM>.dump
PGPASSWORD=x psql -h localhost -p 55790 -U postgres -d postgres -At -c "select (select count(*) from plataforma.registros) as registros, (select count(*) from plataforma.workspaces) as espacos, (select count(*) from plataforma.migracoes) as migracoes"
docker rm -f crm-n1-pg-backup
```

Conferir: o `pg_restore` pode acusar um único erro ignorável (`unrecognized configuration parameter "transaction_timeout"`, porque o dump vem de um `pg_dump` mais novo que o contêiner); todo o resto tem de vir. As três contagens têm de ser iguais às de produção, lidas em sessão só de leitura (`set default_transaction_read_only = on; select count(*) from plataforma.registros;` e as outras duas). Em produção devem ser 11 migrações aplicadas (001 a 011). **O backup contém dado pessoal: guarde fora do repositório.**

Se não bate: pare. Refaça o backup antes de continuar.
Hora: ______  Resultado: ______

## Passo 3 — O que a migração faria (só leitura)

```bash
npm run migrar -w @n1/api -- --seco
```

Esperado: as migrações 001 a 011 como `aplicada` e **só a `012-atividade-do-crm.sql` como `pendente`** ("1 pendente(s); nada foi aplicado (--seco)."). Se aparecer outra pendente, pare: o banco não está onde o ensaio supôs.
Hora: ______  Resultado: ______

## Passo 4 — Relatório a seco, por Espaço (só leitura), guardando a contagem

O `--seco` abre uma sessão `begin read only`: o Postgres recusa qualquer escrita. Salve a saída de cada Espaço: a contagem por coleção dela é a base de comparação do `--verificar` do passo 7.

```bash
mkdir -p ~/n1-corte/seco
for ws in ws_n1 $TESTES_17 $VAZIO; do
  echo "== $ws"
  npm run --silent migrar:crm-antigo -w @n1/api -- --espaco "$ws" --seco | tee ~/n1-corte/seco/$ws.txt
done
```

Conferir em cada um:
- a linha `Banco:` é a de produção;
- `ws_n1`: o Funil e as Etapas do CRM antigo, o que aponta para ele, a linha `Pasta "Meus negócios"` e a seção "Não migrados" (no ensaio: 1 Funil "Padrão" com 1 Etapa, nenhum Negócio, sem Pasta, "Não migrados: nenhum item");
- Espaços de teste: a linha `Pasta "Meus negócios"` (na cópia, "há Tarefa em 4 Lista(s). Nada da Pasta sai") e a contagem de cada coleção (na cópia, 39 Contatos, 12 Empresas, 30 vínculos Contato-Empresa, 4 Funis, 19 Negócios, 5 Canais e 21 a 23 Conversas, em cada um dos que têm a semente de demonstração).

Total esperado na cópia de 2026-11-05 (referência, não exigência: o banco de hoje pode ter mudado): **2128 linhas** nas nove coleções, 19 Espaços. Se o total do dia for diferente, entenda por quê antes do passo 5.
Hora: ______  Resultado: ______

## Passo 5 — Você aprova o relatório (até aqui nada foi escrito em produção)

Marque cada item. Sem os quatro, não passe ao passo 6.

- [ ] O Funil do `ws_n1` foi lido no passo 4 e a escolha está feita: `--funil=migrar` ou `--funil=guardar` (tabela acima).
- [ ] A lista de "Não migrados" do `ws_n1` foi lida e é aceitável. (Se houver Contato, Empresa, Negócio, Canal ou Conversa no CRM antigo do `ws_n1` hoje — a cópia dizia que não — leia categoria por categoria: o `--migrar` não se desfaz.)
- [ ] A regra da Pasta "Meus negócios" nos 17 Espaços de teste (D-15-14) está confirmada uma vez: o que está vazio sai, o que tem Tarefa fica como está, nada é apagado à mão.
- [ ] As decisões que `15-PROVAS.md` lista como pendentes foram lidas (nenhuma trava o corte; cada uma pode virar trabalho depois).

Hora da aprovação: ______  Escolha do Funil do `ws_n1`: ______

## Passo 6 — Escrever (a partir daqui há escrita em produção)

### 6a. Aplicar a `012` e as concessões

```bash
npm run migrar -w @n1/api
npm run banco:conceder -w @n1/api
```

A `012` é aditiva: só cria `plataforma.crm_atividades`, vazia, com dois índices. `banco:conceder` dá ao papel `n1_api` o que as tabelas da 011 e da 012 pedem (idempotente). Conferir: `aplicada  012-atividade-do-crm.sql` e "n1_api: concessões aplicadas". Se o `migrar` falhar, nada fica aplicado pela metade (cada arquivo é uma transação): pare.
Hora: ______  Resultado: ______

### 6b. Guardar o CRM antigo dos Espaços de teste (D-15-01)

```bash
for ws in $TESTES_17 $VAZIO; do
  echo "== $ws"
  npm run --silent migrar:crm-antigo -w @n1/api -- --espaco "$ws" --guardar | tee ~/n1-corte/guardar-$ws.txt
done
```

Cada Espaço: copia as nove coleções para `registros_crm_antigo`, confere por conteúdo e só então as apaga de `registros` (as 2 Conversas de Grupo, quando há, **ficam**: F14-D-05). A Pasta "Meus negócios" segue a regra do passo 5. Saída esperada por Espaço: "guardado. 134 linha(s) copiadas…" (ou "nada a fazer" no vazio). O resumo traz duas linhas de Conversas que continuam em `registros`: as de Grupo (2 nos 7 Espaços que as têm) e as "1:1 de Flow, Automação ou convite de Grupo" (0 na cópia; um número maior que 0 num Espaço de teste é dado vivo do Flow, não erro). Se um Espaço falha, ele ficou como estava: leia a mensagem e decida; não passe ao `ws_n1` com a causa desconhecida.
Hora: ______  Resultado: ______

### 6c. O `ws_n1` — use a linha da sua escolha no passo 5

**Antes de escrever, rode o `--seco` do `ws_n1` de novo, imediatamente antes (M-03).** O relatório que você aprovou no passo 4 é de minutos ou horas atrás, o app antigo continua no ar e o `--migrar` não se desfaz: ele replaneja na hora e só mostra o "Não migrados" real depois de confirmar. Compare com o do passo 4 e **pare** se mudou ou se alguma destas duas categorias tiver item (leia o item antes de seguir): "Conversa de um Canal que não migrou" (`conversa-sem-canal-migrado`) e "Conversa sem Contato" (`conversa-sem-contato`).

```bash
mkdir -p ~/n1-corte/seco-6c
npm run --silent migrar:crm-antigo -w @n1/api -- --espaco ws_n1 --seco | tee ~/n1-corte/seco-6c/ws_n1.txt
diff ~/n1-corte/seco/ws_n1.txt ~/n1-corte/seco-6c/ws_n1.txt && echo "ws_n1: igual ao passo 4" || echo "ws_n1: DIFERENTE do passo 4 (leia o diff antes de escrever)"
grep -E 'Conversa de um Canal que não migrou|Conversa sem Contato' ~/n1-corte/seco-6c/ws_n1.txt || echo "nenhuma das duas categorias tem item"
```

Só então escolha a linha:

```bash
# escolha A: levar o Funil Padrão do CRM antigo ao CRM novo
npm run migrar:crm-antigo -w @n1/api -- --espaco ws_n1 --migrar --funil=migrar | tee ~/n1-corte/migrar-ws_n1.txt
# escolha B: só guardar o Funil na cópia (o CRM novo fica como está)
npm run migrar:crm-antigo -w @n1/api -- --espaco ws_n1 --migrar --funil=guardar | tee ~/n1-corte/migrar-ws_n1.txt
```

(A Conversa antiga cujo Canal ou Contato **já está** em `plataforma.canais`/`plataforma.contatos` migra para `plataforma.conversas` com as Mensagens, sem mexer no Canal nem no Contato (15-44, H-01); as duas categorias acima só aparecem quando o Canal ou o Contato não existe em lugar nenhum.)

Rode **uma** das duas. Esperado no ensaio: A → "Funil: 1 migrado (1 Etapa)", Funis 2 → 3, Etapas 6 → 7, 2 linhas em `crm_de_para`; B → nada novo no CRM novo. O resumo repete a lista de "Não migrados".
Hora: ______  Resultado: ______

## Passo 7 — `--verificar` em todos, comparando com o passo 4

```bash
mkdir -p ~/n1-corte/verificar
for ws in ws_n1 $TESTES_17 $VAZIO; do
  npm run --silent migrar:crm-antigo -w @n1/api -- --espaco "$ws" --verificar > ~/n1-corte/verificar/$ws.txt; echo "$ws --verificar saiu com $?"
done
```

Esperado: `ok` e saída 0 em todos. Agora compare a contagem por coleção de `registros_crm_antigo` (a do `--verificar`) com a do `--seco` do passo 4; têm de ser iguais, Espaço a Espaço:

```bash
for ws in ws_n1 $TESTES_17 $VAZIO; do
  diff <(grep -E '^  (contacts|companies|contactCompanyLinks|companyCompanyLinks|distinctFromLinks|funnels|deals|channels|conversations) ' ~/n1-corte/seco/$ws.txt | awk '$2 != 0 {print $1, $2}' | sort) \
       <(sed -n '/^registros_crm_antigo guarda:/,$p' ~/n1-corte/verificar/$ws.txt | grep -E '^  (contacts|companies|contactCompanyLinks|companyCompanyLinks|distinctFromLinks|funnels|deals|channels|conversations) [0-9]+$' | awk '{print $1, $2}' | sort) >/dev/null && echo "$ws igual" || echo "$ws DIFERENTE"
done
```

(O `--seco` lista as nove coleções, inclusive as de contagem 0; o `--verificar` só lista as que têm linha guardada — por isso o `awk` descarta os zeros do lado do `--seco`. **Os dois lados filtram as mesmas nove coleções (L-01):** `registros_crm_antigo` também guarda `folders`, `lists` e `views` quando a Pasta "Meus negócios" sai (D-15-14), e o `--verificar` as imprime; o `--seco` não as conta, então sem o filtro dos dois lados a Pasta que saiu faria o Espaço parecer "DIFERENTE" sem ser. Nos Espaços em que a Pasta **sai**, a lista de `--verificar` tem essas linhas a mais, e isso é esperado: elas só aparecem fora da comparação. Na cópia de 2026-11-05 nenhuma Pasta saiu.) Esperado: nenhum "DIFERENTE". Se algum Espaço sair diferente ou o `--verificar` sair com 1, **pare**: não publique. Rode `--seco` do Espaço para ver o que sobrou em `registros` e leia o `--verificar` linha a linha (coleção e contagem); se não se explicar, decida entre seguir e restaurar o backup do passo 2. (Antes do passo 8, `--guardar` de novo no Espaço é seguro e é o que a repetição prevê; depois do passo 8, siga o passo 10.)
Hora: ______  Resultado: ______

## Passo 8 — Publicar a API na VM (`publicar.sh`)

O `deploy-api` do GitHub falha (o `VPS_HOST` está vazio); a publicação é à mão. Só o que está commitado vai (`git archive`); passe o SHA do commit que também vai para a web.

```bash
ssh-add -l   # a chave n1_crm_deploy_ci tem de aparecer; se não, rode ssh-add ~/.ssh/n1_crm_deploy_ci
git rev-parse HEAD
VPS_HOST=85.155.186.214 VPS_USER=n1crm SSH_KEY=~/.ssh/n1_crm_deploy_ci apps/api/deploy/publicar.sh <sha-do-commit>
```

(Os valores de `VPS_HOST`, `VPS_USER` e `SSH_KEY` são os do cabeçalho de `apps/api/deploy/publicar.sh`.) Na VM, `instalar-release.sh` extrai o pacote, faz `npm ci`, roda `migrar` (já não há nada a aplicar depois do passo 6) e `banco:conceder`, troca o link `current`, reinicia o serviço e espera `/saude`; se `/saude` não responder em 40 s, ele volta o link para a versão anterior (a migração não volta).

Conferir: o fim da saída diz que a versão nova está no ar; `curl -s https://crm-n1-api.85.155.186.214.nip.io/saude` responde. Anote o SHA que estava no ar antes (`no ar:` na primeira linha da saída; no `CONTEXT.md` da raiz consta `49f1b54`) — é o SHA para voltar.
Se falhar: não suba a web. **Voltar o código da API depois do passo 6 não basta (M-02):** os passos 6b e 6c já tiraram o CRM antigo de `registros`, então a API anterior (`49f1b54`) volta, lê o CRM antigo de `registros` e o encontra vazio; e o que a tela antiga gravar a partir daí cai em `registros` e é "guardado" (apagado) na próxima execução do script. Escolha uma das duas e anote qual: **(1)** voltar a API com `FORCAR=1` e o SHA anterior (`FORCAR=1 VPS_HOST=… VPS_USER=n1crm SSH_KEY=… apps/api/deploy/publicar.sh <sha-anterior>`) **e** restaurar o backup do passo 2 (perde o que foi criado no CRM novo depois dele; **A CONFIRMAR PELO DONO:** o comando de restauração em produção, ver a última linha da tabela "Se um passo falhar"); ou **(2)** voltar só o código, aceitando explicitamente que a versão antiga mostra o CRM vazio até a correção. O `publicar.sh` não tem modo a seco: o que dá para conferir **antes do passo 6**, sem publicar nada, é a mesma leitura que ele faz primeiro, `ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -i ~/.ssh/n1_crm_deploy_ci -o IdentitiesOnly=yes n1crm@85.155.186.214 "cat /opt/n1-crm/current/REVISION"` (chave carregada, host alcançável e o SHA que está no ar); se ela falhar, a publicação do passo 8 também falharia.
Hora: ______  SHA publicado: ______  Resultado: ______

## Passo 9 — Subir a web (push para `main` do `n1-tecnologia/crm`)

A Vercel publica a web sozinha no push para a `main` do `n1-tecnologia/crm` (remoto `n1` deste repositório).

```bash
git fetch n1
git log --oneline n1/main..<sha-do-commit>      # confira o que vai subir (tudo desde a main do n1)
git push n1 <sha-do-commit>:main
```

(**A CONFIRMAR PELO DONO:** se o push é direto na `main` (como na Fase 14) ou por PR, e se o `<sha-do-commit>` é fast-forward da `main` do `n1` — `git fetch n1` e o `git log` acima mostram isso. O ramo atual traz também trabalho de fases anteriores que ainda não está na `main` do `n1`: leia o `git log` antes.)

Conferir: o deploy da Vercel termina verde e a página abre.
Hora: ______  Resultado: ______

## Passo 10 — `--verificar` de novo e conferir as telas

```bash
npm run migrar:crm-antigo -w @n1/api -- --espaco ws_n1 --verificar
for ws in $TESTES_17 $VAZIO; do npm run --silent migrar:crm-antigo -w @n1/api -- --espaco "$ws" --verificar; echo "$ws saiu com $?"; done
```

Esperado: `ok` e saída 0 em todos (era o risco da janela: um navegador antigo gravando CRM antigo entre os passos 6 e 8). A Conversa 1:1 que o Flow ou a Automação abriu depois do passo 8 **não** faz o `--verificar` falhar (ela fica em `registros` de propósito, ver "Leia antes", item 8).

**Se algum falhar, não rode `--guardar` nem `--migrar` às cegas (H-02).** Leia as linhas do `--verificar`: cada uma diz a coleção e a contagem (`contacts: N linha(s) ainda em registros`, `conversations: N Conversa(s) do CRM antigo ainda em registros`, `crm_de_para …: N linha(s) órfã(s)`). Investigue linha a linha, só leitura, sem imprimir dado pessoal (só ids e contagens):

```bash
psql "<URL do banco de produção>" -At -c "set default_transaction_read_only = on; select colecao, count(*) from plataforma.registros where workspace_id = '<Espaço>' and colecao in ('contacts','companies','contactCompanyLinks','companyCompanyLinks','distinctFromLinks','funnels','deals','channels','conversations') group by 1 order by 1"
```

(**A CONFIRMAR PELO DONO:** a URL de leitura, como no passo 2.) Só depois de entender de onde veio cada linha decida: se for CRM antigo que um navegador antigo gravou na janela, repetir o `--guardar` (para o `ws_n1`, a mesma linha de `--migrar --funil=…` que você escolheu) o copia e o tira de `registros`, sem migrar nada no `--guardar`; se for outra coisa, **não** repita: restaure ou peça ajuda. Em seguida, `--verificar` outra vez.

Depois, no app em produção, como `ws_n1`: a lista de provas manuais de `15-PROVAS.md` ("Provas manuais pendentes") diz o que olhar — Caixa de Entrada, ficha de Contato (mesclar, notas, consentimentos), Funis e Negócios, Busca, Início, o diálogo de remover Membro. Uma Caixa vazia no `ws_n1` é o esperado (o CRM antigo dele era só o Funil).
Hora: ______  Resultado: ______

---

## Se um passo falhar

| Onde | O que acontece | O que fazer |
|---|---|---|
| Passos 1 a 5 | Nada foi escrito em produção. | Corrigir e recomeçar quando quiser. |
| `migrar` (6a) | Uma transação por arquivo: nada fica pela metade. | Ler a mensagem; repetir depois de entender. |
| Script num Espaço (6b, 6c) | Uma transação por Espaço (trava a linha do Espaço e sobe a revisão): falhou, ficou como estava. | Ler a mensagem; repetir é seguro ("nada a fazer" se já foi). **Não rode duas execuções no mesmo Espaço ao mesmo tempo (M-05):** a segunda espera a trava da linha do Espaço por cerca de 10 s; se a primeira não terminou nesse prazo, a segunda **sai com 1** e diz "Outra alteração entrou antes desta. Tente de novo.", sem escrever nada. Repita depois que a primeira terminar; um `--verificar` que falha logo depois dessa tentativa não é problema de dado — espere a primeira terminar e rode o `--verificar` de novo. |
| `--verificar` diferente (7, 10) | A cópia ou o apagar não fecha. | Passo 7: não publique; `--seco` do Espaço mostra o que sobrou e o `--verificar` diz a coleção. Passo 10: investigue linha a linha (passo 10) e **nunca** repita `--guardar` às cegas. |
| `publicar.sh` (8) | A VM volta o link se `/saude` não responder. | Não suba a web. Voltar o código depois do passo 6 exige restaurar o backup do passo 2 ou aceitar o CRM vazio na versão antiga (passo 8, M-02). |
| Qualquer coisa inexplicável depois de escrever | Não há script de desfazer. | Restaurar o backup do passo 2 e a API anterior. **A CONFIRMAR PELO DONO:** o comando de restauração em produção (o repositório só documenta a restauração num Postgres descartável em Docker, como no passo 2 e em `apps/api/deploy/restaurar-backup.sh`, que não escreve em banco remoto). Perde-se o que foi criado no CRM novo depois do backup. |

## Depois do corte

- Marque 3.5.2 como feita em `docs/09-planejamento/dados/andamento.mjs` (a linha sugerida está em `15-PROVAS.md`) e feche as linhas do `.planning/WINDOWS.md` que dependem do corte (#51, #53 a #55, #59, #60).
- O script e `apps/api/src/migracao-crm/` saem do repositório num plano de limpeza depois do corte aceito (o `CONTEXT.md` da pasta diz o mesmo).
- O backup do passo 2 e `registros_crm_antigo` são a única memória do CRM antigo: não apague o backup antes de decidir o que fazer com a cópia.
