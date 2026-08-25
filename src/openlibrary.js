// Reserva de busca de livros, para quando a Google Books não responde.
//
// NÃO é fonte de igual valor, e a medição diz por quê. Nas mesmas buscas:
//
//   "coracao satanico"   OL: "Abrindo o Coração"    GB: "Coração satânico"  ✓
//   "o alquimista"       OL: Paulo Coelho ✓          GB: Paulo Coelho ✓
//   "a redoma de vidro"  OL: "The Bell Jar"          GB: edição em português ✓
//
// Ela é mais fraca em português: erra o título brasileiro e prefere o original
// em inglês. Misturada com a Google Books em pé de igualdade, pioraria a busca —
// por isso só entra quando a outra não devolveu nada.
//
// Como reserva, ganha dois casos reais: obra que a Google Books não tem, e cota
// diária estourada, que aconteceu duas vezes só nos testes de hoje. Sem chave,
// sem cota própria, e manda `access-control-allow-origin: *`.

const BUSCA = 'https://openlibrary.org/search.json';
const CAPA = 'https://covers.openlibrary.org/b/id';
const TIMEOUT_MS = 8000;

/**
 * Busca livros por título e/ou autor. Devolve [] em qualquer falha — é reserva,
 * e reserva que quebra a tela não serve para nada.
 *
 * O formato de saída é o mesmo das sugestões da Google Books, para o formulário
 * não precisar saber de onde veio.
 */
export async function buscarNaOpenLibrary({ titulo = '', autor = '', limite = 6 } = {}) {
  const partes = [];
  if (titulo.trim().length >= 2) partes.push(`title=${encodeURIComponent(titulo.trim())}`);
  if (autor.trim().length >= 2) partes.push(`author=${encodeURIComponent(autor.trim())}`);
  if (partes.length === 0) return [];

  const url = `${BUSCA}?${partes.join('&')}`
    + `&fields=title,author_name,first_publish_year,cover_i,subject,number_of_pages_median`
    + `&limit=${limite}`;

  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), TIMEOUT_MS);

  try {
    // Nao exige chave, mas corta rajada — seis requisicoes seguidas num teste
    // deram ECONNRESET. Identificar-se e o que essas APIs publicas pedem de
    // quem as usa. No navegador `User-Agent` e proibido e simplesmente
    // ignorado; fora dele, vale.
    const res = await fetch(url, {
      signal: controle.signal,
      headers: { 'User-Agent': 'bibliotech/1.0 (https://bibliotechs.vercel.app)' },
    });
    if (!res.ok) throw new Error(`Open Library respondeu ${res.status}`);
    const dados = await res.json();

    return (dados.docs || []).map(d => ({
      titulo: d.title || '',
      autor: (d.author_name || []).join(', '),
      // A Open Library devolve dezenas de assuntos, do específico ao genérico.
      // O primeiro costuma ser o mais próximo de um gênero.
      genero: (d.subject || [])[0] || '',
      paginas: d.number_of_pages_median || '',
      capa: d.cover_i ? `${CAPA}/${d.cover_i}-M.jpg` : '',
      ano: d.first_publish_year ? String(d.first_publish_year) : '',
      fonte: 'Open Library',
    })).filter(l => l.titulo);
  } catch (e) {
    if (e?.name !== 'AbortError') console.error('Open Library falhou:', e);
    return [];
  } finally {
    clearTimeout(timer);
  }
}
