import { useState, useEffect, useRef } from 'react';
import { carregarFirestore } from '../firebase';
import { salvarFoto, apagarFoto, separarFoto, migrarFotoEmbutida, ehDataUri } from '../fotos';

// Move livros salvos sem conta (localStorage) para o Firestore quando o usuário loga.
// Remove do localStorage ANTES de enviar para evitar migração duplicada (StrictMode/reentrância).
async function migrarLocaisParaFirestore(user) {
  if (!user) return;
  let locais = [];
  try { locais = JSON.parse(localStorage.getItem('da-livros') || '[]'); } catch {}
  if (!Array.isArray(locais) || locais.length === 0) return;
  localStorage.removeItem('da-livros');
  try {
    const mod = await carregarFirestore();
    if (!mod) throw new Error('Firestore indisponível');
    const { fs, db } = mod;
    for (const l of locais) {
      const { id: _ignored, ...data } = l;
      // Já separada na entrada: sem isto a foto entraria embutida no livro
      // e a migração teria de tirá-la de lá logo depois.
      const { dados, foto } = separarFoto(data);
      const ref = await fs.addDoc(fs.collection(db, 'livros'), { ...dados, uid: user.uid, criadoEm: fs.serverTimestamp() });
      if (foto) await salvarFoto(ref.id, foto, user.uid);
    }
  } catch (e) {
    console.error('Falha ao migrar livros locais para a conta:', e);
    try { localStorage.setItem('da-livros', JSON.stringify(locais)); } catch {}
  }
}

/**
 * Sobe para /fotos as fotos que ainda estão dentro dos documentos de livro.
 *
 * Uma de cada vez, de propósito: são poucas dezenas por estante e ninguém
 * está esperando por elas — disparar tudo de uma vez só somaria pico de
 * escrita para chegar ao mesmo lugar.
 */
async function migrarFotosEmbutidas(lista, user, jaVistos) {
  if (!user) return;
  for (const livro of lista) {
    if (!ehDataUri(livro.fotoUsuario) || jaVistos.has(livro.id)) continue;
    // Marca ANTES de tentar: com o snapshot chegando de novo a cada escrita,
    // marcar depois deixaria a mesma foto ser migrada duas vezes.
    jaVistos.add(livro.id);
    await migrarFotoEmbutida(livro.id, livro.fotoUsuario, user.uid);
  }
}

export function useLivros(user) {
  const [livros, setLivros]   = useState([]);
  const [loading, setLoading] = useState(true);
  // Ids já tratados pela migração das fotos embutidas. Sem esta trava a
  // migração se repetiria sem fim: cada `updateDoc` dela dispara o
  // `onSnapshot`, que chamaria a migração de novo.
  const fotosMigradas = useRef(new Set());

  useEffect(() => {
    if (!user) {
      try { setLivros(JSON.parse(localStorage.getItem('da-livros') || '[]')); } catch {}
      setLoading(false);
      return;
    }
    // Migra livros adicionados sem conta (localStorage) para o Firestore no primeiro login
    migrarLocaisParaFirestore(user);

    let cancelado = false;
    let unsub = () => {};

    carregarFirestore().then(mod => {
      if (cancelado || !mod) { setLoading(false); return; }
      const { fs, db } = mod;

      const q = fs.query(fs.collection(db, 'livros'), fs.where('uid', '==', user.uid));
      unsub = fs.onSnapshot(
        q,
        snap => {
          // id do documento Firestore sempre tem prioridade sobre qualquer campo 'id' salvo
          const lista = snap.docs.map(d => { const data = d.data(); delete data.id; return { id: d.id, ...data }; });
          setLivros(lista);
          setLoading(false);
          // Estantes criadas antes da separação ainda trazem a foto dentro
          // do livro. Movê-las aqui é o que faz a migração acontecer sozinha,
          // no primeiro acesso de cada pessoa.
          migrarFotosEmbutidas(lista, user, fotosMigradas.current);
        },
        err => {
          // Sem isto, uma falha no listener deixaria o app preso em "Carregando..."
          console.error('Erro ao carregar livros do Firestore:', err);
          setLoading(false);
        }
      );
    }).catch(e => {
      console.error('Erro ao carregar o Firestore:', e);
      setLoading(false);
    });

    return () => { cancelado = true; unsub(); };
  }, [user]);

  useEffect(() => {
    if (!user) localStorage.setItem('da-livros', JSON.stringify(livros));
  }, [livros, user]);

  const hoje = () => new Date().toISOString().split('T')[0];

  const adicionar = async (livro) => {
    // Garante dataTermino para livros lidos
    const dataTermino = livro.dataTermino || (livro.status === 'lido' ? hoje() : '');
    const livroFinal = { ...livro, dataTermino };

    if (!user) {
      setLivros(p => [...p, { ...livroFinal, id: Date.now() }]);
      return;
    }
    // Remove campo 'id' gerado pelo client antes de salvar no Firestore
    const { id: _ignored, ...data } = livroFinal;
    // A foto vai para /fotos, não para dentro do livro: ver src/fotos.js.
    const { dados, foto } = separarFoto(data);
    try {
      const { fs, db } = await carregarFirestore();
      const ref = await fs.addDoc(fs.collection(db, 'livros'), { ...dados, uid: user.uid, criadoEm: fs.serverTimestamp() });
      // Depois do addDoc porque só aqui existe o id — a foto usa o mesmo.
      if (foto) await salvarFoto(ref.id, foto, user.uid);
    } catch (e) {
      // Esta era a única das três operações sem tratamento: a falha virava
      // promessa rejeitada, a aba não trocava e o formulário aparecia limpo
      // como se tivesse salvado. O código do erro vai junto porque foi
      // exatamente ele que faltou para diagnosticar uma falha real.
      console.error('Erro ao adicionar livro:', e);
      alert(`Não foi possível salvar o livro.\n\n${e?.code || ''} ${e?.message || e}`.trim());
      throw e;
    }
  };

  const atualizar = async (id, dados) => {
    let dadosFinal = { ...dados };
    // Auto-define dataTermino ao marcar como lido sem data
    if (dados.status === 'lido') {
      const livroAtual = livros.find(l => l.id === id);
      if (!livroAtual?.dataTermino && !dados.dataTermino) {
        dadosFinal.dataTermino = hoje();
      }
    }
    if (!user) { setLivros(p => p.map(l => l.id === id ? { ...l, ...dadosFinal } : l)); return; }
    try {
      // `foto` só vem definida quando a chamada mexeu na foto. undefined
      // significa "não tocou nela" e não pode virar apagamento.
      const { dados, foto } = separarFoto(dadosFinal);
      const { fs, db } = await carregarFirestore();
      await fs.updateDoc(fs.doc(db, 'livros', String(id)), dados);
      if (foto !== undefined) await salvarFoto(id, foto, user.uid);
    } catch (e) {
      console.error('Erro ao atualizar livro:', e);
      alert('Não foi possível atualizar o livro. Tente novamente.');
    }
  };

  const remover = async (id) => {
    if (!user) { setLivros(p => p.filter(l => l.id !== id)); return; }
    try {
      const { fs, db } = await carregarFirestore();
      await fs.deleteDoc(fs.doc(db, 'livros', String(id)));
      // Sem isto a foto ficaria órfã, ocupando espaço para sempre.
      await apagarFoto(id);
    } catch (e) {
      console.error('Erro ao remover livro:', e);
      alert('Não foi possível remover o livro. Tente novamente.');
    }
  };

  return { livros, loading, adicionar, atualizar, remover };
}
