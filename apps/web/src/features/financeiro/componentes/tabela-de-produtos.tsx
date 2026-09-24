"use client";

/**
 * A composição do UI-SPEC §"3 · Produtos": três colunas, duas editáveis
 * inline (D4-07) — a única escrita simples desta tela. Sem diálogo de
 * confirmação: é uma alíquota, reversível, de baixo risco (compare com Plano
 * de contas, onde a confirmação existe porque a consequência é outra: o
 * Agente).
 *
 * Grava no `blur`, nunca a cada tecla. O `TextInput` do barril não expõe
 * `onBlur` (só `value`/`onChange`/…) — o padrão já usado em
 * `features/shell/ficha.tsx` (`EditorDeTexto`/`EditorDeNumero`) resolve isso
 * embrulhando o campo num `<span onBlur={…}>`: o evento de blur do `<input>`
 * borbulha até o `span` ancestral. Não reusamos `EditorDeNumero` diretamente
 * porque ele converte para `Number` (perderia a vírgula decimal pt-BR do
 * valor, ex. "10,5") e não conhece o estado "salvando"/"reverter ao valor
 * confirmado" que esta tela exige (T-4-32).
 */

import { useState } from "react";
import type { Produto } from "../dados/produtos";
import { salvarAliquotas } from "../dados/acoes";
import { type Column, RecordList } from "@/features/shell/record-list";
import { CorpoDeTela, PageHeader, TextInput, Toast } from "@/features/shell/ui";
import { BotaoAtualizar } from "./botao-atualizar";

type CampoDeAliquota = "porcentagemProduto" | "porcentagemServico";

function CampoDeAliquota({
  produtoId,
  valorInicial,
  campo,
  aoResultado,
}: {
  readonly produtoId: string;
  readonly valorInicial: string | null;
  readonly campo: CampoDeAliquota;
  readonly aoResultado: (resultado: { readonly ok: boolean; readonly mensagem: string }) => void;
}) {
  const [confirmado, setConfirmado] = useState(valorInicial ?? "");
  const [valor, setValor] = useState(valorInicial ?? "");
  const [salvando, setSalvando] = useState(false);

  async function gravarSeMudou() {
    if (valor === confirmado) return; // blur sem mudança não dispara chamada nenhuma
    setSalvando(true);
    const resultado = await salvarAliquotas(produtoId, { [campo]: valor });
    setSalvando(false);
    if (resultado.ok) {
      setConfirmado(valor);
      aoResultado({ ok: true, mensagem: "Alíquota atualizada." });
    } else {
      setValor(confirmado); // nunca fica exibindo o valor que falhou — pareceria salvo
      aoResultado({ ok: false, mensagem: resultado.erro });
    }
  }

  return (
    <span className="block w-24" onBlur={gravarSeMudou}>
      <TextInput
        size="sm"
        type="number"
        value={valor}
        onChange={setValor}
        disabled={salvando}
        disabledReason="Salvando…"
      />
    </span>
  );
}

export function TabelaDeProdutos({ produtos, lidoEm }: { readonly produtos: readonly Produto[]; readonly lidoEm: string }) {
  const [toast, setToast] = useState<{ readonly tone: "success" | "error"; readonly texto: string } | null>(null);

  function aoResultado(resultado: { readonly ok: boolean; readonly mensagem: string }) {
    setToast({ tone: resultado.ok ? "success" : "error", texto: resultado.mensagem });
  }

  const colunas: ReadonlyArray<Column<Produto>> = [
    {
      key: "produto",
      label: "Produto",
      render: (produto) => (
        <div>
          <p className="app-meta">{produto.idProduto}</p>
          <p className="app-base">{produto.nomeProduto ?? "—"}</p>
        </div>
      ),
    },
    {
      key: "porcentagemServico",
      label: "% Serviço",
      render: (produto) => (
        <CampoDeAliquota
          produtoId={produto.id}
          valorInicial={produto.porcentagemServico}
          campo="porcentagemServico"
          aoResultado={aoResultado}
        />
      ),
    },
    {
      key: "porcentagemProduto",
      label: "% Produto",
      render: (produto) => (
        <CampoDeAliquota
          produtoId={produto.id}
          valorInicial={produto.porcentagemProduto}
          campo="porcentagemProduto"
          aoResultado={aoResultado}
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Produtos" meta={`${produtos.length} de ${produtos.length}`} actions={<BotaoAtualizar lidoEm={lidoEm} />} />
      <CorpoDeTela>
        {toast ? (
          <Toast tone={toast.tone} onDismiss={() => setToast(null)}>
            {toast.texto}
          </Toast>
        ) : null}
        <RecordList
          items={produtos}
          columns={colunas}
          emptyTitle="Nenhum produto cadastrado."
          emptyHint="Produtos aparecem aqui quando cadastrados na emissão de notas."
        />
      </CorpoDeTela>
    </>
  );
}
