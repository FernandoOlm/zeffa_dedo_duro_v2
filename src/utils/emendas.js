// INÍCIO — utils/emendas.js

import fetch from "node-fetch";
import * as cheerio from "cheerio";

// SIGABRASIL NÃO TEM API DIRETA → Web scraping REAL
export async function pegaEmendas(nome) {
  try {
    // Normaliza nome
    const query = nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const url = `https://www12.senado.leg.br/orcamento/sigabrasil/web/emendas?autor=${encodeURIComponent(
      query
    )}`;

    const html = await fetch(url).then(r => r.text());
    const $ = cheerio.load(html);

    const lista = [];

    $("table tbody tr").each((_, el) => {
      const cols = $(el).find("td");
      if (cols.length < 5) return;

      lista.push({
        codigo: $(cols[0]).text().trim(),
        tipo: $(cols[1]).text().trim(),
        autorizado: parseFloat($(cols[3]).text().trim().replace(/\./g, "").replace(",", ".")) || 0,
        pago: parseFloat($(cols[4]).text().trim().replace(/\./g, "").replace(",", ".")) || 0,
      });
    });

    return lista;
  } catch (e) {
    console.log("Erro emendas:", e.message);
    return [];
  }
}

// FIM — utils/emendas.js