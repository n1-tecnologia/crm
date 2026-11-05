/**
 * 12.3.4 a 12.3.6 — a regra da senha nova, a mesma nas três telas (criar no
 * convite, redefinir e trocar em Minha conta). A senha só passa pela web e
 * pelo Supabase Auth; o `apps/api` nunca a vê, por isso a regra mora aqui.
 */

export const TAMANHO_MINIMO_DA_SENHA = 8;

/** A frase da recusa, ou `undefined` quando a senha nova pode seguir. */
export function recusaDaNovaSenha(senha: string, confirmacao: string): string | undefined {
  if (senha.length < TAMANHO_MINIMO_DA_SENHA) return `A senha precisa ter pelo menos ${TAMANHO_MINIMO_DA_SENHA} caracteres.`;
  if (senha !== confirmacao) return "A confirmação não é igual à senha.";
  return undefined;
}
