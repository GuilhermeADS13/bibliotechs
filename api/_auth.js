// Verificação do token do Firebase na função serverless.
//
// Sem isto o /api/bia fica aberto: qualquer um descobre a URL, chama em laço e
// esgota a cota gratuita do dia — e quem fica sem B.IA é o dono do app.
//
// A verificação é local (assinatura conferida contra as chaves públicas do
// Google, que a lib mantém em cache). Uma chamada de rede por requisição
// somaria latência ao caminho crítico do chat.

import { createRemoteJWKSet, jwtVerify } from 'jose';

const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

// Reaproveitado entre invocações enquanto o container está quente.
let jwks;

function obterJwks() {
  if (!jwks) jwks = createRemoteJWKSet(new URL(JWKS_URL));
  return jwks;
}

/**
 * Confere o token e devolve { uid } ou { erro }.
 *
 * `projectId` vem do ambiente porque o token de um projeto Firebase qualquer é
 * assinado pelas mesmas chaves do Google — sem conferir `aud` e `iss`, um token
 * de outro projeto passaria.
 */
export async function verificarToken(req) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) return { erro: 'sem-project-id' };

  const cabecalho = req.headers?.authorization || req.headers?.Authorization || '';
  const token = cabecalho.startsWith('Bearer ') ? cabecalho.slice(7).trim() : '';
  if (!token) return { erro: 'sem-token' };

  try {
    const { payload } = await jwtVerify(token, obterJwks(), {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });

    // `sub` é o uid. Um token válido sem sub não deveria existir, mas checar é
    // barato e evita seguir adiante com identidade indefinida.
    if (!payload?.sub) return { erro: 'token-sem-sub' };
    return { uid: payload.sub };
  } catch (e) {
    // Expirado, assinatura inválida, projeto errado — tudo cai aqui.
    return { erro: 'token-invalido', detalhe: e?.code || e?.message };
  }
}
