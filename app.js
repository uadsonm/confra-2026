(function () {
  const C = window.CONFRA;
  const params = new URLSearchParams(location.search);
  const app = document.getElementById("app");
  const KEY = "confra-votos";
  const INTERVALO = 4000; // de quanto em quanto tempo checa se algo foi revelado
  const CORES = ["#ff2e93", "#ffe600", "#00d4ff", "#7cff4f", "#ff8a00"];
  const calmo = matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (params.has("reset")) localStorage.removeItem(KEY);
  const modoTelao = params.has("telao"); // pula a votação, só mostra resultados

  const votos = JSON.parse(localStorage.getItem(KEY) || "{}");
  const salvar = () => localStorage.setItem(KEY, JSON.stringify(votos));
  const pendentes = () => C.categorias.filter((c) => !votos[c.id]);
  const terminou = () => modoTelao || pendentes().length === 0;
  const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
  const vibrar = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };

  let resultados = {};       // categoria -> vencedor (só as reveladas)
  let assinatura = "";       // para saber se algo mudou desde a última checagem
  let primeiraCarga = true;
  const vistos = new Set();  // revelações que este celular já mostrou
  const fila = [];           // revelações novas esperando para tocar
  let telaAtual = "";
  let timer = null;

  function tela(nome, html) {
    clearInterval(timer);
    clearTimeout(timer);
    telaAtual = nome;
    app.innerHTML = html;
    window.scrollTo(0, 0);
  }

  // Chuva de confete (só divs com CSS, nada de biblioteca).
  function confete(qtd = 90) {
    if (calmo) return;
    const box = document.createElement("div");
    box.className = "confetes";
    for (let i = 0; i < qtd; i++) {
      const p = document.createElement("i");
      p.style.cssText =
        `left:${Math.random() * 100}%;background:${CORES[i % CORES.length]};` +
        `width:${6 + Math.random() * 6}px;height:${8 + Math.random() * 10}px;` +
        `--d:${2 + Math.random() * 2}s;--x:${(Math.random() - 0.5) * 160}px;--r:${Math.random() * 900}deg;` +
        `animation-delay:${Math.random() * 0.5}s`;
      box.appendChild(p);
    }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 5000);
  }

  // ---------- Roteamento ----------
  function inicio() {
    if (modoTelao) return lista();
    if (pendentes().length) return roleta();
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

  // ---------- Roleta ----------
  // Ângulo 0 = topo (onde fica o ponteiro), crescendo no sentido horário.
  const polar = (graus, r) => {
    const a = (graus * Math.PI) / 180;
    return [r * Math.sin(a), -r * Math.cos(a)];
  };
  function fatia(a0, a1, r) {
    const [x0, y0] = polar(a0, r);
    const [x1, y1] = polar(a1, r);
    return `M0 0 L${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}Z`;
  }

  function roleta() {
    const cats = pendentes();
    const n = cats.length;
    const passo = 360 / n;
    const feitas = C.categorias.length - n;
    const R = 96;

    const fatias = cats.map((c, i) => {
      // Evita duas fatias vizinhas da mesma cor quando a conta não fecha.
      let cor = CORES[i % CORES.length];
      if (i === n - 1 && n > 1 && cor === CORES[0]) cor = CORES[2];
      const meio = (i + 0.5) * passo;
      const [x, y] = polar(meio, R * 0.66);
      const forma = n === 1
        ? `<circle class="unica" r="${R}" fill="${cor}"/>`
        : `<path d="${fatia(i * passo, (i + 1) * passo, R)}" fill="${cor}"/>`;
      return forma + `<text class="fatia-emoji" x="${x.toFixed(2)}" y="${y.toFixed(2)}" ` +
        `font-size="${n > 7 ? 20 : n > 4 ? 26 : 32}" transform="rotate(${meio} ${x.toFixed(2)} ${y.toFixed(2)})">${c.emoji}</text>`;
    }).join("");

    const luzes = Array.from({ length: 24 }, (_, i) => {
      const [x, y] = polar(i * 15, 100);
      return `<circle class="luz ${i % 2 ? "b" : ""}" cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="3.2"/>`;
    }).join("");

    tela("roleta", `
      <section class="tela">
        <header class="letreiro">
          <small>🎤 A confra apresenta</small>
          <h1>${esc(C.titulo)}</h1>
        </header>
        <p class="chamada">${feitas === 0
          ? "Gira a roleta, vê qual categoria saiu e vota!<br>Apuração 100% honesta 😇"
          : `${feitas} de ${C.categorias.length} votadas · ${n === 1 ? "falta só uma!" : `faltam ${n}`}`}</p>
        <div class="roda-box">
          <div class="ponteiro"></div>
          <svg class="roda" id="roda" viewBox="-104 -104 208 208" aria-hidden="true">${fatias}</svg>
          <svg class="roda-luzes" viewBox="-104 -104 208 208" aria-hidden="true">
            <circle class="aro" r="100"/>${luzes}
            <circle class="miolo" r="17"/><text class="miolo-txt">★</text>
          </svg>
        </div>
        <button class="btn gigante" id="girar">${n === 1 ? "Última! Gira aí 🎰" : "Gira a roleta! 🎰"}</button>
      </section>`);

    const roda = document.getElementById("roda");
    const btn = document.getElementById("girar");
    btn.onclick = () => {
      btn.disabled = true;
      btn.textContent = "Girando...";
      const k = Math.floor(Math.random() * n);
      // Para em um ponto aleatório dentro da fatia sorteada (não sempre no meio).
      const ponto = (k + 0.5) * passo + (Math.random() - 0.5) * passo * 0.6;
      const voltas = 360 * (calmo ? 1 : 6);
      roda.style.transition = `transform ${calmo ? 0.8 : 4.6}s cubic-bezier(.15,.75,.1,1)`;
      roda.style.transform = `rotate(${voltas + (360 - ponto)}deg)`;
      let foi = false;
      const fim = () => { if (!foi) { foi = true; sorteada(cats[k]); } };
      roda.addEventListener("transitionend", fim, { once: true });
      setTimeout(fim, calmo ? 1200 : 5200); // garantia caso o evento não dispare
    };
  }

  function sorteada(cat) {
    vibrar([60, 40, 120]);
    confete(50);
    const div = document.createElement("div");
    div.className = "sorteio";
    div.innerHTML = `
      <div class="sorteio-card">
        <span class="saiu">Saiu na roleta!</span>
        <div class="emoji">${cat.emoji}</div>
        <h2>${esc(cat.nome)}</h2>
        <button class="btn gigante" id="irvotar">Bora votar!</button>
      </div>`;
    app.appendChild(div);
    document.getElementById("irvotar").onclick = () => votar(cat);
  }

  // ---------- Votação ----------
  function votar(cat) {
    let escolha = null;
    tela("votar", `
      <section class="tela">
        <div class="emoji">${cat.emoji}</div>
        <div class="faixa">${esc(cat.nome)}</div>
        <p class="progresso">Quem merece esse troféu?</p>
        <div class="grade">
          ${cat.indicados.map((nome, i) => `
            <button class="opcao pessoa" data-i="${i}">${Nucleo.avatar(nome)}<span>${esc(nome)}</span></button>`).join("")}
        </div>
        <button class="btn gigante fixo" id="confirmar" disabled>Escolhe alguém aí</button>
      </section>`);
    const btn = document.getElementById("confirmar");
    app.querySelectorAll(".opcao").forEach((el) => {
      el.onclick = () => {
        app.querySelectorAll(".opcao").forEach((o) => o.classList.remove("sel"));
        el.classList.add("sel");
        escolha = cat.indicados[+el.dataset.i];
        btn.disabled = false;
        btn.textContent = `Confirmar: ${escolha}`;
        vibrar(20);
      };
    });
    btn.onclick = () => {
      votos[cat.id] = escolha;
      salvar();
      vibrar([40, 30, 40]);
      confete(70);
      tela("computado", `
        <section class="tela centro">
          <div class="emoji">🗳️</div>
          <h1>Voto<br>computado!</h1>
          <p class="chamada">(confia 😇)</p>
        </section>`);
      timer = setTimeout(inicio, 1700);
    };
  }

  // ---------- Resultados ----------
  function lista() {
    const qtd = Object.keys(resultados).length;
    tela("lista", `
      <section class="tela">
        <header class="letreiro">
          <small>🏆 E o troféu vai para...</small>
          <h1>Resultados</h1>
        </header>
        <span class="ao-vivo">Ao vivo</span>
        <p class="chamada">${qtd === 0
          ? "Votos registrados! Fica nessa tela: quando o apresentador revelar, o vencedor aparece aqui 👀"
          : `${qtd} de ${C.categorias.length} reveladas · toca pra ver de novo`}</p>
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
      <section class="tela centro holofote">
        <div class="faixa">${cat.emoji} ${esc(cat.nome)}</div>
        <h2 class="tremer">E o vencedor é...</h2>
        <div id="suspense"><p class="contagem">3</p></div>
        <p class="chamada">🥁 Rufem os tambores!</p>
      </section>`);
    vibrar(80);

    let n = 3;
    timer = setInterval(() => {
      n--;
      if (n > 0) {
        // Recria o número para a animação de "batida" tocar de novo.
        document.getElementById("suspense").innerHTML = `<p class="contagem">${n}</p>`;
        vibrar(80);
        return;
      }
      tela("vencedor", `
        <section class="tela centro">
          <div class="faixa">${cat.emoji} ${esc(cat.nome)}</div>
          <div class="palco">
            <div class="raios"></div>
            ${Nucleo.avatar(vencedor, "grande")}
          </div>
          <h1 class="vencedor-nome">${esc(vencedor)}</h1>
          <div class="trofeu">🏆</div>
          <button class="btn" id="voltar">Ver todas as categorias</button>
        </section>`);
      vibrar([200, 80, 200, 80, 400]);
      confete(160);
      document.getElementById("voltar").onclick = () => { if (!tocarFila()) lista(); };
    }, 1000);
  }

  // Primeiro busca o que já foi revelado, depois fica checando.
  checar().finally(() => {
    inicio();
    setInterval(checar, INTERVALO);
  });
})();
