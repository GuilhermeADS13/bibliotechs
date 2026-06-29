import { useState, useEffect } from 'react';
import { db } from '../firebase';
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp
} from 'firebase/firestore';

// Move livros salvos sem conta (localStorage) para o Firestore quando o usuário loga.
// Remove do localStorage ANTES de enviar para evitar migração duplicada (StrictMode/reentrância).
async function migrarLocaisParaFirestore(user) {
  if (!user) return;
  let locais = [];
  try { locais = JSON.parse(localStorage.getItem('da-livros') || '[]'); } catch {}
  if (!Array.isArray(locais) || locais.length === 0) return;
  localStorage.removeItem('da-livros');
  try {
    for (const l of locais) {
      const { id: _ignored, ...data } = l;
      await addDoc(collection(db, 'livros'), { ...data, uid: user.uid, criadoEm: serverTimestamp() });
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

    const q = query(collection(db, 'livros'), where('uid', '==', user.uid));
    const unsub = onSnapshot(
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
    try {
      await updateDoc(doc(db, 'livros', String(id)), dadosFinal);
    } catch (e) {
      console.error('Erro ao atualizar livro:', e);
      alert('Não foi possível atualizar o livro. Tente novamente.');
    }
  };

  const remover = async (id) => {
    if (!user) { setLivros(p => p.filter(l => l.id !== id)); return; }
    try {
      await deleteDoc(doc(db, 'livros', String(id)));
    } catch (e) {
      console.error('Erro ao remover livro:', e);
      alert('Não foi possível remover o livro. Tente novamente.');
    }
  };

  return { livros, loading, adicionar, atualizar, remover };
}
