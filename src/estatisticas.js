// Cálculo de estatísticas de leitura a partir da estante.
// Lógica pura (sem React) para ser usada tanto pela aba Estatísticas quanto pela B.IA.

export const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
export const MESES_LONGOS = [
  'janeiro','fevereiro','março','abril','maio','junho',
  'julho','agosto','setembro','outubro','novembro','dezembro',
];

// 'paginas' pode vir como string do form ou number da Google Books API.
function numeroPaginas(livro) {
  const n = Number(livro?.paginas);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function nota(livro) {
  const n = Number(livro?.nota);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// Aceita 'YYYY-MM-DD' (form) e ignora valores vazios/inválidos.
export function anoDoLivro(livro) {
  const d = livro?.dataTermino;
  if (typeof d !== 'string' || d.length < 7) return null;
  const ano = Number(d.slice(0, 4));
  return Number.isFinite(ano) ? ano : null;
}

export function mesDoLivro(livro) {
  const d = livro?.dataTermino;
  if (typeof d !== 'string' || d.length < 7) return null;
  const mes = Number(d.slice(5, 7));
  return mes >= 1 && mes <= 12 ? mes - 1 : null;
}

// Agrupa por chave textual, somando quantidade e média de nota.
function ranking(livros, campo) {
  const mapa = new Map();
  for (const l of livros) {
    const bruto = l?.[campo];
    if (typeof bruto !== 'string' || !bruto.trim()) continue;
    const chave = bruto.trim();
    const atual = mapa.get(chave) || { nome: chave, quantidade: 0, somaNotas: 0, comNota: 0 };
    atual.quantidade += 1;
    const n = nota(l);
    if (n > 0) { atual.somaNotas += n; atual.comNota += 1; }
    mapa.set(chave, atual);
  }
  return [...mapa.values()]
    .map(g => ({
      nome: g.nome,
      quantidade: g.quantidade,
      notaMedia: g.comNota > 0 ? Number((g.somaNotas / g.comNota).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.quantidade - a.quantidade || b.notaMedia - a.notaMedia);
}

// Meses consecutivos com pelo menos uma leitura, contados de trás para frente
// a partir do mês corrente (ou de dezembro, se o ano analisado já passou).
function sequenciaAtual(porMes, ano) {
  const agora = new Date();
  const inicio = ano === agora.getFullYear() ? agora.getMonth() : 11;
  let seq = 0;
  for (let i = inicio; i >= 0; i--) {
    if (porMes[i].quantidade > 0) seq += 1;
    else if (seq > 0 || i < inicio) break;
  }
  return seq;
}

export function anosDisponiveis(livros) {
  const anos = new Set();
  for (const l of livros || []) {
    const a = anoDoLivro(l);
    if (a) anos.add(a);
  }
  anos.add(new Date().getFullYear());
  return [...anos].sort((a, b) => b - a);
}

export function calcularEstatisticas(livros, ano = new Date().getFullYear()) {
  const acervo = Array.isArray(livros) ? livros : [];
  const lidos = acervo.filter(l => l?.status === 'lido');
  const lidosNoAno = lidos.filter(l => anoDoLivro(l) === ano);

  const porMes = MESES.map((nome, i) => ({
    indice: i,
    nome,
    nomeLongo: MESES_LONGOS[i],
    quantidade: 0,
    paginas: 0,
    livros: [],
  }));

  for (const l of lidosNoAno) {
    const m = mesDoLivro(l);
    if (m === null) continue;
    porMes[m].quantidade += 1;
    porMes[m].paginas += numeroPaginas(l);
    porMes[m].livros.push(l);
  }

  const mesesAtivos = porMes.filter(m => m.quantidade > 0);
  const maxMes = porMes.reduce((max, m) => Math.max(max, m.quantidade), 0);
  const melhorMes = mesesAtivos.length
    ? mesesAtivos.reduce((melhor, m) => (m.quantidade > melhor.quantidade ? m : melhor))
    : null;

  const comNota = lidos.filter(l => nota(l) > 0);
  const notaMedia = comNota.length
    ? Number((comNota.reduce((s, l) => s + nota(l), 0) / comNota.length).toFixed(1))
    : 0;

  const distribuicaoNotas = [1, 2, 3, 4, 5].map(n => ({
    nota: n,
    quantidade: lidos.filter(l => nota(l) === n).length,
  }));

  const paginasAno = lidosNoAno.reduce((s, l) => s + numeroPaginas(l), 0);
  const total = acervo.length;
  const abandonei = acervo.filter(l => l?.status === 'abandonei').length;

  return {
    ano,
    total,
    lidos: lidos.length,
    lendo: acervo.filter(l => l?.status === 'lendo').length,
    queroLer: acervo.filter(l => l?.status === 'quero-ler').length,
    abandonei,
    lidosNoAno,
    totalNoAno: lidosNoAno.length,
    porMes,
    maxMes,
    melhorMes,
    mesesAtivos: mesesAtivos.length,
    // Média sobre meses com leitura — média sobre 12 meses puniria quem começou em agosto.
    mediaMensal: mesesAtivos.length
      ? Number((lidosNoAno.length / mesesAtivos.length).toFixed(1))
      : 0,
    paginasAno,
    mediaPaginas: lidosNoAno.length ? Math.round(paginasAno / lidosNoAno.length) : 0,
    generos: ranking(lidos, 'genero'),
    autores: ranking(lidos, 'autor'),
    notaMedia,
    distribuicaoNotas,
    taxaConclusao: total ? Number(((lidos.length / total) * 100).toFixed(1)) : 0,
    taxaAbandono: total ? Number(((abandonei / total) * 100).toFixed(1)) : 0,
    sequenciaAtual: sequenciaAtual(porMes, ano),
  };
}

// Resumo em texto para a B.IA comentar o ritmo mensal.
export function resumoMensalTexto(stats) {
  if (stats.totalNoAno === 0) {
    return `Não há registros de conclusão em ${stats.ano}. Sem dados temporais, qualquer análise de ritmo seria especulação.`;
  }
  const partes = [
    `Em ${stats.ano} você concluiu ${stats.totalNoAno} ${stats.totalNoAno === 1 ? 'obra' : 'obras'} ` +
    `distribuídas em ${stats.mesesAtivos} ${stats.mesesAtivos === 1 ? 'mês' : 'meses'}, ` +
    `uma média de ${stats.mediaMensal} por mês ativo.`,
  ];
  if (stats.melhorMes) {
    partes.push(
      `Seu pico foi ${stats.melhorMes.nomeLongo} (${stats.melhorMes.quantidade} ${stats.melhorMes.quantidade === 1 ? 'livro' : 'livros'}).`
    );
  }
  const vazios = 12 - stats.mesesAtivos;
  if (vazios > 0) {
    partes.push(`Restam ${vazios} ${vazios === 1 ? 'mês sem registro' : 'meses sem registro'} — lacunas que sugerem irregularidade ou catalogação incompleta.`);
  }
  if (stats.paginasAno > 0) {
    partes.push(`Volume total: ${stats.paginasAno.toLocaleString('pt-BR')} páginas, média de ${stats.mediaPaginas} por obra.`);
  }
  return partes.join(' ');
}
