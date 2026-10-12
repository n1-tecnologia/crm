/**
 * Os selos do Canal nas telas da Caixa de Entrada (Fase 8, D-04, D-08, D-12):
 *
 *   - `SeloDoProvedor`: por onde a conta conversa — "oficial", "não oficial",
 *     "IMAP/SMTP" (a tabela `PROVEDORES` do domínio). Nada para Canal sem
 *     provedor (LinkedIn, Chat do site).
 *   - `SeloDeOrigem`: "cadastrado" para o Canal gravado em `plataforma.canais`
 *     (008) e "demo" para o do seed, que some na unificação (D-12).
 *   - `MarcaDeConexaoSimulada`: "conexão simulada" enquanto a conexão veio do
 *     botão "Simular conexão" e não de um provedor real (D-08).
 *
 * Cor só por tokens (`Pilula`). Componente de apresentação puro: sem estado e
 * sem `"use client"`, para servir Server e Client Components.
 */

import { PROVEDORES, provedorDoCanal } from "@n1/dominio/provedores-de-canal";
import type { Channel } from "@n1/dominio/types";
import { Pilula, type TomPilula } from "@/features/shell/ui";

type CanalComSelos = Pick<Channel, "channelType" | "provider" | "relational" | "simulatedConnection">;

const TOM_DO_SELO: Readonly<Record<string, TomPilula>> = {
  oficial: "info",
  "não oficial": "aviso",
};

export function SeloDoProvedor({ canal }: { readonly canal: CanalComSelos }) {
  const provedor = provedorDoCanal(canal);
  if (provedor === undefined) return null;
  const { selo } = PROVEDORES[provedor];
  return <Pilula tom={TOM_DO_SELO[selo] ?? "neutro"}>{selo}</Pilula>;
}

export function SeloDeOrigem({ canal }: { readonly canal: CanalComSelos }) {
  return canal.relational ? (
    <Pilula tom="acento" title="Canal gravado na tabela própria (008).">
      cadastrado
    </Pilula>
  ) : (
    <Pilula tom="neutro" title="Canal de demonstração do seed; sai na unificação.">
      demo
    </Pilula>
  );
}

export function MarcaDeConexaoSimulada({ canal }: { readonly canal: CanalComSelos }) {
  if (canal.simulatedConnection !== true) return null;
  return (
    <Pilula tom="aviso" title="A conexão foi simulada: nenhuma Mensagem sai de verdade.">
      conexão simulada
    </Pilula>
  );
}
