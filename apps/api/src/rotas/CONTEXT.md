# rotas

Ler primeiro: [`../../CONTEXT.md`](../../CONTEXT.md) e [`../CONTEXT.md`](../CONTEXT.md)

HTTP ↔ serviço. Um arquivo por recurso. Sem regra de negócio e sem acesso a banco: a rota lê a requisição, chama um serviço e formata a resposta.

Os arquivos deste diretório, desde o Plan 01-04 (`esquemas-de-argumentos.ts` chegou no Plan 01-11; a pasta `esquemas/` nos Plans 01-12..01-16):

- `operacoes.ts` — `POST /operacoes/:nome`, genérica sobre `OPERACOES` (o registro explícito de `@n1/dominio`, uma entrada por operação de domínio alcançável por HTTP).
- `estado.ts` — `GET /estado`, a carga inicial do Espaço de Trabalho.
- `esquemas-de-argumentos.ts` — compõe `esquemas/<modulo>.ts` (um por módulo do domínio) sob `satisfies EsquemasCompletos`: toda operação de `OPERACOES` tem schema; a rota valida antes de `executar()`, forma errada é 400, regra de negócio continua no domínio (recusa em 200).
- `esquemas/` — a FORMA dos `args` por operação (tipos espelhados da assinatura do domínio, não regras), um arquivo por módulo — ver [`esquemas/CONTEXT.md`](esquemas/CONTEXT.md).

A regra continua: a rota chama `executar()` da Unidade de Trabalho (`../persistencia/unidade-de-trabalho.ts`) e traduz o resultado para HTTP — nunca SQL, nunca regra de negócio aqui. Toda rota registrada depois do hook de `../plugins/autenticacao.ts` exige `Authorization: Bearer`, a menos que se marque `config: { publica: true }`.

## Rotas de integração (v1)

`integracao-solicitacoes.ts` — `rotasDeIntegracaoDeSolicitacoes(app)` — as sete rotas `/v1/integrations/payment-requests/*` (Plan 02-13): o lado servidor dos sete métodos do adapter que `docs/08-migracao-financeiro/04-contrato-plataforma-v1.md` congela para `automation/`. `esquemas/integracao-solicitacoes.ts` compõe a forma de `params`/`query`/`body`/`headers` inteiramente a partir de `../contratos/v1.ts` (`EsquemasV1`), sem redefinir forma.

Por que não passam por `POST /operacoes/:nome`: o despacho genérico exige Membro humano (`request.membro`, resolvido de JWT do Supabase) e não tem idempotência HTTP. Estas sete rotas vivem sob credencial de SERVIÇO (`request.servico`, `../plugins/autenticacao-servico.ts`, Plan 02-09) e toda escrita exige `Idempotency-Key`, passando por `../servicos/idempotencia.ts::comIdempotencia` — um conceito que `/operacoes/:nome` não tem porque o cliente humano (a tela) não repete requisição por timeout do jeito que um `automation/` do outro lado de uma rede repete.

O contrato manda: mudar uma resposta destas rotas é mudar `docs/08-migracao-financeiro/04-contrato-plataforma-v1.md`, `../contratos/v1.ts` (schemas) e as fixtures de `contratos/payment-requests-v1/` (raiz do monorepo) no mesmo commit — nunca só o código da rota. Ver `../contratos/CONTEXT.md`, "Regra de mudança".
