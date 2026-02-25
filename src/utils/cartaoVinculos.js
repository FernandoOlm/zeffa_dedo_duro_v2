// INÍCIO — Relacionamento com cartão corporativo
import axios from "axios";

export async function consultaCartaoPorCNPJ(cnpj, apiKey) {
  try {
    const url = `https://api.portaldatransparencia.gov.br/api-de-dados/cartoes?cpfCnpjFavorecido=${cnpj}&pagina=1`;

    const { data } = await axios.get(url, {
      headers: {
        "chave-api-dados": apiKey,
        Accept: "application/json"
      }
    });

    return data || [];

  } catch (err) {
    return [];
  }
}
// FIM