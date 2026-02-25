// ============================================================================
//  EMENDAS — Câmara + Senado (Últimos 4 anos)
//  100% JSON, 100% estável, SEM depender da CGU
// ============================================================================

const BASE_CAMARA = "https://dadosabertos.camara.leg.br/api/v2";
const BASE_SENADO = "https://legis.senado.leg.br/dadosabertos";

// ============================= HELPERS ======================================
async function safeFetchJSON(url) {
  try {
    const r = await fetch(url, { headers: { Accept: "application/json" } });

    if (!r.ok) return null;

    const txt = await r.text();
    try {
      return JSON.parse(txt);
    } catch (e) {
      return null;
    }
  } catch (e) {
    return null;
  }
}

function anoValido(ano) {
  const atual = new Date().getFullYear();
  return atual - ano <= 4;
}

// ============================================================================
//  1) EMENDAS — CÂMARA DOS DEPUTADOS
// ============================================================================
async function emendasCamara(idDeputado) {
  const url = `${BASE_CAMARA}/orcamento/emendas?ordenarPor=id&ordem=asc&itens=200`;
  const data = await safeFetchJSON(url);
  if (!data || !data.dados) return [];

  const filtro = data.dados.filter(e => {
    return (
      e.autor?.id === idDeputado &&
      anoValido(e.ano)
    );
  });

  return filtro.map(e => ({
    origem: "camara",
    ano: e.ano,
    id: e.id,
    autor: e.autor?.nome,
    tipo: e.tipo,
    valor: Number(e.valor) || 0
  }));
}

// ============================================================================
//  2) EMENDAS — SENADO
// ============================================================================
async function emendasSenado(nomeParlamentar) {
  const anos = [];
  const atual = new Date().getFullYear();
  for (let a = atual; a >= atual - 4; a--) anos.push(a);

  let listaFinal = [];

  for (const ano of anos) {
    const url = `${BASE_SENADO}/emendas/autor/${encodeURIComponent(
      nomeParlamentar
    )}?ano=${ano}`;

    const data = await safeFetchJSON(url);
    if (!data || !data.Emendas) continue;

    const blocos = data.Emendas.Emenda || [];
    for (const e of blocos) {
      listaFinal.push({
        origem: "senado",
        ano,
        id: e.CodigoEmenda,
        tipo: e.Tipo || null,
        autor: nomeParlamentar,
        valor: Number(e.ValorEmenda || 0)
      });
    }
  }

  return listaFinal;
}

// ============================================================================
//  3) AGREGAÇÃO FINAL — Junta Câmara + Senado
// ============================================================================
export async function pegaEmendas({ idDeputado, nome }) {
  const [cam, sen] = await Promise.all([
    emendasCamara(idDeputado),
    emendasSenado(nome)
  ]);

  const todas = [...cam, ...sen];
  if (!todas.length) {
    return {
      lista: [],
      total: 0
    };
  }

  const total = todas.reduce((acc, e) => acc + (e.valor || 0), 0);

  return { lista: todas, total };
}

export default pegaEmendas;