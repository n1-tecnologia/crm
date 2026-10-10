"use client";

/**
 * T13 — Contatos, lidos da api (D-04, traçador do 07-01).
 *
 * A lista vem de `GET /contatos` (SWR + `chamarCrm` com `Authorization:
 * Bearer`), não mais do store em memória do modelo antigo. A chave começa com
 * `/contatos` para `invalidarCrm("/contatos")` alcançá-la depois de uma
 * gravação.
 *
 * Saíram desta tela, de propósito:
 *   - o painel de Suspeitas de Duplicidade e a mesclagem (D-02): derivam do
 *     modelo antigo e voltam quando a mesclagem for reescrita sobre a 007;
 *   - o botão "Importar Contatos" (D-15): grava no modelo antigo;
 *   - o `CreateRecordDialog` antigo: a criação nova usa `POST /contatos`.
 *
 * Novo Contato: o diálogo daqui tem Nome e Sobrenome, os campos que o corpo de
 * `POST /contatos` aceita no 07-01 (o 07-03 alarga o corpo e o 07-06 move a
 * criação para `features/crm/formulario-de-contato.tsx`). `validarContato` do
 * domínio roda antes do envio — a mesma regra que o endpoint aplica.
 *
 * A ficha `/crm/contatos/[id]` continua a do modelo antigo até o 07-06; abrir
 * por aqui um Contato criado pela api cai no "não encontrado" dela.
 */

import { useState } from "react";
import useSWR from "swr";
import {
  nomeDeExibicaoDoContato,
  validarContato,
  type ContatoDetalhado,
  type ContatoResumo,
} from "@n1/dominio/crm/contatos";
import { chamarCrm, ErroDeApi, invalidarCrm } from "@/dados/crm/cliente-crm";
import { useData } from "@/dados/store";
import { useCreateRecordDialog } from "@/features/crm/create-record-dialog";
import {
  Button,
  ConfirmDialog,
  CorpoDeTela,
  EmptyState,
  EsqueletoDeLinhas,
  Field,
  PageHeader,
  StateSeal,
  TextInput,
  Toast,
} from "@/features/shell/ui";
import { RecordList } from "@/features/shell/record-list";

const CHAVE_DA_LISTA = "/contatos?estado=ativo&limite=50&deslocamento=0";

interface RespostaDaLista {
  readonly ok: true;
  readonly itens: ContatoResumo[];
  readonly total: number;
}

/** O `StateSeal` conhece `naLixeira`; a api fala `na_lixeira`. */
function seloDoEstado(estado: ContatoResumo["estado"]): string {
  return estado === "na_lixeira" ? "naLixeira" : estado;
}

export default function ContatosPage() {
  const membros = useData((data) => data.members);
  const { data, error, isLoading } = useSWR(CHAVE_DA_LISTA, (chave: string) => chamarCrm<RespostaDaLista>(chave));
  const { creating, openCreate, closeCreate } = useCreateRecordDialog("contato");
  const [nome, setNome] = useState("");
  const [sobrenome, setSobrenome] = useState("");
  const [erroDoNome, setErroDoNome] = useState<string | undefined>(undefined);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<{ readonly tom: "success" | "error"; readonly texto: string } | null>(null);

  const itens = data?.itens ?? [];
  const total = data?.total ?? 0;

  const limpar = () => {
    setNome("");
    setSobrenome("");
    setErroDoNome(undefined);
  };

  const cancelar = () => {
    limpar();
    closeCreate();
  };

  const criar = async () => {
    // A mesma regra do endpoint (INV-CON-01), sem ida ao servidor.
    const validacao = validarContato({ nome });
    if (!validacao.ok) {
      setErroDoNome(validacao.error);
      return;
    }
    setErroDoNome(undefined);
    setEnviando(true);
    try {
      const corpo = {
        ...(nome.trim() ? { nome: nome.trim() } : {}),
        ...(sobrenome.trim() ? { sobrenome: sobrenome.trim() } : {}),
      };
      const resposta = await chamarCrm<{ ok: true; dados: ContatoDetalhado }>("/contatos", { method: "POST", corpo });
      await invalidarCrm("/contatos");
      limpar();
      closeCreate();
      setAviso({ tom: "success", texto: `${nomeDeExibicaoDoContato(resposta.dados.contato)} criado.` });
    } catch (falha) {
      // Diálogo aberto, campos preenchidos: a pessoa corrige e tenta de novo.
      setAviso({ tom: "error", texto: falha instanceof ErroDeApi ? falha.message : "Não foi possível criar o Contato." });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Contatos" meta={`${total} Contatos`} actions={<Button onClick={openCreate}>Novo Contato</Button>} />

      <ConfirmDialog
        open={creating}
        title="Novo Contato"
        description="Nome ou Identificador — um dos dois basta, e sem nenhum dos dois o Contato não é ninguém."
        confirmLabel="Criar"
        {...(enviando ? { confirmDisabledReason: "Gravando o Contato…" } : {})}
        onConfirm={() => void criar()}
        onCancel={cancelar}
      >
        <div className="grid gap-3">
          <Field label="Nome" {...(erroDoNome ? { error: erroDoNome } : {})}>
            {(id) => <TextInput id={id} value={nome} onChange={setNome} invalid={erroDoNome !== undefined} />}
          </Field>
          <Field label="Sobrenome">{(id) => <TextInput id={id} value={sobrenome} onChange={setSobrenome} />}</Field>
        </div>
      </ConfirmDialog>

      <CorpoDeTela semRespiro>
        {aviso ? (
          <Toast tone={aviso.tom} onDismiss={() => setAviso(null)}>
            {aviso.texto}
          </Toast>
        ) : null}
        {error ? (
          <EmptyState
            title="Não foi possível carregar os Contatos."
            hint={error instanceof ErroDeApi ? error.message : "Tente de novo em instantes."}
          />
        ) : isLoading ? (
          <EsqueletoDeLinhas quantidade={6} />
        ) : (
          <RecordList
            items={itens}
            hrefOf={(item) => `/crm/contatos/${item.id}`}
            emptyTitle="Nenhum Contato ainda."
            emptyHint="Contatos também são criados automaticamente quando uma Mensagem chega por um Canal."
            columns={[
              { key: "nome", label: "Nome de exibição", render: (item) => <span className="truncate">{item.nomeDeExibicao}</span> },
              { key: "email", label: "E-mail principal", render: (item) => item.emailPrincipal ?? "—" },
              { key: "telefone", label: "Telefone principal", render: (item) => item.telefonePrincipal ?? "—" },
              {
                key: "proprietario",
                label: "Proprietário",
                render: (item) => membros.find((m) => m.id === item.proprietarioId)?.displayName ?? "—",
              },
              { key: "estado", label: "Estado", render: (item) => <StateSeal state={seloDoEstado(item.estado)} /> },
            ]}
          />
        )}
      </CorpoDeTela>
    </div>
  );
}
