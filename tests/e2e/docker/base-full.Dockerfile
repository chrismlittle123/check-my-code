# Base full environment for e2e tests
# Provides: Python 3.12, Node.js 20, Ruff, ESLint, cmc CLI built
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

# Copy community assets (for context command)
COPY community-assets/ ./community-assets/

# Setup project directory
WORKDIR /project

# Symlink node_modules from cmc (provides eslint)
RUN ln -s /cmc/node_modules ./node_modules

ENTRYPOINT ["node", "/cmc/dist/cli/index.js"]
CMD ["check"]
