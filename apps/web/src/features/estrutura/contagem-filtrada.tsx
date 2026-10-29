/**
 * A linha curta sob a `ViewBar` quando há filtro ativo (Fase 10, 2.1.5):
 * «Mostrando 3 de 12 Tarefas.». O plural segue o total (Y); na lente
 * financeira o substantivo é «conta»/«contas», como o `meta` do cabeçalho.
 * Nada depois do ponto: a explicação de que o filtro vale em todas as
 * Visualizações saiu da tela.
 */

export function textoDaContagem(x: number, y: number, financeira: boolean): string {
  const substantivo = financeira
    ? y === 1
      ? "conta"
      : "contas"
    : y === 1
      ? "Tarefa"
      : "Tarefas";
  return `Mostrando ${x} de ${y} ${substantivo}.`;
}

export function ContagemFiltrada({
  x,
  y,
  financeira,
}: {
  readonly x: number;
  readonly y: number;
  readonly financeira: boolean;
}) {
  return <p className="app-meta mt-2">{textoDaContagem(x, y, financeira)}</p>;
}
