/**
 * Os selos do Canal nas telas da Caixa de Entrada (Fase 8, D-04, D-08, D-12):
 *
 *   - `SeloDoProvedor`: por onde a conta conversa — "oficial", "não oficial",
 *     "IMAP/SMTP" (a tabela `PROVEDORES` do domínio). Todo Canal das tabelas
 *     tem provedor.
 *   - `SeloDeOrigem`: "cadastrado" para o Canal gravado em `plataforma.canais`
 *     (008) e "demo" para o do seed, que some na unificação (D-12).
 *   - `MarcaDeConexaoSimulada`: "conexão simulada" enquanto a conexão veio do
 *     botão "Simular conexão" e não de um provedor real (D-08).
 *
 * Cor só por tokens (`Pilula`). Componente de apresentação puro: sem estado e
 * sem `"use client"`, para servir Server e Client Components.
 */

import type { Canal } from "@n1/dominio/crm/canais";
import { PROVEDORES } from "@n1/dominio/provedores-de-canal";
import { Pilula, type TomPilula } from "@/features/shell/ui";

/**
 * O que os selos leem do Canal das tabelas (`@n1/dominio/crm/canais`). `relational`
 * só distingue o Canal cadastrado do de demonstração do seed, que saiu do app
 * (15-12): quem tem um `Canal` em mãos é sempre "cadastrado".
 */
type CanalComSelos = Pick<Canal, "tipo" | "provedor"> & {
  readonly conexaoSimulada?: boolean;
  readonly relational?: boolean;
};

const TOM_DO_SELO: Readonly<Record<string, TomPilula>> = {
  oficial: "info",
  "não oficial": "aviso",
};

export function SeloDoProvedor({ canal }: { readonly canal: CanalComSelos }) {
  const { selo } = PROVEDORES[canal.provedor];
  return <Pilula tom={TOM_DO_SELO[selo] ?? "neutro"}>{selo}</Pilula>;
}

export function SeloDeOrigem({ canal }: { readonly canal: CanalComSelos }) {
  return canal.relational !== false ? (
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
  if (canal.conexaoSimulada !== true) return null;
  return (
    <Pilula tom="aviso" title="A conexão foi simulada: nenhuma Mensagem sai de verdade.">
      conexão simulada
    </Pilula>
  );
}
