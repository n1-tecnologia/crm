/**
 * `npm run migrar:crm-antigo -w @n1/api -- --espaco <id> <modo> [--funil=migrar|guardar]`
 *
 * Exatamente UM modo por execução, por flag explícita (não existe modo padrão):
 *
 *   --seco        relatório do Espaço e do que cada modo faria; a sessão é só de leitura, nada é escrito.
 *   --guardar     copia o CRM antigo para registros_crm_antigo, confere e apaga de registros (D-15-01).
 *   --migrar      faz o --guardar e leva o Funil ao CRM novo; com Funil antigo exige --funil=migrar ou
 *                 --funil=guardar (D-15-04).
 *   --verificar   confere, sem escrever, a pós-condição; sai com 1 se algo não bate.
 *
 * `--espaco` é obrigatório; não existe "todos os Espaços". Antes de qualquer escrita o script imprime o
 * host do banco (sem usuário nem senha) e o Espaço. Saída: 0 ok, 1 falha de verificação ou erro
 * inesperado, 2 erro de uso (argumento, Espaço inexistente, recusa antes de escrever).
 *
 * Roda no corte, pelo dono (15-34/15-35). Nunca rode contra um banco que não seja o que você quer escrever.
 */

import { carregarEnv, encerrar } from "../persistencia/conexao";
import { ErroDeUso, validarEspaco } from "./colecoes";
import type { DecisaoDeFunil } from "./funil";
import { guardarCrmAntigo, migrarCrmAntigo, relatorioSeco, verificar } from "./migrar-crm-antigo";

export type ModoDoScript = "seco" | "guardar" | "migrar" | "verificar";

export interface ArgumentosDoScript {
  readonly espaco: string;
  readonly modo: ModoDoScript;
  /** Só com `--migrar`. */
  readonly funil?: DecisaoDeFunil;
}

export const USO = [
  "Uso: npm run migrar:crm-antigo -w @n1/api -- --espaco <id> <modo> [--funil=migrar|guardar]",
  "  Modos (exatamente um): --seco | --guardar | --migrar | --verificar",
  "  --funil=migrar|guardar só vale com --migrar (o que fazer com o Funil antigo).",
  "  Exemplo: npm run migrar:crm-antigo -w @n1/api -- --espaco ws_n1 --seco",
].join("\n");

const MODOS: Readonly<Record<string, ModoDoScript>> = { "--seco": "seco", "--guardar": "guardar", "--migrar": "migrar", "--verificar": "verificar" };

/** O valor de uma flag escrita como `--flag valor` ou `--flag=valor`; avança o índice quando consome o próximo argumento. */
function valorDe(argv: readonly string[], indice: number, flag: string): { valor: string; proximo: number } {
  const atual = argv[indice]!;
  if (atual.startsWith(`${flag}=`)) return { valor: atual.slice(flag.length + 1), proximo: indice + 1 };
  const valor = argv[indice + 1];
  if (valor === undefined || valor.startsWith("--")) throw new ErroDeUso(`Falta o valor de ${flag}.`);
  return { valor, proximo: indice + 2 };
}

/** Lê e valida os argumentos. Lança `ErroDeUso` em qualquer problema; não toca em banco nem em ambiente. */
export function lerArgumentos(argv: readonly string[]): ArgumentosDoScript {
  let espaco: string | undefined;
  let funil: string | undefined;
  const modos: ModoDoScript[] = [];

  let i = 0;
  while (i < argv.length) {
    const atual = argv[i]!;
    if (atual === "--espaco" || atual.startsWith("--espaco=")) {
      if (espaco !== undefined) throw new ErroDeUso("--espaco só pode aparecer uma vez: o script trabalha em um Espaço por execução.");
      const lido = valorDe(argv, i, "--espaco");
      espaco = lido.valor;
      i = lido.proximo;
    } else if (atual === "--funil" || atual.startsWith("--funil=")) {
      if (funil !== undefined) throw new ErroDeUso("--funil só pode aparecer uma vez.");
      const lido = valorDe(argv, i, "--funil");
      funil = lido.valor;
      i = lido.proximo;
    } else if (atual in MODOS) {
      modos.push(MODOS[atual]!);
      i += 1;
    } else {
      throw new ErroDeUso(`Argumento desconhecido: ${atual}.`);
    }
  }

  if (espaco === undefined) throw new ErroDeUso("Falta --espaco <id>: o script trabalha em um Espaço por execução.");
  validarEspaco(espaco);
  if (modos.length === 0) throw new ErroDeUso("Escolha um modo: --seco, --guardar, --migrar ou --verificar (não existe modo padrão).");
  if (modos.length > 1) throw new ErroDeUso(`Escolha só um modo por execução (recebi ${modos.map((m) => `--${m}`).join(" e ")}).`);
  const modo = modos[0]!;
  if (funil !== undefined) {
    if (modo !== "migrar") throw new ErroDeUso("--funil só vale com --migrar.");
    if (funil !== "migrar" && funil !== "guardar") throw new ErroDeUso(`--funil aceita migrar ou guardar (recebi "${funil}").`);
    return { espaco, modo, funil };
  }
  return { espaco, modo };
}

/** O host e a porta do banco, SEM usuário nem senha: o que o dono confere antes de deixar o script escrever. */
function bancoDaConexao(): string {
  try {
    return new URL(process.env.DATABASE_URL ?? "").host || "(host indefinido)";
  } catch {
    return "(host indefinido)";
  }
}

/** Roda o script e devolve o código de saída. Não chama `process.exit`: quem chama decide. */
export async function principal(argv: readonly string[]): Promise<number> {
  let argumentos: ArgumentosDoScript;
  try {
    argumentos = lerArgumentos(argv);
  } catch (erro) {
    if (erro instanceof ErroDeUso) {
      console.error(`${erro.message}\n\n${USO}`);
      return 2;
    }
    throw erro;
  }

  carregarEnv();
  try {
    // Antes de qualquer escrita: onde e em quê.
    console.log(`Banco: ${bancoDaConexao()} · Espaço: ${argumentos.espaco} · Modo: --${argumentos.modo}${argumentos.funil ? ` --funil=${argumentos.funil}` : ""}`);
    switch (argumentos.modo) {
      case "seco":
        console.log(await relatorioSeco(argumentos.espaco));
        return 0;
      case "guardar":
        console.log((await guardarCrmAntigo(argumentos.espaco)).mensagem);
        return 0;
      case "migrar":
        console.log((await migrarCrmAntigo(argumentos.espaco, argumentos.funil ? { funil: argumentos.funil } : {})).mensagem);
        return 0;
      case "verificar": {
        const resultado = await verificar(argumentos.espaco);
        console.log(resultado.mensagem);
        return resultado.ok ? 0 : 1;
      }
    }
  } catch (erro) {
    if (erro instanceof ErroDeUso) {
      console.error(erro.message);
      return 2;
    }
    // Só a mensagem: nunca o objeto do erro, que pode carregar o detalhe de uma linha (dado pessoal).
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
