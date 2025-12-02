# Multi-violations test environment
# Used for: Testing multiple violations per file and ordering of violations
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
COPY tests/e2e/projects/check/typescript/multi-violations/cmc.toml ./
COPY tests/e2e/projects/check/typescript/multi-violations/eslint.config.js ./
COPY tests/e2e/projects/check/typescript/multi-violations/file-a.ts ./
COPY tests/e2e/projects/check/typescript/multi-violations/file-b.ts ./

# Symlink node_modules from cmc
RUN ln -s /cmc/node_modules ./node_modules

ENTRYPOINT ["node", "/cmc/dist/cli/index.js"]
CMD ["check"]
