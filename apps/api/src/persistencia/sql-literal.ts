/**
 * Um texto como literal SQL, para as mensagens que levam várias instruções
 * numa ida só (`executar()`, Fase 13).
 *
 * O protocolo estendido do `pg` (com `$1`) aceita UMA instrução por mensagem; o
 * simples aceita várias, mas sem parâmetros. Para o `begin`, a trava, a leitura
 * e o fim da transação caberem numa ida e volta, o que seria parâmetro vira
 * literal. Entre dólares (`$marca$…$marca$`) nada precisa de escape: a marca é
 * sorteada a cada uso e só é aceita se o texto não a contém, então o conteúdo
 * não consegue fechar o literal. É o mesmo que escapar, sem a chance de errar o
 * escape.
 */

import { randomBytes } from "node:crypto";

/**
 * `texto` entre dólares, com uma marca que não aparece nele.
 *
 * A conferência olha o texto JÁ com a marca colada no fim: uma marca tem
 * borda (`$`), então o fim do texto poderia formar a marca com o `$` de
 * fechamento antes do fechamento de verdade. Só vale quando a primeira
 * ocorrência é a que vai no fim.
 */
export function literalEntreDolares(texto: string): string {
  for (;;) {
    const marca = `$n1_${randomBytes(6).toString("hex")}$`;
    if ((texto + marca).indexOf(marca) === texto.length) return `${marca}${texto}${marca}`;
  }
}
