# Degraded environment: TypeScript files but NO ESLint installed
# Used for: Testing graceful degradation when ESLint is unavailable
FROM node:20-slim

WORKDIR /cmc

# Copy package.json but install WITHOUT dev dependencies (no eslint)
COPY package*.json ./

# Skip prepare script (husky) and install only production deps
RUN npm pkg delete scripts.prepare && npm ci --omit=dev

# Copy pre-built dist (can't build without typescript in devDeps)
COPY dist/ ./dist/

# Setup project directory
WORKDIR /project

# Copy test project files (TS files to check, but no ESLint to check them)
COPY tests/e2e/projects/check/typescript/default/cmc.toml ./
COPY tests/e2e/projects/check/typescript/default/*.ts ./

ENTRYPOINT ["node", "/cmc/dist/cli/index.js"]
CMD ["check"]
