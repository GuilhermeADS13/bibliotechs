import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buscarNaOpenLibrary } from '../openlibrary';

// Reserva, não fonte de igual valor — a medição está no cabeçalho do módulo.
// Estes testes travam o contrato: mesmo formato das sugestões da Google Books,
// e nunca derrubar a busca.

const RESPOSTA = {
  docs: [
    {
      title: 'Torto Arado',
      author_name: ['Itamar Vieira Junior'],
      first_publish_year: 2019,
      cover_i: 12345,
      subject: ['Brazilian fiction', 'Rural life'],
      number_of_pages_median: 264,
    },
    { title: '', author_name: ['Sem Titulo'] },
  ],
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => RESPOSTA })));
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('buscarNaOpenLibrary', () => {
  it('devolve no formato das sugestões, para o formulário não saber a origem', async () => {
    const [livro] = await buscarNaOpenLibrary({ titulo: 'Torto Arado' });
    expect(livro).toMatchObject({
      titulo: 'Torto Arado',
      autor: 'Itamar Vieira Junior',
      genero: 'Brazilian fiction',
      paginas: 264,
      ano: '2019',
      fonte: 'Open Library',
    });
    expect(livro.capa).toContain('12345');
  });

  it('descarta resultado sem título', async () => {
    expect(await buscarNaOpenLibrary({ titulo: 'Torto Arado' })).toHaveLength(1);
  });

  it('não consulta nada com termo curto demais', async () => {
    expect(await buscarNaOpenLibrary({ titulo: 'a' })).toEqual([]);
    expect(await buscarNaOpenLibrary({})).toEqual([]);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  // Reserva que quebra a tela não serve para nada.
  it('devolve lista vazia em erro de rede', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    expect(await buscarNaOpenLibrary({ titulo: 'Torto Arado' })).toEqual([]);
  });

  it('devolve lista vazia em resposta de erro', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503 })));
    expect(await buscarNaOpenLibrary({ titulo: 'Torto Arado' })).toEqual([]);
  });
});
