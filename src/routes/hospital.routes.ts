import { FastifyInstance } from 'fastify';
import { authenticate } from '../middlewares/auth.middleware';
import { prisma } from '../lib/prisma';

export async function hospitalRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: [authenticate] }, async (request, reply) => {
    const hospitals = await prisma.hospital.findMany({
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
    });
    return reply.send(hospitals);
  });

  app.get('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const hospital = await prisma.hospital.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    if (!hospital) {
      return reply.status(404).send({ error: 'Hospital not found' });
    }

    return reply.send(hospital);
  });
}
