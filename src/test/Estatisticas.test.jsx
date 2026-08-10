import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Estatisticas } from '../components/Estatisticas';

const DA = {
  espresso: '#2C1A14', cream: '#F5F0E0', warmBeige: '#D4C5A9', oxblood: '#6B1E2A',
  warmBurgundy: '#7B2D42', teal: '#2A7B7A', burntOrange: '#C4612A', forestGreen: '#2E5E44',
  mustard: '#C49A22', copper: '#B5622A', walnut: '#4A3428',
};

const ANO = new Date().getFullYear();

const acervo = [
  { id: 1, titulo: 'Dom Casmurro', autor: 'Machado de Assis', genero: 'Clássico', status: 'lido', nota: 5, paginas: 208, dataTermino: `${ANO}-01-15` },
  { id: 2, titulo: 'O Cortiço', autor: 'Aluísio Azevedo', genero: 'Clássico', status: 'lido', nota: 4, paginas: 300, dataTermino: `${ANO}-01-28` },
  { id: 3, titulo: 'Terror X', autor: 'Fulano', genero: 'Terror', status: 'lido', nota: 3, dataTermino: `${ANO}-05-10` },
  { id: 4, titulo: 'Lendo Agora', status: 'lendo' },
];

describe('Aba de Estatísticas', () => {
  it('mostra o resumo do ano com total lido e média mensal', () => {
    render(<Estatisticas livros={acervo} DA={DA} GRAD_BTN="" />);
    expect(screen.getByText('Livros lidos')).toBeInTheDocument();
    expect(screen.getByText('Média mensal')).toBeInTheDocument();
    expect(screen.getByText('Melhor mês')).toBeInTheDocument();
  });

  it('renderiza o gráfico com uma barra por mês do ano', () => {
    const { container } = render(<Estatisticas livros={acervo} DA={DA} GRAD_BTN="" />);
    expect(screen.getByText(`📅 Livros lidos por mês (${ANO})`)).toBeInTheDocument();

    // Cada barra carrega um title "<mês>: N livro(s)"
    const barras = container.querySelectorAll('[title$="livro"], [title$="livros"]');
    expect(barras).toHaveLength(12);
    expect(container.querySelector('[title="janeiro: 2 livros"]')).toBeTruthy();
    expect(container.querySelector('[title="dezembro: 0 livros"]')).toBeTruthy();
  });

  it('lista o detalhe dos meses com leitura', () => {
    render(<Estatisticas livros={acervo} DA={DA} GRAD_BTN="" />);
    expect(screen.getByText('janeiro')).toBeInTheDocument();
    expect(screen.getByText('maio')).toBeInTheDocument();
    // Soma das páginas de janeiro (208 + 300) confirma o agrupamento
    expect(screen.getByText('2 livros · 508 pág.')).toBeInTheDocument();
  });

  it('mostra ranking de gêneros e autores', () => {
    render(<Estatisticas livros={acervo} DA={DA} GRAD_BTN="" />);
    expect(screen.getByText('🏷️ Gêneros mais lidos')).toBeInTheDocument();
    expect(screen.getByText('Clássico')).toBeInTheDocument();
    expect(screen.getByText('✍️ Autores mais lidos')).toBeInTheDocument();
  });

  it('exibe estado vazio quando não há leitura concluída', () => {
    render(<Estatisticas livros={[{ id: 9, titulo: 'Só lendo', status: 'lendo' }]} DA={DA} GRAD_BTN="" />);
    expect(screen.getByText(`Nenhuma leitura concluída em ${ANO}`)).toBeInTheDocument();
  });

  it('não quebra com estante vazia', () => {
    render(<Estatisticas livros={[]} DA={DA} GRAD_BTN="" />);
    expect(screen.getByText('📊 Estatísticas de Leitura')).toBeInTheDocument();
  });

  it('carrega recomendações baseadas no histórico', async () => {
    render(<Estatisticas livros={acervo} DA={DA} GRAD_BTN="" />);
    expect(screen.getByText('✨ Recomendado para você')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Memórias Póstumas de Brás Cubas')).toBeInTheDocument();
    }, { timeout: 3000 });

    // Livro já na estante não pode ser recomendado
    const cartoes = screen.queryAllByText('Dom Casmurro');
    expect(cartoes).toHaveLength(0);
  });

  it('orienta o usuário quando não há histórico para recomendar', async () => {
    render(<Estatisticas livros={[]} DA={DA} GRAD_BTN="" />);
    await waitFor(() => {
      expect(screen.getByText('Ainda não há histórico suficiente')).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});
