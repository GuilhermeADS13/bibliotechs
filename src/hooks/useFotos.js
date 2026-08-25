import { useCallback, useEffect, useRef, useState } from 'react';
import { lerFoto } from '../fotos';

// Busca a foto de um livro só quando o card dele chega perto da tela.
//
// Tirar as fotos do documento do livro já resolveu o pior: a estante não baixa
// mais 1,27 MB antes de desenhar nada. Isto resolve o resto — numa estante
// grande, as fotos dos livros que ninguém rolou até lá não são baixadas.
//
// O desenho evita mexer nos lugares que renderizam a imagem: eles continuam
// lendo `livro.fotoUsuario`, e quem preenche esse campo é o `mesclar` daqui. A
// única mudança nos componentes é um `ref` na <img>.

// 200px de folga: a foto começa a carregar um pouco antes de entrar na tela,
// então na rolagem normal ela já chegou quando o card aparece.
const MARGEM = '200px';

/** Fotos já carregadas nesta sessão, compartilhadas entre montagens. */
const cache = new Map();

export function useFotos(user) {
  const [fotos, setFotos] = useState({});
  const observador = useRef(null);
  const pedidas = useRef(new Set());
  // Uma função de ref nova a cada render faria o React desmontar e remontar o
  // ref de toda imagem — e o observador perderia o elemento a cada vez.
  const refs = useRef(new Map());

  const buscar = useCallback(async (id) => {
    if (pedidas.current.has(id)) return;
    pedidas.current.add(id);

    if (cache.has(id)) {
      setFotos(atual => ({ ...atual, [id]: cache.get(id) }));
      return;
    }
    const dados = await lerFoto(id);
    if (!dados) return;
    cache.set(id, dados);
    setFotos(atual => ({ ...atual, [id]: dados }));
  }, []);

  useEffect(() => {
    // jsdom não implementa IntersectionObserver, e navegador antigo também não.
    // Sem ele a foto carrega assim que o card monta: perde-se a preguiça, não a
    // imagem.
    if (typeof IntersectionObserver === 'undefined') return undefined;

    observador.current = new IntersectionObserver(
      entradas => {
        for (const entrada of entradas) {
          if (!entrada.isIntersecting) continue;
          // Uma vez pedida, não precisa mais ser vigiada.
          observador.current.unobserve(entrada.target);
          const id = entrada.target.dataset.livroId;
          if (id) buscar(id);
        }
      },
      { rootMargin: MARGEM }
    );

    return () => {
      observador.current?.disconnect();
      observador.current = null;
      refs.current.clear();
    };
  }, [buscar]);

  /**
   * `ref` para a <img> do livro. Só vigia quem tem foto a buscar: livro sem
   * foto, ou já com ela em mãos, não gasta observação nem leitura.
   */
  const observar = useCallback((livro) => {
    if (!user || !livro?.temFoto || livro.fotoUsuario) return undefined;
    const id = String(livro.id);

    if (!refs.current.has(id)) {
      refs.current.set(id, (el) => {
        if (!el) return;
        el.dataset.livroId = id;
        if (observador.current) observador.current.observe(el);
        else buscar(id); // sem IntersectionObserver, carrega direto
      });
    }
    return refs.current.get(id);
  }, [user, buscar]);

  /**
   * Devolve a estante com as fotos já carregadas preenchidas em
   * `fotoUsuario` — o mesmo campo de antes, para nada mais precisar mudar.
   *
   * Livro antigo, ainda com a foto embutida, passa intacto: os dois formatos
   * convivem enquanto a migração não terminou.
   */
  const mesclar = useCallback(
    (lista) => (Array.isArray(lista) ? lista : []).map(
      l => (fotos[l.id] && !l.fotoUsuario ? { ...l, fotoUsuario: fotos[l.id] } : l)
    ),
    [fotos]
  );

  return { observar, mesclar };
}
