const semAcento = (texto: string): string => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
const soDigitos = (texto: string): string => texto.replace(/\D/g, "");

/**
 * A BUSCA de uma lista de opções (2026-09-29: "deve ter como pesquisar o
 * número de telefone sem necessariamente preencher na ordem"). Cada palavra
 * digitada precisa aparecer no rótulo OU no detalhe (onde fica o telefone, o
 * e-mail…), em qualquer ordem, sem caixa nem acento; e uma palavra que é
 * número (só dígitos e `+ ( ) -`) casa pelos dígitos, sem depender de como
 * o número está formatado. "9700", "970001000", "1000 9700" e "ribeiro ana"
 * acham "Ana Ribeiro · +55 11 97000-1000".
 */
export function opcaoCasaComBusca(option: { readonly label: string; readonly detail?: string | undefined }, query: string): boolean {
  const texto = `${option.label} ${option.detail ?? ""}`;
  const alvo = semAcento(texto);
  const digitos = soDigitos(texto);
  return semAcento(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((palavra) => {
      if (alvo.includes(palavra)) return true;
      const numero = soDigitos(palavra);
      return numero.length > 0 && /^[\d+()-]+$/.test(palavra) && digitos.includes(numero);
    });
}
