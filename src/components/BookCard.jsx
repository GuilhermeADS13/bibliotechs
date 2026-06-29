import React, { useState } from 'react';
import { StarRating } from './StarRating';
import { bookPlaceholder } from '../placeholder';

const STATUS_OPTS = [
  { value: 'lendo',     label: '📖 Lendo' },
  { value: 'lido',      label: '✅ Lido' },
  { value: 'quero-ler', label: '⏳ Quero Ler' },
  { value: 'abandonei', label: '❌ Abandonei' },
];

const STATUS_STYLE = (DA) => ({
  'lendo':     { bg: `${DA.forestGreen}22`, color: DA.forestGreen, border: DA.forestGreen },
  'lido':      { bg: `${DA.teal}22`,        color: DA.teal,        border: DA.teal },
  'quero-ler': { bg: `${DA.mustard}22`,     color: DA.copper,      border: DA.mustard },
  'abandonei': { bg: `${DA.oxblood}22`,     color: DA.oxblood,     border: DA.oxblood },
});

export function BookCard({ livro, DA, GRAD_BTN, onAtualizar, onRemover, onResenha }) {
  const [hover, setHover]         = useState(false);
  const [editando, setEditando]   = useState(false);
  const [mostrando, setMostrando] = useState('auto'); // 'auto' | 'usuario' | 'api'

  const fechar = () => { setEditando(false); setHover(false); };

  const statusStyles = STATUS_STYLE(DA);
  const cor = statusStyles[livro.status] || statusStyles['quero-ler'];

  const temFotoUsuario = !!livro.fotoUsuario;
  const temCapaApi     = !!livro.capa;

  // Decide qual imagem mostrar
  const imagemExibida =
    mostrando === 'usuario' ? (livro.fotoUsuario || livro.capa) :
    mostrando === 'api'     ? (livro.capa || livro.fotoUsuario) :
    /* auto */               (livro.fotoUsuario || livro.capa);

  const placeholder = bookPlaceholder(160, 220);

  const toggleFoto = (e) => {
    e.stopPropagation();
    if (!temFotoUsuario || !temCapaApi) return;
    setMostrando(m => m === 'usuario' || (m === 'auto' && temFotoUsuario)
      ? 'api' : 'usuario');
  };

  const isMostandoUsuario = temFotoUsuario &&
    (mostrando === 'usuario' || (mostrando === 'auto' && temFotoUsuario));

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setEditando(false); }}
      onClick={() => { if (!hover) setHover(true); }}
      style={{
        background: 'white',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: hover
          ? `0 16px 40px rgba(44,26,20,0.22), 0 2px 8px rgba(44,26,20,0.08)`
          : `0 2px 10px rgba(44,26,20,0.08)`,
        transition: 'all .25s cubic-bezier(.22,.61,.36,1)',
        transform: hover ? 'translateY(-6px) scale(1.01)' : 'none',
        cursor: 'pointer',
        position: 'relative',
        border: `1px solid ${DA.warmBeige}`,
      }}>

      {/* IMAGEM */}
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <img
          src={imagemExibida || placeholder}
          alt={livro.titulo}
          style={{
            width: '100%',
            aspectRatio: '2/3',
            objectFit: 'cover',
            display: 'block',
            transition: 'transform .4s ease',
            transform: hover ? 'scale(1.04)' : 'scale(1)',
          }}
        />

        {/* Badge status */}
        <div style={{
          position: 'absolute', top: '8px', left: '8px',
          background: cor.bg, color: cor.color, border: `1px solid ${cor.border}`,
          borderRadius: '6px', fontSize: '10px', fontWeight: '800', padding: '2px 7px',
          backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        }}>
          {STATUS_OPTS.find(s => s.value === livro.status)?.label}
        </div>

        {/* Badge foto usuário */}
        {isMostandoUsuario && (
          <div style={{
            position: 'absolute', top: '8px', right: '8px',
            background: 'rgba(44,26,20,0.75)', color: DA.cream,
            borderRadius: '6px', fontSize: '9px', fontWeight: '800', padding: '2px 6px',
            letterSpacing: '0.3px',
          }}>
            📷 MEU LIVRO
          </div>
        )}

        {/* Toggle foto (aparece quando hover e tem ambas as fotos) */}
        {temFotoUsuario && temCapaApi && hover && (
          <button onClick={toggleFoto}
            title={isMostandoUsuario ? 'Ver capa da API' : 'Ver minha foto'}
            style={{
              position: 'absolute', bottom: '8px', right: '8px',
              background: 'rgba(245,240,224,0.9)', border: 'none',
              borderRadius: '8px', padding: '5px 8px',
              cursor: 'pointer', fontSize: '12px', fontWeight: '700',
              color: DA.walnut, boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
              backdropFilter: 'blur(4px)', transition: 'transform .15s',
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
            {isMostandoUsuario ? '🖼️ Capa' : '📷 Foto'}
          </button>
        )}

        {/* Indicador de foto disponível (sem hover) */}
        {temFotoUsuario && !hover && (
          <div style={{
            position: 'absolute', bottom: '8px', right: '8px',
            background: 'rgba(44,26,20,0.65)', borderRadius: '50%',
            width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '11px',
          }}>
            📷
          </div>
        )}

        {/* Overlay ações */}
        {hover && !editando && (
          <div style={{
            position: 'absolute', inset: 0,
            background: `linear-gradient(180deg, transparent 0%, ${DA.espresso}e0 60%, ${DA.oxblood}f0 100%)`,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'flex-end',
            gap: '6px', padding: '12px',
          }}>
            <button onClick={e => { e.stopPropagation(); onResenha(); }} style={{
              background: GRAD_BTN, color: DA.cream, border: 'none', borderRadius: '10px',
              padding: '10px 0', fontWeight: '700', fontSize: '13px', cursor: 'pointer', width: '100%',
              boxShadow: '0 4px 14px rgba(107,30,42,0.35)', transition: 'transform .15s',
            }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
              ✏️ Resenha / Nota
            </button>

            <div style={{ display: 'flex', gap: '6px', width: '100%' }}>
              <button onClick={e => { e.stopPropagation(); setEditando(true); }} style={{
                flex: 1, background: 'rgba(245,240,224,0.9)', color: DA.espresso, border: 'none',
                borderRadius: '9px', padding: '7px 0', fontWeight: '700', fontSize: '11px', cursor: 'pointer',
              }}>
                🔄 Status
              </button>
              <button onClick={e => { e.stopPropagation(); onRemover(); }} style={{
                flex: 1, background: 'transparent', color: DA.mustard,
                border: `1px solid ${DA.mustard}88`, borderRadius: '9px',
                padding: '7px 0', fontWeight: '700', fontSize: '11px', cursor: 'pointer',
              }}>
                🗑️ Remover
              </button>
            </div>
          </div>
        )}

        {/* Seletor de status inline — substitui o select nativo que desaparecia ao mover o mouse */}
        {editando && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 3,
            background: 'rgba(44,26,20,0.93)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: '6px', padding: '12px',
          }}>
            <p style={{ color: DA.cream, fontSize: '11px', fontWeight: '800', marginBottom: '2px' }}>Mudar status:</p>
            {STATUS_OPTS.map(o => (
              <button key={o.value}
                onClick={e => { e.stopPropagation(); onAtualizar({ status: o.value }); fechar(); }}
                style={{
                  width: '100%', padding: '8px', border: 'none', borderRadius: '8px',
                  fontWeight: '700', fontSize: '11px', cursor: 'pointer',
                  background: livro.status === o.value ? GRAD_BTN : 'rgba(245,240,224,0.9)',
                  color: livro.status === o.value ? DA.cream : DA.espresso,
                }}>
                {o.label}
              </button>
            ))}
            <button onClick={e => { e.stopPropagation(); setEditando(false); }}
              style={{
                background: 'transparent', border: '1px solid rgba(245,240,224,0.3)',
                borderRadius: '8px', padding: '5px 14px', color: DA.warmBeige,
                fontSize: '11px', cursor: 'pointer', fontWeight: '600', marginTop: '2px',
              }}>
              Cancelar
            </button>
          </div>
        )}
      </div>

      {/* INFO */}
      <div style={{ padding: '12px 14px 14px' }}>
        <h4 style={{
          fontWeight: '800', fontSize: '13px', color: DA.espresso,
          marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {livro.titulo}
        </h4>
        <p style={{
          fontSize: '11px', color: DA.warmBeige, marginBottom: '7px',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {livro.autor || 'Autor desconhecido'}
        </p>
        <StarRating rating={livro.nota} DA={DA} />
        {livro.resenha && (
          <p style={{
            fontSize: '10px', color: DA.walnut, marginTop: '7px', fontStyle: 'italic',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            lineHeight: 1.5,
          }}>
            "{livro.resenha}"
          </p>
        )}
        {livro.genero && (
          <div style={{
            marginTop: '8px', display: 'inline-block',
            background: `${DA.mustard}18`, color: DA.copper,
            border: `1px solid ${DA.mustard}44`, borderRadius: '5px',
            fontSize: '9px', fontWeight: '800', padding: '2px 7px',
            textTransform: 'uppercase', letterSpacing: '0.4px',
          }}>
            {livro.genero}
          </div>
        )}
      </div>
    </div>
  );
}
