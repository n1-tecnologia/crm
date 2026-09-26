"use client";

/**
 * A PRÉ-VISUALIZAÇÃO DO FLOW: a Tela dentro de uma moldura de telefone, só
 * com texto e tokens do sistema — nada imita o aparelho. As entradas
 * aparecem desligadas; o Rodapé é um botão que NAVEGA na prévia quando a
 * Ação é `navegar`. Componente com problema ganha contorno de erro, para o
 * olho achar o que a Validação apontou.
 */

import type { ComponenteDeFlow, TelaDeFlow, VersaoDeFlow } from "@n1/dominio/types";
import type { ProblemaDeValidacao } from "@n1/dominio/operations";
import { telasOrdenadas } from "@n1/dominio/derive-ferramentas";
import { cn } from "@/features/shell/ui";

export function PreviaDoFlow({ versao, telaId, problemas, onNavegar }: { readonly versao: VersaoDeFlow; readonly telaId: string | null; readonly problemas: readonly ProblemaDeValidacao[]; readonly onNavegar: (telaId: string) => void }) {
  const telas = telasOrdenadas(versao);
  const tela = telas.find((t) => t.id === telaId) ?? telas[0];
  if (!tela) return null;
  const comProblema = new Set(problemas.filter((p) => p.componenteId).map((p) => p.componenteId));
  const indice = telas.indexOf(tela);
  const irPara = (identificador: string | undefined) => {
    const alvo = identificador ? telas.find((t) => t.identificador === identificador) : telas[indice + 1];
    if (alvo) onNavegar(alvo.id);
  };

  return (
    <div className="mx-auto w-[17rem]">
      <div className="painel-solido overflow-hidden" style={{ borderRadius: "var(--r-painel)" }}>
        <div className="flex items-center justify-between px-3 py-2" style={{ background: "var(--superficie-2)", borderBottom: "1px solid var(--linha)" }}>
          <span className="app-sm truncate" style={{ color: "var(--texto)" }}>
            {tela.titulo}
          </span>
          <span className="app-meta app-numero">
            {indice + 1} / {telas.length}
          </span>
        </div>
        <div className="grid gap-3 px-3 py-3" style={{ minHeight: "18rem" }}>
          {tela.componentes.map((c) => (
            <Peca key={c.id} componente={c} tela={tela} comProblema={comProblema} irPara={irPara} />
          ))}
          {tela.terminal && !tela.componentes.some((c) => c.tipo === "rodape") ? (
            <button type="button" className="btn btn-solido w-full" onClick={() => irPara(undefined)} title="Rodapé “concluir” padrão da Definição publicável (6.3)">
              Concluir
            </button>
          ) : null}
        </div>
      </div>
      <p className="app-meta mt-2 text-center">
        {tela.terminal ? "Tela terminal" : "Segue para a próxima Tela"} · {tela.identificador}
      </p>
    </div>
  );
}

function Peca({ componente: c, tela, comProblema, irPara }: { readonly componente: ComponenteDeFlow; readonly tela: TelaDeFlow; readonly comProblema: ReadonlySet<string | undefined>; readonly irPara: (identificador: string | undefined) => void }) {
  const erro = comProblema.has(c.id);
  const moldura = erro ? { outline: "1px solid var(--erro)", outlineOffset: "2px", borderRadius: "var(--r-controle)" } : undefined;
  const p = c.propriedades;
  const rotulo = (
    <span className="app-sm block" style={{ color: "var(--texto-2)" }}>
      {p.rotulo ?? c.nome ?? ""}
      {p.obrigatorio ? " *" : ""}
    </span>
  );
  switch (c.tipo) {
    case "titulo":
      return (
        <p className="ed-titulo" style={moldura}>
          {p.texto}
        </p>
      );
    case "subtitulo":
      return (
        <p className="ed-subtitulo" style={moldura}>
          {p.texto}
        </p>
      );
    case "paragrafo":
    case "textoRico":
      return (
        <p className={cn("app-base whitespace-pre-wrap", p.peso === "negrito" && "font-medium", p.peso === "italico" && "italic", p.tachado && "line-through")} style={{ color: "var(--texto)", ...moldura }}>
          {p.texto}
        </p>
      );
    case "legenda":
      return (
        <p className="app-meta whitespace-pre-wrap" style={moldura}>
          {p.texto}
        </p>
      );
    case "imagem":
    case "carrosselDeImagens":
      return (
        <div className="grid place-items-center rounded-[var(--r-controle)]" style={{ height: "6rem", background: "var(--superficie-2)", border: "1px dashed var(--linha)", ...moldura }}>
          <span className="app-meta">{c.tipo === "imagem" ? (p.textoAlternativo ?? "Imagem") : "Carrossel de imagens"}</span>
        </div>
      );
    case "campoDeTexto":
    case "areaDeTexto":
    case "seletorDeData":
    case "calendario":
      return (
        <label className="grid gap-1" style={moldura}>
          {rotulo}
          <input className="campo" readOnly aria-disabled="true" placeholder={p.textoDeAjuda ?? (c.tipo === "seletorDeData" || c.tipo === "calendario" ? "dd/mm/aaaa" : "")} value={p.valorInicial ?? ""} style={{ height: "var(--controle-h-sm)" }} />
        </label>
      );
    case "escolhaUnica":
    case "multiplaEscolha":
    case "menuSuspenso":
    case "chips":
    case "listaDeNavegacao":
      return (
        <div className="grid gap-1" style={moldura}>
          {rotulo}
          <div className={cn(c.tipo === "chips" ? "flex flex-wrap gap-1.5" : "grid gap-1")}>
            {(p.opcoes ?? []).map((o) => (
              <span key={o.id} className={cn("app-sm flex items-center gap-2 rounded-[var(--r-controle)] px-2 py-1", c.tipo === "chips" && "pilula")} style={{ border: "1px solid var(--linha)", color: "var(--texto)" }}>
                {c.tipo === "escolhaUnica" || c.tipo === "multiplaEscolha" ? <span aria-hidden className="inline-block" style={{ width: "0.75rem", height: "0.75rem", border: "1px solid var(--linha-forte)", borderRadius: c.tipo === "escolhaUnica" ? "9999px" : "var(--r-etiqueta)" }} /> : null}
                {o.titulo}
              </span>
            ))}
            {(p.opcoes ?? []).length === 0 ? <span className="app-meta">sem opções</span> : null}
          </div>
        </div>
      );
    case "consentimento":
      return (
        <label className="app-sm flex items-start gap-2" style={{ color: "var(--texto)", ...moldura }}>
          <span aria-hidden className="mt-0.5 inline-block shrink-0" style={{ width: "0.75rem", height: "0.75rem", border: "1px solid var(--linha-forte)", borderRadius: "var(--r-etiqueta)" }} />
          {p.texto}
          {p.obrigatorio ? " *" : ""}
        </label>
      );
    case "coletaDeFotos":
      return (
        <div className="grid gap-1" style={moldura}>
          {rotulo}
          <div className="grid place-items-center rounded-[var(--r-controle)]" style={{ height: "4rem", background: "var(--superficie-2)", border: "1px dashed var(--linha)" }}>
            <span className="app-meta">Tirar ou escolher fotos</span>
          </div>
        </div>
      );
    case "formulario":
      return (
        <div className="grid gap-3 rounded-[var(--r-controle)] p-2" style={{ border: "1px dashed var(--linha)", ...moldura }}>
          {(c.filhos ?? []).map((f) => (
            <Peca key={f.id} componente={f} tela={tela} comProblema={comProblema} irPara={irPara} />
          ))}
        </div>
      );
    case "condicional":
      return (
        <div className="grid gap-3 rounded-[var(--r-controle)] p-2" style={{ border: "1px dashed var(--linha-acento)", ...moldura }}>
          <span className="app-meta">se {c.condicao?.expressao ?? `${c.condicao?.variavel ?? "?"} ${c.condicao?.operador ?? ""} ${c.condicao?.valor ?? ""}`}</span>
          {(c.filhos ?? []).map((f) => (
            <Peca key={f.id} componente={f} tela={tela} comProblema={comProblema} irPara={irPara} />
          ))}
        </div>
      );
    case "linkIncorporado":
      return (
        <button type="button" className="app-sm text-left underline" style={{ color: "var(--acento)", ...moldura }} onClick={() => (c.acao?.tipo === "navegar" ? irPara(c.acao.telaDeDestino) : undefined)}>
          {p.texto}
        </button>
      );
    case "rodape":
      return (
        <div className="grid gap-1" style={moldura}>
          {p.legendasDoRodape && (p.legendasDoRodape.esquerda || p.legendasDoRodape.centro || p.legendasDoRodape.direita) ? (
            <span className="app-meta flex justify-between">
              <span>{p.legendasDoRodape.esquerda}</span>
              <span>{p.legendasDoRodape.centro}</span>
              <span>{p.legendasDoRodape.direita}</span>
            </span>
          ) : null}
          <button
            type="button"
            className="btn btn-solido w-full"
            onClick={() => (c.acao?.tipo === "navegar" || c.acao?.tipo === "trocaDeDados" ? irPara(c.acao.telaDeDestino) : c.acao?.tipo === "concluir" ? irPara(undefined) : undefined)}
            title={c.acao ? `Ação: ${c.acao.tipo}${c.acao.telaDeDestino ? ` → ${c.acao.telaDeDestino}` : ""}` : "Sem Ação"}
          >
            {p.rotulo ?? "Continuar"}
          </button>
        </div>
      );
  }
}
