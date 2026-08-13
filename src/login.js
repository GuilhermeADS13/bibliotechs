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

// Conclui o fluxo de redirect ao recarregar a página.
//
// Só registrar no console não bastou: o login por redirect ficou quebrado sem
// ninguém perceber. A causa era de configuração — o `authDomain` apontava para
// um domínio diferente do app, e desde que os navegadores passaram a bloquear
// armazenamento de terceiros, a sessão gravada lá não podia ser lida daqui. O
// usuário voltava do Google e simplesmente não estava logado, sem erro nenhum.
// Agora o app serve /__/auth pelo próprio domínio (rewrite no vercel.json) e
// falhas aparecem para quem está usando.
export async function completeRedirectLogin() {
  if (!provider) return null;
  try {
    // null aqui é o caso normal: a página carregou sem vir de um redirect.
    return await getRedirectResult(auth);
  } catch (e) {
    console.error('Erro ao concluir login por redirect:', e?.code, e?.message);

    const mensagens = {
      'auth/unauthorized-domain': 'Este endereço não está autorizado no Firebase. Avise o responsável pelo app.',
      'auth/account-exists-with-different-credential': 'Já existe uma conta com este e-mail usando outro método de login.',
      'auth/network-request-failed': 'Falha de rede ao concluir o login. Verifique sua conexão e tente de novo.',
      'auth/web-storage-unsupported': 'Seu navegador está bloqueando o armazenamento necessário para o login. Desative a navegação anônima ou libere cookies para este site.',
    };
    alert(mensagens[e?.code] || 'Não foi possível concluir o login. Tente novamente.');
    return null;
  }
}
