"use client";

/**
 * 12.3.3 — a tela do Membro `pendente` que entrou com a senha que já tinha: a
 * api respondeu 403 `CONVITE_PENDENTE` ao `GET /estado`, e em vez de "Sem
 * acesso" a pessoa aceita o convite aqui, informando o nome. Quem chega pelo
 * link do e-mail aceita em `/entrar/nova-senha`.
 */

import { useActionState } from "react";
import { Button, Field } from "@/design/components";
import { Painel } from "@/features/shell/ui";
import { aceitarOConvite, type EstadoDoAceite } from "./acoes";

const inicial: EstadoDoAceite = {};

export function AceiteDoConvite() {
  const [estado, acao, pendente] = useActionState(aceitarOConvite, inicial);
  return (
    <main className="grade-pontos flex min-h-screen items-center justify-center p-6">
      <Painel solido className="w-full max-w-md p-6">
        <h1 className="ed-titulo">Você foi convidado</h1>
        <p className="app-base mt-2" style={{ color: "var(--texto-2)" }}>
          Para entrar no Espaço de Trabalho, aceite o convite. Diga como quer ser chamado.
        </p>
        <form action={acao} className="mt-6 flex flex-col gap-4">
          <Field label="Seu nome">
            {(id) => (
              <input
                id={id}
                name="nome"
                type="text"
                autoComplete="name"
                required
                autoFocus
                maxLength={80}
                className="campo alvo-toque"
                aria-invalid={Boolean(estado.erro)}
              />
            )}
          </Field>
          {estado.erro ? (
            <p role="alert" className="app-sm" style={{ color: "var(--erro)" }}>
              {estado.erro}
            </p>
          ) : null}
          <Button type="submit" variant="primary" full disabled={pendente}>
            {pendente ? "Aceitando…" : "Aceitar o convite"}
          </Button>
        </form>
        <form action="/sair" method="post" className="mt-3">
          <button type="submit" className="btn alvo-toque w-full">Sair</button>
        </form>
      </Painel>
    </main>
  );
}
