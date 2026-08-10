import { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '../firebase';
import {
  collection, query, where, orderBy, onSnapshot,
  doc, setDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore';

// Uma conversa por dia. O corte diário é automático: ninguém precisa decidir
// quando "limpar" — a conversa de hoje começa vazia e a de ontem fica guardada
// e navegável. Segue o mesmo padrão do useLivros: localStorage sem conta,
// Firestore quando há login.

const CHAVE_LOCAL = 'da-conversas';

// Data local, não UTC: `toISOString()` viraria o dia às 21h no horário de
// Brasília, cortando a conversa no meio da noite de quem está lendo.
export function diaDeHoje(agora = new Date()) {
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

export function rotularDia(dia, hoje = diaDeHoje()) {
  if (dia === hoje) return 'Hoje';

  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);
  if (dia === diaDeHoje(ontem)) return 'Ontem';

  const [a, m, d] = dia.split('-');
  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const rotulo = `${d} de ${MESES[Number(m) - 1]}`;
  return Number(a) === new Date().getFullYear() ? rotulo : `${rotulo} de ${a}`;
}

// O id do documento embute o uid para que a regra do Firestore consiga validar
// a posse antes mesmo de o documento existir (em `create` não há `resource`).
const idDoc = (uid, dia) => `${uid}_${dia}`;

function lerLocal() {
  try {
    const bruto = JSON.parse(localStorage.getItem(CHAVE_LOCAL) || '{}');
    return bruto && typeof bruto === 'object' && !Array.isArray(bruto) ? bruto : {};
  } catch {
    return {};
  }
}

function gravarLocal(mapa) {
  try { localStorage.setItem(CHAVE_LOCAL, JSON.stringify(mapa)); } catch {}
}

/**
 * Devolve as conversas por dia e um `salvar` para persistir o dia corrente.
 *
 * `conversas` é sempre um objeto { 'YYYY-MM-DD': [mensagem, ...] }.
 */
export function useConversas(user) {
  const [conversas, setConversas] = useState({});
  const [carregando, setCarregando] = useState(true);
  // Evita regravar no Firestore o que acabou de chegar dele pelo onSnapshot.
  const ultimoSalvo = useRef('');

  useEffect(() => {
    if (!user) {
      setConversas(lerLocal());
      setCarregando(false);
      return;
    }

    const q = query(
      collection(db, 'conversas'),
      where('uid', '==', user.uid),
      orderBy('dia', 'desc')
    );

    const unsub = onSnapshot(
      q,
      snap => {
        const mapa = {};
        for (const d of snap.docs) {
          const dados = d.data();
          if (dados?.dia && Array.isArray(dados.mensagens)) mapa[dados.dia] = dados.mensagens;
        }
        setConversas(mapa);
        setCarregando(false);
      },
      err => {
        // Sem isto uma falha no listener deixaria o chat preso em "carregando".
        console.error('Erro ao carregar conversas:', err);
        setCarregando(false);
      }
    );
    return () => unsub();
  }, [user]);

  const salvar = useCallback(async (dia, mensagens) => {
    if (!Array.isArray(mensagens)) return;

    // As mensagens carregam objetos Date e o Firestore não aceita `undefined`;
    // normaliza para um formato serializável e estável.
    const limpas = mensagens.map(m => ({
      id: Number(m?.id) || Date.now(),
      tipo: m?.tipo === 'bot' ? 'bot' : 'usuario',
      texto: String(m?.texto || ''),
      timestamp: m?.timestamp instanceof Date
        ? m.timestamp.toISOString()
        : String(m?.timestamp || new Date().toISOString()),
    }));

    setConversas(prev => ({ ...prev, [dia]: limpas }));

    if (!user) {
      gravarLocal({ ...lerLocal(), [dia]: limpas });
      return;
    }

    const assinatura = `${dia}:${limpas.length}`;
    if (ultimoSalvo.current === assinatura) return;
    ultimoSalvo.current = assinatura;

    try {
      await setDoc(doc(db, 'conversas', idDoc(user.uid, dia)), {
        uid: user.uid,
        dia,
        mensagens: limpas,
        atualizadoEm: serverTimestamp(),
      });
    } catch (e) {
      // Falha de gravação não pode derrubar o chat: a conversa segue em memória.
      console.error('Erro ao salvar conversa:', e);
    }
  }, [user]);

  const apagarDia = useCallback(async (dia) => {
    setConversas(prev => {
      const copia = { ...prev };
      delete copia[dia];
      if (!user) gravarLocal(copia);
      return copia;
    });

    if (!user) return;
    try {
      await deleteDoc(doc(db, 'conversas', idDoc(user.uid, dia)));
    } catch (e) {
      console.error('Erro ao apagar conversa:', e);
    }
  }, [user]);

  return { conversas, carregando, salvar, apagarDia };
}
