import { useState, useEffect } from 'react';
import { db } from '../firebase';
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp
} from 'firebase/firestore';

export function useLivros(user) {
  const [livros, setLivros]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      try { setLivros(JSON.parse(localStorage.getItem('da-livros') || '[]')); } catch {}
      setLoading(false);
      return;
    }
    const q = query(collection(db, 'livros'), where('uid', '==', user.uid));
    const unsub = onSnapshot(q, snap => {
      // id do documento Firestore sempre tem prioridade sobre qualquer campo 'id' salvo
      setLivros(snap.docs.map(d => { const data = d.data(); delete data.id; return { id: d.id, ...data }; }));
      setLoading(false);
    });
    return () => unsub();
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
    await addDoc(collection(db, 'livros'), { ...data, uid: user.uid, criadoEm: serverTimestamp() });
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
    await updateDoc(doc(db, 'livros', String(id)), dadosFinal);
  };

  const remover = async (id) => {
    if (!user) { setLivros(p => p.filter(l => l.id !== id)); return; }
    await deleteDoc(doc(db, 'livros', String(id)));
  };

  return { livros, loading, adicionar, atualizar, remover };
}
