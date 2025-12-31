import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, authorizeRole } from '../middlewares/auth.middleware';
import { prisma } from '../lib/prisma';
import { generateQRToken } from '../utils/qrcode';

export async function plantaoRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: [authenticate] }, async (request, reply) => {
    const { especialidade, status } = request.query as {
      especialidade?: string;
      status?: string;
    };

    const user = (request as any).user;

    // Se for HOSPITAL, retorna apenas seus próprios plantões
    // Se for MEDICO, retorna todos os plantões disponíveis
    const whereCondition: any = {
      ...(especialidade && { especialidade }),
      ...(status && { status: status as any }),
    };

    // HOSPITAL: Filtra apenas plantões do próprio hospital
    if (user.role === 'HOSPITAL' && user.hospitalId) {
      whereCondition.hospitalId = user.hospitalId;
    }

    const plantoes = await prisma.plantao.findMany({
      where: whereCondition,
      include: {
        hospital: {
          select: {
            nome: true,
            cidade: true,
            estado: true,
          },
        },
        candidaturas: {
          include: {
            medico: {
              select: {
                id: true,
                nome: true,
                crm: true,
                especialidade: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return reply.send(plantoes);
  });

  app.get('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const plantao = await prisma.plantao.findUnique({
      where: { id },
      include: {
        hospital: true,
        candidaturas: {
          include: {
            medico: {
              select: {
                id: true,
                nome: true,
                crm: true,
                especialidade: true,
                telefone: true,
                cidade: true,
                estado: true,
              },
            },
          },
        },
      },
    });

    if (!plantao) {
      return reply.status(404).send({ error: 'Plantão not found' });
    }

    return reply.send(plantao);
  });

  app.post(
    '/',
    { preHandler: [authorizeRole('HOSPITAL')] },
    async (request, reply) => {
      const createPlantaoSchema = z.object({
        especialidade: z.string(),
        dataInicio: z.string(),
        dataFim: z.string(),
        valor: z.number().positive(),
        descricao: z.string().optional(),
      });

      try {
        const data = createPlantaoSchema.parse(request.body);
        const user = request.user as { userId: string };

        const hospital = await prisma.hospital.findUnique({
          where: { userId: user.userId },
        });

        if (!hospital) {
          return reply.status(404).send({ error: 'Hospital not found' });
        }

        const plantao = await prisma.plantao.create({
          data: {
            hospitalId: hospital.id,
            especialidade: data.especialidade,
            dataInicio: new Date(data.dataInicio),
            dataFim: new Date(data.dataFim),
            valor: data.valor,
            descricao: data.descricao,
          },
          include: {
            hospital: true,
          },
        });

        return reply.status(201).send(plantao);
      } catch (error) {
        return reply.status(400).send({ error: 'Failed to create plantão' });
      }
    }
  );

  app.patch(
    '/:id',
    { preHandler: [authorizeRole('HOSPITAL')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const updatePlantaoSchema = z.object({
        especialidade: z.string().optional(),
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
        valor: z.number().positive().optional(),
        descricao: z.string().optional(),
        status: z.enum(['ABERTO', 'EM_ANALISE', 'PREENCHIDO', 'CANCELADO']).optional(),
      });

      try {
        const data = updatePlantaoSchema.parse(request.body);
        const user = request.user as { userId: string };

        const hospital = await prisma.hospital.findUnique({
          where: { userId: user.userId },
        });

        if (!hospital) {
          return reply.status(404).send({ error: 'Hospital not found' });
        }

        const plantao = await prisma.plantao.findUnique({
          where: { id },
        });

        if (!plantao || plantao.hospitalId !== hospital.id) {
          return reply.status(403).send({ error: 'Forbidden' });
        }

        const updatedPlantao = await prisma.plantao.update({
          where: { id },
          data: {
            ...(data.especialidade && { especialidade: data.especialidade }),
            ...(data.dataInicio && { dataInicio: new Date(data.dataInicio) }),
            ...(data.dataFim && { dataFim: new Date(data.dataFim) }),
            ...(data.valor && { valor: data.valor }),
            ...(data.descricao !== undefined && { descricao: data.descricao }),
            ...(data.status && { status: data.status }),
          },
          include: {
            hospital: true,
          },
        });

        return reply.send(updatedPlantao);
      } catch (error) {
        return reply.status(400).send({ error: 'Failed to update plantão' });
      }
    }
  );

  app.delete(
    '/:id',
    { preHandler: [authorizeRole('HOSPITAL')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user as { userId: string };

      const hospital = await prisma.hospital.findUnique({
        where: { userId: user.userId },
      });

      if (!hospital) {
        return reply.status(404).send({ error: 'Hospital not found' });
      }

      const plantao = await prisma.plantao.findUnique({
        where: { id },
      });

      if (!plantao || plantao.hospitalId !== hospital.id) {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      await prisma.plantao.delete({
        where: { id },
      });

      return reply.status(204).send();
    }
  );

  // Gera QR Code para um plantão (somente hospital)
  app.post(
    '/:id/generate-qrcode',
    { preHandler: [authorizeRole('HOSPITAL')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user as { userId: string };

      try {
        const hospital = await prisma.hospital.findUnique({
          where: { userId: user.userId },
        });

        if (!hospital) {
          return reply.status(404).send({ error: 'Hospital not found' });
        }

        const plantao = await prisma.plantao.findUnique({
          where: { id },
        });

        if (!plantao) {
          return reply.status(404).send({ error: 'Plantão not found' });
        }

        if (plantao.hospitalId !== hospital.id) {
          return reply.status(403).send({ error: 'Forbidden' });
        }

        // Gera novo token QR Code
        const qrCodeToken = generateQRToken(plantao.id, hospital.id);

        // Atualiza o plantão com o novo token
        const updatedPlantao = await prisma.plantao.update({
          where: { id },
          data: {
            qrCodeToken,
            qrCodeGeneratedAt: new Date(),
          },
        });

        return reply.send({
          qrCodeToken,
          plantaoId: updatedPlantao.id,
          generatedAt: updatedPlantao.qrCodeGeneratedAt,
        });
      } catch (error) {
        return reply.status(500).send({ error: 'Failed to generate QR code' });
      }
    }
  );
}
