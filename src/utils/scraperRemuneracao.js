// INÍCIO — Scraper de remuneração oficial
import axios from "axios";
import cheerio from "cheerio";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";

export async function scrapeRemuneracao(deputadoId) {
  try {
    const jar = new CookieJar();
    const client = wrapper(axios.create({ jar }));

    const url = `https://www2.camara.leg.br/transparencia/remuneracao/remuneracao-de-parlamentares/parlamentares/${deputadoId}`;

    const { data: html } = await client.get(url, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });

    const $ = cheerio.load(html);

    // Pega a tabela principal
    const bruto = $("table tr:contains('SUBSÍDIO MENSAL') td:last-child").text().trim();
    const liquido = $("table tr:contains('TOTAL LÍQUIDO') td:last-child").text().trim();

    return {
      salarioBruto: bruto || null,
      salarioLiquido: liquido || null
    };

  } catch (err) {
    return {
      salarioBruto: null,
      salarioLiquido: null,
      error: err.message
    };
  }
}
// FIM