# Backend Dockerfile
FROM node:20-alpine

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

WORKDIR /app

# Copy package files and install ALL deps (including prisma devDep)
COPY package.json package-lock.json* ./
RUN npm install

# Copy prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Copy app source
COPY server.js ./
COPY public ./public

EXPOSE 5050

# Start script: push schema then start server
CMD ["sh", "-c", "npx prisma db push --skip-generate && node server.js"]
