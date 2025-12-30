# Etapa 1: Build
FROM node:18-alpine AS builder

# Define o diretório de trabalho
WORKDIR /app

# Copia os arquivos de dependências
COPY package*.json ./
COPY prisma ./prisma/

# Instala as dependências
RUN npm ci --only=production && \
    npm cache clean --force

# Copia o código-fonte
COPY . .

# Gera o Prisma Client
RUN npx prisma generate

# Etapa 2: Produção
FROM node:18-alpine AS runner

# Instala o dumb-init para melhor gerenciamento de processos
RUN apk add --no-cache dumb-init

# Define o diretório de trabalho
WORKDIR /app

# Cria usuário não-root para segurança
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copia dependências e código do builder
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nodejs:nodejs /app/src ./src
COPY --from=builder --chown=nodejs:nodejs /app/tsconfig.json ./

# Instala ts-node para executar TypeScript em produção
RUN npm install -g ts-node typescript

# Muda para usuário não-root
USER nodejs

# Expõe a porta da aplicação
EXPOSE 5555

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5555/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Usa dumb-init para melhor gerenciamento de sinais
ENTRYPOINT ["dumb-init", "--"]

# Comando de início (executa migrations e inicia o servidor)
CMD ["sh", "-c", "npx prisma migrate deploy && npx ts-node src/server.ts"]
