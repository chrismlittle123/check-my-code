# Python-only test environment (with Ruff, no ESLint needed for TS)
FROM python:3.12-slim

# Install Node.js for cmc CLI
RUN apt-get update && apt-get install -y \
    curl \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install Ruff
RUN pip install ruff

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

# Copy test project files
COPY tests/e2e/projects/python-only/cmc.toml ./
COPY tests/e2e/projects/python-only/*.py ./

ENTRYPOINT ["node", "/cmc/dist/cli/index.js"]
CMD ["check"]
