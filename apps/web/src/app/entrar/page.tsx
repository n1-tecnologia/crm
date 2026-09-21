"use client";

/**
 * T01 — entrar.
 *
 * Até aqui esta tela escolhia o Membro que simulava a sessão (PENDÊNCIAS A2).
 * Agora autentica o Usuário de verdade: e-mail e senha vão ao servidor
 * (`actions.ts`), o cookie de sessão volta, e o Membro é resolvido a partir
 * do Usuário — nunca escolhido.
 *
 * Os campos são nativos e não `TextInput` porque um formulário de Server
 * Action lê `name`, e o `TextInput` do sistema é controlado e não expõe um.
 * A classe é a mesma, então a aparência é a mesma.
 *
 * Fora da casca: um cartão sólido centrado sobre a grade de pontos.
 */

import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { entrar, type EstadoDoLogin } from "./actions";
import { Button, Field } from "@/design/components";
import { Painel } from "@/features/shell/ui";

const inicial: EstadoDoLogin = {};

/**
 * `useSearchParams()` exige uma fronteira `<Suspense>` acima dela em
 * produção — sem isso o `next build` recusa a página inteira (mesma regra
 * que `(shell)/layout.tsx` já documenta para as telas internas). `/entrar`
 * é a primeira rota a rodar contra o build real (Wave 0, Plan 02-01) e foi
 * quem descobriu que faltava aqui.
 */
export default function EntrarPage() {
  return (
    <Suspense>
      <FormularioDeEntrada />
    </Suspense>
  );
}

function FormularioDeEntrada() {
  const params = useSearchParams();
  const para = params.get("para") ?? "";
  const [estado, acao, pendente] = useActionState(entrar, inicial);

  return (
    <main className="grade-pontos flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <Painel solido className="p-6">
          <h1 className="ed-titulo">N1 Digital</h1>
          <p className="app-base mt-1" style={{ color: "var(--texto-3)" }}>
            Entre com o e-mail e a senha da sua conta.
          </p>

          <form action={acao} className="mt-6 flex flex-col gap-4">
            <input type="hidden" name="para" value={para} />

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

            <Field label="Senha">
              {(id) => (
                <input
                  id={id}
                  name="senha"
                  type="password"
                  autoComplete="current-password"
                  required
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
              {pendente ? "Entrando…" : "Entrar"}
            </Button>
          </form>
        </Painel>

        <p className="app-sm mt-4 text-center" style={{ color: "var(--texto-3)" }}>
          Quem entra é o Usuário; o Membro — e tudo o que ele pode ver — é resolvido a partir dele.
        </p>
      </div>
    </main>
  );
}
