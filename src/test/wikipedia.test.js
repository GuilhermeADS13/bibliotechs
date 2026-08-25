import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { contextoWikipedia } from '../wikipedia';

// Respostas reais da Wikipédia, copiadas dos testes ao vivo. As duas travas do
// módulo existem por causa dos casos de baixo — todos observados, nenhum
// inventado.
const PAGINAS = {
  'Annie Ernaux': { title: 'Annie Ernaux', description: 'escritora francesa' },
  'Machado de Assis': { title: 'Machado de Assis', description: 'escritor brasileiro (1839–1908)' },
  'Sally Rooney': { title: 'Sally Rooney', description: 'romancista irlandesa' },
  // A busca por "C. J. Tudor" devolveu isto de verdade.
  'C. J. Tudor': { title: 'Catador de material reciclável', description: null },
  'Torto Arado': { title: 'Torto Arado', description: 'obra literária escrita por Itamar Vieira Junior' },
  'Coracao satanico': { title: 'Angel Heart', description: 'filme de 1987 dirigido por Alan Parker' },
  Machado: { title: 'Machado', description: 'ferramenta de corte' },
};

const RESUMOS = {
  'Torto Arado': { type: 'standard', extract: 'Torto Arado e um romance de Itamar Vieira Junior.' },
  'Angel Heart': { type: 'standard', extract: 'Angel Heart e um filme de 1987.' },
  Machado: { type: 'standard', extract: 'Machado e uma ferramenta de corte.' },
  'Annie Ernaux': { type: 'standard', extract: 'Annie Ernaux, nascida Annie Duchesne é uma escritora e professora francesa.' },
  'Machado de Assis': { type: 'standard', extract: 'Joaquim Maria Machado de Assis foi um escritor brasileiro.' },
  'Sally Rooney': { type: 'standard', extract: 'Sally Rooney é uma escritora e roteirista irlandesa.' },
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    const u = String(url);
    if (u.includes('/search/title')) {
      const q = decodeURIComponent(new URL(u).searchParams.get('q'));
      const p = PAGINAS[q];
      return { ok: true, json: async () => ({ pages: p ? [p] : [] }) };
    }
    const titulo = decodeURIComponent(u.split('/summary/')[1] || '');
    const r = RESUMOS[titulo];
    if (!r) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, json: async () => r };
  }));
});

afterEach(() => { vi.unstubAllGlobals(); });

describe('contextoWikipedia', () => {
  it('traz descrição e resumo de um autor real', async () => {
    const r = await contextoWikipedia('Annie Ernaux');
    expect(r.titulo).toBe('Annie Ernaux');
    expect(r.descricao).toBe('escritora francesa');
    expect(r.resumo).toMatch(/escritora e professora francesa/);
  });

  // Trava 1: o título tem de ser o nome procurado. Este caso é real — a busca
  // por "C. J. Tudor" devolve "Catador de material reciclável", e sem a trava a
  // B.IA falaria disso com toda a confiança.
  it('recusa página cujo título não é o nome procurado', async () => {
    expect(await contextoWikipedia('C. J. Tudor')).toBeNull();
  });

  // Antes isto devolvia null e a informacao se perdia. Descobrir que o nome NAO
  // e de um autor e o dado mais valioso que esta busca produz: a Google Books
  // confirma "Harry Potter" como autor (existe um jurista assim), e sem este
  // desempate a B.IA recebia bibliografia juridica como resposta.
  it('marca como nao-escritor em vez de descartar', async () => {
    const obra = await contextoWikipedia('Torto Arado');
    expect(obra.ehEscritor).toBe(false);
    expect(obra.descricao).toMatch(/obra literaria|obra literária/i);

    const ferramenta = await contextoWikipedia('Machado');
    expect(ferramenta.ehEscritor).toBe(false);
  });

  // O filme cai na trava do titulo, nao na do escritor: a busca por "Coracao
  // satanico" devolve a pagina "Angel Heart", que nao contem o nome procurado.
  // As duas travas se cobrem por caminhos diferentes.
  it('o titulo divergente barra antes de qualquer analise', async () => {
    expect(await contextoWikipedia('Coracao satanico')).toBeNull();
  });

  it('marca escritor de verdade como escritor', async () => {
    expect((await contextoWikipedia('Annie Ernaux')).ehEscritor).toBe(true);
    expect((await contextoWikipedia('Sally Rooney')).ehEscritor).toBe(true);
  });

  it('aceita romancista, não só "escritor"', async () => {
    expect((await contextoWikipedia('Sally Rooney')).descricao).toBe('romancista irlandesa');
  });

  it('ignora nome curto demais sem consultar nada', async () => {
    expect(await contextoWikipedia('ab')).toBeNull();
    expect(await contextoWikipedia('')).toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('devolve null quando a Wikipédia não tem a página', async () => {
    expect(await contextoWikipedia('Fulano de Tal Inexistente')).toBeNull();
  });

  // Contexto extra que falha não pode derrubar a resposta inteira: sem ele a
  // B.IA segue com a Google Books e a própria bagagem.
  it('engole falha de rede', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    expect(await contextoWikipedia('Annie Ernaux')).toBeNull();
  });

  it('trunca resumo longo para não estourar o contexto do modelo', async () => {
    const longo = 'a'.repeat(2000);
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (String(url).includes('/search/title')) {
        return { ok: true, json: async () => ({ pages: [{ title: 'Annie Ernaux', description: 'escritora francesa' }] }) };
      }
      return { ok: true, json: async () => ({ type: 'standard', extract: longo }) };
    }));
    const r = await contextoWikipedia('Annie Ernaux');
    expect(r.resumo.length).toBeLessThanOrEqual(601);
    expect(r.resumo.endsWith('…')).toBe(true);
  });

  it('recusa página de desambiguação', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (String(url).includes('/search/title')) {
        return { ok: true, json: async () => ({ pages: [{ title: 'Machado de Assis', description: 'escritor brasileiro' }] }) };
      }
      return { ok: true, json: async () => ({ type: 'disambiguation', extract: 'pode referir-se a' }) };
    }));
    expect(await contextoWikipedia('Machado de Assis')).toBeNull();
  });
});
