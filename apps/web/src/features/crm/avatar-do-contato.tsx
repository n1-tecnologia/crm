"use client";

import { nomeDeExibicaoDoContato } from "@n1/dominio/crm/contatos";

/**
 * O rosto do Contato no modelo novo (`@n1/dominio/crm/contatos`): as iniciais no
 * gradiente da marca, o mesmo desenho de `ContactAvatar` (que lê o Contato
 * antigo). Recebe só o nome — sem ler o store — para as telas trocarem o avatar
 * sem ler o Contato antigo (o `contact-card.tsx` que o lia saiu na 15-32). Não há arquivo de foto no modelo novo, então
 * as iniciais são sempre o rosto: a mesma pessoa não aparece de dois jeitos.
 */
export function AvatarDoContato({
  nome,
  sobrenome,
  tamanho = "normal",
}: {
  readonly nome?: string | null;
  readonly sobrenome?: string | null;
  readonly tamanho?: "normal" | "grande";
}) {
  const exibicao = nomeDeExibicaoDoContato({ nome, sobrenome });
  const iniciais = exibicao
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? "")
    .join("");

  // O gradiente da marca é roxo ESCURO: a tinta sobre ele é a mesma do botão sólido.
  return (
    <span
      title={exibicao}
      className={`grid shrink-0 place-items-center rounded-full font-semibold ${
        tamanho === "grande" ? "ed-subtitulo size-16" : "app-xs size-7"
      }`}
      style={{ background: "var(--degrade-marca)", color: "var(--sobre-degrade)" }}
    >
      <span aria-hidden="true">{iniciais || "?"}</span>
      <span className="sr-only">{exibicao}</span>
    </span>
  );
}
