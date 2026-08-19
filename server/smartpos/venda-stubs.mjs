/**
 * Stubs alinhados a untSrvMetodosGerais.pas (venda).
 * Implementação completa vem depois — endpoints já reservados.
 */

function notReady(name) {
  return {
    ok: false,
    stub: true,
    code: 501,
    message: `Rotina de venda "${name}" ainda não portada (untSrvMetodosGerais.pas).`,
  }
}

export const vendaStubs = {
  echo: (value) => ({ ok: true, value: String(value ?? '') }),
  terminal: () => notReady('terminal'),
  configuraterminal: () => notReady('configuraterminal'),
  updateGravaProduto: () => notReady('UpdateGravaProduto'),
  updateDinheiro: () => notReady('UpdateDinheiro'),
  updateCartao: () => notReady('UpdateCartao'),
  updateCancelaCartao: () => notReady('UpdateCancelaCartao'),
  consultaProduto: () => notReady('ConsultaProduto'),
  cliente: () => notReady('Cliente'),
  confirmacupom: () => notReady('confirmacupom'),
}
