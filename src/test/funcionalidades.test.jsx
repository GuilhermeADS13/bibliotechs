import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BookCard } from '../components/BookCard';
import { ImportarEstante } from '../components/ImportarEstante';
import { LeitorCodigo } from '../components/LeitorCodigo';
import { BookForm } from '../components/BookForm';
import { Recomendacoes, limparCacheRecomendacoes } from '../components/Recomendacoes';

const DA = {
  espresso: '#2C1A14', cream: '#F5F0E0', warmBeige: '#D4C5A9', oxblood: '#6B1E2A',
  copper: '#B87333', mustard: '#D4A017', teal: '#2A7F7F', walnut: '#6B4423', forestGreen: '#2E5E44',
};
const json = (c, s = 200) => new Response(JSON.stringify(c), { status: s, headers: { 'Content-Type': 'application/json' } });

describe('1. Progresso de leitura no card', () => {
  const livro = { id: 1, titulo: 'Duna', autor: 'Frank Herbert', status: 'lendo', paginas: '680', paginaAtual: 100, nota: 0 };
  const montar = (extra = {}) => {
    const onAtualizar = vi.fn();
    render(<BookCard livro={{ ...livro, ...extra }} DA={DA} GRAD_BTN="" onAtualizar={onAtualizar} onRemover={() => {}} onResenha={() => {}} />);
    return onAtualizar;
  };

  it('mostra página e porcentagem', () => {
    montar();
    expect(screen.getByText(/Página 100 de 680 · 15%/)).toBeInTheDocument();
  });

  it('"+10 págs." avança com um toque', () => {
    const onAtualizar = montar();
    fireEvent.click(screen.getByLabelText('Avançar 10 páginas'));
    expect(onAtualizar).toHaveBeenCalledWith({ paginaAtual: 110 });
  });

  it('digitar a página não passa do total', () => {
    const onAtualizar = montar();
    fireEvent.click(screen.getByText('Estou na página…'));
    fireEvent.change(screen.getByLabelText('Página atual'), { target: { value: '999' } });
    fireEvent.click(screen.getByText('Salvar'));
    expect(onAtualizar).toHaveBeenCalledWith({ paginaAtual: 680 });
  });

  it('na última página, oferece marcar como lido', () => {
    const onAtualizar = montar({ paginaAtual: 680 });
    fireEvent.click(screen.getByText(/Terminei/));
    expect(onAtualizar).toHaveBeenCalledWith({ status: 'lido' });
  });

  it('livro lido mostra quanto tempo levou, e a série', () => {
    render(<BookCard livro={{ id: 2, titulo: 'Duna', status: 'lido', dataInicio: '2026-01-01', dataTermino: '2026-01-15', serie: 'Duna', volume: 1 }}
      DA={DA} GRAD_BTN="" onAtualizar={() => {}} onRemover={() => {}} onResenha={() => {}} />);
    expect(screen.getByText('Lido em 14 dias')).toBeInTheDocument();
    expect(screen.getByText('Duna, volume 1')).toBeInTheDocument();
  });
});

describe('6. Importar estante', () => {
  const arquivo = (texto) => new File([texto], 'estante.csv', { type: 'text/csv' });

  it('mostra o resumo antes de gravar e importa sem carimbar data', async () => {
    const onImportar = vi.fn(async () => {});
    render(<ImportarEstante livros={[{ titulo: 'Emma' }]} DA={DA} GRAD_BTN="" onImportar={onImportar} onConcluir={() => {}} />);
    fireEvent.click(screen.getByText('Importar arquivo'));
    fireEvent.change(screen.getByLabelText('Arquivo CSV'), {
      target: { files: [arquivo('titulo,autor,status\nDuna,Frank Herbert,lido\nEmma,Jane Austen,lido\nIracema,Alencar,quero ler')] },
    });

    await waitFor(() => expect(screen.getByText(/2 livros para importar/)).toBeInTheDocument());
    expect(screen.getByText(/1 já estava na estante/)).toBeInTheDocument();
    expect(onImportar).not.toHaveBeenCalled(); // nada é gravado sem confirmar

    fireEvent.click(screen.getByText('Importar 2 livros'));
    await waitFor(() => expect(screen.getByText(/2 livros importados/)).toBeInTheDocument());
    expect(onImportar.mock.calls.map(c => c[0].titulo)).toEqual(['Duna', 'Iracema']);
  });

  it('para no primeiro erro e diz quantos foram salvos', async () => {
    let n = 0;
    const onImportar = vi.fn(async () => { if (++n === 2) throw new Error('offline'); });
    render(<ImportarEstante livros={[]} DA={DA} GRAD_BTN="" onImportar={onImportar} onConcluir={() => {}} />);
    fireEvent.click(screen.getByText('Importar arquivo'));
    fireEvent.change(screen.getByLabelText('Arquivo CSV'), { target: { files: [arquivo('titulo\nA\nB\nC')] } });
    await waitFor(() => screen.getByText('Importar 3 livros'));
    fireEvent.click(screen.getByText('Importar 3 livros'));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/parou no livro 2 de 3/));
    expect(onImportar).toHaveBeenCalledTimes(2);
  });

  it('arquivo sem coluna de título é recusado com explicação', async () => {
    render(<ImportarEstante livros={[]} DA={DA} GRAD_BTN="" onImportar={vi.fn()} onConcluir={() => {}} />);
    fireEvent.click(screen.getByText('Importar arquivo'));
    fireEvent.change(screen.getByLabelText('Arquivo CSV'), { target: { files: [arquivo('pessoa,idade\nAna,3')] } });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/coluna de título/));
  });
});

describe('7. Código de barras', () => {
  it('sem câmera, explica e aceita foto ou o número digitado', async () => {
    const onLido = vi.fn();
    render(<LeitorCodigo DA={DA} onLido={onLido} onFechar={() => {}} />);
    await waitFor(() => expect(screen.getByText(/Não consegui abrir a câmera/)).toBeInTheDocument(), { timeout: 5000 });
    expect(screen.getByLabelText('Foto do código de barras')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('ISBN'), { target: { value: '978-0-441-01359-3' } });
    fireEvent.click(screen.getByText('Buscar'));
    expect(onLido).toHaveBeenCalledWith('9780441013593');
  });

  it('número inválido não busca', () => {
    render(<LeitorCodigo DA={DA} onLido={vi.fn()} onFechar={() => {}} />);
    fireEvent.change(screen.getByLabelText('ISBN'), { target: { value: '9780441013594' } });
    expect(screen.getByText('Buscar')).toBeDisabled();
    expect(screen.getByText(/não é um ISBN válido/)).toBeInTheDocument();
  });

  describe('no formulário', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('ISBN digitado no título busca pelo ISBN e preenche o livro', async () => {
      const espiao = vi.fn(async () => json({ items: [{ volumeInfo: { title: 'Duna', authors: ['Frank Herbert'], pageCount: 680 } }] }));
      vi.stubGlobal('fetch', espiao);
      render(<BookForm onSave={vi.fn()} DA={DA} GRAD_BTN="" />);
      fireEvent.change(screen.getByPlaceholderText(/Digite o título/), { target: { value: '9780441013593' } });
      fireEvent.click(screen.getByText('🔍 Buscar'));
      await waitFor(() => expect(screen.getByDisplayValue('Frank Herbert')).toBeInTheDocument());
      expect(String(espiao.mock.calls[0][0])).toContain('isbn:9780441013593');
    });
  });
});

describe('5. Séries: do "Continue a série" ao formulário', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('o formulário chega com série e volume preenchidos e já busca', async () => {
    const espiao = vi.fn(async () => json({ items: [] }));
    vi.stubGlobal('fetch', espiao);
    const onSave = vi.fn();
    render(<BookForm onSave={onSave} DA={DA} GRAD_BTN="" inicial={{ titulo: 'Duna', autor: 'Frank Herbert', serie: 'Duna', volume: 2 }} />);
    expect(screen.getByDisplayValue('2')).toBeInTheDocument();
    await waitFor(() => expect(espiao).toHaveBeenCalled());

    fireEvent.click(screen.getByText(/Salvar na Estante/));
    expect(onSave.mock.calls[0][0]).toMatchObject({ titulo: 'Duna', serie: 'Duna', volume: 2 });
  });

  it('a aba de recomendações mostra a série interrompida e manda procurar o volume seguinte', async () => {
    limparCacheRecomendacoes();
    vi.stubGlobal('fetch', vi.fn(async () => json({ items: [] })));
    const onIrParaAdicionar = vi.fn();
    render(<Recomendacoes
      livros={[{ id: 1, titulo: 'Duna', autor: 'Frank Herbert', genero: 'Fantasia', serie: 'Duna', volume: 1, status: 'lido', nota: 5 }]}
      DA={DA} GRAD_BTN="" googleBooksKey="" onIrParaAdicionar={onIrParaAdicionar} />);
    await waitFor(() => expect(screen.getByText('Procurar o volume 2')).toBeInTheDocument(), { timeout: 3000 });
    fireEvent.click(screen.getByText('Procurar o volume 2'));
    expect(onIrParaAdicionar).toHaveBeenCalledWith({ titulo: 'Duna', autor: 'Frank Herbert', serie: 'Duna', volume: 2 });
  });
});

describe('2. "Não tenho interesse" na tela', () => {
  beforeEach(() => { limparCacheRecomendacoes(); localStorage.clear(); });
  afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

  it('tira o livro da tela na hora e permite desfazer', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({
      items: ['Ulysses', 'Emma'].map((t, i) => ({ id: `x${i}`, volumeInfo: { title: t, authors: [`Autor ${t}`] } })),
    })));
    render(<Recomendacoes livros={[{ id: 1, titulo: 'Dom Casmurro', autor: 'Machado de Assis', genero: 'Clássico', status: 'lido', nota: 5 }]}
      DA={DA} GRAD_BTN="" googleBooksKey="" />);
    await waitFor(() => expect(screen.getByRole('img', { name: 'Ulysses' })).toBeInTheDocument(), { timeout: 3000 });

    fireEvent.click(screen.getAllByText('Não tenho interesse')[0]);
    expect(screen.queryByRole('img', { name: 'Ulysses' })).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent(/Ulysses.*não vai mais aparecer/);

    fireEvent.click(screen.getByText('Desfazer'));
    expect(screen.getByRole('img', { name: 'Ulysses' })).toBeInTheDocument();
  });
});
