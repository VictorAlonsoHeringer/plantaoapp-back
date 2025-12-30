import { FastifyInstance } from 'fastify';
import { authenticate } from '../middlewares/auth.middleware';
import { prisma } from '../lib/prisma';

export async function medicoRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: [authenticate] }, async (request, reply) => {
    const medicos = await prisma.medico.findMany({
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
    });
    return reply.send(medicos);
  });

  app.get('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const medico = await prisma.medico.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    if (!medico) {
      return reply.status(404).send({ error: 'Médico not found' });
    }

    return reply.send(medico);
  });
}
