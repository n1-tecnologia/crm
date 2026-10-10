"use client";

/**
 * A ficha de Funil (D-04): as Etapas à esquerda, os atributos à direita, e o
 * ciclo de vida de D-06 com as recusas de D-07 visíveis.
 *
 * Recebe o `FunilDetalhado` pronto (a página lê por `useFunil`) e toda
 * gravação passa pelas mutações de `dados/crm/funis.ts`, que revalidam
 * `/funis` — o dado novo volta pela mesma prop.
 *
 * D-07: excluir ou arquivar um Funil com Negócios é recusado pela api; a recusa
 * traz a contagem e o botão "Migrar Negócios", que abre o diálogo
 * (`?migrar-negocios=`). Remover uma Etapa com Negócios abre o remapeamento
 * (`?remapear-etapa=`).
 *
 * D-14: tudo que escreve só fica habilitado para Administrador e Proprietário
 * (`usePodeNoCrm(…, "funil")`); os outros Papéis leem a configuração inteira,
 * com os botões desabilitados e a linha de apoio sob o cabeçalho. Quem barra de
 * verdade é a api.
 *
 * D-02: Requisitos de Etapa e Transições permitidas não aparecem — a 007 não os
 * guarda. Todo texto vindo da api é renderizado como texto React (escapado).
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import { validarNomeDeFunil, validarPrivacidade, type FunilDetalhado } from "@n1/dominio/crm/funis";
import type { ErroDeApi } from "@/dados/crm/cliente-crm";
import {
  arquivarFunil,
  definirFunilPadrao,
  editarFunil,
  enviarFunilParaLixeira,
  excluirFunilPermanentemente,
  restaurarFunil,
} from "@/dados/crm/funis";
import { usePodeNoCrm } from "@/dados/crm/sessao";
import { AcoesDeCicloDeVida, MensagemDeRecusa, seloDoEstado } from "@/features/crm/ciclo-de-vida";
import { EtapasDoFunil } from "@/features/crm/etapas-do-funil";
import { comoErroDeApi } from "@/features/crm/formulario-de-contato";
import { InterruptorRotulado, NOTA_DE_PRIVADO } from "@/features/crm/formulario-de-funil";
import { MigrateFunnelDialog, useMigrateFunnelDialog } from "@/features/crm/migrate-funnel-dialog";
import { RemoveStageDialog, useRemoveStageDialog } from "@/features/crm/remove-stage-dialog";
import { Button, CorpoDeTela, Field, PageHeader, Pilula, RecordPanel, StateSeal, TextArea, TextInput, Toast } from "@/features/shell/ui";

/**
 * Executa uma gravação: limpa os avisos, mostra o sucesso, ou a recusa. Devolve se deu certo.
 * `tratar` pode assumir a recusa (devolvendo `true`) para mostrá-la num campo em vez do aviso de erro.
 */
type Agir = (acao: () => Promise<unknown>, sucesso?: string, tratar?: (erro: ErroDeApi) => boolean) => Promise<boolean>;

const MOTIVO_DE_FUNIL_INATIVO = "Restaure o Funil antes de editar.";
const NOTA_DE_PADRAO_PRIVADO = "O Funil padrão não pode ser privado. Defina outro Funil como padrão antes.";

/** Nome e Descrição: rascunho local, gravado por "Salvar alterações". Remonta quando o dado do servidor muda. */
function PainelDoFunil({
  detalhado,
  podeEditar,
  motivo,
  agir,
}: {
  readonly detalhado: FunilDetalhado;
  readonly podeEditar: boolean;
  readonly motivo: string | undefined;
  readonly agir: Agir;
}) {
  const { funil } = detalhado;
  const [nome, setNome] = useState(funil.nome);
  const [descricao, setDescricao] = useState(funil.descricao ?? "");
  const [erro, setErro] = useState<string | undefined>(undefined);
  const sujo = nome.trim() !== funil.nome || descricao.trim() !== (funil.descricao ?? "");
  const invalido = validarNomeDeFunil(nome);
  const porQueNao = motivo ?? (sujo ? (invalido.ok ? undefined : invalido.error) : "Nada para salvar.");
  const privadoTravado = funil.padrao && !funil.privado;
  const desligado = !podeEditar ? { disabled: true, ...(motivo ? { disabledReason: motivo } : {}) } : {};

  const salvar = async () => {
    setErro(undefined);
    // Só o que mudou: a api edita por campo presente.
    const edicao = {
      ...(nome.trim() !== funil.nome ? { nome: nome.trim() } : {}),
      ...(descricao.trim() !== (funil.descricao ?? "") ? { descricao: descricao.trim() } : {}),
    };
    await agir(() => editarFunil(funil.id, edicao), "Alterações salvas.", (recusa) => {
      // Nome repetido é erro do campo; o resto segue para o aviso de recusa.
      if (recusa.codigo !== "FUNIL_NOME_EM_USO") return false;
      setErro(recusa.message);
      return true;
    });
  };

  return (
    <RecordPanel title="Funil">
      <div className="grid gap-3">
        <Field label="Nome" {...(erro ? { error: erro } : {})}>
          {(id) => <TextInput id={id} value={nome} onChange={setNome} invalid={erro !== undefined} {...desligado} />}
        </Field>
        <Field label="Descrição">
          {(id) => <TextArea id={id} value={descricao} onChange={setDescricao} {...desligado} />}
        </Field>
        {podeEditar ? (
          <div>
            <Button
              variant="primary"
              onClick={() => void salvar()}
              {...(porQueNao ? { disabled: true, disabledReason: porQueNao } : {})}
            >
              Salvar alterações
            </Button>
          </div>
        ) : null}
        <InterruptorRotulado
          rotulo="Privado"
          nota={privadoTravado ? NOTA_DE_PADRAO_PRIVADO : NOTA_DE_PRIVADO}
          checked={funil.privado}
          disabled={!podeEditar || privadoTravado}
          onChange={(privado) => {
            const regra = validarPrivacidade(funil, privado);
            if (!regra.ok) return;
            void agir(() => editarFunil(funil.id, { privado }));
          }}
        />
      </div>
    </RecordPanel>
  );
}

export function FichaDeFunil({ funilId, detalhado }: { readonly funilId: string; readonly detalhado: FunilDetalhado }) {
  const { funil, etapas } = detalhado;
  const router = useRouter();
  const { removingStageId, openRemoveStage, closeRemoveStage } = useRemoveStageDialog();
  const { migrating, openMigrate, closeMigrate } = useMigrateFunnelDialog();
  const motivoDePapel = usePodeNoCrm("editar", "funil");
  const [aviso, setAviso] = useState<string | null>(null);
  const [recusa, setRecusa] = useState<ErroDeApi | null>(null);

  const ativo = funil.estado === "ativo";
  const somenteLeitura = motivoDePapel !== undefined;
  const motivoDeEdicao = motivoDePapel ?? (ativo ? undefined : MOTIVO_DE_FUNIL_INATIVO);
  const totalDeNegocios = etapas.reduce((soma, etapa) => soma + etapa.negocios.total, 0);

  const agir: Agir = async (acao, sucesso, tratar) => {
    setRecusa(null);
    setAviso(null);
    try {
      await acao();
      if (sucesso) setAviso(sucesso);
      return true;
    } catch (falha) {
      const erro = comoErroDeApi(falha, "Não foi possível concluir a ação. Tente de novo.");
      if (!tratar?.(erro)) setRecusa(erro);
      return false;
    }
  };

  const saidaDaRecusa =
    recusa?.codigo === "FUNIL_COM_NEGOCIOS" || recusa?.codigo === "FUNIL_COM_NEGOCIOS_ABERTOS" ? (
      <Button size="sm" onClick={openMigrate}>
        Migrar Negócios
      </Button>
    ) : undefined;

  const desligado = motivoDePapel ? { disabled: true, disabledReason: motivoDePapel } : {};
  const motivoDeMigrar = motivoDePapel ?? (totalDeNegocios === 0 ? "Este Funil não tem Negócios." : undefined);
  const podeSerPadrao = ativo && !funil.privado && !funil.padrao;

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={funil.nome}
        seal={
          <span className="flex items-center gap-2">
            <StateSeal state={seloDoEstado(funil.estado)} />
            {funil.padrao ? <Pilula tom="info">Funil padrão</Pilula> : null}
          </span>
        }
        meta={`${etapas.length} ${etapas.length === 1 ? "Etapa" : "Etapas"} · ${totalDeNegocios} ${totalDeNegocios === 1 ? "Negócio" : "Negócios"}`}
        details={
          somenteLeitura ? <span className="app-meta">Só Administrador e Proprietário alteram Funis e Etapas.</span> : undefined
        }
        actions={
          <span className="flex items-center gap-2">
            {podeSerPadrao ? (
              <Button
                variant="secondary"
                onClick={() => void agir(() => definirFunilPadrao(funilId), `${funil.nome} é o Funil padrão.`)}
                {...desligado}
              >
                Definir como padrão
              </Button>
            ) : null}
            <Button
              onClick={openMigrate}
              {...(motivoDeMigrar ? { disabled: true, disabledReason: motivoDeMigrar } : {})}
            >
              Migrar Negócios
            </Button>
            <AcoesDeCicloDeVida
              estado={funil.estado}
              rotulo={funil.nome}
              motivoSemPermissao={motivoDePapel}
              onArquivar={() => void agir(() => arquivarFunil(funilId), `${funil.nome} arquivado.`)}
              onRestaurar={() => void agir(() => restaurarFunil(funilId), `${funil.nome} restaurado.`)}
              onEnviarParaLixeira={() => void agir(() => enviarFunilParaLixeira(funilId), `${funil.nome} foi para a Lixeira.`)}
              onExcluirPermanentemente={async () => {
                if (await agir(() => excluirFunilPermanentemente(funilId))) router.push("/crm/funis");
              }}
            />
          </span>
        }
      />

      <RemoveStageDialog
        funnelId={funil.id}
        stageId={removingStageId}
        onClose={closeRemoveStage}
        onDone={setAviso}
      />
      <MigrateFunnelDialog funnelId={funil.id} open={migrating} onClose={closeMigrate} onDone={setAviso} />

      <CorpoDeTela>
        {aviso ? (
          <Toast tone="success" onDismiss={() => setAviso(null)}>
            {aviso}
          </Toast>
        ) : null}
        <MensagemDeRecusa erro={recusa} onFechar={() => setRecusa(null)} {...(saidaDaRecusa ? { acao: saidaDaRecusa } : {})} />

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <EtapasDoFunil
            detalhado={detalhado}
            podeEditar={motivoDeEdicao === undefined}
            motivo={motivoDeEdicao}
            onRemoverComNegocios={openRemoveStage}
            onAviso={setAviso}
          />

          <div className="grid min-w-0 content-start gap-3">
            <PainelDoFunil
              key={`funil-${funil.nome}|${funil.descricao ?? ""}`}
              detalhado={detalhado}
              podeEditar={motivoDeEdicao === undefined}
              motivo={motivoDeEdicao}
              agir={agir}
            />
            <RecordPanel title="Regras de encerramento">
              <div className="grid gap-1">
                <InterruptorRotulado
                  rotulo="Exigir Motivo de Perda ao marcar como perdido"
                  checked={funil.exigeMotivoPerda}
                  disabled={motivoDeEdicao !== undefined}
                  onChange={(exigeMotivoPerda) => void agir(() => editarFunil(funilId, { exigeMotivoPerda }))}
                />
                <InterruptorRotulado
                  rotulo="Exigir valor ao marcar como ganho"
                  checked={funil.exigeValorGanho}
                  disabled={motivoDeEdicao !== undefined}
                  onChange={(exigeValorGanho) => void agir(() => editarFunil(funilId, { exigeValorGanho }))}
                />
              </div>
            </RecordPanel>
          </div>
        </div>
      </CorpoDeTela>
    </div>
  );
}
