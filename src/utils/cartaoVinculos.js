// INÍCIO — utils/cartaoVinculos.js

import fetch from "node-fetch";

export async function consultaCartaoPorCNPJ(cnpj, key) {
  try {
    const url = `https://api.portaldatransparencia.gov.br/api-de-dados/cartoes?cpfCnpjFavorecido=${cnpj}&pagina=1`;

    const resp = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "chave-api-dados": key
      }
    });

    if (!resp.ok) return [];

    const data = await resp.json();
    return data || [];
  } catch (e) {
    console.log("Erro cartão:", e.message);
    return [];
  }
}

// FIM — utils/cartaoVinculos.js