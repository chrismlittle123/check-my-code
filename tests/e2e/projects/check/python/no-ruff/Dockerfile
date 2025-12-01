# Degraded environment: Python files but NO Ruff installed
# Used for: Testing graceful degradation when Ruff is unavailable
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

# Setup project directory
WORKDIR /project

# Copy test project files (Python files to check, but no Ruff to check them)
COPY tests/e2e/projects/check/python/default/cmc.toml ./
COPY tests/e2e/projects/check/python/default/*.py ./

ENTRYPOINT ["node", "/cmc/dist/cli/index.js"]
CMD ["check"]
