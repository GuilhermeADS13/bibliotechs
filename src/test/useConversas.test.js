import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// O Firestore agora entra por import dinâmico (carregarFirestore), para não
// pesar no bundle de quem navega sem conta. O mock reproduz esse formato.
const fsMock = {
  collection: vi.fn(), query: vi.fn(), where: vi.fn(),
  // orderBy fica exposto no mock só para o teste provar que NÃO é usado.
  orderBy: vi.fn(),
  onSnapshot: vi.fn(() => () => {}),
  doc: vi.fn(), setDoc: vi.fn(async () => {}), deleteDoc: vi.fn(async () => {}),
  serverTimestamp: vi.fn(() => 'ts'),
  getFirestore: vi.fn(() => ({})),
};

vi.mock('../firebase', () => ({
  carregarFirestore: vi.fn(async () => ({ fs: fsMock, db: {} })),
}));

import { useConversas, diaDeHoje, rotularDia } from '../hooks/useConversas';

describe('diaDeHoje', () => {
  it('formata como AAAA-MM-DD com zero à esquerda', () => {
    expect(diaDeHoje(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(diaDeHoje(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  // toISOString() usaria UTC e viraria o dia às 21h em Brasília, cortando a
  // conversa de quem está lendo à noite.
  it('usa a data local, não UTC', () => {
    const tardeDaNoite = new Date(2026, 7, 10, 23, 30);
    expect(diaDeHoje(tardeDaNoite)).toBe('2026-08-10');
  });
});

describe('rotularDia', () => {
  const hoje = diaDeHoje();

  it('chama o dia corrente de Hoje', () => {
    expect(rotularDia(hoje, hoje)).toBe('Hoje');
  });

  it('chama o anterior de Ontem', () => {
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    expect(rotularDia(diaDeHoje(ontem), hoje)).toBe('Ontem');
  });

  it('usa dia e mês para datas do ano corrente', () => {
    const ano = new Date().getFullYear();
    expect(rotularDia(`${ano}-03-14`, hoje)).toBe('14 de mar');
  });

  it('inclui o ano para datas de anos anteriores', () => {
    expect(rotularDia('2019-03-14', hoje)).toBe('14 de mar de 2019');
  });
});

describe('useConversas sem login (localStorage)', () => {
  beforeEach(() => { localStorage.clear(); });
  afterEach(() => { localStorage.clear(); });

  it('começa vazio quando não há nada guardado', async () => {
    const { result } = renderHook(() => useConversas(null));
    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.conversas).toEqual({});
  });

  it('salva e recupera a conversa do dia', async () => {
    const { result } = renderHook(() => useConversas(null));
    await waitFor(() => expect(result.current.carregando).toBe(false));

    await act(async () => {
      await result.current.salvar('2026-08-10', [
        { id: 1, tipo: 'usuario', texto: 'meu ritmo está bom?', timestamp: new Date() },
        { id: 2, tipo: 'bot', texto: 'Oscila.', timestamp: new Date() },
      ]);
    });

    expect(result.current.conversas['2026-08-10']).toHaveLength(2);
    // Sobrevive a um "refresh": novo hook lê do localStorage.
    const outro = renderHook(() => useConversas(null));
    await waitFor(() => expect(outro.result.current.carregando).toBe(false));
    expect(outro.result.current.conversas['2026-08-10'][0].texto).toBe('meu ritmo está bom?');
  });

  it('serializa timestamp como string para não quebrar o JSON', async () => {
    const { result } = renderHook(() => useConversas(null));
    await waitFor(() => expect(result.current.carregando).toBe(false));

    await act(async () => {
      await result.current.salvar('2026-08-10', [
        { id: 1, tipo: 'bot', texto: 'oi', timestamp: new Date(2026, 7, 10) },
      ]);
    });

    const guardado = JSON.parse(localStorage.getItem('da-conversas'));
    expect(typeof guardado['2026-08-10'][0].timestamp).toBe('string');
  });

  it('mantém dias separados e apaga só o pedido', async () => {
    const { result } = renderHook(() => useConversas(null));
    await waitFor(() => expect(result.current.carregando).toBe(false));

    await act(async () => {
      await result.current.salvar('2026-08-09', [{ id: 1, tipo: 'bot', texto: 'ontem' }]);
      await result.current.salvar('2026-08-10', [{ id: 2, tipo: 'bot', texto: 'hoje' }]);
    });
    expect(Object.keys(result.current.conversas).sort()).toEqual(['2026-08-09', '2026-08-10']);

    await act(async () => { await result.current.apagarDia('2026-08-09'); });
    expect(Object.keys(result.current.conversas)).toEqual(['2026-08-10']);
    expect(JSON.parse(localStorage.getItem('da-conversas'))['2026-08-09']).toBeUndefined();
  });

  it('não quebra com localStorage corrompido', async () => {
    localStorage.setItem('da-conversas', '{isso não é json');
    const { result } = renderHook(() => useConversas(null));
    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.conversas).toEqual({});
  });

  it('ignora um valor guardado que não seja objeto de dias', async () => {
    localStorage.setItem('da-conversas', '["formato antigo"]');
    const { result } = renderHook(() => useConversas(null));
    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.conversas).toEqual({});
  });
});

describe('useConversas com login (Firestore)', () => {
  // A consulta original combinava where('uid') com orderBy('dia'), o que exige
  // um índice composto. Sem o índice a consulta falha inteira e NENHUMA conversa
  // carrega — o usuário saía e voltava e não encontrava nada.
  it('não usa orderBy, que exigiria índice composto', async () => {
    fsMock.orderBy.mockClear();
    fsMock.where.mockClear();

    renderHook(() => useConversas({ uid: 'user123' }));
    await waitFor(() => expect(fsMock.where).toHaveBeenCalled());

    expect(fsMock.where).toHaveBeenCalledWith('uid', '==', 'user123');
    expect(fsMock.orderBy).not.toHaveBeenCalled();
  });

  it('grava no documento <uid>_<dia>, que é o formato exigido pela regra', async () => {
    fsMock.doc.mockClear();
    fsMock.setDoc.mockClear();
    const { result } = renderHook(() => useConversas({ uid: 'user123' }));

    await act(async () => {
      await result.current.salvar('2026-08-10', [{ id: 1, tipo: 'bot', texto: 'oi' }]);
    });

    expect(fsMock.doc).toHaveBeenCalledWith({}, 'conversas', 'user123_2026-08-10');
    const dados = fsMock.setDoc.mock.calls[0][1];
    expect(dados.uid).toBe('user123');
    expect(dados.dia).toBe('2026-08-10');
    expect(dados.mensagens).toHaveLength(1);
  });

  it('não trava o carregamento se o Firestore falhar ao importar', async () => {
    const { carregarFirestore } = await import('../firebase');
    carregarFirestore.mockRejectedValueOnce(new Error('rede caiu'));

    const { result } = renderHook(() => useConversas({ uid: 'user123' }));
    // Sem o catch, `carregando` ficaria true para sempre e o chat exibiria
    // "Carregando conversas..." indefinidamente.
    await waitFor(() => expect(result.current.carregando).toBe(false));
  });
});
