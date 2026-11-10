"use client";

/**
 * O estado de entrega de uma Mensagem enviada no fio (3.7.3, MSG-02), em palavras
 * de produto: pendente é "Enviando…", enviada "Enviada", entregue "Entregue",
 * lida "Lida". Quando falhou, mostra "Não enviada", o motivo que o provedor deu e
 * o botão "Tentar de novo" (`POST /mensagens/:id/reenviar`), que devolve a
 * Mensagem a "Enviando…".
 *
 * Só a Mensagem `enviada` tem entrega: a `interna` (nota) e a `recebida` não saem
 * pelo Canal, então nada é desenhado para elas. O motivo e a frase da api entram
 * como texto do React, nunca como HTML (T-16-41): o motivo pode citar o que o
 * provedor devolveu.
 */

import { useRef, useState } from "react";
import type { Mensagem, StatusDeEntrega } from "@n1/dominio/crm/mensagens";
import { ErroDeApi } from "@/dados/crm/cliente-crm";
import { reenviarMensagem } from "@/dados/crm/mensagens";

const ROTULO_DA_ENTREGA: Record<StatusDeEntrega, string> = {
  pendente: "Enviando…",
  enviada: "Enviada",
  entregue: "Entregue",
  lida: "Lida",
  falhou: "Não enviada",
};

export function EstadoDaEntrega({
  mensagem,
}: {
  readonly mensagem: Pick<Mensagem, "id" | "direcao" | "statusEntrega" | "motivoFalha">;
}) {
  // O pedido é uma chamada à api: o `ref` fecha o intervalo entre o clique e a renderização (duplo clique).
  const [reenviando, setReenviando] = useState(false);
  const reenviandoRef = useRef(false);
  /*
    Depois que a api aceita, a leitura nova do fio ainda pode demorar: até ela chegar o
    estado é "Enviando…" e não volta a "Não enviada" por um instante. Quando a Mensagem
    sai de `falhou`, o ajuste cai (durante a renderização, o padrão do React) e uma nova
    falha volta a aparecer como falha.
  */
  const [aceitaPelaApi, setAceitaPelaApi] = useState(false);
  const [recusa, setRecusa] = useState<string | null>(null);

  if (aceitaPelaApi && mensagem.statusEntrega !== "falhou") setAceitaPelaApi(false);

  if (mensagem.direcao !== "enviada" || mensagem.statusEntrega === null) return null;

  const status: StatusDeEntrega = aceitaPelaApi && mensagem.statusEntrega === "falhou" ? "pendente" : mensagem.statusEntrega;

  const tentarDeNovo = async () => {
    if (reenviandoRef.current) return;
    reenviandoRef.current = true;
    setReenviando(true);
    setRecusa(null);
    try {
      await reenviarMensagem(mensagem.id);
      setAceitaPelaApi(true);
    } catch (falha) {
      setRecusa(falha instanceof ErroDeApi ? falha.message : "Não foi possível tentar de novo. Tente mais uma vez.");
    } finally {
      reenviandoRef.current = false;
      setReenviando(false);
    }
  };

  if (status !== "falhou") {
    return <span aria-live="polite">{ROTULO_DA_ENTREGA[status]}</span>;
  }

  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2">
      <span aria-live="polite" className="font-medium">
        {reenviando ? ROTULO_DA_ENTREGA.pendente : ROTULO_DA_ENTREGA.falhou}
      </span>
      {mensagem.motivoFalha ? <span>{mensagem.motivoFalha}</span> : null}
      <button
        type="button"
        onClick={() => void tentarDeNovo()}
        disabled={reenviando}
        className="font-medium underline disabled:no-underline disabled:opacity-60"
      >
        {reenviando ? ROTULO_DA_ENTREGA.pendente : "Tentar de novo"}
      </button>
      {recusa ? <span role="alert">{recusa}</span> : null}
    </span>
  );
}
