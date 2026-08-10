import { createRemoteJWKSet, jwtVerify } from 'jose';

export function createAuth({ issuer, jwksUri }) {
  const jwks = createRemoteJWKSet(new URL(jwksUri || `${issuer}/protocol/openid-connect/certs`));
  return async (req, _res, next) => {
    try {
      const [scheme, token] = (req.headers.authorization || '').split(' ');
      if (scheme !== 'Bearer' || !token) {
        const error = new Error('A Bearer access token is required');
        error.status = 401;
        throw error;
      }
      const { payload } = await jwtVerify(token, jwks, { issuer });
      req.accessToken = token;
      req.user = { id: payload.sub, roles: payload.realm_access?.roles || [] };
      next();
    } catch (error) {
      error.status = 401;
      next(error);
    }
  };
}

