"use client";

/**
 * `/crm/caixa-de-entrada/configuracoes/canais/conectar` — a escolha do provedor
 * (Fase 8, D-06): quatro cartões, um por provedor, na ordem de
 * `PROVEDORES_DE_CANAL`. Cada um diz quando usar e leva à página de orientação
 * `…/conectar/<provedor>`. O Espaço pode ter vários Canais, inclusive dois
 * WhatsApps — um oficial e um não oficial.
 *
 * `usePodeNoCrm` só desabilita o botão com o motivo (B35); quem barra de
 * verdade é `POST /canais`.
 */

import Link from "next/link";
import { PROVEDORES, PROVEDORES_DE_CANAL } from "@n1/dominio/provedores-de-canal";
import { usePodeNoCrm } from "@/dados/crm/sessao";
import { CHANNEL_ICON } from "@/features/crm/conversation-thread";
import { ORIENTACAO_DO_PROVEDOR } from "@/features/crm/conectar-canal";
import { SeloDoProvedor } from "@/features/crm/selo-do-provedor";
import { Button, CorpoDeTela, PageHeader } from "@/features/shell/ui";

const DESTINO = "/crm/caixa-de-entrada/configuracoes";

export default function ConectarCanalPage() {
  const permissao = usePodeNoCrm("criar", "canal");

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        path={
          <>
            <Link href="/crm/caixa-de-entrada" className="hover:underline">
              Caixa de Entrada
            </Link>
            {" › "}
            <Link href={DESTINO} className="hover:underline">
              Configurações
            </Link>
          </>
        }
        title="Conectar Canal"
      />

      <CorpoDeTela>
        <p className="app-base mb-4" style={{ color: "var(--texto-2)" }}>
          Escolha o provedor da conta. O Espaço pode ter vários Canais, inclusive dois WhatsApps — um oficial e um não oficial.
        </p>
        <ul className="grade-solta sm:grid-cols-2">
          {PROVEDORES_DE_CANAL.map((provedor) => {
            const { tipo, rotulo } = PROVEDORES[provedor];
            const Icone = CHANNEL_ICON[tipo];
            return (
              <li key={provedor} className="item-solto flex h-full flex-col gap-2" data-bloco="true">
                <p className="flex items-start justify-between gap-2">
                  <span className="app-md flex items-center gap-2" style={{ color: "var(--texto)" }}>
                    <Icone className="size-[var(--icone-md)]" />
                    {rotulo}
                  </span>
                  <SeloDoProvedor canal={{ channelType: tipo, provider: provedor, relational: true }} />
                </p>
                <p className="app-meta flex-1">{ORIENTACAO_DO_PROVEDOR[provedor].quandoUsar}</p>
                <div>
                  {permissao === undefined ? (
                    <Link href={`${DESTINO}/canais/conectar/${provedor}`} className="btn btn-solido btn-sm alvo-toque">
                      Conectar
                    </Link>
                  ) : (
                    <Button variant="primary" size="sm" disabled disabledReason={permissao}>
                      Conectar
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </CorpoDeTela>
    </div>
  );
}
