// INÍCIO — utils/sancoes.js

import fetch from "node-fetch";

// Função genérica para consultar listas de sanções
async function consulta(api, cnpj, key) {
  const url = `https://api.portaldatransparencia.gov.br/api-de-dados/${api}?cnpjSancionado=${cnpj}&pagina=1`;

  try {
    const resp = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "chave-api-dados": key,
      },
    });

    if (!resp.ok) return false;

    const json = await resp.json();
    return json.length > 0;
  } catch (e) {
    console.log(`Erro ${api}:`, e.message);
    return false;
  }
}

export async function verificaSancoes(cnpj, key) {
  return {
    ceis: await consulta("ceis", cnpj, key),
    cnep: await consulta("cnep", cnpj, key),
    ceaf: await consulta("ceaf", cnpj, key),
    cepim: await consulta("cepim", cnpj, key),
  };
}

// FIM — utils/sancoes.js