"use client";

/**
 * LOGIN — a porta fictícia do protótipo.
 *
 * Não há backend nem Usuário de verdade: a ontologia distingue Usuário (a
 * identidade que autentica) de Membro (a relação com o Espaço de Trabalho —
 * A1.4), e o protótipo simula só o segundo, em /entrar. Aqui qualquer usuário
 * e senha entram; a tela existe pelo rito e pela marca.
 *
 * Duas metades. À esquerda, a marca: o monograma gigante em marca-d'água
 * tomando o painel, a atmosfera do sistema por trás e a logo completa no
 * centro, flutuando devagar (`.login-marca`, componentes.css). À direita, o
 * cartão com usuário e senha, que chega em cascata depois da marca.
 */

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Atmosfera } from "@/design/atmosfera";
import { BrandLockup, BrandMark } from "@/features/shell/brand";
import { Chegada } from "@/features/shell/chegada";
import { useNavegar } from "@/features/shell/navegacao";
import { Button, Field, Painel, TextInput } from "@/features/shell/ui";

export default function LoginPage() {
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [navegar, pendente] = useNavegar();

  const entrar = (event: FormEvent) => {
    event.preventDefault();
    if (!usuario.trim() || !senha) {
      setErro("Informe o usuário e a senha.");
      return;
    }
    setErro(null);
    // Entrar é navegar: o push acontece no ato e o botão gira até o Início chegar.
    navegar("/");
  };

  return (
    <main className="min-h-screen" style={{ background: "var(--page)" }}>
      <Chegada>
        <div className="grid min-h-screen lg:grid-cols-2">
          {/* ── A marca: marca-d'água gigante, atmosfera e a logo completa no centro ── */}
          <section
            className="relative flex min-h-[18rem] items-center justify-center overflow-hidden p-8 lg:min-h-screen"
            style={{ borderBottom: "1px solid var(--linha-sutil)" }}
            aria-label="N1 Digital"
          >
            <Atmosfera />
            <div className="marca-dagua" aria-hidden="true">
              <BrandMark size={800} tone="atual" title="" />
            </div>
            <div className="login-marca">
              <div className="revelar">
                <BrandLockup size={168} tone="gradiente" />
              </div>
            </div>
          </section>

          {/* ── O acesso ── */}
          <section className="flex items-center justify-center p-6 lg:p-12" aria-label="Acesso">
            <Painel solido className="revelar w-full max-w-sm p-6" style={{ animationDelay: "var(--dur-passo)" }}>
              <form onSubmit={entrar} noValidate className="cascata flex flex-col gap-4">
                <div>
                  <h1 className="ed-titulo">Entrar</h1>
                  <p className="app-base mt-1" style={{ color: "var(--texto-3)" }}>
                    Acesse a plataforma com o seu usuário.
                  </p>
                </div>
                <Field label="Usuário" required>
                  {(id) => (
                    <TextInput id={id} value={usuario} onChange={setUsuario} placeholder="nome.sobrenome" invalid={erro !== null && !usuario.trim()} />
                  )}
                </Field>
                <Field label="Senha" required {...(erro ? { error: erro } : {})}>
                  {(id) => <TextInput id={id} type="password" value={senha} onChange={setSenha} placeholder="••••••••" invalid={erro !== null && !senha} />}
                </Field>
                <Button type="submit" variant="primary" full carregando={pendente} disabledReason="Entrando…">
                  Entrar
                </Button>
                <p className="app-meta text-center">
                  Protótipo sem autenticação: qualquer usuário e senha entram. A sessão é escolhida em{" "}
                  <Link href="/entrar" className="hover:underline" style={{ color: "var(--acento)" }}>
                    Trocar de Membro
                  </Link>
                  .
                </p>
              </form>
            </Painel>
          </section>
        </div>
      </Chegada>
    </main>
  );
}
