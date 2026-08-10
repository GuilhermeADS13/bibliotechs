// Função serverless (Vercel) que conversa com o Google AI Studio.
//
// Existe por um motivo de segurança: a chave do modelo NÃO pode ir para o
// bundle do front. Variáveis com prefixo VITE_ são embutidas no JavaScript
// público — qualquer pessoa abriria o DevTools e copiaria a chave. GEMINI_API_KEY
// não tem esse prefixo, então só existe aqui, no servidor.

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

  const { pergunta, contexto } = req.body || {};

  if (typeof pergunta !== 'string' || !pergunta.trim()) {
    return res.status(400).json({ erro: 'pergunta-vazia' });
  }
  if (pergunta.length > MAX_PERGUNTA) {
    return res.status(413).json({ erro: 'pergunta-longa' });
  }
  if (typeof contexto === 'string' && contexto.length > MAX_CONTEXTO) {
    return res.status(413).json({ erro: 'contexto-longo' });
  }

  const modelo = process.env.BIA_MODEL || MODELO_PADRAO;

  // A instrução vai dentro do próprio turno do usuário em vez de usar
  // systemInstruction: os modelos Gemma não têm papel de sistema, e desta forma
  // o mesmo código funciona com Gemma e com Gemini.
  const prompt = [montarInstrucao(contexto), '', `Pergunta do leitor: ${pergunta}`].join('\n');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const resposta = await fetch(
      `${AI_STUDIO_URL}/${encodeURIComponent(modelo)}:generateContent?key=${chave}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
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

    const dados = await resposta.json();
    // Descartar as parts marcadas com `thought`: o Gemma devolve o rascunho como
    // primeira part (a instrução reescrita em inglês) e a resposta real como
    // segunda. Sem este filtro, o rascunho apareceria no chat.
    const texto = dados?.candidates?.[0]?.content?.parts
      ?.filter(p => p?.thought !== true)
      .map(p => p?.text || '')
      .join('')
      .trim();

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

function montarInstrucao(contexto) {
  return [
    'Você é a B.IA, agente literária do app bibliotech. Seu tom é analítico e',
    'crítico, sem bajulação: você questiona padrões de leitura em vez de elogiá-los.',
    'Responda em português do Brasil, em no máximo dois parágrafos curtos.',
    '',
    'Vá direto à análise. Nada de saudação ("Olá", "Oi"), de anunciar seu papel',
    '("como sua agente literária...") ou de repetir a pergunta antes de responder.',
    '',
    'REGRA CRÍTICA SOBRE NÚMEROS: todos os dados abaixo foram calculados pelo',
    'aplicativo e são exatos. Use apenas esses números. Nunca invente, estime ou',
    'recalcule estatísticas. Se a resposta exige um dado que não está aqui, diga',
    'que não tem esse dado em vez de deduzi-lo.',
    '',
    '--- DADOS DA ESTANTE (exatos) ---',
    typeof contexto === 'string' && contexto.trim() ? contexto : '(estante vazia)',
    '--- FIM DOS DADOS ---',
  ].join('\n');
}
