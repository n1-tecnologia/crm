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

import Link from "next/link";
import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { entrar, type EstadoDoLogin } from "./actions";
import { Button, Field } from "@/design/components";
import { Painel } from "@/features/shell/ui";

const inicial: EstadoDoLogin = {};

/** 12.3.4 — `/entrar/confirmar` volta para cá com `?aviso=` quando o link do e-mail não serve mais. */
const AVISOS: Readonly<Record<string, string>> = {
  "convite-vencido": "Este link venceu. Peça outro a quem te convidou.",
  "senha-vencida": "Este link venceu. Peça outro em “Esqueci a senha”.",
};

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
  const aviso = AVISOS[params.get("aviso") ?? ""];
  const [estado, acao, pendente] = useActionState(entrar, inicial);

  return (
    <main className="grade-pontos flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <Painel solido className="p-6">
          <h1 className="ed-titulo">N1 Digital</h1>
          <p className="app-base mt-1" style={{ color: "var(--texto-3)" }}>
            Entre com o e-mail e a senha da sua conta.
          </p>

          {aviso ? (
            <p role="alert" className="app-sm mt-4" style={{ color: "var(--erro)" }}>
              {aviso}
            </p>
          ) : null}

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

          <p className="app-sm mt-4 text-center">
            <Link href="/entrar/esqueci" className="hover:underline">
              Esqueci a senha
            </Link>
          </p>
        </Painel>

        <p className="app-sm mt-4 text-center" style={{ color: "var(--texto-3)" }}>
          Quem entra é o Usuário; o Membro — e tudo o que ele pode ver — é resolvido a partir dele.
        </p>
        <p className="app-meta mt-2 text-center">
          <Link href="/privacidade" className="hover:underline">
            Política de Privacidade
          </Link>
          {" · "}
          <Link href="/termos" className="hover:underline">
            Termos e Condições
          </Link>
        </p>
      </div>
    </main>
  );
}
