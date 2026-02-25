// ========================== utils/emendas.js =============================
// Versão ABSOLUTA, FINAL, BLINDADA
// Suporta múltiplos anos, evita HTML/erros da CGU, mantém formato original

import fetch from "node-fetch";

export async function pegaEmendas(nome, key) {
  // Anos amplos para pegar mandato inteiro
  const anos = [2019, 2020, 2021, 2022, 2023, 2024, 2025];

  let lista = [];

  for (const ano of anos) {
    const url = `https://api.portaldatransparencia.gov.br/api-de-dados/emendas?nomeAutor=${encodeURIComponent(
      nome
    )}&ano=${ano}&pagina=1`;

    try {
      const resp = await fetch(url, {
        headers: {
          Accept: "*/*",                // CGU requer isso
          "chave-api-dados": key,
        },
      });

      const raw = await resp.text();

      // Se vier HTML ou XML → descarta silenciosamente
      if (!raw.startsWith("[") && !raw.startsWith("{")) {
        console.log("⚠️ Emendas CGU (ano " + ano + "): resposta não-JSON");
        continue;
      }

      let dados;
      try {
        dados = JSON.parse(raw);
      } catch (e) {
        console.log("⚠️ Erro JSON em emendas (ano " + ano + "):", e.message);
        continue;
      }

      if (!Array.isArray(dados)) continue;

      for (const e of dados) {
        lista.push({
          codigo: e.codigoEmenda,
          ano: e.ano,
          tipo: e.tipoEmenda,
          numero: e.numeroEmenda,
          autorizado:
            parseFloat(e.valorEmpenhado?.replace(/\./g, "").replace(",", ".")) ||
            0,
          liquidado:
            parseFloat(e.valorLiquidado?.replace(/\./g, "").replace(",", ".")) ||
            0,
          pago:
            parseFloat(e.valorPago?.replace(/\./g, "").replace(",", ".")) || 0,
          funcao: e.funcao,
          subfuncao: e.subfuncao,
          localidade: e.localidadeDoGasto,
        });
      }
    } catch (err) {
      console.log("⚠️ Falha de rede CGU em emendas:", err.message);
      continue;
    }
  }

  return lista;
}

// ======================== FIM utils/emendas.js ===========================