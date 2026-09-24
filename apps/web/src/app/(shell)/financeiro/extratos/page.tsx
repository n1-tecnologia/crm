/**
 * Extratos do Marcos (D4-13) — a única das oito telas que não faz leitura:
 * é formulário de envio, não lista. Sem `MolduraDeLeitura` (não há o que
 * ler), sem `meta` no `PageHeader` (não há contagem) — a única falha
 * possível aqui é a do ENVIO, tratada dentro de `FormularioDeExtrato`.
 */

import { FormularioDeExtrato } from "@/features/financeiro/componentes/formulario-de-extrato";
import { CorpoDeTela, PageHeader } from "@/features/shell/ui";

export default function ExtratosPage() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Extratos do Marcos" />
      <CorpoDeTela>
        <FormularioDeExtrato />
      </CorpoDeTela>
    </div>
  );
}
