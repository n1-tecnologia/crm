"use client";

/**
 * OS PEDIDOS DE ENTRADA (24, 7.2): só existem em Grupo que aprova entradas.
 * Aprovar gera a Participação com a Origem que o provedor informou; recusar
 * guarda um Motivo do catálogo. Os decididos ficam na lista com o estado —
 * o provedor expira os pendentes quando a Configuração muda (RN-GRP-16).
 */

import Link from "next/link";
import { useState } from "react";
import { useData, useRun } from "@/dados/store";
import { aprovarPedidoDeEntrada, receberPedidoDeEntrada, recusarPedidoDeEntrada } from "@n1/dominio/operations/ferramentas/grupos";
import { recusaExternaNoGrupo } from "@n1/dominio/operations/ferramentas/permissoes";
import { contactDisplayName } from "@n1/dominio/derive";
import type { Grupo, PedidoDeEntrada } from "@n1/dominio/types/ferramentas";
import type { Report } from "@/features/shell/ficha";
import { useFormat } from "@/features/shell/use-format";
import { ActorAvatar, Button, ConfirmDialog, EmptyState, Field, Pilula, ReguaDeSecao, Select, TextInput } from "@/features/shell/ui";
import { ESTADO_DO_PEDIDO_LABEL, ESTADO_DO_PEDIDO_TOM, ORIGEM_DA_PARTICIPACAO_LABEL } from "./rotulos";

export function SecaoDePedidosDeEntrada({ grupo, report }: { readonly grupo: Grupo; readonly report: Report }) {
  const state = useData((data) => data);
  const run = useRun();
  const fmt = useFormat();
  const [recusando, setRecusando] = useState<PedidoDeEntrada | null>(null);
  const [motivoId, setMotivoId] = useState("");
  const [simulando, setSimulando] = useState(false);
  const [numero, setNumero] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const externa = recusaExternaNoGrupo(state, grupo, "administrador");
  const pendentes = grupo.pedidosDeEntrada.filter((p) => p.estado === "pendente");
  const lista = [...grupo.pedidosDeEntrada].sort((a, b) => (a.estado === "pendente" ? 0 : 1) - (b.estado === "pendente" ? 0 : 1) || b.solicitadoEm.localeCompare(a.solicitadoEm));
  const motivos = state.catalog.filter((c) => c.kind === "motivoPerda" && c.lifecycle === "ativo");

  if (!grupo.configuracoes.administradoresAprovamEntrada && grupo.pedidosDeEntrada.length === 0) return null;

  return (
    <section>
      <ReguaDeSecao
        rotulo="Pedidos de Entrada"
        contagem={pendentes.length}
        acao={
          grupo.configuracoes.administradoresAprovamEntrada ? (
            <Button size="sm" variant="ghost" onClick={() => setSimulando(true)}>
              Simular pedido
            </Button>
          ) : undefined
        }
      />
      {!grupo.configuracoes.administradoresAprovamEntrada ? (
        <p className="app-sm mb-2" style={{ color: "var(--texto-3)" }}>
          O Grupo deixou de aprovar entradas: os pendentes expiram na próxima Sincronização (RN-GRP-16).
        </p>
      ) : null}
      {lista.length === 0 ? (
        <EmptyState compact title="Nenhum Pedido de Entrada." hint="Quem entra pelo link fica aqui até um administrador decidir." />
      ) : (
        <ul className="pilha-solta">
          {lista.map((p) => {
            const contato = state.contacts.find((c) => c.id === p.contactId);
            const nome = contato ? contactDisplayName(contato) : p.identificadorExternoDoSolicitante;
            const decisor = p.decididoPor?.kind === "member" ? state.members.find((m) => m.id === p.decididoPor?.id)?.displayName : undefined;
            return (
              <li key={p.id} className="item-solto">
                <ActorAvatar kind="member" name={nome} />
                <span className="min-w-0 flex-1">
                  <span className="app-md flex items-center gap-1.5" style={{ color: "var(--texto)" }}>
                    {contato ? (
                      <Link href={`/crm/contatos/${contato.id}`} className="hover:underline">
                        {nome}
                      </Link>
                    ) : (
                      nome
                    )}
                    <Pilula tom={ESTADO_DO_PEDIDO_TOM[p.estado]}>{ESTADO_DO_PEDIDO_LABEL[p.estado]}</Pilula>
                  </span>
                  <span className="app-meta block truncate">
                    {fmt.relative(p.solicitadoEm)}
                    {p.origemInformada ? ` · ${ORIGEM_DA_PARTICIPACAO_LABEL[p.origemInformada]}` : ""}
                    {decisor ? ` · ${p.estado} por ${decisor}` : ""}
                    {p.motivoDaRecusaId ? ` · ${state.catalog.find((c) => c.id === p.motivoDaRecusaId)?.name ?? ""}` : ""}
                  </span>
                </span>
                {p.estado === "pendente" ? (
                  <>
                    <Button size="sm" variant="primary" onClick={() => report(run((data, me) => aprovarPedidoDeEntrada(data, me, grupo.id, p.id)), `${nome} entrou no Grupo.`)} disabled={externa !== undefined} {...(externa ? { disabledReason: externa } : {})}>
                      Aprovar
                    </Button>
                    <Button size="sm" onClick={() => setRecusando(p)} disabled={externa !== undefined} {...(externa ? { disabledReason: externa } : {})}>
                      Recusar
                    </Button>
                  </>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={recusando !== null}
        title="Recusar Pedido de Entrada"
        description="A pessoa não entra; o Pedido fica na história com o motivo."
        confirmLabel="Recusar"
        destructive
        onConfirm={() => {
          if (!recusando) return;
          report(run((data, me) => recusarPedidoDeEntrada(data, me, grupo.id, recusando.id, motivoId || undefined)), "Pedido recusado.");
          setRecusando(null);
          setMotivoId("");
        }}
        onCancel={() => setRecusando(null)}
      >
        <Field label="Motivo" hint="Do catálogo de Motivos do Espaço de Trabalho. Opcional.">
          {(id) => <Select id={id} value={motivoId} onChange={setMotivoId} placeholder="Sem motivo" options={[{ value: "", label: "Sem motivo" }, ...motivos.map((m) => ({ value: m.id, label: m.name }))]} />}
        </Field>
      </ConfirmDialog>

      <ConfirmDialog
        open={simulando}
        title="Simular um Pedido de Entrada"
        description="O que o provedor faria quando alguém toca no link de um Grupo que aprova entradas: o Pedido chega com o número, e o Contato é resolvido ou criado (RN-GRP-10)."
        confirmLabel="Receber Pedido"
        {...(numero.replace(/\D/g, "").length < 10 ? { confirmDisabledReason: "Informe um número com DDD." } : {})}
        onConfirm={() => {
          const r = run((data) => receberPedidoDeEntrada(data, grupo.id, numero.replace(/\D/g, "")));
          if (!r.ok) {
            setErro(r.error);
            return;
          }
          report(r, "Pedido de Entrada recebido.");
          setSimulando(false);
          setNumero("");
          setErro(null);
        }}
        onCancel={() => {
          setSimulando(false);
          setErro(null);
        }}
      >
        <div className="grid gap-3">
          <Field label="Número de WhatsApp" required>
            {(id) => <TextInput id={id} value={numero} onChange={setNumero} placeholder="5511 9…" />}
          </Field>
          {erro ? (
            <p role="alert" className="app-base" style={{ color: "var(--erro)" }}>
              {erro}
            </p>
          ) : null}
        </div>
      </ConfirmDialog>
    </section>
  );
}
