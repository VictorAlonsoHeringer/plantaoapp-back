import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, authorizeRole } from '../middlewares/auth.middleware';
import { prisma } from '../lib/prisma';
import { calculateDistance, isWithinRadius, MAX_ALLOWED_RADIUS, isValidCoordinates } from '../utils/geolocation';
import { isQRTokenValid } from '../utils/qrcode';
import { isWithinCheckInWindow, isCheckOutLate, calculateCheckOutDelay } from '../utils/time';

export async function candidaturaRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as { userId: string; role: string };

    let candidaturas;

    if (user.role === 'MEDICO') {
      const medico = await prisma.medico.findUnique({
        where: { userId: user.userId },
      });

      if (!medico) {
        return reply.status(404).send({ error: 'Médico not found' });
      }

      candidaturas = await prisma.candidatura.findMany({
        where: { medicoId: medico.id },
        include: {
          plantao: {
            include: {
              hospital: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    } else {
      const hospital = await prisma.hospital.findUnique({
        where: { userId: user.userId },
      });

      if (!hospital) {
        return reply.status(404).send({ error: 'Hospital not found' });
      }

      candidaturas = await prisma.candidatura.findMany({
        where: {
          plantao: {
            hospitalId: hospital.id,
          },
        },
        include: {
          plantao: true,
          medico: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    }

    return reply.send(candidaturas);
  });

  app.post(
    '/',
    { preHandler: [authorizeRole('MEDICO')] },
    async (request, reply) => {
      const createCandidaturaSchema = z.object({
        plantaoId: z.string().uuid(),
        mensagem: z.string().optional(),
      });

      try {
        const data = createCandidaturaSchema.parse(request.body);
        const user = request.user as { userId: string };

        const medico = await prisma.medico.findUnique({
          where: { userId: user.userId },
        });

        if (!medico) {
          return reply.status(404).send({ error: 'Médico not found' });
        }

        const plantao = await prisma.plantao.findUnique({
          where: { id: data.plantaoId },
        });

        if (!plantao) {
          return reply.status(404).send({ error: 'Plantão not found' });
        }

        if (plantao.status !== 'ABERTO') {
          return reply.status(400).send({ error: 'Plantão is not open for applications' });
        }

        const existingCandidatura = await prisma.candidatura.findUnique({
          where: {
            plantaoId_medicoId: {
              plantaoId: data.plantaoId,
              medicoId: medico.id,
            },
          },
        });

        if (existingCandidatura) {
          return reply.status(400).send({ error: 'You already applied for this plantão' });
        }

        const candidatura = await prisma.candidatura.create({
          data: {
            plantaoId: data.plantaoId,
            medicoId: medico.id,
            mensagem: data.mensagem,
          },
          include: {
            plantao: {
              include: {
                hospital: true,
              },
            },
            medico: true,
          },
        });

        return reply.status(201).send(candidatura);
      } catch (error) {
        return reply.status(400).send({ error: 'Failed to create candidatura' });
      }
    }
  );

  app.patch(
    '/:id',
    { preHandler: [authorizeRole('HOSPITAL')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const updateCandidaturaSchema = z.object({
        status: z.enum(['PENDENTE', 'APROVADA', 'RECUSADA']),
      });

      try {
        const data = updateCandidaturaSchema.parse(request.body);
        const user = request.user as { userId: string };

        const hospital = await prisma.hospital.findUnique({
          where: { userId: user.userId },
        });

        if (!hospital) {
          return reply.status(404).send({ error: 'Hospital not found' });
        }

        const candidatura = await prisma.candidatura.findUnique({
          where: { id },
          include: {
            plantao: true,
          },
        });

        if (!candidatura || candidatura.plantao.hospitalId !== hospital.id) {
          return reply.status(403).send({ error: 'Forbidden' });
        }

        const updatedCandidatura = await prisma.candidatura.update({
          where: { id },
          data: {
            status: data.status,
          },
          include: {
            plantao: true,
            medico: true,
          },
        });

        if (data.status === 'APROVADA') {
          await prisma.plantao.update({
            where: { id: candidatura.plantaoId },
            data: {
              status: 'PREENCHIDO',
            },
          });
        }

        return reply.send(updatedCandidatura);
      } catch (error) {
        return reply.status(400).send({ error: 'Failed to update candidatura' });
      }
    }
  );

  app.delete(
    '/:id',
    { preHandler: [authorizeRole('MEDICO')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user as { userId: string };

      const medico = await prisma.medico.findUnique({
        where: { userId: user.userId },
      });

      if (!medico) {
        return reply.status(404).send({ error: 'Médico not found' });
      }

      const candidatura = await prisma.candidatura.findUnique({
        where: { id },
      });

      if (!candidatura || candidatura.medicoId !== medico.id) {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      await prisma.candidatura.delete({
        where: { id },
      });

      return reply.status(204).send();
    }
  );

  // Valida se o médico está dentro do raio permitido
  app.post(
    '/:id/validate-location',
    { preHandler: [authorizeRole('MEDICO')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const validateLocationSchema = z.object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
      });

      try {
        const { latitude, longitude } = validateLocationSchema.parse(request.body);
        const user = request.user as { userId: string };

        const medico = await prisma.medico.findUnique({
          where: { userId: user.userId },
        });

        if (!medico) {
          return reply.status(404).send({ error: 'Médico not found' });
        }

        const candidatura = await prisma.candidatura.findUnique({
          where: { id },
          include: {
            plantao: {
              include: {
                hospital: true,
              },
            },
          },
        });

        if (!candidatura || candidatura.medicoId !== medico.id) {
          return reply.status(403).send({ error: 'Forbidden' });
        }

        if (!candidatura.plantao.hospital.latitude || !candidatura.plantao.hospital.longitude) {
          return reply.status(400).send({
            error: 'Hospital location not configured',
            message: 'O hospital ainda não configurou sua localização'
          });
        }

        const userLocation = { latitude, longitude };
        const hospitalLocation = {
          latitude: candidatura.plantao.hospital.latitude,
          longitude: candidatura.plantao.hospital.longitude,
        };

        const distance = calculateDistance(userLocation, hospitalLocation);
        const withinRadius = isWithinRadius(userLocation, hospitalLocation, MAX_ALLOWED_RADIUS);

        return reply.send({
          withinRadius,
          distance,
          maxAllowedRadius: MAX_ALLOWED_RADIUS,
          hospitalLocation,
        });
      } catch (error) {
        return reply.status(400).send({ error: 'Invalid location data' });
      }
    }
  );

  // Check-in no plantão
  app.post(
    '/:id/check-in',
    { preHandler: [authorizeRole('MEDICO')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const checkInSchema = z.object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        qrCodeToken: z.string(),
      });

      try {
        const { latitude, longitude, qrCodeToken } = checkInSchema.parse(request.body);
        const user = request.user as { userId: string };

        if (!isValidCoordinates({ latitude, longitude })) {
          return reply.status(400).send({ error: 'Invalid coordinates' });
        }

        const medico = await prisma.medico.findUnique({
          where: { userId: user.userId },
        });

        if (!medico) {
          return reply.status(404).send({ error: 'Médico not found' });
        }

        const candidatura = await prisma.candidatura.findUnique({
          where: { id },
          include: {
            plantao: {
              include: {
                hospital: true,
              },
            },
            registrosPonto: true,
          },
        });

        if (!candidatura || candidatura.medicoId !== medico.id) {
          return reply.status(403).send({ error: 'Forbidden' });
        }

        if (candidatura.status !== 'APROVADA') {
          return reply.status(400).send({
            error: 'Candidatura not approved',
            message: 'Sua candidatura ainda não foi aprovada'
          });
        }

        // Verifica se já fez check-in
        const existingCheckIn = candidatura.registrosPonto.find((r: any) => r.tipo === 'ENTRADA');
        if (existingCheckIn) {
          return reply.status(400).send({
            error: 'Already checked in',
            message: 'Você já fez check-in neste plantão'
          });
        }

        // Valida janela de tempo
        if (!isWithinCheckInWindow(candidatura.plantao.dataInicio)) {
          return reply.status(400).send({
            error: 'Outside check-in window',
            message: 'Check-in disponível apenas 5 minutos antes do início do plantão'
          });
        }

        // Valida QR Code
        if (!isQRTokenValid(qrCodeToken, candidatura.plantao.id)) {
          return reply.status(400).send({
            error: 'Invalid QR code',
            message: 'QR Code inválido ou expirado'
          });
        }

        // Valida localização
        if (!candidatura.plantao.hospital.latitude || !candidatura.plantao.hospital.longitude) {
          return reply.status(400).send({
            error: 'Hospital location not configured',
            message: 'O hospital ainda não configurou sua localização'
          });
        }

        const userLocation = { latitude, longitude };
        const hospitalLocation = {
          latitude: candidatura.plantao.hospital.latitude,
          longitude: candidatura.plantao.hospital.longitude,
        };

        const distance = calculateDistance(userLocation, hospitalLocation);

        if (!isWithinRadius(userLocation, hospitalLocation, MAX_ALLOWED_RADIUS)) {
          return reply.status(400).send({
            error: 'Outside allowed radius',
            message: `Você está a ${Math.round(distance)}m do hospital. É necessário estar a no máximo ${MAX_ALLOWED_RADIUS}m.`
          });
        }

        // Registra check-in
        const registroPonto = await prisma.registroPonto.create({
          data: {
            candidaturaId: candidatura.id,
            tipo: 'ENTRADA',
            latitude,
            longitude,
            distanciaMetros: distance,
            qrCodeValidado: qrCodeToken,
          },
        });

        // Atualiza status da candidatura
        await prisma.candidatura.update({
          where: { id },
          data: {
            status: 'EM_ANDAMENTO',
          },
        });

        return reply.status(201).send({
          message: 'Check-in realizado com sucesso',
          registroPonto,
          distance,
        });
      } catch (error) {
        return reply.status(400).send({ error: 'Failed to check in' });
      }
    }
  );

  // Check-out do plantão
  app.post(
    '/:id/check-out',
    { preHandler: [authorizeRole('MEDICO')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const checkOutSchema = z.object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        qrCodeToken: z.string(),
        justificativaAtraso: z.string().optional(),
      });

      try {
        const { latitude, longitude, qrCodeToken, justificativaAtraso } = checkOutSchema.parse(request.body);
        const user = request.user as { userId: string };

        if (!isValidCoordinates({ latitude, longitude })) {
          return reply.status(400).send({ error: 'Invalid coordinates' });
        }

        const medico = await prisma.medico.findUnique({
          where: { userId: user.userId },
        });

        if (!medico) {
          return reply.status(404).send({ error: 'Médico not found' });
        }

        const candidatura = await prisma.candidatura.findUnique({
          where: { id },
          include: {
            plantao: {
              include: {
                hospital: true,
              },
            },
            registrosPonto: true,
          },
        });

        if (!candidatura || candidatura.medicoId !== medico.id) {
          return reply.status(403).send({ error: 'Forbidden' });
        }

        if (candidatura.status !== 'EM_ANDAMENTO') {
          return reply.status(400).send({
            error: 'Not in progress',
            message: 'Você precisa fazer check-in antes de fazer check-out'
          });
        }

        // Verifica se já fez check-out
        const existingCheckOut = candidatura.registrosPonto.find((r: any) => r.tipo === 'SAIDA');
        if (existingCheckOut) {
          return reply.status(400).send({
            error: 'Already checked out',
            message: 'Você já fez check-out neste plantão'
          });
        }

        // Valida QR Code
        if (!isQRTokenValid(qrCodeToken, candidatura.plantao.id)) {
          return reply.status(400).send({
            error: 'Invalid QR code',
            message: 'QR Code inválido ou expirado'
          });
        }

        // Valida localização
        if (!candidatura.plantao.hospital.latitude || !candidatura.plantao.hospital.longitude) {
          return reply.status(400).send({
            error: 'Hospital location not configured',
            message: 'O hospital ainda não configurou sua localização'
          });
        }

        const userLocation = { latitude, longitude };
        const hospitalLocation = {
          latitude: candidatura.plantao.hospital.latitude,
          longitude: candidatura.plantao.hospital.longitude,
        };

        const distance = calculateDistance(userLocation, hospitalLocation);

        if (!isWithinRadius(userLocation, hospitalLocation, MAX_ALLOWED_RADIUS)) {
          return reply.status(400).send({
            error: 'Outside allowed radius',
            message: `Você está a ${Math.round(distance)}m do hospital. É necessário estar a no máximo ${MAX_ALLOWED_RADIUS}m.`
          });
        }

        // Verifica se está atrasado
        const now = new Date();
        const isLate = isCheckOutLate(candidatura.plantao.dataFim, now);
        const minutosAtraso = isLate ? calculateCheckOutDelay(candidatura.plantao.dataFim, now) : 0;

        // Se está atrasado mais de 5 minutos, exige justificativa
        if (isLate && !justificativaAtraso) {
          return reply.status(400).send({
            error: 'Justification required',
            message: `Você está ${minutosAtraso} minutos atrasado. É necessário fornecer uma justificativa.`,
            minutosAtraso
          });
        }

        // Registra check-out
        const registroPonto = await prisma.registroPonto.create({
          data: {
            candidaturaId: candidatura.id,
            tipo: 'SAIDA',
            latitude,
            longitude,
            distanciaMetros: distance,
            qrCodeValidado: qrCodeToken,
            atrasado: isLate,
            minutosAtraso: minutosAtraso || null,
            justificativaAtraso: justificativaAtraso || null,
          },
        });

        // Atualiza status da candidatura
        await prisma.candidatura.update({
          where: { id },
          data: {
            status: isLate ? 'ATRASADO' : 'FINALIZADO',
          },
        });

        return reply.status(201).send({
          message: 'Check-out realizado com sucesso',
          registroPonto,
          distance,
          isLate,
          minutosAtraso,
        });
      } catch (error) {
        return reply.status(400).send({ error: 'Failed to check out' });
      }
    }
  );
}
