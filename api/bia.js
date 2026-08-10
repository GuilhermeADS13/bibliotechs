// Função serverless (Vercel) que conversa com o Google AI Studio.
//
// Existe por um motivo de segurança: a chave do modelo NÃO pode ir para o
// bundle do front. Variáveis com prefixo VITE_ são embutidas no JavaScript
// público — qualquer pessoa abriria o DevTools e copiaria a chave. GEMINI_API_KEY
// não tem esse prefixo, então só existe aqui, no servidor.

import { verificarToken } from './_auth.js';

const AI_STUDIO_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

// Gemma e Gemini são servidos pela mesma chave. Trocar de modelo é trocar esta
// variável de ambiente no painel do Vercel — nenhuma alteração de código.
// Escolhido por medição, não por intuição. Com o mesmo prompt e estante:
//   gemini-3.5-flash-lite  2,5s   508 tokens
//   gemini-3.1-flash-lite  1,8s   543 tokens
//   gemini-3.6-flash       8,9s  1931 tokens (1368 só de raciocínio)
//   gemma-4-31b-it        23,8s  — bom texto, lento demais para chat
// O lite dispensa a fase de raciocínio: mesma qualidade de análise, um quarto
// do custo. Ambos passaram no teste de não inventar dado ausente.
// (gemini-2.5-flash foi descontinuado para novas chaves e devolve 404.)
const MODELO_PADRAO = 'gemini-3.5-flash-lite';

// O endpoint fica público assim que o site sobe: qualquer um pode chamá-lo e
// consumir a cota gratuita. Estes limites não impedem abuso determinado, mas
// barram o caso trivial e evitam pagar banda por payloads absurdos.
const MAX_PERGUNTA = 2000;
const MAX_CONTEXTO = 20000;
// Turnos anteriores enviados ao modelo. Alto o bastante para sustentar uma
// conversa real, baixo o bastante para o custo em tokens não crescer sem teto.
const MAX_HISTORICO = 10;

const TIMEOUT_MS = 20000;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'metodo-nao-permitido' });
  }

  const chave = process.env.GEMINI_API_KEY;
  if (!chave) {
    // Sem chave configurada não é erro fatal: o front cai para as regras locais.
    return res.status(503).json({ erro: 'sem-chave' });
  }

  // Endpoint fechado: a cota gratuita é do dono do app, não do mundo.
  const auth = await verificarToken(req);
  if (auth.erro) {
    if (auth.erro === 'sem-project-id') {
      console.error('FIREBASE_PROJECT_ID não configurado — /api/bia recusa tudo.');
      return res.status(503).json({ erro: 'sem-config' });
    }
    return res.status(401).json({ erro: 'precisa-login' });
  }

  const { pergunta, contexto, historico } = req.body || {};

  if (typeof pergunta !== 'string' || !pergunta.trim()) {
    return res.status(400).json({ erro: 'pergunta-vazia' });
  }
  if (pergunta.length > MAX_PERGUNTA) {
    return res.status(413).json({ erro: 'pergunta-longa' });
  }
  if (typeof contexto === 'string' && contexto.length > MAX_CONTEXTO) {
    return res.status(413).json({ erro: 'contexto-longo' });
  }
  // O histórico cresce a cada turno e o endpoint é público: sem teto, uma
  // conversa longa (ou um cliente mal-intencionado) mandaria payload ilimitado.
  if (historicoLongoDemais(historico)) {
    return res.status(413).json({ erro: 'historico-longo' });
  }

  const modelo = process.env.BIA_MODEL || MODELO_PADRAO;
  const contents = montarContents({ pergunta, contexto, historico });
  // Streaming é opt-in por query string: mantém o contrato JSON antigo intacto
  // para qualquer cliente que não peça, inclusive o fallback do próprio front.
  const querStream = req.query?.stream === '1';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const metodo = querStream ? 'streamGenerateContent?alt=sse&' : 'generateContent?';
    const resposta = await fetch(
      `${AI_STUDIO_URL}/${encodeURIComponent(modelo)}:${metodo}key=${chave}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents,
          // Orçamento folgado porque os tokens de raciocínio saem daqui: com 200
          // o gemini-3.6-flash gastava tudo pensando e a resposta vinha cortada.
          generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
        }),
      }
    );

    if (!resposta.ok) {
      const detalhe = await resposta.text().catch(() => '');
      console.error('AI Studio respondeu', resposta.status, detalhe.slice(0, 500));
      // 429 = cota diária do tier gratuito esgotada. O front trata como
      // qualquer outra falha e usa as regras locais.
      return res.status(502).json({
        erro: resposta.status === 429 ? 'cota-esgotada' : 'falha-upstream',
        status: resposta.status,
      });
    }

    if (querStream) return await repassarStream(resposta, res);

    const dados = await resposta.json();
    const texto = extrairTexto(dados);

    if (!texto) {
      // Resposta vazia costuma significar bloqueio por filtro de segurança.
      return res.status(502).json({
        erro: 'resposta-vazia',
        motivo: dados?.candidates?.[0]?.finishReason || null,
      });
    }

    return res.status(200).json({ texto, modelo });
  } catch (e) {
    const expirou = e?.name === 'AbortError';
    console.error('Erro ao chamar o modelo:', e?.message);
    return res.status(expirou ? 504 : 500).json({ erro: expirou ? 'timeout' : 'falha-interna' });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Junta as parts de texto, descartando as marcadas com `thought`.
 *
 * O Gemma devolve o rascunho como primeira part (a instrução reescrita em
 * inglês) e a resposta real como segunda. Sem o filtro, o rascunho apareceria
 * no chat.
 */
function extrairTexto(dados) {
  return dados?.candidates?.[0]?.content?.parts
    ?.filter(p => p?.thought !== true)
    .map(p => p?.text || '')
    .join('')
    .trim();
}

/**
 * Converte o SSE do Google em texto puro na resposta.
 *
 * Texto puro em vez de repassar o SSE porque o cliente só quer os pedaços da
 * frase — reencaminhar o envelope obrigaria o front a parsear o formato do
 * Google, acoplando os dois.
 */
async function repassarStream(resposta, res) {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  // Sem isto, um proxy pode acumular a resposta e entregar tudo de uma vez,
  // anulando o streaming.
  res.setHeader('X-Accel-Buffering', 'no');

  const leitor = resposta.body.getReader();
  const decodificador = new TextDecoder();
  let sobra = '';
  let algumTexto = false;

  while (true) {
    const { done, value } = await leitor.read();
    if (done) break;

    sobra += decodificador.decode(value, { stream: true });
    // Eventos SSE são separados por linha em branco; o resto fica para a
    // próxima leitura porque um chunk pode cortar um evento ao meio.
    const eventos = sobra.split('\n\n');
    sobra = eventos.pop() || '';

    for (const evento of eventos) {
      const linha = evento.split('\n').find(l => l.startsWith('data:'));
      if (!linha) continue;
      try {
        const pedaco = extrairTexto(JSON.parse(linha.slice(5).trim()));
        if (pedaco) { res.write(pedaco); algumTexto = true; }
      } catch {
        // Evento malformado não pode derrubar o restante do fluxo.
      }
    }
  }

  // Nada de texto costuma significar bloqueio por filtro de segurança. Como o
  // status 200 já foi enviado, o aviso vai no corpo e o cliente trata como
  // falha por resposta vazia.
  if (!algumTexto) res.write('');
  return res.end();
}

function historicoLongoDemais(historico) {
  if (!Array.isArray(historico)) return false;
  const total = historico.reduce(
    (soma, m) => soma + (typeof m?.texto === 'string' ? m.texto.length : 0),
    0
  );
  return total > MAX_CONTEXTO;
}

/**
 * Monta a conversa completa para o modelo.
 *
 * Sem o histórico aqui, cada pergunta chegava isolada: o modelo não lembrava do
 * que já tinha dito, não respondia a "por quê?" e reincidia nos mesmos temas a
 * cada turno, porque partia sempre do mesmo contexto. Não era conversa.
 *
 * O formato exige alternância estrita user/model começando por user, então a
 * instrução vai no primeiro turno com um "ok" do modelo logo em seguida.
 */
function montarContents({ pergunta, contexto, historico }) {
  const contents = [
    { role: 'user', parts: [{ text: montarInstrucao(contexto) }] },
    { role: 'model', parts: [{ text: 'Entendido. Vou analisar a partir desses dados.' }] },
  ];

  if (Array.isArray(historico)) {
    // Só os últimos turnos: o limite existe para o custo em tokens não crescer
    // sem teto ao longo de uma conversa longa.
    const recentes = historico.slice(-MAX_HISTORICO);
    let esperado = 'user';
    for (const msg of recentes) {
      const papel = msg?.papel === 'bot' ? 'model' : 'user';
      const texto = typeof msg?.texto === 'string' ? msg.texto.slice(0, MAX_PERGUNTA) : '';
      if (!texto.trim()) continue;
      // Descarta o que quebraria a alternância — a API rejeita dois turnos
      // seguidos do mesmo papel.
      if (papel !== esperado) continue;
      contents.push({ role: papel, parts: [{ text: texto }] });
      esperado = papel === 'user' ? 'model' : 'user';
    }
    // O último turno tem de ser do modelo para a pergunta atual entrar depois.
    if (contents[contents.length - 1].role === 'user') contents.pop();
  }

  contents.push({ role: 'user', parts: [{ text: pergunta }] });
  return contents;
}

function montarInstrucao(contexto) {
  const temDados = typeof contexto === 'string' && contexto.trim().length > 0;

  const base = [
    'Você é a B.IA, agente literária do app bibliotech. Seu tom é analítico e',
    'direto, sem bajulação: você examina padrões de leitura em vez de só elogiá-los.',
    'Responda em português do Brasil, em no máximo dois parágrafos curtos.',
    '',
    'Vá direto ao ponto. Nada de saudação ("Olá", "Oi"), de anunciar seu papel',
    '("como sua agente literária...") ou de repetir a pergunta antes de responder.',
    '',
    'LIMITE DA CRÍTICA: critique escolhas, hábitos e padrões de leitura — nunca a',
    'pessoa. Não faça juízo de caráter, inteligência ou valor pessoal a partir da',
    'estante. Proibido: chamar o leitor de preguiçoso, passivo, superficial ou',
    'pretensioso, dizer que ele perde seu tempo, ou sugerir que não deveria estar',
    'ali. Ser exigente é apontar o que os dados mostram e o que fazer com isso;',
    'não é hostilizar quem pergunta.',
    '',
    'CONVERSA: você recebe os turnos anteriores. Leve-os em conta — responda ao',
    'que foi perguntado agora, sem repetir análises que já deu. Se a pergunta é um',
    'seguimento ("por quê?", "e daí?"), continue o raciocínio anterior em vez de',
    'recomeçar do zero.',
  ];

  if (!temDados) {
    // Sem dado nenhum não há padrão a analisar, e o modelo tende a preencher o
    // vazio atacando quem perguntou — foi o que aconteceu na prática.
    return base.concat([
      '',
      'SITUAÇÃO ATUAL: a estante está vazia — nenhum livro cadastrado. Isso é o',
      'estado normal de quem acabou de chegar, não uma falha do leitor, e não deve',
      'ser criticado em hipótese alguma.',
      '',
      'Falta de dados NÃO é motivo para recusar ajuda. Separe o que depende da',
      'estante do que não depende:',
      '',
      '- NÃO depende (responda normalmente, com sua bagagem literária): indicar um',
      '  bom livro, dizer do que uma obra trata, comparar autores, explicar um',
      '  gênero ou movimento, sugerir por onde começar. Se pedirem uma indicação,',
      '  INDIQUE de fato — título e autor concretos, com uma frase do porquê. Se a',
      '  pessoa não deu nenhuma pista de gosto, escolha algo acessível e bem',
      '  avaliado, ou faça UMA pergunta curta sobre o que ela costuma gostar e já',
      '  ofereça uma opção junto. Nunca responda só com um pedido de cadastro.',
      '',
      '- DEPENDE (aí sim explique que precisa de dados): ritmo de leitura, gêneros',
      '  dominantes, taxa de abandono, perfil de leitor, recomendação baseada no',
      '  histórico dela, qualquer número sobre a estante.',
      '',
      'Ao mencionar o cadastro, faça isso em uma frase, ao final, como próximo',
      'passo — nunca como condição para responder. Não repita esse convite se você',
      'já o fez em um turno anterior desta conversa.',
    ]).join('\n');
  }

  return base.concat([
    '',
    'REGRA CRÍTICA SOBRE NÚMEROS: os dados abaixo foram calculados pelo',
    'aplicativo e são exatos. Use apenas esses números. Nunca invente, estime ou',
    'recalcule estatísticas. Se a resposta exige um NÚMERO que não está aqui,',
    'diga que não tem esse dado em vez de deduzi-lo.',
    '',
    'O QUE ESSA REGRA NÃO ALCANÇA: ela vale para estatísticas da estante, não',
    'para literatura. Sobre as OBRAS em si — enredo, autor, contexto histórico,',
    'estilo, recepção crítica, comparação com outros livros — responda com sua',
    'própria bagagem, normalmente. Se perguntarem "me fale mais sobre o livro',
    'que eu coloquei", fale do livro de verdade: do que trata, quem escreveu, o',
    'que o caracteriza. Não responda que faltam dados: o título está logo abaixo,',
    'e o que foi pedido não é uma estatística.',
    '',
    'SE HOUVER UMA SEÇÃO "DADOS DO LIVRO (Google Books)": ela foi buscada agora',
    'na fonte e tem precedência sobre sua memória. Autor, editora, ano, páginas e',
    'avaliação saem dali — nunca de lembrança sua, que pode estar errada. A',
    'sinopse oficial serve de base; comentário, contexto e crítica são seus.',
    '',
    '--- DADOS DA ESTANTE (exatos) ---',
    contexto,
    '--- FIM DOS DADOS ---',
  ]).join('\n');
}
