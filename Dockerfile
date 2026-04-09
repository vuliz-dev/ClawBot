# Build stage
FROM node:20-slim as builder

WORKDIR /app

# Copy dependency files
COPY package.json pnpm-lock.yaml ./

# Install pnpm
RUN npm install -g pnpm

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Runtime stage
FROM node:20-slim

WORKDIR /app

# Install pnpm for production
RUN npm install -g pnpm

# Copy built files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Create data directory
RUN mkdir -p /app/data /app/workspace

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', (r) => {if (r.statusCode !== 404) throw new Error(r.statusCode)})"

# Start
CMD ["node", "dist/index.js"]
