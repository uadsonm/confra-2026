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
  const MOCK = !cfg.url;
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
    if (MOCK) return Object.values(mockLer()).filter((r) => r.revelado);
    return rest("resultado?select=categoria,vencedor,revelado_em&revelado=eq.true");
  }

  // Admin: tudo, protegido por senha.
  async function adminListar(senha) {
    if (MOCK) {
      if (senha !== "teste") throw new Error("senha invalida");
      return Object.values(mockLer());
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

  window.Nucleo = { avatar, revelados, adminListar, adminSalvar, MOCK };
})();
