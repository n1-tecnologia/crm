/**
 * O leitor de CSV do import de Plano de contas (D4-10b) — função própria,
 * sem dependência nova. `.xlsx` exigiria o pacote `xlsx` (SheetJS), que tem
 * CVE-2023-30533 (prototype pollution) sem correção publicada no npm; nesta
 * fase o import é só `.csv`, que não custa dependência nenhuma.
 *
 * Roda no NAVEGADOR (chamada por `tabela-do-plano-de-contas.tsx` depois de
 * `File.text()`) — por isso não importa `server-only`, ao contrário do resto
 * de `dados/`.
 */

export type LinhaCsvDoPlanoDeContas = {
  readonly cod?: string;
  readonly categoria?: string;
  readonly categoria_clickup?: string;
  readonly descricao?: string;
};

export type ResultadoDeCsvDoPlanoDeContas = {
  readonly linhas: ReadonlyArray<LinhaCsvDoPlanoDeContas>;
  readonly erro?: string;
};

/** O mesmo teto que o `apps/api` aplica (`CORPO_IMPORTAR_PLANO_CONTAS.max(2000)`) — a tela recusa antes de subir. */
const LIMITE_DE_LINHAS = 2000;

const ERRO_SEM_COLUNA_RECONHECIDA =
  "O arquivo não tem nenhuma coluna reconhecida (código, categoria, categoria ClickUp, descrição).";

type ChaveConhecida = "cod" | "categoria" | "categoria_clickup" | "descricao";

/** minúsculas, sem acento, sem espaço nem `_` — casa "Código", "categoria_clickup" e "Categoria ClickUp" com a mesma chave. */
function normalizarNomeDeColuna(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[\s_]+/g, "");
}

const MAPA_DE_COLUNA: Readonly<Record<string, ChaveConhecida>> = {
  codigo: "cod",
  cod: "cod",
  categoria: "categoria",
  categoriaclickup: "categoria_clickup",
  descricao: "descricao",
  descricaodetalhada: "descricao",
};

function detectarSeparador(primeiraLinha: string): "," | ";" {
  const virgulas = (primeiraLinha.match(/,/g) ?? []).length;
  const pontoEVirgulas = (primeiraLinha.match(/;/g) ?? []).length;
  return pontoEVirgulas > virgulas ? ";" : ",";
}

/** Respeita aspas duplas (com `""` como aspa escapada) e separador dentro delas. */
function dividirLinhaEmCampos(linha: string, separador: string): string[] {
  const campos: string[] = [];
  let atual = "";
  let dentroDeAspas = false;

  for (let indice = 0; indice < linha.length; indice++) {
    const caractere = linha[indice];
    if (dentroDeAspas) {
      if (caractere === '"') {
        if (linha[indice + 1] === '"') {
          atual += '"';
          indice++;
        } else {
          dentroDeAspas = false;
        }
      } else {
        atual += caractere;
      }
    } else if (caractere === '"') {
      dentroDeAspas = true;
    } else if (caractere === separador) {
      campos.push(atual);
      atual = "";
    } else {
      atual += caractere;
    }
  }
  campos.push(atual);
  return campos;
}

export function lerCsvDePlanoDeContas(texto: string): ResultadoDeCsvDoPlanoDeContas {
  // CRLF, CR e LF contam igualmente como quebra de linha.
  const todasAsLinhas = texto.split(/\r\n|\r|\n/);
  // A última "linha" de um arquivo terminado em quebra é uma string vazia — não é linha em branco do conteúdo, é o fim do arquivo.
  if (todasAsLinhas.length > 0 && todasAsLinhas[todasAsLinhas.length - 1] === "") todasAsLinhas.pop();

  const linhaDeCabecalho = todasAsLinhas[0];
  if (linhaDeCabecalho === undefined) {
    return { linhas: [], erro: ERRO_SEM_COLUNA_RECONHECIDA };
  }

  const separador = detectarSeparador(linhaDeCabecalho);
  const cabecalho = dividirLinhaEmCampos(linhaDeCabecalho, separador).map(normalizarNomeDeColuna);

  const indicePorChave = new Map<ChaveConhecida, number>();
  cabecalho.forEach((nome, indice) => {
    const chave = MAPA_DE_COLUNA[nome];
    if (chave && !indicePorChave.has(chave)) indicePorChave.set(chave, indice);
  });

  if (indicePorChave.size === 0) {
    return { linhas: [], erro: ERRO_SEM_COLUNA_RECONHECIDA };
  }

  const linhasDeDados = todasAsLinhas.slice(1).filter((linha) => linha.trim() !== "");
  if (linhasDeDados.length > LIMITE_DE_LINHAS) {
    return {
      linhas: [],
      erro: `O arquivo tem mais de ${LIMITE_DE_LINHAS} linhas — o teto por importação é ${LIMITE_DE_LINHAS}.`,
    };
  }

  const linhas: LinhaCsvDoPlanoDeContas[] = linhasDeDados.map((linha) => {
    const campos = dividirLinhaEmCampos(linha, separador);
    const objeto: { -readonly [K in ChaveConhecida]?: string } = {};
    for (const [chave, indice] of indicePorChave) {
      const valor = campos[indice];
      if (valor !== undefined && valor !== "") objeto[chave] = valor;
    }
    return objeto;
  });

  return { linhas };
}
