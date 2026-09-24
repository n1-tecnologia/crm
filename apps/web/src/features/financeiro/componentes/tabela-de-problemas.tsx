"use client";

/**
 * `RecordList` sem `hrefOf` (nenhuma linha do Financeiro clica): Severidade,
 * Id, Título/descrição, Onde, Idade, e uma coluna final com o único item de
 * ação — "Ver detalhes técnicos" — atrás de um `SidePanel`, porque o campo
 * técnico é detalhe de depuração, não algo que o Financeiro lê no dia a dia
 * (UI-SPEC §7).
 */

import { useState } from "react";
import { type Column, RecordList } from "@/features/shell/record-list";
import { ActionMenu, Icone, Pilula, RecordPanel, RecordRow, SidePanel, type TomPilula } from "@/features/shell/ui";
import { Wrench } from "lucide-react";
import { useFormat } from "@/features/shell/use-format";
import type { LinhaDeProblema } from "../dados/problemas";

/** `info` nunca é "acento" — severidade é vocabulário semântico, não decoração (UI-SPEC §Color). Desconhecido cai em `neutro`, nunca em branco. */
const TOM_DA_SEVERIDADE: Readonly<Record<string, TomPilula>> = {
  sucesso: "sucesso",
  aviso: "aviso",
  info: "neutro",
};

function tomDeSeveridade(severidade: string): TomPilula {
  return TOM_DA_SEVERIDADE[severidade] ?? "neutro";
}

export function TabelaDeProblemas({ linhas }: { readonly linhas: ReadonlyArray<LinhaDeProblema> }) {
  const fmt = useFormat();
  const [aberto, setAberto] = useState<LinhaDeProblema | null>(null);

  const columns: ReadonlyArray<Column<LinhaDeProblema>> = [
    {
      key: "severidade",
      label: "Severidade",
      render: (item) => <Pilula tom={tomDeSeveridade(item.severidade)}>{item.severidade}</Pilula>,
    },
    {
      key: "id",
      label: "Id",
      className: "app-meta",
      render: (item) => `SP-${item.id}`,
    },
    {
      key: "titulo",
      label: "Título",
      render: (item) => (
        <div>
          <p className="app-base" style={{ color: "var(--texto-1)" }}>
            {item.titulo}
          </p>
          <p className="app-meta truncate">{item.descricao}</p>
        </div>
      ),
    },
    {
      key: "onde",
      label: "Onde",
      render: (item) => item.onde,
    },
    {
      key: "idade",
      label: "Idade",
      render: (item) => fmt.relative(item.idade),
    },
    {
      key: "acoes",
      label: "",
      className: "text-right",
      render: (item) => (
        <ActionMenu items={[{ label: "Ver detalhes técnicos", onSelect: () => setAberto(item) }]} />
      ),
    },
  ];

  return (
    <>
      <RecordList
        items={linhas}
        columns={columns}
        emptyTitle="Nenhum problema em aberto."
        emptyHint="Quando algo precisar de atenção, aparece aqui."
      />
      <SidePanel title="Detalhes técnicos" open={aberto !== null} onClose={() => setAberto(null)}>
        {aberto ? (
          <RecordPanel title="Campos técnicos" icon={<Icone de={Wrench} tamanho="sm" />}>
            {Object.entries(aberto.tecnico).map(([rotulo, valor]) => (
              <RecordRow key={rotulo} label={rotulo}>
                {valor}
              </RecordRow>
            ))}
          </RecordPanel>
        ) : null}
      </SidePanel>
    </>
  );
}
