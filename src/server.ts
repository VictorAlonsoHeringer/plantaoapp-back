import fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import dotenv from 'dotenv';
import { authRoutes } from './routes/auth.routes';
import { hospitalRoutes } from './routes/hospital.routes';
import { medicoRoutes } from './routes/medico.routes';
import { plantaoRoutes } from './routes/plantao.routes';
import { candidaturaRoutes } from './routes/candidatura.routes';

dotenv.config();

const app = fastify({ logger: true });

// Configuração de CORS - Liberado para aplicativos móveis
app.register(cors, {
  origin: true, // Permite todas as origens (necessário para apps móveis)
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Authorization'],
  preflightContinue: false,
  optionsSuccessStatus: 204,
});

app.register(jwt, {
  secret: process.env.JWT_SECRET || 'your-secret-key',
  sign: {
    expiresIn: '5d', // Token válido por 5 dias (120 horas)
  },
});

// Health check endpoint detalhado
app.get('/health', async (request, reply) => {
  const healthcheck: {
    status: string;
    timestamp: string;
    uptime: number;
    environment: string;
    memory: {
      used: number;
      total: number;
      unit: string;
    };
    database?: string;
  } = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      unit: 'MB'
    }
  };

  // Testa conexão com banco de dados
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    await prisma.$queryRaw`SELECT 1`;
    await prisma.$disconnect();
    healthcheck.database = 'connected';
  } catch (error) {
    healthcheck.database = 'disconnected';
    healthcheck.status = 'degraded';
  }

  return healthcheck;
});

// Endpoint simplificado para monitoramento (ex: Dockploy)
app.get('/api/health', async (request, reply) => {
  return { status: 'ok' };
});

app.register(authRoutes, { prefix: '/api/auth' });
app.register(hospitalRoutes, { prefix: '/api/hospitals' });
app.register(medicoRoutes, { prefix: '/api/medicos' });
app.register(plantaoRoutes, { prefix: '/api/plantoes' });
app.register(candidaturaRoutes, { prefix: '/api/candidaturas' });

const start = async () => {
  try {
    const port = Number(process.env.PORT) || 3333;
    await app.listen({ port, host: '0.0.0.0' });
    console.log(`Server running on http://localhost:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
