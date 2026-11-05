"use client";

/**
 * 12.3.4 — criar a senha, depois do link do e-mail de convite ou de
 * "Esqueci a senha". No convite pede também o nome, que vira o nome do Membro.
 * Mesma casca de `/entrar`: cartão sólido sobre a grade de pontos.
 */

import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Button, Field } from "@/design/components";
import { Painel } from "@/features/shell/ui";
import { TAMANHO_MINIMO_DA_SENHA } from "@/autenticacao/senha";
import { definirSenha, type EstadoDaNovaSenha } from "./actions";

const inicial: EstadoDaNovaSenha = {};

export default function NovaSenhaPage() {
  return (
    <Suspense>
      <FormularioDeNovaSenha />
    </Suspense>
  );
}

function FormularioDeNovaSenha() {
  const tipo = useSearchParams().get("tipo") === "invite" ? "invite" : "recovery";
  const convite = tipo === "invite";
  const [estado, acao, pendente] = useActionState(definirSenha, inicial);

  return (
    <main className="grade-pontos flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <Painel solido className="p-6">
          <h1 className="ed-titulo">{convite ? "Boas-vindas à N1 Digital" : "Crie uma senha nova"}</h1>
          <p className="app-base mt-1" style={{ color: "var(--texto-3)" }}>
            {convite
              ? "Para aceitar o convite, diga o seu nome e crie a senha da sua conta."
              : `A senha precisa ter pelo menos ${TAMANHO_MINIMO_DA_SENHA} caracteres.`}
          </p>

          <form action={acao} className="mt-6 flex flex-col gap-4">
            <input type="hidden" name="tipo" value={tipo} />

            {convite ? (
              <Field label="Seu nome">
                {(id) => <input id={id} name="nome" type="text" autoComplete="name" required autoFocus maxLength={80} className="campo alvo-toque" />}
              </Field>
            ) : null}

            <Field label="Senha nova" hint={convite ? `Pelo menos ${TAMANHO_MINIMO_DA_SENHA} caracteres.` : undefined}>
              {(id) => (
                <input
                  id={id}
                  name="senha"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={TAMANHO_MINIMO_DA_SENHA}
                  autoFocus={!convite}
                  className="campo alvo-toque"
                  aria-invalid={Boolean(estado.erro)}
                />
              )}
            </Field>

            <Field label="Confirme a senha">
              {(id) => (
                <input
                  id={id}
                  name="confirmacao"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={TAMANHO_MINIMO_DA_SENHA}
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
              {pendente ? "Gravando…" : convite ? "Aceitar o convite" : "Gravar a senha"}
            </Button>
          </form>
        </Painel>
      </div>
    </main>
  );
}
