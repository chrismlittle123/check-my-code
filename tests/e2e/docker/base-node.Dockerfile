# Base Node.js environment for e2e tests
# Provides: Node.js 20, npm, cmc CLI built, ESLint available
FROM node:20-slim

WORKDIR /cmc

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Copy community assets (for context command)
COPY community-assets/ ./community-assets/

# Setup project directory
WORKDIR /project

# Symlink node_modules from cmc (provides eslint)
RUN ln -s /cmc/node_modules ./node_modules

ENTRYPOINT ["node", "/cmc/dist/cli/index.js"]
CMD ["check"]
