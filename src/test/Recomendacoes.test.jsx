import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Recomendacoes } from '../components/Recomendacoes';

// Relato: "não consigo adicionar diretamente dos recomendados". Havia só um link
// para a aba Adicionar, onde a pessoa redigitava título, autor e gênero que já
// estavam na tela à frente dela.

const DA = {
  espresso: '#2C1A14', cream: '#F5F0E0', warmBeige: '#D4C5A9',
  oxblood: '#6B1E2A', copper: '#B87333', mustard: '#D4A017', teal: '#2A7F7F',
  walnut: '#6B4423',
};

// O mock do setup responde `inauthor:`/`subject:` com livros de Machado.
const estante = [
  { id: 1, titulo: 'Dom Casmurro', autor: 'Machado de Assis', genero: 'Clássico', status: 'lido', nota: 5 },
];

function montar(props = {}) {
  return render(
    <Recomendacoes livros={estante} DA={DA} GRAD_BTN="" googleBooksKey="k" {...props} />
  );
}

describe('Recomendacoes: adicionar direto do card', () => {
  it('mostra o botão em cada recomendação', async () => {
    montar({ onAdicionarLivro: vi.fn() });
    await waitFor(() => {
      expect(screen.getAllByText('+ Quero ler').length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });

  it('manda para a estante os dados que já estavam na tela', async () => {
    const onAdicionarLivro = vi.fn(async () => {});
    montar({ onAdicionarLivro });

    await waitFor(() => expect(screen.getAllByText('+ Quero ler').length).toBeGreaterThan(0), { timeout: 3000 });
    fireEvent.click(screen.getAllByText('+ Quero ler')[0]);

    await waitFor(() => expect(onAdicionarLivro).toHaveBeenCalled());
    const livro = onAdicionarLivro.mock.calls[0][0];
    expect(livro.titulo).toBeTruthy();
    expect(livro.autor).toBeTruthy();
    // Recomendação vira "quero ler": ela ainda não leu, é uma sugestão.
    expect(livro.status).toBe('quero-ler');
    expect(livro.dataTermino).toBe('');
    expect(livro.nota).toBe(0);
  });

  it('confirma na tela e não deixa clicar duas vezes', async () => {
    const onAdicionarLivro = vi.fn(async () => {});
    montar({ onAdicionarLivro });

    await waitFor(() => expect(screen.getAllByText('+ Quero ler').length).toBeGreaterThan(0), { timeout: 3000 });
    const botao = screen.getAllByText('+ Quero ler')[0];
    fireEvent.click(botao);

    await waitFor(() => expect(screen.getAllByText('✓ Na estante').length).toBe(1));
    fireEvent.click(screen.getAllByText('✓ Na estante')[0]);
    expect(onAdicionarLivro).toHaveBeenCalledTimes(1);
  });

  // Se a gravação falhar, o botão precisa voltar — senão a pessoa acha que
  // salvou e o livro não está lá.
  it('desmarca quando a gravação falha', async () => {
    const onAdicionarLivro = vi.fn(async () => { throw new Error('offline'); });
    montar({ onAdicionarLivro });

    await waitFor(() => expect(screen.getAllByText('+ Quero ler').length).toBeGreaterThan(0), { timeout: 3000 });
    const antes = screen.getAllByText('+ Quero ler').length;
    fireEvent.click(screen.getAllByText('+ Quero ler')[0]);

    await waitFor(() => expect(screen.getAllByText('+ Quero ler').length).toBe(antes));
  });

  it('sem a função, o botão não aparece', async () => {
    montar();
    await waitFor(() => expect(screen.getByText(/Recomendado para você/)).toBeInTheDocument());
    expect(screen.queryByText('+ Quero ler')).toBeNull();
  });
});
