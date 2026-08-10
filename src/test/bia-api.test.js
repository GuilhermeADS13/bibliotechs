// Testa a extração de texto da resposta do Google AI Studio.
//
// A lógica vive em api/bia.js (função serverless, roda no Node do Vercel).
// Replicada aqui porque o handler não é importável no ambiente de teste do
// front — o que importa travar é a REGRA, verificada contra payloads reais
// capturados da API.

import { describe, it, expect } from 'vitest';

// Mesma expressão do handler em api/bia.js
function extrairTexto(dados) {
  return dados?.candidates?.[0]?.content?.parts
    ?.filter(p => p?.thought !== true)
    .map(p => p?.text || '')
    .join('')
    .trim();
}

describe('extração da resposta do modelo', () => {
  it('descarta o rascunho do Gemma marcado com thought', () => {
    // Payload real do gemma-4-31b-it: part[0] é a instrução reescrita em
    // inglês, marcada como thought; part[1] é a resposta ao leitor.
    const payload = {
      candidates: [{
        content: {
          parts: [
            { text: 'B.IA, literary agent of the Bibliotech app.\nAnalytical, critical.\n', thought: true },
            { text: 'Seu ritmo é medíocre. Ler apenas 12 livros por ano demonstra falta de constância.' },
          ],
        },
      }],
    };
    const texto = extrairTexto(payload);
    expect(texto).toBe('Seu ritmo é medíocre. Ler apenas 12 livros por ano demonstra falta de constância.');
    expect(texto).not.toMatch(/literary agent/i); // o rascunho não pode vazar
  });

  it('mantém resposta de part única (Gemini)', () => {
    const payload = { candidates: [{ content: { parts: [{ text: 'Seu ritmo reflete oscilação.' }] } }] };
    expect(extrairTexto(payload)).toBe('Seu ritmo reflete oscilação.');
  });

  it('concatena múltiplas parts legítimas', () => {
    const payload = {
      candidates: [{ content: { parts: [{ text: 'Primeiro parágrafo.\n\n' }, { text: 'Segundo parágrafo.' }] } }],
    };
    expect(extrairTexto(payload)).toBe('Primeiro parágrafo.\n\nSegundo parágrafo.');
  });

  it('devolve vazio quando só há rascunho (resposta truncada por maxOutputTokens)', () => {
    const payload = { candidates: [{ content: { parts: [{ text: 'pensando...', thought: true }] } }] };
    expect(extrairTexto(payload)).toBe('');
  });

  it('não quebra com payload de erro ou bloqueio de segurança', () => {
    expect(extrairTexto({ candidates: [{ finishReason: 'SAFETY' }] })).toBeUndefined();
    expect(extrairTexto({})).toBeUndefined();
    expect(extrairTexto(null)).toBeUndefined();
  });
});
