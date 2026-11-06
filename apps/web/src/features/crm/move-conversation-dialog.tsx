"use client";

/**
 * D12 — Mover Conversa para outro Contato, aberto por `?mover-conversa=`.
 *
 * Fase 15 (3.2.5): o destino se busca na api (`SeletorDeRegistro`, `GET /contatos?q=`,
 * só Contatos ativos e sem o atual) e o gesto é `POST /conversas/:id/mover`. A
 * regra é a da api: Conversa na lixeira não muda de Contato, o destino precisa
 * estar ativo, e o Canal e as Mensagens ficam onde estão — o diálogo mostra a
 * recusa dela.
 *
 * A colisão que a regra proíbe é dita DEPOIS da recusa, com o nome do Canal e a
 * Conversa que colide (a api devolve a Conversa em `bloqueios.conversas`):
 * RN-CXE-11 rejeita mover para um Contato que já tenha Conversa não resolvida no
 * mesmo Canal, salvo resolver a existente no mesmo ato — e essa saída aparece como
 * uma escolha explícita, nunca como efeito colateral.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { ErroDeApi } from "@/dados/crm/cliente-crm";
import { moverConversa } from "@/dados/crm/conversas";
import { SeletorDeRegistro, type RegistroEscolhido } from "@/features/crm/seletor-de-registro";
import { ConfirmDialog, Field } from "@/features/shell/ui";

export const MOVE_CONVERSATION_PARAM = "mover-conversa";

export function useMoveConversationDialog(): {
  readonly moving: boolean;
  readonly openMoveConversation: () => void;
  readonly closeMoveConversation: () => void;
} {
  const router = useRouter();
  const query = useSearchParams();
  const pathname = typeof window === "undefined" ? "" : window.location.pathname;

  return {
    moving: query.has(MOVE_CONVERSATION_PARAM),
    openMoveConversation: () => {
      const next = new URLSearchParams(query.toString());
      next.set(MOVE_CONVERSATION_PARAM, "");
      router.replace(`${pathname}?${next}`, { scroll: false });
    },
    closeMoveConversation: () => {
      const next = new URLSearchParams(query.toString());
      next.delete(MOVE_CONVERSATION_PARAM);
      router.replace(next.size > 0 ? `${pathname}?${next}` : pathname, { scroll: false });
    },
  };
}

/** A Conversa que já ocupa o par (Contato de destino, Canal), como a api a devolve na recusa 409. */
interface ConversaQueColide {
  readonly id: string;
  readonly titulo: string;
}

export function MoveConversationDialog({
  conversationId,
  contatoAtualId,
  canalNome,
  open,
  onClose,
  onDone,
}: {
  readonly conversationId: string;
  /** O Contato de hoje: não é destino possível. */
  readonly contatoAtualId: string;
  /** O nome do Canal da Conversa, que não muda. */
  readonly canalNome: string;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onDone: (message: string) => void;
}) {
  const [destino, setDestino] = useState<RegistroEscolhido | null>(null);
  const [colide, setColide] = useState<ConversaQueColide | null>(null);
  const [resolverExistente, setResolverExistente] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [movendo, setMovendo] = useState(false);
  // Um clique por vez: o segundo, antes da resposta do primeiro, não grava de novo.
  const emVoo = useRef(false);

  const motivoParaNaoMover = movendo
    ? "Movendo…"
    : destino === null
      ? "Escolha o Contato de destino."
      : colide && !resolverExistente
        ? "Marque resolver a Conversa existente, ou escolha outro Contato."
        : undefined;

  const reset = () => {
    setDestino(null);
    setColide(null);
    setResolverExistente(false);
    setErro(null);
  };

  const confirm = async () => {
    if (destino === null || emVoo.current) return;
    emVoo.current = true;
    setErro(null);
    setMovendo(true);
    try {
      await moverConversa(conversationId, destino.id, resolverExistente ? true : undefined);
      onDone(`Conversa movida para ${destino.nome}.${colide ? " A Conversa que colidia foi resolvida." : ""}`);
      reset();
      onClose();
    } catch (falha) {
      const colisao = falha instanceof ErroDeApi && falha.codigo === "CONVERSA_JA_ABERTA" ? falha.bloqueios?.conversas?.itens[0] : undefined;
      if (colisao) {
        setColide(colisao);
        setResolverExistente(false);
      } else {
        setErro(falha instanceof Error ? falha.message : "Não foi possível mover a Conversa.");
      }
    } finally {
      emVoo.current = false;
      setMovendo(false);
    }
  };

  return (
    <ConfirmDialog
      open={open}
      title="Mover Conversa para outro Contato"
      description={`O Canal ${canalNome} não muda, e nenhuma Mensagem é movida: só a quem a Conversa pertence.`}
      confirmLabel="Mover"
      {...(motivoParaNaoMover ? { confirmDisabledReason: motivoParaNaoMover } : {})}
      confirmCarregando={movendo}
      onConfirm={() => void confirm()}
      onCancel={() => {
        reset();
        onClose();
      }}
    >
      <div className="grid gap-3">
        <Field label="Contato de destino" hint="Só Contatos ativos aparecem na busca.">
          {(id) => (
            <SeletorDeRegistro
              id={id}
              recurso="contatos"
              rotulo="Buscar Contato de destino"
              valor={destino}
              onChange={(escolhido) => {
                setDestino(escolhido);
                setColide(null);
                setResolverExistente(false);
                setErro(null);
              }}
              excluirIds={[contatoAtualId]}
            />
          )}
        </Field>

        {colide ? (
          <div className="rounded-[var(--r-controle)] px-3 py-2" style={{ background: "var(--aviso-lavado)", color: "var(--aviso)" }}>
            <p className="app-base">
              Este Contato já tem a Conversa <em>{colide.titulo}</em> não resolvida em {canalNome}. Duas Conversas abertas do mesmo Contato no mesmo
              Canal quebram o roteamento da próxima Mensagem recebida.
            </p>
            <label className="app-base mt-2 flex items-start gap-2">
              <input
                type="checkbox"
                checked={resolverExistente}
                onChange={(event) => setResolverExistente(event.target.checked)}
                className="mt-0.5 size-4 accent-[var(--acento)]"
              />
              <span>
                Resolver <em>{colide.titulo}</em> no mesmo ato
              </span>
            </label>
          </div>
        ) : null}

        {erro ? (
          <p role="alert" className="app-base" style={{ color: "var(--erro)" }}>
            {erro}
          </p>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}
