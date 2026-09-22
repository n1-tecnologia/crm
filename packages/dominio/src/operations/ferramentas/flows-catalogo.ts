/**
 * 23, 7.4 — o catálogo de Tipos de Componente do esquema 7.3, fixo pela
 * plataforma. Os limites são "do provedor à época" e vivem aqui como Limite
 * imposto por Versão de esquema; a validação (7.5) os aplica — a ontologia
 * deixa claro que a plataforma não espera o provedor rejeitar.
 */

import type { TipoDeComponente } from "../../types";

export type GrupoDoCatalogo = "textoEMidia" | "entrada" | "conteiner" | "acao";

export interface LimitesDoComponente {
  /** Limite da propriedade `texto`. */
  readonly texto?: number;
  /** Limite da propriedade `rotulo`. */
  readonly rotulo?: number;
  readonly textoDeAjuda?: number;
  /** Cardinalidade das Opções (mínimo, máximo). */
  readonly opcoes?: readonly [number, number];
  /** Limite de cada legenda do Rodapé. */
  readonly legenda?: number;
  /** Limite de tamanho de Arquivo de imagem, em bytes. */
  readonly imagemBytes?: number;
}

export interface DefinicaoDoComponente {
  readonly rotulo: string;
  readonly grupo: GrupoDoCatalogo;
  /** É Componente de entrada: exige Nome (7.5.2) e gera Campo de Flow (7.3). */
  readonly entrada: boolean;
  readonly aceitaFilhos: boolean;
  /** Pode carregar uma Ação (6.4). */
  readonly aceitaAcao: boolean;
  /** Tem Opções (escolhas, menu, chips, lista de navegação). */
  readonly temOpcoes: boolean;
  readonly limites: LimitesDoComponente;
  /** Uma frase para o Membro escolher no catálogo. */
  readonly descricao: string;
}

const IMAGEM_300KB = 300 * 1024;

export const CATALOGO_DE_COMPONENTES: Record<TipoDeComponente, DefinicaoDoComponente> = {
  titulo: { rotulo: "Título", grupo: "textoEMidia", entrada: false, aceitaFilhos: false, aceitaAcao: false, temOpcoes: false, limites: { texto: 80 }, descricao: "Uma linha grande no topo da Tela." },
  subtitulo: { rotulo: "Subtítulo", grupo: "textoEMidia", entrada: false, aceitaFilhos: false, aceitaAcao: false, temOpcoes: false, limites: { texto: 80 }, descricao: "Uma linha menor abaixo do título." },
  paragrafo: { rotulo: "Parágrafo", grupo: "textoEMidia", entrada: false, aceitaFilhos: false, aceitaAcao: false, temOpcoes: false, limites: { texto: 4096 }, descricao: "Texto corrido, com peso e markdown." },
  legenda: { rotulo: "Legenda", grupo: "textoEMidia", entrada: false, aceitaFilhos: false, aceitaAcao: false, temOpcoes: false, limites: { texto: 409 }, descricao: "Texto pequeno de apoio." },
  textoRico: { rotulo: "Texto rico", grupo: "textoEMidia", entrada: false, aceitaFilhos: false, aceitaAcao: false, temOpcoes: false, limites: { texto: 4096 }, descricao: "Markdown com títulos, listas e ênfase." },
  imagem: { rotulo: "Imagem", grupo: "textoEMidia", entrada: false, aceitaFilhos: false, aceitaAcao: false, temOpcoes: false, limites: { imagemBytes: IMAGEM_300KB, texto: 80 }, descricao: "Um Arquivo de imagem do Espaço de Trabalho (até 300 KB)." },
  carrosselDeImagens: { rotulo: "Carrossel de imagens", grupo: "textoEMidia", entrada: false, aceitaFilhos: false, aceitaAcao: false, temOpcoes: false, limites: { imagemBytes: IMAGEM_300KB }, descricao: "Várias imagens para deslizar." },

  campoDeTexto: { rotulo: "Campo de texto", grupo: "entrada", entrada: true, aceitaFilhos: false, aceitaAcao: false, temOpcoes: false, limites: { rotulo: 20, textoDeAjuda: 80 }, descricao: "Uma linha: texto, número, e-mail, senha, código ou telefone." },
  areaDeTexto: { rotulo: "Área de texto", grupo: "entrada", entrada: true, aceitaFilhos: false, aceitaAcao: false, temOpcoes: false, limites: { rotulo: 20, textoDeAjuda: 80 }, descricao: "Várias linhas de texto livre." },
  escolhaUnica: { rotulo: "Escolha única", grupo: "entrada", entrada: true, aceitaFilhos: false, aceitaAcao: true, temOpcoes: true, limites: { rotulo: 30, opcoes: [1, 20] }, descricao: "Uma opção entre várias, com título e descrição." },
  multiplaEscolha: { rotulo: "Múltipla escolha", grupo: "entrada", entrada: true, aceitaFilhos: false, aceitaAcao: true, temOpcoes: true, limites: { rotulo: 30, opcoes: [1, 20] }, descricao: "Várias opções ao mesmo tempo, com mínimo e máximo." },
  menuSuspenso: { rotulo: "Menu suspenso", grupo: "entrada", entrada: true, aceitaFilhos: false, aceitaAcao: true, temOpcoes: true, limites: { rotulo: 20, opcoes: [1, 200] }, descricao: "Uma lista que abre para escolher um item." },
  chips: { rotulo: "Chips", grupo: "entrada", entrada: true, aceitaFilhos: false, aceitaAcao: false, temOpcoes: true, limites: { rotulo: 80, opcoes: [1, 20] }, descricao: "Etiquetas que o Contato toca para escolher." },
  consentimento: { rotulo: "Consentimento", grupo: "entrada", entrada: true, aceitaFilhos: false, aceitaAcao: true, temOpcoes: false, limites: { texto: 120 }, descricao: "Uma caixa de aceite, com Ação opcional para os termos." },
  seletorDeData: { rotulo: "Seletor de data", grupo: "entrada", entrada: true, aceitaFilhos: false, aceitaAcao: false, temOpcoes: false, limites: { rotulo: 40, textoDeAjuda: 80 }, descricao: "Uma data, com mínimo e máximo." },
  calendario: { rotulo: "Calendário", grupo: "entrada", entrada: true, aceitaFilhos: false, aceitaAcao: false, temOpcoes: false, limites: { rotulo: 40, textoDeAjuda: 80 }, descricao: "Um dia ou um intervalo num calendário." },
  coletaDeFotos: { rotulo: "Coleta de fotos", grupo: "entrada", entrada: true, aceitaFilhos: false, aceitaAcao: false, temOpcoes: false, limites: { rotulo: 80 }, descricao: "Fotos da câmera ou da galeria, com mínimo e máximo." },
  listaDeNavegacao: { rotulo: "Lista de navegação", grupo: "entrada", entrada: true, aceitaFilhos: false, aceitaAcao: true, temOpcoes: true, limites: { rotulo: 30, opcoes: [1, 20] }, descricao: "Itens com título e descrição que levam a outra Tela." },

  formulario: { rotulo: "Formulário", grupo: "conteiner", entrada: false, aceitaFilhos: true, aceitaAcao: false, temOpcoes: false, limites: {}, descricao: "Agrupa entradas com valores iniciais e mensagens de erro." },
  condicional: { rotulo: "Condicional", grupo: "conteiner", entrada: false, aceitaFilhos: true, aceitaAcao: false, temOpcoes: false, limites: {}, descricao: "Mostra os filhos quando a Condição é verdadeira." },

  linkIncorporado: { rotulo: "Link incorporado", grupo: "acao", entrada: false, aceitaFilhos: false, aceitaAcao: true, temOpcoes: false, limites: { texto: 25 }, descricao: "Um texto tocável com uma Ação." },
  rodape: { rotulo: "Rodapé", grupo: "acao", entrada: false, aceitaFilhos: false, aceitaAcao: true, temOpcoes: false, limites: { rotulo: 35, legenda: 15 }, descricao: "O botão de baixo da Tela: navegar, concluir ou trocar dados." },
};

export const GRUPO_DO_CATALOGO_LABEL: Record<GrupoDoCatalogo, string> = {
  textoEMidia: "Texto e mídia",
  entrada: "Entrada",
  conteiner: "Contêiner",
  acao: "Ação",
};

export const TIPOS_DO_CATALOGO = Object.keys(CATALOGO_DE_COMPONENTES) as TipoDeComponente[];

/** Só estes Tipos carregam Ação (6.4). */
export const aceitaAcao = (tipo: TipoDeComponente): boolean => CATALOGO_DE_COMPONENTES[tipo].aceitaAcao;
export const aceitaFilhos = (tipo: TipoDeComponente): boolean => CATALOGO_DE_COMPONENTES[tipo].aceitaFilhos;
