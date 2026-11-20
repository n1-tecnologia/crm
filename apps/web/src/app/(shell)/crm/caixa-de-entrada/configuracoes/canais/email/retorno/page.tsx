"use client";

/**
 * Fase 17 (D-17-04) — a volta do login do Google e da Microsoft para a caixa de e-mail.
 *
 * O serviço devolve o navegador para cá (é a `EMAIL_OAUTH_REDIRECT_URI` da api, igual à cadastrada no app de login) com `code` e
 * `state`, ou com `error` quando a pessoa cancelou. A página está dentro da casca logada: chama a api com o token da sessão, e é
 * isso que amarra o `state` a quem começou a conexão. Quem confere o `state` é a api; a página só lê dele o id do Canal, para o
 * link de volta.
 *
 * `code` e `state` são de uso único e valem como segredo: a página os lê UMA vez (no primeiro render), troca o endereço por um
 * sem query (`replaceState`, o F5 não repete nada) e chama `POST /canais/email/oauth/concluir` uma vez só. Nada disso vai a
 * `localStorage`, a `sessionStorage` nem ao console. Toda frase de recusa é a que a api deu, mostrada como texto. O único
 * caminho que a página oferece é a ficha do Canal, montado com o id, nunca uma URL que veio no endereço.
 *
 * O segmento `email` é estático e vence o `[canal]` vizinho.
 */

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { ErroDeApi } from "@/dados/crm/cliente-crm";
import { concluirConexaoDoEmail } from "@/dados/crm/canais";
import { useRehidratar } from "@/dados/store";
import { CorpoDeTela, EmptyState, PageHeader } from "@/features/shell/ui";

const CANAIS = "/crm/caixa-de-entrada/configuracoes";

const FRASE_DO_CANCELAMENTO = "Você cancelou a entrada. Nada foi conectado.";
const FRASE_DO_RETORNO_INCOMPLETO = "O endereço de retorno está incompleto. Comece de novo pela ficha do Canal.";
const FRASE_DO_SERVICO_RECUSOU = "O serviço de login não aceitou a entrada. Nada foi conectado. Comece de novo pela ficha do Canal.";
const FRASE_SEM_RESPOSTA = "Não foi possível concluir a conexão. Tente de novo.";

/** O id de um Canal é um UUID ou um id curto do seed: só letras, números, `-` e `_` entram num caminho. */
const ID_DE_CANAL = /^[A-Za-z0-9_-]{1,64}$/;

/** O Canal que o `state` diz, só para o link de volta: quem confere o `state` é a api. */
function canalDoState(state: string | null): string | undefined {
  const dados = state?.split(".")[0];
  if (!dados) return undefined;
  try {
    const json = atob(dados.replace(/-/g, "+").replace(/_/g, "/"));
    const corpo = JSON.parse(json) as Record<string, unknown>;
    return typeof corpo.c === "string" && ID_DE_CANAL.test(corpo.c) ? corpo.c : undefined;
  } catch {
    return undefined;
  }
}

export default function RetornoDoEmailPage() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        path={
          <Link href={CANAIS} className="hover:underline">
            Configurações da Caixa de Entrada
          </Link>
        }
        title="Conectar a caixa de e-mail"
      />
      <CorpoDeTela>
        <Suspense fallback={<Situacao texto="Conferindo a entrada…" />}>
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

/** O que o endereço trouxe, lido uma vez. Depois de usado, o endereço fica sem query e isto é tudo o que resta. */
interface Recebido {
  readonly codigo: string | null;
  readonly state: string | null;
  readonly erro: string | null;
}

function Retorno() {
  const parametros = useSearchParams();
  const caminho = usePathname();
  const rehidratar = useRehidratar();
  // Lido no primeiro render e guardado: trocar o endereço (abaixo) não pode apagar o que a conclusão ainda vai usar.
  const [recebido] = useState<Recebido>(() => ({
    codigo: parametros.get("code"),
    state: parametros.get("state"),
    erro: parametros.get("error"),
  }));
  const [erroDaApi, setErroDaApi] = useState<string | null>(null);
  const [conectado, setConectado] = useState<{ readonly id: string } | null>(null);
  const iniciado = useRef(false);

  const { codigo, state, erro: erroDoServico } = recebido;
  const canalDoRetorno = canalDoState(state);
  // O que os parâmetros já dizem não precisa de estado nem de chamada.
  const erroDaVolta =
    erroDoServico !== null && erroDoServico !== ""
      ? erroDoServico === "access_denied"
        ? FRASE_DO_CANCELAMENTO
        : FRASE_DO_SERVICO_RECUSOU
      : !codigo || !state
        ? FRASE_DO_RETORNO_INCOMPLETO
        : null;
  const erro = erroDaVolta ?? erroDaApi;

  useEffect(() => {
    // Uma vez só: o código vale para uma troca, e o modo estrito monta duas vezes.
    if (iniciado.current) return;
    iniciado.current = true;
    // O endereço não guarda `code` nem `state`: um F5, o histórico e uma cópia do link não os repetem.
    if (typeof window !== "undefined" && window.location.search !== "") window.history.replaceState(null, "", caminho);
    if (erroDaVolta !== null || !codigo || !state) return;
    void (async () => {
      try {
        const canal = await concluirConexaoDoEmail({ codigo, state });
        try {
          await rehidratar();
        } catch {
          // O espelho do Canal se atualiza na próxima leitura: a conexão já está feita.
        }
        setConectado({ id: canal.id });
      } catch (falha) {
        setErroDaApi(falha instanceof ErroDeApi ? falha.message : FRASE_SEM_RESPOSTA);
      }
    })();
  }, [erroDaVolta, codigo, state, caminho, rehidratar]);

  if (conectado !== null) {
    const id = ID_DE_CANAL.test(conectado.id) ? conectado.id : undefined;
    return (
      <EmptyState
        title="Caixa de e-mail conectada."
        hint="A caixa já está ligada ao Canal."
        action={
          <Link href={id ? `${CANAIS}/canais/${id}` : CANAIS} className="app-base underline">
            {id ? "Abrir a ficha do Canal" : "Voltar às configurações"}
          </Link>
        }
      />
    );
  }

  if (erro === null) return <Situacao texto="Conferindo a entrada…" />;
  return (
    <EmptyState
      title="A caixa de e-mail não foi conectada."
      hint={erro}
      action={
        <Link href={canalDoRetorno ? `${CANAIS}/canais/${canalDoRetorno}` : CANAIS} className="app-base underline">
          {canalDoRetorno ? "Tentar de novo" : "Voltar às configurações"}
        </Link>
      }
    />
  );
}
