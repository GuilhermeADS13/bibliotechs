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
      setLivros(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) localStorage.setItem('da-livros', JSON.stringify(livros));
  }, [livros, user]);

  const adicionar = async (livro) => {
    if (!user) { setLivros(p => [...p, { ...livro, id: Date.now() }]); return; }
    await addDoc(collection(db, 'livros'), { ...livro, uid: user.uid, criadoEm: serverTimestamp() });
  };

  const atualizar = async (id, dados) => {
    if (!user) { setLivros(p => p.map(l => l.id === id ? { ...l, ...dados } : l)); return; }
    await updateDoc(doc(db, 'livros', id), dados);
  };

  const remover = async (id) => {
    if (!user) { setLivros(p => p.filter(l => l.id !== id)); return; }
    await deleteDoc(doc(db, 'livros', id));
  };

  return { livros, loading, adicionar, atualizar, remover };
}
