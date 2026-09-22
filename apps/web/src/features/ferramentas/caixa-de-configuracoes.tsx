"use client";

/**
 * A CAIXA DE CONFIGURAÇÕES: uma linha por assunto — o Selo, o título, a
 * frase que explica, o Toggle à direita — no painel único que o diálogo de
 * criação de contêiner desenhou. Serve às Configurações do Grupo (×4), da
 * Comunidade (×2) e à Captação. Um Toggle desligado diz por quê no `title`
 * da linha (§11).
 */

import { useId } from "react";
import type { LucideIcon } from "lucide-react";
import { Selo } from "@/features/estrutura/icone-de-tipo";
import { Toggle } from "@/features/shell/ui";

export interface LinhaDeConfiguracao {
  readonly chave: string;
  readonly titulo: string;
  readonly dica: string;
  readonly icone: LucideIcon;
  readonly ligado: boolean;
  readonly onChange?: (ligado: boolean) => void;
  /** Por que não muda — vira o `title` e desliga o Toggle. */
  readonly motivo?: string;
}

export function CaixaDeConfiguracoes({ rotulo, linhas, ajuda }: { readonly rotulo?: string; readonly linhas: ReadonlyArray<LinhaDeConfiguracao>; readonly ajuda?: string }) {
  return (
    <div className="grid gap-1.5">
      {rotulo ? <span className="rotulo">{rotulo}</span> : null}
      <div className="painel">
        {linhas.map((linha, i) => (
          <Linha key={linha.chave} linha={linha} primeira={i === 0} />
        ))}
      </div>
      {ajuda ? <p className="ajuda">{ajuda}</p> : null}
    </div>
  );
}

function Linha({ linha, primeira }: { readonly linha: LinhaDeConfiguracao; readonly primeira: boolean }) {
  const labelId = useId();
  const hintId = useId();
  const desligado = linha.onChange === undefined || linha.motivo !== undefined;
  return (
    <div className="flex items-center gap-3 px-3 py-2.5" style={primeira ? undefined : { borderTop: "1px solid var(--linha)" }} title={linha.motivo}>
      <Selo icone={linha.icone} cor={linha.ligado ? "var(--acento)" : "var(--texto-2)"} lavado={linha.ligado ? "var(--acento-lavado)" : "var(--superficie-2)"} />
      <span className="min-w-0 flex-1">
        <span id={labelId} className="app-base block" style={{ color: "var(--texto)" }}>
          {linha.titulo}
        </span>
        <span id={hintId} className="app-sm block" style={{ color: "var(--texto-3)" }}>
          {linha.motivo ?? linha.dica}
        </span>
      </span>
      <Toggle checked={linha.ligado} onChange={(v) => linha.onChange?.(v)} labelledBy={labelId} describedBy={hintId} disabled={desligado} />
    </div>
  );
}
