// Testa o handler serverless de api/bia.js de verdade, importando-o.
//
// Existe porque um ReferenceError bobo (variável renomeada em um lugar e não no
// outro) chegou a produção: os testes cobriam o front e o parsing, mas nunca
// executavam o handler. Agora executam.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import handler from '../../api/bia.js';

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
  beforeEach(() => { process.env.GEMINI_API_KEY = 'chave-de-teste'; });
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
    expect(instrucao).toMatch(/aba Adicionar/);
    // Sem dados não existe seção de números para o modelo consultar.
    expect(instrucao).not.toMatch(/DADOS DA ESTANTE \(exatos\)/);
  });

  it('com dados, envia o contexto exato e a proibição de inventar números', async () => {
    const espiao = vi.fn().mockResolvedValue(respostaOk());
    vi.stubGlobal('fetch', espiao);

    await handler(req({ pergunta: 'e aí?', contexto: 'Lidos: 12 | Abandonados: 2' }), criarRes());

    const instrucao = JSON.parse(espiao.mock.calls[0][1].body).contents[0].parts[0].text;
    expect(instrucao).toMatch(/Lidos: 12 \| Abandonados: 2/);
    expect(instrucao).toMatch(/Nunca invente, estime ou/);
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
