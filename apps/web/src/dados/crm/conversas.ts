"use client";

// Esqueleto do RED (15-06): as funções existem para o teste carregar e falhar na asserção; a implementação vem no GREEN.
const naoImplementado = (): never => {
  throw new Error("não implementado");
};

export const chaveDeConversas = (_filtro: object): string => naoImplementado();
export const chaveDaConversa = (_id: string): string => naoImplementado();
export const useConversas = (_filtro: object): never => naoImplementado();
export const useConversa = (_id: string | undefined): never => naoImplementado();
export const abrirConversa = (_entrada: object): Promise<never> => Promise.reject(new Error("não implementado"));
export const resolverConversa = (_id: string): Promise<never> => Promise.reject(new Error("não implementado"));
export const reabrirConversa = (_id: string): Promise<never> => Promise.reject(new Error("não implementado"));
export const atribuirConversa = (_id: string, _atribuido: unknown): Promise<never> => Promise.reject(new Error("não implementado"));
export const moverConversa = (_id: string, _contatoId: string, _resolverExistente?: boolean): Promise<never> =>
  Promise.reject(new Error("não implementado"));
export const marcarConversa = (_id: string, _edicao: object): Promise<never> => Promise.reject(new Error("não implementado"));
export const conversaParaLixeira = (_id: string): Promise<never> => Promise.reject(new Error("não implementado"));
export const restaurarConversa = (_id: string): Promise<never> => Promise.reject(new Error("não implementado"));
