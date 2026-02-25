// INÍCIO — utils/cartaoVinculos.js (FULL)

import fetch from "node-fetch";

export async function consultaCartaoPorCNPJ(cnpj, key) {
  try {
    const url = `https://api.portaldatransparencia.gov.br/api-de-dados/cartoes?cpfCnpjFavorecido=${cnpj}&pagina=1`;

    const resp = await fetch(url, {
      headers: {
        Accept: "application/json",
        "chave-api-dados": key,
      },
    });

    if (!resp.ok) return [];

    const data = await resp.json();
    if (!Array.isArray(data)) return [];

    // Ajustar retorno para ter nome + valor numérico
    return data.map(t => ({
      nome:
        t.estabelecimento?.nome ||
        t.estabelecimento?.razaoSocialReceita ||
        "Fornecedor não identificado",

      cnpj:
        t.estabelecimento?.cnpjFormatado ||
        t.cpfCnpjFavorecido ||
        cnpj,

      valor:
        Number(
          String(t.valorTransacao || "0").replace(".", "").replace(",", ".")
        ) || 0,

      data: t.dataTransacao || null,
    }));
  } catch (e) {
    console.log("Erro cartão:", e.message);
    return [];
  }
}

// FIM — utils/cartaoVinculos.js (FULL)