// INÍCIO — Scraper completo do gabinete
import axios from "axios";
import * as cheerio from "cheerio";

export async function scrapeGabinete(deputadoId) {
  try {
    const url = `https://www.camara.leg.br/deputados/${deputadoId}/pessoal-gabinete`;

    const { data: html } = await axios.get(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    const $ = cheerio.load(html);

    const resultados = [];

    $(".tabela-servidores tbody tr").each((_, el) => {
      const cols = $(el).find("td");

      resultados.push({
        nome: $(cols[0]).text().trim(),
        cargo: $(cols[1]).text().trim(),
        nivel: $(cols[2]).text().trim(),
        lotacao: $(cols[3]).text().trim(),
        admissao: $(cols[4]).text().trim(),
        situacao: $(cols[5]).text().trim(),
      });
    });

    return resultados;
  } catch (err) {
    console.error("Erro scraping gabinete:", err.message);
    return [];
  }
}
// FIM