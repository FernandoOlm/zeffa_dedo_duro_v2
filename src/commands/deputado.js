import fetch from "node-fetch";

// Buscar deputado por nome
async function buscarDeputado(nome) {
  const url = `https://dadosabertos.camara.leg.br/api/v2/deputados?nome=${encodeURIComponent(
    nome
  )}`;
  const r = await fetch(url);
  const j = await r.json();

  return j.dados?.[0] || null;
}

// Buscar despesas
async function buscarDespesas(id) {
  const url = `https://dadosabertos.camara.leg.br/api/v2/deputados/${id}/despesas`;
  const r = await fetch(url);
  const j = await r.json();
  return j.dados || [];
}

// Gerar texto final bonitão
function montarResumo(dep, despesas) {
  let total = 0;
  let maior = { valor: 0, tipo: "Nenhuma" };

  for (const d of despesas) {
    total += d.valorLiquido;
    if (d.valorLiquido > maior.valor) {
      maior = { valor: d.valorLiquido, tipo: d.tipoDocumento };
    }
  }

  return `
🕵️ *Zeffa Dedo Duro — CAPIVARA DO DEPUTADO*

👤 *${dep.nome}*
💰 Total gasto: R$ ${total.toFixed(2)}

📄 Nota mais cara:
- R$ ${maior.valor.toFixed(2)}
- ${maior.tipo}

Zeffa rastreou tudo 😘
`;
}

// Função principal (simples!)
export async function cmdDeputado(nome) {
  if (!nome) return "Use: !deputado Nome do deputado";

  const dep = await buscarDeputado(nome);
  if (!dep) return `Nenhum deputado encontrado com nome parecido com: *${nome}*`;

  const despesas = await buscarDespesas(dep.id);

  return montarResumo(dep, despesas);
}