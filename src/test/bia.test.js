import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

// perguntarAoModelo manda o token do Firebase no cabeçalho — sem ele o endpoint
// devolve 401. O mock simula um usuário logado; um teste específico abaixo
// cobre o caso sem login.
const authMock = { currentUser: { getIdToken: vi.fn(async () => 'token-fake') } };
vi.mock('../firebase', () => ({ auth: authMock }));
import {
  montarContexto, perguntarAoModelo, prepararHistorico, mensagemDeFalha,
  identificarLivroMencionado, contextoDoLivro,
  pedeAutorParecido, autorDeReferencia, contextoDeAutores,
} from '../bia';

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

  // As resenhas são o dado mais rico da estante e não chegavam ao modelo: ele
  // sabia que a pessoa deu 5 estrelas, mas não por quê.
  describe('resenhas', () => {
    const comResenhas = [
      { id: 1, titulo: 'Dom Casmurro', autor: 'Machado', status: 'lido', nota: 5,
        dataTermino: '2026-03-10', resenha: 'O Bentinho me irritou do começo ao fim.' },
      { id: 2, titulo: 'Duna', autor: 'Herbert', status: 'lido', nota: 4,
        dataTermino: '2026-02-01', resenha: 'Demorou pra engrenar mas valeu.' },
      { id: 3, titulo: 'Sem Resenha', status: 'lido', nota: 3, dataTermino: '2026-01-01' },
    ];

    it('inclui o que a pessoa escreveu, com o título e a nota', () => {
      const ctx = montarContexto(comResenhas, 2026);
      expect(ctx).toMatch(/O QUE A PESSOA ESCREVEU/);
      expect(ctx).toMatch(/"Dom Casmurro"\[lido, nota 5\/5\]: O Bentinho me irritou/);
      expect(ctx).toMatch(/Demorou pra engrenar/);
    });

    it('deixa claro que são palavras dela, não da B.IA', () => {
      expect(montarContexto(comResenhas, 2026)).toMatch(/palavras dela, não suas/);
    });

    // Numa estante real, TODAS as anotações eram de livros abandonados e
    // explicavam a desistência ("falta de tempo para calhamaço"). Sem o status
    // junto, isso seria lido como crítica à obra.
    it('marca o status ao lado da resenha', () => {
      const ctx = montarContexto([
        { id: 1, titulo: 'Cem anos de solidão', status: 'abandonei', nota: 0,
          resenha: 'Falta de tempo para ler esse tipo de narrativa' },
        { id: 2, titulo: 'Carmilla', status: 'lido', nota: 5, dataTermino: '2026-04-15',
          resenha: 'Que atmosfera.' },
      ], 2026);

      expect(ctx).toMatch(/"Cem anos de solidão"\[abandonei\]: Falta de tempo/);
      expect(ctx).toMatch(/"Carmilla"\[lido, nota 5\/5\]: Que atmosfera/);
    });

    it('ignora livros sem resenha e resenha em branco', () => {
      const ctx = montarContexto([
        ...comResenhas,
        { id: 4, titulo: 'Branca', status: 'lido', resenha: '   ' },
      ], 2026);
      expect(ctx).not.toMatch(/"Sem Resenha" \(/);
      expect(ctx).not.toMatch(/"Branca" \(/);
    });

    it('não cria a seção quando ninguém escreveu nada', () => {
      const semNenhuma = [{ id: 1, titulo: 'X', status: 'lido', dataTermino: '2026-01-01' }];
      expect(montarContexto(semNenhuma, 2026)).not.toMatch(/O QUE A PESSOA ESCREVEU/);
    });

    // Sem teto, uma estante de quem escreve muito estouraria o limite de 20 mil
    // caracteres do servidor e derrubaria a resposta inteira.
    it('trunca resenha longa em vez de descartar', () => {
      const longa = [{ id: 1, titulo: 'Épico', status: 'lido', dataTermino: '2026-01-01',
        resenha: 'a'.repeat(2000) }];
      const ctx = montarContexto(longa, 2026);
      expect(ctx).toMatch(/\[resenha truncada\]/);
      expect(ctx.length).toBeLessThan(1500);
    });

    it('limita a quantidade, priorizando as leituras mais recentes', () => {
      const muitas = Array.from({ length: 15 }, (_, i) => ({
        id: i, titulo: `Livro ${i}`, status: 'lido',
        dataTermino: `2026-01-${String(i + 1).padStart(2, '0')}`,
        resenha: `resenha do livro ${i}`,
      }));
      const ctx = montarContexto(muitas, 2026);
      expect(ctx).toMatch(/resenha do livro 14/);  // a mais recente entra
      expect(ctx).not.toMatch(/resenha do livro 0\b/); // a mais antiga fica de fora
      expect((ctx.match(/resenha do livro/g) || [])).toHaveLength(8);
    });
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
  beforeEach(() => { authMock.currentUser = { getIdToken: vi.fn(async () => 'token-fake') }; });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('manda o token do usuário no cabeçalho Authorization', async () => {
    const espiao = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ texto: 'ok' }) });
    vi.stubGlobal('fetch', espiao);

    await perguntarAoModelo('e aí?', 'ctx');
    expect(espiao.mock.calls[0][1].headers.Authorization).toBe('Bearer token-fake');
  });

  it('nem tenta chamar o endpoint sem usuário logado', async () => {
    authMock.currentUser = null;
    const espiao = vi.fn();
    vi.stubGlobal('fetch', espiao);

    await expect(perguntarAoModelo('e aí?', 'ctx')).resolves.toEqual({
      texto: null, erro: 'precisa-login',
    });
    expect(espiao).not.toHaveBeenCalled(); // requisição fadada ao 401 nem sai
  });

  // Streaming: as primeiras palavras aparecem antes de a resposta terminar.
  describe('streaming', () => {
    function corpoFalso(pedacos) {
      const enc = new TextEncoder();
      let i = 0;
      return {
        getReader: () => ({
          read: async () => (i < pedacos.length
            ? { done: false, value: enc.encode(pedacos[i++]) }
            : { done: true }),
        }),
      };
    }

    it('pede o modo stream e entrega o texto crescendo', async () => {
      const espiao = vi.fn().mockResolvedValue({
        ok: true, body: corpoFalso(['Seu ritmo ', 'oscila ', 'bastante.']),
      });
      vi.stubGlobal('fetch', espiao);

      const parciais = [];
      const r = await perguntarAoModelo('e aí?', 'ctx', { aoReceber: t => parciais.push(t) });

      expect(espiao.mock.calls[0][0]).toContain('stream=1');
      expect(parciais).toEqual(['Seu ritmo ', 'Seu ritmo oscila ', 'Seu ritmo oscila bastante.']);
      expect(r.texto).toBe('Seu ritmo oscila bastante.');
    });

    it('não pede stream quando ninguém acompanha', async () => {
      const espiao = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ texto: 'ok' }) });
      vi.stubGlobal('fetch', espiao);
      await perguntarAoModelo('e aí?', 'ctx');
      expect(espiao.mock.calls[0][0]).not.toContain('stream=1');
    });

    it('aproveita o que chegou se a conexão cair no meio', async () => {
      const enc = new TextEncoder();
      let n = 0;
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        body: {
          getReader: () => ({
            read: async () => {
              if (n++ === 0) return { done: false, value: enc.encode('Metade da frase') };
              throw new Error('conexão caiu');
            },
          }),
        },
      }));

      const r = await perguntarAoModelo('e aí?', 'ctx', { aoReceber: () => {} });
      expect(r.texto).toBe('Metade da frase');
    });

    it('erro no callback não interrompe a leitura', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true, body: corpoFalso(['um ', 'dois ', 'três']),
      }));
      // Se o render do React lançar, o resto da resposta (já paga) se perderia.
      const r = await perguntarAoModelo('e aí?', 'ctx', {
        aoReceber: () => { throw new Error('falha de render'); },
      });
      expect(r.texto).toBe('um dois três');
    });

    it('reporta resposta-vazia quando o stream não traz texto', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, body: corpoFalso(['']) }));
      const r = await perguntarAoModelo('e aí?', 'ctx', { aoReceber: () => {} });
      expect(r).toEqual({ texto: null, erro: 'resposta-vazia' });
    });

    it('cai no caminho JSON quando o endpoint recusa', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false, status: 502, json: async () => ({ erro: 'cota-esgotada' }),
      }));
      const r = await perguntarAoModelo('e aí?', 'ctx', { aoReceber: () => {} });
      expect(r).toEqual({ texto: null, erro: 'cota-esgotada' });
    });
  });

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

describe('identificarLivroMencionado', () => {
  const estante = [
    { id: 1, titulo: 'Coração Satânico', autor: 'William Hjortsberg', status: 'lendo' },
    { id: 2, titulo: 'Duna', autor: 'Frank Herbert', status: 'lido' },
    { id: 3, titulo: 'Duna Messias', autor: 'Frank Herbert', status: 'quero-ler' },
  ];

  it('acha o livro pelo título citado', () => {
    expect(identificarLivroMencionado('me fala do Coração Satânico', estante)?.id).toBe(1);
  });

  it('ignora acento e caixa', () => {
    expect(identificarLivroMencionado('quero saber sobre CORACAO SATANICO', estante)?.id).toBe(1);
  });

  // "Duna" está contido em "Duna Messias": sem preferir o título mais longo,
  // a pergunta sobre a continuação traria o livro errado.
  it('prefere o título mais longo quando um contém o outro', () => {
    expect(identificarLivroMencionado('o que achou de Duna Messias?', estante)?.id).toBe(3);
    expect(identificarLivroMencionado('o que achou de Duna?', estante)?.id).toBe(2);
  });

  it('resolve referência vaga quando só há um livro na estante', () => {
    const um = [{ id: 9, titulo: 'Coração Satânico', autor: 'W. H.', status: 'lendo' }];
    expect(identificarLivroMencionado('queria saber mais sobre o livro que eu coloquei', um)?.id).toBe(9);
    expect(identificarLivroMencionado('me fala desse livro', um)?.id).toBe(9);
  });

  it('resolve referência vaga pelo livro já citado na conversa', () => {
    const historico = [
      { texto: 'me fala do Duna Messias' },
      { texto: 'Duna Messias é a continuação...' },
    ];
    expect(identificarLivroMencionado('e esse livro é bom?', estante, historico)?.id).toBe(3);
  });

  it('cai no livro em leitura quando a referência é vaga e a conversa não ajuda', () => {
    expect(identificarLivroMencionado('esse livro vale a pena?', estante, [])?.id).toBe(1);
  });

  it('não chuta quando não há como saber', () => {
    const doisLendo = [
      { id: 1, titulo: 'Duna', status: 'lendo' },
      { id: 2, titulo: 'Ulysses', status: 'lendo' },
    ];
    expect(identificarLivroMencionado('esse livro vale a pena?', doisLendo, [])).toBeNull();
  });

  it('devolve null para pergunta sem relação com livro', () => {
    expect(identificarLivroMencionado('meu ritmo está bom?', estante)).toBeNull();
    expect(identificarLivroMencionado('quantos livros li por mês?', estante)).toBeNull();
  });

  it('não quebra com estante vazia ou inválida', () => {
    expect(identificarLivroMencionado('esse livro', [])).toBeNull();
    expect(identificarLivroMencionado('esse livro', null)).toBeNull();
  });
});

// Pedido da cliente: "tipo: 'baseado nesse autor' me indica um autor parecido.
// Aí vai no Google Books e vê o autor que mais se encaixa".
describe('pedeAutorParecido', () => {
  it('reconhece as formas que a cliente usou', () => {
    expect(pedeAutorParecido('baseado nesse autor me indica um autor parecido')).toBe(true);
    expect(pedeAutorParecido('quais outros autores voce me indica?')).toBe(true);
  });

  it('reconhece variações comuns', () => {
    for (const p of [
      'me indica um autor semelhante',
      'tem escritor parecido com esse?',
      'autores como Machado de Assis',
      'quem mais escreve parecido?',
      'queria mais autores desse tipo',
      'escritores similares',
    ]) {
      expect(pedeAutorParecido(p), p).toBe(true);
    }
  });

  it('ignora acento e caixa', () => {
    expect(pedeAutorParecido('QUAIS OUTROS AUTORES?')).toBe(true);
    expect(pedeAutorParecido('autores parecidos')).toBe(true);
  });

  it('não confunde com pedido de livro nem com pergunta sobre a estante', () => {
    for (const p of [
      'me recomende um livro',
      'quantos livros li por mês?',
      'quem escreveu Dom Casmurro?',
      'qual autor eu mais leio?',
    ]) {
      expect(pedeAutorParecido(p), p).toBe(false);
    }
  });
});

describe('autorDeReferencia', () => {
  const estante = [
    { id: 1, titulo: 'Dom Casmurro', autor: 'Machado de Assis', status: 'lido', nota: 5 },
    { id: 2, titulo: 'Duna', autor: 'Frank Herbert', status: 'lendo', nota: 0 },
  ];

  it('usa o autor citado na pergunta', () => {
    expect(autorDeReferencia('autores como Frank Herbert', estante)).toBe('Frank Herbert');
  });

  it('usa o autor do livro citado', () => {
    expect(autorDeReferencia('me indica autor parecido com Dom Casmurro', estante))
      .toBe('Machado de Assis');
  });

  it('usa o autor citado num turno anterior', () => {
    const historico = [{ texto: 'me fala do Duna' }, { texto: 'Duna é de Frank Herbert...' }];
    expect(autorDeReferencia('e outros autores?', estante, historico)).toBe('Frank Herbert');
  });

  it('sem pista, cai no autor melhor avaliado', () => {
    // Machado tem nota 5; Duna está em leitura e não pontua.
    expect(autorDeReferencia('quais outros autores?', estante, [])).toBe('Machado de Assis');
  });

  it('devolve null com estante vazia, para o chat perguntar em vez de chutar', () => {
    expect(autorDeReferencia('quais outros autores?', [], [])).toBeNull();
  });

  it('pega só o primeiro nome quando o campo tem vários', () => {
    const coautoria = [{ id: 1, titulo: 'X', autor: 'Ana Silva, Bruno Costa', status: 'lido', nota: 5 }];
    expect(autorDeReferencia('autor parecido com X', coautoria)).toBe('Ana Silva');
  });
});

describe('contextoDeAutores', () => {
  it('nomeia a referência e manda explicar a semelhança', () => {
    const ctx = contextoDeAutores('Frank Herbert');
    expect(ctx).toMatch(/Referência: Frank Herbert/);
    expect(ctx).toMatch(/conversam com Frank Herbert/);
    expect(ctx).toMatch(/Não é uma lista/);
  });

  // Aqui quem sugere é o modelo — duas tentativas de fundamentar pela Google
  // Books deram resultado pior que o dele (assunto genérico demais; bibliografia
  // enviesada para coletâneas). A guarda contra invenção muda de forma: não há
  // lista fechada, há exigência de certeza.
  it('exige certeza sobre autor e obra citados', () => {
    const ctx = contextoDeAutores('Frank Herbert');
    expect(ctx).toMatch(/existência conhecida/);
    expect(ctx).toMatch(/fale do autor sem citar obra/);
  });

  it('avisa quais autores não sugerir', () => {
    const ctx = contextoDeAutores('Frank Herbert', [
      { autor: 'Isaac Asimov' },
      { autor: 'Ursula K. Le Guin' },
    ]);
    expect(ctx).toMatch(/já lê \(não sugira estes\): Isaac Asimov, Ursula K. Le Guin/);
  });

  it('separa coautoria e não repete nome', () => {
    const ctx = contextoDeAutores('Frank Herbert', [
      { autor: 'Ana Silva, Bruno Costa' },
      { autor: 'Ana Silva' },
    ]);
    expect(ctx).toMatch(/não sugira estes\): Ana Silva, Bruno Costa$/m);
  });

  it('sem autor de referência, manda perguntar em vez de chutar', () => {
    const ctx = contextoDeAutores(null);
    expect(ctx).toMatch(/Pergunte de quem/);
    expect(ctx).not.toMatch(/conversam com/);
  });
});

describe('contextoDoLivro', () => {
  const info = {
    titulo: 'Coração Satânico', autor: 'William Hjortsberg', genero: 'Fiction',
    paginas: 288, editora: 'DarkSide', dataPublicacao: '1978',
    ratingMedio: 4, descricao: 'Um detetive procura um cantor desaparecido.',
  };

  it('marca a origem para o modelo saber que tem precedência', () => {
    expect(contextoDoLivro(info)).toMatch(/Google Books, verificados/);
  });

  it('inclui os dados factuais que o modelo poderia errar de memória', () => {
    const ctx = contextoDoLivro(info);
    expect(ctx).toMatch(/Autor: William Hjortsberg/);
    expect(ctx).toMatch(/Editora: DarkSide/);
    expect(ctx).toMatch(/Páginas: 288/);
    // Rotulado como edição: o Google Books devolve a data desta edição, e sem
    // o aviso a edição de 2015 de um livro de 1978 viraria "lançado em 2015".
    expect(ctx).toMatch(/Publicação desta edição: 1978/);
    expect(ctx).toMatch(/pode não ser o lançamento original/);
  });

  it('junta a situação do livro na estante do leitor', () => {
    const ctx = contextoDoLivro(info, { status: 'lido', nota: 5, dataTermino: '2026-03-10' });
    expect(ctx).toMatch(/status "lido".*nota 5\/5.*concluído em 2026-03-10/);
  });

  it('omite campos ausentes em vez de escrever N/A', () => {
    const ctx = contextoDoLivro({ titulo: 'X', autor: 'Y', paginas: 'N/A', editora: 'N/A' });
    expect(ctx).not.toMatch(/N\/A/);
    expect(ctx).not.toMatch(/Páginas:/);
  });

  it('devolve vazio quando a busca não achou nada', () => {
    expect(contextoDoLivro(null)).toBe('');
  });
});

describe('mensagemDeFalha', () => {
  it('explica que o login é necessário e o que ainda funciona sem ele', () => {
    const m = mensagemDeFalha('precisa-login');
    expect(m).toMatch(/Entre com sua conta/);
    expect(m).toMatch(/estatísticas|resumos|recomendações/);
  });

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
