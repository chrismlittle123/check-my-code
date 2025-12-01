# Generate command test environment
FROM node:20-slim

WORKDIR /cmc

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Setup project directory (no existing linter configs)
WORKDIR /project

# Copy only cmc.toml - no eslint.config.js or ruff.toml
COPY tests/e2e/projects/generate-test/cmc.toml ./

# Symlink node_modules from cmc
RUN ln -s /cmc/node_modules ./node_modules

ENTRYPOINT ["node", "/cmc/dist/cli/index.js"]
CMD ["generate", "--help"]
