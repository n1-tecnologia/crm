import type { TomPilula } from "@/design/basicos";
import type { EfeitoDeclarado } from "@/data/derive-ia";
import type { EffectClass, VersionState } from "@/data/types";

/**
 * Rótulos e tons da área de IA, pt-BR, num lugar só — as telas de Habilidade,
 * Conhecimento, Agente e Automação leem daqui para uma Versão "publicada" ter
 * sempre a mesma cor e a mesma palavra.
 */

export const VERSAO_LABEL: Record<VersionState, string> = {
  rascunho: "rascunho",
  publicada: "publicada",
  obsoleta: "obsoleta",
};

export const VERSAO_TOM: Record<VersionState, TomPilula> = {
  rascunho: "aviso",
  publicada: "sucesso",
  obsoleta: "neutro",
};

/** O efeito que uma Habilidade declara (derive-ia `efeitoDeclarado`). */
export const EFEITO_LABEL: Record<EfeitoDeclarado, string> = {
  nenhum: "sem efeito",
  reversivel: "escrita reversível",
  irreversivel: "escrita irreversível",
  externa: "efeito externo",
};

export const EFEITO_TOM: Record<EfeitoDeclarado, TomPilula> = {
  nenhum: "neutro",
  reversivel: "info",
  irreversivel: "aviso",
  externa: "erro",
};

/** A classe de efeito de uma Ferramenta (B22): o que ela pode fazer no mundo. */
export const CLASSE_DE_EFEITO_TOM: Record<EffectClass, TomPilula> = {
  leitura: "neutro",
  escritaReversivel: "info",
  escritaIrreversivel: "aviso",
  externa: "erro",
};

/** Disponível de verdade, ou indisponível por algum motivo que a Pilula diz. */
export const DISPONIBILIDADE_TOM: Record<"disponivel" | "indisponivel", TomPilula> = {
  disponivel: "sucesso",
  indisponivel: "aviso",
};

/** O marcador de "executa no protótipo" do editor de Automação. */
export const EXECUTA_LABEL = "executa no protótipo";
export const NAO_EXECUTA_LABEL = "não executa no protótipo";
/** A Ferramenta antiga que ganhou equivalente executável (automacao-spec `FERRAMENTAS_DEPRECIADAS`). */
export const LEGADO_LABEL = "legado";
