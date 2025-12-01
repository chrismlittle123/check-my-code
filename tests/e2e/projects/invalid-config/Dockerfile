# Test environment for invalid config handling
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

# Copy test project files (invalid config - missing project.name)
COPY tests/e2e/projects/invalid-config/cmc.toml ./
COPY tests/e2e/projects/invalid-config/app.ts ./

ENTRYPOINT ["node", "/cmc/dist/cli/index.js"]
CMD ["check"]
