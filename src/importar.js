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

// Cabeçalho normalizado → campo do livro. Goodreads, Notion e planilha própria
// juntos. No Notion cada pessoa batiza as colunas do seu jeito, em inglês ou
// português — daí a lista longa de sinônimos. A coluna de título padrão de um
// banco do Notion se chama "Name".
const COLUNAS = {
  title: 'titulo', titulo: 'titulo', livro: 'titulo', name: 'titulo', nome: 'titulo', book: 'titulo', 'book title': 'titulo',
  author: 'autor', authors: 'autor', autor: 'autor', autora: 'autor', autores: 'autor', escritor: 'autor', escritora: 'autor',
  'my rating': 'nota', rating: 'nota', score: 'nota', stars: 'nota', estrelas: 'nota', nota: 'nota', avaliacao: 'nota', 'minha nota': 'nota',
  'exclusive shelf': 'estante', status: 'status', situacao: 'status', estado: 'status', 'reading status': 'status', state: 'status',
  bookshelves: 'prateleiras',
  'number of pages': 'paginas', pages: 'paginas', 'page count': 'paginas', paginas: 'paginas', 'n de paginas': 'paginas', 'numero de paginas': 'paginas',
  'date read': 'dataTermino', finished: 'dataTermino', 'date finished': 'dataTermino', 'finish date': 'dataTermino', 'end date': 'dataTermino',
  completed: 'dataTermino', 'date completed': 'dataTermino', 'read on': 'dataTermino',
  'data de termino': 'dataTermino', 'data termino': 'dataTermino', termino: 'dataTermino', 'lido em': 'dataTermino',
  terminei: 'dataTermino', 'terminei em': 'dataTermino', 'concluido em': 'dataTermino', 'data de conclusao': 'dataTermino', 'data fim': 'dataTermino', fim: 'dataTermino',
  'date started': 'dataInicio', started: 'dataInicio', 'start date': 'dataInicio',
  'data de inicio': 'dataInicio', 'data inicio': 'dataInicio', inicio: 'dataInicio', comecei: 'dataInicio', 'comecei em': 'dataInicio',
  dates: 'periodo', 'reading dates': 'periodo', periodo: 'periodo', datas: 'periodo', 'periodo de leitura': 'periodo',
  'my review': 'resenha', review: 'resenha', notes: 'resenha', resenha: 'resenha', notas: 'resenha', comentario: 'resenha', comentarios: 'resenha', opiniao: 'resenha',
  genre: 'genero', genres: 'genero', category: 'genero', categories: 'genero', tags: 'genero',
  genero: 'genero', generos: 'genero', categoria: 'genero',
  series: 'serie', serie: 'serie', colecao: 'serie', saga: 'serie',
  volume: 'volume', 'book number': 'volume', 'number in series': 'volume', 'n na serie': 'volume',
};

// Cabeçalho do Notion pode vir com emoji ("📚 Name"): só letras e números contam.
const nomeColuna = (h) => sem(h).replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

const ESTANTE_GOODREADS = { read: 'lido', 'currently-reading': 'lendo', 'to-read': 'quero-ler' };

function statusDe(valor, prateleiras) {
  // No Goodreads, "abandonado" é prateleira criada pela pessoa, com nomes
  // variados; a estante exclusiva fica em "to-read" ou "read".
  if (/(^|[\s,])(dnf|did-not-finish|abandon)/i.test(prateleiras || '')) return 'abandonei';
  // Opção de status do Notion pode trazer emoji ("📖 Lendo"): fica só o texto.
  const v = sem(valor).replace(/[^a-z\s-]/g, '').replace(/\s+/g, ' ').trim();
  if (ESTANTE_GOODREADS[v]) return ESTANTE_GOODREADS[v];
  if (/^(lido|lida|lidos|read|done|finished|completed|complete|concluido|concluida|terminado|terminei)$/.test(v)) return 'lido';
  if (/^(lendo|lendo agora|reading|currently reading|in progress|em andamento|em leitura|comecei|started)$/.test(v)) return 'lendo';
  if (/^(abandonei|abandonado|abandonada|abandoned|dropped|dnf|desisti|parei|gave up)$/.test(v)) return 'abandonei';
  return 'quero-ler';
}

/**
 * Nota de 0 a 5. Aceita número ("4", "4,5", "4/5", "8/10") e estrelas — o
 * jeito mais comum de dar nota numa tabela do Notion ("⭐⭐⭐⭐", "★★★☆☆").
 */
export function notaDe(valor) {
  const v = String(valor || '');
  const estrelas = (v.match(/⭐|★/g) || []).length;
  if (estrelas > 0) return Math.min(5, estrelas);
  const m = /(\d+(?:[.,]\d+)?)(?:\s*\/\s*(\d+))?/.exec(v);
  if (!m) return 0;
  let n = Number(m[1].replace(',', '.'));
  if (m[2] && Number(m[2]) === 10) n /= 2;
  return Math.min(5, Math.max(0, Math.round(n)));
}

const MESES = {
  jan: 1, fev: 2, feb: 2, mar: 3, abr: 4, apr: 4, mai: 5, may: 5, jun: 6, jul: 7,
  ago: 8, aug: 8, set: 9, sep: 9, out: 10, oct: 10, nov: 11, dez: 12, dec: 12,
};
const iso = (a, m, d) => (m >= 1 && m <= 12 && d >= 1 && d <= 31
  ? `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : '');

/**
 * "2024/03/15" (Goodreads), "15/03/2024" (planilha), ISO, e as datas por
 * extenso que o Notion exporta: "March 15, 2024", "15 de março de 2024".
 */
export function dataDe(valor) {
  const v = sem(valor);
  let m = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/.exec(v);
  if (m) return iso(m[1], +m[2], +m[3]);
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(v);
  if (m) {
    // Dia primeiro, como no Brasil — a não ser que o segundo número só possa
    // ser dia (Notion configurado em formato americano: 03/15/2024).
    const [a, b] = [+m[1], +m[2]];
    return b > 12 ? iso(m[3], a, b) : iso(m[3], b, a);
  }
  m = /^([a-z]{3})[a-z]*\.? (\d{1,2}),? (\d{4})/.exec(v);
  if (m && MESES[m[1]]) return iso(m[3], MESES[m[1]], +m[2]);
  m = /^(\d{1,2}) (?:de )?([a-z]{3})[a-z]*\.?,? (?:de )?(\d{4})/.exec(v);
  if (m && MESES[m[2]]) return iso(m[3], MESES[m[2]], +m[1]);
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

  const nomes = linhas[0].map(nomeColuna);
  // Primeira coluna reconhecida vence: no Notion pode haver "Name" e "Title".
  const usados = new Set();
  const cabecalho = nomes.map(n => {
    const campo = COLUNAS[n];
    if (!campo || usados.has(campo)) return null;
    usados.add(campo);
    return campo;
  });
  if (!cabecalho.includes('titulo')) return { livros: [], repetidos: 0, ignorados: 0, formato: null };
  const formato = cabecalho.includes('estante') ? 'goodreads' : nomes.includes('name') ? 'notion' : 'planilha';

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
    // Período do Notion: "March 1, 2024 → March 15, 2024" numa coluna só.
    const [periodoInicio, periodoFim] = String(bruto.periodo || '').split('→').map(s => s.trim());
    const fim = dataDe(bruto.dataTermino) || (periodoFim ? dataDe(periodoFim) : '');
    const livro = {
      titulo,
      // Notion separa múltiplos valores com vírgula — o mesmo formato do app.
      autor: bruto.autor || '',
      genero: String(bruto.genero || '').split(',')[0].trim(),
      paginas: Number.parseInt(bruto.paginas, 10) > 0 ? String(Number.parseInt(bruto.paginas, 10)) : '',
      status,
      nota: notaDe(bruto.nota),
      dataTermino: status === 'lido' ? fim : '',
      dataInicio: dataDe(bruto.dataInicio) || dataDe(periodoInicio),
      resenha: limparTexto(bruto.resenha),
      capa: '',
    };
    if (bruto.serie) livro.serie = bruto.serie;
    if (Number.parseInt(bruto.volume, 10) > 0) livro.volume = Number.parseInt(bruto.volume, 10);
    livros.push(livro);
  }

  return { livros, repetidos, ignorados, formato };
}
