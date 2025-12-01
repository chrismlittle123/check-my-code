# TypeScript-only test environment (no Python/Ruff)
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

# Copy test project files
COPY tests/e2e/projects/typescript-only/cmc.toml ./
COPY tests/e2e/projects/typescript-only/*.ts ./

# Create eslint config
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
