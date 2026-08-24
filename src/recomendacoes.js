// Recomendações personalizadas a partir do histórico de leitura.
// O perfil é montado localmente; a busca de candidatos usa a Google Books API.

const GOOGLE_BOOKS_URL = 'https://www.googleapis.com/books/v1/volumes';

// Normaliza para comparar títulos ignorando acento, caixa e pontuação.
// A remoção dos diacríticos (\p{Mn} = marcas combinantes soltas pelo NFD) precisa
// vir antes da limpeza de pontuação, senão elas virariam espaço e "ação" quebraria
// em "ac ao".
export function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Nota 5 pesa muito mais que nota 3: o objetivo é seguir o que o usuário amou,
// não o que ele apenas tolerou. Livros abandonados pesam negativo.
function pesoPorLivro(livro) {
  const n = Number(livro?.nota) || 0;
  if (livro?.status === 'abandonei') return -1.5;
  if (livro?.status !== 'lido') return 0;
  if (n >= 5) return 3;
  if (n >= 4) return 2;
  if (n >= 3) return 1;
  if (n > 0) return -0.5;
  return 0.5; // lido sem nota ainda conta como interesse
}

// Rótulos que o Google Books devolve e que não dizem nada: metade de uma
// estante real veio marcada como "Fiction". Usados como gênero favorito, levam
// a `subject:Fiction` — que devolve a literatura inteira, do dicionário à Jane
// Austen. Ficam de fora do perfil; o gênero que a pessoa digitou vale mais.
const GENEROS_VAGOS = new Set([
  'fiction', 'ficcao', 'ficção', 'general', 'geral', 'literature', 'literatura',
  'literary collections', 'juvenile fiction', 'books', 'livros',
]);

function generoVago(nome) {
  return GENEROS_VAGOS.has(normalizar(nome));
}

function acumular(mapa, chave, peso) {
  if (typeof chave !== 'string' || !chave.trim()) return;
  const nome = chave.trim();
  mapa.set(nome, (mapa.get(nome) || 0) + peso);
}

export function perfilLeitor(livros) {
  const acervo = Array.isArray(livros) ? livros : [];
  const generos = new Map();
  const autores = new Map();

  for (const l of acervo) {
    const peso = pesoPorLivro(l);
    if (peso === 0) continue;
    if (!generoVago(l.genero)) acumular(generos, l.genero, peso);
    acumular(autores, l.autor, peso);
  }

  const ordenar = mapa => [...mapa.entries()]
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([nome, score]) => ({ nome, score }));

  const lidos = acervo.filter(l => l?.status === 'lido');
  const comNota = lidos.filter(l => Number(l?.nota) > 0);

  return {
    generosFavoritos: ordenar(generos),
    autoresFavoritos: ordenar(autores),
    totalLidos: lidos.length,
    notaMedia: comNota.length
      ? Number((comNota.reduce((s, l) => s + Number(l.nota), 0) / comNota.length).toFixed(1))
      : 0,
    // Títulos já na estante — usados para não recomendar o que o usuário já tem.
    titulosConhecidos: new Set(acervo.map(l => normalizar(l?.titulo)).filter(Boolean)),
  };
}

async function buscarVolumes(termo, chave, sinal) {
  const keyParam = chave ? `&key=${chave}` : '';
  const url = `${GOOGLE_BOOKS_URL}?q=${encodeURIComponent(termo)}&maxResults=10&langRestrict=pt&orderBy=relevance${keyParam}`;
  const res = await fetch(url, { signal: sinal });
  if (!res.ok) {
    // O motivo importa e não aparecia em lugar nenhum: chave expirada e cota
    // estourada dão erros diferentes, e ambos derrubam a busca em silêncio.
    const detalhe = await res.json().catch(() => null);
    const msg = detalhe?.error?.message || '';
    console.error('Google Books falhou:', res.status, msg || '(sem detalhe)');
    throw new Error(`Google Books respondeu ${res.status}${msg ? `: ${msg}` : ''}`);
  }
  const data = await res.json();
  return data.items || [];
}

function paraLivro(item, motivo) {
  const v = item?.volumeInfo || {};
  return {
    id: item?.id,
    titulo: v.title || '',
    autor: v.authors?.join(', ') || 'Desconhecido',
    genero: v.categories?.[0] || '',
    paginas: v.pageCount || '',
    capa: v.imageLinks?.thumbnail?.replace(/^http:/, 'https:') || '',
    descricao: v.description || '',
    ratingMedio: v.averageRating || 0,
    ano: v.publishedDate?.slice(0, 4) || '',
    motivo,
  };
}

/**
 * Gera recomendações a partir do histórico.
 * Estratégia: busca por gênero favorito e por autor favorito, remove o que já
 * está na estante e ordena por avaliação média do Google Books.
 */
export async function gerarRecomendacoes(livros, { googleBooksKey = '', limite = 6, sinal } = {}) {
  const perfil = perfilLeitor(livros);

  if (perfil.totalLidos === 0) {
    return { recomendacoes: [], perfil, motivo: 'sem-historico' };
  }

  const buscas = [];
  for (const g of perfil.generosFavoritos.slice(0, 2)) {
    buscas.push({ termo: `subject:${g.nome}`, motivo: `Você avalia bem ${g.nome}` });
  }
  for (const a of perfil.autoresFavoritos.slice(0, 2)) {
    buscas.push({ termo: `inauthor:${a.nome}`, motivo: `Outro título de ${a.nome}` });
  }
  if (buscas.length === 0) {
    return { recomendacoes: [], perfil, motivo: 'sem-generos' };
  }

  // allSettled: uma busca que falhe não pode derrubar as demais.
  const resultados = await Promise.allSettled(
    buscas.map(b => buscarVolumes(b.termo, googleBooksKey, sinal))
  );

  const vistos = new Set();
  const candidatos = [];

  resultados.forEach((r, i) => {
    if (r.status !== 'fulfilled') return;
    for (const item of r.value) {
      const livro = paraLivro(item, buscas[i].motivo);
      if (!livro.titulo) continue;

      const chave = normalizar(livro.titulo);
      if (vistos.has(chave)) continue;                   // duplicado entre buscas
      if (perfil.titulosConhecidos.has(chave)) continue; // já está na estante

      vistos.add(chave);
      candidatos.push(livro);
    }
  });

  if (candidatos.length === 0) {
    return { recomendacoes: [], perfil, motivo: 'sem-resultados' };
  }

  // Prioriza obras bem avaliadas; sem rating, mantém a ordem de relevância da API.
  candidatos.sort((a, b) => (b.ratingMedio || 0) - (a.ratingMedio || 0));

  return {
    recomendacoes: candidatos.slice(0, limite),
    perfil,
    motivo: 'ok',
  };
}

/**
 * Confirma que um autor existe e devolve obras reais dele.
 *
 * Existe porque a B.IA só enxergava autores JÁ cadastrados na estante: quando a
 * pessoa perguntava por uma autora que ainda não lê — o caso mais natural do
 * mundo, "quero ler a fulana, o que você acha?" — o nome era descartado e a
 * resposta saía sobre outro autor, ou pedindo que ela dissesse de quem estava
 * falando. Ela tinha acabado de dizer.
 *
 * Sem `langRestrict`: filtrar por português esconde autor estrangeiro sem
 * tradução, e aqui o objetivo é confirmar que a pessoa existe, não vender a
 * edição brasileira.
 */
export async function buscarAutor(nome, { googleBooksKey = '', sinal } = {}) {
  const alvo = String(nome || '').trim();
  if (alvo.length < 3) return null;

  const keyParam = googleBooksKey ? `&key=${googleBooksKey}` : '';
  const url = `${GOOGLE_BOOKS_URL}?q=${encodeURIComponent(`inauthor:"${alvo}"`)}`
    + `&maxResults=20&orderBy=relevance${keyParam}`;

  let itens;
  try {
    const res = await fetch(url, { signal: sinal });
    if (!res.ok) {
      const detalhe = await res.json().catch(() => null);
      console.error('Google Books (autor) falhou:', res.status, detalhe?.error?.message || '(sem detalhe)');
      return null;
    }
    itens = (await res.json()).items || [];
  } catch (e) {
    if (e?.name !== 'AbortError') console.error('Erro ao buscar autor:', e);
    return null;
  }

  // `inauthor:` é generoso: buscar "Colleen" traz qualquer Colleen. Só vale como
  // confirmação se TODAS as palavras do nome aparecerem no autor do volume —
  // é o que separa uma autora de verdade de um trecho de frase capturado por
  // engano ("quero ler mais esse ano").
  const palavras = normalizar(alvo).split(' ').filter(Boolean);
  const confere = (autores) => {
    const texto = normalizar((autores || []).join(' '));
    return palavras.every(p => texto.includes(p));
  };

  const validos = itens.filter(i => confere(i?.volumeInfo?.authors));
  if (validos.length === 0) return null;

  // Nome canônico: a grafia mais frequente entre os volumes confirmados. Corrige
  // acento e abreviação que a pessoa digitou de outro jeito.
  const frequencia = new Map();
  for (const item of validos) {
    for (const a of item.volumeInfo.authors || []) {
      if (!confere([a])) continue;
      frequencia.set(a, (frequencia.get(a) || 0) + 1);
    }
  }
  const canonico = [...frequencia.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || alvo;

  const vistos = new Set();
  const obras = [];
  for (const item of validos) {
    const livro = paraLivro(item, '');
    if (!livro.titulo) continue;
    const chave = normalizar(livro.titulo);
    if (!chave || vistos.has(chave)) continue;
    // Coletâneas e biografias trazem o nome do autor no título e afogam a obra
    // que a pessoa quer conhecer — foi o que aconteceu com Frank Herbert.
    if (chave.includes(normalizar(canonico))) continue;
    vistos.add(chave);
    obras.push({
      titulo: livro.titulo,
      ano: livro.ano,
      genero: livro.genero,
      ratingMedio: livro.ratingMedio,
    });
  }

  // Bem avaliadas primeiro; sem nota, mantém a relevância que a API devolveu.
  obras.sort((a, b) => (b.ratingMedio || 0) - (a.ratingMedio || 0));

  return { nome: canonico, obras: obras.slice(0, 6) };
}
