// INÍCIO — senator.js
import fetch from "node-fetch";

export async function cmdSenador(sock, { from, texto }, args = []) {
  try {
    const nome = args.join(" ").trim();
    if (!nome) {
      await sock.sendMessage(from, { text: "❗ Use: *!senador nome*" });
      return;
    }

    // Buscar lista de senadores
    const urlBusca = `https://www.senado.gov.br/senadores/senadores.json`;
    const dados = await (await fetch(urlBusca)).json();

    const lista = dados?.ListaParlamentarEmExercicio?.Parlamentares?.Parlamentar || [];

    const encontrado = lista.find(s =>
      s.IdentificacaoParlamentar.NomeParlamentar
        .toLowerCase()
        .includes(nome.toLowerCase())
    );

    if (!encontrado) {
      await sock.sendMessage(from, {
        text: `❌ Nenhum senador encontrado com nome parecido com: *${nome}*`
      });
      return;
    }

    const id = encontrado.IdentificacaoParlamentar.CodigoParlamentar;
    const nomeSenador = encontrado.IdentificacaoParlamentar.NomeParlamentar;

    // Buscar despesas
    const urlDesp = `https://www.senado.gov.br/senadores/despesas/${id}.json`;
    const despesas = await (await fetch(urlDesp)).json();

    const listaDesp = despesas?.DespesasParlamentares?.Despesas || [];

    const total = listaDesp.reduce((acc, d) => acc + (d.Valor || 0), 0);

    let resposta = `
🟦 *Zeffa investigou o Senador ${nomeSenador}:*

💸 *Total gasto na cota parlamentar:* R$ ${total.toFixed(2)}

📊 *Categorias mais gastas:*
`;

    const categorias = {};
    listaDesp.forEach(d => {
      categorias[d.Tipo] = (categorias[d.Tipo] || 0) + d.Valor;
    });

    for (const c in categorias) {
      const perc = ((categorias[c] / total) * 100).toFixed(1);
      resposta += `- ${c}: ${perc}%\n`;
    }

    resposta += `\n📌 *Fonte:* Senado Federal — Dados Abertos`;

    await sock.sendMessage(from, { text: resposta });
  } catch (err) {
    console.error("Erro senador:", err);
    await sock.sendMessage(from, { text: "❌ Erro ao consultar senador!" });
  }
}
// FIM — senator.js