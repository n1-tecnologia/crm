"use client";

/** 12.3.5 — "Esqueci a senha": pede o e-mail e manda o link de redefinição. */

import Link from "next/link";
import { useActionState } from "react";
import { Button, Field } from "@/design/components";
import { Painel } from "@/features/shell/ui";
import { pedirLinkDeSenha, type EstadoDoPedido } from "./actions";

/** A mesma frase exista ou não o e-mail: ver `actions.ts`. */
const FRASE_DO_ENVIO = "Se o e-mail estiver cadastrado, enviamos um link.";

const inicial: EstadoDoPedido = {};

export default function EsqueciPage() {
  const [estado, acao, pendente] = useActionState(pedirLinkDeSenha, inicial);

  return (
    <main className="grade-pontos flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <Painel solido className="p-6">
          <h1 className="ed-titulo">Esqueci a senha</h1>
          <p className="app-base mt-1" style={{ color: "var(--texto-3)" }}>
            Informe o e-mail da sua conta. Mandamos um link para você criar uma senha nova.
          </p>

          {estado.enviado ? (
            <p role="status" className="app-base mt-6">
              {FRASE_DO_ENVIO}
            </p>
          ) : (
            <form action={acao} className="mt-6 flex flex-col gap-4">
              <Field label="E-mail">
                {(id) => (
                  <input
                    id={id}
                    name="email"
                    type="email"
                    autoComplete="username"
                    required
                    autoFocus
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
                {pendente ? "Enviando…" : "Enviar o link"}
              </Button>
            </form>
          )}
        </Painel>

        <p className="app-sm mt-4 text-center">
          <Link href="/entrar" className="hover:underline">
            Voltar para entrar
          </Link>
        </p>
      </div>
    </main>
  );
}
