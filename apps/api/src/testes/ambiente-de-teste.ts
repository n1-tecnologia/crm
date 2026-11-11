/**
 * Roda antes de cada arquivo de teste da api (`vitest.config.mts`, `setupFiles`). Liga o que o AMBIENTE DE TESTE precisa e
 * que produção não tem.
 *
 * `PERMITIR_CONEXAO_SIMULADA` (Sessão 4, 4.3.4): a simulação de conexão só existe onde a variável vale `true`
 * (desenvolvimento, testes, homologação). Os testes de Canal, de Mensagem e de e2e sempre simularam um Canal para ter um
 * conectado, então o ambiente de teste a liga. O que prova que PRODUÇÃO a tem desligada é o teste que tira a variável de
 * propósito (`rotas/crm/canais-simulacao.test.ts`), e a variável fica de fora aqui quando o ambiente já a define.
 */

process.env.PERMITIR_CONEXAO_SIMULADA ??= "true";
