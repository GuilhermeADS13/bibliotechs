import { useState, useEffect } from 'react';
import { carregarFirestore } from '../firebase';

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
      await fs.addDoc(fs.collection(db, 'livros'), { ...data, uid: user.uid, criadoEm: fs.serverTimestamp() });
    }
  } catch (e) {
    console.error('Falha ao migrar livros locais para a conta:', e);
    try { localStorage.setItem('da-livros', JSON.stringify(locais)); } catch {}
  }
}

export function useLivros(user) {
  const [livros, setLivros]   = useState([]);
  const [loading, setLoading] = useState(true);

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
          setLivros(snap.docs.map(d => { const data = d.data(); delete data.id; return { id: d.id, ...data }; }));
          setLoading(false);
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
    const { fs, db } = await carregarFirestore();
    await fs.addDoc(fs.collection(db, 'livros'), { ...data, uid: user.uid, criadoEm: fs.serverTimestamp() });
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
      const { fs, db } = await carregarFirestore();
      await fs.updateDoc(fs.doc(db, 'livros', String(id)), dadosFinal);
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
    } catch (e) {
      console.error('Erro ao remover livro:', e);
      alert('Não foi possível remover o livro. Tente novamente.');
    }
  };

  return { livros, loading, adicionar, atualizar, remover };
}
