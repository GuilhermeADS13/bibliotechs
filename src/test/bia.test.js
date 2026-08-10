import { describe, it, expect, vi, afterEach } from 'vitest';
import { montarContexto, perguntarAoModelo, prepararHistorico, mensagemDeFalha } from '../bia';

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

describe('prepararHistorico', () => {
  it('descarta a saudação fixa da B.IA (id 1)', () => {
    const msgs = [
      { id: 1, tipo: 'bot', texto: 'Saudações. Sou B.IA...' },
      { id: 2, tipo: 'usuario', texto: 'meu ritmo está bom?' },
      { id: 3, tipo: 'bot', texto: 'Seu ritmo oscila.' },
    ];
    expect(prepararHistorico(msgs)).toEqual([
      { papel: 'usuario', texto: 'meu ritmo está bom?' },
      { papel: 'bot', texto: 'Seu ritmo oscila.' },
    ]);
  });

  it('mantém a alternância usuario/bot na ordem original', () => {
    const msgs = [
      { id: 1, tipo: 'bot', texto: 'oi' },
      { id: 2, tipo: 'usuario', texto: 'p1' },
      { id: 3, tipo: 'bot', texto: 'r1' },
      { id: 4, tipo: 'usuario', texto: 'p2' },
      { id: 5, tipo: 'bot', texto: 'r2' },
    ];
    expect(prepararHistorico(msgs).map(m => m.papel)).toEqual(['usuario', 'bot', 'usuario', 'bot']);
  });

  it('ignora mensagens vazias e entradas inválidas', () => {
    expect(prepararHistorico([{ id: 2, tipo: 'usuario', texto: '   ' }])).toEqual([]);
    expect(prepararHistorico(null)).toEqual([]);
    expect(prepararHistorico(undefined)).toEqual([]);
  });

  it('devolve lista vazia quando só existe a saudação (primeira pergunta)', () => {
    expect(prepararHistorico([{ id: 1, tipo: 'bot', texto: 'Saudações.' }])).toEqual([]);
  });
});

describe('perguntarAoModelo', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('devolve o texto quando a função responde', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ texto: 'Sua taxa de abandono merece exame.' }),
    }));
    await expect(perguntarAoModelo('e aí?', 'ctx')).resolves.toEqual({
      texto: 'Sua taxa de abandono merece exame.',
      erro: null,
    });
  });

  it('envia o histórico no corpo da requisição', async () => {
    const espiao = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ texto: 'ok' }) });
    vi.stubGlobal('fetch', espiao);

    await perguntarAoModelo('e daí?', 'ctx', {
      historico: [
        { id: 1, tipo: 'bot', texto: 'Saudações.' },
        { id: 2, tipo: 'usuario', texto: 'meu ritmo está bom?' },
        { id: 3, tipo: 'bot', texto: 'Seu ritmo oscila.' },
      ],
    });

    const corpo = JSON.parse(espiao.mock.calls[0][1].body);
    expect(corpo.pergunta).toBe('e daí?');
    // Sem isto o modelo não teria como responder a um seguimento como "e daí?".
    expect(corpo.historico).toEqual([
      { papel: 'usuario', texto: 'meu ritmo está bom?' },
      { papel: 'bot', texto: 'Seu ritmo oscila.' },
    ]);
  });

  it('manda histórico vazio quando não há conversa anterior', async () => {
    const espiao = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ texto: 'ok' }) });
    vi.stubGlobal('fetch', espiao);
    await perguntarAoModelo('primeira pergunta', 'ctx');
    expect(JSON.parse(espiao.mock.calls[0][1].body).historico).toEqual([]);
  });

  // Em toda falha o texto vem nulo E o motivo sobe junto — sem o motivo, o chat
  // não tem como dizer ao usuário o que aconteceu.
  it('reporta sem-chave quando a variável não está configurada (503)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 503, json: async () => ({ erro: 'sem-chave' }),
    }));
    await expect(perguntarAoModelo('e aí?', 'ctx')).resolves.toEqual({ texto: null, erro: 'sem-chave' });
  });

  it('reporta cota-esgotada quando o limite diário estoura', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 502, json: async () => ({ erro: 'cota-esgotada' }),
    }));
    await expect(perguntarAoModelo('e aí?', 'ctx')).resolves.toEqual({ texto: null, erro: 'cota-esgotada' });
  });

  it('reporta sem-conexao quando a rede falha', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(perguntarAoModelo('e aí?', 'ctx')).resolves.toEqual({ texto: null, erro: 'sem-conexao' });
  });

  it('usa o status quando o corpo do erro não é legível', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 500, json: async () => { throw new Error('sem json'); },
    }));
    await expect(perguntarAoModelo('e aí?', 'ctx')).resolves.toEqual({ texto: null, erro: 'http-500' });
  });

  it('reporta resposta-vazia quando /api/bia devolve HTML (vite dev)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => { throw new SyntaxError('Unexpected token <'); },
    }));
    await expect(perguntarAoModelo('e aí?', 'ctx')).resolves.toEqual({ texto: null, erro: 'resposta-vazia' });
  });

  it('reporta resposta-vazia quando o texto vem em branco', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ texto: '   ' }) }));
    await expect(perguntarAoModelo('e aí?', 'ctx')).resolves.toEqual({ texto: null, erro: 'resposta-vazia' });
  });
});

describe('mensagemDeFalha', () => {
  // O texto genérico anterior fingia ser uma resposta e se repetia igual a cada
  // tentativa, escondendo do usuário que algo tinha quebrado.
  it('explica a cota esgotada e o que ainda funciona', () => {
    const m = mensagemDeFalha('cota-esgotada');
    expect(m).toMatch(/limite diário/);
    expect(m).toMatch(/estatísticas|resumos|recomendações/);
  });

  it('orienta a tentar de novo no timeout', () => {
    expect(mensagemDeFalha('timeout')).toMatch(/demorou|de novo/i);
  });

  it('aponta a internet quando não há conexão', () => {
    expect(mensagemDeFalha('sem-conexao')).toMatch(/internet|conectar/i);
  });

  it('tem texto padrão para erro desconhecido', () => {
    const m = mensagemDeFalha('coisa-nova-qualquer');
    expect(typeof m).toBe('string');
    expect(m.length).toBeGreaterThan(20);
  });

  it('nunca finge que analisou a estante', () => {
    for (const e of ['cota-esgotada', 'timeout', 'sem-conexao', 'sem-chave', 'outro']) {
      expect(mensagemDeFalha(e)).not.toMatch(/requer análise cuidadosa|padrões de consumo/);
    }
  });
});
