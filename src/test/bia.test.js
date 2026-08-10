import { describe, it, expect, vi, afterEach } from 'vitest';
import { montarContexto, perguntarAoModelo } from '../bia';

const acervo = [
  { id: 1, titulo: 'Dom Casmurro', autor: 'Machado de Assis', genero: 'Clássico', status: 'lido', nota: 5, dataTermino: '2026-03-10', paginas: 256 },
  { id: 2, titulo: 'O Cortiço', autor: 'Aluísio Azevedo', genero: 'Clássico', status: 'lido', nota: 4, dataTermino: '2026-03-22', paginas: 300 },
  { id: 3, titulo: 'Duna', autor: 'Frank Herbert', genero: 'Ficção', status: 'lendo' },
  { id: 4, titulo: 'Ulysses', autor: 'James Joyce', genero: 'Modernismo', status: 'abandonei', nota: 2 },
];

describe('montarContexto', () => {
  it('devolve string vazia para estante vazia', () => {
    expect(montarContexto([])).toBe('');
    expect(montarContexto(null)).toBe('');
  });

  it('inclui os totais por status', () => {
    const ctx = montarContexto(acervo, 2026);
    expect(ctx).toMatch(/Total de livros na estante: 4/);
    expect(ctx).toMatch(/Lidos: 2/);
    expect(ctx).toMatch(/Abandonados: 1/);
  });

  it('inclui a distribuição mensal só dos meses com leitura', () => {
    const ctx = montarContexto(acervo, 2026);
    expect(ctx).toMatch(/- março: 2/);
    expect(ctx).not.toMatch(/janeiro/); // mês sem leitura não polui o contexto
  });

  it('lista gêneros e autores com nota média', () => {
    const ctx = montarContexto(acervo, 2026);
    expect(ctx).toMatch(/- Clássico: 2 livro\(s\), nota 4\.5/);
    expect(ctx).toMatch(/- Machado de Assis: 1 livro\(s\), nota 5/);
  });

  it('lista as concluídas da mais recente para a mais antiga', () => {
    const ctx = montarContexto(acervo, 2026);
    const posCortico = ctx.indexOf('O Cortiço');
    const posCasmurro = ctx.indexOf('Dom Casmurro"');
    expect(posCortico).toBeGreaterThan(-1);
    expect(posCortico).toBeLessThan(posCasmurro); // 22/03 antes de 10/03
  });

  it('registra o que está sendo lido agora', () => {
    expect(montarContexto(acervo, 2026)).toMatch(/Lendo agora: "Duna"/);
  });

  it('não inventa páginas quando o campo está ausente', () => {
    const semPaginas = [{ id: 1, titulo: 'X', status: 'lido', dataTermino: '2026-01-05' }];
    expect(montarContexto(semPaginas, 2026)).not.toMatch(/Páginas em/);
  });
});

describe('perguntarAoModelo', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('devolve o texto quando a função responde', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ texto: 'Sua taxa de abandono merece exame.' }),
    }));
    await expect(perguntarAoModelo('e aí?', 'ctx')).resolves.toBe('Sua taxa de abandono merece exame.');
  });

  // Cada caso abaixo precisa cair no fallback de regras em vez de quebrar o chat.
  it('devolve null quando a chave não está configurada (503)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(perguntarAoModelo('e aí?', 'ctx')).resolves.toBeNull();
  });

  it('devolve null quando a cota esgota (502)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 502 }));
    await expect(perguntarAoModelo('e aí?', 'ctx')).resolves.toBeNull();
  });

  it('devolve null quando a rede falha', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(perguntarAoModelo('e aí?', 'ctx')).resolves.toBeNull();
  });

  it('devolve null quando /api/bia não existe (vite dev devolve HTML)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => { throw new SyntaxError('Unexpected token <'); },
    }));
    await expect(perguntarAoModelo('e aí?', 'ctx')).resolves.toBeNull();
  });

  it('devolve null quando o texto vem vazio', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ texto: '   ' }) }));
    await expect(perguntarAoModelo('e aí?', 'ctx')).resolves.toBeNull();
  });
});
