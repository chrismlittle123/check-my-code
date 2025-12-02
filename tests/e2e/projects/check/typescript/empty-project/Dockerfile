# Empty project test environment
# Used for: Testing behavior when no source files match the linter patterns
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

# Copy only config - no source files
COPY tests/e2e/projects/check/typescript/empty-project/cmc.toml ./
COPY tests/e2e/projects/check/typescript/empty-project/README.md ./

# Symlink node_modules from cmc
RUN ln -s /cmc/node_modules ./node_modules

ENTRYPOINT ["node", "/cmc/dist/cli/index.js"]
CMD ["check"]
