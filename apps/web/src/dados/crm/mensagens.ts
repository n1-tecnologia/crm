"use client";

// Esqueleto do RED (15-06): existe para o teste carregar e falhar na asserção; a implementação vem no GREEN.
export const chaveDasMensagens = (_conversaId: string, _pagina?: object): string => {
  throw new Error("não implementado");
};
export const useMensagens = (_conversaId: string | undefined): never => {
  throw new Error("não implementado");
};
export const enviarMensagem = (_entrada: object): Promise<{ id: string }> => Promise.reject(new Error("não implementado"));
