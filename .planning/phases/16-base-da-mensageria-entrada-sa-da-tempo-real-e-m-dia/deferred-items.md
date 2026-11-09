# Itens adiados da Fase 16

## Achados no plano 16-04 (fora do escopo dele)

- **RESOLVIDO pelo orquestrador no gate da onda 4 (commit `5f2fdea`):** a rota deixou de importar `servicos/cofre`
  (`canalParaProvedor` aceita `chaves` opcional e lê a chave mestra em `mensageria/registro.ts`). Junto, o
  `migracao-012.test.ts` (c) deixou de assumir a 012 como última migração (a 013 do 16-03 o quebrava).
- `apps/api/src/servicos/cofre.test.ts` > "nenhum arquivo de rotas/ importa servicos/cofre" falhava: `apps/api/src/rotas/webhooks-de-mensageria.ts`
  (plano 16-03) importa `servicos/cofre` para ler o segredo do Canal. O 16-04 não toca nesses arquivos. Quem fecha: o plano
  que revisitar a rota (ou ajustar o teste para aceitar a rota publica de mensageria, que le o segredo do webhook e nao o devolve).
- `outbox-worker.test.ts` casos (h) a (k) falham quando o arquivo roda junto de `outbox.test.ts` no mesmo `vitest run`
  (baseline conhecido: a fila e a tabela inteira); isolado, os 17 passam.

## Achados no plano 16-10 (fora do escopo dele)

- **A coleta de `entrada/` só enxerga os primeiros 500 objetos de cada pasta de Canal.** A porta `listar(prefixo, { limite })` (16-09,
  `servicos/armazenamento-de-anexos.ts` e `storage-uploads.ts`) não tem deslocamento, e a pasta `entrada/<canalId>/` guarda para sempre
  a mídia que uma Mensagem cita. Depois de 500 mídias recebidas num Canal, o lote do dia passa a ser sempre o mesmo e o órfão fora dele
  nunca sai. Quem fecha: acrescentar `deslocamento` (o `list` do SDK aceita `offset`) à porta, ao falso e à coleta. Não bloqueia nada
  agora: o volume real só passa de 500 por Canal bem depois da prova ao vivo.
- A primeira coleta só roda `intervaloMs` (24 h) depois de o processo subir: um processo que reinicia a cada deploy diário nunca coletaria.
  Hoje o deploy é manual e raro, então não pesa; se o deploy virar frequente, a coleta ganha uma primeira rodada logo depois do boot.
- `coletarOrfaos` de `storage-uploads.ts` não foi usada: ela chama o bucket real direto (não passa pela porta, então o falso não a
  intercepta) e seleciona as sessões expiradas sem excluir as que já foram limpas (depois de `limite` sessões abandonadas o lote não
  anda mais). A coleta nova usa a porta e só pega sessão expirada que ainda tem objeto `reservado`/`enviado`. `coletarOrfaos` segue
  exportada e coberta pelo teste dela (`storage-uploads.test.ts`, que roda contra o Supabase real); nenhum código de produção a chama.

## Achados do gate da onda 11 (orquestrador, 2026-11-09)

- Duas rodadas seguidas da suíte inteira do `apps/api` (Postgres 16 de Docker novo, máquina com carga de fundo: load médio ~4,6) falharam em **um teste diferente cada uma**, depois de sete rodadas limpas (ondas 4 a 10):
  1. `repositorios/crm/mensagens.test.ts` "lista por (criado_em, seq) — mesmo criadoEm sai na ordem de inserção": veio `[antes, b, a]` no lugar de `[antes, a, b]`.
  2. `mensageria/processador-de-entrada.test.ts` "acordar() com o laço em 60 s processa em menos de 500 ms": teste de tempo.
- Isolados em banco novo, o 1º passou 8 de 8 e o 2º 5 de 5; `src/repositorios` + `src/mensageria` juntos passam (14 arquivos, 192 testes). O 16-13 não tocou em nenhum dos dois. **Causa não provada:** o 2º é sensível a tempo e cabe na carga da máquina; o 1º não tem explicação por tempo (as inserções do teste são sequenciais e `seq` é `generated always as identity`), então vale repetir no `npm run check` do 16-14 e olhar de novo se voltar a falhar duas vezes seguidas sem carga.

## Achados do gate do plano 16-14 (2026-11-09)

- **CORRIGIDO pelo orquestrador depois do 16-14 (`order by criado_em, plataforma.mensagens.seq` em `listar`, com o teste "desempata o mesmo criadoEm por `seq` como NUMERO": RED com o codigo antigo devolvendo `[100000, 99999]`, GREEN depois da correcao; entrada #80 do `WINDOWS.md` marcada `fixed`). Texto original do achado:** a causa do `mensagens.test.ts` "mesmo criadoEm sai na ordem de insercao" nao e flake, e um bug do `listar` desde o plano 08-12.** `apps/api/src/repositorios/crm/mensagens.ts:239` faz `select ... seq::text as seq ... order by criado_em, seq`. No Postgres, um nome solto no `ORDER BY` liga primeiro ao alias de SAIDA, e o alias `seq` e o texto (`seq::text`): o desempate sai em ordem lexicografica, entao `"100"` fica antes de `"99"`. O teste passa ou falha conforme o contador global de `seq` do banco atravessa uma fronteira de dezena/centena entre as duas insercoes `a` e `b` (a ordem dos arquivos e o numero de Mensagens inseridas antes mudam de uma rodada para outra, por isso "intermitente"). Provado: num Postgres novo o arquivo passa 6 de 6; com `alter table plataforma.mensagens alter column seq restart with 95` o mesmo arquivo falha na mesma asserção. Na rodada 1 do gate do 16-14 falhou (216 de 217 arquivos); na rodada 2, com banco novo, passou. Efeito em producao: duas Mensagens da mesma Conversa com o mesmo `criado_em` (a Evolution manda `messageTimestamp` em segundos, entao empate e comum) saem trocadas no fio quando o `seq` delas atravessa uma potencia de 10. Correcao de uma linha: `order by criado_em, plataforma.mensagens.seq` (ou `m.seq` com alias). As outras consultas ja qualificam (`m.seq` em `tarefas-conversacionais.ts` e `inicio.ts`; `fila-de-saida.ts` nao tem alias). Nao corrigido aqui: o plano 16-14 e so de documentacao.
- `npm run verificar:contratos` imprime "AVISO: repositorio irmao nao encontrado ... pulando verificacao" e sai 0: sem `../financeiro-tria` ao lado, o `check` nao confere os contratos do Financeiro.

## Achados do pré-voo do 16-15 (orquestrador, 2026-11-09)

- **A Evolution de produção é a `2.4.0`, não a `2.3.7` de que o adaptador (16-12) e os exemplos foram lidos.** Provado só com `curl` na raiz (sem chave); licença `active`, 0 instâncias. As notas da 2.4.0 (rc1/rc2, "não para produção") não citam mudança no que o adaptador usa, mas isso é ausência de menção. Decisão do dono: seguir na 2.4.0 e provar A1/A10 no `--seco` e A1 no webhook ao vivo. O adaptador já trata `@lid` pelo `remoteJidAlt` (`traduzir.ts`), que é o que a rc2 corrige na Evolution.
- O `SERVER_URL` da Evolution está em http (o campo `manager` da raiz mostra `http://…`); o acesso externo já redireciona 301 para https. Infra do dono.
- A chave global da Evolution foi colada na conversa pelo dono (contra a regra de ouro do roteiro). Nenhum arquivo do repositório a guarda (conferido por `grep`). Rotacionar `AUTHENTICATION_API_KEY` antes de criar a instância custa nada (a Evolution não tem instâncias).
- A prova 4 do `provar-nginx.sh` mostra que o caminho SSE funciona, mas o nginx 1.30 do contêiner não segurou o fluxo nem sem `X-Accel-Buffering`: o cabeçalho continua como garantia e a verificação real é o passo 15 do roteiro, na VM (T-16-57). `apps/api/deploy/CONTEXT.md` e `mensageria/CONTEXT.md` já dizem isso e apontam `npm run tempo-real:provar -w @n1/api`.
