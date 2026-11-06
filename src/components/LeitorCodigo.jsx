import React, { useEffect, useRef, useState } from 'react';
import { isbnValido, limparIsbn } from '../isbn';

const INTERVALO_MS = 250;

/**
 * Lê o código de barras do livro pela câmera.
 *
 * Usa o BarcodeDetector do próprio navegador — sem biblioteca nova. Ele existe
 * no Chrome do Android e no do macOS; no iPhone e no Chrome do Windows não.
 * Nesses, a tela diz isso e oferece digitar o número, que funciona igual.
 */
export function LeitorCodigo({ DA, onLido, onFechar }) {
  const videoRef = useRef(null);
  const [estado, setEstado] = useState('iniciando'); // iniciando | lendo | sem-suporte | sem-camera
  const [digitado, setDigitado] = useState('');
  const suporta = typeof window !== 'undefined' && 'BarcodeDetector' in window;
  // Ref: `onLido` chega como função nova a cada render do formulário, e como
  // dependência do efeito reiniciaria a câmera a cada render.
  const onLidoRef = useRef(onLido);
  onLidoRef.current = onLido;

  useEffect(() => {
    if (!suporta || !navigator.mediaDevices?.getUserMedia) { setEstado('sem-suporte'); return undefined; }

    let stream = null;
    let timer = null;
    let ativo = true;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (!ativo) return;
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        setEstado('lendo');
        const detector = new window.BarcodeDetector({ formats: ['ean_13', 'isbn_13', 'isbn_10'] });
        timer = setInterval(async () => {
          try {
            const codigos = await detector.detect(video);
            const isbn = codigos.map(c => limparIsbn(c.rawValue)).find(isbnValido);
            if (isbn && ativo) { ativo = false; onLidoRef.current(isbn); }
          } catch {
            // Quadro sem código legível: tenta o próximo.
          }
        }, INTERVALO_MS);
      } catch {
        if (ativo) setEstado('sem-camera');
      }
    })();

    // Desligar a câmera ao fechar: sem isso a luz dela fica acesa.
    return () => {
      ativo = false;
      clearInterval(timer);
      stream?.getTracks().forEach(t => t.stop());
    };
  }, [suporta]);

  const isbnDigitado = limparIsbn(digitado);
  const valido = isbnValido(isbnDigitado);

  return (
    <div role="dialog" aria-modal="true" aria-label="Ler código de barras"
      onClick={onFechar}
      style={{ position: 'fixed', inset: 0, background: 'rgba(20,10,6,0.82)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '18px', padding: '20px', width: '100%', maxWidth: '420px' }}>
        <h3 style={{ fontSize: '17px', color: DA?.espresso, marginBottom: '6px' }}>Código de barras do livro</h3>

        {(estado === 'iniciando' || estado === 'lendo') && (
          <>
            <p style={{ fontSize: '13px', color: DA?.walnut, marginBottom: '12px' }}>
              Aponte para o código de barras da contracapa. A leitura é automática.
            </p>
            <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', background: '#000', aspectRatio: '4/3' }}>
              <video ref={videoRef} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              {/* Faixa-guia: onde encaixar o código. */}
              <div aria-hidden="true" style={{ position: 'absolute', left: '10%', right: '10%', top: '38%', height: '24%', border: '2px solid rgba(255,255,255,.85)', borderRadius: '8px' }} />
            </div>
          </>
        )}

        {estado === 'sem-suporte' && (
          <p style={{ fontSize: '13px', color: DA?.walnut, marginBottom: '12px', lineHeight: 1.5 }}>
            Este navegador não lê código de barras pela câmera (funciona no Chrome do Android). Digite o número que aparece embaixo das barras:
          </p>
        )}
        {estado === 'sem-camera' && (
          <p style={{ fontSize: '13px', color: DA?.walnut, marginBottom: '12px', lineHeight: 1.5 }}>
            Não consegui abrir a câmera — a permissão pode ter sido negada. Digite o número que aparece embaixo das barras:
          </p>
        )}

        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          <input type="text" inputMode="numeric" value={digitado} onChange={e => setDigitado(e.target.value)}
            placeholder="978…" aria-label="ISBN"
            style={{ flex: 1, padding: '10px 12px', borderRadius: '10px', border: `2px solid ${DA?.warmBeige}`, fontSize: '14px' }} />
          <button type="button" disabled={!valido} onClick={() => onLido(isbnDigitado)} style={{
            padding: '10px 14px', borderRadius: '10px', border: 'none', fontWeight: '800',
            background: valido ? DA?.oxblood : DA?.warmBeige, color: 'white', cursor: valido ? 'pointer' : 'default',
          }}>
            Buscar
          </button>
        </div>
        {digitado && !valido && isbnDigitado.length >= 10 && (
          <p style={{ fontSize: '12px', color: '#a93226', marginTop: '6px' }}>Esse número não é um ISBN válido — confira os dígitos.</p>
        )}

        <button type="button" onClick={onFechar} style={{ marginTop: '14px', width: '100%', padding: '10px', borderRadius: '10px', border: `1px solid ${DA?.warmBeige}`, background: 'white', color: DA?.walnut, fontWeight: '700', cursor: 'pointer' }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
