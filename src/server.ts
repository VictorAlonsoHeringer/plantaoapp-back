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

app.register(cors, {
  origin: true,
});

app.register(jwt, {
  secret: process.env.JWT_SECRET || 'your-secret-key',
  sign: {
    expiresIn: '5d', // Token válido por 5 dias (120 horas)
  },
});

// Health check endpoint
app.get('/health', async (request, reply) => {
  return { status: 'ok', timestamp: new Date().toISOString() };
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
