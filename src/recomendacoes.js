// Recomendações personalizadas a partir do histórico de leitura.
// O perfil é montado localmente; a busca de candidatos usa a Google Books API,
// com a Open Library de reserva quando ela não responde.

import { buscarNaOpenLibrary } from './openlibrary';

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

// A chave é a forma normalizada: "Machado de Assis" e "machado de assis" eram
// dois autores, cada um com metade da pontuação, e um autor lido uma vez
// passava à frente de quem a pessoa leu duas. O nome exibido é a primeira
// grafia vista. `exemplo` guarda o livro de maior peso, que vira o motivo
// mostrado no card ("Porque você gostou de Dom Casmurro").
function acumular(mapa, chave, peso, livro) {
  if (typeof chave !== 'string' || !chave.trim()) return;
  const id = normalizar(chave);
  if (!id) return;
  const atual = mapa.get(id) || { nome: chave.trim(), score: 0, exemplo: '', pesoExemplo: -Infinity };
  atual.score += peso;
  if (livro?.titulo && peso > atual.pesoExemplo) {
    atual.exemplo = livro.titulo;
    atual.pesoExemplo = peso;
  }
  mapa.set(id, atual);
}

export function perfilLeitor(livros) {
  const acervo = Array.isArray(livros) ? livros : [];
  const generos = new Map();
  const autores = new Map();

  for (const l of acervo) {
    const peso = pesoPorLivro(l);
    if (peso === 0) continue;
    if (!generoVago(l.genero)) acumular(generos, l.genero, peso, l);
    // Coautoria vem como "A, B" da Google Books. Junta, a busca procuraria um
    // autor chamado "A, B" — que não existe.
    for (const autor of String(l.autor || '').split(',')) acumular(autores, autor, peso, l);
  }

  const ordenar = mapa => [...mapa.values()]
    .filter(a => a.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ nome, score, exemplo, pesoExemplo }) => ({ nome, score, exemplo, gostou: pesoExemplo >= 2 }));

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
    titulosConhecidos: new Set(acervo.map(l => chaveTitulo(l?.titulo)).filter(Boolean)),
  };
}

/**
 * Chave de comparação de título, sem o subtítulo.
 *
 * Com "Dom Casmurro" na estante, "Dom Casmurro - Edição de bolso" passava pelo
 * filtro e era recomendado como novidade. Cortar no primeiro ":" ou " - " junta
 * as edições do mesmo livro. O custo é juntar também duas obras que só diferem
 * no subtítulo — raro, e bem menos grave que recomendar o que a pessoa já leu.
 */
export function chaveTitulo(titulo) {
  return normalizar(String(titulo || '').split(/:|\s[-–—]\s/)[0]);
}

/**
 * Gênero como a Google Books o cataloga.
 *
 * A API classifica em inglês (BISAC), e o gênero digitado em português quase
 * nunca bate. Medido com `langRestrict=pt`:
 *
 *   subject:Fantasia            partituras de piano ("Fantaisie-caprice")
 *   subject:"Fantasy"           Tolkien, Le Guin, Harry Potter
 *   subject:Ficção Científica   2 resultados, ambos de crítica literária
 *   subject:"Science Fiction"   Asimov, Lem, Octavia Butler, Pynchon
 *   subject:Terror              história do terrorismo misturada a Stephen King
 *   subject:"Horror"            Stephen King, Le Fanu, Peter Straub
 *
 * Gênero fora da tabela segue como foi digitado — pode já estar em inglês,
 * como os que vêm preenchidos pela própria Google Books.
 */
const GENERO_PARA_ASSUNTO = {
  'fantasia': 'Fantasy',
  'fantasia epica': 'Fantasy',
  'ficcao cientifica': 'Science Fiction',
  'sci fi': 'Science Fiction',
  'terror': 'Horror',
  'horror': 'Horror',
  'suspense': 'Thrillers',
  'thriller': 'Thrillers',
  'misterio': 'Mystery',
  'policial': 'Mystery',
  'romance policial': 'Mystery',
  'crime': 'Crime',
  'distopia': 'Dystopias',
  'ficcao historica': 'Historical fiction',
  'romance historico': 'Historical fiction',
  'biografia': 'Biography',
  'autobiografia': 'Autobiography',
  'memorias': 'Autobiography',
  'historia': 'History',
  'autoajuda': 'Self-Help',
  'auto ajuda': 'Self-Help',
  'desenvolvimento pessoal': 'Self-Help',
  'filosofia': 'Philosophy',
  'poesia': 'Poetry',
  'psicologia': 'Psychology',
  'negocios': 'Business',
  'economia': 'Economics',
  'politica': 'Political Science',
  'religiao': 'Religion',
  'espiritualidade': 'Spirituality',
  'classico': 'Classics',
  'classicos': 'Classics',
  'jovem adulto': 'Young Adult Fiction',
  'young adult': 'Young Adult Fiction',
  'contos': 'Short stories',
  'humor': 'Humor',
  'aventura': 'Adventure',
  'ciencia': 'Science',
  'literatura brasileira': 'Brazilian literature',
};

export function assuntoDoGenero(genero) {
  const chave = normalizar(genero);
  return GENERO_PARA_ASSUNTO[chave] || String(genero || '').trim();
}

// Aspas nos termos: sem elas, `inauthor:Machado de Assis` prende só "Machado"
// ao autor e solta "de Assis" em qualquer campo — a busca devolvia coletâneas
// ("MACHADO DE ASSIS: Cartas Selecionadas") no lugar de Dom Casmurro.
const entreAspas = (texto) => `"${String(texto || '').replace(/"/g, '').trim()}"`;

async function buscarVolumes(termo, chave, sinal) {
  const keyParam = chave ? `&key=${chave}` : '';
  const url = `${GOOGLE_BOOKS_URL}?q=${encodeURIComponent(termo)}&maxResults=20&langRestrict=pt&orderBy=relevance${keyParam}`;
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
    // A API às vezes manda o nome com pontuação na frente — medido:
    // [", Machado de Assis"] em Memórias Póstumas — e o card mostrava a vírgula.
    autor: (v.authors || [])
      .map(a => String(a || '').replace(/^[\s,;.]+|[\s,;]+$/g, ''))
      .filter(Boolean)
      .join(', ') || 'Desconhecido',
    genero: v.categories?.[0] || '',
    paginas: v.pageCount || '',
    capa: v.imageLinks?.thumbnail?.replace(/^http:/, 'https:') || '',
    descricao: v.description || '',
    ratingMedio: v.averageRating || 0,
    totalAvaliacoes: v.ratingsCount || 0,
    idioma: v.language || '',
    ano: v.publishedDate?.slice(0, 4) || '',
    motivo,
  };
}

/**
 * Nota "bayesiana": a média puxada para um valor neutro conforme há poucos votos.
 *
 * Pela média crua, um livro com nota 5 dada por UMA pessoa passava à frente de
 * um 4,5 com duas mil avaliações. Com o ajuste, um voto só quase não move a
 * nota; muitos votos a levam para a média real. Sem avaliação nenhuma, o livro
 * fica no neutro — e a ordenação estável preserva a relevância da API.
 */
const NOTA_NEUTRA = 3.5;
const VOTOS_DE_CONFIANCA = 5;

export function notaAjustada(livro) {
  const media = Number(livro?.ratingMedio) || 0;
  if (media <= 0) return NOTA_NEUTRA;
  const votos = Number(livro?.totalAvaliacoes) || 1;
  return (media * votos + NOTA_NEUTRA * VOTOS_DE_CONFIANCA) / (votos + VOTOS_DE_CONFIANCA);
}

// Mesmo com `langRestrict=pt`, a busca por assunto devolve edições em inglês e
// espanhol. Ficam no fim, não fora: melhor uma sugestão em inglês que nenhuma.
const emPortugues = (livro) => (livro.idioma ? livro.idioma.startsWith('pt') : true);

function ordenarCandidatos(lista) {
  return [...lista].sort((a, b) =>
    (emPortugues(b) - emPortugues(a)) || (notaAjustada(b) - notaAjustada(a))
  );
}

// Coletâneas e biografias trazem o nome do autor no título ("Machado de Assis:
// obra completa") e não são a obra que a pessoa procura.
function ehColetaneaDoAutor(livro) {
  const autor = normalizar(String(livro.autor || '').split(',')[0]);
  return autor.length > 0 && autor.includes(' ') && normalizar(livro.titulo).includes(autor);
}

// Teto de titulos do mesmo autor numa rodada de recomendacoes.
const MAX_POR_AUTOR = 2;

/**
 * Espalha as recomendacoes entre autores diferentes.
 *
 * Numa estante com UM livro lido, o genero vinha marcado como "Fiction" — vago
 * demais, entao descartado — e sobrava so a busca por autor favorito. Resultado
 * na tela: seis livros do mesmo autor sob o titulo "Recomendado para voce".
 *
 * Isso contradiz a propria instrucao que a B.IA carrega, de que recomendar so o
 * que a pessoa ja aprova reforca o vies. O teto vale na primeira passada; se
 * faltar candidato para completar a lista, a segunda passada preenche com o que
 * sobrou — melhor repetir autor do que devolver menos do que cabe.
 */
function diversificar(candidatos, limite) {
  const porAutor = new Map();
  const escolhidos = [];

  for (const livro of candidatos) {
    if (escolhidos.length >= limite) break;
    const chave = normalizar(String(livro.autor || '').split(',')[0]);
    const quantos = porAutor.get(chave) || 0;
    if (quantos >= MAX_POR_AUTOR) continue;
    porAutor.set(chave, quantos + 1);
    escolhidos.push(livro);
  }

  if (escolhidos.length < limite) {
    for (const livro of candidatos) {
      if (escolhidos.length >= limite) break;
      if (!escolhidos.includes(livro)) escolhidos.push(livro);
    }
  }

  return escolhidos;
}

/**
 * Ordena a fila inteira em páginas, cada uma diversificada por autor.
 *
 * Existe para o botão de atualizar: antes ele refazia a mesma busca, com a
 * mesma ordenação, e mostrava exatamente a mesma lista — só gastava cota. Agora
 * a fila é buscada uma vez e o botão avança para a página seguinte.
 */
function paginar(candidatos, tamanho) {
  const restantes = [...candidatos];
  const fila = [];
  while (restantes.length > 0) {
    const pagina = diversificar(restantes, tamanho);
    for (const livro of pagina) restantes.splice(restantes.indexOf(livro), 1);
    fila.push(...pagina);
  }
  return fila;
}

/**
 * Intercala as buscas: um de cada, em rodízio.
 *
 * Quase nenhum livro em português tem avaliação na Google Books (0 a 5 em cada
 * 10, medido), então ordenar tudo junto por nota deixava a lista na ordem das
 * buscas — e os seis primeiros vinham todos do primeiro gênero.
 */
function intercalar(listas) {
  const resultado = [];
  const maior = Math.max(0, ...listas.map(l => l.length));
  for (let i = 0; i < maior; i++) {
    for (const lista of listas) if (i < lista.length) resultado.push(lista[i]);
  }
  return resultado;
}

function motivoDoGenero(g) {
  if (!g.exemplo) return `Você curte ${g.nome}`;
  return g.gostou ? `Porque você gostou de ${g.exemplo}` : `Porque você leu ${g.exemplo}`;
}

/** Converte o resultado da Open Library para o formato das recomendações. */
function daOpenLibrary(livro, motivo) {
  return {
    id: '',
    titulo: livro.titulo,
    autor: livro.autor || 'Desconhecido',
    genero: livro.genero || '',
    paginas: livro.paginas || '',
    capa: livro.capa || '',
    descricao: '',
    ratingMedio: 0,
    totalAvaliacoes: 0,
    idioma: '',
    ano: livro.ano || '',
    motivo,
  };
}

/**
 * Gera recomendações a partir do histórico.
 *
 * Estratégia: busca por gênero favorito e por autor favorito, remove o que já
 * está na estante, ordena cada busca pela nota ajustada e intercala as buscas.
 *
 * Devolve `recomendacoes` (a primeira página) e `fila` (todas as candidatas, já
 * em páginas diversificadas), para a tela avançar sem buscar de novo.
 *
 * Motivos: 'ok', 'sem-historico', 'sem-generos' (campos vazios),
 * 'sem-favoritos' (há leituras, mas nenhuma bem avaliada), 'sem-resultados' e
 * 'falha-busca' (nenhuma fonte respondeu — não é o mesmo que "nada novo").
 */
export async function gerarRecomendacoes(livros, { googleBooksKey = '', limite = 6, sinal } = {}) {
  const perfil = perfilLeitor(livros);

  if (perfil.totalLidos === 0) {
    return { recomendacoes: [], fila: [], perfil, motivo: 'sem-historico' };
  }

  const buscas = [];
  for (const g of perfil.generosFavoritos.slice(0, 2)) {
    const assunto = assuntoDoGenero(g.nome);
    buscas.push({ termo: `subject:${entreAspas(assunto)}`, reserva: { assunto }, motivo: motivoDoGenero(g) });
  }
  for (const a of perfil.autoresFavoritos.slice(0, 2)) {
    buscas.push({ termo: `inauthor:${entreAspas(a.nome)}`, reserva: { autor: a.nome }, motivo: `Mais de ${a.nome}` });
  }
  if (buscas.length === 0) {
    // Com leituras preenchidas, o que falta não é dado: é leitura bem avaliada.
    // Antes a tela pedia para preencher gênero e autor que já estavam lá.
    const preenchido = (livros || []).some(l =>
      (l?.status === 'lido' || l?.status === 'abandonei')
      && (String(l?.autor || '').trim() || (l?.genero && !generoVago(l.genero)))
    );
    return { recomendacoes: [], fila: [], perfil, motivo: preenchido ? 'sem-favoritos' : 'sem-generos' };
  }

  // allSettled: uma busca que falhe não pode derrubar as demais.
  const resultados = await Promise.allSettled(
    buscas.map(b => buscarVolumes(b.termo, googleBooksKey, sinal))
  );
  if (sinal?.aborted) throw new DOMException('Busca cancelada', 'AbortError');

  let listas;
  let reserva = false;
  if (resultados.every(r => r.status === 'rejected')) {
    // Cota estourada ou rede fora. Antes isso aparecia como "nada novo
    // encontrado — adicione livros de outros gêneros", culpando a estante.
    listas = await Promise.all(buscas.map(async b =>
      (await buscarNaOpenLibrary({ ...b.reserva, limite: 10 })).map(l => daOpenLibrary(l, b.motivo))
    ));
    if (listas.every(l => l.length === 0)) {
      return { recomendacoes: [], fila: [], perfil, motivo: 'falha-busca' };
    }
    reserva = true;
  } else {
    listas = resultados.map((r, i) =>
      r.status === 'fulfilled' ? r.value.map(item => paraLivro(item, buscas[i].motivo)) : []
    );
  }

  const filtradas = listas.map(lista => ordenarCandidatos(
    lista.filter(l => l.titulo && !perfil.titulosConhecidos.has(chaveTitulo(l.titulo)) && !ehColetaneaDoAutor(l))
  ));

  const vistos = new Set();
  const candidatos = [];
  for (const livro of intercalar(filtradas)) {
    const chave = chaveTitulo(livro.titulo);
    if (vistos.has(chave)) continue; // a mesma obra vinda de buscas ou edições diferentes
    vistos.add(chave);
    candidatos.push(livro);
  }

  if (candidatos.length === 0) {
    return { recomendacoes: [], fila: [], perfil, motivo: 'sem-resultados' };
  }

  const fila = paginar(candidatos, limite);
  return {
    recomendacoes: fila.slice(0, limite),
    fila,
    perfil,
    motivo: 'ok',
    ...(reserva ? { fonte: 'Open Library' } : {}),
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
