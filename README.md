# PlantãoApp - Backend

API REST para o sistema de gestão de plantões médicos.

## Tecnologias

- Node.js
- TypeScript
- Fastify
- Prisma ORM
- PostgreSQL
- JWT Authentication
- Zod (validação)

## Instalação

```bash
npm install
```

## Configuração

### 1. Iniciar PostgreSQL com Docker

```bash
# Iniciar o PostgreSQL
docker-compose up -d

# Verificar se está rodando
docker ps

# Parar o PostgreSQL
docker-compose down

# Parar e remover dados
docker-compose down -v
```

### 2. Configurar variáveis de ambiente

1. Copie o arquivo `.env.example` para `.env`:
   ```bash
   cp .env.example .env
   ```

2. As variáveis já estão configuradas para o Docker:
   - `DATABASE_URL`: postgresql://postgres:postgres@localhost:5432/plantaoapp?schema=public
   - `JWT_SECRET`: Altere para uma chave secreta segura em produção
   - `PORT`: 3333

## Prisma

```bash
# Gerar Prisma Client
npm run prisma:generate

# Criar migração
npm run prisma:migrate

# Abrir Prisma Studio
npm run prisma:studio
```

## Executar

### Desenvolvimento Local

```bash
# Desenvolvimento
npm run dev

# Build
npm run build

# Produção
npm start
```

### Docker

```bash
# Rodar com Docker Compose (API + PostgreSQL)
docker-compose up -d

# Ver logs
docker-compose logs -f api

# Parar
docker-compose down
```

Para mais informações sobre Docker, veja [DOCKER.md](./DOCKER.md)

## 🚀 Deploy

### Dockploy

Para fazer deploy no Dockploy, veja o guia completo em [DEPLOY.md](./DEPLOY.md)

Resumo:
1. Configure um banco PostgreSQL
2. Adicione as variáveis de ambiente
3. Conecte o repositório Git
4. O Dockerfile já está pronto para uso

## Estrutura do Banco de Dados

### Modelos

- **User**: Usuário do sistema (HOSPITAL ou MEDICO)
- **Hospital**: Dados do hospital
- **Medico**: Dados do médico
- **Plantao**: Vaga de plantão criada pelo hospital
- **Candidatura**: Candidatura do médico para um plantão

## Endpoints da API

### Autenticação

- `POST /api/auth/register` - Registrar novo usuário
- `POST /api/auth/login` - Login

### Hospitais

- `GET /api/hospitals` - Listar hospitais
- `GET /api/hospitals/:id` - Buscar hospital

### Médicos

- `GET /api/medicos` - Listar médicos
- `GET /api/medicos/:id` - Buscar médico

### Plantões

- `GET /api/plantoes` - Listar plantões (filtros: especialidade, status)
- `GET /api/plantoes/:id` - Buscar plantão
- `POST /api/plantoes` - Criar plantão (HOSPITAL)
- `PATCH /api/plantoes/:id` - Atualizar plantão (HOSPITAL)
- `DELETE /api/plantoes/:id` - Deletar plantão (HOSPITAL)
- `POST /api/plantoes/:id/generate-qrcode` - Gerar QR Code (HOSPITAL)

### Candidaturas

- `GET /api/candidaturas` - Listar candidaturas
- `POST /api/candidaturas` - Criar candidatura (MEDICO)
- `PATCH /api/candidaturas/:id` - Atualizar status (HOSPITAL)
- `DELETE /api/candidaturas/:id` - Deletar candidatura (MEDICO)
- `POST /api/candidaturas/:id/validate-location` - Validar localização (MEDICO)
- `POST /api/candidaturas/:id/check-in` - Check-in no plantão (MEDICO)
- `POST /api/candidaturas/:id/check-out` - Check-out do plantão (MEDICO)

### Sistema

- `GET /health` - Health check da aplicação
