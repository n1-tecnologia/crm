/**
 * O provedor, simulado em memória. Não há back-end: importar, sincronizar,
 * publicar e enviar têm o efeito que o provedor teria, e o Registro de
 * Atividade grava o que aconteceu. O que o provedor "sabe" e a plataforma
 * ainda não espelhou vive aqui — os grupos que uma importação traria.
 */

import type { ConfiguracoesDoGrupo, PapelDoCanal } from "../../types";

export interface GrupoNoProvedor {
  readonly jid: string;
  readonly nome: string;
  readonly descricao: string;
  readonly papelDoCanal: PapelDoCanal;
  readonly configuracoes: ConfiguracoesDoGrupo;
  /** Números dos participantes; o do Canal não vem (o provedor não lista o próprio). */
  readonly participantes: readonly string[];
  readonly administradores: readonly string[];
  readonly linkDeConvite?: string;
}

const CONFIGURACOES_PADRAO: ConfiguracoesDoGrupo = {
  somenteAdministradoresEnviam: false,
  somenteAdministradoresEditamDados: true,
  administradoresAprovamEntrada: false,
  somenteAdministradoresAdicionamParticipantes: false,
};

/** O que `importar Grupos do Canal` encontra, por Identificador externo do Canal. */
export const GRUPOS_NO_PROVEDOR: Record<string, readonly GrupoNoProvedor[]> = {
  "+5511987654321": [
    {
      jid: "120363301111111111@g.us",
      nome: "Fornecedores Full Face",
      descricao: "Representantes de insumos e equipamentos.",
      papelDoCanal: "administrador",
      configuracoes: { ...CONFIGURACOES_PADRAO, somenteAdministradoresAdicionamParticipantes: true },
      participantes: ["5511970002474", "5511970003711", "5511970004948", "5511999001122", "5511999003344"],
      administradores: ["5511970002474"],
      linkDeConvite: "https://chat.whatsapp.com/Forn3c3dor3sFF",
    },
    {
      jid: "120363302222222222@g.us",
      nome: "Ex-alunos 2024",
      descricao: "",
      papelDoCanal: "participante",
      configuracoes: CONFIGURACOES_PADRAO,
      participantes: ["5511970006185", "5511970007422", "5511970008659", "5511999005566"],
      administradores: ["5511999005566"],
    },
  ],
};

let sequencia = 0;

/** Um Identificador externo de grupo no formato do provedor. */
export function gerarJid(): string {
  sequencia += 1;
  return `1203633${String(sequencia).padStart(11, "0")}@g.us`;
}

export function gerarEnderecoDeConvite(): string {
  sequencia += 1;
  return `https://chat.whatsapp.com/${Math.abs(sequencia * 2654435761 % 2 ** 32).toString(36).toUpperCase().padStart(8, "0")}${sequencia.toString(36)}`;
}

/** Identificador externo de um Flow publicado no provedor. */
export function gerarIdentificadorDeFlow(): string {
  sequencia += 1;
  return `${1_000_000_000_000_000 + sequencia * 7_919}`;
}

/** Identificador de resposta do provedor (7.6). */
export function gerarIdentificadorDeResposta(): string {
  sequencia += 1;
  return `resp_${sequencia.toString(36).padStart(8, "0")}`;
}

/** Par de chaves do Ponto de troca de dados: só a pública volta (INV-FLW-09). */
export function gerarChavePublica(): string {
  sequencia += 1;
  const corpo = Array.from({ length: 6 }, (_, i) => ((sequencia * 31 + i * 17) % 4096).toString(16).padStart(3, "0")).join("");
  return `-----BEGIN PUBLIC KEY-----${corpo.toUpperCase()}-----END PUBLIC KEY-----`;
}

export function reiniciarProvedorSimulado(): void {
  sequencia = 0;
}
