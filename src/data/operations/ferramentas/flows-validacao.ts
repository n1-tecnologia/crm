/**
 * 23, 7.5 — a validação da Versão, aplicada ANTES de publicar (nunca ao
 * editar: uma Versão inválida pode ser salva como rascunho — DO-FLW-04). É
 * pura: recebe a árvore e devolve a lista de problemas, cada um com a regra
 * que o achou e o lugar (Tela, Componente) para a tela levar o Membro até lá.
 *
 * Também gera a Definição publicável (RN-FLW-11): o documento derivado da
 * árvore por regra fixa da plataforma, do qual um instantâneo é gravado na
 * publicação.
 */

import type { ComponenteDeFlow, Flow, Id, TelaDeFlow, VersaoDeFlow, WorkspaceFile } from "../../types";
import { CATALOGO_DE_COMPONENTES } from "./flows-catalogo";

export type RegraDeValidacao = "7.5.1" | "7.5.2" | "7.5.3" | "7.5.4" | "7.5.5" | "7.5.6";

export interface ProblemaDeValidacao {
  readonly regra: RegraDeValidacao;
  readonly mensagem: string;
  readonly telaId?: Id;
  readonly componenteId?: Id;
}

export const IDENTIFICADOR_DE_TELA = /^[a-z_]+$/;
export const NOME_DE_CAMPO = /^[a-z][a-z0-9_]*$/;

/** Toda referência `{formulario.x}` / `{dados.x}` de um texto (6.4, Expressão). */
export function referenciasDaExpressao(texto: string): Array<{ readonly origem: "formulario" | "dados"; readonly nome: string }> {
  const saida: Array<{ readonly origem: "formulario" | "dados"; readonly nome: string }> = [];
  const re = /\{(formulario|dados)\.([a-zA-Z0-9_]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto)) !== null) {
    const origem = m[1] === "dados" ? "dados" : "formulario";
    saida.push({ origem, nome: m[2] ?? "" });
  }
  return saida;
}

const achatar = (lista: readonly ComponenteDeFlow[]): ComponenteDeFlow[] =>
  lista.flatMap((c) => [c, ...(c.filhos ? achatar(c.filhos) : [])]);

const problema = (regra: RegraDeValidacao, mensagem: string, telaId?: Id, componenteId?: Id): ProblemaDeValidacao => ({
  regra,
  mensagem,
  ...(telaId !== undefined ? { telaId } : {}),
  ...(componenteId !== undefined ? { componenteId } : {}),
});

/**
 * Os seis grupos de regras de 7.5, na ordem do documento. `arquivos` entra
 * para o limite de tamanho de imagem (RN-FLW-16).
 */
export function validarVersao(flow: Flow, versao: VersaoDeFlow, arquivos: readonly WorkspaceFile[] = []): ProblemaDeValidacao[] {
  const problemas: ProblemaDeValidacao[] = [];
  const telas = [...versao.telas].sort((a, b) => a.ordem - b.ordem);

  // 7.5.1 — ao menos uma Tela; a última é terminal; identificadores válidos e únicos; destinos existem; toda Tela alcançável.
  if (telas.length === 0) {
    problemas.push(problema("7.5.1", "A Versão não tem Tela nenhuma."));
    return problemas;
  }
  const ultima = telas[telas.length - 1];
  if (ultima && !ultima.terminal) problemas.push(problema("7.5.1", `A última Tela (“${ultima.titulo}”) precisa ser terminal.`, ultima.id));
  if (!telas.some((t) => t.terminal)) problemas.push(problema("7.5.1", "Nenhuma Tela é terminal: o preenchimento não tem onde concluir."));
  const vistos = new Map<string, TelaDeFlow>();
  for (const tela of telas) {
    if (!IDENTIFICADOR_DE_TELA.test(tela.identificador)) problemas.push(problema("7.5.1", `O Identificador de Tela “${tela.identificador}” só admite letras minúsculas e sublinhado.`, tela.id));
    const outra = vistos.get(tela.identificador);
    if (outra) problemas.push(problema("7.5.1", `Duas Telas com o Identificador “${tela.identificador}”.`, tela.id));
    else vistos.set(tela.identificador, tela);
    if (!tela.titulo.trim()) problemas.push(problema("7.5.1", "A Tela está sem título.", tela.id));
  }
  const destinosDe = (tela: TelaDeFlow): string[] =>
    achatar(tela.componentes)
      .flatMap((c) => [c.acao, ...(c.propriedades.opcoes ?? []).map((o) => o.acao)])
      .filter((a): a is NonNullable<typeof a> => a !== undefined && (a.tipo === "navegar" || a.tipo === "trocaDeDados") && a.telaDeDestino !== undefined)
      .map((a) => a.telaDeDestino ?? "");
  for (const tela of telas) {
    for (const destino of destinosDe(tela)) {
      if (!vistos.has(destino)) problemas.push(problema("7.5.1", `A Tela “${tela.titulo}” navega para “${destino}”, que não existe na Versão.`, tela.id));
    }
  }
  // Alcançabilidade: a ordem é a navegação padrão (7.2) — uma Tela não terminal
  // sem Rodapé segue para a próxima; além disso, toda Ação `navegar` é aresta.
  const inicial = telas[0];
  if (inicial) {
    const alcancadas = new Set<string>([inicial.identificador]);
    const fila = [inicial];
    while (fila.length > 0) {
      const tela = fila.shift();
      if (!tela) break;
      const vizinhos = new Set(destinosDe(tela));
      const indice = telas.indexOf(tela);
      const proxima = telas[indice + 1];
      const temRodapeComNavegacao = achatar(tela.componentes).some((c) => c.tipo === "rodape" && c.acao?.tipo !== undefined);
      if (proxima && !tela.terminal && !temRodapeComNavegacao) vizinhos.add(proxima.identificador);
      for (const id of vizinhos) {
        if (alcancadas.has(id)) continue;
        const alvo = vistos.get(id);
        if (!alvo) continue;
        alcancadas.add(id);
        fila.push(alvo);
      }
    }
    for (const tela of telas) {
      if (!alcancadas.has(tela.identificador)) problemas.push(problema("7.5.1", `A Tela “${tela.titulo}” não é alcançável a partir da inicial.`, tela.id));
    }
  }

  // 7.5.2 — todo Componente de entrada tem Nome; Nomes únicos na Versão.
  const nomes = new Map<string, { telaId: Id; componenteId: Id }>();
  for (const tela of telas) {
    for (const c of achatar(tela.componentes)) {
      const def = CATALOGO_DE_COMPONENTES[c.tipo];
      if (!def.entrada) continue;
      const nome = c.nome?.trim() ?? "";
      if (!nome) {
        problemas.push(problema("7.5.2", `${def.rotulo} sem Nome na Tela “${tela.titulo}”.`, tela.id, c.id));
        continue;
      }
      if (!NOME_DE_CAMPO.test(nome)) problemas.push(problema("7.5.2", `O Nome “${nome}” só admite letras minúsculas, dígitos e sublinhado, começando por letra.`, tela.id, c.id));
      const antes = nomes.get(nome);
      if (antes) problemas.push(problema("7.5.2", `O Nome “${nome}” se repete na Versão (INV-FLW-04).`, tela.id, c.id));
      else nomes.set(nome, { telaId: tela.id, componenteId: c.id });
    }
  }

  // 7.5.3 — Ações: `navegar`/`trocaDeDados` com destino; `concluir` só em terminal; `trocaDeDados` exige Ponto.
  for (const tela of telas) {
    for (const c of achatar(tela.componentes)) {
      const acoes = [c.acao, ...(c.propriedades.opcoes ?? []).map((o) => o.acao)].filter((a): a is NonNullable<typeof a> => a !== undefined);
      if (acoes.length > 0 && !CATALOGO_DE_COMPONENTES[c.tipo].aceitaAcao) {
        problemas.push(problema("7.5.3", `${CATALOGO_DE_COMPONENTES[c.tipo].rotulo} não carrega Ação.`, tela.id, c.id));
      }
      for (const acao of acoes) {
        if ((acao.tipo === "navegar" || acao.tipo === "trocaDeDados") && !acao.telaDeDestino) {
          problemas.push(problema("7.5.3", `A Ação “${acao.tipo === "navegar" ? "navegar" : "troca de dados"}” está sem Tela de destino.`, tela.id, c.id));
        }
        if (acao.tipo === "concluir" && !tela.terminal) {
          problemas.push(problema("7.5.3", `“Concluir” só cabe em Tela terminal; “${tela.titulo}” não é.`, tela.id, c.id));
        }
        if (acao.tipo === "trocaDeDados" && !flow.pontoDeTrocaDeDados) {
          problemas.push(problema("7.5.3", "A Ação “troca de dados” exige um Ponto de troca de dados no Flow (RN-FLW-10).", tela.id, c.id));
        }
        if (acao.tipo === "abrirEndereco" && !acao.endereco) {
          problemas.push(problema("7.5.3", "A Ação “abrir endereço” está sem endereço.", tela.id, c.id));
        }
      }
      if (c.tipo === "rodape" && !c.acao) problemas.push(problema("7.5.3", `O Rodapé da Tela “${tela.titulo}” está sem Ação.`, tela.id, c.id));
    }
  }

  // 7.5.4 — Expressões e cargas úteis referenciam Nomes da Tela corrente ou Dados declarados nela.
  for (const tela of telas) {
    const camposDaTela = new Set(achatar(tela.componentes).filter((c) => CATALOGO_DE_COMPONENTES[c.tipo].entrada && c.nome).map((c) => c.nome ?? ""));
    const dadosDaTela = new Set(tela.dados.map((d) => d.nome));
    const conferir = (texto: string, componenteId: Id, onde: string) => {
      for (const ref of referenciasDaExpressao(texto)) {
        if (ref.origem === "formulario" && !camposDaTela.has(ref.nome)) {
          problemas.push(problema("7.5.4", `${onde} referencia {formulario.${ref.nome}}, que não é Campo desta Tela.`, tela.id, componenteId));
        }
        if (ref.origem === "dados" && !dadosDaTela.has(ref.nome)) {
          problemas.push(problema("7.5.4", `${onde} usa {dados.${ref.nome}}, que não está declarado nos Dados da Tela “${tela.titulo}”.`, tela.id, componenteId));
        }
      }
    };
    for (const c of achatar(tela.componentes)) {
      if (typeof c.propriedades.habilitado === "string") conferir(c.propriedades.habilitado, c.id, "A Expressão de “habilitado”");
      if (typeof c.propriedades.visivel === "string") conferir(c.propriedades.visivel, c.id, "A Expressão de “visível”");
      if (c.propriedades.texto) conferir(c.propriedades.texto, c.id, "O texto");
      if (c.condicao?.expressao) conferir(c.condicao.expressao, c.id, "A Condição");
      if (c.condicao?.variavel) conferir(c.condicao.variavel, c.id, "A variável da Condição");
      const acoes = [c.acao, ...(c.propriedades.opcoes ?? []).map((o) => o.acao)].filter((a): a is NonNullable<typeof a> => a !== undefined);
      for (const acao of acoes) {
        for (const valor of Object.values(acao.cargaUtil ?? {})) conferir(valor, c.id, "A carga útil");
      }
    }
  }

  // 7.5.5 — limites de caracteres, tamanhos de Arquivo e cardinalidades do catálogo.
  const tamanho = (id: Id | undefined): number | undefined => (id === undefined ? undefined : arquivos.find((f) => f.id === id)?.sizeBytes);
  for (const tela of telas) {
    for (const c of achatar(tela.componentes)) {
      const def = CATALOGO_DE_COMPONENTES[c.tipo];
      const lim = def.limites;
      const p = c.propriedades;
      if (lim.texto !== undefined && (p.texto?.length ?? 0) > lim.texto) problemas.push(problema("7.5.5", `${def.rotulo}: o texto passa de ${lim.texto} caracteres (${p.texto?.length ?? 0}).`, tela.id, c.id));
      if (lim.rotulo !== undefined && (p.rotulo?.length ?? 0) > lim.rotulo) problemas.push(problema("7.5.5", `${def.rotulo}: o rótulo passa de ${lim.rotulo} caracteres (${p.rotulo?.length ?? 0}).`, tela.id, c.id));
      if (lim.textoDeAjuda !== undefined && (p.textoDeAjuda?.length ?? 0) > lim.textoDeAjuda) problemas.push(problema("7.5.5", `${def.rotulo}: a ajuda passa de ${lim.textoDeAjuda} caracteres.`, tela.id, c.id));
      if (lim.opcoes) {
        const n = p.opcoes?.length ?? 0;
        if (n < lim.opcoes[0]) problemas.push(problema("7.5.5", `${def.rotulo}: precisa de ao menos ${lim.opcoes[0]} opção${lim.opcoes[0] > 1 ? "ões" : ""}.`, tela.id, c.id));
        if (n > lim.opcoes[1]) problemas.push(problema("7.5.5", `${def.rotulo}: no máximo ${lim.opcoes[1]} opções (${n}).`, tela.id, c.id));
        const ids = new Set<string>();
        for (const o of p.opcoes ?? []) {
          if (!o.titulo.trim()) problemas.push(problema("7.5.5", `${def.rotulo}: uma opção está sem título.`, tela.id, c.id));
          if (!o.id.trim()) problemas.push(problema("7.5.5", `${def.rotulo}: uma opção está sem identificador.`, tela.id, c.id));
          else if (ids.has(o.id)) problemas.push(problema("7.5.5", `${def.rotulo}: o identificador de opção “${o.id}” se repete — o valor da Resposta seria ambíguo.`, tela.id, c.id));
          ids.add(o.id);
        }
      }
      if (lim.legenda !== undefined && p.legendasDoRodape) {
        for (const legenda of [p.legendasDoRodape.esquerda, p.legendasDoRodape.centro, p.legendasDoRodape.direita]) {
          if ((legenda?.length ?? 0) > lim.legenda) problemas.push(problema("7.5.5", `Rodapé: uma legenda passa de ${lim.legenda} caracteres.`, tela.id, c.id));
        }
      }
      if (lim.imagemBytes !== undefined) {
        const ids = [p.imagemFileId, ...(p.imagensFileIds ?? [])].filter((id): id is Id => id !== undefined);
        if (ids.length === 0) problemas.push(problema("7.5.5", `${def.rotulo}: escolha ao menos uma imagem.`, tela.id, c.id));
        for (const id of ids) {
          const bytes = tamanho(id);
          if (bytes === undefined) problemas.push(problema("7.5.5", `${def.rotulo}: o Arquivo referenciado não existe mais (RN-FLW-16).`, tela.id, c.id));
          else if (bytes > lim.imagemBytes) problemas.push(problema("7.5.5", `${def.rotulo}: a imagem passa de ${Math.round(lim.imagemBytes / 1024)} KB.`, tela.id, c.id));
        }
      }
      if (p.minimo !== undefined && p.maximo !== undefined && p.minimo > p.maximo) problemas.push(problema("7.5.5", `${def.rotulo}: o mínimo (${p.minimo}) é maior que o máximo (${p.maximo}).`, tela.id, c.id));
      if (c.tipo === "rodape" && !(p.rotulo?.trim())) problemas.push(problema("7.5.5", "O Rodapé está sem rótulo.", tela.id, c.id));
      if ((c.tipo === "titulo" || c.tipo === "subtitulo" || c.tipo === "paragrafo" || c.tipo === "legenda" || c.tipo === "textoRico" || c.tipo === "linkIncorporado" || c.tipo === "consentimento") && !(p.texto?.trim())) {
        problemas.push(problema("7.5.5", `${def.rotulo} sem texto.`, tela.id, c.id));
      }
      if (def.entrada && c.tipo !== "consentimento" && c.tipo !== "listaDeNavegacao" && !(p.rotulo?.trim())) {
        problemas.push(problema("7.5.5", `${def.rotulo} sem rótulo.`, tela.id, c.id));
      }
    }
  }

  // 7.5.6 — no máximo um Rodapé por Tela; o Rodapé é o último de nível raiz; filhos só em contêineres.
  for (const tela of telas) {
    const rodapes = tela.componentes.filter((c) => c.tipo === "rodape");
    if (rodapes.length > 1) problemas.push(problema("7.5.6", `A Tela “${tela.titulo}” tem ${rodapes.length} Rodapés; só cabe um.`, tela.id, rodapes[1]?.id));
    const ultimo = tela.componentes[tela.componentes.length - 1];
    if (rodapes.length === 1 && ultimo?.tipo !== "rodape") problemas.push(problema("7.5.6", `O Rodapé da Tela “${tela.titulo}” precisa ser o último Componente.`, tela.id, rodapes[0]?.id));
    for (const c of achatar(tela.componentes)) {
      if (c.filhos && c.filhos.length > 0 && !CATALOGO_DE_COMPONENTES[c.tipo].aceitaFilhos) problemas.push(problema("7.5.6", `${CATALOGO_DE_COMPONENTES[c.tipo].rotulo} não admite filhos.`, tela.id, c.id));
      if (c.filhos?.some((f) => f.tipo === "rodape")) problemas.push(problema("7.5.6", "O Rodapé fica no nível raiz da Tela, não dentro de um contêiner.", tela.id, c.id));
      if (c.tipo === "condicional" && !c.condicao) problemas.push(problema("7.5.6", "O Condicional está sem Condição.", tela.id, c.id));
    }
  }

  return problemas;
}

/**
 * RN-FLW-11 — a Definição publicável, derivada da árvore por regra fixa:
 * todo Componente raiz que não seja Rodapé vai para um Formulário implícito;
 * Tela terminal sem Rodapé ganha um `concluir` padrão (6.3). JSON estável
 * (chaves em ordem) para o instantâneo ser comparável.
 */
export function definicaoPublicavel(flow: Flow, versao: VersaoDeFlow): string {
  const telas = [...versao.telas].sort((a, b) => a.ordem - b.ordem);
  const componente = (c: ComponenteDeFlow): Record<string, unknown> => ({
    type: c.tipo,
    ...(c.nome ? { name: c.nome } : {}),
    ...c.propriedades,
    ...(c.acao ? { action: c.acao } : {}),
    ...(c.condicao ? { condition: c.condicao } : {}),
    ...(c.filhos ? { children: c.filhos.map(componente) } : {}),
  });
  const documento = {
    version: versao.versaoDeEsquema,
    name: flow.nome,
    category: flow.categoria,
    ...(flow.pontoDeTrocaDeDados ? { data_api_version: "3.0", endpoint: flow.pontoDeTrocaDeDados.endereco } : {}),
    screens: telas.map((tela) => {
      const raiz = tela.componentes.filter((c) => c.tipo !== "rodape");
      const rodape = tela.componentes.find((c) => c.tipo === "rodape");
      const rodapePadrao = tela.terminal && !rodape ? { type: "rodape", rotulo: "Concluir", action: { tipo: "concluir" } } : undefined;
      return {
        id: tela.identificador,
        title: tela.titulo,
        terminal: tela.terminal,
        ...(tela.dados.length > 0 ? { data: Object.fromEntries(tela.dados.map((d) => [d.nome, { type: d.tipo, ...(d.exemplo !== undefined ? { example: d.exemplo } : {}) }])) } : {}),
        layout: {
          type: "SingleColumnLayout",
          children: [
            { type: "formulario", name: `form_${tela.identificador}`, children: raiz.map(componente) },
            ...(rodape ? [componente(rodape)] : rodapePadrao ? [rodapePadrao] : []),
          ],
        },
      };
    }),
  };
  return JSON.stringify(documento);
}
