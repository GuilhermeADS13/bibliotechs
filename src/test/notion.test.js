// @vitest-environment node
// Ambiente node: o leitor de zip usa Blob.stream() e DecompressionStream,
// que o jsdom não implementa e o navegador e o Node implementam.
import { describe, it, expect } from 'vitest';
import { deflateRawSync } from 'node:zlib';
import { livrosDoCsv, notaDe, dataDe } from '../importar';
import { csvDoZip, entradasDoZip } from '../zip';

// Export de um banco de dados de livros do Notion: colunas com nomes livres,
// emoji no cabeçalho, nota em estrelas e datas por extenso.
const NOTION = [
  '﻿📚 Name,Autor(a),Status,Rating,Dates,Tags,Pages',
  'Torto Arado,Itamar Vieira Junior,📖 Lendo,,"November 1, 2026",Romance,264',
  'Dom Casmurro,Machado de Assis,Done,⭐⭐⭐⭐⭐,"March 1, 2026 → March 15, 2026","Clássico, Romance",256',
  'Duna,Frank Herbert,Not started,,,Ficção Científica,',
  'It,Stephen King,Abandoned,⭐⭐,,Terror,1100',
].join('\n');

describe('importação do Notion', () => {
  const r = livrosDoCsv(NOTION);

  it('reconhece "Name" como título, mesmo com emoji no cabeçalho', () => {
    expect(r.formato).toBe('notion');
    expect(r.livros.map(l => l.titulo)).toEqual(['Torto Arado', 'Dom Casmurro', 'Duna', 'It']);
  });

  it('entende os status em inglês e com emoji', () => {
    expect(r.livros.map(l => l.status)).toEqual(['lendo', 'lido', 'quero-ler', 'abandonei']);
  });

  it('nota em estrelas, período "início → fim" e a primeira tag como gênero', () => {
    expect(r.livros[1]).toMatchObject({
      autor: 'Machado de Assis', nota: 5, dataInicio: '2026-03-01', dataTermino: '2026-03-15',
      genero: 'Clássico', paginas: '256',
    });
    expect(r.livros[3].nota).toBe(2);
  });

  it('livro em leitura com uma data só: é o início', () => {
    expect(r.livros[0]).toMatchObject({ dataInicio: '2026-11-01', dataTermino: '' });
  });

  it('colunas em português também', () => {
    const pt = livrosDoCsv('Nome;Autor;Situação;Nota;Terminei em\nIracema;Alencar;Lido;4/5;15 de março de 2024');
    expect(pt.livros[0]).toMatchObject({ titulo: 'Iracema', status: 'lido', nota: 4, dataTermino: '2024-03-15' });
  });
});

describe('notaDe', () => {
  it('estrelas, número, fração e escala de 10', () => {
    expect(notaDe('⭐⭐⭐')).toBe(3);
    expect(notaDe('★★★★☆')).toBe(4);
    expect(notaDe('4,5')).toBe(5);
    expect(notaDe('3/5')).toBe(3);
    expect(notaDe('8/10')).toBe(4);
    expect(notaDe('')).toBe(0);
  });
});

describe('dataDe com datas por extenso', () => {
  it('inglês, português e formato americano', () => {
    expect(dataDe('March 15, 2024')).toBe('2024-03-15');
    expect(dataDe('Sep 3, 2024 10:30 AM')).toBe('2024-09-03');
    expect(dataDe('15 de março de 2024')).toBe('2024-03-15');
    expect(dataDe('3 dez 2024')).toBe('2024-12-03');
    expect(dataDe('03/15/2024')).toBe('2024-03-15'); // só pode ser mês/dia
    expect(dataDe('05/03/2024')).toBe('2024-03-05'); // ambíguo: dia primeiro, como no Brasil
  });
});

// --- .zip ---------------------------------------------------------------------

/** Monta um .zip real (deflate ou sem compressão) a partir de { nome: conteúdo }. */
function montarZip(arquivos, { comprimir = true } = {}) {
  const partes = [];
  const central = [];
  let offset = 0;
  for (const [nome, conteudo] of Object.entries(arquivos)) {
    const nomeBytes = Buffer.from(nome, 'utf8');
    const dados = Buffer.isBuffer(conteudo) ? conteudo : Buffer.from(conteudo, 'utf8');
    const corpo = comprimir ? deflateRawSync(dados) : dados;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(comprimir ? 8 : 0, 8);
    local.writeUInt32LE(corpo.length, 18);
    local.writeUInt32LE(dados.length, 22);
    local.writeUInt16LE(nomeBytes.length, 26);
    partes.push(local, nomeBytes, corpo);

    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(comprimir ? 8 : 0, 10);
    c.writeUInt32LE(corpo.length, 20);
    c.writeUInt32LE(dados.length, 24);
    c.writeUInt16LE(nomeBytes.length, 28);
    c.writeUInt32LE(offset, 42);
    central.push(c, nomeBytes);
    offset += 30 + nomeBytes.length + corpo.length;
  }
  const centralBuf = Buffer.concat(central);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(Object.keys(arquivos).length, 8);
  fim.writeUInt16LE(Object.keys(arquivos).length, 10);
  fim.writeUInt32LE(centralBuf.length, 12);
  fim.writeUInt32LE(offset, 16);
  const tudo = Buffer.concat([...partes, centralBuf, fim]);
  return tudo.buffer.slice(tudo.byteOffset, tudo.byteOffset + tudo.byteLength);
}

describe('csvDoZip', () => {
  it('lista os arquivos do zip', () => {
    const zip = montarZip({ 'Livros abc.csv': 'Name\nDuna', 'Livros abc/capa.png': 'x' });
    expect(entradasDoZip(zip).map(e => e.nome)).toEqual(['Livros abc.csv', 'Livros abc/capa.png']);
  });

  it('extrai o CSV, preferindo o "_all" com todas as propriedades', async () => {
    const zip = montarZip({ 'Livros abc.csv': 'Name\nSó a visão', 'Livros abc_all.csv': 'Name,Author\nDuna,Frank Herbert' });
    expect(await csvDoZip(zip)).toBe('Name,Author\nDuna,Frank Herbert');
  });

  it('abre zip dentro de zip (export grande do Notion)', async () => {
    const interno = Buffer.from(montarZip({ 'Livros.csv': 'Name\nDuna' }));
    const externo = montarZip({ 'Export-123-Part-1.zip': interno }, { comprimir: false });
    expect(await csvDoZip(externo)).toBe('Name\nDuna');
  });

  it('do zip ao livro, acentos intactos', async () => {
    const zip = montarZip({ 'Livros_all.csv': '﻿Name,Status\nAção e Reação,Done' });
    const r = livrosDoCsv(await csvDoZip(zip));
    expect(r.livros[0]).toMatchObject({ titulo: 'Ação e Reação', status: 'lido' });
  });

  it('arquivo que não é zip devolve nada, sem quebrar', async () => {
    const lixo = new TextEncoder().encode('isto não é um zip').buffer;
    expect(await csvDoZip(lixo)).toBeNull();
  });
});
