# Use Puppeteer's official image with Chrome pre-installed
FROM ghcr.io/puppeteer/puppeteer:latest

# Set working directory
WORKDIR /app

# Set environment variables for Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Copy package files first (for better caching)
COPY package*.json ./

# Install all dependencies (need devDeps for TypeScript build)
RUN npm ci

# Copy source files
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm run build

# Remove dev dependencies to reduce image size
RUN npm prune --production

# Create logs directory
RUN mkdir -p logs

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose health check port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Run the application
CMD ["node", "dist/index.js"]
