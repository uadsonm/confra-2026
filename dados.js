// Dados públicos da votação: pessoas e categorias.
// Os VENCEDORES não ficam aqui: o admin define pelo admin.html e eles ficam no Supabase.
window.CONFRA = {
  titulo: "Melhores do Ano 2026",

  // Supabase > Project Settings > API: "Project URL" e a chave "anon"/"publishable".
  // Essa chave é pública por natureza, pode ficar aqui. Vazio = modo de teste local.
  supabase: {
    url: "https://pmuazzlldkrrhkiwcydg.supabase.co",
    chave: "sb_publishable_BhDR24TOfrpkjJvqWKldJA_iCNvuXUs"
  },

  // Cada nome precisa ser IGUAL ao nome do arquivo em avatar/ (sem o .jpeg).
  pessoas: [
    "Bruna", "Isabella", "Jessé", "João", "Leo",
    "Maria Eduarda", "Maria Vitoria", "Myrlenne", "Nathalia", "Uadson"
  ],

  // Sem "indicados", a categoria concorre com todas as pessoas.
  // Para limitar os concorrentes, adicione: indicados: ["Bruna", "Leo", ...]
  categorias: [
    { id: "bct",          nome: "Topa Tudo por BCT",            emoji: "💸" },
    { id: "yag",          nome: "YAG do Ano",                   emoji: "✨" },
    { id: "apertou22",    nome: "Apertou 22 com Toda Certeza",  emoji: "🗳" },
    { id: "fofoqueiro",   nome: "Melhor Fofoqueiro",            emoji: "🗣" },
    { id: "pavio",        nome: "Mais Pavio Curto",             emoji: "💣" },
    { id: "exestagiario", nome: "Melhor Ex-Estagiário",         emoji: "🎓" },
    { id: "bolo",         nome: "Rainha do Bolo",               emoji: "🎂" },
    { id: "pilha",        nome: "Pilha Tudo",                   emoji: "🔋" },
    { id: "turista",      nome: "Turista do Ano",               emoji: "✈" },
    { id: "servidor",     nome: "Melhor Servidor Público",      emoji: "🫡" }
  ]
};
