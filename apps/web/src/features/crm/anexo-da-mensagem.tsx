"use client";

/**
 * O anexo de uma Mensagem no fio (3.9.5, MSG-04). A URL nunca vem da Mensagem: a
 * tela a pede a `GET /mensagens/:id/anexos/:indice` (assinada, vale 5 minutos) e
 * a api decide o acesso pelo Papel e pelo Espaço. Áudio toca em `<audio controls>`,
 * vídeo em `<video controls>`, imagem aparece em `<img>` e documento — PDF, XML,
 * Office, csv, txt, zip — só baixa por link, nunca abre no navegador (a lista do
 * domínio, `ehDocumento`). O `video/3gpp` o navegador não toca: também vira link.
 *
 * O anexo `baixado: false` (o provedor não entregou o arquivo, D-16-08) aparece
 * como indisponível, nunca some da Mensagem, e não chama a rota de URL.
 *
 * Nome e legenda entram como texto do React, nunca como HTML (T-16-41); e só uma
 * URL http(s) vira `src` ou `href`.
 *
 * Renovação (a assinada vence): o SWR repete o pedido a cada 4 minutos e o link
 * usa sempre a URL mais nova. O player, que já carregou, não troca de URL no meio
 * da reprodução: só troca quando ele acusa erro (a assinada venceu), e então a URL
 * é pedida de novo UMA vez, a menos que o arquivo chegue a carregar.
 */

import { useRef, useState } from "react";
import { categoriaDaMidia, normalizarTipoDeMidia } from "@n1/dominio/crm/midia";
import type { AnexoDaMensagem } from "@n1/dominio/crm/mensagens";
import { ErroDeApi } from "@/dados/crm/cliente-crm";
import { useUrlDoAnexo } from "@/dados/crm/mensagens";

export const ANEXO_INDISPONIVEL = "Arquivo indisponível: o provedor não entregou este arquivo.";

/** O que o navegador não toca nem mostra: abre por link, como um documento. */
const SO_BAIXA = new Set(["video/3gpp"]);

function urlHttp(url: string | undefined): string | undefined {
  if (url === undefined) return undefined;
  try {
    const { protocol } = new URL(url);
    return protocol === "https:" || protocol === "http:" ? url : undefined;
  } catch {
    return undefined;
  }
}

export function AnexoDaMensagemNoFio({
  mensagemId,
  indice,
  anexo,
}: {
  readonly mensagemId: string;
  readonly indice: number;
  readonly anexo: AnexoDaMensagem;
}) {
  const urlQ = useUrlDoAnexo(mensagemId, indice, anexo.baixado);
  const urlNova = urlHttp(urlQ.data?.dados.url);

  // A URL que o player usa: a primeira, e a seguinte só depois de um erro dele.
  const [urlDoPlayer, setUrlDoPlayer] = useState<string | undefined>(undefined);
  const [renovando, setRenovando] = useState(false);
  const falhasSeguidas = useRef(0);
  if (urlNova !== undefined && (urlDoPlayer === undefined || (renovando && urlNova !== urlDoPlayer))) {
    setUrlDoPlayer(urlNova);
    setRenovando(false);
  }

  if (!anexo.baixado) return <p className="app-sm">{ANEXO_INDISPONIVEL}</p>;

  if (urlQ.error instanceof ErroDeApi && urlQ.error.status === 404) return <p className="app-sm">{ANEXO_INDISPONIVEL}</p>;

  if (urlQ.error && urlNova === undefined) {
    return (
      <p className="app-sm">
        Não foi possível abrir o arquivo.{" "}
        <button type="button" onClick={() => void urlQ.mutate()} className="font-medium underline">
          Tentar de novo
        </button>
      </p>
    );
  }

  if (urlQ.data !== undefined && urlNova === undefined) return <p className="app-sm">Não foi possível abrir o arquivo.</p>;

  if (urlNova === undefined || urlDoPlayer === undefined) {
    return (
      <p role="status" className="app-sm">
        Carregando o arquivo…
      </p>
    );
  }

  const tipo = normalizarTipoDeMidia(anexo.tipoDeMidia);
  const categoria = categoriaDaMidia(tipo);

  const aoFalhar = () => {
    if (falhasSeguidas.current >= 1) return;
    falhasSeguidas.current += 1;
    setRenovando(true);
    void urlQ.mutate();
  };
  const aoCarregar = () => {
    falhasSeguidas.current = 0;
  };

  if (SO_BAIXA.has(tipo) || categoria === "document" || categoria === undefined) {
    return (
      <a href={urlNova} download={anexo.nome} target="_blank" rel="noopener noreferrer" className="app-sm font-medium underline">
        Baixar {anexo.nome}
      </a>
    );
  }

  if (categoria === "image") {
    return (
      // A URL assinada é remota e de vida curta: não há otimização de imagem a fazer.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={urlDoPlayer}
        alt={anexo.nome}
        onError={aoFalhar}
        onLoad={aoCarregar}
        className="max-h-72 max-w-full rounded-[var(--r-controle)]"
      />
    );
  }

  if (categoria === "video") {
    return (
      <video
        controls
        preload="metadata"
        src={urlDoPlayer}
        onError={aoFalhar}
        onLoadedData={aoCarregar}
        className="max-h-72 max-w-full rounded-[var(--r-controle)]"
      />
    );
  }

  return (
    <span className="flex flex-col gap-1">
      <audio controls preload="metadata" src={urlDoPlayer} onError={aoFalhar} onLoadedData={aoCarregar} className="w-full max-w-[18rem]" />
      <span className="app-sm truncate">{anexo.nome}</span>
    </span>
  );
}
