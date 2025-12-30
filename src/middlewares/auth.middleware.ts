import { FastifyRequest, FastifyReply } from 'fastify';

interface JWTPayload {
  userId: string;
  role: string;
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    await request.jwtVerify();
  } catch (err: any) {
    // Diferencia entre token expirado e token inválido
    if (err.message && err.message.includes('expired')) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Token expirado',
        code: 'TOKEN_EXPIRED',
      });
    }
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Token inválido',
      code: 'TOKEN_INVALID',
    });
  }
}

export function authorizeRole(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
      const payload = request.user as JWTPayload;

      if (!roles.includes(payload.role)) {
        return reply.status(403).send({ error: 'Forbidden' });
      }
    } catch (err: any) {
      // Diferencia entre token expirado e token inválido
      if (err.message && err.message.includes('expired')) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Token expirado',
          code: 'TOKEN_EXPIRED',
        });
      }
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Token inválido',
        code: 'TOKEN_INVALID',
      });
    }
  };
}
