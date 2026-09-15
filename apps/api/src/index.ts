/**
 * Ponto de composição do backend.
 *
 * Este arquivo é onde o servidor nasce: ele lê a configuração, monta os
 * repositórios, injeta-os nos serviços e entrega as rotas ao transporte
 * escolhido. Hoje não faz nada disso — a camada HTTP ainda não foi decidida,
 * e essa decisão está registrada em `CONTEXT.md`, ao lado.
 *
 * A regra que vale desde já: nada aqui reimplementa regra de negócio. As regras
 * moram em `@n1/dominio`, que `apps/web` também consome. O backend acrescenta o
 * que o domínio não tem — persistência, autenticação, transporte — e nada além.
 */

export {};
