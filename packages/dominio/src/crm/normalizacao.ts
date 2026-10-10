/**
 * Normalização de Identificadores de Contato e de Empresa.
 *
 * Normalizar é responsabilidade de quem grava (comentários da 007): a forma
 * canônica é a chave de unicidade (INV-CON-02, INV-EMP-02) — dois valores que
 * normalizam para o mesmo canônico são o mesmo Identificador (RN-CON-08). Por
 * morar no domínio, a mesma função serve ao endpoint e à tela: quem digita vê
 * o que será gravado.
 *
 * Telefone é normalização MÍNIMA, sem biblioteca (premissa A4 da pesquisa):
 * só dígitos e `+`; 10-11 dígitos ganham `+55`; 12-13 começando com 55 ganham
 * `+`; com `+`, de 8 a 15 dígitos. `libphonenumber-js` fica como decisão do
 * dono do produto (seria uma dependência nova do domínio).
 *
 * Todas as funções devolvem `OperationResult<string>`; a recusa traz o campo
 * (`valor`, ou `pais`) e uma frase em português para a tela mostrar.
 */

import { fail, ok, type OperationResult } from "../state";
import type { TipoIdentificadorContato } from "./contatos";

/**
 * Provedores públicos de e-mail: identificam um provedor, não uma organização,
 * e por isso não valem como domínio de Empresa (RN-EMP-05, premissa A5).
 */
export const PROVEDORES_PUBLICOS_DE_EMAIL: readonly string[] = [
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "msn.com",
  "yahoo.com",
  "yahoo.com.br",
  "icloud.com",
  "me.com",
  "uol.com.br",
  "bol.com.br",
  "terra.com.br",
  "ig.com.br",
  "globo.com",
  "protonmail.com",
  "proton.me",
  "aol.com",
];

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REGEX_INSTAGRAM = /^[a-z0-9._]{1,30}$/;
const REGEX_DOMINIO = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;

export function normalizarEmail(valor: string): OperationResult<string> {
  const email = valor.trim().toLowerCase();
  if (!REGEX_EMAIL.test(email)) return fail("Informe um e-mail válido, como nome@empresa.com.", "valor");
  return ok(email);
}

export function normalizarTelefone(valor: string): OperationResult<string> {
  const aparado = valor.trim();
  const internacional = aparado.startsWith("+");
  const digitos = aparado.replace(/\D/g, "");
  if (internacional) {
    if (digitos.length >= 8 && digitos.length <= 15) return ok(`+${digitos}`);
  } else if (digitos.length === 10 || digitos.length === 11) {
    return ok(`+55${digitos}`);
  } else if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith("55")) {
    return ok(`+${digitos}`);
  }
  return fail("Informe um telefone com DDD (ex.: (11) 98765-4321) ou no formato internacional (+1 415 555 2671).", "valor");
}

/** Identidade de WhatsApp é um número: segue a regra do telefone. */
export function normalizarWhatsapp(valor: string): OperationResult<string> {
  return normalizarTelefone(valor);
}

export function normalizarInstagram(valor: string): OperationResult<string> {
  const usuario = valor
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/^instagram\.com\//, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "")
    .replace(/^@/, "");
  if (!REGEX_INSTAGRAM.test(usuario)) {
    return fail("Informe o usuário do Instagram: letras, números, ponto e sublinhado, até 30 caracteres.", "valor");
  }
  return ok(usuario);
}

export function normalizarDominio(valor: string): OperationResult<string> {
  const dominio = valor
    .trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, "")
    .replace(/[/?#].*$/, "")
    .replace(/\.+$/, "")
    .replace(/:\d+$/, "")
    .replace(/\.+$/, "")
    .replace(/^www\./, "");
  if (!REGEX_DOMINIO.test(dominio)) return fail("Informe um domínio válido, como empresa.com.br.", "valor");
  if (PROVEDORES_PUBLICOS_DE_EMAIL.includes(dominio)) {
    return fail(
      `${dominio} é um provedor público de e-mail e não identifica uma Empresa (RN-EMP-05). Use o domínio da própria organização.`,
      "valor",
    );
  }
  return ok(dominio);
}

export function normalizarDocumento(valor: string): OperationResult<string> {
  const digitos = valor.replace(/\D/g, "");
  if (digitos === "") return fail("Informe o documento com ao menos um dígito.", "valor");
  return ok(digitos);
}

export function normalizarIdentificadorDeContato(tipo: TipoIdentificadorContato, valor: string): OperationResult<string> {
  switch (tipo) {
    case "email":
      return normalizarEmail(valor);
    case "telefone":
      return normalizarTelefone(valor);
    case "whatsapp":
      return normalizarWhatsapp(valor);
    case "instagram":
      return normalizarInstagram(valor);
  }
}

export function normalizarIdentificadorDeEmpresa(
  tipo: "dominio" | "documento_fiscal" | "telefone",
  valor: string,
  pais?: string,
): OperationResult<string> {
  switch (tipo) {
    case "dominio":
      return normalizarDominio(valor);
    case "telefone":
      return normalizarTelefone(valor);
    case "documento_fiscal":
      if ((pais ?? "").trim() === "") return fail("Documento fiscal exige o país de emissão.", "pais");
      return normalizarDocumento(valor);
  }
}
