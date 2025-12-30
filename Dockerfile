# Etapa 1: Build
FROM node:22-alpine AS builder

# Define o diretório de trabalho
WORKDIR /app

# Instala OpenSSL e dependências necessárias para Prisma
RUN apk add --no-cache openssl libc6-compat python3 make g++

# Copia os arquivos de dependências
COPY package*.json ./
COPY prisma ./prisma/

# Instala TODAS as dependências
RUN npm ci && npm cache clean --force

# Copia o código-fonte
COPY . .

# Gera o Prisma Client
RUN npx prisma generate

# Etapa 2: Produção
FROM node:18-alpine AS runner

# Instala dependências do sistema
RUN apk add --no-cache dumb-init openssl libc6-compat

# Define o diretório de trabalho
WORKDIR /app

# Cria usuário não-root para segurança
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copia package files
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma

# Instala apenas dependências de produção + ts-node para runtime
RUN npm ci --only=production && \
    npm install ts-node typescript && \
    npm cache clean --force

# Copia o código-fonte e Prisma Client gerado
COPY --from=builder --chown=nodejs:nodejs /app/src ./src
COPY --from=builder --chown=nodejs:nodejs /app/tsconfig.json ./
COPY --from=builder --chown=nodejs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nodejs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

# Muda para usuário não-root
USER nodejs

# Expõe a porta da aplicação
EXPOSE 5001

# Usa dumb-init para melhor gerenciamento de sinais
ENTRYPOINT ["dumb-init", "--"]

# Comando de início (executa migrations e inicia o servidor com ts-node)
CMD ["sh", "-c", "npx prisma migrate deploy && npx ts-node src/server.ts"]
