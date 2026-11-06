import { describe, it, expect, vi } from 'vitest';
import { lerAutoresSugeridos, sugerirAutoresParecidos } from '../bia';

// O mock global da Google Books (setup.js) responde a qualquer `inauthor:` com
// livros de Machado de Assis — então só "Machado de Assis" é confirmado, e
// qualquer outro nome sugerido pelo modelo deve ser descartado.

const estante = [
  { titulo: 'Triste Fim de Policarpo Quaresma', autor: 'Lima Barreto', genero: 'Clássico', status: 'lido', nota: 5 },
];

describe('lerAutoresSugeridos', () => {
  it('lê o formato "Nome | motivo" e tolera numeração, marcador e negrito', () => {
    const texto = [
      'Olha, separei estes:',
      '1. **Machado de Assis** | ironia e Rio de Janeiro',
      '- Aluísio Azevedo | naturalismo carioca',
      'linha sem separador',
    ].join('\n');
    expect(lerAutoresSugeridos(texto)).toEqual([
      { nome: 'Machado de Assis', motivo: 'ironia e Rio de Janeiro' },
      { nome: 'Aluísio Azevedo', motivo: 'naturalismo carioca' },
    ]);
  });

  it('descarta quem já está na estante, mesmo escrito de outro jeito, e repetidos', () => {
    const texto = 'LIMA BARRETO | x\nMachado de Assis | y\nmachado de assis | z';
    expect(lerAutoresSugeridos(texto, ['Lima Barreto']).map(a => a.nome)).toEqual(['Machado de Assis']);
  });
});

describe('sugerirAutoresParecidos', () => {
  it('só devolve autores confirmados na Google Books, com obras reais', async () => {
    const perguntar = vi.fn(async () => ({
      texto: 'Machado de Assis | ironia fina\nAutora Que Não Existe | inventada pelo modelo',
      erro: null,
    }));
    const r = await sugerirAutoresParecidos(estante, { perguntar });
    expect(r.erro).toBeNull();
    expect(r.autores.map(a => a.nome)).toEqual(['Machado de Assis']);
    expect(r.autores[0].motivo).toBe('ironia fina');
    expect(r.autores[0].obras.length).toBeGreaterThan(0);
  });

  it('manda ao modelo os favoritos e quem já está na estante', async () => {
    const perguntar = vi.fn(async () => ({ texto: '', erro: 'resposta-vazia' }));
    await sugerirAutoresParecidos(estante, { perguntar });
    const [, contexto] = perguntar.mock.calls[0];
    expect(contexto).toContain('Lima Barreto');
    expect(contexto).toContain('Triste Fim de Policarpo Quaresma');
  });

  it('repassa o erro do modelo (ex.: sem login)', async () => {
    const perguntar = vi.fn(async () => ({ texto: null, erro: 'precisa-login' }));
    const r = await sugerirAutoresParecidos(estante, { perguntar });
    expect(r).toEqual({ autores: [], erro: 'precisa-login' });
  });

  it('avisa quando nenhum nome sugerido foi confirmado', async () => {
    const perguntar = vi.fn(async () => ({ texto: 'Ninguém Real | nada', erro: null }));
    const r = await sugerirAutoresParecidos(estante, { perguntar });
    expect(r.erro).toBe('nada-confirmado');
  });

  it('sem autor favorito não gasta chamada ao modelo', async () => {
    const perguntar = vi.fn();
    const r = await sugerirAutoresParecidos([{ titulo: 'X', status: 'lido', nota: 5 }], { perguntar });
    expect(r.erro).toBe('sem-autores');
    expect(perguntar).not.toHaveBeenCalled();
  });
});
