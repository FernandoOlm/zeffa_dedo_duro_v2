// INÍCIO — senador.js (FUNCIONANDO + PARTIDO)
import fetch from "node-fetch";

export async function cmdSenador(sock, { from, texto }, args = []) {
  try {
    const nome = args.join(" ").trim();
    if (!nome) {
      await sock.sendMessage(from, { text: "❗ Use: *!senador nome*" });
      return;
    }

    // LISTA ATUAL — FORÇANDO JSON
    const urlLista = "https://legis.senado.leg.br/dadosabertos/senador/lista/atual?formato=json";
    const dados = await (await fetch(urlLista)).json();

    const lista = dados?.ListaSenador?.Senadores?.Senador || [];

    const senador = lista.find(s =>
      s.IdentificacaoParlamentar.NomeParlamentar
        .toLowerCase()
        .includes(nome.toLowerCase())
    );

    if (!senador) {
      await sock.sendMessage(from, {
        text: `❌ Nenhum senador encontrado parecido com: *${nome}*`
      });
      return;
    }

    const id = senador.IdentificacaoParlamentar.CodigoParlamentar;
    const nomeSen = senador.IdentificacaoParlamentar.NomeParlamentar;
    const partido = senador.IdentificacaoParlamentar.SiglaPartidoParlamentar || "—";
    const uf = senador.IdentificacaoParlamentar.UfParlamentar || "—";

    // DESPESAS — FORÇANDO JSON
    const urlDesp = `https://legis.senado.leg.br/dadosabertos/senador/${id}/despesas?formato=json`;
    const dadosDesp = await (await fetch(urlDesp)).json();

    const listaDesp =
      dadosDesp?.DespesasParlamentares?.Despesas?.Despesas?.Despesa || [];

    const total = listaDesp.reduce(
      (acc, d) => acc + Number(d.ValorReembolsado || 0),
      0
    );

    let resposta = `
🟦 *Zeffa investigou o Senador ${nomeSen}:*

🏛️ *Partido:* ${partido}
📍 *Estado:* ${uf}

💸 *Total reembolsado:* R$ ${total.toFixed(2)}

📊 *Gastos por categoria:*
`;

    const categorias = {};

    listaDesp.forEach(d => {
      const cat = d.TipoDespesa || "Outros";
      categorias[cat] = (categorias[cat] || 0) + Number(d.ValorReembolsado || 0);
    });

    for (const c in categorias) {
      const pct = ((categorias[c] / total) * 100).toFixed(1);
      resposta += `- ${c}: ${pct}%\n`;
    }

    resposta += `\n📌 *Fonte:* Dados Abertos do Senado`;

    await sock.sendMessage(from, { text: resposta });

  } catch (err) {
    console.error("Erro senador:", err);
    await sock.sendMessage(from, { text: "❌ Erro ao consultar senador!" });
  }
}