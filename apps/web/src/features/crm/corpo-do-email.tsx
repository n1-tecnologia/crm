"use client";

/**
 * O e-mail como ele veio (D-17-13): "Ver e-mail formatado" pede o HTML limpo a `GET /mensagens/:id/corpo-html` e o mostra
 * numa moldura isolada. Nenhum HTML de e-mail entra no DOM da aplicação (T-17-65): a api já o limpa (17-11), e esta é a
 * segunda barreira, de quem desenha.
 *
 * A moldura é um `<iframe>` com:
 * - `sandbox` VAZIO: nenhuma permissão. Sem script, sem mesma origem (o documento tem origem opaca e não alcança cookie, nem
 *   `localStorage`, nem a sessão), sem janela nova, sem formulário. É por isso que um link dentro dela não abre: preço
 *   aceito de uma moldura em que nada roda;
 * - `srcDoc` (o documento é texto, nunca uma URL carregada) e `referrerPolicy="no-referrer"`;
 * - uma CSP no próprio documento (`<meta http-equiv>`), a PRIMEIRA coisa dele, antes de qualquer conteúdo do e-mail:
 *   `default-src 'none'` nega tudo, e só entram imagem `data:` (a api tira a remota: pixel de rastreio, T-17-66) e estilo
 *   embutido. Não mexe em cabeçalho global do Next: o isolamento não depende dele.
 *
 * O HTML entra no `srcDoc` como TEXTO de um atributo (o React o escapa); a moldura é quem o interpreta, isolada.
 */

import { useState } from "react";
import type { EnderecoAdicional, Mensagem } from "@n1/dominio/crm/mensagens";
import { ErroDeApi } from "@/dados/crm/cliente-crm";
import { useCorpoHtml } from "@/dados/crm/mensagens";

/** A política do documento da moldura: nada carrega, exceto imagem `data:` e estilo embutido. */
export const CSP_DO_EMAIL = "default-src 'none'; img-src data:; style-src 'unsafe-inline'";

/**
 * O documento da moldura. Começa pela CSP (o navegador a aplica ao que vem depois). Sem cor literal: `Canvas` e
 * `CanvasText` são as cores do sistema para fundo e texto, e `color-scheme: light` mantém as duas legíveis no tema escuro
 * do app (o e-mail é escrito para fundo claro).
 */
function documentoDoEmail(html: string): string {
  return (
    `<meta http-equiv="Content-Security-Policy" content="${CSP_DO_EMAIL}">` +
    `<meta charset="utf-8">` +
    `<style>html{color-scheme:light;background:Canvas;color:CanvasText}body{margin:8px;font-family:sans-serif;overflow-wrap:anywhere}img{max-width:100%;height:auto}</style>` +
    html
  );
}

export function CorpoDoEmail({ mensagemId }: { readonly mensagemId: string }) {
  const [aberto, setAberto] = useState(false);
  const corpoQ = useCorpoHtml(mensagemId, aberto);
  const html = corpoQ.data?.dados.html;

  if (!aberto) {
    return (
      <button type="button" onClick={() => setAberto(true)} className="app-sm mt-1 underline hover:no-underline">
        Ver e-mail formatado
      </button>
    );
  }

  return (
    <div className="mt-2" data-corpo-do-email="true">
      <button type="button" onClick={() => setAberto(false)} className="app-sm mb-1 underline hover:no-underline">
        Ocultar e-mail formatado
      </button>
      {corpoQ.error ? (
        <p role="alert" className="app-sm" style={{ color: "var(--erro)" }}>
          {corpoQ.error instanceof ErroDeApi && corpoQ.error.status !== 0 && corpoQ.error.status < 500
            ? corpoQ.error.message
            : "Não foi possível carregar o e-mail formatado."}
        </p>
      ) : html === undefined ? (
        <p role="status" className="app-sm" style={{ color: "var(--texto-3)" }}>
          Carregando o e-mail…
        </p>
      ) : (
        <iframe
          title="E-mail formatado"
          sandbox=""
          referrerPolicy="no-referrer"
          srcDoc={documentoDoEmail(html)}
          className="h-96 w-full rounded-[var(--r-controle)]"
          style={{ border: "1px solid var(--linha)" }}
        />
      )}
    </div>
  );
}

const ROTULO_DO_ENDERECO: Record<EnderecoAdicional["tipo"], string> = { para: "Para", copia: "Cópia", copiaOculta: "Cópia oculta" };

function textoDoEndereco(endereco: EnderecoAdicional): string {
  return endereco.nomeExibido ? `${endereco.nomeExibido} <${endereco.endereco}>` : endereco.endereco;
}

/**
 * O que o e-mail traz além do texto, acima dele (D-17-13, D-17-15): quem escreveu quando não é o Contato da Conversa ("De:"),
 * o assunto e os endereços de Para, Cópia e Cópia oculta. Tudo entra como texto do React. `de` já vem decidido por quem
 * desenha o fio (só o remetente que NÃO é o Contato); sem nada a mostrar, não desenha nada.
 */
export function CabecalhoDoEmailNoFio({ mensagem, de, apagado = false }: { readonly mensagem: Pick<Mensagem, "assunto" | "enderecosAdicionais">; readonly de: string | null; readonly apagado?: boolean }) {
  const linhas: string[] = [];
  if (de !== null) linhas.push(`De: ${de}`);
  if (mensagem.assunto) linhas.push(`Assunto: ${mensagem.assunto}`);
  for (const tipo of ["para", "copia", "copiaOculta"] as const) {
    const doTipo = mensagem.enderecosAdicionais.filter((e) => e.tipo === tipo);
    if (doTipo.length > 0) linhas.push(`${ROTULO_DO_ENDERECO[tipo]}: ${doTipo.map(textoDoEndereco).join(", ")}`);
  }
  if (linhas.length === 0) return null;
  return (
    <div className="app-sm mb-1 break-words opacity-80" data-cabecalho-do-email={apagado ? "apagado" : "true"}>
      {linhas.map((linha) => (
        <p key={linha}>{linha}</p>
      ))}
    </div>
  );
}
