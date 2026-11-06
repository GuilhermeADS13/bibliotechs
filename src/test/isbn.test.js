import { describe, it, expect, vi, afterEach } from 'vitest';
import { isbnValido, limparIsbn, buscarPorIsbn } from '../isbn';

describe('isbnValido', () => {
  it('aceita ISBN-13 e ISBN-10 com dígito verificador certo', () => {
    expect(isbnValido('978-0-306-40615-7')).toBe(true);
    expect(isbnValido('9780441013593')).toBe(true);
    expect(isbnValido('0441013597')).toBe(true);
    expect(isbnValido('080442957X')).toBe(true);
  });

  it('recusa dígito errado, tamanho errado e EAN que não é de livro', () => {
    expect(isbnValido('9780441013594')).toBe(false);
    expect(isbnValido('12345')).toBe(false);
    expect(isbnValido('7891000100103')).toBe(false); // código de produto de mercado
  });

  it('limparIsbn tira hífens e espaços', () => {
    expect(limparIsbn(' 978-0-441-01359-3 ')).toBe('9780441013593');
  });
});

describe('buscarPorIsbn', () => {
  afterEach(() => vi.unstubAllGlobals());
  const json = (c, s = 200) => new Response(JSON.stringify(c), { status: s, headers: { 'Content-Type': 'application/json' } });

  it('busca na Google Books pelo ISBN', async () => {
    const espiao = vi.fn(async () => json({ items: [{ volumeInfo: { title: 'Duna', authors: ['Frank Herbert'], pageCount: 680 } }] }));
    vi.stubGlobal('fetch', espiao);
    const r = await buscarPorIsbn('9780441013593');
    expect(String(espiao.mock.calls[0][0])).toContain('q=isbn:9780441013593');
    expect(r).toEqual([expect.objectContaining({ titulo: 'Duna', autor: 'Frank Herbert', paginas: 680 })]);
  });

  it('sem resultado na Google Books, tenta a Open Library', async () => {
    vi.stubGlobal('fetch', vi.fn(async (u) => (String(u).includes('openlibrary')
      ? json({ docs: [{ title: 'Duna', author_name: ['Frank Herbert'] }] })
      : json({ items: [] }))));
    const r = await buscarPorIsbn('9780441013593');
    expect(r[0].titulo).toBe('Duna');
  });

  it('ISBN inválido nem chega a buscar', async () => {
    const espiao = vi.fn();
    vi.stubGlobal('fetch', espiao);
    expect(await buscarPorIsbn('123')).toEqual([]);
    expect(espiao).not.toHaveBeenCalled();
  });
});
