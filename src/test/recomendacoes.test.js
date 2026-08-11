import { describe, it, expect, vi, afterEach } from 'vitest';
import { sugerirAutores } from '../recomendacoes';

// Pedido da cliente: "baseado nesse autor me indica um autor parecido — aí vai
// no Google Books e vê o autor que mais se encaixa".
describe('sugerirAutores', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  const volume = (titulo, autores, categorias = [], rating = 0) => ({
    volumeInfo: {
      title: titulo, authors: autores, categories: categorias,
      publishedDate: '1965', ...(rating ? { averageRating: rating } : {}),
    },
  });

  function apiFalsa({ obrasDoAutor, porAssunto }) {
    return vi.fn(async (url) => {
      const q = decodeURIComponent(String(url));
      const itens = q.includes('inauthor:')
        ? obrasDoAutor
        : (porAssunto[Object.keys(porAssunto).find(k => q.includes(k))] || []);
      return { ok: true, json: async () => ({ items: itens }) };
    });
  }

  it('descobre os assuntos do autor e busca outros nomes neles', async () => {
    vi.stubGlobal('fetch', apiFalsa({
      obrasDoAutor: [
        volume('Duna', ['Frank Herbert'], ['Science Fiction']),
        volume('Messias de Duna', ['Frank Herbert'], ['Science Fiction']),
      ],
      porAssunto: {
        'Science Fiction': [
          volume('Fundação', ['Isaac Asimov'], ['Science Fiction'], 4),
          volume('A Mão Esquerda', ['Ursula K. Le Guin'], ['Science Fiction'], 5),
        ],
      },
    }));

    const r = await sugerirAutores('Frank Herbert', []);
    expect(r.motivo).toBe('ok');
    expect(r.generos).toContain('Science Fiction');
    // Ordena por avaliação: Le Guin (5) antes de Asimov (4).
    expect(r.autores.map(a => a.autor)).toEqual(['Ursula K. Le Guin', 'Isaac Asimov']);
    expect(r.autores[0].exemplo).toBe('A Mão Esquerda');
  });

  it('não sugere o próprio autor de referência', async () => {
    vi.stubGlobal('fetch', apiFalsa({
      obrasDoAutor: [volume('Duna', ['Frank Herbert'], ['Science Fiction'])],
      porAssunto: { 'Science Fiction': [
        volume('Outro Duna', ['Frank Herbert'], ['Science Fiction']),
        volume('Fundação', ['Isaac Asimov'], ['Science Fiction']),
      ] },
    }));

    const r = await sugerirAutores('Frank Herbert', []);
    expect(r.autores.map(a => a.autor)).toEqual(['Isaac Asimov']);
  });

  it('não sugere quem a pessoa já lê', async () => {
    vi.stubGlobal('fetch', apiFalsa({
      obrasDoAutor: [volume('Duna', ['Frank Herbert'], ['Science Fiction'])],
      porAssunto: { 'Science Fiction': [
        volume('Fundação', ['Isaac Asimov'], ['Science Fiction']),
        volume('A Mão Esquerda', ['Ursula K. Le Guin'], ['Science Fiction']),
      ] },
    }));

    const estante = [{ titulo: 'Fundação', autor: 'Isaac Asimov', status: 'lido' }];
    const r = await sugerirAutores('Frank Herbert', estante);
    expect(r.autores.map(a => a.autor)).toEqual(['Ursula K. Le Guin']);
  });

  it('não repete o mesmo autor que aparece em vários volumes', async () => {
    vi.stubGlobal('fetch', apiFalsa({
      obrasDoAutor: [volume('Duna', ['Frank Herbert'], ['Science Fiction'])],
      porAssunto: { 'Science Fiction': [
        volume('Fundação', ['Isaac Asimov'], ['Science Fiction']),
        volume('Eu, Robô', ['Isaac Asimov'], ['Science Fiction']),
      ] },
    }));
    const r = await sugerirAutores('Frank Herbert', []);
    expect(r.autores).toHaveLength(1);
  });

  it('avisa quando o autor não é encontrado', async () => {
    vi.stubGlobal('fetch', apiFalsa({ obrasDoAutor: [], porAssunto: {} }));
    expect((await sugerirAutores('Autor Inexistente XYZ', [])).motivo).toBe('autor-nao-encontrado');
  });

  it('avisa quando a API falha, sem lançar', async () => {
    // A chave do Google Books pode expirar ou estourar a cota: o chat precisa
    // seguir funcionando e dizer que a busca não veio.
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 400 })));
    const r = await sugerirAutores('Frank Herbert', []);
    expect(r.motivo).toBe('falha-busca');
    expect(r.autores).toEqual([]);
  });

  it('não busca com nome curto demais', async () => {
    const espiao = vi.fn();
    vi.stubGlobal('fetch', espiao);
    expect((await sugerirAutores('X', [])).motivo).toBe('sem-autor');
    expect(espiao).not.toHaveBeenCalled();
  });
});
import { perfilLeitor, gerarRecomendacoes, normalizar } from '../recomendacoes';

const estante = [
  { titulo: 'Dom Casmurro', autor: 'Machado de Assis', genero: 'Clássico', status: 'lido', nota: 5 },
  { titulo: 'O Cortiço', autor: 'Aluísio Azevedo', genero: 'Clássico', status: 'lido', nota: 4 },
  { titulo: 'Livro Ruim', autor: 'Fulano', genero: 'Terror', status: 'abandonei', nota: 1 },
  { titulo: 'Na Fila', autor: 'Ciclano', genero: 'Fantasia', status: 'quero-ler' },
];

describe('normalizar', () => {
  it('remove acentos, caixa e pontuação', () => {
    expect(normalizar('Ação & Coração!')).toBe('acao coracao');
    expect(normalizar('DOM CASMURRO')).toBe('dom casmurro');
  });

  it('trata valores nulos', () => {
    expect(normalizar(null)).toBe('');
    expect(normalizar(undefined)).toBe('');
  });
});

describe('perfilLeitor', () => {
  it('pondera gêneros pela nota dada', () => {
    const p = perfilLeitor(estante);
    expect(p.generosFavoritos[0].nome).toBe('Clássico');
    expect(p.totalLidos).toBe(2);
    expect(p.notaMedia).toBe(4.5);
  });

  it('exclui gêneros de livros abandonados', () => {
    const p = perfilLeitor(estante);
    expect(p.generosFavoritos.map(g => g.nome)).not.toContain('Terror');
  });

  it('ignora livros ainda não lidos na pontuação', () => {
    const p = perfilLeitor(estante);
    expect(p.generosFavoritos.map(g => g.nome)).not.toContain('Fantasia');
  });

  it('não quebra com estante vazia', () => {
    const p = perfilLeitor([]);
    expect(p.totalLidos).toBe(0);
    expect(p.generosFavoritos).toEqual([]);
  });
});

describe('gerarRecomendacoes', () => {
  it('retorna sem-historico quando nada foi lido', async () => {
    const r = await gerarRecomendacoes([{ titulo: 'X', status: 'quero-ler' }]);
    expect(r.motivo).toBe('sem-historico');
    expect(r.recomendacoes).toEqual([]);
  });

  it('retorna sem-generos quando faltam metadados', async () => {
    const r = await gerarRecomendacoes([{ titulo: 'X', status: 'lido', nota: 5 }]);
    expect(r.motivo).toBe('sem-generos');
  });

  it('busca candidatos e ordena por avaliação', async () => {
    const r = await gerarRecomendacoes(estante, { limite: 6 });
    expect(r.motivo).toBe('ok');
    expect(r.recomendacoes.length).toBeGreaterThan(0);
    expect(r.recomendacoes[0].titulo).toBe('Memórias Póstumas de Brás Cubas');
    expect(r.recomendacoes[0].ratingMedio).toBe(4.8);
  });

  it('não recomenda livros que já estão na estante', async () => {
    const r = await gerarRecomendacoes(estante, { limite: 6 });
    const titulos = r.recomendacoes.map(x => x.titulo);
    expect(titulos).not.toContain('Dom Casmurro');
  });

  it('não repete o mesmo título vindo de buscas diferentes', async () => {
    const r = await gerarRecomendacoes(estante, { limite: 6 });
    const titulos = r.recomendacoes.map(x => x.titulo);
    expect(new Set(titulos).size).toBe(titulos.length);
  });

  it('respeita o limite pedido', async () => {
    const r = await gerarRecomendacoes(estante, { limite: 1 });
    expect(r.recomendacoes).toHaveLength(1);
  });

  it('anexa o motivo da recomendação', async () => {
    const r = await gerarRecomendacoes(estante, { limite: 3 });
    expect(r.recomendacoes[0].motivo).toBeTruthy();
    expect(typeof r.recomendacoes[0].motivo).toBe('string');
  });

  it('converte capa http em https', async () => {
    const r = await gerarRecomendacoes(estante, { limite: 6 });
    const comCapa = r.recomendacoes.find(x => x.capa);
    expect(comCapa.capa.startsWith('https://')).toBe(true);
  });
});
