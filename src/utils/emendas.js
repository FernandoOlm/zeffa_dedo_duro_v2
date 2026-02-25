// utils/emendas.js
// ======================================================
// EMENDAS PARLAMENTARES — SIGA BRASIL (FUNCIONANDO)
// Mantém compatibilidade com "pegaEmendas" do deputado.js
// ======================================================

import fetch from "node-fetch";

const anos = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];

// Função principal (nome que você quiser)
async function buscarEmendas(nomeParlamentar) {
  const emendas = [];

  for (const ano of anos) {
    try {
      const url = `https://www12.senado.leg.br/orcamento/sigabrasil-api/emendas/parlamentares?parlamentar=${encodeURIComponent(
        nomeParlamentar
      )}&ano=${ano}`;

      const r = await fetch(url);
      if (!r.ok) {
        console.log(`⚠️ SigaBrasil falhou (${ano}):`, r.status);
        continue;
      }

      const dados = await r.json().catch(() => null);
      if (!Array.isArray(dados)) continue;

      dados.forEach((e) => {
        emendas.push({
          ano,
          codigo: e.codigoEmenda || null,
          tipo: e.tipo || null,
          autor: e.autor || nomeParlamentar,
          nomeAutor: e.autor || nomeParlamentar,
          numero: e.numero || null,
          localidade: e.localidadeDoGasto || null,
          funcao: e.funcao || null,
          subfuncao: e.subfuncao || null,
          empenhado: parseFloat(e.valorEmpenhado || 0),
          liquidado: parseFloat(e.valorLiquidado || 0),
          pago: parseFloat(e.valorPago || 0),
        });
      });
    } catch (err) {
      console.log(`⚠️ Erro SIGABRASIL (${ano}):`, err.message);
    }
  }

  return {
    autorizado: emendas.reduce((t, e) => t + (e.empenhado || 0), 0),
    pago: emendas.reduce((t, e) => t + (e.pago || 0), 0),
    lista: emendas,
  };
}

// ======================================================
// 🔥 Export com nome ORIGINAL esperado pelo seu deputado.js
// ======================================================
export const pegaEmendas = buscarEmendas;