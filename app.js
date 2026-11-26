(function () {
  const C = window.CONFRA;
  const params = new URLSearchParams(location.search);
  const app = document.getElementById("app");
  const KEY = "confra-votos";
  const KEY_RODADA = "confra-rodada";
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
  const vibrar = FX.vibrar;

  let resultados = {};       // categoria -> vencedor (só as reveladas)
  let girando = false;       // roleta rodando (sem sustos nessa hora)
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
    app.innerHTML = Nucleo.adesivar(html);
    window.scrollTo(0, 0);
    FX.entrada(app.querySelector(".tela"));
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
    let dados, rodada;
    try {
      [dados, rodada] = await Promise.all([Nucleo.revelados(), Nucleo.rodada()]);
    } catch (e) {
      console.warn("sem conexão com o banco", e);
      return;
    }

    // O admin zerou a votação: apaga os votos deste celular e volta pra roleta.
    // Votos sem rodada anotada (feitos antes desse recurso existir) contam como
    // rodada antiga e também são apagados.
    if (rodada != null) {
      const minha = Number(localStorage.getItem(KEY_RODADA)) || 0;
      const temVotos = Object.keys(votos).length > 0;
      localStorage.setItem(KEY_RODADA, rodada);
      if (minha !== rodada && (minha || temVotos)) {
        Object.keys(votos).forEach((k) => delete votos[k]);
        salvar();
        vistos.clear();
        fila.length = 0;
        resultados = {};
        assinatura = "";
        primeiraCarga = false;
        document.querySelectorAll(".sorteio").forEach((el) => el.remove());
        inicio();
        return;
      }
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
      if (cat && resultados[cat.id]) { alarme(cat, () => revelar(cat)); return true; }
    }
    return false;
  }

  // Sirene de "vai sair resultado!" antes de cada revelação ao vivo.
  function alarme(cat, depois) {
    clearInterval(timer);
    clearTimeout(timer);
    telaAtual = "alarme";
    const div = document.createElement("div");
    div.className = "alarme";
    div.innerHTML = Nucleo.adesivar(`
      <div>
        <div class="giroflex">🚨</div>
        <h1>Vai sair<br>resultado!</h1>
        <p class="chamada">${cat.emoji} ${esc(cat.nome)}</p>
      </div>`);
    document.body.appendChild(div);
    vibrar("sirene");
    FX.tremer(20, 1000);
    FX.flash("#ff0033", 300, 0.6);
    setTimeout(() => { div.remove(); depois(); }, 1900);
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
      // Emoji como imagem (estilo adesivo), girado para "apontar" para fora da roda.
      const t = n > 7 ? 24 : n > 4 ? 30 : 38;
      return forma + `<image href="${Nucleo.emojiUrl(c.emoji)}" x="${(x - t / 2).toFixed(2)}" y="${(y - t / 2).toFixed(2)}" ` +
        `width="${t}" height="${t}" filter="url(#adesivo)" transform="rotate(${meio} ${x.toFixed(2)} ${y.toFixed(2)})"/>`;
    }).join("");
    // Borda branca + sombra de adesivo para os emojis da roda.
    const filtro = `<defs><filter id="adesivo" x="-30%" y="-30%" width="160%" height="160%">
      <feMorphology in="SourceAlpha" operator="dilate" radius="1.6" result="d"/>
      <feFlood flood-color="#fff"/><feComposite in2="d" operator="in" result="borda"/>
      <feOffset in="d" dx="1.2" dy="1.8" result="s"/>
      <feFlood flood-color="#1a0540"/><feComposite in2="s" operator="in" result="sombra"/>
      <feMerge><feMergeNode in="sombra"/><feMergeNode in="borda"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter></defs>`;

    const luzes = Array.from({ length: 24 }, (_, i) => {
      const [x, y] = polar(i * 15, 100);
      return `<circle class="luz ${i % 2 ? "b" : ""}" cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="3.2"/>`;
    }).join("");

    tela("roleta", `
      <section class="tela tela-roleta">
        <header class="letreiro">
          <small>🎤 A confra apresenta</small>
          <h1>${esc(C.titulo)}</h1>
        </header>
        <p class="chamada">${feitas === 0
          ? "Gira a roleta, vê qual categoria saiu e vota!<br>Apuração 100% honesta 😇"
          : `${feitas} de ${C.categorias.length} votadas · ${n === 1 ? "falta só uma!" : `faltam ${n}`}`}</p>
        <div class="roda-box">
          <div class="ponteiro"></div>
          <svg class="roda" id="roda" viewBox="-104 -104 208 208" aria-hidden="true">${filtro}${fatias}</svg>
          <svg class="roda-luzes" viewBox="-104 -104 208 208" aria-hidden="true">
            <circle class="aro" r="100"/>${luzes}
            <circle class="miolo" r="17"/><text class="miolo-txt">★</text>
          </svg>
        </div>
        <button class="btn gigante" id="girar">${n === 1 ? "Última! Gira aí 🎰" : "Gira a roleta! 🎰"}</button>
      </section>`);

    const roda = document.getElementById("roda");
    const btn = document.getElementById("girar");
    const ponteiro = app.querySelector(".ponteiro");
    btn.onclick = () => {
      btn.disabled = true;
      btn.textContent = "Girando...";
      girando = true;
      vibrar([90]);
      FX.tremer(8, 350);
      FX.explodirEm(btn, { qtd: 24, forca: 0.7 });
      const k = Math.floor(Math.random() * n);
      // Para em um ponto aleatório dentro da fatia sorteada (não sempre no meio).
      const ponto = (k + 0.5) * passo + (Math.random() - 0.5) * passo * 0.6;
      const voltas = 360 * (calmo ? 1 : 6);
      roda.style.transition = `transform ${calmo ? 0.8 : 4.6}s cubic-bezier(.15,.75,.1,1)`;
      roda.style.transform = `rotate(${voltas + (360 - ponto)}deg)`;
      let foi = false;

      // Tique-taque: cada fatia que passa pelo ponteiro dá um tranco e uma vibradinha.
      let ultima = -1;
      const tiqueTaque = () => {
        if (foi) return;
        const m = getComputedStyle(roda).transform;
        if (m && m.startsWith("matrix(")) {
          const [a, b] = m.slice(7, -1).split(",").map(Number);
          const rot = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
          const idx = Math.floor(((360 - rot) % 360) / passo);
          if (idx !== ultima) {
            if (ultima !== -1) {
              vibrar("tique");
              ponteiro.classList.remove("tique");
              void ponteiro.offsetWidth; // reinicia a animação
              ponteiro.classList.add("tique");
            }
            ultima = idx;
          }
        }
        requestAnimationFrame(tiqueTaque);
      };
      requestAnimationFrame(tiqueTaque);

      const fim = () => { if (!foi) { foi = true; girando = false; sorteada(cats[k], roda); } };
      roda.addEventListener("transitionend", fim, { once: true });
      setTimeout(fim, calmo ? 1200 : 5200); // garantia caso o evento não dispare
    };
  }

  function sorteada(cat, roda) {
    // Parou: estoura tudo.
    vibrar("estouro");
    FX.flash("#ffe600", 380, 0.75);
    FX.tremer(18, 650);
    FX.explodirEm(roda, { qtd: 70, forca: 1.4 });
    confete(60);
    const div = document.createElement("div");
    div.className = "sorteio";
    div.innerHTML = Nucleo.adesivar(`
      <div class="sorteio-card">
        <span class="saiu">Saiu na roleta!</span>
        <div class="emoji">${cat.emoji}</div>
        <h2>${esc(cat.nome)}</h2>
        <button class="btn gigante" id="irvotar">Bora votar!</button>
      </div>`);
    app.appendChild(div);
    FX.letrasPulando(div.querySelector("h2"), 45);
    document.getElementById("irvotar").onclick = () => { vibrar("toque"); votar(cat); };
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
        vibrar("toque");
        FX.tremer(4, 200);
        FX.explodirEm(el.querySelector(".avatar"), { qtd: 16, forca: 0.45, simbolos: ["★", "✦"] });
      };
    });
    btn.onclick = () => {
      votos[cat.id] = escolha;
      salvar();
      // Susto do voto: flash, tremedeira e explosão saindo do botão.
      vibrar("susto");
      FX.flash("#fff", 420, 0.9);
      FX.tremer(22, 700);
      FX.explodirEm(btn, { qtd: 80, forca: 1.5 });
      confete(90);
      tela("computado", `
        <section class="tela centro">
          <div class="emoji">\u{1F5F3}</div>
          <h1 id="computado">Voto computado!</h1>
          <p class="chamada">(confia 😇)</p>
        </section>`);
      FX.letrasPulando(document.getElementById("computado"), 50);
      FX.fogos(1200, 220);
      timer = setTimeout(inicio, 2300);
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
        ${FX.podeVibrar() && !FX.vibracaoLiberada()
          ? `<button class="btn btn-tremedeira" id="tremedeira">📳 Liga a tremedeira</button>` : ""}
      </section>`);
    app.querySelectorAll(".opcao[data-i]").forEach((el) => {
      el.onclick = () => revelar(C.categorias[+el.dataset.i]);
    });
    // O Android só deixa o site vibrar depois que a pessoa toca na tela uma vez.
    const tre = document.getElementById("tremedeira");
    if (tre) tre.onclick = () => {
      vibrar("estouro");
      FX.tremer(12, 500);
      FX.explodirEm(tre, { qtd: 30, forca: 0.8 });
      tre.remove();
    };
  }

  function revelar(cat) {
    const vencedor = resultados[cat.id];
    if (!vencedor) return lista();

    tela("suspense", `
      <section class="tela centro holofote" id="palco-suspense">
        <div class="faixa">${cat.emoji} ${esc(cat.nome)}</div>
        <h2 class="tremer">E o vencedor é...</h2>
        <div id="suspense"><p class="contagem">3</p></div>
        <p class="chamada">🥁 Rufem os tambores!</p>
      </section>`);
    // Cada número bate mais forte: vibração, tremor e luz vermelha aumentando.
    const batida = (num) => {
      vibrar("batida" + num);
      FX.tremer({ 3: 6, 2: 12, 1: 20 }[num], 500);
      if (num < 3) FX.flash("#ff0033", 250, num === 1 ? 0.5 : 0.3);
      const palco = document.getElementById("palco-suspense");
      if (palco) palco.className = `tela centro holofote ${num < 3 ? "tenso-" + num : ""}`;
    };
    batida(3);

    let n = 3;
    timer = setInterval(() => {
      n--;
      if (n > 0) {
        // Recria o número para a animação de "batida" tocar de novo.
        document.getElementById("suspense").innerHTML = `<p class="contagem">${n}</p>`;
        batida(n);
        return;
      }
      tela("vencedor", `
        <section class="tela centro">
          <div class="faixa">${cat.emoji} ${esc(cat.nome)}</div>
          <div class="palco">
            <div class="raios"></div>
            ${Nucleo.avatar(vencedor, "grande")}
          </div>
          <h1 class="vencedor-nome" id="nome-vencedor">${esc(vencedor)}</h1>
          <div class="trofeu">🏆</div>
          <button class="btn" id="voltar">Ver todas as categorias</button>
        </section>`);
      // O GRANDE MOMENTO: flash, terremoto, explosão na foto e fogos.
      vibrar("vitoria");
      FX.flash("#fff", 600, 1);
      FX.tremer(28, 900);
      FX.letrasPulando(document.getElementById("nome-vencedor"), 80);
      setTimeout(() => FX.explodirEm(app.querySelector(".avatar.grande"), { qtd: 90, forca: 1.8 }), 250);
      FX.fogos(4000, 260);
      confete(180);
      document.getElementById("voltar").onclick = () => { if (!tocarFila()) lista(); };
    }, 1000);
  }

  // ---------- Atualização automática ----------
  // O GitHub Pages deixa o celular guardar a página por 10 min. Para ninguém ficar
  // preso numa versão velha, o site confere o versao.txt (sem cache) e, se mudou,
  // recarrega num endereço novo (que nenhum cache tem).
  const VERSAO = ((document.currentScript && document.currentScript.src) || "").match(/[?&]v=(\d+)/)?.[1];
  async function checarVersao() {
    if (!VERSAO) return;
    try {
      const r = await fetch("versao.txt?t=" + Date.now(), { cache: "no-store" });
      const nova = (await r.text()).trim();
      if (!/^\d+$/.test(nova) || nova === VERSAO) return;
      if (sessionStorage.getItem("confra-atualizou") === nova) return; // evita loop
      sessionStorage.setItem("confra-atualizou", nova);
      const p = new URLSearchParams(location.search);
      p.delete("reset");
      p.set("v", nova);
      location.replace(location.pathname + "?" + p.toString() + location.hash);
    } catch (e) { /* sem internet: tenta de novo depois */ }
  }
  checarVersao();
  setInterval(checarVersao, 30000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { checarVersao(); checar(); } });

  // Sustos aleatórios enquanto a pessoa está parada na roleta ou nos resultados.
  FX.iniciarSustos(() => (telaAtual === "roleta" && !girando) || telaAtual === "lista");

  // Primeiro busca o que já foi revelado, depois fica checando.
  checar().finally(() => {
    inicio();
    setInterval(checar, INTERVALO);
  });
})();
