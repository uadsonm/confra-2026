// Lógica compartilhada entre o site (app.js) e o admin (admin.html).
(function () {
  const C = window.CONFRA;

  // Categoria sem "indicados" concorre com todo mundo.
  C.categorias.forEach((c) => {
    if (!c.indicados || !c.indicados.length) c.indicados = C.pessoas.slice();
  });

  // ---------- Avatar ----------
  // Foto da pessoa (avatar/Nome.jpeg). Se o arquivo não existir, mostra as iniciais.
  function avatar(nome, classe = "") {
    const iniciais = nome.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
    const src = "avatar/" + encodeURIComponent(nome.normalize("NFC")) + ".jpeg";
    return `<span class="avatar ${classe}" data-ini="${iniciais}">` +
      `<img src="${src}" alt="" loading="lazy" onerror="this.remove()"></span>`;
  }

  // ---------- Banco (Supabase) ----------
  // Sem url configurada, usa um "banco" falso no próprio navegador (senha: teste),
  // só para testar admin e site no mesmo computador.
  const cfg = C.supabase || {};
  // ?mock na URL força o modo de teste (útil para testar sem mexer no banco real).
  const MOCK = !cfg.url || new URLSearchParams(location.search).has("mock");
  const MOCK_KEY = "confra-mock-banco";
  const mockLer = () => JSON.parse(localStorage.getItem(MOCK_KEY) || "{}");

  async function rest(caminho, corpo) {
    const r = await fetch(cfg.url.replace(/\/$/, "") + "/rest/v1/" + caminho, {
      method: corpo ? "POST" : "GET",
      headers: { apikey: cfg.chave, "Content-Type": "application/json" },
      body: corpo ? JSON.stringify(corpo) : undefined,
      cache: "no-store"
    });
    const texto = await r.text();
    if (!r.ok) {
      let msg = texto;
      try { msg = JSON.parse(texto).message || texto; } catch (e) {}
      throw new Error(msg);
    }
    return texto ? JSON.parse(texto) : null;
  }

  // Público: só as categorias já reveladas.
  async function revelados() {
    if (MOCK) return Object.values(mockLer()).filter((r) => r && r.revelado);
    return rest("resultado?select=categoria,vencedor,revelado_em&revelado=eq.true");
  }

  // Público: número da rodada (muda quando o admin zera a votação).
  // Se a tabela ainda não existir no banco, devolve null e o site segue normal.
  async function rodada() {
    if (MOCK) return mockLer().__rodada || 1;
    try {
      const r = await rest("controle?select=rodada&id=eq.1");
      return r && r[0] ? r[0].rodada : null;
    } catch (e) {
      return null;
    }
  }

  // Admin: esconde tudo que foi revelado e manda todo mundo de volta para a roleta.
  async function adminResetar(senha) {
    if (MOCK) {
      if (senha !== "teste") throw new Error("senha invalida");
      const banco = mockLer();
      Object.values(banco).forEach((r) => { if (r && r.categoria) { r.revelado = false; r.revelado_em = null; } });
      banco.__rodada = (banco.__rodada || 1) + 1;
      banco.__votos = {};
      localStorage.setItem(MOCK_KEY, JSON.stringify(banco));
      return banco.__rodada;
    }
    return rest("rpc/admin_resetar", { p_senha: senha });
  }

  // Admin: tudo, protegido por senha.
  async function adminListar(senha) {
    if (MOCK) {
      if (senha !== "teste") throw new Error("senha invalida");
      return Object.values(mockLer()).filter((r) => r && r.categoria);
    }
    return rest("rpc/admin_listar", { p_senha: senha });
  }

  async function adminSalvar(senha, categoria, vencedor, revelado) {
    if (MOCK) {
      if (senha !== "teste") throw new Error("senha invalida");
      if (revelado && !vencedor) throw new Error("defina o vencedor antes de revelar");
      const banco = mockLer();
      const antes = banco[categoria] || {};
      banco[categoria] = {
        categoria, vencedor, revelado,
        revelado_em: revelado ? antes.revelado_em || new Date().toISOString() : null
      };
      localStorage.setItem(MOCK_KEY, JSON.stringify(banco));
      return;
    }
    await rest("rpc/admin_salvar", {
      p_senha: senha, p_categoria: categoria, p_vencedor: vencedor, p_revelado: revelado
    });
  }

  // ---------- Votos reais ----------
  // Identificador aleatório deste celular (um voto por celular por categoria).
  function aparelho() {
    let id = localStorage.getItem("confra-aparelho");
    if (!id) {
      id = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
      localStorage.setItem("confra-aparelho", id);
    }
    return id;
  }

  // Público: manda o voto. Devolve false se o celular estava numa rodada antiga.
  async function enviarVoto(rodadaAtual, categoria, escolhido) {
    if (MOCK) {
      const banco = mockLer();
      banco.__votos = banco.__votos || {};
      banco.__votos[categoria + "|" + aparelho()] = escolhido;
      localStorage.setItem(MOCK_KEY, JSON.stringify(banco));
      return true;
    }
    return rest("rpc/votar", {
      p_rodada: rodadaAtual || null, p_aparelho: aparelho(), p_categoria: categoria, p_escolhido: escolhido
    });
  }

  // Admin: apuração da rodada atual -> { celulares, votos: [{categoria, escolhido, votos}] }
  async function adminVotos(senha) {
    if (MOCK) {
      if (senha !== "teste") throw new Error("senha invalida");
      const todos = mockLer().__votos || {};
      const cont = {};
      const aparelhos = new Set();
      Object.entries(todos).forEach(([k, escolhido]) => {
        const [categoria, ap] = k.split("|");
        aparelhos.add(ap);
        const chave = categoria + "|" + escolhido;
        cont[chave] = (cont[chave] || 0) + 1;
      });
      const votos = Object.entries(cont).map(([k, n]) => {
        const [categoria, escolhido] = k.split("|");
        return { categoria, escolhido, votos: n };
      }).sort((a, b) => b.votos - a.votos);
      return { celulares: aparelhos.size, votos };
    }
    return rest("rpc/admin_votos", { p_senha: senha });
  }

  // ---------- Emojis em estilo adesivo ----------
  // Cada celular desenha emoji de um jeito; aqui todos usam o mesmo desenho
  // (Twemoji, SVG leve) com borda de adesivo. Se a internet falhar, volta o emoji normal.
  const EMOJI_CDN = "https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg/";
  const emojiUrl = (ch) =>
    EMOJI_CDN + [...ch].map((c) => c.codePointAt(0).toString(16)).filter((c) => c !== "fe0f").join("-") + ".svg";
  const emo = (ch) =>
    `<img class="emo" src="${emojiUrl(ch)}" alt="${ch}" draggable="false" onerror="this.replaceWith(this.alt)">`;
  // Troca todo emoji de um trecho de HTML pelo desenho (só no texto, nunca dentro de tags).
  const RE_EMOJI = /\p{Extended_Pictographic}\uFE0F?/gu;
  const adesivar = (html) => html.replace(/>([^<]+)</g, (m, txt) => ">" + txt.replace(RE_EMOJI, emo) + "<");

  window.Nucleo = {
    emojiUrl, emo, adesivar, avatar, revelados, rodada, enviarVoto,
    adminListar, adminSalvar, adminResetar, adminVotos, MOCK
  };
})();
