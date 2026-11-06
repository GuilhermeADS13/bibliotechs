// ISBN: validação e busca do livro pelo código de barras.

import { buscarNaOpenLibrary } from './openlibrary';

const GOOGLE_BOOKS_URL = 'https://www.googleapis.com/books/v1/volumes';

/** Só dígitos (e X final do ISBN-10). */
export function limparIsbn(valor) {
  return String(valor || '').toUpperCase().replace(/[^0-9X]/g, '');
}

/**
 * Confere o dígito verificador. Sem isso, um código de barras lido pela metade
 * (ou o EAN de um produto qualquer) virava uma busca inútil.
 */
export function isbnValido(valor) {
  const d = limparIsbn(valor);
  if (d.length === 13) {
    if (!/^97[89]\d{10}$/.test(d)) return false; // EAN de livro começa com 978/979
    const soma = [...d.slice(0, 12)].reduce((s, c, i) => s + Number(c) * (i % 2 ? 3 : 1), 0);
    return (10 - (soma % 10)) % 10 === Number(d[12]);
  }
  if (d.length === 10) {
    if (!/^\d{9}[\dX]$/.test(d)) return false;
    const soma = [...d].reduce((s, c, i) => s + (c === 'X' ? 10 : Number(c)) * (10 - i), 0);
    return soma % 11 === 0;
  }
  return false;
}

/**
 * Busca o livro pelo ISBN. Google Books primeiro (melhor em edições
 * brasileiras); Open Library de reserva. Devolve uma lista no formato das
 * sugestões do formulário — vazia se nada for achado.
 */
export async function buscarPorIsbn(isbn, { googleBooksKey = '' } = {}) {
  const d = limparIsbn(isbn);
  if (!isbnValido(d)) return [];

  try {
    const key = googleBooksKey ? `&key=${googleBooksKey}` : '';
    const res = await fetch(`${GOOGLE_BOOKS_URL}?q=isbn:${d}&maxResults=3${key}`);
    if (res.ok) {
      const itens = (await res.json()).items || [];
      if (itens.length > 0) {
        return itens.map(item => {
          const v = item.volumeInfo || {};
          return {
            titulo: v.title || '',
            autor: (v.authors || []).join(', ') || 'Desconhecido',
            genero: v.categories?.[0] || '',
            paginas: v.pageCount || '',
            capa: v.imageLinks?.thumbnail?.replace(/^http:/, 'https:') || '',
          };
        }).filter(l => l.titulo);
      }
    }
  } catch (e) {
    console.error('Google Books (ISBN) falhou:', e);
  }

  return buscarNaOpenLibrary({ isbn: d, limite: 3 });
}
