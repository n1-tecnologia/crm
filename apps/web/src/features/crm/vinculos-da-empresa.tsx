"use client";

/**
 * Os Contatos de uma Empresa e o admin que ela nunca fica sem (D-08).
 *
 * Vigentes com cargo editável, selo e `Toggle` de admin, "Encerrar" e, no
 * admin, "Trocar admin"; "Adicionar Contato" (busca na api, sem os já
 * vinculados) com cargo e admin; os encerrados numa lista recolhida com a data
 * de `fim`.
 *
 * Rebaixar ou encerrar o último admin é recusado ANTES de ir à api, com a
 * mesma `validarRetiradaDeAdmin` que o endpoint aplica; a recusa aparece com o
 * botão "Trocar admin". Se a tela estava velha e a api recusar com
 * `ULTIMO_ADMIN`, o resultado é o mesmo. Trocar admin é uma chamada só
 * (`POST /empresas/:id/trocar-admin`): o novo admin entra e o antigo é
 * rebaixado na mesma transação.
 *
 * Quem barra de verdade é o backend (D-14): `motivo` só desliga os botões e
 * diz por quê. Todo texto vindo da api é texto React (T-07-30).
 */

import Link from "next/link";
import { useId, useState } from "react";
import {
  adminsVigentes,
  nomeDeExibicaoDaEmpresa,
  validarRetiradaDeAdmin,
  type EmpresaDetalhada,
  type VinculoDaEmpresa,
} from "@n1/dominio/crm/empresas";
import { ErroDeApi } from "@/dados/crm/cliente-crm";
import { editarVinculo, encerrarVinculo, trocarAdminDaEmpresa, vincularContatoAEmpresa } from "@/dados/crm/empresas";
import { MensagemDeRecusa } from "@/features/crm/ciclo-de-vida";
import { comoErroDeApi } from "@/features/crm/formulario-de-contato";
import { SeletorDeRegistro, type RegistroEscolhido } from "@/features/crm/seletor-de-registro";
import { Button, ConfirmDialog, EmptyState, Field, Painel, Pilula, Section, Select, TextInput, Toggle } from "@/features/shell/ui";
import { useFormat } from "@/features/shell/use-format";

type Executar = (acao: () => Promise<unknown>, sucesso: string, vinculoId?: string) => Promise<boolean>;

const ROTULO_DO_ESTADO_DO_CONTATO = { arquivado: "arquivado", na_lixeira: "na Lixeira" } as const;

function RotuloDoContato({ vinculo }: { readonly vinculo: VinculoDaEmpresa }) {
  return (
    <>
      <Link href={`/crm/contatos/${vinculo.contatoId}`} className="app-base underline" style={{ color: "var(--texto)" }}>
        {vinculo.contatoNome}
      </Link>
      {vinculo.contatoEstado !== "ativo" ? <Pilula>{ROTULO_DO_ESTADO_DO_CONTATO[vinculo.contatoEstado]}</Pilula> : null}
    </>
  );
}

function LinhaDeVinculoVigente({
  vinculo,
  editavel,
  motivo,
  executar,
  empresaId,
  onAlternarAdmin,
  onEncerrar,
  onTrocarAdmin,
}: {
  readonly vinculo: VinculoDaEmpresa;
  readonly editavel: boolean;
  readonly motivo: string | undefined;
  readonly executar: Executar;
  readonly empresaId: string;
  readonly onAlternarAdmin: (vinculo: VinculoDaEmpresa) => void;
  readonly onEncerrar: (vinculo: VinculoDaEmpresa) => void;
  readonly onTrocarAdmin: (vinculo: VinculoDaEmpresa) => void;
}) {
  const fmt = useFormat();
  const idDoCargo = useId();
  const idDoAdmin = useId();
  const [cargo, setCargo] = useState(vinculo.cargo ?? "");
  const desligado = motivo ? { disabled: true, disabledReason: motivo } : {};
  const sujo = cargo.trim() !== (vinculo.cargo ?? "");

  return (
    <li className="flex flex-wrap items-center gap-2 py-2" style={{ borderBottom: "1px solid var(--linha-sutil)" }}>
      <RotuloDoContato vinculo={vinculo} />
      {vinculo.admin ? <Pilula tom="info">admin</Pilula> : null}
      {editavel ? (
        <>
          <span className="min-w-32 flex-1">
            <label htmlFor={idDoCargo} className="sr-only">{`Cargo de ${vinculo.contatoNome}`}</label>
            <TextInput id={idDoCargo} size="sm" value={cargo} onChange={setCargo} placeholder="Cargo" {...(motivo ? { disabled: true, disabledReason: motivo } : {})} />
          </span>
          {sujo ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void executar(() => editarVinculo(empresaId, vinculo.id, { cargo: cargo.trim() }), "Cargo salvo.")}
              {...desligado}
            >
              Salvar cargo
            </Button>
          ) : null}
          <span className="flex items-center gap-1">
            <span id={idDoAdmin} className="app-meta">
              Admin
            </span>
            <Toggle checked={vinculo.admin} onChange={() => onAlternarAdmin(vinculo)} labelledBy={idDoAdmin} disabled={motivo !== undefined} />
          </span>
          {vinculo.admin ? (
            <Button size="sm" variant="ghost" onClick={() => onTrocarAdmin(vinculo)} {...desligado}>
              Trocar admin
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" onClick={() => onEncerrar(vinculo)} {...desligado}>
            Encerrar
          </Button>
        </>
      ) : (
        <>
          {vinculo.cargo ? <span className="app-base">{vinculo.cargo}</span> : null}
          <span className="app-meta">{vinculo.inicio !== null ? `desde ${fmt.civilDate(vinculo.inicio)}` : null}</span>
        </>
      )}
    </li>
  );
}

/** "Trocar admin" (D-08): o novo admin entra e o atual é rebaixado numa transação só. */
function DialogoTrocarAdmin({
  detalhado,
  vinculoAtualId,
  onFechar,
  avisar,
}: {
  readonly detalhado: EmpresaDetalhada;
  readonly vinculoAtualId: string;
  readonly onFechar: () => void;
  readonly avisar: (texto: string) => void;
}) {
  const { empresa, vinculos } = detalhado;
  const admins = adminsVigentes(vinculos);
  const [saindoId, setSaindoId] = useState(vinculoAtualId);
  const [novo, setNovo] = useState<RegistroEscolhido | null>(null);
  const [cargo, setCargo] = useState("");
  const [recusa, setRecusa] = useState<ErroDeApi | null>(null);
  const [enviando, setEnviando] = useState(false);

  const saindo = vinculos.find((vinculo) => vinculo.id === saindoId);
  const nomeDeQuemSai = saindo?.contatoNome ?? "o admin atual";
  const motivo = enviando ? "Gravando a troca…" : novo === null ? "Escolha o novo admin." : undefined;

  const trocar = async () => {
    if (novo === null) return;
    setRecusa(null);
    setEnviando(true);
    try {
      await trocarAdminDaEmpresa(empresa.id, {
        vinculoAtualId: saindoId,
        novoAdmin: { contatoId: novo.id, ...(cargo.trim() !== "" ? { cargo: cargo.trim() } : {}) },
      });
      avisar(`${novo.nome} agora administra ${nomeDeExibicaoDaEmpresa(empresa)}.`);
      onFechar();
    } catch (falha) {
      setRecusa(comoErroDeApi(falha, "Não foi possível trocar o admin. Tente de novo."));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <ConfirmDialog
      open
      wide
      title={`Trocar o admin de ${nomeDeExibicaoDaEmpresa(empresa)}`}
      description={`Uma Empresa nunca fica sem Contato admin. Escolha o novo admin antes de retirar ${nomeDeQuemSai}.`}
      confirmLabel="Trocar admin"
      {...(motivo ? { confirmDisabledReason: motivo } : {})}
      onConfirm={() => void trocar()}
      onCancel={onFechar}
    >
      <MensagemDeRecusa erro={recusa} onFechar={() => setRecusa(null)} />
      <div className="grid gap-3 sm:grid-cols-2">
        {admins.length > 1 ? (
          <div className="sm:col-span-2">
            <Field label="Admin que sai">
              {(id) => (
                <Select
                  id={id}
                  value={saindoId}
                  options={admins.map((admin) => ({ value: admin.id, label: admin.contatoNome }))}
                  onChange={setSaindoId}
                />
              )}
            </Field>
          </div>
        ) : null}
        <div className="sm:col-span-2">
          <Field label="Buscar novo admin">
            {(id) => (
              <SeletorDeRegistro
                id={id}
                recurso="contatos"
                rotulo="Buscar novo admin"
                valor={novo}
                onChange={setNovo}
                excluirIds={saindo ? [saindo.contatoId] : []}
              />
            )}
          </Field>
        </div>
        <Field label="Cargo do novo admin">{(id) => <TextInput id={id} value={cargo} onChange={setCargo} />}</Field>
      </div>
    </ConfirmDialog>
  );
}

export function VinculosDaEmpresa({
  detalhado,
  podeEditar,
  motivo,
  avisar,
}: {
  readonly detalhado: EmpresaDetalhada;
  /** Falso quando a Empresa não está ativa: tudo vira leitura. */
  readonly podeEditar: boolean;
  /** A frase de recusa do Papel (D-14): desliga os botões e diz por quê. */
  readonly motivo: string | undefined;
  readonly avisar: (texto: string) => void;
}) {
  const { empresa, vinculos } = detalhado;
  const fmt = useFormat();
  const [recusa, setRecusa] = useState<ErroDeApi | null>(null);
  const [vinculoDaRecusa, setVinculoDaRecusa] = useState<string | null>(null);
  const [trocando, setTrocando] = useState<string | null>(null);
  const [adicionando, setAdicionando] = useState(false);
  const [contato, setContato] = useState<RegistroEscolhido | null>(null);
  const [cargoNovo, setCargoNovo] = useState("");
  const [adminNovo, setAdminNovo] = useState(false);
  const idDoAdminNovo = useId();

  const vigentes = vinculos.filter((vinculo) => vinculo.fim === null);
  const encerrados = vinculos.filter((vinculo) => vinculo.fim !== null);
  const desligado = motivo ? { disabled: true, disabledReason: motivo } : {};

  /** Executa uma gravação: limpa a recusa, avisa o sucesso, ou mostra a recusa. `ULTIMO_ADMIN` oferece Trocar admin. */
  const executar: Executar = async (acao, sucesso, vinculoId) => {
    setRecusa(null);
    try {
      await acao();
      avisar(sucesso);
      return true;
    } catch (falha) {
      const erro = comoErroDeApi(falha, "Não foi possível concluir a ação. Tente de novo.");
      setRecusa(erro);
      setVinculoDaRecusa(erro.codigo === "ULTIMO_ADMIN" ? (vinculoId ?? null) : null);
      return false;
    }
  };

  /** D-08, igual ao endpoint: retirar o último admin é recusado aqui, sem ir à api. */
  const podeRetirar = (vinculo: VinculoDaEmpresa): boolean => {
    const validacao = validarRetiradaDeAdmin(vinculos, vinculo.id);
    if (validacao.ok) return true;
    setRecusa(new ErroDeApi(409, validacao.error, { codigo: "ULTIMO_ADMIN", campo: "admin" }));
    setVinculoDaRecusa(vinculo.id);
    return false;
  };

  const alternarAdmin = (vinculo: VinculoDaEmpresa) => {
    if (vinculo.admin && !podeRetirar(vinculo)) return;
    void executar(
      () => editarVinculo(empresa.id, vinculo.id, { admin: !vinculo.admin }),
      vinculo.admin ? `${vinculo.contatoNome} não é mais admin.` : `${vinculo.contatoNome} agora é admin.`,
      vinculo.id,
    );
  };

  const encerrar = (vinculo: VinculoDaEmpresa) => {
    if (vinculo.admin && !podeRetirar(vinculo)) return;
    void executar(() => encerrarVinculo(empresa.id, vinculo.id), `Vínculo com ${vinculo.contatoNome} encerrado.`, vinculo.id);
  };

  const adicionar = async () => {
    if (contato === null) return;
    const deuCerto = await executar(
      () =>
        vincularContatoAEmpresa(empresa.id, {
          contatoId: contato.id,
          ...(cargoNovo.trim() !== "" ? { cargo: cargoNovo.trim() } : {}),
          admin: adminNovo,
        }),
      `${contato.nome} vinculado.`,
    );
    if (deuCerto) {
      setContato(null);
      setCargoNovo("");
      setAdminNovo(false);
      setAdicionando(false);
    }
  };

  const acaoDaRecusa =
    recusa?.codigo === "ULTIMO_ADMIN" && podeEditar ? (
      <Button size="sm" variant="primary" onClick={() => setTrocando(vinculoDaRecusa ?? adminsVigentes(vinculos)[0]?.id ?? null)} {...desligado}>
        Trocar admin
      </Button>
    ) : undefined;

  return (
    <Section
      title="Contatos"
      count={vigentes.length}
      action={
        podeEditar ? (
          <Button size="sm" onClick={() => setAdicionando((aberto) => !aberto)} {...desligado}>
            Adicionar Contato
          </Button>
        ) : undefined
      }
    >
      <MensagemDeRecusa erro={recusa} onFechar={() => setRecusa(null)} {...(acaoDaRecusa ? { acao: acaoDaRecusa } : {})} />

      {adicionando && podeEditar ? (
        <Painel className="mb-3 grid gap-3 p-4 sm:grid-cols-[1fr_12rem_auto_auto] sm:items-end">
          <Field label="Buscar Contato a vincular">
            {(id) => (
              <SeletorDeRegistro
                id={id}
                recurso="contatos"
                rotulo="Buscar Contato a vincular"
                valor={contato}
                onChange={setContato}
                excluirIds={vigentes.map((vinculo) => vinculo.contatoId)}
              />
            )}
          </Field>
          <Field label="Cargo do novo vínculo">{(id) => <TextInput id={id} value={cargoNovo} onChange={setCargoNovo} />}</Field>
          <span className="flex items-center gap-1 pb-2">
            <span id={idDoAdminNovo} className="app-meta">
              Admin
            </span>
            <Toggle checked={adminNovo} onChange={setAdminNovo} labelledBy={idDoAdminNovo} />
          </span>
          <Button
            variant="primary"
            onClick={() => void adicionar()}
            {...(contato === null ? { disabled: true, disabledReason: "Escolha o Contato." } : {})}
          >
            Adicionar
          </Button>
        </Painel>
      ) : null}

      {vinculos.length === 0 ? (
        <EmptyState compact title="Esta Empresa não tem Contatos vinculados." hint="Adicione o primeiro com “Adicionar Contato”." />
      ) : (
        <Painel className="px-4">
          <ul>
            {vigentes.map((vinculo) => (
              <LinhaDeVinculoVigente
                key={`${vinculo.id}-${vinculo.cargo ?? ""}-${vinculo.admin}`}
                vinculo={vinculo}
                editavel={podeEditar}
                motivo={motivo}
                executar={executar}
                empresaId={empresa.id}
                onAlternarAdmin={alternarAdmin}
                onEncerrar={encerrar}
                onTrocarAdmin={(alvo) => setTrocando(alvo.id)}
              />
            ))}
          </ul>
          {encerrados.length > 0 ? (
            <details className="py-2">
              <summary className="app-meta cursor-pointer">{`Vínculos encerrados (${encerrados.length})`}</summary>
              <ul>
                {encerrados.map((vinculo) => (
                  <li key={vinculo.id} className="flex flex-wrap items-center gap-2 py-2">
                    <RotuloDoContato vinculo={vinculo} />
                    {vinculo.cargo ? <span className="app-base">{vinculo.cargo}</span> : null}
                    {vinculo.admin ? <Pilula tom="info">admin</Pilula> : null}
                    <span className="app-meta">{vinculo.fim !== null ? `encerrado em ${fmt.civilDate(vinculo.fim)}` : null}</span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </Painel>
      )}

      {trocando !== null ? (
        <DialogoTrocarAdmin detalhado={detalhado} vinculoAtualId={trocando} onFechar={() => setTrocando(null)} avisar={avisar} />
      ) : null}
    </Section>
  );
}
