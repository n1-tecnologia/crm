"use client";

/** 12.3.6 — a seção "Senha" de Minha conta: senha atual, nova e confirmação. */

import { useActionState } from "react";
import { Button, Field } from "@/design/components";
import { CabecalhoDePainel, Painel } from "@/features/shell/ui";
import { TAMANHO_MINIMO_DA_SENHA } from "@/autenticacao/senha";
import { trocarSenha, type EstadoDaTroca } from "./acoes";

const inicial: EstadoDaTroca = {};

export function TrocaDeSenha() {
  const [estado, acao, pendente] = useActionState(trocarSenha, inicial);
  return (
    <Painel>
      <CabecalhoDePainel titulo="Senha" />
      {/* `key` muda depois de trocar: o formulário volta vazio, sem as senhas digitadas. */}
      <form key={estado.feito ? "feito" : "aberto"} action={acao} className="grid gap-3 p-3 sm:max-w-sm">
        <Field label="Senha atual">
          {(id) => <input id={id} name="atual" type="password" autoComplete="current-password" required className="campo alvo-toque" />}
        </Field>
        <Field label="Senha nova" hint={`Pelo menos ${TAMANHO_MINIMO_DA_SENHA} caracteres.`}>
          {(id) => (
            <input id={id} name="nova" type="password" autoComplete="new-password" required minLength={TAMANHO_MINIMO_DA_SENHA} className="campo alvo-toque" />
          )}
        </Field>
        <Field label="Confirme a senha nova">
          {(id) => (
            <input id={id} name="confirmacao" type="password" autoComplete="new-password" required minLength={TAMANHO_MINIMO_DA_SENHA} className="campo alvo-toque" />
          )}
        </Field>
        {estado.erro ? (
          <p role="alert" className="app-sm" style={{ color: "var(--erro)" }}>
            {estado.erro}
          </p>
        ) : null}
        {estado.feito ? (
          <p role="status" className="app-sm">
            Senha trocada. Ela vale a partir do próximo login.
          </p>
        ) : null}
        <div>
          <Button type="submit" variant="primary" disabled={pendente}>
            {pendente ? "Trocando…" : "Trocar a senha"}
          </Button>
        </div>
      </form>
    </Painel>
  );
}
