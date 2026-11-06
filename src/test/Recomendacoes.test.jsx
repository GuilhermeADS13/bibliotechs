import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Recomendacoes, limparCacheRecomendacoes } from '../components/Recomendacoes';

// O cache da sessão vive fora do componente; sem limpar, um teste herdaria o
// resultado do anterior.
beforeEach(() => { limparCacheRecomendacoes(); localStorage.clear(); });

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

// --- Revisão de 2026-11-06 ---------------------------------------------------

const json = (corpo, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });
const volumes = (n) => ({
  items: Array.from({ length: n }, (_, i) => ({ id: `v${i}`, volumeInfo: { title: `Livro ${i}`, authors: [`Autor ${i}`] } })),
});

describe('Recomendacoes: falha, páginas e cache', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('busca fora do ar mostra erro com "Tentar de novo", não "nada encontrado"', async () => {
    let fora = true;
    vi.stubGlobal('fetch', vi.fn(async () => (fora ? json({}, 429) : json(volumes(3)))));
    montar({ onAdicionarLivro: vi.fn() });

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/não respondeu/), { timeout: 3000 });
    expect(screen.queryByText('Nada novo encontrado')).toBeNull();

    fora = false;
    fireEvent.click(screen.getByText('Tentar de novo'));
    await waitFor(() => expect(screen.getAllByText('+ Quero ler')).toHaveLength(3), { timeout: 3000 });
  });

  it('"Outras sugestões" mostra a página seguinte, não a mesma lista', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(volumes(12))));
    montar();

    await waitFor(() => expect(screen.getByText(/Outras sugestões \(1\/2\)/)).toBeInTheDocument(), { timeout: 3000 });
    const primeira = screen.getAllByRole('img').map(i => i.getAttribute('alt') || i.getAttribute('aria-label'));
    fireEvent.click(screen.getByText(/Outras sugestões/));
    const segunda = screen.getAllByRole('img').map(i => i.getAttribute('alt') || i.getAttribute('aria-label'));

    expect(segunda).toHaveLength(6);
    expect(segunda.some(t => primeira.includes(t))).toBe(false);
  });

  it('voltar à aba usa o cache em vez de buscar de novo', async () => {
    const espiao = vi.fn(async () => json(volumes(3)));
    vi.stubGlobal('fetch', espiao);

    const { unmount } = montar();
    await waitFor(() => expect(screen.getByRole('img', { name: 'Livro 0' })).toBeInTheDocument(), { timeout: 3000 });
    const chamadas = espiao.mock.calls.length;
    unmount();

    montar();
    expect(screen.getByRole('img', { name: 'Livro 0' })).toBeInTheDocument();
    expect(espiao.mock.calls.length).toBe(chamadas);
  });

  it('livro adicionado em outra visita não volta do cache', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(volumes(3))));
    const { unmount } = montar();
    await waitFor(() => expect(screen.getByRole('img', { name: 'Livro 0' })).toBeInTheDocument(), { timeout: 3000 });
    unmount();

    // A estante ganhou "Livro 0" em quero-ler: não muda o perfil, mas o livro sai.
    render(<Recomendacoes
      livros={[...estante, { id: 2, titulo: 'Livro 0', status: 'quero-ler' }]}
      DA={DA} GRAD_BTN="" googleBooksKey="k" />);
    expect(screen.queryByRole('img', { name: 'Livro 0' })).toBeNull();
    expect(screen.getByRole('img', { name: 'Livro 1' })).toBeInTheDocument();
  });

  // A queixa da usuária, na tela: abrir o app outro dia e ver os mesmos seis.
  it('numa sessão nova, a aba abre com livros que ainda não apareceram', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(volumes(18))));
    const nomes = () => screen.getAllByRole('img').map(i => i.getAttribute('alt') || i.getAttribute('aria-label'));

    const { unmount } = montar();
    await waitFor(() => expect(screen.getAllByText(/Outras sugestões/).length).toBeGreaterThan(0), { timeout: 3000 });
    const ontem = nomes();
    unmount();

    limparCacheRecomendacoes(); // recarregar a página zera o cache da sessão
    montar();
    await waitFor(() => expect(screen.getAllByText(/Outras sugestões/).length).toBeGreaterThan(0), { timeout: 3000 });
    const hoje = nomes();

    expect(hoje).toHaveLength(6);
    expect(hoje.filter(t => ontem.includes(t))).toEqual([]);
  });

  it('mostra a sinopse sem as tags HTML da Google Books', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({
      items: [{ id: 's', volumeInfo: { title: 'Com sinopse', authors: ['X'], description: '<p>Uma <b>história</b> curta.</p>' } }],
    })));
    montar();
    await waitFor(() => expect(screen.getByText('Uma história curta.')).toBeInTheDocument(), { timeout: 3000 });
  });

  it('com o botão no card, some o link redundante para a aba Adicionar', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(volumes(2))));
    montar({ onAdicionarLivro: vi.fn(), onIrParaAdicionar: vi.fn() });
    await waitFor(() => expect(screen.getAllByText('+ Quero ler').length).toBe(2), { timeout: 3000 });
    expect(screen.queryByText('Adicione à sua estante')).toBeNull();
  });
});

describe('Recomendacoes: autores parecidos pela B.IA', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('não chama o modelo ao abrir a aba — só quando a pessoa pede', async () => {
    const espiao = vi.fn(async () => json(volumes(2)));
    vi.stubGlobal('fetch', espiao);
    montar();
    await waitFor(() => expect(screen.getByText('✨ Pedir à B.IA')).toBeInTheDocument(), { timeout: 3000 });
    expect(espiao.mock.calls.some(([u]) => String(u).includes('/api/bia'))).toBe(false);
  });

  it('sem login, explica em vez de quebrar', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(volumes(2))));
    montar();
    await waitFor(() => expect(screen.getByText('✨ Pedir à B.IA')).toBeInTheDocument(), { timeout: 3000 });
    fireEvent.click(screen.getByText('✨ Pedir à B.IA'));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/conta Google/));
  });
});
