import { describe, it, expect } from 'vitest';
import { lerCsv, livrosDoCsv, dataDe } from '../importar';

// Cabeçalho e linhas no formato do export do Goodreads.
const GOODREADS = [
  'Book Id,Title,Author,Author l-f,Additional Authors,ISBN,ISBN13,My Rating,Average Rating,Publisher,Binding,Number of Pages,Year Published,Original Publication Year,Date Read,Date Added,Bookshelves,Bookshelves with positions,Exclusive Shelf,My Review,Spoiler,Private Notes,Read Count,Owned Copies',
  '1,"Dune (Dune, #1)",Frank Herbert,"Herbert, Frank",,"=""0441013597""","=""9780441013593""",5,4.27,Ace,Paperback,688,2005,1965,2024/03/15,2024/01/02,,,read,"Incrível.<br/>Relerei.",,,1,0',
  '2,The Hobbit,J.R.R. Tolkien,"Tolkien, J.R.R.",,,,0,4.29,Houghton,Paperback,366,2012,1937,,2024/02/01,,,currently-reading,,,,0,0',
  '3,Ulysses,James Joyce,"Joyce, James",,,,0,3.7,Vintage,Paperback,783,1990,1922,,2024/02/01,dnf,dnf (#1),to-read,,,,0,0',
  '4,Emma,Jane Austen,"Austen, Jane",,,,0,4.0,Penguin,Paperback,474,2003,1815,,2024/02/01,,,to-read,,,,0,0',
].join('\n');

describe('lerCsv', () => {
  it('respeita aspas, vírgula e quebra de linha dentro do campo', () => {
    expect(lerCsv('a,b\n"x, y","linha 1\nlinha 2"')).toEqual([['a', 'b'], ['x, y', 'linha 1\nlinha 2']]);
  });

  it('aceita ponto e vírgula, como o Excel em português exporta', () => {
    expect(lerCsv('titulo;autor\nDom Casmurro;Machado')).toEqual([['titulo', 'autor'], ['Dom Casmurro', 'Machado']]);
  });

  it('aspas duplicadas viram uma aspa', () => {
    expect(lerCsv('a\n"Ele disse ""oi"""')[1]).toEqual(['Ele disse "oi"']);
  });
});

describe('livrosDoCsv — Goodreads', () => {
  const r = livrosDoCsv(GOODREADS);

  it('reconhece o formato e mapeia as estantes', () => {
    expect(r.formato).toBe('goodreads');
    expect(r.livros.map(l => [l.titulo, l.status])).toEqual([
      ['Dune (Dune, #1)', 'lido'],
      ['The Hobbit', 'lendo'],
      ['Ulysses', 'abandonei'], // prateleira "dnf"
      ['Emma', 'quero-ler'],
    ]);
  });

  it('traz nota, páginas, data e resenha sem HTML', () => {
    expect(r.livros[0]).toMatchObject({
      autor: 'Frank Herbert', nota: 5, paginas: '688', dataTermino: '2024-03-15', resenha: 'Incrível.\nRelerei.',
    });
  });

  it('lido sem data no arquivo fica sem data (não cai na meta deste ano)', () => {
    const semData = livrosDoCsv('Title,Exclusive Shelf,Date Read\nEmma,read,');
    expect(semData.livros[0]).toMatchObject({ status: 'lido', dataTermino: '' });
  });

  it('não duplica o que já está na estante', () => {
    const outra = livrosDoCsv(GOODREADS, [{ titulo: 'The Hobbit' }, { titulo: 'emma' }]);
    expect(outra.repetidos).toBe(2);
    expect(outra.livros.map(l => l.titulo)).toEqual(['Dune (Dune, #1)', 'Ulysses']);
  });
});

describe('livrosDoCsv — planilha própria', () => {
  it('lê cabeçalhos em português, com acento ou sem', () => {
    const r = livrosDoCsv('Título;Autor;Status;Nota;Páginas;Data de término;Série;Volume\nDom Casmurro;Machado de Assis;lido;4,6;256;15/03/2024;;\nDuna;Frank Herbert;Quero ler;;;;Duna;1');
    expect(r.formato).toBe('planilha');
    expect(r.livros[0]).toMatchObject({ titulo: 'Dom Casmurro', status: 'lido', nota: 5, paginas: '256', dataTermino: '2024-03-15' });
    expect(r.livros[1]).toMatchObject({ status: 'quero-ler', serie: 'Duna', volume: 1 });
  });

  it('sem coluna de título, não reconhece o arquivo', () => {
    expect(livrosDoCsv('nome,idade\nAna,30').formato).toBeNull();
  });

  it('linha sem título é ignorada e contada', () => {
    const r = livrosDoCsv('titulo,autor\n,Fulano\nIracema,Alencar');
    expect(r.ignorados).toBe(1);
    expect(r.livros).toHaveLength(1);
  });
});

describe('dataDe', () => {
  it('aceita os formatos do Goodreads, brasileiro e ISO', () => {
    expect(dataDe('2024/3/5')).toBe('2024-03-05');
    expect(dataDe('05/03/2024')).toBe('2024-03-05');
    expect(dataDe('2024-03-05')).toBe('2024-03-05');
    expect(dataDe('ontem')).toBe('');
  });
});
