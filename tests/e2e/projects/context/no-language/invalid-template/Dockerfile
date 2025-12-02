# Context command test environment - Invalid template name
# Used for: Testing error handling when template file doesn't exist in source
FROM node:20-slim

# Install git (required for remote template fetching)
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

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
COPY tests/e2e/projects/context/no-language/invalid-template/cmc.toml ./

# Symlink node_modules from cmc
RUN ln -s /cmc/node_modules ./node_modules

ENTRYPOINT ["node", "/cmc/dist/cli/index.js"]
CMD ["context", "--stdout"]
