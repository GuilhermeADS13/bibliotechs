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

const ANO = new Date().getFullYear();

// Estante com datas de término, necessária para a análise temporal
const mockLivrosComDatas = [
  { id: 1, titulo: 'Dom Casmurro', autor: 'Machado de Assis', status: 'lido', nota: 5, genero: 'Clássico', paginas: 208, dataTermino: `${ANO}-01-15` },
  { id: 2, titulo: 'O Cortiço', autor: 'Aluísio Azevedo', status: 'lido', nota: 4, genero: 'Clássico', paginas: 300, dataTermino: `${ANO}-01-22` },
  { id: 3, titulo: 'Vidas Secas', autor: 'Graciliano Ramos', status: 'lido', nota: 5, genero: 'Clássico', dataTermino: `${ANO}-04-08` },
];

// Envia uma pergunta no chat já aberto
function perguntar(texto) {
  const input = screen.getByPlaceholderText(/Ex: 'Resuma \[Título\]'/);
  fireEvent.change(input, { target: { value: texto } });
  fireEvent.click(screen.getByText('→'));
}

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

  it('deve analisar a quantidade de livros lidos por mês', async () => {
    render(<LiteraryAgent livros={mockLivrosComDatas} DA={mockDA} GRAD_BTN="" />);
    fireEvent.click(screen.getByTitle('Abrir B.IA'));

    perguntar('Quantos livros li por mês?');

    await waitFor(() => {
      expect(screen.getByText(new RegExp(`Análise Temporal de ${ANO}`))).toBeInTheDocument();
      expect(screen.getByText(/concluiu 3 obras/)).toBeInTheDocument();
      expect(screen.getByText(/pico foi janeiro/)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('deve detalhar a distribuição mensal com contagem por mês', async () => {
    render(<LiteraryAgent livros={mockLivrosComDatas} DA={mockDA} GRAD_BTN="" />);
    fireEvent.click(screen.getByTitle('Abrir B.IA'));

    perguntar('Qual meu ritmo de leitura?');

    await waitFor(() => {
      expect(screen.getByText(/janeiro.*2 livros/s)).toBeInTheDocument();
      expect(screen.getByText(/abril.*1 livro/s)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('deve avisar quando não há datas de término registradas', async () => {
    render(<LiteraryAgent livros={mockLivros} DA={mockDA} GRAD_BTN="" />);
    fireEvent.click(screen.getByTitle('Abrir B.IA'));

    perguntar('Quantos livros li por mês?');

    await waitFor(() => {
      expect(screen.getByText(/Não há registros de conclusão/)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('deve recomendar livros com base no histórico de leitura', async () => {
    render(<LiteraryAgent livros={mockLivrosComDatas} DA={mockDA} GRAD_BTN="" googleBooksKey="test-key" />);
    fireEvent.click(screen.getByTitle('Abrir B.IA'));

    perguntar('Me recomende um livro');

    await waitFor(() => {
      expect(screen.getByText(/Recomendações Baseadas no Seu Histórico/)).toBeInTheDocument();
      expect(screen.getByText(/Memórias Póstumas de Brás Cubas/)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('não deve recomendar livros que já estão na estante', async () => {
    render(<LiteraryAgent livros={mockLivrosComDatas} DA={mockDA} GRAD_BTN="" />);
    fireEvent.click(screen.getByTitle('Abrir B.IA'));

    perguntar('O que ler agora?');

    await waitFor(() => {
      expect(screen.getByText(/Recomendações Baseadas no Seu Histórico/)).toBeInTheDocument();
    }, { timeout: 3000 });

    const resposta = screen.getByText(/Recomendações Baseadas no Seu Histórico/).textContent;
    expect(resposta).not.toMatch(/1\. Dom Casmurro/);
  });

  it('deve pedir histórico antes de recomendar quando nada foi lido', async () => {
    render(<LiteraryAgent livros={[{ id: 1, titulo: 'X', status: 'quero-ler' }]} DA={mockDA} GRAD_BTN="" />);
    fireEvent.click(screen.getByTitle('Abrir B.IA'));

    perguntar('Me recomende algo');

    await waitFor(() => {
      expect(screen.getByText(/Não posso recomendar sem base empírica/)).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});
