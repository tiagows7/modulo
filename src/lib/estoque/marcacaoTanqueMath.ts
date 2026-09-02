/** marcacao_final teórico = inicial + entradas − saídas */
export function calcMarcacaoFinal(
  inicial: number,
  entradas: number,
  saidas: number,
) {
  return Number((inicial + entradas - saidas).toFixed(3));
}

/** variação = inicial + entradas − saídas − final */
export function calcVariacaoMarcacao(
  inicial: number,
  entradas: number,
  saidas: number,
  final: number,
) {
  return Number((inicial + entradas - saidas - final).toFixed(3));
}
