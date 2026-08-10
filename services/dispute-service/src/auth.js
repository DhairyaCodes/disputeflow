import { createRemoteJWKSet, jwtVerify } from 'jose';

export function createAuth({ issuer, jwksUri }) {
  const jwks = createRemoteJWKSet(new URL(jwksUri || `${issuer}/protocol/openid-connect/certs`));

  async function authenticate(req, _res, next) {
    try {
      const [scheme, token] = (req.headers.authorization || '').split(' ');
      if (scheme !== 'Bearer' || !token) {
        const error = new Error('A Bearer access token is required');
        error.status = 401;
        throw error;
      }

      const { payload } = await jwtVerify(token, jwks, { issuer });
      req.user = {
        id: payload.sub,
        username: payload.preferred_username,
        roles: payload.realm_access?.roles || []
      };
      next();
    } catch (error) {
      error.status = 401;
      next(error);
    }
  }

  return authenticate;
}

export function requireRole(...allowedRoles) {
  return (req, _res, next) => {
    if (!allowedRoles.some((role) => req.user.roles.includes(role))) {
      const error = new Error('You do not have permission to perform this operation');
      error.status = 403;
      return next(error);
    }
    return next();
  };
}

