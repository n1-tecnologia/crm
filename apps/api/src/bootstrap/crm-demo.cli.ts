/**
 * `npm run bootstrap:crm-demo -w @n1/api -- --espaco <id>` (15-29, UCR-11, D-15-13)
 *
 * Carrega o CRM de demonstração (Contatos, Empresas, Funis, Negócios, Canais, Conversas e Mensagens de
 * mentira) nas tabelas do CRM novo de um Espaço de DESENVOLVIMENTO que já existe e ainda não tem Contato.
 * Só roda em banco local: o host de `DATABASE_URL` tem de ser `localhost` ou `127.0.0.1`, e isso é conferido
 * ANTES de abrir qualquer conexão. Como `apps/api/.env` aponta para o banco real, rode sempre com a URL local
 * explícita:
 *
 *   DATABASE_URL=postgres://postgres:x@localhost:5432/postgres npm run bootstrap:crm-demo -w @n1/api -- --espaco ws_dev
 *
 * Saída: 0 ok, 2 recusa ou erro de uso (banco não local, argumento, Espaço inválido, inexistente ou já com
 * Contatos), 1 erro inesperado.
 */

import { carregarEnv, encerrar, pool } from "../persistencia/conexao";
import { carregarCrmDemo, exigirBancoLocal, RecusaDoDemo, validarEspacoDoDemo } from "./crm-demo";

export interface ArgumentosDoDemo {
  readonly espaco: string;
}

export const USO = [
  "Uso: npm run bootstrap:crm-demo -w @n1/api -- --espaco <id>",
  "  Só roda em banco local (host localhost ou 127.0.0.1), em Espaço que existe e ainda não tem Contatos.",
  "  Exemplo: DATABASE_URL=postgres://postgres:x@localhost:5432/postgres npm run bootstrap:crm-demo -w @n1/api -- --espaco ws_dev",
].join("\n");

/** Lê e valida os argumentos. Lança `RecusaDoDemo` em qualquer problema; não toca em banco nem em ambiente. */
export function lerArgumentos(argv: readonly string[]): ArgumentosDoDemo {
  let espaco: string | undefined;
  let i = 0;
  while (i < argv.length) {
    const atual = argv[i]!;
    if (atual === "--espaco" || atual.startsWith("--espaco=")) {
      if (espaco !== undefined) throw new RecusaDoDemo("--espaco só pode aparecer uma vez: o demo carrega em um Espaço por execução.");
      if (atual.startsWith("--espaco=")) {
        espaco = atual.slice("--espaco=".length);
        i += 1;
      } else {
        const valor = argv[i + 1];
        if (valor === undefined || valor.startsWith("--")) throw new RecusaDoDemo("Falta o valor de --espaco.");
        espaco = valor;
        i += 2;
      }
    } else {
      throw new RecusaDoDemo(`Argumento desconhecido: ${atual}.`);
    }
  }
  if (espaco === undefined) throw new RecusaDoDemo("Falta --espaco <id>: o demo carrega em um Espaço por execução.");
  validarEspacoDoDemo(espaco);
  return { espaco };
}

/** O host e a porta do banco, SEM usuário nem senha. */
function bancoDaConexao(): string {
  try {
    return new URL(process.env.DATABASE_URL ?? "").host || "(host indefinido)";
  } catch {
    return "(host indefinido)";
  }
}

/** Roda o script e devolve o código de saída. Não chama `process.exit`: quem chama decide. */
export async function principal(argv: readonly string[]): Promise<number> {
  let argumentos: ArgumentosDoDemo;
  try {
    argumentos = lerArgumentos(argv);
  } catch (erro) {
    if (erro instanceof RecusaDoDemo) {
      console.error(`${erro.message}\n\n${USO}`);
      return 2;
    }
    throw erro;
  }

  carregarEnv();
  try {
    // A recusa de banco não local vem ANTES de `pool()`: nenhuma conexão é aberta.
    exigirBancoLocal(process.env.DATABASE_URL);
    console.log(`Banco: ${bancoDaConexao()} · Espaço: ${argumentos.espaco}`);
    const cliente = await pool().connect();
    try {
      const resultado = await carregarCrmDemo(cliente, { workspaceId: argumentos.espaco });
      const resumo = Object.entries(resultado.linhas)
        .map(([tabela, n]) => `${tabela} ${n}`)
        .join(" · ");
      console.log(`carregado  demo do CRM no Espaço "${argumentos.espaco}" · ${resumo}`);
    } finally {
      cliente.release();
    }
    return 0;
  } catch (erro) {
    if (erro instanceof RecusaDoDemo) {
      console.error(erro.message);
      return 2;
    }
    // Só a mensagem: nunca o objeto do erro, que pode carregar a URL ou o detalhe de uma linha.
    console.error(`Falhou: ${erro instanceof Error ? erro.message : String(erro)}`);
    return 1;
  } finally {
    await encerrar();
  }
}

// O vitest importa este arquivo só para testar `lerArgumentos` e `principal`; o script só roda como script.
if (!process.env.VITEST) {
  process.exitCode = await principal(process.argv.slice(2));
}
