import fetch from "node-fetch";

// ==========================
// Buscar deputado por nome
// ==========================
async function buscarDeputado(nome) {
  const url = `https://dadosabertos.camara.leg.br/api/v2/deputados?nome=${encodeURIComponent(nome)}`;
  const r = await fetch(url);
  const j = await r.json();
  return j.dados?.[0] || null;
}

// ==========================
// Buscar TODAS despesas
// ==========================
async function buscarDespesas(id) {
  const url = `https://dadosabertos.camara.leg.br/api/v2/deputados/${id}/despesas?itens=1000`;
  const r = await fetch(url);
  const j = await r.json();
  return j.dados || [];
}

// ==========================
// Agrupar por categoria
// ==========================
function agruparCategorias(despesas) {
  const mapa = {};

  for (const d of despesas) {
    const cat = d.tipoDocumento || "OUTROS";
    if (!mapa[cat]) mapa[cat] = 0;
    mapa[cat] += d.valorLiquido;
  }

  return mapa;
}

// ==========================
// Fornecedor mais pago
// ==========================
function fornecedorTop(despesas) {
  const map = {};

  for (const d of despesas) {
    const f = d.nomeFornecedor || "NÃO INFORMADO";
    if (!map[f]) map[f] = 0;
    map[f] += d.valorLiquido;
  }

  const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
  const top = entries[0];
  const total = entries.reduce((acc, x) => acc + x[1], 0);

  return {
    fornecedor: top[0],
    valor: top[1],
    porcentagem: (top[1] / total) * 100,
  };
}

// ==========================
// Notas duplicadas (suspeita)
// ==========================
function notasDuplicadas(despesas) {
  const map = {};
  const dup = [];

  for (const d of despesas) {
    const chave = `${d.dataDocumento}-${d.valorLiquido}-${d.nomeFornecedor}`;
    if (!map[chave]) map[chave] = 0;
    map[chave]++;

    if (map[chave] === 2) dup.push(d);
  }

  return dup;
}

// ==========================
// Mês mais gastador
// ==========================
function mesMaisGastador(despesas) {
  const map = {};

  for (const d of despesas) {
    const mes = d.mes || "0";
    if (!map[mes]) map[mes] = 0;
    map[mes] += d.valorLiquido;
  }

  const top = Object.entries(map).sort((a, b) => b[1] - a[1])[0];
  return { mes: top[0], total: top[1] };
}

// ==========================
// Gráfico ASCII
// ==========================
function graficoAscii(categorias) {
  const total = Object.values(categorias).reduce((a, b) => a + b, 0);

  let out = "\n📊 *Gastos por categoria:*\n";

  for (const [cat, val] of Object.entries(categorias)) {
    const pct = (val / total) * 100;
    const barras = "█".repeat(Math.round(pct / 5));
    out += `${cat}: ${barras} ${pct.toFixed(1)}%\n`;
  }

  return out;
}

// ==========================
// COMANDO PRINCIPAL
// ==========================
export async function cmdDeputado(nome) {
  if (!nome) return "Use: *!deputado Nome*";

  const dep = await buscarDeputado(nome);
  if (!dep) return `Nenhum deputado encontrado: *${nome}*`;

  const despesas = await buscarDespesas(dep.id);

  if (!despesas.length)
    return `Nenhuma despesa encontrada para *${dep.nome}*`;

  // cálculos
  const total = despesas.reduce((acc, x) => acc + x.valorLiquido, 0);
  const categorias = agruparCategorias(despesas);
  const topFornecedor = fornecedorTop(despesas);
  const duplicadas = notasDuplicadas(despesas);
  const picoMes = mesMaisGastador(despesas);
  const grafico = graficoAscii(categorias);

  // texto final
  return `
🕵️ *Zeffa Dedo Duro investigou ${dep.nome}:*

💸 *Total gasto:* R$ ${total.toFixed(2)}
🧾 *Fornecedor favorito:* ${topFornecedor.fornecedor} (${topFornecedor.porcentagem.toFixed(
    1
  )}% do total)
📆 *Mês mais gastador:* ${picoMes.mes} (R$ ${picoMes.total.toFixed(2)})
📄 *Notas duplicadas:* ${duplicadas.length > 0 ? duplicadas.length : "nenhuma"}

${grafico}

Zeffa analisou tudo — *sem dó, sem piedade* 😘
`;
}