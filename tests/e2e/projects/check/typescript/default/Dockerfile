# TypeScript test environment: Node.js + ESLint
# Used for: TypeScript linting, config generation, CLI tests, error handling
FROM node:20-slim

WORKDIR /cmc

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Setup project directory
WORKDIR /project

# Copy test files
COPY tests/e2e/projects/check/typescript/default/cmc.toml ./
COPY tests/e2e/projects/check/typescript/default/eslint.config.js ./
COPY tests/e2e/projects/check/typescript/default/*.ts ./

# Symlink node_modules from cmc
RUN ln -s /cmc/node_modules ./node_modules

ENTRYPOINT ["node", "/cmc/dist/cli/index.js"]
CMD ["check"]
