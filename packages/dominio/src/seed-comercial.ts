/**
 * A Pasta "Meus negócios": o espelho do processo comercial na Estrutura (Espaço "Comercial" › Pasta
 * "Meus negócios" › uma Lista por Funil).
 *
 * Desde o 15-31 (3.5.3, D-15-13) o seed NÃO cria mais a Pasta, as Listas espelho nem as Tarefas-espelho:
 * a demonstração do CRM é o `bootstrap:crm-demo`, e a Pasta só existe hoje para quem a migrou
 * (`apps/api/src/migracao-crm/pasta-meus-negocios.ts`). Desde o 15-41 (D-15-14) a Pasta não é mais
 * estrutura fixa: nenhuma regra a protege. O id fica aqui só para quem ainda o cita (a tela da Lista, o
 * script de migração e os testes) e sai no 15-43, junto com este arquivo.
 *
 * O construtor do espelho antigo mora em `seed-crm-antigo.ts`, só para testes de código que sai.
 */

/** A Pasta espelho; a tela da Lista avisa que é uma cópia do Funil. */
export const MEUS_NEGOCIOS_ID = "fld_meus_negocios";
