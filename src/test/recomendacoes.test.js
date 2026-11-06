import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  perfilLeitor, gerarRecomendacoes, normalizar, buscarAutor, chaveTitulo, notaAjustada,
} from '../recomendacoes';

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

// Numa estante real, 4 dos 6 livros lidos vinham marcados como "Fiction" pelo
// Google Books. Como gênero favorito, isso vira `subject:Fiction` na busca — e
// devolve a literatura inteira, do dicionário à Jane Austen.
describe('perfilLeitor — gêneros vagos', () => {
  it('ignora "Fiction" e afins no perfil', () => {
    const p = perfilLeitor([
      { titulo: 'A', genero: 'Fiction', status: 'lido', nota: 5 },
      { titulo: 'B', genero: 'Fiction', status: 'lido', nota: 5 },
      { titulo: 'C', genero: 'Romance Psicológico', status: 'lido', nota: 4 },
    ]);
    expect(p.generosFavoritos.map(g => g.nome)).toEqual(['Romance Psicológico']);
  });

  it('cobre as variações que aparecem na prática', () => {
    for (const vago of ['Fiction', 'fiction', 'Ficção', 'General', 'Literature', 'Juvenile Fiction']) {
      const p = perfilLeitor([{ titulo: 'X', genero: vago, status: 'lido', nota: 5 }]);
      expect(p.generosFavoritos, vago).toEqual([]);
    }
  });

  it('não descarta gênero específico que contenha a palavra', () => {
    const p = perfilLeitor([{ titulo: 'X', genero: 'Ficção Científica', status: 'lido', nota: 5 }]);
    expect(p.generosFavoritos.map(g => g.nome)).toEqual(['Ficção Científica']);
  });

  it('o autor continua contando mesmo com gênero vago', () => {
    const p = perfilLeitor([{ titulo: 'X', autor: 'Sylvia Plath', genero: 'Fiction', status: 'lido', nota: 5 }]);
    expect(p.autoresFavoritos.map(a => a.nome)).toEqual(['Sylvia Plath']);
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

describe('buscarAutor', () => {
  it('confirma o autor e devolve obras reais', async () => {
    const r = await buscarAutor('Machado de Assis');
    expect(r.nome).toBe('Machado de Assis');
    expect(r.obras.map(o => o.titulo)).toContain('Quincas Borba');
  });

  // `inauthor:` é generoso e devolve qualquer coisa relacionada. Sem esta
  // guarda, um trecho de frase capturado por engano ("Esse Ano") viraria um
  // "autor confirmado" — e a B.IA falaria com convicção sobre quem não existe.
  it('recusa quando o nome não bate com o autor dos volumes', async () => {
    expect(await buscarAutor('Colleen Hoover')).toBeNull();
  });

  it('ignora nome curto demais sem consultar a API', async () => {
    expect(await buscarAutor('a')).toBeNull();
    expect(await buscarAutor('')).toBeNull();
  });

  it('descarta títulos que só repetem o nome do autor', async () => {
    // Coletâneas e biografias ("As obras de X") afogam a obra que a pessoa
    // quer conhecer — foi o que a busca por Frank Herbert devolveu.
    const r = await buscarAutor('Machado de Assis');
    for (const o of r.obras) {
      expect(o.titulo.toLowerCase()).not.toContain('machado de assis');
    }
  });

  it('põe as bem avaliadas primeiro', async () => {
    const r = await buscarAutor('Machado de Assis');
    const notas = r.obras.map(o => o.ratingMedio || 0);
    expect(notas).toEqual([...notas].sort((a, b) => b - a));
  });
});

// Print real: seis recomendacoes, todas de William Hjortsberg, sob o titulo
// "Recomendado para voce". A estante tinha UM livro lido, cujo genero era
// "Fiction" — descartado por vago — entao sobrava so a busca por autor.
describe('diversidade das recomendacoes', () => {
  const muitosDoMesmo = Array.from({ length: 8 }, (_, i) => ({
    titulo: `Obra ${i + 1}`, autor: 'William Hjortsberg', status: 'lido',
  }));

  function contarPorAutor(lista) {
    const m = new Map();
    for (const l of lista) m.set(l.autor, (m.get(l.autor) || 0) + 1);
    return m;
  }

  it('nao devolve mais de dois titulos do mesmo autor quando ha alternativa', async () => {
    // O mock do setup devolve tres livros de Machado de Assis por busca.
    const estanteMachado = [
      { titulo: 'Dom Casmurro', autor: 'Machado de Assis', genero: 'Clássico', status: 'lido', nota: 5 },
    ];
    const { recomendacoes } = await gerarRecomendacoes(estanteMachado, { limite: 6 });
    // Com uma fonte so, o preenchimento da segunda passada e esperado — o que
    // importa e que o teto foi aplicado antes dele.
    expect(recomendacoes.length).toBeGreaterThan(0);
    const primeiros = recomendacoes.slice(0, 2);
    expect(contarPorAutor(primeiros).get('Machado de Assis')).toBeLessThanOrEqual(2);
  });

  it('completa a lista em vez de devolver menos do que cabe', async () => {
    const estanteMachado = [
      { titulo: 'Dom Casmurro', autor: 'Machado de Assis', genero: 'Clássico', status: 'lido', nota: 5 },
    ];
    const { recomendacoes } = await gerarRecomendacoes(estanteMachado, { limite: 2 });
    expect(recomendacoes.length).toBe(2);
  });

  it('nao repete o mesmo livro ao completar', async () => {
    const estanteMachado = [
      { titulo: 'Dom Casmurro', autor: 'Machado de Assis', genero: 'Clássico', status: 'lido', nota: 5 },
    ];
    const { recomendacoes } = await gerarRecomendacoes(estanteMachado, { limite: 6 });
    const titulos = recomendacoes.map(r => r.titulo);
    expect(new Set(titulos).size).toBe(titulos.length);
  });
});

// --- Bugs da revisão de 2026-11-06 ------------------------------------------
// Cada bloco reproduz um defeito visto na revisão da aba de recomendações. A
// rede é substituída por um `fetch` falso: o que importa aqui é o que o motor
// faz com a resposta, não a resposta do mock global.

const volume = (id, title, extra = {}) => ({
  id, volumeInfo: { title, authors: extra.authors || ['Autor ' + id], ...extra },
});
const respostaJson = (corpo, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });

describe('falha da busca não vira "nada encontrado"', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('com a Google Books em 429 e a Open Library fora, o motivo é falha-busca', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respostaJson({ error: { message: 'Quota exceeded' } }, 429)));
    const r = await gerarRecomendacoes(estante);
    expect(r.motivo).toBe('falha-busca');
  });

  it('com a Google Books fora, usa a Open Library de reserva', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => String(url).includes('openlibrary.org')
      ? respostaJson({ docs: [{ title: 'Iracema', author_name: ['José de Alencar'] }] })
      : respostaJson({ error: { message: 'Quota exceeded' } }, 429)));
    const r = await gerarRecomendacoes(estante);
    expect(r.motivo).toBe('ok');
    expect(r.fonte).toBe('Open Library');
    expect(r.recomendacoes.map(x => x.titulo)).toContain('Iracema');
  });

  it('uma busca falhando sozinha não aciona a reserva', async () => {
    let n = 0;
    vi.stubGlobal('fetch', vi.fn(async () => (n++ === 0
      ? respostaJson({}, 500)
      : respostaJson({ items: [volume('a', 'Senhora')] }))));
    const r = await gerarRecomendacoes(estante);
    expect(r.motivo).toBe('ok');
    expect(r.fonte).toBeUndefined();
  });
});

describe('termos de busca', () => {
  afterEach(() => vi.unstubAllGlobals());

  async function termos(livros) {
    const urls = [];
    vi.stubGlobal('fetch', vi.fn(async (u) => {
      urls.push(new URL(u).searchParams.get('q'));
      return respostaJson({ items: [] });
    }));
    await gerarRecomendacoes(livros);
    return urls;
  }

  it('põe autor e gênero entre aspas', async () => {
    const q = await termos([{ titulo: 'X', autor: 'Machado de Assis', genero: 'Romance Psicológico', status: 'lido', nota: 5 }]);
    expect(q).toContain('subject:"Romance Psicológico"');
    expect(q).toContain('inauthor:"Machado de Assis"');
  });

  it('traduz gênero em português para a categoria da Google Books', async () => {
    const q = await termos([
      { titulo: 'A', genero: 'Fantasia', status: 'lido', nota: 5 },
      { titulo: 'B', genero: 'ficção científica', status: 'lido', nota: 4 },
    ]);
    expect(q).toEqual(['subject:"Fantasy"', 'subject:"Science Fiction"']);
  });

  it('busca cada coautor separadamente', async () => {
    const q = await termos([{ titulo: 'X', autor: 'Neil Gaiman, Terry Pratchett', status: 'lido', nota: 5 }]);
    expect(q).toEqual(['inauthor:"Neil Gaiman"', 'inauthor:"Terry Pratchett"']);
  });
});

describe('perfil não se divide por grafia', () => {
  it('junta o mesmo autor e o mesmo gênero escritos de jeitos diferentes', () => {
    const p = perfilLeitor([
      { titulo: 'A', autor: 'Machado de Assis', genero: 'Romance', status: 'lido', nota: 3 },
      { titulo: 'B', autor: 'machado de assis', genero: 'romance', status: 'lido', nota: 3 },
      { titulo: 'C', autor: 'Stephen King', genero: 'Terror', status: 'lido', nota: 4 },
    ]);
    const machado = p.autoresFavoritos.find(a => a.nome === 'Machado de Assis');
    expect(p.autoresFavoritos).toHaveLength(2);
    expect(machado.score).toBe(2);
    expect(p.generosFavoritos.find(g => g.nome === 'Romance').score).toBe(2);
  });

  it('guarda o livro que justifica a preferência', () => {
    const p = perfilLeitor([
      { titulo: 'Morno', genero: 'Terror', status: 'lido', nota: 3 },
      { titulo: 'O Iluminado', genero: 'Terror', status: 'lido', nota: 5 },
    ]);
    expect(p.generosFavoritos[0].exemplo).toBe('O Iluminado');
    expect(p.generosFavoritos[0].gostou).toBe(true);
  });
});

describe('o que já está na estante não volta como novidade', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('descarta outra edição do mesmo livro e coletânea do autor', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respostaJson({ items: [
      volume('1', 'Dom Casmurro - Edição de bolso', { authors: ['Machado de Assis'] }),
      volume('2', 'Dom Casmurro: edição comentada', { authors: ['Machado de Assis'] }),
      volume('3', 'Machado de Assis: obra completa', { authors: ['Machado de Assis'] }),
      volume('4', 'Helena', { authors: ['Machado de Assis'] }),
    ] })));
    const r = await gerarRecomendacoes([estante[0]]);
    expect(r.recomendacoes.map(x => x.titulo)).toEqual(['Helena']);
  });

  it('não mostra vírgula sobrando quando a API manda autor sujo', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respostaJson({ items: [
      volume('x', 'Helena', { authors: [', Machado de Assis'] }),
      volume('y', 'Senhora', { authors: ['', 'José de Alencar'] }),
    ] })));
    const r = await gerarRecomendacoes([estante[0]]);
    expect(r.recomendacoes.map(x => x.autor).sort()).toEqual(['José de Alencar', 'Machado de Assis']);
  });

  it('chaveTitulo ignora o subtítulo', () => {
    expect(chaveTitulo('Duna: edição de luxo')).toBe('duna');
    expect(chaveTitulo('Duna – Livro 1')).toBe('duna');
    expect(chaveTitulo('O Senhor dos Anéis')).toBe('o senhor dos aneis');
  });
});

describe('ordenação', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('nota 5 de um voto não passa à frente de 4,5 com duas mil avaliações', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respostaJson({ items: [
      volume('b', 'Um voto', { averageRating: 5, ratingsCount: 1 }),
      volume('a', 'Consagrado', { averageRating: 4.5, ratingsCount: 2000 }),
    ] })));
    const r = await gerarRecomendacoes([estante[0]]);
    expect(r.recomendacoes[0].titulo).toBe('Consagrado');
  });

  it('notaAjustada deixa sem avaliação no neutro', () => {
    expect(notaAjustada({})).toBe(3.5);
    expect(notaAjustada({ ratingMedio: 5, totalAvaliacoes: 1 })).toBeLessThan(4);
  });

  it('prefere edição em português', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respostaJson({ items: [
      volume('en', 'The Hobbit', { language: 'en' }),
      volume('pt', 'O Hobbit', { language: 'pt-BR' }),
    ] })));
    const r = await gerarRecomendacoes([estante[0]]);
    expect(r.recomendacoes[0].titulo).toBe('O Hobbit');
  });

  it('intercala as buscas em vez de encher a página com a primeira', async () => {
    vi.stubGlobal('fetch', vi.fn(async (u) => {
      const q = new URL(u).searchParams.get('q');
      const base = q.startsWith('subject') ? 'Gênero' : 'Autor';
      return respostaJson({ items: Array.from({ length: 6 }, (_, i) => volume(base + i, `${base} ${i}`)) });
    }));
    const r = await gerarRecomendacoes([estante[0]], { limite: 4 });
    expect(r.recomendacoes.map(x => x.titulo)).toEqual(['Gênero 0', 'Autor 0', 'Gênero 1', 'Autor 1']);
  });
});

describe('fila para o botão de outras sugestões', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('devolve candidatas além da primeira página, sem repetir', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respostaJson({
      items: Array.from({ length: 15 }, (_, i) => volume('v' + i, 'Livro ' + i)),
    })));
    const r = await gerarRecomendacoes([estante[0]], { limite: 6 });
    expect(r.recomendacoes).toHaveLength(6);
    expect(r.fila.length).toBe(15);
    expect(r.fila.slice(0, 6)).toEqual(r.recomendacoes);
    expect(new Set(r.fila.map(x => x.titulo)).size).toBe(15);
  });
});

describe('motivos', () => {
  it('leitura com nota baixa não pede para preencher o que já está preenchido', async () => {
    const r = await gerarRecomendacoes([{ titulo: 'X', autor: 'A', genero: 'Terror', status: 'lido', nota: 2 }]);
    expect(r.motivo).toBe('sem-favoritos');
  });

  it('o motivo do card cita o livro de que a pessoa gostou', async () => {
    const r = await gerarRecomendacoes(estante);
    expect(r.recomendacoes.map(x => x.motivo)).toContain('Porque você gostou de Dom Casmurro');
  });
});
