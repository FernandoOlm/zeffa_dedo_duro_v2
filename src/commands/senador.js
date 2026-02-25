// INÍCIO — senador.js (API nova e oficial)
import fetch from "node-fetch";

export async function cmdSenador(sock, { from, texto }, args = []) {
  try {
    const nome = args.join(" ").trim();
    if (!nome) {
      await sock.sendMessage(from, { text: "❗ Use: *!senador nome*" });
      return;
    }

    // LISTA ATUAL DE SENADORES
    const urlLista = "https://legis.senado.leg.br/dadosabertos/senador/lista/atual";
    const dados = await (await fetch(urlLista)).json();

    const lista = dados?.ListaSenador?.Senadores?.Senador || [];

    const s = lista.find(x =>
      x.IdentificacaoParlamentar?.NomeParlamentar
        ?.toLowerCase()
        .includes(nome.toLowerCase())
    );

    if (!s) {
      await sock.sendMessage(from, {
        text: `❌ Nenhum senador encontrado parecido com: *${nome}*`
      });
      return;
    }

    const id = s.IdentificacaoParlamentar.CodigoParlamentar;
    const nomeSen = s.IdentificacaoParlamentar.NomeParlamentar;

    // DESPESAS DO SENADOR
    const urlDesp = `https://legis.senado.leg.br/dadosabertos/senador/${id}/despesas`;
    const despesas = await (await fetch(urlDesp)).json();

    const listaDesp =
      despesas?.DespesasParlamentares?.Despesas?.Despesas?.Despesa || [];

    const total = listaDesp.reduce((acc, d) => acc + Number(d.ValorReembolsado || 0), 0);

    let resposta = `
🟦 *Zeffa investigou o Senador ${nomeSen}:*

💸 *Total reembolsado:* R$ ${total.toFixed(2)}

📊 *Gastos por categoria:*
`;

    const categorias = {};
    listaDesp.forEach(d => {
      const c = d.TipoDespesa || "Outros";
      categorias[c] = (categorias[c] || 0) + Number(d.ValorReembolsado || 0);
    });

    for (const c in categorias) {
      const perc = ((categorias[c] / total) * 100).toFixed(1);
      resposta += `- ${c}: ${perc}%\n`;
    }

    resposta += `\n📌 *Fonte:* Dados Abertos do Senado`;

    await sock.sendMessage(from, { text: resposta });

  } catch (err) {
    console.error("Erro senador:", err);
    await sock.sendMessage(from, { text: "❌ Erro ao consultar senador!" });
  }
}
// FIM — senador.js