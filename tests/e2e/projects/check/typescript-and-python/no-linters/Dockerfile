# Degraded environment: NO linters installed (no ESLint, no Ruff)
# Used for: Testing graceful degradation when no linters are available
FROM python:3.12-slim

# Install Node.js (but NOT Ruff)
RUN apt-get update && apt-get install -y \
    curl \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /cmc

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Remove ESLint after build (it was needed for dev dependencies but we want to test without it)
RUN rm -rf /cmc/node_modules/.bin/eslint /cmc/node_modules/eslint

# Setup project directory
WORKDIR /project

# Copy test project files
COPY tests/e2e/projects/check/typescript-and-python/no-linters/cmc.toml ./
COPY tests/e2e/projects/check/typescript-and-python/no-linters/violation.ts ./
COPY tests/e2e/projects/check/typescript-and-python/no-linters/violation.py ./

# Note: ESLint removed above, Ruff not installed

ENTRYPOINT ["node", "/cmc/dist/cli/index.js"]
CMD ["check"]
