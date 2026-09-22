import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // O spike fala com Postgres de verdade; o padrão de 5 s não cobre o
    // semear de 900 registros mais as medições em 10x.
    testTimeout: 180_000,
    hookTimeout: 180_000,
    // Um arquivo por vez, de propósito.
    //
    // Estes testes falam com o Postgres da plataforma pelo pooler do Supabase
    // em modo sessão, que tem teto de conexões. Em paralelo, cada arquivo abre
    // o seu próprio `Pool` (`../src/persistencia/conexao.ts`, `max: 10`) e os
    // 43 arquivos saturam o pooler: as conexões entram em fila e os testes
    // estouram o `testTimeout` — com falhas que MUDAM DE LUGAR a cada
    // execução, que é o tipo de instabilidade que ensina o time a ignorar o
    // vermelho.
    //
    // Medido nesta base: em paralelo, 7 falhas (todas timeout, nenhuma de
    // lógica); em série, 43 arquivos / 356 testes / 0 falhas em 554 s. O custo
    // é o tempo de parede; o ganho é `npm run check` voltar a significar algo.
    //
    // A alternativa seria baixar o `max` do pool, que preserva o paralelismo
    // mas exige calibrar contra um teto que não está no nosso controle e muda
    // com o plano da Supabase. Determinismo ganhou.
    fileParallelism: false,
  },
});
