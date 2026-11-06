import React, { useEffect, useRef, useState } from 'react';
import { isbnValido, limparIsbn } from '../isbn';

const INTERVALO_MS = 300;

/**
 * Leitor do navegador quando ele existe (Chrome do Android, do Mac); senão,
 * a mesma API implementada em WebAssembly pela `barcode-detector` (ZXing).
 *
 * O Chrome do Windows não tem o leitor nativo — foi onde "não pegava". A
 * biblioteca só é baixada aqui, quando a pessoa abre o leitor; quem nunca usa
 * a câmera não paga por ela.
 */
async function criarDetector() {
  if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
    try {
      const formatos = await window.BarcodeDetector.getSupportedFormats();
      if (formatos.includes('ean_13')) return new window.BarcodeDetector({ formats: ['ean_13'] });
    } catch {
      // Nativo quebrado: segue para a biblioteca.
    }
  }
  const { BarcodeDetector } = await import('barcode-detector/ponyfill');
  return new BarcodeDetector({ formats: ['ean_13'] });
}

const isbnDosCodigos = (codigos) => codigos.map(c => limparIsbn(c.rawValue)).find(isbnValido);

/**
 * Lê o código de barras do livro: pela câmera, por uma foto do código, ou
 * digitando o número — os três chegam ao mesmo lugar.
 */
export function LeitorCodigo({ DA, onLido, onFechar }) {
  const videoRef = useRef(null);
  const detectorRef = useRef(null);
  // iniciando | lendo | sem-camera | erro-leitor
  const [estado, setEstado] = useState('iniciando');
  const [digitado, setDigitado] = useState('');
  const [avisoFoto, setAvisoFoto] = useState('');
  // Ref: `onLido` chega como função nova a cada render do formulário, e como
  // dependência do efeito reiniciaria a câmera a cada render.
  const onLidoRef = useRef(onLido);
  onLidoRef.current = onLido;

  useEffect(() => {
    let stream = null;
    let timer = null;
    let ativo = true;
    let ocupado = false;

    (async () => {
      try {
        detectorRef.current = await criarDetector();
      } catch {
        if (ativo) setEstado('erro-leitor');
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) { if (ativo) setEstado('sem-camera'); return; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (!ativo) return;
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        setEstado('lendo');
        timer = setInterval(async () => {
          // Um quadro de cada vez: a leitura em WebAssembly pode demorar mais
          // que o intervalo, e empilhar chamadas só travaria a página.
          if (ocupado || !ativo) return;
          ocupado = true;
          try {
            const isbn = isbnDosCodigos(await detectorRef.current.detect(video));
            if (isbn && ativo) { ativo = false; onLidoRef.current(isbn); }
          } catch {
            // Quadro sem código legível: tenta o próximo.
          } finally {
            ocupado = false;
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
  }, []);

  const lerFoto = async (arquivo) => {
    setAvisoFoto('');
    if (!arquivo) return;
    try {
      const detector = detectorRef.current || await criarDetector();
      const imagem = await createImageBitmap(arquivo);
      const isbn = isbnDosCodigos(await detector.detect(imagem));
      if (isbn) onLidoRef.current(isbn);
      else setAvisoFoto('Não achei um código de barras de livro nessa foto. Tente uma foto mais de perto, reta e com boa luz.');
    } catch {
      setAvisoFoto('Não consegui ler essa imagem. Tente outra foto ou digite o número.');
    }
  };

  const isbnDigitado = limparIsbn(digitado);
  const valido = isbnValido(isbnDigitado);
  const texto = { fontSize: '13px', color: DA?.walnut, lineHeight: 1.5 };

  return (
    <div role="dialog" aria-modal="true" aria-label="Ler código de barras"
      onClick={onFechar}
      style={{ position: 'fixed', inset: 0, background: 'rgba(20,10,6,0.82)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '18px', padding: '20px', width: '100%', maxWidth: '440px', maxHeight: '92vh', overflowY: 'auto' }}>
        <h3 style={{ fontSize: '17px', color: DA?.espresso, marginBottom: '6px' }}>Código de barras do livro</h3>

        {(estado === 'iniciando' || estado === 'lendo') && (
          <>
            <p style={{ ...texto, marginBottom: '12px' }}>
              {estado === 'iniciando'
                ? 'Abrindo a câmera…'
                : 'Mostre o código de barras da contracapa, a uns 15 cm e com boa luz. A leitura é automática.'}
            </p>
            <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', background: '#000', aspectRatio: '4/3' }}>
              <video ref={videoRef} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              {/* Faixa-guia: onde encaixar o código. */}
              <div aria-hidden="true" style={{ position: 'absolute', left: '10%', right: '10%', top: '38%', height: '24%', border: '2px solid rgba(255,255,255,.85)', borderRadius: '8px' }} />
            </div>
          </>
        )}
        {estado === 'sem-camera' && (
          <p style={{ ...texto, marginBottom: '4px' }}>
            Não consegui abrir a câmera — a permissão pode ter sido negada, ou não há câmera. Envie uma foto do código ou digite o número.
          </p>
        )}
        {estado === 'erro-leitor' && (
          <p style={{ ...texto, marginBottom: '4px' }}>
            O leitor de código não carregou (pode ser a conexão). Digite o número que aparece embaixo das barras.
          </p>
        )}

        {estado !== 'erro-leitor' && (
          <label style={{ display: 'block', marginTop: '12px', ...texto }}>
            <span style={{ fontWeight: '700', color: DA?.espresso }}>Ou envie uma foto do código</span>
            <input type="file" accept="image/*" capture="environment" aria-label="Foto do código de barras"
              onChange={e => lerFoto(e.target.files?.[0])}
              style={{ display: 'block', marginTop: '6px', fontSize: '13px' }} />
          </label>
        )}
        {avisoFoto && <p role="status" style={{ fontSize: '12px', color: '#a93226', marginTop: '6px' }}>{avisoFoto}</p>}

        <p style={{ ...texto, marginTop: '14px', fontWeight: '700', color: DA?.espresso }}>Ou digite o número</p>
        <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
          <input type="text" inputMode="numeric" value={digitado} onChange={e => setDigitado(e.target.value)}
            placeholder="978…" aria-label="ISBN"
            style={{ flex: 1, minWidth: 0, padding: '10px 12px', borderRadius: '10px', border: `2px solid ${DA?.warmBeige}`, fontSize: '14px' }} />
          <button type="button" disabled={!valido} onClick={() => onLidoRef.current(isbnDigitado)} style={{
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
