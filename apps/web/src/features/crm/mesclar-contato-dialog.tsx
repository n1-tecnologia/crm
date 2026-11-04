"use client";

/**
 * "Mesclar com…" na ficha nova de Contato (3.2.2): o Contato da ficha é o
 * SOBREVIVENTE e o escolhido aqui é o ABSORVIDO. Chama `POST /contatos/:id/mesclar`
 * por `mesclarContatos` (`dados/crm/contatos.ts`); quem tem a regra é a api, que
 * recusa por 409 (`MESCLAGEM_RECUSADA`: o escolhido já está mesclado, na lixeira…)
 * e a frase dela aparece no próprio diálogo, que continua aberto.
 *
 * É a versão sobre a api do `merge-contacts-dialog.tsx` da ficha antiga, que lê o
 * store antigo e por isso não se reaproveita. Daquele ficam o aviso antes do ato e
 * a ideia de que o gesto precisa custar o que a consequência custa; mudam duas
 * coisas: o sobrevivente já está decidido (a ficha em que se está), e o outro
 * Contato é buscado na api (`SeletorDeRegistro`), nunca o próprio. A mesclagem é
 * irreversível: o absorvido fica `mesclado`, terminal e somente leitura, e abrir a
 * página dele leva ao sobrevivente (14-01).
 *
 * Todo texto vindo da api é renderizado como texto React (escapado).
 */

import { useState } from "react";
import type { ErroDeApi } from "@/dados/crm/cliente-crm";
import { mesclarContatos } from "@/dados/crm/contatos";
import { comoErroDeApi } from "@/features/crm/formulario-de-contato";
import { SeletorDeRegistro, type RegistroEscolhido } from "@/features/crm/seletor-de-registro";
import { ConfirmDialog, Field } from "@/features/shell/ui";

export function MesclarContatoDialog({
  contatoId,
  nome,
  onFechar,
  onMesclado,
}: {
  /** O sobrevivente: o Contato da ficha. */
  readonly contatoId: string;
  readonly nome: string;
  readonly onFechar: () => void;
  /** Chamado depois do 200, com o aviso de sucesso para a ficha mostrar. */
  readonly onMesclado: (aviso: string) => void;
}) {
  const [absorvido, setAbsorvido] = useState<RegistroEscolhido | null>(null);
  const [erro, setErro] = useState<ErroDeApi | null>(null);
  const [mesclando, setMesclando] = useState(false);

  const porQueNao = absorvido === null ? "Escolha o Contato a mesclar." : mesclando ? "Mesclando…" : undefined;

  const confirmar = async () => {
    if (absorvido === null) return;
    setErro(null);
    setMesclando(true);
    try {
      await mesclarContatos(contatoId, absorvido.id);
      onMesclado(`Contatos mesclados. Tudo de ${absorvido.nome} agora está em ${nome}.`);
      onFechar();
    } catch (falha) {
      setErro(comoErroDeApi(falha, "Não foi possível mesclar os Contatos. Tente de novo."));
      setMesclando(false);
    }
  };

  return (
    <ConfirmDialog
      open
      destructive
      title="Mesclar com…"
      description={`${nome} fica. O Contato escolhido é absorvido: passa a ser somente leitura, e quem abrir a página dele é levado para ${nome}.`}
      confirmLabel="Mesclar"
      {...(porQueNao ? { confirmDisabledReason: porQueNao } : {})}
      confirmCarregando={mesclando}
      onConfirm={() => void confirmar()}
      onCancel={onFechar}
    >
      <div className="grid gap-3">
        <Field label="Mesclar com" hint="Só Contatos ativos aparecem na busca.">
          {(id) => <SeletorDeRegistro id={id} recurso="contatos" rotulo="Buscar Contato a mesclar" valor={absorvido} onChange={setAbsorvido} excluirIds={[contatoId]} />}
        </Field>

        <p className="app-base rounded-[var(--r-controle)] px-3 py-2" style={{ background: "var(--aviso-lavado)", color: "var(--aviso)" }}>
          <strong>Não dá para desfazer.</strong> Identificadores, Conversas, Negócios, notas e Endereços do Contato escolhido passam para {nome}; os
          consentimentos são copiados; os vínculos com Empresas se juntam (onde os dois têm vínculo com a mesma Empresa, fica um só).
        </p>

        {erro ? (
          <p role="alert" className="app-base" style={{ color: "var(--erro)" }}>
            {erro.message}
          </p>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}
