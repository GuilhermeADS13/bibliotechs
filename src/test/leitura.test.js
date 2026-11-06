import { describe, it, expect } from 'vitest';
import { progressoDe, duracaoDe, duracaoMedia, seriesEmAndamento, diasEntre } from '../leitura';

describe('progressoDe', () => {
  it('calcula porcentagem, ritmo e previsão de término', () => {
    const p = progressoDe({ paginas: '300', paginaAtual: 100, dataInicio: '2026-11-01' }, '2026-11-11');
    expect(p).toMatchObject({ paginaAtual: 100, total: 300, pct: 33, diasLendo: 10, paginasPorDia: 10 });
    // 200 páginas restantes a 10/dia = 20 dias depois de 11/11.
    expect(p.previsao).toBe('2026-12-01');
  });

  it('sem data de início não inventa previsão', () => {
    const p = progressoDe({ paginas: 300, paginaAtual: 100 }, '2026-11-11');
    expect(p.pct).toBe(33);
    expect(p.previsao).toBeNull();
  });

  it('começou hoje: conta pelo menos um dia de ritmo', () => {
    const p = progressoDe({ paginas: 300, paginaAtual: 30, dataInicio: '2026-11-11' }, '2026-11-11');
    expect(p.paginasPorDia).toBe(30);
  });

  it('página além do total não passa de 100%, e marca que terminou', () => {
    const p = progressoDe({ paginas: 200, paginaAtual: 250 }, '2026-11-11');
    expect(p.pct).toBe(100);
    expect(p.terminou).toBe(true);
  });

  it('sem página nem total não há progresso a mostrar', () => {
    expect(progressoDe({ titulo: 'X' })).toBeNull();
  });
});

describe('duração', () => {
  it('conta os dias entre início e término de um livro lido', () => {
    expect(duracaoDe({ status: 'lido', dataInicio: '2026-03-01', dataTermino: '2026-03-15' })).toBe(14);
    expect(duracaoDe({ status: 'lendo', dataInicio: '2026-03-01' })).toBeNull();
    expect(duracaoDe({ status: 'lido', dataTermino: '2026-03-15' })).toBeNull();
  });

  it('término antes do início é dado inválido, não duração negativa', () => {
    expect(diasEntre('2026-03-15', '2026-03-01')).toBeNull();
  });

  it('média só entre os livros com as duas datas', () => {
    expect(duracaoMedia([
      { status: 'lido', dataInicio: '2026-01-01', dataTermino: '2026-01-11' },
      { status: 'lido', dataInicio: '2026-02-01', dataTermino: '2026-02-21' },
      { status: 'lido', dataTermino: '2026-03-01' },
    ])).toEqual({ dias: 15, livros: 2 });
    expect(duracaoMedia([])).toBeNull();
  });
});

describe('seriesEmAndamento', () => {
  it('aponta o próximo volume quando ele não está na estante', () => {
    const s = seriesEmAndamento([
      { titulo: 'Duna', autor: 'Frank Herbert', serie: 'Duna', volume: 1, status: 'lido' },
    ]);
    expect(s).toEqual([{ serie: 'Duna', autor: 'Frank Herbert', ultimoLido: 1, proximo: 2 }]);
  });

  it('não sugere o que já está na estante, em qualquer status', () => {
    expect(seriesEmAndamento([
      { titulo: 'Duna', serie: 'Duna', volume: 1, status: 'lido' },
      { titulo: 'O Messias de Duna', serie: 'duna', volume: 2, status: 'quero-ler' },
    ])).toEqual([]);
  });

  it('parte do último volume LIDO, ignorando grafia diferente da série', () => {
    const s = seriesEmAndamento([
      { serie: 'Harry Potter', volume: 1, status: 'lido' },
      { serie: 'harry potter ', volume: 3, status: 'lido' },
    ]);
    expect(s[0]).toMatchObject({ ultimoLido: 3, proximo: 4 });
  });

  it('série só com volumes não lidos não entra', () => {
    expect(seriesEmAndamento([{ serie: 'Duna', volume: 1, status: 'quero-ler' }])).toEqual([]);
  });
});
