"use client";

/**
 * A tela do Guia do Financeiro (a regra está em `./guia-do-financeiro.ts`).
 *
 * Montado uma vez no `AppShell`. Na entrada de quem alcança a Pasta
 * Financeiro, abre sozinho com o VÍDEO "Como funciona o Financeiro" (a tela
 * real gravada, `VIDEO_DO_GUIA`), até `VEZES_DO_GUIA` entradas ou até "Não
 * mostrar mais". Do
 * vídeo, "Ver o passo a passo" abre os passos com atalho para cada tela; "Ir
 * para lá" leva à tela e encolhe o guia num aviso embaixo, no centro (o canto
 * direito é do robô), de onde se continua do mesmo passo.
 */

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BookOpen, X } from "lucide-react";
import { useData, useSession } from "@/dados/store";
import type { Id } from "@n1/dominio/types";
import { vePastaFinanceiro } from "@/features/financeiro/navegacao-financeiro";
import { Button, ConfirmDialog, Icone } from "@/features/shell/ui";
import {
  EVENTO_ABRIR_GUIA,
  VIDEO_DO_GUIA,
  chaveDaEntrada,
  chaveDoProgresso,
  deveAbrirSozinho,
  dispensarGuia,
  lerProgresso,
  passosPara,
  registrarAbertura,
} from "./guia-do-financeiro";

type Modo = "fechado" | "video" | "passos" | "encolhido";

/** O navegador pode recusar o armazenamento (aba anônima, cota): sem ele, o guia não abre sozinho. */
function armazenamento(tipo: "local" | "sessao"): Storage | undefined {
  try {
    return tipo === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return undefined;
  }
}

function gravar(guardado: Storage, chave: string, valor: string): boolean {
  try {
    guardado.setItem(chave, valor);
    return true;
  } catch {
    return false;
  }
}

/** Só LÊ o navegador: se esta entrada abre o guia sozinha. Quem conta a vez é o efeito. */
function abreNestaEntrada(memberId: Id): boolean {
  const local = armazenamento("local");
  const sessao = armazenamento("sessao");
  if (!local || !sessao) return false;
  try {
    return deveAbrirSozinho(lerProgresso(local.getItem(chaveDoProgresso(memberId))), sessao.getItem(chaveDaEntrada(memberId)) !== null);
  } catch {
    return false;
  }
}

export function GuiaDoFinanceiro() {
  const { memberId } = useSession();
  const estado = useData((data) => data);
  const router = useRouter();
  const passos = useMemo(
    () => (memberId && vePastaFinanceiro(estado, memberId) ? passosPara(estado, memberId) : []),
    [estado, memberId],
  );
  const [modo, setModo] = useState<Modo>("fechado");
  const [indice, setIndice] = useState(0);
  // A entrada é decidida UMA vez por pessoa, durante a renderização (o mesmo
  // ajuste de estado do `usePresenca`), quando os dados dela chegam: sem
  // `setState` dentro de efeito (`react-hooks/set-state-in-effect`).
  const [entradaDe, setEntradaDe] = useState<Id | null>(null);
  const [contarEntrada, setContarEntrada] = useState(false);
  if (memberId && passos.length > 0 && entradaDe !== memberId) {
    setEntradaDe(memberId);
    if (abreNestaEntrada(memberId)) {
      setIndice(0);
      setModo("video");
      setContarEntrada(true);
    }
  }

  // Conta a vez no navegador. A marca da sessão vem antes e é conferida de
  // novo: o React de desenvolvimento roda o efeito duas vezes, e a vez é uma só.
  useEffect(() => {
    if (!contarEntrada || !memberId) return;
    const local = armazenamento("local");
    const sessao = armazenamento("sessao");
    if (!local || !sessao) return;
    try {
      if (sessao.getItem(chaveDaEntrada(memberId)) !== null) return;
      if (!gravar(sessao, chaveDaEntrada(memberId), "1")) return;
      gravar(local, chaveDoProgresso(memberId), JSON.stringify(registrarAbertura(lerProgresso(local.getItem(chaveDoProgresso(memberId))))));
    } catch {
      // Sem armazenamento a vez não conta; o guia só abriu nesta tela.
    }
  }, [contarEntrada, memberId]);

  // "Guia do Financeiro" (menu ⋯ da Lista) reabre pelo vídeo, quantas vezes a pessoa quiser.
  useEffect(() => {
    const abrir = () => {
      setIndice(0);
      setModo("video");
    };
    window.addEventListener(EVENTO_ABRIR_GUIA, abrir);
    return () => window.removeEventListener(EVENTO_ABRIR_GUIA, abrir);
  }, []);

  if (!memberId || passos.length === 0) return null;
  const atual = Math.min(indice, passos.length - 1);
  const passo = passos[atual]!;
  const ultimo = atual === passos.length - 1;
  const marcador = `passo ${atual + 1} de ${passos.length}`;

  const naoMostrarMais = () => {
    const local = armazenamento("local");
    if (local) {
      try {
        gravar(local, chaveDoProgresso(memberId), JSON.stringify(dispensarGuia(lerProgresso(local.getItem(chaveDoProgresso(memberId))))));
      } catch {
        // Sem armazenamento, o pedido vale só para esta sessão: o guia já não abre sozinho de novo nela.
      }
    }
    setModo("fechado");
  };

  return (
    <>
      <ConfirmDialog
        open={modo === "video"}
        title="Como funciona o Financeiro"
        description="A tela de verdade, em uns três minutos: do pedido de pagamento à conferência e ao Omie."
        confirmLabel="Ver o passo a passo"
        cancelLabel="Fechar"
        onConfirm={() => {
          setIndice(0);
          setModo("passos");
        }}
        onCancel={() => setModo("fechado")}
        footerStart={
          <Button variant="ghost" onClick={naoMostrarMais}>
            Não mostrar mais
          </Button>
        }
        extraLargo
      >
        {modo === "video" ? (
          // Sem áudio (as legendas estão na imagem): o navegador deixa começar sozinho, mudo.
          <video
            src={VIDEO_DO_GUIA.src}
            poster={VIDEO_DO_GUIA.poster}
            controls
            autoPlay
            muted
            playsInline
            preload="metadata"
            className="block w-full"
            style={{ aspectRatio: "16 / 10", background: "var(--superficie-2)", borderRadius: "var(--r-painel)", border: "1px solid var(--linha)" }}
          />
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={modo === "passos"}
        title={passo.titulo}
        description={`Guia do Financeiro · ${marcador}`}
        confirmLabel={ultimo ? "Concluir" : "Próximo"}
        cancelLabel="Ver depois"
        onConfirm={() => (ultimo ? setModo("fechado") : setIndice(atual + 1))}
        onCancel={() => setModo("fechado")}
        footerStart={
          atual > 0 ? (
            <Button variant="ghost" onClick={() => setIndice(atual - 1)}>
              Voltar
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => setModo("video")}>
              Ver o vídeo
            </Button>
          )
        }
        wide
      >
        {passo.paragrafos.map((paragrafo) => (
          <p key={paragrafo} className="app-base mb-3" style={{ color: "var(--texto-1)" }}>
            {paragrafo}
          </p>
        ))}
        {passo.destino ? (
          <Button
            onClick={() => {
              router.push(passo.destino!.href);
              setModo("encolhido");
            }}
          >
            {passo.destino.rotulo}
          </Button>
        ) : null}
      </ConfirmDialog>

      {modo === "encolhido" ? (
        <div
          role="region"
          aria-label="Guia do Financeiro"
          className="flutuante fixed bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 px-3 py-2"
          style={{ zIndex: "var(--z-flutuante)" }}
        >
          <Icone de={BookOpen} />
          <span className="app-sm" style={{ color: "var(--texto-2)" }}>
            Guia do Financeiro · {marcador}
          </span>
          <Button size="sm" variant="primary" onClick={() => setModo("passos")}>
            Continuar
          </Button>
          <button type="button" onClick={() => setModo("fechado")} aria-label="Fechar o guia" title="Fechar o guia" className="btn-icone btn-icone-nu">
            <Icone de={X} />
          </button>
        </div>
      ) : null}
    </>
  );
}

/** Reabre o guia de qualquer tela (o guia vive no `AppShell`): o item "Guia do Financeiro" do menu ⋯ das Listas do Financeiro. */
export function abrirGuiaDoFinanceiro(): void {
  window.dispatchEvent(new Event(EVENTO_ABRIR_GUIA));
}
