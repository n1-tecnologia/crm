"use client";

/**
 * Sessão 8 (8.2.3) — a volta do login do Instagram.
 *
 * A Meta devolve o navegador para cá (é o `INSTAGRAM_REDIRECT_URI` da api, igual
 * ao cadastrado no painel do app) com `code` e `state`, ou com `error` quando a
 * pessoa cancelou. A página está dentro da casca logada: chama a api com o token
 * da sessão, e é isso que amarra o `state` a quem começou a conexão. Deu certo,
 * reabre a ficha do Canal já conectada; não deu, diz por quê e volta à ficha.
 *
 * O segmento `instagram` é estático e vence o `[canal]` vizinho.
 */

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { ErroDeApi } from "@/dados/crm/cliente-crm";
import { concluirConexaoDoInstagram } from "@/dados/crm/canais";
import { useRehidratar } from "@/dados/store";
import { CorpoDeTela, EmptyState, PageHeader } from "@/features/shell/ui";

const CANAIS = "/crm/caixa-de-entrada/configuracoes";

/** O Canal que o `state` diz, só para o link de volta: quem confere o `state` é a api. */
function canalDoState(state: string | null): string | undefined {
  const dados = state?.split(".")[0];
  if (!dados) return undefined;
  try {
    const json = atob(dados.replace(/-/g, "+").replace(/_/g, "/"));
    const corpo = JSON.parse(json) as Record<string, unknown>;
    return typeof corpo.c === "string" ? corpo.c : undefined;
  } catch {
    return undefined;
  }
}

export default function RetornoDoInstagramPage() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        path={
          <Link href={CANAIS} className="hover:underline">
            Configurações da Caixa de Entrada
          </Link>
        }
        title="Conectar o Instagram"
      />
      <CorpoDeTela>
        <Suspense fallback={<Situacao texto="Conferindo a autorização do Instagram…" />}>
          <Retorno />
        </Suspense>
      </CorpoDeTela>
    </div>
  );
}

function Situacao({ texto }: { readonly texto: string }) {
  return (
    <p role="status" className="app-base px-1" style={{ color: "var(--texto-3)" }}>
      {texto}
    </p>
  );
}

function Retorno() {
  const parametros = useSearchParams();
  const router = useRouter();
  const rehidratar = useRehidratar();
  const [erroDaApi, setErroDaApi] = useState<string | null>(null);
  const enviado = useRef(false);

  const codigo = parametros.get("code");
  const state = parametros.get("state");
  const cancelado = parametros.get("error");
  const canalId = canalDoState(state);
  // O que os parâmetros já dizem não precisa de estado: sai direto da URL.
  const erroDaVolta = cancelado
    ? "A autorização foi cancelada no Instagram. Nada mudou no Canal."
    : !codigo || !state
      ? "O Instagram não devolveu a autorização. Comece de novo pelo botão da ficha do Canal."
      : null;
  const erro = erroDaVolta ?? erroDaApi;

  useEffect(() => {
    // Uma vez só: o código do Instagram vale para uma troca, e o modo estrito monta duas vezes.
    if (erroDaVolta !== null || enviado.current || !codigo || !state) return;
    enviado.current = true;
    void (async () => {
      try {
        // A Meta pode pôr `#_` no fim; ele não é parte do código.
        const canal = await concluirConexaoDoInstagram({ codigo: codigo.replace(/#_$/, ""), state });
        await rehidratar();
        router.replace(`${CANAIS}/canais/${canal.id}`);
      } catch (falha) {
        setErroDaApi(falha instanceof ErroDeApi ? falha.message : "Não foi possível concluir a conexão. Tente de novo.");
      }
    })();
  }, [erroDaVolta, codigo, state, rehidratar, router]);

  if (erro === null) return <Situacao texto="Conferindo a autorização do Instagram…" />;
  return (
    <EmptyState
      title="O Canal não foi conectado."
      hint={erro}
      action={
        <Link href={canalId ? `${CANAIS}/canais/${canalId}` : CANAIS} className="app-base underline">
          {canalId ? "Voltar à ficha do Canal" : "Voltar às configurações"}
        </Link>
      }
    />
  );
}
