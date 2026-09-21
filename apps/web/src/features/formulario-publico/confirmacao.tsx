"use client";

/**
 * A confirmação pública do Formulário (Plan 02-23, `02-UI-SPEC.md` §
 * "Confirmação pública") — D-05: só sucesso de persistência + o número
 * legível. Nada de nome da Tarefa, link de rastreio externo, situação
 * interna do processo, quem decide, anexos ou prazo.
 *
 * A "ordem visual" do UI-SPEC intercala DUAS regiões `role="status"` com
 * conteúdo que fica FORA delas: o rótulo `Número da solicitação` (item 3) e
 * os dois botões (itens 5/6) precisam estar fora da live region, mas o
 * rótulo aparece ENTRE o corpo (dentro da primeira região) e o identificador
 * (dentro da segunda) — uma única região contígua não alcançaria as duas
 * exigências ao mesmo tempo, por isso duas.
 */

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button, Icone, Painel } from "@/features/shell/ui";

const COPY_HEADING = "Solicitação enviada";
const COPY_BODY = "Recebemos sua solicitação. Guarde o número abaixo para falar com o Financeiro.";
const COPY_ROTULO_NUMERO = "Número da solicitação";
const COPY_COPIAR = "Copiar número";
const COPY_COPIADO = "Número copiado.";
const COPY_ENVIAR_OUTRA = "Enviar outra solicitação";

export function Confirmacao({
  numero,
  aoEnviarOutra,
}: {
  readonly numero: string;
  readonly aoEnviarOutra: () => void;
}) {
  const [copiado, setCopiado] = useState(false);

  async function copiarNumero(): Promise<void> {
    try {
      await navigator.clipboard.writeText(numero);
    } catch {
      // Clipboard indisponível (contexto não seguro/permissão negada) — o número já
      // está visível na tela para cópia manual; não há outro recurso a oferecer.
    }
    setCopiado(true);
  }

  return (
    <Painel solido className="grid gap-4 p-6">
      <div role="status" className="grid gap-2">
        <Icone de={CheckCircle2} tamanho="lg" style={{ color: "var(--sucesso)" }} />
        <h2 className="ed-subtitulo">{COPY_HEADING}</h2>
        <p className="app-base" style={{ color: "var(--texto-2)" }}>
          {COPY_BODY}
        </p>
      </div>

      <p className="app-sm" style={{ color: "var(--texto-3)" }}>
        {COPY_ROTULO_NUMERO}
      </p>

      <div role="status" className="grid gap-1">
        <p className="identificador app-numero">{numero}</p>
        {copiado ? <span className="app-sm">{COPY_COPIADO}</span> : null}
      </div>

      <span className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => void copiarNumero()}>
          {COPY_COPIAR}
        </Button>
        <Button variant="ghost" onClick={aoEnviarOutra}>
          {COPY_ENVIAR_OUTRA}
        </Button>
      </span>
    </Painel>
  );
}
