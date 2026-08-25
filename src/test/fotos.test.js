import { describe, it, expect, vi, beforeEach } from 'vitest';

// O Firestore é carregado sob demanda; o mock intercepta esse carregamento e
// registra a ordem exata das escritas — que é o que importa aqui.
const chamadas = [];
const fsFake = {
  doc: (_db, col, id) => ({ col, id }),
  setDoc: vi.fn(async (ref, dados) => { chamadas.push(['setDoc', ref.col, ref.id, dados]); }),
  updateDoc: vi.fn(async (ref, dados) => { chamadas.push(['updateDoc', ref.col, ref.id, dados]); }),
  deleteDoc: vi.fn(async (ref) => { chamadas.push(['deleteDoc', ref.col, ref.id]); }),
  getDoc: vi.fn(async (ref) => ({
    exists: () => ref.id === 'com-foto',
    data: () => ({ dados: 'data:image/jpeg;base64,AAAA' }),
  })),
  deleteField: () => '<<apagar>>',
};
vi.mock('../firebase', () => ({
  carregarFirestore: async () => ({ fs: fsFake, db: {} }),
}));

import { ehDataUri, separarFoto, salvarFoto, lerFoto, apagarFoto, migrarFotoEmbutida } from '../fotos';

beforeEach(() => { chamadas.length = 0; vi.clearAllMocks(); });

const FOTO = 'data:image/jpeg;base64,/9j/4AAQSkZJRg';

describe('ehDataUri', () => {
  it('separa foto nova de foto já salva', () => {
    expect(ehDataUri(FOTO)).toBe(true);
    expect(ehDataUri('')).toBe(false);
    expect(ehDataUri(null)).toBe(false);
    expect(ehDataUri(undefined)).toBe(false);
  });
});

describe('separarFoto', () => {
  it('tira a foto do livro e marca que existe uma', () => {
    const { dados, foto } = separarFoto({ titulo: 'Duna', fotoUsuario: FOTO });
    expect(dados).toEqual({ titulo: 'Duna', temFoto: true });
    expect(dados.fotoUsuario).toBeUndefined();
    expect(foto).toBe(FOTO);
  });

  // A diferença entre os dois casos abaixo é o coração do update: sem ela,
  // qualquer edição de nota ou status apagaria a foto do livro.
  it('campo ausente significa "não mexeu na foto"', () => {
    const { dados, foto } = separarFoto({ nota: 5 });
    expect(foto).toBeUndefined();
    expect(dados).toEqual({ nota: 5 });
    expect('temFoto' in dados).toBe(false);
  });

  it('campo nulo significa "removeu a foto"', () => {
    const { dados, foto } = separarFoto({ nota: 5, fotoUsuario: null });
    expect(foto).toBeNull();
    expect(dados.temFoto).toBe(false);
  });
});

describe('salvarFoto', () => {
  it('grava em /fotos com o dono junto', async () => {
    await salvarFoto('livro-1', FOTO, 'uid-abc');
    expect(chamadas).toEqual([['setDoc', 'fotos', 'livro-1', { dados: FOTO, uid: 'uid-abc' }]]);
  });

  it('apaga de verdade quando não há foto nova', async () => {
    // Um documento com string vazia continuaria sendo lido e contado.
    await salvarFoto('livro-1', null, 'uid-abc');
    expect(chamadas).toEqual([['deleteDoc', 'fotos', 'livro-1']]);
  });
});

describe('lerFoto', () => {
  it('devolve os dados quando a foto existe', async () => {
    expect(await lerFoto('com-foto')).toBe('data:image/jpeg;base64,AAAA');
  });

  it('devolve null quando não existe', async () => {
    expect(await lerFoto('sem-foto')).toBeNull();
  });

  it('não propaga erro — o card cai na capa da API', async () => {
    fsFake.getDoc.mockRejectedValueOnce(new Error('offline'));
    expect(await lerFoto('qualquer')).toBeNull();
  });
});

describe('apagarFoto', () => {
  it('remove a foto do livro apagado', async () => {
    await apagarFoto('livro-1');
    expect(chamadas).toEqual([['deleteDoc', 'fotos', 'livro-1']]);
  });

  it('engole o erro: o livro já foi removido e a remoção funcionou', async () => {
    fsFake.deleteDoc.mockRejectedValueOnce(new Error('offline'));
    await expect(apagarFoto('livro-1')).resolves.toBeUndefined();
  });
});

describe('migrarFotoEmbutida', () => {
  // Esta ordem é a única que não perde foto de ninguém. Invertida, uma falha
  // de rede no meio apagaria a foto do livro sem ter gravado a cópia.
  it('grava no lugar novo ANTES de tirar do livro', async () => {
    await migrarFotoEmbutida('livro-1', FOTO, 'uid-abc');
    expect(chamadas.map(c => `${c[0]} ${c[1]}`)).toEqual([
      'setDoc fotos',
      'updateDoc livros',
    ]);
  });

  it('marca temFoto e remove o campo antigo do livro', async () => {
    await migrarFotoEmbutida('livro-1', FOTO, 'uid-abc');
    const [, , , dados] = chamadas[1];
    expect(dados.temFoto).toBe(true);
    expect(dados.fotoUsuario).toBe('<<apagar>>');
  });

  it('não toca no livro se a gravação da foto falhar', async () => {
    fsFake.setDoc.mockRejectedValueOnce(new Error('permissão negada'));
    expect(await migrarFotoEmbutida('livro-1', FOTO, 'uid-abc')).toBe(false);
    expect(chamadas.some(c => c[0] === 'updateDoc')).toBe(false);
  });

  it('ignora livro que não tem foto embutida', async () => {
    expect(await migrarFotoEmbutida('livro-1', undefined, 'uid')).toBe(false);
    expect(await migrarFotoEmbutida('livro-1', 'https://exemplo/x.jpg', 'uid')).toBe(false);
    expect(chamadas).toEqual([]);
  });
});
