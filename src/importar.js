// Importação de estante a partir de CSV.
//
// Dois formatos:
//  - Goodreads ("My Books" → Import and export → Export Library): colunas em
//    inglês, com "Exclusive Shelf" dizendo se foi lido, está sendo lido etc.
//  - Planilha própria: cabeçalhos em português (titulo, autor, status, nota,
//    paginas, genero, data de termino, data de inicio, resenha, serie, volume).
//    Serve para quem anota em planilha ou vem de outro app.

import { chaveTitulo } from './recomendacoes';

const MAX_LINHAS = 2000;

/**
 * Lê CSV com aspas, vírgulas e quebras de linha dentro de campos. Aceita `,`
 * ou `;` (o Excel em português exporta com ponto e vírgula).
 */
export function lerCsv(texto) {
  const fonte = String(texto || '').replace(/^﻿/, '');
  const primeiraLinha = fonte.split(/\r?\n/, 1)[0] || '';
  const sep = (primeiraLinha.match(/;/g) || []).length > (primeiraLinha.match(/,/g) || []).length ? ';' : ',';

  const linhas = [];
  let campo = '';
  let linha = [];
  let aspas = false;

  for (let i = 0; i < fonte.length; i++) {
    const c = fonte[i];
    if (aspas) {
      if (c === '"' && fonte[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') {
      aspas = true;
    } else if (c === sep) {
      linha.push(campo); campo = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && fonte[i + 1] === '\n') i++;
      linha.push(campo); campo = '';
      if (linha.some(v => v.trim())) linhas.push(linha);
      linha = [];
    } else {
      campo += c;
    }
  }
  linha.push(campo);
  if (linha.some(v => v.trim())) linhas.push(linha);
  return linhas;
}

const sem = (t) => String(t || '').normalize('NFD').replace(/\p{Mn}/gu, '').toLowerCase().trim();

// Cabeçalho normalizado → campo do livro. Goodreads e planilha própria juntos.
const COLUNAS = {
  title: 'titulo', titulo: 'titulo', livro: 'titulo',
  author: 'autor', autor: 'autor', autora: 'autor',
  'my rating': 'nota', nota: 'nota', avaliacao: 'nota',
  'exclusive shelf': 'estante', status: 'status', situacao: 'status',
  bookshelves: 'prateleiras',
  'number of pages': 'paginas', paginas: 'paginas', 'n de paginas': 'paginas',
  'date read': 'dataTermino', 'data de termino': 'dataTermino', 'data termino': 'dataTermino', termino: 'dataTermino', 'lido em': 'dataTermino',
  'date started': 'dataInicio', 'data de inicio': 'dataInicio', 'data inicio': 'dataInicio', inicio: 'dataInicio',
  'my review': 'resenha', resenha: 'resenha',
  genero: 'genero', categoria: 'genero',
  serie: 'serie', colecao: 'serie', volume: 'volume',
};

const ESTANTE_GOODREADS = { read: 'lido', 'currently-reading': 'lendo', 'to-read': 'quero-ler' };

function statusDe(valor, prateleiras) {
  // No Goodreads, "abandonado" é prateleira criada pela pessoa, com nomes
  // variados; a estante exclusiva fica em "to-read" ou "read".
  if (/(^|[\s,])(dnf|did-not-finish|abandon)/i.test(prateleiras || '')) return 'abandonei';
  const v = sem(valor);
  if (ESTANTE_GOODREADS[v]) return ESTANTE_GOODREADS[v];
  if (/^(lido|lida|read|concluido|terminado)$/.test(v)) return 'lido';
  if (/^(lendo|reading|em leitura)$/.test(v)) return 'lendo';
  if (/^(abandonei|abandonado|abandonada|dnf)$/.test(v)) return 'abandonei';
  return 'quero-ler';
}

// "2024/03/15" (Goodreads), "15/03/2024" (planilha brasileira) ou ISO.
export function dataDe(valor) {
  const v = String(valor || '').trim();
  let m = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/.exec(v);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return '';
}

const limparTexto = (t) => String(t || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();

/**
 * Converte o CSV em livros do app.
 *
 * Devolve { livros, repetidos, ignorados, formato }. `repetidos` são os que já
 * estão na estante (pelo título, sem subtítulo) — importar duas vezes o mesmo
 * arquivo não duplica nada.
 */
export function livrosDoCsv(texto, estanteAtual = []) {
  const linhas = lerCsv(texto);
  if (linhas.length < 2) return { livros: [], repetidos: 0, ignorados: 0, formato: null };

  const cabecalho = linhas[0].map(h => COLUNAS[sem(h).replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ')] || null);
  if (!cabecalho.includes('titulo')) return { livros: [], repetidos: 0, ignorados: 0, formato: null };
  const formato = cabecalho.includes('estante') ? 'goodreads' : 'planilha';

  const naEstante = new Set((estanteAtual || []).map(l => chaveTitulo(l?.titulo)).filter(Boolean));
  const livros = [];
  let repetidos = 0;
  let ignorados = 0;

  for (const valores of linhas.slice(1, MAX_LINHAS + 1)) {
    const bruto = {};
    cabecalho.forEach((campo, i) => { if (campo) bruto[campo] = (valores[i] || '').trim(); });

    const titulo = bruto.titulo || '';
    if (!titulo) { ignorados++; continue; }
    const chave = chaveTitulo(titulo);
    if (naEstante.has(chave)) { repetidos++; continue; }
    naEstante.add(chave);

    const status = statusDe(bruto.estante || bruto.status, bruto.prateleiras);
    const nota = Math.min(5, Math.max(0, Math.round(Number(String(bruto.nota || '').replace(',', '.')) || 0)));
    const livro = {
      titulo,
      autor: bruto.autor || '',
      genero: bruto.genero || '',
      paginas: Number.parseInt(bruto.paginas, 10) > 0 ? String(Number.parseInt(bruto.paginas, 10)) : '',
      status,
      nota,
      dataTermino: status === 'lido' ? dataDe(bruto.dataTermino) : '',
      dataInicio: dataDe(bruto.dataInicio),
      resenha: limparTexto(bruto.resenha),
      capa: '',
    };
    if (bruto.serie) livro.serie = bruto.serie;
    if (Number.parseInt(bruto.volume, 10) > 0) livro.volume = Number.parseInt(bruto.volume, 10);
    livros.push(livro);
  }

  return { livros, repetidos, ignorados, formato };
}
