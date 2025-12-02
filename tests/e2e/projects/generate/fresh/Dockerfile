# Test environment for generate with no existing config
# Used for: Testing generate creates new config files
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

# Copy only cmc.toml - no existing linter configs
COPY tests/e2e/projects/generate/fresh/cmc.toml ./

# Symlink node_modules from cmc
RUN ln -s /cmc/node_modules ./node_modules

ENTRYPOINT ["node", "/cmc/dist/cli/index.js"]
CMD ["generate", "eslint"]
