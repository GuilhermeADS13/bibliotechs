// Contas da leitura em andamento: progresso, ritmo, previsão, duração e
// séries. Tudo puro e em código — a B.IA recebe os números prontos, pelo mesmo
// princípio de src/estatisticas.js: modelo de linguagem erra conta.

const DIA_MS = 24 * 60 * 60 * 1000;

export const hojeISO = (agora = new Date()) => {
  const d = new Date(agora);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Datas do formulário são "AAAA-MM-DD", sem hora. Comparar como meia-noite
// local evita o dia a menos que `new Date('2026-03-10')` (UTC) daria no Brasil.
function paraDia(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function diasEntre(inicioISO, fimISO) {
  const a = paraDia(inicioISO);
  const b = paraDia(fimISO);
  if (!a || !b || b < a) return null;
  return Math.round((b - a) / DIA_MS);
}

const inteiro = (v) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * Progresso de um livro em leitura.
 *
 * `previsao` só existe com data de início e algum avanço: sem ritmo medido,
 * qualquer data seria chute. O ritmo conta pelo menos um dia, para quem
 * começou hoje não ter "300 páginas por dia".
 */
export function progressoDe(livro, hoje = hojeISO()) {
  const total = inteiro(livro?.paginas);
  const atual = Math.min(inteiro(livro?.paginaAtual), total || Infinity);
  if (!atual && !total) return null;

  const pct = total ? Math.round((atual / total) * 100) : null;
  const diasLendo = livro?.dataInicio ? diasEntre(livro.dataInicio, hoje) : null;

  let paginasPorDia = null;
  let previsao = null;
  if (diasLendo !== null && atual > 0) {
    paginasPorDia = Number((atual / Math.max(1, diasLendo)).toFixed(1));
    if (total && atual < total && paginasPorDia > 0) {
      const faltam = Math.ceil((total - atual) / paginasPorDia);
      const fim = paraDia(hoje);
      fim.setDate(fim.getDate() + faltam);
      previsao = hojeISO(fim);
    }
  }

  return { paginaAtual: atual, total, pct, diasLendo, paginasPorDia, previsao, terminou: !!total && atual >= total };
}

/** Quantos dias o livro levou para ser lido, ou null sem as duas datas. */
export function duracaoDe(livro) {
  if (livro?.status !== 'lido') return null;
  return diasEntre(livro.dataInicio, livro.dataTermino);
}

/** Média de dias por livro lido, só entre os que têm início e término. */
export function duracaoMedia(livros) {
  const duracoes = (livros || []).map(duracaoDe).filter(d => d !== null);
  if (duracoes.length === 0) return null;
  return { dias: Math.round(duracoes.reduce((s, d) => s + d, 0) / duracoes.length), livros: duracoes.length };
}

const chaveSerie = (s) => String(s || '').normalize('NFD').replace(/\p{Mn}/gu, '').toLowerCase().trim();

/**
 * Séries em que a pessoa parou no meio: leu até o volume N e o N+1 ainda não
 * está na estante (em nenhum status).
 *
 * Não diz qual é o título do próximo volume — isso exigiria uma fonte que a
 * Google Books não dá de forma confiável ("Duna 2" é "O Messias de Duna").
 * A tela oferece a busca; a B.IA, que conhece as séries, pode nomear.
 */
export function seriesEmAndamento(livros) {
  const series = new Map();
  for (const l of livros || []) {
    const chave = chaveSerie(l?.serie);
    const volume = inteiro(l?.volume);
    if (!chave || !volume) continue;
    const s = series.get(chave) || { serie: String(l.serie).trim(), autor: '', lidos: [], naEstante: new Set() };
    s.naEstante.add(volume);
    if (l.status === 'lido') {
      s.lidos.push(volume);
      if (!s.autor && l.autor) s.autor = String(l.autor).split(',')[0].trim();
    }
    series.set(chave, s);
  }

  const resultado = [];
  for (const s of series.values()) {
    if (s.lidos.length === 0) continue;
    const ultimoLido = Math.max(...s.lidos);
    const proximo = ultimoLido + 1;
    if (s.naEstante.has(proximo)) continue;
    resultado.push({ serie: s.serie, autor: s.autor, ultimoLido, proximo });
  }
  return resultado;
}
