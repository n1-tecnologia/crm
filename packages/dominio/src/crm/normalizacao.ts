import { fail, type OperationResult } from "../state";
import type { TipoIdentificadorContato } from "./contatos";

// Esqueleto do RED: compila e erra. O GREEN o substitui.
const pendente = (): OperationResult<string> => fail("pendente", "valor");
export const PROVEDORES_PUBLICOS_DE_EMAIL: readonly string[] = [];
export const normalizarEmail = (_v: string): OperationResult<string> => pendente();
export const normalizarTelefone = (_v: string): OperationResult<string> => pendente();
export const normalizarWhatsapp = (_v: string): OperationResult<string> => pendente();
export const normalizarInstagram = (_v: string): OperationResult<string> => pendente();
export const normalizarDominio = (_v: string): OperationResult<string> => pendente();
export const normalizarDocumento = (_v: string): OperationResult<string> => pendente();
export const normalizarIdentificadorDeContato = (_t: TipoIdentificadorContato, _v: string): OperationResult<string> => pendente();
export const normalizarIdentificadorDeEmpresa = (
  _t: "dominio" | "documento_fiscal" | "telefone",
  _v: string,
  _p?: string,
): OperationResult<string> => pendente();
