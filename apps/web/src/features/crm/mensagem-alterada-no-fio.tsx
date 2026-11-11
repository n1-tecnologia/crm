"use client";

/**
 * O que o provedor muda numa Mensagem que já está no fio (4.4.5) e a citação (4.4.2, 4.4.4), em peças pequenas que o fio da
 * Conversa (`conversation-thread.tsx`) monta dentro da bolha:
 *
 *   - `MensagemApagada`: a Marcação de exclusão (ontologia 7.6): o conteúdo e os anexos DEIXAM DE SER EXIBIDOS e a bolha fica
 *     com o marcador. O texto continua guardado no banco, mas a tela nunca o mostra (nem na citação);
 *   - `ReacoesDaMensagem`: a Reação vigente de cada autor (a última do registro, sem as removidas) embaixo do texto;
 *   - `CitacaoNaBolha`: o trecho da Mensagem a que esta responde, achada no próprio fio. A citada que não está nas Mensagens
 *     carregadas (uma página antiga) vira "Mensagem anterior";
 *   - `marcaDeEditada`: a edição que o remetente externo transmitiu, com o conteúdo de antes no `title`.
 *
 * Tudo entra como texto do React, nunca como HTML: o conteúdo vem de terceiros (T-15-50).
 */

import { reacoesVigentes, type AutorDaReacao, type Mensagem, type OrigemDaExclusao, type Reacao } from "@n1/dominio/crm/mensagens";

const FRASE_DA_EXCLUSAO: Readonly<Record<OrigemDaExclusao, string>> = {
  remetente_externo: "Mensagem apagada pelo Contato",
  celular_do_canal: "Mensagem apagada no celular",
  interno: "Mensagem apagada",
};

const QUEM_REAGIU: Readonly<Record<AutorDaReacao, string>> = {
  contato: "O Contato reagiu",
  canal: "O celular do Canal reagiu",
};

/** Quanto da Mensagem citada aparece na bolha. */
const TAMANHO_DA_CITACAO = 140;

export function MensagemApagada({ porQuem }: { readonly porQuem: OrigemDaExclusao }) {
  return (
    <p className="app-sm italic opacity-80" data-mensagem-apagada="true">
      {FRASE_DA_EXCLUSAO[porQuem]}
    </p>
  );
}

export function ReacoesDaMensagem({ reacoes }: { readonly reacoes: readonly Reacao[] }) {
  const vigentes = reacoesVigentes(reacoes);
  if (vigentes.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1" data-reacoes="true">
      {vigentes.map(({ autor, emoji }) => (
        <span
          key={autor}
          role="img"
          aria-label={`${QUEM_REAGIU[autor]} com ${emoji}`}
          title={QUEM_REAGIU[autor]}
          className="app-sm rounded-full px-1.5"
          style={{ background: "var(--superficie-3)", color: "var(--texto)" }}
        >
          {emoji}
        </span>
      ))}
    </div>
  );
}

/** O que aparece da Mensagem citada: o texto (limitado), "Anexo" quando só há arquivo, e nunca o conteúdo de uma apagada. */
export function resumoDaMensagem(mensagem: Pick<Mensagem, "conteudo" | "anexos" | "marcacaoExclusao">): string {
  if (mensagem.marcacaoExclusao !== null) return "Mensagem apagada";
  const texto = (mensagem.conteudo ?? "").trim();
  if (texto !== "") return texto.length > TAMANHO_DA_CITACAO ? `${texto.slice(0, TAMANHO_DA_CITACAO)}…` : texto;
  return mensagem.anexos.length > 0 ? "Anexo" : "Mensagem";
}

export function CitacaoNaBolha({ citada, nomeDoContato }: { readonly citada: Mensagem | undefined; readonly nomeDoContato: string }) {
  const autor = citada === undefined ? null : citada.direcao === "recebida" ? nomeDoContato || "Contato" : "Atendimento";
  return (
    <blockquote className="app-sm mb-1 pl-2 opacity-90" data-citacao="true" style={{ borderLeft: "2px solid currentColor" }}>
      {autor !== null ? <span className="block font-medium">{autor}</span> : null}
      <span className="block whitespace-pre-wrap">{citada === undefined ? "Mensagem anterior" : resumoDaMensagem(citada)}</span>
    </blockquote>
  );
}

/** O sinal de que o remetente externo editou a Mensagem; o `title` guarda o que ela dizia antes. `null` sem edição. */
export function marcaDeEditada(mensagem: Pick<Mensagem, "edicoesExternas">) {
  if (mensagem.edicoesExternas.length === 0) return null;
  const antes = mensagem.edicoesExternas.map((edicao) => edicao.conteudoAnterior ?? "").filter((texto) => texto !== "");
  return (
    <span data-editada="true" title={antes.length === 0 ? "Editada" : `Antes: ${antes.join(" → ")}`}>
      editada
    </span>
  );
}
