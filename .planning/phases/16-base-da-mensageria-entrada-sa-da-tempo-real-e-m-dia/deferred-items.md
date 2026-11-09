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
