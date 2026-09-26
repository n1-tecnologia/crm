/**
 * A SPEC DO FORMULÁRIO DE CADA TIPO DE COMPONENTE (23, 7.4): que
 * propriedades ele tem, com que controle se editam e qual o limite do
 * provedor. Um formulário genérico lê isto e se monta — não há 22
 * formulários. É o único lugar da tela que conhece o catálogo por dentro;
 * os limites vêm do catálogo do domínio, não são repetidos aqui.
 */

import type { PropriedadesDeComponente, TipoDeComponente } from "@n1/dominio/types";
import { CATALOGO_DE_COMPONENTES } from "@n1/dominio/operations";
import { TIPO_DE_ENTRADA_LABEL } from "./rotulos";

export type ControleDeProp = "texto" | "textoLongo" | "numero" | "booleano" | "escolha" | "opcoes" | "expressaoOuBooleano" | "imagem" | "imagens" | "legendas";

export interface PropSpec {
  readonly chave: keyof PropriedadesDeComponente;
  readonly rotulo: string;
  readonly controle: ControleDeProp;
  /** Limite de caracteres do provedor (7.5.5). */
  readonly limite?: number;
  readonly obrigatorio?: boolean;
  readonly opcoes?: ReadonlyArray<{ readonly value: string; readonly label: string }>;
  readonly ajuda?: string;
}

const lim = (tipo: TipoDeComponente) => CATALOGO_DE_COMPONENTES[tipo].limites;

const VISIVEL: PropSpec = { chave: "visivel", rotulo: "Visível", controle: "expressaoOuBooleano", ajuda: "Booleano ou Expressão: {formulario.nome} ou {dados.nome}." };
const HABILITADO: PropSpec = { chave: "habilitado", rotulo: "Habilitado", controle: "expressaoOuBooleano", ajuda: "Booleano ou Expressão." };
const OBRIGATORIO: PropSpec = { chave: "obrigatorio", rotulo: "Obrigatório", controle: "booleano" };
const VALOR_INICIAL: PropSpec = { chave: "valorInicial", rotulo: "Valor inicial", controle: "texto" };
const MENSAGEM_DE_ERRO: PropSpec = { chave: "mensagemDeErro", rotulo: "Mensagem de erro", controle: "texto", ajuda: "O que o aparelho mostra quando a validação falha." };
const AJUDA = (tipo: TipoDeComponente): PropSpec => ({ chave: "textoDeAjuda", rotulo: "Texto de ajuda", controle: "texto", ...(lim(tipo).textoDeAjuda !== undefined ? { limite: lim(tipo).textoDeAjuda } : {}) });
const ROTULO = (tipo: TipoDeComponente): PropSpec => ({ chave: "rotulo", rotulo: "Rótulo", controle: "texto", obrigatorio: true, ...(lim(tipo).rotulo !== undefined ? { limite: lim(tipo).rotulo } : {}) });
const TEXTO = (tipo: TipoDeComponente, longo = false): PropSpec => ({ chave: "texto", rotulo: "Texto", controle: longo ? "textoLongo" : "texto", obrigatorio: true, ...(lim(tipo).texto !== undefined ? { limite: lim(tipo).texto } : {}) });
const OPCOES: PropSpec = { chave: "opcoes", rotulo: "Opções", controle: "opcoes", obrigatorio: true, ajuda: "Cada opção tem um identificador (o valor gravado) e um título." };

export const SPEC_POR_TIPO: Record<TipoDeComponente, readonly PropSpec[]> = {
  titulo: [TEXTO("titulo"), VISIVEL],
  subtitulo: [TEXTO("subtitulo"), VISIVEL],
  paragrafo: [
    TEXTO("paragrafo", true),
    { chave: "peso", rotulo: "Peso", controle: "escolha", opcoes: [{ value: "normal", label: "normal" }, { value: "negrito", label: "negrito" }, { value: "italico", label: "itálico" }] },
    { chave: "tachado", rotulo: "Tachado", controle: "booleano" },
    { chave: "markdown", rotulo: "Markdown", controle: "booleano" },
    VISIVEL,
  ],
  legenda: [TEXTO("legenda", true), VISIVEL],
  textoRico: [TEXTO("textoRico", true), VISIVEL],
  imagem: [
    { chave: "imagemFileId", rotulo: "Imagem", controle: "imagem", obrigatorio: true, ajuda: "Um Arquivo do Espaço de Trabalho, até 300 KB (RN-FLW-16)." },
    { chave: "textoAlternativo", rotulo: "Texto alternativo", controle: "texto", limite: 80 },
    { chave: "proporcao", rotulo: "Proporção", controle: "texto", ajuda: "Por exemplo: 16:9." },
    VISIVEL,
  ],
  carrosselDeImagens: [
    { chave: "imagensFileIds", rotulo: "Imagens", controle: "imagens", obrigatorio: true },
    { chave: "proporcao", rotulo: "Proporção", controle: "texto" },
    VISIVEL,
  ],
  campoDeTexto: [
    ROTULO("campoDeTexto"),
    { chave: "tipoDeEntrada", rotulo: "Tipo de entrada", controle: "escolha", opcoes: (Object.keys(TIPO_DE_ENTRADA_LABEL) as Array<keyof typeof TIPO_DE_ENTRADA_LABEL>).map((k) => ({ value: k, label: TIPO_DE_ENTRADA_LABEL[k] })) },
    OBRIGATORIO,
    { chave: "minimo", rotulo: "Mínimo de caracteres", controle: "numero" },
    { chave: "maximo", rotulo: "Máximo de caracteres", controle: "numero" },
    { chave: "padrao", rotulo: "Validação por padrão", controle: "texto", ajuda: "Expressão regular do provedor." },
    AJUDA("campoDeTexto"),
    VALOR_INICIAL,
    HABILITADO,
    VISIVEL,
    MENSAGEM_DE_ERRO,
  ],
  areaDeTexto: [ROTULO("areaDeTexto"), OBRIGATORIO, { chave: "maximo", rotulo: "Comprimento máximo", controle: "numero" }, AJUDA("areaDeTexto"), VALOR_INICIAL, HABILITADO, VISIVEL, MENSAGEM_DE_ERRO],
  escolhaUnica: [ROTULO("escolhaUnica"), OPCOES, OBRIGATORIO, VALOR_INICIAL, HABILITADO, VISIVEL, MENSAGEM_DE_ERRO],
  multiplaEscolha: [ROTULO("multiplaEscolha"), OPCOES, OBRIGATORIO, { chave: "minimo", rotulo: "Mínimo selecionado", controle: "numero" }, { chave: "maximo", rotulo: "Máximo selecionado", controle: "numero" }, HABILITADO, VISIVEL, MENSAGEM_DE_ERRO],
  menuSuspenso: [ROTULO("menuSuspenso"), OPCOES, OBRIGATORIO, VALOR_INICIAL, HABILITADO, VISIVEL, MENSAGEM_DE_ERRO],
  chips: [ROTULO("chips"), OPCOES, OBRIGATORIO, { chave: "minimo", rotulo: "Mínimo selecionado", controle: "numero" }, { chave: "maximo", rotulo: "Máximo selecionado", controle: "numero" }, HABILITADO, VISIVEL],
  consentimento: [TEXTO("consentimento"), OBRIGATORIO, HABILITADO, VISIVEL],
  seletorDeData: [ROTULO("seletorDeData"), OBRIGATORIO, AJUDA("seletorDeData"), VALOR_INICIAL, HABILITADO, VISIVEL, MENSAGEM_DE_ERRO],
  calendario: [
    ROTULO("calendario"),
    { chave: "modo", rotulo: "Modo", controle: "escolha", opcoes: [{ value: "unico", label: "um dia" }, { value: "intervalo", label: "intervalo" }] },
    OBRIGATORIO,
    { chave: "minimo", rotulo: "Mínimo de dias", controle: "numero" },
    { chave: "maximo", rotulo: "Máximo de dias", controle: "numero" },
    AJUDA("calendario"),
    HABILITADO,
    VISIVEL,
  ],
  coletaDeFotos: [
    ROTULO("coletaDeFotos"),
    { chave: "origemDaFoto", rotulo: "Origem", controle: "escolha", opcoes: [{ value: "cameraEGaleria", label: "câmera e galeria" }, { value: "galeria", label: "galeria" }, { value: "camera", label: "câmera" }] },
    OBRIGATORIO,
    { chave: "minimo", rotulo: "Mínimo de fotos", controle: "numero" },
    { chave: "maximo", rotulo: "Máximo de fotos", controle: "numero" },
    HABILITADO,
    VISIVEL,
  ],
  listaDeNavegacao: [ROTULO("listaDeNavegacao"), OPCOES, VISIVEL],
  formulario: [VISIVEL],
  condicional: [],
  linkIncorporado: [TEXTO("linkIncorporado"), VISIVEL],
  rodape: [ROTULO("rodape"), { chave: "legendasDoRodape", rotulo: "Legendas", controle: "legendas", ajuda: "Esquerda, centro e direita; até 15 caracteres cada." }, HABILITADO],
};

/** O rótulo que a lista mostra ao lado do Tipo: o texto, o rótulo ou o Nome. */
export function resumoDoComponente(tipo: TipoDeComponente, propriedades: PropriedadesDeComponente, nome?: string): string {
  const texto = propriedades.texto ?? propriedades.rotulo ?? nome ?? "";
  return texto.length > 48 ? `${texto.slice(0, 47)}…` : texto;
}
