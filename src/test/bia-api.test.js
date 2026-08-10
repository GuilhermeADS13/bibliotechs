// Testa o handler serverless de api/bia.js de verdade, importando-o.
//
// Existe porque um ReferenceError bobo (variável renomeada em um lugar e não no
// outro) chegou a produção: os testes cobriam o front e o parsing, mas nunca
// executavam o handler. Agora executam.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// A verificação real confere a assinatura do token contra as chaves públicas do
// Google — forjar um token válido no teste não é viável, e a lógica dela é
// testada pelo seu próprio contrato (uid ou erro).
vi.mock('../../api/_auth.js', () => ({
  verificarToken: vi.fn(async () => ({ uid: 'user123' })),
}));

import handler from '../../api/bia.js';
import { verificarToken } from '../../api/_auth.js';

// Dublê mínimo do `res` do Node/Vercel: encadeia status().json() e guarda o que foi enviado.
function criarRes() {
  const res = {
    statusCode: null,
    corpo: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.corpo = b; return this; },
  };
  return res;
}

const req = (body, method = 'POST') => ({ method, body });

function respostaOk(texto = 'Análise da estante.') {
  return {
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text: texto }] } }] }),
  };
}

describe('handler api/bia', () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'chave-de-teste';
    verificarToken.mockResolvedValue({ uid: 'user123' });
  });
  afterEach(() => { vi.unstubAllGlobals(); delete process.env.GEMINI_API_KEY; delete process.env.BIA_MODEL; });

  it('responde 200 com o texto do modelo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respostaOk()));
    const res = criarRes();
    await handler(req({ pergunta: 'meu ritmo está bom?', contexto: 'Lidos: 12' }), res);
    expect(res.statusCode).toBe(200);
    expect(res.corpo.texto).toBe('Análise da estante.');
  });

  it('monta a conversa com histórico em turnos alternados', async () => {
    const espiao = vi.fn().mockResolvedValue(respostaOk());
    vi.stubGlobal('fetch', espiao);

    await handler(req({
      pergunta: 'e daí?',
      contexto: 'Lidos: 12',
      historico: [
        { papel: 'usuario', texto: 'meu ritmo está bom?' },
        { papel: 'bot', texto: 'Seu ritmo oscila.' },
      ],
    }), criarRes());

    const { contents } = JSON.parse(espiao.mock.calls[0][1].body);
    // instrução, ok do modelo, pergunta anterior, resposta anterior, pergunta atual
    expect(contents.map(c => c.role)).toEqual(['user', 'model', 'user', 'model', 'user']);
    expect(contents.at(-1).parts[0].text).toBe('e daí?');
    expect(contents[2].parts[0].text).toBe('meu ritmo está bom?');
  });

  it('descarta turnos que quebrariam a alternância exigida pela API', async () => {
    const espiao = vi.fn().mockResolvedValue(respostaOk());
    vi.stubGlobal('fetch', espiao);

    await handler(req({
      pergunta: 'e agora?',
      contexto: 'Lidos: 12',
      historico: [
        { papel: 'usuario', texto: 'p1' },
        { papel: 'usuario', texto: 'p2 (duplicada — deve sair)' },
        { papel: 'bot', texto: 'r1' },
      ],
    }), criarRes());

    const { contents } = JSON.parse(espiao.mock.calls[0][1].body);
    expect(contents.map(c => c.role)).toEqual(['user', 'model', 'user', 'model', 'user']);
    expect(JSON.stringify(contents)).not.toMatch(/deve sair/);
  });

  it('não deixa o histórico terminar em turno do usuário', async () => {
    const espiao = vi.fn().mockResolvedValue(respostaOk());
    vi.stubGlobal('fetch', espiao);

    await handler(req({
      pergunta: 'atual',
      contexto: 'Lidos: 12',
      historico: [{ papel: 'usuario', texto: 'orfa' }], // sem resposta correspondente
    }), criarRes());

    const { contents } = JSON.parse(espiao.mock.calls[0][1].body);
    expect(contents.map(c => c.role)).toEqual(['user', 'model', 'user']);
  });

  // Este era o caso que gerava resposta hostil com quem acabou de instalar o app.
  it('com estante vazia, instrui acolhimento e proíbe crítica', async () => {
    const espiao = vi.fn().mockResolvedValue(respostaOk());
    vi.stubGlobal('fetch', espiao);

    await handler(req({ pergunta: 'o que minha estante diz sobre mim?', contexto: '' }), criarRes());

    const instrucao = JSON.parse(espiao.mock.calls[0][1].body).contents[0].parts[0].text;
    expect(instrucao).toMatch(/estante está vazia/);
    expect(instrucao).toMatch(/não deve\s+ser criticado/); // \s+ porque o texto quebra linha
    // Sem dados não existe seção de números para o modelo consultar.
    expect(instrucao).not.toMatch(/DADOS DA ESTANTE \(exatos\)/);
  });

  // Ao proibir a hostilidade eu exagerei: ela passou a recusar ate pedidos que
  // nao dependem da estante ("queria ler um livro bom" -> "cadastre primeiro").
  it('com estante vazia, ainda assim deve indicar livros de verdade', async () => {
    const espiao = vi.fn().mockResolvedValue(respostaOk());
    vi.stubGlobal('fetch', espiao);

    await handler(req({ pergunta: 'queria ler um livro bom agora', contexto: '' }), criarRes());

    const instrucao = JSON.parse(espiao.mock.calls[0][1].body).contents[0].parts[0].text;
    expect(instrucao).toMatch(/NÃO é motivo para recusar ajuda/);
    expect(instrucao).toMatch(/INDIQUE de fato/);
    expect(instrucao).toMatch(/Nunca responda só com um pedido de cadastro/);
    expect(instrucao).toMatch(/nunca como condição para responder/);
  });

  it('com dados, envia o contexto exato e a proibição de inventar números', async () => {
    const espiao = vi.fn().mockResolvedValue(respostaOk());
    vi.stubGlobal('fetch', espiao);

    await handler(req({ pergunta: 'e aí?', contexto: 'Lidos: 12 | Abandonados: 2' }), criarRes());

    const instrucao = JSON.parse(espiao.mock.calls[0][1].body).contents[0].parts[0].text;
    expect(instrucao).toMatch(/Lidos: 12 \| Abandonados: 2/);
    expect(instrucao).toMatch(/Nunca invente, estime ou/);
  });

  // A regra dos números estava sendo aplicada a todo conhecimento: perguntada
  // sobre a obra cadastrada, ela respondia "não tenho dados analíticos" em vez
  // de falar do livro, que é algo que ela sabe.
  it('deixa claro que a regra dos números não alcança conhecimento literário', async () => {
    const espiao = vi.fn().mockResolvedValue(respostaOk());
    vi.stubGlobal('fetch', espiao);

    await handler(req({
      pergunta: 'queria saber mais sobre o livro que eu coloquei',
      contexto: 'Lendo agora: "Coração Satânico"',
    }), criarRes());

    const instrucao = JSON.parse(espiao.mock.calls[0][1].body).contents[0].parts[0].text;
    expect(instrucao).toMatch(/O QUE ESSA REGRA NÃO ALCANÇA/);
    expect(instrucao).toMatch(/enredo, autor, contexto histórico/);
    expect(instrucao).toMatch(/Não responda que faltam dados/);
  });

  it('rejeita histórico grande demais', async () => {
    const res = criarRes();
    await handler(req({
      pergunta: 'e aí?',
      contexto: 'x',
      historico: [{ papel: 'usuario', texto: 'a'.repeat(20001) }],
    }), res);
    expect(res.statusCode).toBe(413);
    expect(res.corpo.erro).toBe('historico-longo');
  });

  // Feedback de usuária: "tá muito robótico, tu podia fazer como se fosse uma
  // conversa". A instrução anterior pedia "analítico e direto" e "no máximo
  // dois parágrafos" — e produzia relatório.
  it('instrui tom de conversa, não de relatório', async () => {
    const espiao = vi.fn().mockResolvedValue(respostaOk());
    vi.stubGlobal('fetch', espiao);
    await handler(req({ pergunta: 'e aí?', contexto: 'Lidos: 12' }), criarRes());

    const instrucao = JSON.parse(espiao.mock.calls[0][1].body).contents[0].parts[0].text;
    expect(instrucao).toMatch(/amiga que lê/);
    expect(instrucao).toMatch(/não como um sistema que\s+gera relatórios/);
    // Vocabulário de laudo é o que mais fazia soar robótico.
    expect(instrucao).toMatch(/vocabulário de laudo/);
    expect(instrucao).toMatch(/padrão de consumo/); // consta como termo proibido
    // Ela abria quase toda resposta com "Sua estante...".
    expect(instrucao).toMatch(/não comece sempre/);
    // Tamanho fixo forçava dois parágrafos mesmo para pergunta simples.
    expect(instrucao).toMatch(/no tamanho que a pergunta pede/);
    expect(instrucao).toMatch(/devolva uma pergunta curta/);
  });

  it('o turno de acerto do modelo não usa tom burocrático', async () => {
    const espiao = vi.fn().mockResolvedValue(respostaOk());
    vi.stubGlobal('fetch', espiao);
    await handler(req({ pergunta: 'e aí?', contexto: 'x' }), criarRes());

    // O modelo imita a própria fala anterior: um "Entendido." formal aqui
    // puxava a resposta inteira para o registro de relatório.
    const ok = JSON.parse(espiao.mock.calls[0][1].body).contents[1].parts[0].text;
    expect(ok).not.toMatch(/Entendido|Vou analisar a partir/);
  });

  it('proíbe ataque pessoal em qualquer situação', async () => {
    const espiao = vi.fn().mockResolvedValue(respostaOk());
    vi.stubGlobal('fetch', espiao);
    await handler(req({ pergunta: 'e aí?', contexto: 'Lidos: 12' }), criarRes());
    const instrucao = JSON.parse(espiao.mock.calls[0][1].body).contents[0].parts[0].text;
    expect(instrucao).toMatch(/nunca a\s*\n?\s*pessoa/);
    expect(instrucao).toMatch(/perde seu tempo/); // consta como comportamento proibido
  });

  it('usa BIA_MODEL quando definido', async () => {
    process.env.BIA_MODEL = 'gemma-4-31b-it';
    const espiao = vi.fn().mockResolvedValue(respostaOk());
    vi.stubGlobal('fetch', espiao);
    await handler(req({ pergunta: 'e aí?', contexto: 'x' }), criarRes());
    expect(espiao.mock.calls[0][0]).toContain('gemma-4-31b-it');
  });

  it('descarta a part de rascunho marcada com thought (Gemma)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [
        { text: 'B.IA, literary agent. Analytical.', thought: true },
        { text: 'Seu ritmo é irregular.' },
      ] } }] }),
    }));
    const res = criarRes();
    await handler(req({ pergunta: 'e aí?', contexto: 'x' }), res);
    expect(res.corpo.texto).toBe('Seu ritmo é irregular.');
    expect(res.corpo.texto).not.toMatch(/literary agent/i);
  });

  // O endpoint fica público assim que o site sobe: sem esta barreira, qualquer
  // um chama em laço e esgota a cota gratuita do dono do app.
  describe('autenticação', () => {
    it('401 quando não há token', async () => {
      verificarToken.mockResolvedValue({ erro: 'sem-token' });
      const res = criarRes();
      await handler(req({ pergunta: 'e aí?', contexto: 'x' }), res);
      expect(res.statusCode).toBe(401);
      expect(res.corpo.erro).toBe('precisa-login');
    });

    it('401 quando o token é inválido ou expirou', async () => {
      verificarToken.mockResolvedValue({ erro: 'token-invalido' });
      const res = criarRes();
      await handler(req({ pergunta: 'e aí?', contexto: 'x' }), res);
      expect(res.statusCode).toBe(401);
    });

    it('não chama o modelo quando a autenticação falha', async () => {
      verificarToken.mockResolvedValue({ erro: 'sem-token' });
      const espiao = vi.fn();
      vi.stubGlobal('fetch', espiao);
      await handler(req({ pergunta: 'e aí?', contexto: 'x' }), criarRes());
      expect(espiao).not.toHaveBeenCalled(); // nenhum token da cota é gasto
    });

    it('503 quando o FIREBASE_PROJECT_ID não está configurado', async () => {
      verificarToken.mockResolvedValue({ erro: 'sem-project-id' });
      const res = criarRes();
      await handler(req({ pergunta: 'e aí?', contexto: 'x' }), res);
      expect(res.statusCode).toBe(503);
      expect(res.corpo.erro).toBe('sem-config');
    });
  });

  describe('erros', () => {
    it('503 quando falta a chave', async () => {
      delete process.env.GEMINI_API_KEY;
      const res = criarRes();
      await handler(req({ pergunta: 'e aí?' }), res);
      expect(res.statusCode).toBe(503);
      expect(res.corpo.erro).toBe('sem-chave');
    });

    it('405 para método diferente de POST', async () => {
      const res = criarRes();
      await handler(req({}, 'GET'), res);
      expect(res.statusCode).toBe(405);
    });

    it('400 para pergunta vazia', async () => {
      const res = criarRes();
      await handler(req({ pergunta: '   ' }), res);
      expect(res.statusCode).toBe(400);
    });

    it('413 para pergunta acima do limite', async () => {
      const res = criarRes();
      await handler(req({ pergunta: 'a'.repeat(2001) }), res);
      expect(res.statusCode).toBe(413);
    });

    it('502 e motivo cota-esgotada no 429 da API', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429, text: async () => '' }));
      const res = criarRes();
      await handler(req({ pergunta: 'e aí?', contexto: 'x' }), res);
      expect(res.statusCode).toBe(502);
      expect(res.corpo.erro).toBe('cota-esgotada');
    });

    it('502 quando o modelo devolve texto vazio', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ candidates: [{ finishReason: 'SAFETY' }] }),
      }));
      const res = criarRes();
      await handler(req({ pergunta: 'e aí?', contexto: 'x' }), res);
      expect(res.statusCode).toBe(502);
      expect(res.corpo.erro).toBe('resposta-vazia');
    });
  });
});
