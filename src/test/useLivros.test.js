import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// useLivros e o hook mais critico do app e nao tinha teste nenhum. Ganhou um ao
// passar a carregar o Firestore sob demanda: se esse caminho quebrar, os livros
// somem.

const fsMock = {
  collection: vi.fn(), query: vi.fn(), where: vi.fn(),
  onSnapshot: vi.fn(() => () => {}),
  addDoc: vi.fn(async () => ({ id: 'novo' })),
  updateDoc: vi.fn(async () => {}),
  deleteDoc: vi.fn(async () => {}),
  doc: vi.fn(), serverTimestamp: vi.fn(() => 'ts'),
};

vi.mock('../firebase', () => ({
  carregarFirestore: vi.fn(async () => ({ fs: fsMock, db: {} })),
}));

import { useLivros } from '../hooks/useLivros';

describe('useLivros sem login', () => {
  beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });
  afterEach(() => { localStorage.clear(); });

  it('lê do localStorage e não toca no Firestore', async () => {
    localStorage.setItem('da-livros', JSON.stringify([{ id: 1, titulo: 'Duna', status: 'lido' }]));
    const { carregarFirestore } = await import('../firebase');

    const { result } = renderHook(() => useLivros(null));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.livros).toHaveLength(1);
    expect(result.current.livros[0].titulo).toBe('Duna');
    // O ponto da mudança: sem conta, os ~250 KB do Firestore não são baixados.
    expect(carregarFirestore).not.toHaveBeenCalled();
  });

  it('adiciona e persiste localmente', async () => {
    const { result } = renderHook(() => useLivros(null));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.adicionar({ titulo: 'Duna', status: 'quero-ler' }); });

    expect(result.current.livros).toHaveLength(1);
    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem('da-livros'))[0].titulo).toBe('Duna');
    });
  });

  it('preenche dataTermino ao adicionar um livro já lido', async () => {
    const { result } = renderHook(() => useLivros(null));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.adicionar({ titulo: 'Duna', status: 'lido' }); });
    expect(result.current.livros[0].dataTermino).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('atualiza e remove', async () => {
    const { result } = renderHook(() => useLivros(null));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.adicionar({ titulo: 'Duna', status: 'quero-ler' }); });
    const id = result.current.livros[0].id;

    await act(async () => { await result.current.atualizar(id, { status: 'lendo' }); });
    expect(result.current.livros[0].status).toBe('lendo');

    await act(async () => { await result.current.remover(id); });
    expect(result.current.livros).toHaveLength(0);
  });

  it('não quebra com localStorage corrompido', async () => {
    localStorage.setItem('da-livros', '{quebrado');
    const { result } = renderHook(() => useLivros(null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.livros).toEqual([]);
  });
});

describe('useLivros com login', () => {
  beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });

  it('carrega o Firestore sob demanda e escuta os livros do usuário', async () => {
    const { carregarFirestore } = await import('../firebase');
    const { result } = renderHook(() => useLivros({ uid: 'user123' }));

    await waitFor(() => expect(fsMock.onSnapshot).toHaveBeenCalled());
    expect(carregarFirestore).toHaveBeenCalled();
    expect(fsMock.where).toHaveBeenCalledWith('uid', '==', 'user123');
    expect(result.current).toBeTruthy();
  });

  it('não fica preso em loading se o import do Firestore falhar', async () => {
    const { carregarFirestore } = await import('../firebase');
    carregarFirestore.mockRejectedValueOnce(new Error('rede caiu'));

    const { result } = renderHook(() => useLivros({ uid: 'user123' }));
    // Sem o catch, o app exibiria "Carregando sua estante..." para sempre.
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('migra os livros locais para a conta no primeiro login', async () => {
    localStorage.setItem('da-livros', JSON.stringify([
      { id: 1, titulo: 'Duna', status: 'lido' },
      { id: 2, titulo: 'Ulysses', status: 'lendo' },
    ]));

    renderHook(() => useLivros({ uid: 'user123' }));

    await waitFor(() => expect(fsMock.addDoc).toHaveBeenCalledTimes(2));
    // Limpo antes do envio, para o StrictMode não migrar duas vezes.
    expect(localStorage.getItem('da-livros')).toBeNull();
    expect(fsMock.addDoc.mock.calls[0][1].uid).toBe('user123');
    // O id do client não pode ir junto: o do documento é que vale.
    expect(fsMock.addDoc.mock.calls[0][1].id).toBeUndefined();
  });

  it('devolve os livros ao localStorage se a migração falhar', async () => {
    const locais = [{ id: 1, titulo: 'Duna', status: 'lido' }];
    localStorage.setItem('da-livros', JSON.stringify(locais));
    fsMock.addDoc.mockRejectedValueOnce(new Error('permissão negada'));

    renderHook(() => useLivros({ uid: 'user123' }));

    // Sem esse resgate, uma falha de rede no primeiro login apagaria a estante.
    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem('da-livros') || '[]')).toHaveLength(1);
    });
  });
});
