// INÍCIO — utils/emendas.js (CGU OFICIAL)

import fetch from "node-fetch";

export async function pegaEmendas(nome, key) {
  try {
    const url = `https://api.portaldatransparencia.gov.br/api-de-dados/emendas?nomeAutor=${encodeURIComponent(
      nome
    )}&pagina=1`;

    const resp = await fetch(url, {
      headers: {
        Accept: "application/json",
        "chave-api-dados": key,
      },
    });

    if (!resp.ok) {
      console.log("Erro emendas CGU:", resp.status);
      return [];
    }

    const dados = await resp.json();

    return dados.map(e => ({
      codigo: e.codigoEmenda,
      ano: e.ano,
      tipo: e.tipoEmenda,
      numero: e.numeroEmenda,
      autorizado: parseFloat(e.valorEmpenhado?.replace(/\./g, "").replace(",", ".")) || 0,
      liquidado: parseFloat(e.valorLiquidado?.replace(/\./g, "").replace(",", ".")) || 0,
      pago: parseFloat(e.valorPago?.replace(/\./g, "").replace(",", ".")) || 0,
      funcao: e.funcao,
      subfuncao: e.subfuncao,
      localidade: e.localidadeDoGasto,
    }));
  } catch (e) {
    console.log("Erro emendas CGU:", e.message);
    return [];
  }
}

// FIM — utils/emendas.js (CGU OFICIAL)