/**
 * Prepara a imagem escolhida para um Grupo: recorta no CENTRO na proporção
 * certa (a foto em quadrado, a capa em 3:1) e reduz no navegador antes de
 * virar Arquivo. O protótipo não tem servidor: sem isto, a foto de 4 MB de um
 * celular viraria um data URL de mais de 5 MB no armazém da sessão.
 *
 * A foto segue o que o WhatsApp pede (quadrada, pelo menos 192 × 192 px; ele
 * mostra em círculo). A capa é só da plataforma (C41).
 */

import type { ImagemDoGrupo } from "@n1/dominio/operations";

export type FormatoDaImagem = "foto" | "capa";

const MEDIDAS: Record<FormatoDaImagem, { readonly largura: number; readonly altura: number; readonly minimo: number }> = {
  foto: { largura: 640, altura: 640, minimo: 192 },
  capa: { largura: 1200, altura: 400, minimo: 200 },
};

const ACEITOS = ["image/jpeg", "image/png", "image/webp"];
/** O `accept` do campo de arquivo. */
export const ACEITA_IMAGEM = ACEITOS.join(",");
/** O teto do arquivo ESCOLHIDO (antes de reduzir). */
const TETO_DO_ARQUIVO = 15 * 1024 * 1024;

export async function prepararImagem(arquivo: File, formato: FormatoDaImagem): Promise<ImagemDoGrupo> {
  if (!ACEITOS.includes(arquivo.type)) throw new Error("Use uma imagem JPG, PNG ou WebP.");
  if (arquivo.size > TETO_DO_ARQUIVO) throw new Error("A imagem passa de 15 MB.");
  const medida = MEDIDAS[formato];
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(arquivo);
  } catch {
    throw new Error("Não deu para ler esta imagem.");
  }
  try {
    if (Math.min(bitmap.width, bitmap.height) < medida.minimo) {
      throw new Error(
        formato === "foto"
          ? `A foto precisa de pelo menos ${medida.minimo} × ${medida.minimo} px.`
          : `A capa precisa de pelo menos ${medida.minimo} px de altura.`,
      );
    }
    // O maior recorte central na proporção do formato.
    const proporcao = medida.largura / medida.altura;
    let sx = 0;
    let sy = 0;
    let sw = bitmap.width;
    let sh = bitmap.height;
    if (sw / sh > proporcao) {
      sw = sh * proporcao;
      sx = (bitmap.width - sw) / 2;
    } else {
      sh = sw / proporcao;
      sy = (bitmap.height - sh) / 2;
    }
    const canvas = document.createElement("canvas");
    canvas.width = medida.largura;
    canvas.height = medida.altura;
    const contexto = canvas.getContext("2d");
    if (!contexto) throw new Error("Não deu para preparar a imagem neste navegador.");
    contexto.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    const url = canvas.toDataURL("image/jpeg", 0.86);
    const base64 = url.slice(url.indexOf(",") + 1);
    return { nome: arquivo.name, url, tamanhoBytes: Math.floor((base64.length * 3) / 4) };
  } finally {
    bitmap.close();
  }
}
