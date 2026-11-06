import React, { useEffect, useRef } from 'react';
import { BiaAvatar } from './BiaAvatar';

// Cada passo abre a aba de que fala: a pessoa vê a tela enquanto a B.IA
// explica, em vez de ler sobre uma tela que não está vendo.
export const PASSOS_TOUR = [
  {
    aba: 'inicio',
    texto: 'Oi! Eu sou a B.IA. Em um minutinho te mostro o que dá para fazer por aqui — se preferir explorar por conta própria, é só pular.',
  },
  {
    aba: 'inicio',
    texto: 'No Início ficam o último livro que você terminou, os números da estante, a meta do ano e o que está sendo lido agora, com a porcentagem de cada um.',
  },
  {
    aba: 'adicionar',
    texto: 'Para cadastrar, digite o título e eu busco capa, autor e páginas. O 📷 lê o código de barras do livro, e lá embaixo dá para trazer a estante inteira do Goodreads ou de uma planilha.',
  },
  {
    aba: 'estante',
    texto: 'Na Minha Estante ficam todos os livros. No que estiver em leitura, o "+10 págs." atualiza o progresso com um toque — e eu calculo quando ele termina no seu ritmo.',
  },
  {
    aba: 'estante',
    texto: 'Toque num livro para mudar o status ou abrir "Resenha / Nota". É lá que moram os trechos favoritos, a data em que você começou e a série do livro.',
  },
  {
    aba: 'estatisticas',
    texto: 'Em Estatísticas está o seu ritmo mês a mês. No fim, as recomendações: elas mudam a cada visita, "Não tenho interesse" tira um livro de vez, e eu aviso quando uma série ficou pela metade.',
  },
  {
    aba: 'metas',
    texto: 'Em Metas você escolhe quantos livros quer ler no ano, e eu conto se o ritmo está dando conta.',
  },
  {
    aba: 'inicio',
    texto: 'E quando quiser conversar sobre livros, me chama no canto da tela. Antes de responder eu leio a sua estante, as suas resenhas e os seus trechos. Entrando com o Google, tudo isso acompanha você em qualquer aparelho.',
  },
];

/**
 * Tour pelo app, apresentado pela B.IA.
 *
 * Abre sozinho na primeira visita; depois, só pelo botão no Início — ou toda
 * vez, se a pessoa marcar a opção no último passo.
 */
export function TourBia({ passo, onPasso, onFechar, onIrPara, sempre, onSempre, DA, GRAD_BTN }) {
  const cartao = useRef(null);
  const total = PASSOS_TOUR.length;
  const ultimo = passo === total - 1;
  const atual = PASSOS_TOUR[passo];

  useEffect(() => { onIrPara(atual.aba); }, [passo]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { cartao.current?.focus(); }, []);

  useEffect(() => {
    const tecla = (e) => {
      if (e.key === 'Escape') onFechar();
      else if (e.key === 'ArrowRight' && !ultimo) onPasso(passo + 1);
      else if (e.key === 'ArrowLeft' && passo > 0) onPasso(passo - 1);
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [passo, ultimo, onPasso, onFechar]);

  return (
    <div
      ref={cartao}
      tabIndex={-1}
      role="dialog"
      aria-label={`Tour com a B.IA, passo ${passo + 1} de ${total}`}
      className="tour-bia"
      style={{
        position: 'fixed', left: '50%', bottom: '24px', transform: 'translateX(-50%)',
        width: 'min(560px, calc(100vw - 32px))', zIndex: 1500, outline: 'none',
        background: '#FBF7EE', borderRadius: '18px', padding: '18px 20px 16px',
        boxShadow: '0 24px 70px rgba(20,10,6,0.45), 0 0 0 1px rgba(196,154,108,0.45)',
      }}
    >
      <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
        <BiaAvatar size={52} style={{ flexShrink: 0, boxShadow: '0 0 0 3px #FBF7EE, 0 0 0 5px rgba(107,30,42,0.5)' }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ fontSize: '12px', fontWeight: '800', color: DA.oxblood, marginBottom: '4px' }}>
            B.IA <span style={{ color: DA.walnut, fontWeight: '600' }}>· {passo + 1} de {total}</span>
          </p>
          <p aria-live="polite" style={{ fontSize: '15px', lineHeight: 1.55, color: DA.espresso }}>{atual.texto}</p>
        </div>
      </div>

      {ultimo && (
        <label style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '14px', fontSize: '13px', color: DA.walnut, cursor: 'pointer' }}>
          <input type="checkbox" checked={sempre} onChange={e => onSempre(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: DA.oxblood }} />
          Mostrar este tour sempre que eu abrir o app
        </label>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginTop: '14px', flexWrap: 'wrap' }}>
        <div aria-hidden="true" style={{ display: 'flex', gap: '5px' }}>
          {PASSOS_TOUR.map((_, i) => (
            <span key={i} style={{ width: i === passo ? '18px' : '6px', height: '6px', borderRadius: '999px', background: i <= passo ? DA.oxblood : `${DA.oxblood}33`, transition: 'width .2s' }} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {!ultimo && (
            <button type="button" onClick={onFechar} style={{ background: 'none', border: 'none', color: DA.walnut, fontSize: '13px', fontWeight: '600', cursor: 'pointer', padding: '8px 6px' }}>
              Pular tour
            </button>
          )}
          {passo > 0 && (
            <button type="button" onClick={() => onPasso(passo - 1)} style={{ background: 'white', border: `1px solid ${DA.warmBeige}`, color: DA.espresso, borderRadius: '10px', padding: '8px 14px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>
              Voltar
            </button>
          )}
          <button type="button" onClick={() => (ultimo ? onFechar() : onPasso(passo + 1))} style={{ background: GRAD_BTN, border: 'none', color: DA.cream, borderRadius: '10px', padding: '9px 16px', fontWeight: '800', fontSize: '13px', cursor: 'pointer' }}>
            {ultimo ? 'Começar a usar' : passo === 0 ? 'Mostrar' : 'Próximo'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Preferência do tour neste aparelho: já viu? quer ver sempre?
const CHAVE = 'da-tour';

export function lerPreferenciaTour() {
  try {
    const p = JSON.parse(localStorage.getItem(CHAVE) || '{}');
    return { visto: !!p.visto, sempre: !!p.sempre };
  } catch {
    return { visto: false, sempre: false };
  }
}

export function gravarPreferenciaTour(pref) {
  try { localStorage.setItem(CHAVE, JSON.stringify(pref)); } catch { /* sem armazenamento: o tour volta na próxima visita */ }
}
