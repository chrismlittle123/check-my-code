# Test environment for invalid TOML syntax
# Used for: Testing exit code 2 when cmc.toml has syntax errors
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

# Copy invalid cmc.toml
COPY tests/e2e/projects/check/config-errors/invalid-toml/cmc.toml ./

# Create a dummy file
RUN echo "const x = 1;" > test.ts

# Symlink node_modules from cmc
RUN ln -s /cmc/node_modules ./node_modules

ENTRYPOINT ["node", "/cmc/dist/cli/index.js"]
CMD ["check"]
