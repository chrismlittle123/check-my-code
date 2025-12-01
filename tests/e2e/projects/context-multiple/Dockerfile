# Context command test environment (multiple templates)
FROM node:20-slim

WORKDIR /cmc

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Copy community assets (required for context templates)
COPY community-assets/ ./community-assets/

# Setup project directory
WORKDIR /project

# Copy test files
COPY tests/e2e/projects/context-multiple/cmc.toml ./

# Symlink node_modules from cmc
RUN ln -s /cmc/node_modules ./node_modules

ENTRYPOINT ["node", "/cmc/dist/cli/index.js"]
CMD ["context", "--stdout"]
