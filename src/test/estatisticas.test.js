import { describe, it, expect } from 'vitest';
import { calcularEstatisticas, resumoMensalTexto, anosDisponiveis, mesDoLivro, anoDoLivro, ritmoMeta } from '../estatisticas';

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

describe('ritmoMeta', () => {
  const junho = new Date(2026, 5, 15); // mês 5 = junho, 7 meses restantes

  it('calcula quantos faltam e o ritmo mensal necessário', () => {
    const r = ritmoMeta(6, 20, junho);
    expect(r.restantes).toBe(14);
    expect(r.mesesRestantes).toBe(7);      // junho a dezembro
    expect(r.porMes).toBe(2);              // 14 / 7
  });

  it('projeta o total do ano a partir do ritmo atual', () => {
    const r = ritmoMeta(6, 20, junho);
    expect(r.ritmoAtual).toBe(1);          // 6 livros / 6 meses decorridos
    expect(r.projecao).toBe(12);           // 1 * 12
    expect(r.noRitmo).toBe(false);         // 12 < 20
  });

  it('reconhece quem está no ritmo', () => {
    const r = ritmoMeta(12, 20, junho);    // 2/mês -> projeta 24
    expect(r.projecao).toBe(24);
    expect(r.noRitmo).toBe(true);
  });

  it('marca a meta como cumprida sem exigir mais leitura', () => {
    const r = ritmoMeta(25, 20, junho);
    expect(r.cumprida).toBe(true);
    expect(r.restantes).toBe(0);
    expect(r.porMes).toBe(0);
    expect(r.noRitmo).toBe(true);
  });

  it('trata início de ano sem nenhuma leitura', () => {
    const r = ritmoMeta(0, 12, new Date(2026, 0, 5)); // janeiro
    expect(r.mesesRestantes).toBe(12);
    expect(r.porMes).toBe(1);
    expect(r.projecao).toBe(0);
    expect(r.cumprida).toBe(false);
  });

  it('não quebra em dezembro nem com meta zerada', () => {
    const dezembro = ritmoMeta(3, 10, new Date(2026, 11, 20));
    expect(dezembro.mesesRestantes).toBe(1);
    expect(dezembro.porMes).toBe(7);

    const semMeta = ritmoMeta(3, 0, junho);
    expect(semMeta.restantes).toBe(0);
    expect(Number.isFinite(semMeta.porMes)).toBe(true);
  });
});
