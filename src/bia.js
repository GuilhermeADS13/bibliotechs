// Ponte entre a B.IA e o modelo de linguagem.
//
// Princípio de divisão: os NÚMEROS vêm daqui (calculados em código, exatos); a
// LINGUAGEM vem do modelo. Um LLM erra uma média ou inventa um total com
// facilidade, então nada quantitativo é deixado a cargo dele — recebe tudo
// pronto e só precisa escrever a resposta.

import { calcularEstatisticas, MESES_LONGOS } from './estatisticas';
import { perfilLeitor } from './recomendacoes';

const ENDPOINT = '/api/bia';
const TIMEOUT_MS = 22000;

/**
 * Serializa a estante em texto para o modelo ler.
 * Só entram dados já calculados — nenhuma conta fica para o modelo fazer.
 */
export function montarContexto(livros, ano = new Date().getFullYear()) {
  const acervo = Array.isArray(livros) ? livros : [];
  if (acervo.length === 0) return '';

  const stats = calcularEstatisticas(acervo, ano);
  const perfil = perfilLeitor(acervo);

  const linhas = [
    `Total de livros na estante: ${stats.total}`,
    `Lidos: ${stats.lidos} | Lendo: ${stats.lendo} | Quero ler: ${stats.queroLer} | Abandonados: ${stats.abandonei}`,
    `Taxa de conclusão: ${stats.taxaConclusao}% | Taxa de abandono: ${stats.taxaAbandono}%`,
    `Nota média das obras lidas: ${stats.notaMedia > 0 ? `${stats.notaMedia}/5` : 'nenhuma nota atribuída'}`,
    '',
    `Ano analisado: ${stats.ano}`,
    `Concluídos em ${stats.ano}: ${stats.totalNoAno}`,
    `Meses com leitura: ${stats.mesesAtivos} | Média por mês ativo: ${stats.mediaMensal}`,
    `Sequência atual de meses consecutivos com leitura: ${stats.sequenciaAtual}`,
  ];

  if (stats.melhorMes) {
    linhas.push(`Melhor mês: ${stats.melhorMes.nomeLongo} (${stats.melhorMes.quantidade})`);
  }
  if (stats.paginasAno > 0) {
    linhas.push(`Páginas em ${stats.ano}: ${stats.paginasAno} | Média por obra: ${stats.mediaPaginas}`);
  }

  const mesesComLeitura = stats.porMes.filter(m => m.quantidade > 0);
  if (mesesComLeitura.length > 0) {
    linhas.push('', 'Distribuição mensal:');
    for (const m of mesesComLeitura) {
      linhas.push(`- ${m.nomeLongo}: ${m.quantidade}`);
    }
  }

  if (stats.generos.length > 0) {
    linhas.push('', 'Gêneros lidos (quantidade, nota média):');
    for (const g of stats.generos.slice(0, 8)) {
      linhas.push(`- ${g.nome}: ${g.quantidade} livro(s), nota ${g.notaMedia || 'sem nota'}`);
    }
  }

  if (stats.autores.length > 0) {
    linhas.push('', 'Autores lidos (quantidade, nota média):');
    for (const a of stats.autores.slice(0, 8)) {
      linhas.push(`- ${a.nome}: ${a.quantidade} livro(s), nota ${a.notaMedia || 'sem nota'}`);
    }
  }

  if (perfil.generosFavoritos.length > 0) {
    linhas.push(
      '',
      `Gêneros preferidos (ponderados pela nota): ${perfil.generosFavoritos.slice(0, 3).map(g => g.nome).join(', ')}`
    );
  }

  // A estante inteira seria grande demais; as concluídas mais recentes bastam
  // para o modelo comentar leituras específicas.
  const recentes = acervo
    .filter(l => l?.status === 'lido' && l?.dataTermino)
    .sort((a, b) => String(b.dataTermino).localeCompare(String(a.dataTermino)))
    .slice(0, 12);

  if (recentes.length > 0) {
    linhas.push('', 'Últimas obras concluídas (mais recente primeiro):');
    for (const l of recentes) {
      const partes = [`"${l.titulo}"`];
      if (l.autor) partes.push(`de ${l.autor}`);
      if (l.genero) partes.push(`[${l.genero}]`);
      if (Number(l.nota) > 0) partes.push(`nota ${l.nota}/5`);
      partes.push(`concluído em ${l.dataTermino}`);
      linhas.push(`- ${partes.join(' ')}`);
    }
  }

  const lendo = acervo.filter(l => l?.status === 'lendo');
  if (lendo.length > 0) {
    linhas.push('', `Lendo agora: ${lendo.map(l => `"${l.titulo}"`).join(', ')}`);
  }

  return linhas.join('\n');
}

/**
 * Converte as mensagens do chat no formato que a função espera.
 * A saudação inicial da B.IA é descartada: é texto fixo do app, não algo que
 * ela "disse" na conversa, e abriria o histórico com um turno do modelo.
 */
export function prepararHistorico(mensagens) {
  if (!Array.isArray(mensagens)) return [];
  return mensagens
    .filter(m => m?.id !== 1 && typeof m?.texto === 'string' && m.texto.trim())
    .map(m => ({ papel: m.tipo === 'bot' ? 'bot' : 'usuario', texto: m.texto }));
}

/**
 * Pergunta ao modelo.
 *
 * Devolve sempre { texto, erro }: um dos dois preenchido. Antes devolvia só
 * `null` em qualquer falha, e o chamador respondia com um texto genérico que
 * parecia uma resposta de verdade — o usuário via a mesma frase vazia repetida
 * sem saber que algo tinha quebrado. O motivo do erro agora sobe junto.
 */
export async function perguntarAoModelo(pergunta, contexto, { sinal, historico } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  if (sinal) sinal.addEventListener('abort', () => controller.abort(), { once: true });

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ pergunta, contexto, historico: prepararHistorico(historico) }),
    });

    if (!res.ok) {
      const corpo = await res.json().catch(() => null);
      return { texto: null, erro: corpo?.erro || `http-${res.status}` };
    }

    const dados = await res.json().catch(() => null);
    const texto = typeof dados?.texto === 'string' ? dados.texto.trim() : '';
    return texto ? { texto, erro: null } : { texto: null, erro: 'resposta-vazia' };
  } catch (e) {
    // Distinguir timeout de queda de rede muda a orientação dada ao usuário.
    const expirou = e?.name === 'AbortError';
    return { texto: null, erro: expirou ? 'timeout' : 'sem-conexao' };
  } finally {
    clearTimeout(timer);
  }
}

// Referências vagas a "o livro" — quando a pessoa não diz o título porque acha
// óbvio de qual está falando. O prefixo (d|n) opcional cobre as contrações do
// português: "desse livro", "neste livro", "daquele livro".
const REFERENCIA_VAGA = new RegExp(
  [
    '\\b(?:d|n)?(?:esse|este|essa|esta|aquele|aquela)\\s+livro\\b',
    '\\b(?:o|do|no|ao|meu|seu)\\s+livro\\b',
    '\\blivro\\s+que\\s+eu\\b',
    '\\bmesmo\\s+livro\\b',
  ].join('|')
);

/**
 * Descobre a qual livro da estante a pergunta se refere.
 *
 * Existe para que uma pergunta sobre uma obra puxe os dados reais do Google
 * Books em vez de depender só da memória do modelo, que pode errar editora,
 * ano ou número de páginas.
 */
export function identificarLivroMencionado(pergunta, livros, historico = []) {
  const acervo = Array.isArray(livros) ? livros : [];
  if (acervo.length === 0) return null;

  const alvo = normalizarTexto(pergunta);

  // 1. Título citado explicitamente. O mais longo primeiro, para "Duna" não
  // roubar a vez de "Duna Messias" quando os dois estão na estante.
  const porTitulo = acervo
    .filter(l => typeof l?.titulo === 'string' && l.titulo.trim().length >= 3)
    .sort((a, b) => b.titulo.length - a.titulo.length)
    .find(l => alvo.includes(normalizarTexto(l.titulo)));
  if (porTitulo) return porTitulo;

  if (!REFERENCIA_VAGA.test(alvo)) return null;

  // 2. Referência vaga com um só livro na estante: não há ambiguidade.
  if (acervo.length === 1) return acervo[0];

  // 3. Referência vaga com vários: só resolve se a conversa já tratou de um
  // deles. Chutar o livro errado seria pior do que não responder.
  const conversa = normalizarTexto(
    (Array.isArray(historico) ? historico : []).map(m => m?.texto || '').join(' ')
  );
  const citados = acervo.filter(
    l => typeof l?.titulo === 'string' && l.titulo.trim().length >= 3
      && conversa.includes(normalizarTexto(l.titulo))
  );
  // "Duna" casa dentro de "Duna Messias": sem descartar os títulos contidos em
  // outro título citado, a conversa pareceria ambígua e nada seria resolvido.
  const distintos = citados.filter(l => !citados.some(
    outro => outro !== l && normalizarTexto(outro.titulo).includes(normalizarTexto(l.titulo))
  ));
  if (distintos.length === 1) return distintos[0];

  // 4. Referência vaga, vários livros, nenhum na conversa: prefere o que está
  // sendo lido — é o candidato mais provável de "esse livro".
  const lendo = acervo.filter(l => l?.status === 'lendo');
  return lendo.length === 1 ? lendo[0] : null;
}

function normalizarTexto(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .toLowerCase()
    .trim();
}

/** Formata os dados do Google Books para entrar no contexto do modelo. */
export function contextoDoLivro(info, livroNaEstante) {
  if (!info) return '';
  const linhas = [
    '',
    '--- DADOS DO LIVRO (Google Books, verificados) ---',
    `Título: ${info.titulo}`,
    `Autor: ${info.autor}`,
  ];
  if (info.genero && info.genero !== 'Não especificado') linhas.push(`Gênero: ${info.genero}`);
  if (info.paginas && info.paginas !== 'N/A') linhas.push(`Páginas: ${info.paginas}`);
  if (info.editora && info.editora !== 'N/A') linhas.push(`Editora: ${info.editora}`);
  // O Google Books devolve a data DESTA edição, não do lançamento original — o
  // rótulo precisa dizer isso, senão a edição brasileira de 2015 de um livro de
  // 1978 vira "lançado em 2015".
  if (info.dataPublicacao && info.dataPublicacao !== 'N/A') {
    linhas.push(`Publicação desta edição: ${info.dataPublicacao} (pode não ser o lançamento original)`);
  }
  if (info.ratingMedio && info.ratingMedio !== 'N/A') linhas.push(`Avaliação média: ${info.ratingMedio}/5`);
  if (info.descricao && info.descricao !== 'Descrição não disponível') {
    linhas.push('', `Sinopse oficial: ${info.descricao}`);
  }
  if (livroNaEstante) {
    linhas.push('', `Na estante do leitor: status "${livroNaEstante.status}"`
      + (Number(livroNaEstante.nota) > 0 ? `, nota ${livroNaEstante.nota}/5` : ', sem nota')
      + (livroNaEstante.dataTermino ? `, concluído em ${livroNaEstante.dataTermino}` : ''));
  }
  linhas.push('--- FIM DOS DADOS DO LIVRO ---');
  return linhas.join('\n');
}

/** Explica a falha em linguagem de usuário, com o que fazer a respeito. */
export function mensagemDeFalha(erro) {
  switch (erro) {
    case 'cota-esgotada':
      return 'Atingi o limite diário de consultas ao modelo. Amanhã volto ao normal — enquanto isso, ainda respondo sobre estatísticas, resumos e recomendações da sua estante.';
    case 'timeout':
      return 'A resposta demorou demais e eu interrompi a espera. Tente perguntar de novo.';
    case 'sem-conexao':
      return 'Não consegui me conectar. Verifique sua internet e tente de novo.';
    case 'sem-chave':
      return 'Ainda não estou conectada ao modelo de linguagem. Posso responder sobre estatísticas, resumos e recomendações da sua estante.';
    default:
      return 'Não consegui processar sua pergunta agora. Tente novamente em instantes.';
  }
}

export { MESES_LONGOS };
