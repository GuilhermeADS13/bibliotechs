import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LiteraryAgent } from '../components/LiteraryAgent';

const mockDA = {
  espresso: '#2C1A14',
  cream: '#F5F0E0',
  warmBeige: '#D4C5A9',
  oxblood: '#6B1E2A',
  warmBurgundy: '#7B2D42'
};

const mockLivros = [
  { id: 1, titulo: 'Dom Casmurro', autor: 'Machado de Assis', status: 'lido', nota: 5, genero: 'Clássico' }
];

describe('LiteraryAgent (B.IA) Integration', () => {
  it('deve renderizar o botão inicial da B.IA', () => {
    render(<LiteraryAgent livros={mockLivros} DA={mockDA} GRAD_BTN="" />);
    expect(screen.getByTitle('Abrir B.IA')).toBeInTheDocument();
  });

  it('deve abrir o chat e mostrar a mensagem de boas-vindas', () => {
    render(<LiteraryAgent livros={mockLivros} DA={mockDA} GRAD_BTN="" />);
    fireEvent.click(screen.getByTitle('Abrir B.IA'));
    expect(screen.getByText(/Sou B.IA, sua Agente Literária Analítica/)).toBeInTheDocument();
  });

  it('deve buscar resumo de um livro via API simulada', async () => {
    render(<LiteraryAgent livros={mockLivros} DA={mockDA} GRAD_BTN="" googleBooksKey="test-key" />);
    fireEvent.click(screen.getByTitle('Abrir B.IA'));

    const input = screen.getByPlaceholderText(/Ex: 'Resuma \[Título\]'/);
    fireEvent.change(input, { target: { value: 'Resuma O Alquimista' } });
    fireEvent.click(screen.getByText('→'));

    // Aguarda a resposta da B.IA (simulada com MSW no setup.js)
    await waitFor(() => {
      expect(screen.getByText(/Análise Crítica: "O Alquimista"/)).toBeInTheDocument();
      expect(screen.getByText(/Um clássico sobre seguir seus sonhos/)).toBeInTheDocument();
      expect(screen.getByText(/Autor: Paulo Coelho/)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('deve responder analiticamente sobre as estatísticas da estante', async () => {
    render(<LiteraryAgent livros={mockLivros} DA={mockDA} GRAD_BTN="" />);
    fireEvent.click(screen.getByTitle('Abrir B.IA'));

    const input = screen.getByPlaceholderText(/Ex: 'Resuma \[Título\]'/);
    fireEvent.change(input, { target: { value: 'Quais são minhas estatísticas?' } });
    fireEvent.click(screen.getByText('→'));

    await waitFor(() => {
      expect(screen.getByText(/Seus dados quantitativos revelam um acervo de 1 unidades/)).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});
