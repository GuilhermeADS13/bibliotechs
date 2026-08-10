import { describe, it, expect } from 'vitest';
import { calcularEstatisticas, resumoMensalTexto, anosDisponiveis, mesDoLivro, anoDoLivro } from '../estatisticas';

const acervo = [
  { id: 1, titulo: 'A', status: 'lido', nota: 5, genero: 'Ficção', autor: 'Ana', paginas: 300, dataTermino: '2026-01-15' },
  { id: 2, titulo: 'B', status: 'lido', nota: 4, genero: 'Ficção', autor: 'Bruno', paginas: '250', dataTermino: '2026-01-20' },
  { id: 3, titulo: 'C', status: 'lido', nota: 3, genero: 'Terror', autor: 'Ana', paginas: 180, dataTermino: '2026-03-02' },
  { id: 4, titulo: 'D', status: 'lendo' },
  { id: 5, titulo: 'E', status: 'quero-ler' },
  { id: 6, titulo: 'F', status: 'abandonei', dataTermino: '' },
  { id: 7, titulo: 'G', status: 'lido', nota: 5, paginas: 100, dataTermino: '2025-06-01' },
];

describe('estatisticas', () => {
  it('agrupa livros lidos por mês do ano selecionado', () => {
    const s = calcularEstatisticas(acervo, 2026);
    expect(s.totalNoAno).toBe(3);
    expect(s.porMes[0].quantidade).toBe(2);  // janeiro
    expect(s.porMes[2].quantidade).toBe(1);  // março
    expect(s.porMes[5].quantidade).toBe(0);  // junho (livro é de 2025)
    expect(s.mesesAtivos).toBe(2);
  });

  it('identifica o melhor mês e a média por mês ativo', () => {
    const s = calcularEstatisticas(acervo, 2026);
    expect(s.melhorMes.nomeLongo).toBe('janeiro');
    expect(s.melhorMes.quantidade).toBe(2);
    expect(s.mediaMensal).toBe(1.5); // 3 livros / 2 meses ativos
  });

  it('soma páginas aceitando number e string', () => {
    const s = calcularEstatisticas(acervo, 2026);
    expect(s.paginasAno).toBe(730); // 300 + 250 + 180
    expect(s.mediaPaginas).toBe(243);
  });

  it('calcula taxas de conclusão e abandono sobre a estante inteira', () => {
    const s = calcularEstatisticas(acervo, 2026);
    expect(s.lidos).toBe(4);
    expect(s.taxaConclusao).toBe(57.1); // 4 de 7
    expect(s.taxaAbandono).toBe(14.3);  // 1 de 7
  });

  it('ordena gêneros e autores por quantidade com nota média', () => {
    const s = calcularEstatisticas(acervo, 2026);
    expect(s.generos[0]).toEqual({ nome: 'Ficção', quantidade: 2, notaMedia: 4.5 });
    expect(s.autores[0].nome).toBe('Ana');
    expect(s.autores[0].quantidade).toBe(2);
  });

  it('não quebra com estante vazia', () => {
    const s = calcularEstatisticas([], 2026);
    expect(s.totalNoAno).toBe(0);
    expect(s.taxaConclusao).toBe(0);
    expect(s.taxaAbandono).toBe(0);
    expect(s.melhorMes).toBeNull();
    expect(s.mediaMensal).toBe(0);
  });

  it('ignora datas ausentes ou malformadas', () => {
    expect(mesDoLivro({ dataTermino: '' })).toBeNull();
    expect(mesDoLivro({})).toBeNull();
    expect(anoDoLivro({ dataTermino: '2026-04-01' })).toBe(2026);
    expect(mesDoLivro({ dataTermino: '2026-04-01' })).toBe(3);
  });

  it('lista os anos com registro mais o ano corrente', () => {
    const anos = anosDisponiveis(acervo);
    expect(anos).toContain(2026);
    expect(anos).toContain(2025);
    expect(anos).toContain(new Date().getFullYear());
    expect(anos[0]).toBeGreaterThan(anos[anos.length - 1]); // ordem decrescente
  });

  it('gera resumo textual com pico e volume', () => {
    const texto = resumoMensalTexto(calcularEstatisticas(acervo, 2026));
    expect(texto).toMatch(/concluiu 3 obras/);
    expect(texto).toMatch(/pico foi janeiro/);
    expect(texto).toMatch(/730 páginas/);
  });

  it('avisa quando não há registros no ano', () => {
    const texto = resumoMensalTexto(calcularEstatisticas(acervo, 2020));
    expect(texto).toMatch(/Não há registros de conclusão em 2020/);
  });
});
