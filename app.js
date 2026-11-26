(function () {
  const C = window.CONFRA;
  const params = new URLSearchParams(location.search);
  const app = document.getElementById("app");
  const KEY = "confra-votos";
  const INTERVALO = 4000; // de quanto em quanto tempo checa se algo foi revelado

  if (params.has("reset")) localStorage.removeItem(KEY);
  const modoTelao = params.has("telao"); // pula a votação, só mostra resultados

  const votos = JSON.parse(localStorage.getItem(KEY) || "{}");
  const salvar = () => localStorage.setItem(KEY, JSON.stringify(votos));
  const pendentes = () => C.categorias.filter((c) => !votos[c.id]);
  const terminou = () => modoTelao || pendentes().length === 0;
  const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));

  let resultados = {};       // categoria -> vencedor (só as reveladas)
  let assinatura = "";       // para saber se algo mudou desde a última checagem
  let primeiraCarga = true;
  const vistos = new Set();  // revelações que este celular já mostrou
  const fila = [];           // revelações novas esperando para tocar
  let telaAtual = "";
  let timer = null;

  function tela(nome, html) {
    clearInterval(timer);
    telaAtual = nome;
    app.innerHTML = html;
    window.scrollTo(0, 0);
  }

  // ---------- Roteamento ----------
  function inicio() {
    if (modoTelao) return lista();
    if (Object.keys(votos).length === 0) return boasVindas();
    if (pendentes().length) return votar(pendentes()[0]);
    return lista();
  }

  // ---------- Resultados ao vivo ----------
  async function checar() {
    let dados;
    try {
      dados = await Nucleo.revelados();
    } catch (e) {
      console.warn("sem conexão com o banco", e);
      return;
    }
    dados.sort((a, b) => new Date(a.revelado_em) - new Date(b.revelado_em));
    resultados = Object.fromEntries(dados.map((r) => [r.categoria, r.vencedor]));

    dados.forEach((r) => {
      if (vistos.has(r.categoria)) return;
      vistos.add(r.categoria);
      // O que já estava revelado quando a pessoa abriu o site não toca sozinho.
      if (!primeiraCarga) fila.push(r.categoria);
    });
    primeiraCarga = false;

    const nova = JSON.stringify(resultados);
    const mudou = nova !== assinatura;
    assinatura = nova;

    if (telaAtual === "lista" && terminou()) {
      if (tocarFila()) return;
      if (mudou) lista();
    }
  }

  // Revelação nova chegou e a pessoa está na lista: toca o suspense automaticamente.
  function tocarFila() {
    while (fila.length) {
      const id = fila.shift();
      const cat = C.categorias.find((c) => c.id === id);
      if (cat && resultados[cat.id]) { revelar(cat); return true; }
    }
    return false;
  }

  // ---------- Telas ----------
  function boasVindas() {
    tela("inicio", `
      <section class="tela centro">
        <h1>${esc(C.titulo)}</h1>
        <p>${C.categorias.length} categorias. Voto secreto, apuração 100% honesta. 😇</p>
        <button class="btn" id="comecar">Começar a votar</button>
      </section>`);
    document.getElementById("comecar").onclick = () => votar(pendentes()[0]);
  }

  function votar(cat) {
    const n = C.categorias.indexOf(cat) + 1;
    let escolha = null;
    tela("votar", `
      <section class="tela">
        <p class="progresso">Categoria ${n} de ${C.categorias.length}</p>
        <div class="emoji">${cat.emoji}</div>
        <h2>${esc(cat.nome)}</h2>
        <div class="grade">
          ${cat.indicados.map((nome, i) => `
            <button class="opcao pessoa" data-i="${i}">${Nucleo.avatar(nome)}<span>${esc(nome)}</span></button>`).join("")}
        </div>
        <button class="btn fixo" id="confirmar" disabled>Confirmar voto</button>
      </section>`);
    const btn = document.getElementById("confirmar");
    app.querySelectorAll(".opcao").forEach((el) => {
      el.onclick = () => {
        app.querySelectorAll(".opcao").forEach((o) => o.classList.remove("sel"));
        el.classList.add("sel");
        escolha = cat.indicados[+el.dataset.i];
        btn.disabled = false;
      };
    });
    btn.onclick = () => {
      votos[cat.id] = escolha;
      salvar();
      tela("computado", `<section class="tela centro"><div class="emoji">✅</div><h2>Voto computado!</h2><p>(confia)</p></section>`);
      setTimeout(inicio, 1200);
    };
  }

  function lista() {
    const qtd = Object.keys(resultados).length;
    tela("lista", `
      <section class="tela">
        <h1>Resultados</h1>
        <p class="miudo">${qtd === 0
          ? "Votos registrados! Fica nessa tela: os vencedores aparecem aqui ao vivo 👀"
          : `${qtd} de ${C.categorias.length} reveladas · atualiza sozinho`}</p>
        <div class="opcoes">
          ${C.categorias.map((c, i) => {
            const v = resultados[c.id];
            return v
              ? `<button class="opcao linha-res" data-i="${i}">${Nucleo.avatar(v, "mini")}<span>${c.emoji} ${esc(c.nome)}<br><b>${esc(v)}</b></span></button>`
              : `<button class="opcao linha-res" disabled><span class="cadeado">🔒</span><span>${c.emoji} ${esc(c.nome)}</span></button>`;
          }).join("")}
        </div>
      </section>`);
    app.querySelectorAll(".opcao[data-i]").forEach((el) => {
      el.onclick = () => revelar(C.categorias[+el.dataset.i]);
    });
  }

  function revelar(cat) {
    const vencedor = resultados[cat.id];
    if (!vencedor) return lista();

    tela("suspense", `
      <section class="tela centro">
        <div class="emoji">${cat.emoji}</div>
        <h2>${esc(cat.nome)}</h2>
        <p>E o vencedor é...</p>
        <p class="contagem" id="suspense">3</p>
      </section>`);

    let n = 3;
    timer = setInterval(() => {
      n--;
      if (n > 0) return (document.getElementById("suspense").textContent = n);
      tela("vencedor", `
        <section class="tela centro">
          <p class="progresso">${cat.emoji} ${esc(cat.nome)}</p>
          ${Nucleo.avatar(vencedor, "grande")}
          <h1 class="vencedor">🏆 ${esc(vencedor)}</h1>
          <button class="btn" id="voltar">Ver todas as categorias</button>
        </section>`);
      document.getElementById("voltar").onclick = () => { if (!tocarFila()) lista(); };
    }, 1000);
  }

  // Primeiro busca o que já foi revelado, depois fica checando.
  checar().finally(() => {
    inicio();
    setInterval(checar, INTERVALO);
  });
})();
