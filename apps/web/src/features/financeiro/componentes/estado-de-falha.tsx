"use client";

/**
 * O terceiro estado (D4-15) — o que não existe hoje no painel antigo, que
 * cai silenciosamente em lista vazia quando o `automation/` recusa. Ecoa
 * deliberadamente a voz do card "Servidor indisponível" de
 * `app/(shell)/layout.tsx`: mesma frase, escopo menor (uma leitura, não o
 * app inteiro).
 *
 * `EstadoDeFalha` e `EmptyState` NUNCA aparecem juntos: ou a leitura falhou
 * (este componente) ou ela respondeu e a lista está mesmo vazia
 * (`EmptyState`) — `MolduraDeLeitura` é o único lugar que escolhe entre os
 * dois, e escolhe sempre um só.
 */

import { AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button, Icone, Painel } from "@/features/shell/ui";

export function EstadoDeFalha({ aoTentarDeNovo }: { readonly aoTentarDeNovo: () => void }) {
  return (
    <Painel solido className="flex flex-col items-center gap-3 p-8 text-center">
      <Icone de={AlertTriangle} tamanho="lg" style={{ color: "var(--erro)" }} />
      <p className="app-md" style={{ color: "var(--texto)" }}>
        Não consegui falar com o backend financeiro.
      </p>
      <p className="app-meta" style={{ maxWidth: "28rem" }}>
        A leitura não respondeu — pode ser instabilidade de rede ou o serviço fora do ar. Tente
        atualizar; se continuar falhando, avise o time técnico.
      </p>
      <Button variant="secondary" onClick={aoTentarDeNovo}>
        Atualizar
      </Button>
    </Painel>
  );
}

/**
 * `MolduraDeLeitura` (Server Component) não pode passar `aoTentarDeNovo` como
 * prop de `EstadoDeFalha`: funções não atravessam o limite servidor/cliente
 * (só Server Actions atravessam, e `router.refresh()` não é uma). Este
 * wrapper client resolve `useRouter()` aqui dentro e repassa para
 * `EstadoDeFalha` como uma chamada cliente→cliente comum — a moldura só
 * renderiza `<TentarDeNovo />`, sem prop nenhuma.
 */
export function TentarDeNovo() {
  const router = useRouter();
  return <EstadoDeFalha aoTentarDeNovo={() => router.refresh()} />;
}
