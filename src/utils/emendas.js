// INÍCIO — Emendas parlamentares (Senado / SigaBrasil)
import axios from "axios";

export async function pegaEmendas(codParlamentar) {
  const url = `https://legis.senado.leg.br/dadosabertos/emenda/autor/${codParlamentar}`;

  try {
    const { data } = await axios.get(url);

    const emendas = data?.EmendaParlamentar?.Emendas || [];

    return emendas.map(e => ({
      numero: e?.Emenda?.Numero,
      ano: e?.Emenda?.Ano,
      funcao: e?.Emenda?.Funcao,
      subfuncao: e?.Emenda?.Subfuncao,
      localidade: e?.Emenda?.Localidade,
      valorAutorizado: Number(e?.Emenda?.ValorAutorizado || 0),
      valorPago: Number(e?.Emenda?.ValorPago || 0)
    }));

  } catch (err) {
    return [];
  }
}
// FIM