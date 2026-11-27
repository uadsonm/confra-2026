// Efeitos de programa de auditório: explosão, flash, tremor, fogos, vibração e sustos.
// Tudo feito com elementos simples + Web Animations (nada de biblioteca externa).
(function () {
  const CORES = ["#ff2e93", "#ffe600", "#00d4ff", "#7cff4f", "#ff8a00", "#ffffff"];
  const calmo = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // ---------- Vibração ----------
  // Só Android vibra (iPhone ignora). Padrões em ms: [vibra, pausa, vibra, ...].
  const PADROES = {
    tique: 12,
    toque: 35,
    susto: [400, 60, 120, 60, 400],
    estouro: [180, 40, 380],
    sirene: [120, 60, 120, 60, 120, 60, 120, 60, 120, 60, 300],
    batida3: [140],
    batida2: [160, 70, 160],
    batida1: [200, 50, 200, 50, 200, 50, 260],
    tambor: Array.from({ length: 16 }, (_, i) => (i % 2 ? 25 : 35)),
    vitoria: [600, 100, 200, 80, 200, 80, 200, 100, 900]
  };
  function vibrar(p) {
    try {
      if (!navigator.vibrate) return;
      navigator.vibrate(typeof p === "string" ? PADROES[p] : p);
    } catch (e) {}
  }
  const podeVibrar = () => "vibrate" in navigator;
  const vibracaoLiberada = () => !navigator.userActivation || navigator.userActivation.hasBeenActive;

  // ---------- Tremor de tela ----------
  function tremer(forca = 10, ms = 450) {
    if (calmo) return;
    const alvo = document.getElementById("app");
    if (!alvo) return;
    const quadros = [];
    const passos = Math.max(4, Math.round(ms / 40));
    for (let i = 0; i < passos; i++) {
      const f = forca * (1 - i / passos);
      quadros.push({ transform: `translate(${rand(-f, f)}px, ${rand(-f, f)}px) rotate(${rand(-f, f) / 6}deg)` });
    }
    quadros.push({ transform: "none" });
    alvo.animate(quadros, { duration: ms, easing: "linear" });
  }

  // ---------- Flash ----------
  function flash(cor = "#fff", ms = 380, opacidade = 0.9) {
    const el = document.createElement("div");
    el.className = "fx-flash";
    el.style.background = cor;
    document.body.appendChild(el);
    el.animate([{ opacity: opacidade }, { opacity: 0 }], { duration: ms, easing: "ease-out", fill: "forwards" }).onfinish = () => el.remove();
  }

  // ---------- Explosão ----------
  // Estoura partículas a partir de (x, y), com onda de choque.
  function explodir(x, y, { qtd = 40, forca = 1, simbolos = ["★", "✦", "●", "■", "▲"] } = {}) {
    if (x == null) { x = innerWidth / 2; y = innerHeight / 2; }
    const camada = document.createElement("div");
    camada.className = "fx-camada";
    document.body.appendChild(camada);

    const onda = document.createElement("i");
    onda.className = "fx-onda";
    onda.style.left = x + "px";
    onda.style.top = y + "px";
    camada.appendChild(onda);
    onda.animate(
      [{ transform: "translate(-50%,-50%) scale(.1)", opacity: 1 }, { transform: `translate(-50%,-50%) scale(${6 * forca})`, opacity: 0 }],
      // fill "forwards" + remover ao terminar: sem isso o anel voltava a aparecer parado.
      { duration: 650, easing: "cubic-bezier(.1,.8,.3,1)", fill: "forwards" }
    ).onfinish = () => onda.remove();

    const n = calmo ? Math.min(qtd, 12) : qtd;
    for (let i = 0; i < n; i++) {
      const p = document.createElement("span");
      p.className = "fx-part";
      p.textContent = pick(simbolos);
      p.style.color = pick(CORES);
      p.style.left = x + "px";
      p.style.top = y + "px";
      p.style.fontSize = rand(12, 30) * Math.sqrt(forca) + "px";
      camada.appendChild(p);
      const ang = rand(0, Math.PI * 2);
      const dist = rand(80, 260) * forca;
      const dx = Math.cos(ang) * dist;
      const dy = Math.sin(ang) * dist;
      p.animate(
        [
          { transform: "translate(-50%,-50%) scale(.2) rotate(0deg)", opacity: 1 },
          { transform: `translate(calc(-50% + ${dx * 0.8}px), calc(-50% + ${dy * 0.8}px)) scale(1.2) rotate(${rand(-200, 200)}deg)`, opacity: 1, offset: 0.55 },
          { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy + rand(80, 220)}px)) scale(.5) rotate(${rand(-400, 400)}deg)`, opacity: 0 }
        ],
        { duration: rand(800, 1400), easing: "cubic-bezier(.15,.75,.35,1)", fill: "forwards" }
      ).onfinish = () => p.remove();
    }
    setTimeout(() => camada.remove(), 1600);
  }

  // Explosão saindo do meio de um elemento.
  function explodirEm(el, opts) {
    if (!el) return explodir(null, null, opts);
    const r = el.getBoundingClientRect();
    explodir(r.left + r.width / 2, r.top + r.height / 2, opts);
  }

  // ---------- Fogos ----------
  // Várias explosões espalhadas pela tela durante "ms".
  function fogos(ms = 3000, intervalo = 280) {
    if (calmo) return;
    const fim = Date.now() + ms;
    const t = setInterval(() => {
      if (Date.now() > fim) return clearInterval(t);
      explodir(rand(innerWidth * 0.1, innerWidth * 0.9), rand(innerHeight * 0.08, innerHeight * 0.55), {
        qtd: 26, forca: rand(0.6, 1.1), simbolos: ["✦", "★", "●"]
      });
    }, intervalo);
  }

  // ---------- Letras pulando ----------
  // Quebra um texto em letras que entram uma a uma.
  function letrasPulando(el, atraso = 70) {
    if (!el || calmo) return;
    const palavras = el.textContent.trim().split(/\s+/);
    el.textContent = "";
    let i = 0;
    palavras.forEach((p, w) => {
      // Cada palavra fica inteira na mesma linha; só quebra entre palavras.
      const caixa = document.createElement("span");
      caixa.style.whiteSpace = "nowrap";
      [...p].forEach((ch) => {
        const s = document.createElement("span");
        s.className = "fx-letra";
        s.textContent = ch;
        s.style.animationDelay = i++ * atraso + "ms";
        caixa.appendChild(s);
      });
      el.appendChild(caixa);
      if (w < palavras.length - 1) el.appendChild(document.createTextNode(" "));
    });
  }

  // ---------- Entrada da tela ----------
  // Cada bloco da tela entra "caindo" com um quique, um depois do outro.
  function entrada(raiz) {
    if (!raiz || calmo) return;
    [...raiz.children].forEach((el, i) => {
      if (el.classList.contains("fixo")) return;
      el.animate(
        [
          { transform: `translateY(${-40 - i * 6}px) scale(.85) rotate(${i % 2 ? 3 : -3}deg)`, opacity: 0 },
          { transform: "translateY(6px) scale(1.03)", opacity: 1, offset: 0.7 },
          { transform: "none", opacity: 1 }
        ],
        { duration: 520, delay: i * 70, easing: "cubic-bezier(.2,.9,.3,1.2)", fill: "backwards" }
      );
    });
  }

  // ---------- Aviso (toast) ----------
  function aviso(msg, ms = 2200) {
    const el = document.createElement("div");
    el.className = "fx-aviso";
    el.innerHTML = msg;
    document.body.appendChild(el);
    el.animate(
      [
        { transform: "translate(-50%, -140%) rotate(-6deg)", opacity: 0 },
        { transform: "translate(-50%, 10%) rotate(3deg)", opacity: 1, offset: 0.15 },
        { transform: "translate(-50%, 0) rotate(-2deg)", opacity: 1, offset: 0.25 },
        { transform: "translate(-50%, 0) rotate(-2deg)", opacity: 1, offset: 0.85 },
        { transform: "translate(-50%, -140%) rotate(4deg)", opacity: 0 }
      ],
      { duration: ms, easing: "ease-in-out", fill: "forwards" }
    ).onfinish = () => el.remove();
  }

  // ---------- Sustos aleatórios ----------
  // Enquanto a pessoa está parada na roleta ou nos resultados, de vez em quando
  // o celular dá uma tremida forte do nada, com uma frase de auditório.
  const FRASES = [
    "Psiu! 👀",
    "Alguém acabou de votar em você 😏",
    "O apresentador tá de olho 🎤",
    "Não fecha não, hein! 📺",
    "Cada voto conta! ✨",
    "Calma, ainda não saiu nada 😱",
    "Tem gente nervosa aí? 🥁",
    "Ninguém sai desse palco! 🚪",
    "Quem quer dinheiro?! 💸"
  ];
  let proximoSusto = 0;
  const agendar = () => { proximoSusto = Date.now() + rand(8000, 20000); }; // a cada 8 a 20 s
  function iniciarSustos(podeAgora) {
    agendar();
    setInterval(() => {
      if (document.hidden || Date.now() < proximoSusto) return;
      agendar();
      if (!podeAgora()) return;
      vibrar("susto");
      tremer(14, 600);
      flash(pick(["#ff2e93", "#ffe600", "#00d4ff"]), 300, 0.45);
      aviso(window.Nucleo ? Nucleo.adesivar(`<span>${pick(FRASES)}</span>`) : pick(FRASES), 2600);
    }, 1000);
  }

  window.FX = {
    vibrar, podeVibrar, vibracaoLiberada, tremer, flash, explodir, explodirEm,
    fogos, letrasPulando, entrada, aviso, iniciarSustos, calmo
  };
})();
