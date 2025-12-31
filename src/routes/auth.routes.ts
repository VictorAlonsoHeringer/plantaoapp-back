import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middlewares/auth.middleware';

export async function authRoutes(app: FastifyInstance) {
  // Rota para verificar se o token ainda é válido
  app.get('/verify', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const user = request.user as { userId: string; role: string };

      // Busca os dados atualizados do usuário
      const userData = await prisma.user.findUnique({
        where: { id: user.userId },
        include: {
          hospital: true,
          medico: true,
        },
      });

      if (!userData) {
        return reply.status(404).send({ error: 'User not found' });
      }

      const { password: _, ...userWithoutPassword } = userData;

      return reply.send({
        valid: true,
        user: userWithoutPassword,
      });
    } catch (error) {
      return reply.status(401).send({ error: 'Invalid token' });
    }
  });

  app.post('/register', async (request, reply) => {
    try {
      const body = request.body as any;

      // Validação básica
      if (!body.email || !body.password || !body.role || !body.data) {
        return reply.status(400).send({ error: 'Missing required fields' });
      }

      const hashedPassword = await bcrypt.hash(body.password, 10);

      const user = await prisma.user.create({
        data: {
          email: body.email,
          password: hashedPassword,
          role: body.role,
          ...(body.role === 'HOSPITAL'
            ? {
                hospital: {
                  create: {
                    nome: body.data.nome,
                    cnpj: body.data.cnpj,
                    telefone: body.data.telefone,
                    endereco: body.data.endereco,
                    cidade: body.data.cidade,
                    estado: body.data.estado,
                    latitude: body.data.latitude || null,
                    longitude: body.data.longitude || null,
                  },
                },
              }
            : {
                medico: {
                  create: {
                    nome: body.data.nome,
                    cpf: body.data.cpf,
                    crm: body.data.crm,
                    especialidade: body.data.especialidade,
                    telefone: body.data.telefone,
                    cidade: body.data.cidade,
                    estado: body.data.estado,
                  },
                },
              }),
        },
        include: {
          hospital: true,
          medico: true,
        },
      });

      const token = app.jwt.sign({ userId: user.id, role: user.role });

      return reply.status(201).send({ user, token });
    } catch (error: any) {
      console.error('Registration error:', error);
      return reply.status(400).send({
        error: 'Registration failed',
        details: error.message
      });
    }
  });

  app.post('/login', async (request, reply) => {
    const loginSchema = z.object({
      email: z.string().email(),
      password: z.string(),
    });

    try {
      const { email, password } = loginSchema.parse(request.body);

      const user = await prisma.user.findUnique({
        where: { email },
        include: {
          hospital: true,
          medico: true,
        },
      });

      if (!user) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      const validPassword = await bcrypt.compare(password, user.password);

      if (!validPassword) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      const token = app.jwt.sign({ userId: user.id, role: user.role });

      const { password: _, ...userWithoutPassword } = user;

      return reply.send({ user: userWithoutPassword, token });
    } catch (error) {
      return reply.status(400).send({ error: 'Login failed' });
    }
  });
}
