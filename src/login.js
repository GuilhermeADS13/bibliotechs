import { signInWithPopup, signInWithRedirect, getRedirectResult } from 'firebase/auth';
import { auth, provider } from './firebase';

// Detecta navegador embutido (WhatsApp, Instagram, Facebook, etc.).
// O Google bloqueia login OAuth nesses webviews (disallowed_useragent).
export function isInAppBrowser() {
  const ua = navigator.userAgent || navigator.vendor || '';
  return /FBAN|FBAV|Instagram|FB_IAB|Line\/|WhatsApp|WeChat|MicroMessenger|Twitter|TikTok|Snapchat/i.test(ua);
}

const isMobile = () => /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');

// Login com Google robusto: redirect no celular, popup no desktop,
// com fallback e mensagens claras. Resolve o login silencioso que falhava no mobile.
export async function loginGoogle() {
  if (!auth || !provider) {
    alert('Login indisponível: o Firebase não está configurado neste ambiente.');
    return;
  }
  if (isInAppBrowser()) {
    alert(
      'Para entrar com o Google, abra este site no Chrome ou Safari.\n\n' +
      'Toque no menu (⋮ ou ⋯) e escolha "Abrir no navegador". ' +
      'O login do Google não funciona dentro do app de mensagens.'
    );
    return;
  }
  try {
    if (isMobile()) await signInWithRedirect(auth, provider);
    else await signInWithPopup(auth, provider);
  } catch (e) {
    console.error('Falha no login com Google:', e);
    if (['auth/popup-blocked', 'auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(e?.code)) {
      try { await signInWithRedirect(auth, provider); return; } catch (e2) { console.error(e2); }
    }
    alert('Não foi possível entrar com o Google. Tente de novo ou abra no Chrome/Safari.');
  }
}

// Conclui o fluxo de redirect ao recarregar a página (e expõe erros que seriam silenciosos).
export function completeRedirectLogin() {
  if (!provider) return;
  getRedirectResult(auth).catch(e => console.error('Erro ao concluir login por redirect:', e));
}
