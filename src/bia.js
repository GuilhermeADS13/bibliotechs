// Ponte entre a B.IA e o modelo de linguagem.
//
// Princípio de divisão: os NÚMEROS vêm daqui (calculados em código, exatos); a
// LINGUAGEM vem do modelo. Um LLM erra uma média ou inventa um total com
// facilidade, então nada quantitativo é deixado a cargo dele — recebe tudo
// pronto e só precisa escrever a resposta.

import { calcularEstatisticas, MESES_LONGOS } from './estatisticas';
import { perfilLeitor, buscarAutor } from './recomendacoes';

// `normalizarTexto` é declarado mais abaixo (function declaration, içada).

const ENDPOINT = '/api/bia';
const TIMEOUT_MS = 22000;

// Tetos das resenhas no contexto. Existem porque o servidor recusa contexto
// acima de 20 mil caracteres: sem limite, uma estante de quem escreve muito
// derrubaria a resposta inteira.
const MAX_RESENHAS = 8;
const MAX_CHARS_RESENHA = 500;

/**
 * Token do usuário logado, ou null.
 *
 * O import é dinâmico para o `firebase/auth` não entrar no caminho crítico de
 * quem navega sem conta, e para este módulo continuar testável sem inicializar
 * o Firebase.
 */
async function obterToken() {
  try {
    const { auth } = await import('./firebase');
    const usuario = auth?.currentUser;
    if (!usuario) return null;
    return await usuario.getIdToken();
  } catch {
    return null;
  }
}

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

  // As resenhas são o dado mais rico da estante e não chegavam ao modelo: ele
  // sabia que a pessoa deu 5 estrelas, mas não por quê. São as palavras dela,
  // não estatística — daí a seção própria e o destaque na instrução.
  const comResenha = acervo
    .filter(l => typeof l?.resenha === 'string' && l.resenha.trim().length > 0)
    .sort((a, b) => String(b.dataTermino || '').localeCompare(String(a.dataTermino || '')))
    .slice(0, MAX_RESENHAS);

  if (comResenha.length > 0) {
    linhas.push('', 'O QUE A PESSOA ESCREVEU SOBRE OS LIVROS (palavras dela, não suas):');
    for (const l of comResenha) {
      const texto = l.resenha.trim();
      // Truncar em vez de descartar: uma resenha longa cortada ainda diz muito,
      // e sem teto uma estante de resenhistas estouraria o limite do contexto.
      const recorte = texto.length > MAX_CHARS_RESENHA
        ? `${texto.slice(0, MAX_CHARS_RESENHA).trimEnd()}… [resenha truncada]`
        : texto;
      // O status vai junto porque muda o sentido do texto: numa estante real,
      // todas as anotações eram de livros ABANDONADOS e explicavam a
      // desistência ("falta de tempo para calhamaço"). Sem essa marcação, isso
      // seria lido como crítica à obra, e não é.
      const cabecalho = [`"${l.titulo}"`, `[${l.status || 'sem status'}`];
      cabecalho.push(Number(l.nota) > 0 ? `, nota ${l.nota}/5]` : ']');
      linhas.push('', `${cabecalho.join('')}: ${recorte}`);
    }
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
export async function perguntarAoModelo(pergunta, contexto, { sinal, historico, aoReceber } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  if (sinal) sinal.addEventListener('abort', () => controller.abort(), { once: true });

  try {
    // Sem token o endpoint recusa (401). É o que impede um terceiro de descobrir
    // a URL e torrar a cota gratuita do dia.
    const token = await obterToken();
    if (!token) return { texto: null, erro: 'precisa-login' };

    // Streaming só quando alguém quer acompanhar a escrita; a resposta inteira
    // demora o mesmo, mas as primeiras palavras aparecem bem antes.
    const querStream = typeof aoReceber === 'function' && typeof ReadableStream !== 'undefined';

    const res = await fetch(querStream ? `${ENDPOINT}?stream=1` : ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
      body: JSON.stringify({ pergunta, contexto, historico: prepararHistorico(historico) }),
    });

    if (querStream && res.ok && res.body) {
      const texto = await lerStream(res.body, aoReceber);
      return texto ? { texto, erro: null } : { texto: null, erro: 'resposta-vazia' };
    }

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

// "me indica um autor parecido", "quais outros autores", "escritores como o X".
const PEDIDO_DE_AUTOR = new RegExp(
  [
    '\\bautor(?:es)?\\s+(?:parecid|semelhant|similar)',
    '\\b(?:outros?|mais)\\s+autor(?:es)?\\b',
    '\\bescritor(?:es)?\\s+(?:parecid|semelhant|similar|como)',
    '\\bautor(?:es)?\\s+como\\b',
    '\\bparecido\\s+com\\s+(?:o|a)?\\s*autor',
    '\\bbaseado\\s+n(?:esse|este|o)\\s+autor',
    '\\bquem\\s+(?:mais\\s+)?escreve\\s+(?:parecid|como|assim)',
  ].join('|')
);

export function pedeAutorParecido(pergunta) {
  return PEDIDO_DE_AUTOR.test(normalizarTexto(pergunta));
}

/**
 * De qual autor a pessoa quer partir.
 *
 * Ordem: autor citado na pergunta > autor do livro citado > autor melhor
 * avaliado da estante. Devolve null quando não há de onde partir, para o chat
 * poder perguntar em vez de chutar.
 */
export function autorDeReferencia(pergunta, livros, historico = []) {
  const acervo = Array.isArray(livros) ? livros : [];
  const alvo = normalizarTexto(pergunta);

  const autores = [...new Set(
    acervo.flatMap(l => String(l?.autor || '').split(',').map(a => a.trim()).filter(a => a.length >= 3))
  )].sort((a, b) => b.length - a.length);

  // Citado diretamente na pergunta.
  const citado = autores.find(a => alvo.includes(normalizarTexto(a)));
  if (citado) return citado;

  // Autor do livro de que se está falando.
  const livro = identificarLivroMencionado(pergunta, acervo, historico);
  if (livro?.autor) return String(livro.autor).split(',')[0].trim();

  // Citado num turno anterior da conversa.
  const conversa = normalizarTexto(
    (Array.isArray(historico) ? historico : []).map(m => m?.texto || '').join(' ')
  );
  const naConversa = autores.find(a => conversa.includes(normalizarTexto(a)));
  if (naConversa) return naConversa;

  // Último recurso: o autor que ela melhor avalia. O split é porque o perfil
  // agrupa pelo campo cru, que pode trazer coautoria ("Ana Silva, Bruno Costa")
  // — e a busca no Google Books precisa de um nome só.
  const favorito = perfilLeitor(acervo).autoresFavoritos[0]?.nome;
  return favorito ? String(favorito).split(',')[0].trim() : null;
}

/**
 * Contexto para "me indica um autor parecido".
 *
 * Aqui a divisão de trabalho é o INVERSO da usada nas estatísticas: quem sugere
 * é o modelo, sem consultar a Google Books. Duas tentativas de fundamentar pela
 * API falharam, e ambas piorariam a resposta:
 *
 * 1. Buscar por assunto: a API classifica todo Frank Herbert como "Fiction", e
 *    `subject:Fiction` devolveu dicionário Merriam-Webster e Jane Austen como
 *    "parecidos" com ele. `subject:Science Fiction` devolve livros acadêmicos
 *    SOBRE ficção científica.
 * 2. Trazer a bibliografia do autor: o ranking de `inauthor:` favorece
 *    coletâneas e livros com o nome do autor no título — para Frank Herbert
 *    veio "The Collected Stories", e nenhum "Duna".
 *
 * Semelhança entre autores é conhecimento literário estabelecido, que o modelo
 * domina e onde não costuma alucinar. Fundamentar com dado ruim seria pior que
 * não fundamentar. O que ancora a resposta é a estante da pessoa, que já está
 * no contexto principal.
 */
export function contextoDeAutores(referencia, jaNaEstante = []) {
  if (!referencia) {
    return [
      '',
      '--- PEDIDO: AUTOR PARECIDO ---',
      'Não deu para saber de qual autor partir. Pergunte de quem a pessoa quer',
      'algo parecido, em uma frase.',
      '--- FIM ---',
    ].join('\n');
  }

  const linhas = ['', '--- PEDIDO: AUTOR PARECIDO ---', `Referência: ${referencia}`];

  const conhecidos = [...new Set(
    (Array.isArray(jaNaEstante) ? jaNaEstante : [])
      .flatMap(l => String(l?.autor || '').split(',').map(a => a.trim()))
      .filter(Boolean)
  )];
  if (conhecidos.length > 0) {
    linhas.push('', `Autores que a pessoa já lê (não sugira estes): ${conhecidos.join(', ')}`);
  }

  linhas.push(
    '',
    `Indique 2 ou 3 autores que conversam com ${referencia} e diga, para cada, o`,
    'que aproxima — tema, estilo, época, tipo de narrador. Cite uma obra de',
    'entrada de cada um. Não é uma lista: é você explicando por que a pessoa',
    'provavelmente vai gostar.',
    '',
    'Indique apenas autores de existência conhecida e obras que você tem certeza',
    'de que são deles. Na dúvida sobre um título, fale do autor sem citar obra —',
    'melhor do que arriscar um livro que não existe.',
    '--- FIM ---'
  );

  return linhas.join('\n');
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

    // Falando deste livro em específico, o que a pessoa escreveu sobre ele vale
    // mais que qualquer metadado — é a opinião dela, e ela espera ser lembrada.
    const resenha = typeof livroNaEstante.resenha === 'string' ? livroNaEstante.resenha.trim() : '';
    if (resenha) {
      const recorte = resenha.length > MAX_CHARS_RESENHA
        ? `${resenha.slice(0, MAX_CHARS_RESENHA).trimEnd()}… [truncada]`
        : resenha;
      linhas.push('', `O que a pessoa escreveu sobre este livro: ${recorte}`);
    }
  }
  linhas.push('--- FIM DOS DADOS DO LIVRO ---');
  return linhas.join('\n');
}

/**
 * Formata os candidatos do motor de recomendação para o contexto do modelo.
 *
 * A busca continua sendo feita em código (Google Books, filtrada pelo perfil);
 * o modelo só escolhe entre os candidatos e justifica. Assim os títulos são
 * reais e verificáveis, em vez de saírem da memória dele.
 */
export function contextoDeRecomendacoes(recomendacoes, perfil) {
  const lista = Array.isArray(recomendacoes) ? recomendacoes : [];
  if (lista.length === 0) {
    return [
      '',
      '--- RECOMENDAÇÕES ---',
      'A busca não retornou candidatos: ou a estante não tem leituras concluídas',
      'com gênero/autor preenchidos, ou a API não achou títulos fora do acervo.',
      'Recomende com sua própria bagagem literária e diga, em uma frase, que a',
      'sugestão fica mais afinada conforme ela registrar e avaliar leituras.',
      '--- FIM DAS RECOMENDAÇÕES ---',
    ].join('\n');
  }

  const linhas = [
    '',
    '--- CANDIDATOS A RECOMENDAÇÃO (Google Books, reais) ---',
  ];

  for (const [i, r] of lista.entries()) {
    const partes = [`${i + 1}. "${r.titulo}" — ${r.autor}`];
    if (r.ano) partes.push(`(${r.ano})`);
    if (r.genero) partes.push(`[${r.genero}]`);
    if (r.ratingMedio > 0) partes.push(`avaliação ${r.ratingMedio}/5`);
    linhas.push(partes.join(' '));
    if (r.motivo) linhas.push(`   critério da busca: ${r.motivo}`);
  }

  if (perfil?.generosFavoritos?.length) {
    linhas.push(
      '',
      `Perfil usado na busca: ${perfil.generosFavoritos.slice(0, 3).map(g => g.nome).join(', ')}`
      + `${perfil.totalLidos ? ` · ${perfil.totalLidos} leitura(s) concluída(s)` : ''}`
    );
  }

  linhas.push(
    '',
    'Escolha 2 ou 3 desta lista e explique por que combinam com o perfil. Uma',
    'delas deve ROMPER o padrão de leitura — outro gênero, outra tradição, outro',
    'registro — e você deve dizer claramente que é a escolha de ruptura e por quê.',
    'Recomendar só o que já agrada reforça o viés que você existe para questionar.',
    'Nunca invente títulos fora desta lista.',
    '--- FIM DAS RECOMENDAÇÕES ---'
  );

  return linhas.join('\n');
}

/**
 * Consome o corpo em texto puro, avisando a cada pedaço.
 * Devolve o texto completo no fim — é ele que vai para o histórico.
 */
async function lerStream(corpo, aoReceber) {
  const leitor = corpo.getReader();
  const decodificador = new TextDecoder();
  let completo = '';

  try {
    while (true) {
      const { done, value } = await leitor.read();
      if (done) break;
      const pedaco = decodificador.decode(value, { stream: true });
      if (!pedaco) continue;
      completo += pedaco;
      // Um erro no callback (render do React, por exemplo) não pode abortar a
      // leitura: perderíamos o resto da resposta já paga.
      try { aoReceber(completo); } catch {}
    }
  } catch {
    // Conexão caiu no meio: o que chegou já vale mais que nada.
  }

  return completo.trim();
}

/** Explica a falha em linguagem de usuário, com o que fazer a respeito. */
export function mensagemDeFalha(erro) {
  switch (erro) {
    case 'precisa-login':
      return 'Entre com sua conta Google para conversar comigo — só assim consigo analisar sua estante em linguagem natural. Sem login eu ainda respondo sobre estatísticas, resumos e recomendações.';
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

// --- AUTOR CITADO QUE NÃO ESTÁ NA ESTANTE ---------------------------------
//
// O buraco que isto tapa: `autorDeReferencia` só procura entre os autores JÁ
// cadastrados. Quem perguntasse por alguém que ainda não lê ("quero ler a
// fulana", "tem livro da sicrana?") tinha o nome ignorado — o código caía no
// autor favorito da própria estante e a B.IA respondia sobre outra pessoa, ou
// pedia que a leitora dissesse de quem estava falando, logo depois de ela ter
// dito. Nos dois casos a leitura de quem usa é a mesma: "ela não entendeu".

// Palavras que aparecem em maiúscula por começarem a frase, não por serem nome.
const NAO_E_NOME = new Set([
  'a', 'o', 'as', 'os', 'um', 'uma', 'uns', 'umas', 'e', 'ou', 'mas',
  'oi', 'ola', 'bom', 'boa', 'ei', 'entao', 'agora', 'hoje', 'ainda', 'ja',
  'que', 'qual', 'quais', 'quem', 'quando', 'onde', 'como', 'porque', 'por',
  'quanto', 'quantos', 'quanta', 'quantas',
  'quero', 'queria', 'gostaria', 'pode', 'poderia', 'preciso', 'consigo',
  'me', 'te', 'voce', 'vc', 'eu', 'tu', 'ele', 'ela', 'nos', 'seu', 'sua',
  'meu', 'minha', 'esse', 'essa', 'este', 'esta', 'aquele', 'aquela', 'isso',
  'tem', 'ter', 'temos', 'ha', 'existe', 'sabe', 'conhece', 'acha', 'acho',
  'ler', 'leio', 'lendo', 'li', 'lido', 'leitura', 'leituras',
  'livro', 'livros', 'obra', 'obras', 'autor', 'autora', 'autores', 'autoras',
  'escritor', 'escritora', 'escritores', 'escritoras', 'estante', 'genero',
  'sobre', 'com', 'sem', 'para', 'pra', 'de', 'da', 'do', 'das', 'dos', 'em',
  'nao', 'sim', 'talvez', 'muito', 'mais', 'menos', 'algum', 'alguma', 'algo',
  'indica', 'indique', 'recomenda', 'recomende', 'fala', 'diga', 'conta',
  'parecido', 'parecida', 'parecidos', 'parecidas', 'semelhante', 'similar',
  // Vocabulario que sobra das perguntas do dia a dia. Sem isto, "qual meu
  // genero favorito mesmo" deixa "favorito mesmo" de resto e gasta uma busca
  // na Google Books para descobrir que nao e ninguem.
  'mesmo', 'mesma', 'favorito', 'favorita', 'melhor', 'melhores', 'pior',
  'otimo', 'ruim', 'legal', 'novo', 'nova', 'velho', 'ultimo', 'ultima',
  'primeiro', 'primeira', 'proximo', 'proxima', 'outro', 'outra', 'outros',
  'ano', 'anos', 'mes', 'meses', 'dia', 'dias', 'semana', 'semanas',
  'pagina', 'paginas', 'nota', 'notas', 'media', 'total', 'meta', 'metas',
]);

// Ligações que aparecem dentro de nomes ("Machado de Assis", "Ursula K. Le Guin").
// O "e" fica de fora de propósito: em português ele separa uma lista de nomes
// muito mais vezes do que compõe um — mantê-lo grudava "Machado de Assis e
// Ursula K. Le Guin" num nome só, longo demais, e os dois se perdiam.
const LIGACOES = new Set([
  'de', 'da', 'do', 'das', 'dos', 'von', 'van', 'del', 'della', 'la', 'le', 'du', 'di',
]);

const soLetras = (t) => normalizarTexto(t).replace(/[^\p{L}\p{N}]/gu, '');

function comecaMaiuscula(token) {
  const letra = token.replace(/[^\p{L}]/gu, '')[0];
  return !!letra && letra === letra.toUpperCase() && letra !== letra.toLowerCase();
}

/**
 * Nomes próprios citados na pergunta, dos mais longos aos mais curtos.
 *
 * Não decide se é autor — só levanta candidatos. Quem confirma é a Google
 * Books, e é essa confirmação que torna seguro extrair por heurística: um
 * palpite errado ("Esse Ano") simplesmente não bate com autor nenhum.
 */
export function nomesCitadosNaPergunta(pergunta) {
  const tokens = String(pergunta || '').split(/\s+/).filter(Boolean);

  const corridas = [];
  let atual = [];
  for (const bruto of tokens) {
    // Pontuação final encerra o nome; o ponto de inicial ("C.") não.
    const limpo = bruto
      .replace(/^[¿¡"'“‘(\[]+/, '')
      .replace(/[,;:!?"'”’)\]]+$/, '');
    const corta = /[,;:!?]$/.test(bruto);
    const chave = soLetras(limpo);

    const ehLigacao = LIGACOES.has(chave) && atual.length > 0;
    if (limpo && (comecaMaiuscula(limpo) || ehLigacao)) {
      atual.push(limpo);
      if (!corta) continue;
    }
    if (atual.length) corridas.push(atual);
    atual = [];
  }
  if (atual.length) corridas.push(atual);

  const nomes = [];
  for (const corrida of corridas) {
    // Tira do começo o que só está em maiúscula por abrir a frase, e do fim a
    // ligação solta ("Colleen Hoover e" -> "Colleen Hoover").
    const palavras = [...corrida];
    while (palavras.length && NAO_E_NOME.has(soLetras(palavras[0]))) palavras.shift();
    while (palavras.length && LIGACOES.has(soLetras(palavras[palavras.length - 1]))) palavras.pop();
    if (palavras.length === 0 || palavras.length > 4) continue;
    if (!palavras.some(p => soLetras(p).length >= 3)) continue;
    nomes.push(palavras.join(' '));
  }

  // Nome composto antes de nome solto: "Colleen Hoover" é uma aposta melhor que
  // "Colleen", e a primeira confirmação encerra a busca.
  return [...new Set(nomes)].sort((a, b) => b.split(' ').length - a.split(' ').length);
}

/**
 * Candidatos a nome quando a pessoa escreveu tudo em minúscula.
 *
 * Foi o segundo relato: ela digitou "annie ernaux" e a busca por maiúscula não
 * viu nada. Quem conversa no celular escreve assim o tempo todo, e exigir
 * maiúscula em nome próprio é exigir que a pessoa escreva do jeito do código.
 *
 * Aqui a evidência é mais fraca — sem maiúscula, "realismo magico" tem a mesma
 * cara de "annie ernaux". Duas travas compensam: só corridas de 2 a 4 palavras
 * (uma palavra solta é ambígua demais) e, em `resolverAutorCitado`, só vale se
 * a Google Books confirmar. Palpite sem maiúscula não vira contexto por conta.
 */
export function nomesSemMaiuscula(pergunta) {
  const tokens = String(pergunta || '')
    .split(/[\s,;:!?]+/)
    .map(t => t.replace(/^[¿¡"'“‘(\[]+/, '').replace(/["'”’)\]]+$/, ''))
    .filter(Boolean);

  const corridas = [];
  let atual = [];
  for (const token of tokens) {
    const chave = soLetras(token);
    // Ligação só continua um nome já começado; sozinha não abre um.
    const ehLigacao = LIGACOES.has(chave) && atual.length > 0;
    if (chave.length >= 2 && (ehLigacao || !NAO_E_NOME.has(chave))) {
      atual.push(token);
      continue;
    }
    if (atual.length) corridas.push(atual);
    atual = [];
  }
  if (atual.length) corridas.push(atual);

  // Uma palavra só normalmente é ambígua demais — mas não quando a mensagem
  // INTEIRA é ela. Quem digita "ernaux" está pesquisando um nome, não fazendo
  // uma pergunta, e a Google Books resolve sobrenome sozinho sem hesitar
  // (ernaux -> Annie Ernaux, saramago -> José Saramago). Numa frase longa a
  // palavra solta volta a ser ruído ("mes", em "quantos livros li por mes").
  const buscaCurta = tokens.length <= 3;

  const nomes = [];
  for (const corrida of corridas) {
    const palavras = [...corrida];
    while (palavras.length && LIGACOES.has(soLetras(palavras[palavras.length - 1]))) palavras.pop();
    if (palavras.length > 4) continue;
    if (palavras.length === 1 && !(buscaCurta && soLetras(palavras[0]).length >= 4)) continue;
    if (palavras.length === 0) continue;
    nomes.push(palavras.join(' '));
  }

  return [...new Set(nomes)].sort((a, b) => b.split(' ').length - a.split(' ').length);
}

/**
 * A pergunta cita algum nome próprio? Não consulta rede — só a extração.
 *
 * Serve para o motor de regras saber quando NÃO tem o que responder. Ele tem um
 * template de "recomendações pelo seu histórico" que dispara com a palavra
 * "recomende", e que respondia "me recomende um livro de annie ernaux" com uma
 * lista tirada do perfil da estante, sem citar a autora uma vez sequer. Como
 * parecia resposta, também escondia que o modelo tinha falhado.
 */
export function citaAlgumNome(pergunta) {
  return nomesCitadosNaPergunta(pergunta).length > 0 || nomesSemMaiuscula(pergunta).length > 0;
}

/**
 * Descobre se a pergunta fala de um autor que ainda não está na estante e, em
 * caso afirmativo, confirma na Google Books.
 *
 * Devolve { nome, obras, confirmado } quando há do que falar, ou null.
 *
 * Com maiúscula, o nome volta mesmo sem confirmação: a API pode não ter achado
 * quem o modelo conhece, e responder sobre outra pessoa é pior. Sem maiúscula
 * não — ali a única evidência de que aquilo é um nome é a própria confirmação.
 */
export async function resolverAutorCitado(pergunta, livros, { googleBooksKey = '', sinal } = {}) {
  const acervo = Array.isArray(livros) ? livros : [];

  // Nomes que já estão na estante seguem pelo caminho antigo, que traz junto os
  // dados de leitura. Aqui só interessa o que é novo.
  const conhecidos = [
    ...acervo.map(l => normalizarTexto(l?.titulo)),
    ...acervo.flatMap(l => String(l?.autor || '').split(',').map(a => normalizarTexto(a))),
  ].filter(c => c.length >= 3);

  const novo = (n) => {
    const alvo = normalizarTexto(n);
    return !conhecidos.some(c => c.includes(alvo) || alvo.includes(c));
  };

  const comMaiuscula = nomesCitadosNaPergunta(pergunta).filter(novo);
  // O caminho de minúscula só entra quando o outro não achou nada: "annie
  // ernaux" precisa dele, mas ele erra mais, e maiúscula é evidência melhor.
  const candidatos = comMaiuscula.length > 0 ? comMaiuscula : nomesSemMaiuscula(pergunta).filter(novo);
  if (candidatos.length === 0) return null;

  // Uma confirmação basta, e as tentativas são poucas: a cota da Google Books é
  // limitada e a pergunta não pode esperar três buscas em série.
  for (const nome of candidatos.slice(0, 2)) {
    const achado = await buscarAutor(nome, { googleBooksKey, sinal });
    if (achado) return { ...achado, confirmado: true };
  }

  return comMaiuscula.length > 0 ? { nome: candidatos[0], obras: [], confirmado: false } : null;
}

/** Seção de contexto sobre o autor que a pessoa citou e ainda não lê. */
export function contextoDoAutor(autor, livros = []) {
  if (!autor?.nome) return '';

  const linhas = ['', '--- AUTOR CITADO PELA PESSOA ---', `Nome: ${autor.nome}`];

  const naEstante = (Array.isArray(livros) ? livros : []).filter(
    l => normalizarTexto(l?.autor || '').includes(normalizarTexto(autor.nome))
  );
  linhas.push(
    naEstante.length > 0
      ? `Já na estante dela: ${naEstante.map(l => `"${l.titulo}" [${l.status || 'sem status'}]`).join(', ')}`
      : 'Ela ainda não tem nenhum livro deste autor na estante.'
  );

  if (autor.confirmado && autor.obras?.length > 0) {
    linhas.push('', 'Obras confirmadas agora na Google Books (títulos reais — pode citar):');
    for (const o of autor.obras) {
      const partes = [`- "${o.titulo}"`];
      if (o.ano) partes.push(`(${o.ano})`);
      if (o.ratingMedio > 0) partes.push(`avaliação ${o.ratingMedio}/5`);
      linhas.push(partes.join(' '));
    }
    // A busca por autor ordena por relevância comercial, não por importância —
    // para Frank Herbert ela devolveu coletâneas e nenhum "Duna".
    linhas.push(
      '',
      'Esta lista NÃO está em ordem de importância: é o que a busca devolveu. Não',
      'a apresente como "as principais obras". Se você conhece a obra de entrada',
      'do autor e ela não está aqui, pode citá-la mesmo assim.'
    );
  } else if (!autor.confirmado) {
    linhas.push(
      '',
      'A Google Books não confirmou este nome. Pode ser grafia diferente, ou o',
      'trecho pode nem ser um nome. Se você conhece o autor, responda normalmente.',
      'Se não conhece, diga isso e peça para ela confirmar como se escreve — nunca',
      'invente obra nem finja que não entendeu a pergunta.'
    );
  }

  linhas.push(
    '',
    `A pessoa perguntou sobre ${autor.nome}. Fale DESTE autor: do que escreve, como`,
    'é a leitura, por onde começar, e como isso conversa (ou não) com o que ela já',
    'lê. Não desvie para os autores da estante dela como se fossem a pergunta —',
    'eles servem de comparação, não de resposta.',
    '--- FIM ---'
  );

  return linhas.join('\n');
}

export { MESES_LONGOS };
