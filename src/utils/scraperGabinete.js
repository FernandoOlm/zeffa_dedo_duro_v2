// INÍCIO — Scraper do gabinete (assessores)
import axios from "axios";
import * as cheerio from "cheerio";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";

export async function scrapeGabinete(deputadoId) {
  try {
    const jar = new CookieJar();
    const client = wrapper(axios.create({ jar }));

    const url = `https://www2.camara.leg.br/transparencia/recursos-humanos/cargos-e-funcoes/cargos-em-comissao-e-funcoes-de-confianca/gabinete-parlamentar/${deputadoId}`;

    const { data: html } = await client.get(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    const $ = cheerio.load(html);

    const assessores = [];

    $("table tbody tr").each((_, el) => {
      const tds = $(el).find("td");

      assessores.push({
        nome: $(tds[0]).text().trim(),
        cargo: $(tds[1]).text().trim(),
        remuneracao: $(tds[2]).text().trim(),
        situacao: $(tds[3]).text().trim(),
      });
    });

    return assessores;
  } catch (err) {
    console.log("Erro no scraping de gabinete:", err.message);
    return [];
  }
}
// FIM