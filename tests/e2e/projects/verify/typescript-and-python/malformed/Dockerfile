# Verify command test environment (malformed configs)
# Used for: Testing error handling when config files have syntax errors
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
COPY tests/e2e/projects/verify/typescript-and-python/malformed/cmc.toml ./
COPY tests/e2e/projects/verify/typescript-and-python/malformed/eslint.config.js ./
COPY tests/e2e/projects/verify/typescript-and-python/malformed/ruff.toml ./

# Symlink node_modules from cmc
RUN ln -s /cmc/node_modules ./node_modules

ENTRYPOINT ["node", "/cmc/dist/cli/index.js"]
CMD ["verify"]
