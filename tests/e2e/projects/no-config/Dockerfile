# Test environment for missing config handling
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

# Copy test project files (no cmc.toml - testing error handling)
COPY tests/e2e/projects/no-config/app.ts ./

ENTRYPOINT ["node", "/cmc/dist/cli/index.js"]
CMD ["check"]
