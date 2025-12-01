# Mixed language test environment (Python + Ruff + Node + ESLint)
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
COPY tests/e2e/projects/mixed-language/cmc.toml ./
COPY tests/e2e/projects/mixed-language/*.py ./
COPY tests/e2e/projects/mixed-language/*.ts ./

# Create eslint config for TypeScript files
RUN echo 'import eslint from "@eslint/js";\
import tseslint from "typescript-eslint";\
export default tseslint.config(\
  eslint.configs.recommended,\
  ...tseslint.configs.recommended,\
  { files: ["**/*.ts"], rules: { "no-var": "error", "prefer-const": "error", "@typescript-eslint/no-unused-vars": "error" } }\
);' > eslint.config.js

# Symlink node_modules from cmc
RUN ln -s /cmc/node_modules ./node_modules

ENTRYPOINT ["node", "/cmc/dist/cli/index.js"]
CMD ["check"]
