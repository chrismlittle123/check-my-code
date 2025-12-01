# Full test environment: Python + Ruff + Node + ESLint
# Used for: Mixed-language project tests
FROM python:3.12-slim

# Install Node.js
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
COPY tests/e2e/projects/full/cmc.toml ./
COPY tests/e2e/projects/full/eslint.config.js ./
COPY tests/e2e/projects/full/ruff.toml ./
COPY tests/e2e/projects/full/*.py ./
COPY tests/e2e/projects/full/*.ts ./

# Symlink node_modules from cmc
RUN ln -s /cmc/node_modules ./node_modules

ENTRYPOINT ["node", "/cmc/dist/cli/index.js"]
CMD ["check"]
