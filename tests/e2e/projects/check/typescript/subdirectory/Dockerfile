# Test environment for checking specific subdirectory
# Used for: Testing `cmc check src/` path argument
FROM node:20-slim

WORKDIR /cmc

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Setup project directory with subdirectories
WORKDIR /project

# Copy test files
COPY tests/e2e/projects/check/typescript/subdirectory/cmc.toml ./
COPY tests/e2e/projects/check/typescript/subdirectory/eslint.config.js ./

# Create directory structure with files in different locations
RUN mkdir -p src lib
RUN echo "var srcVar = 1; console.log(srcVar);" > src/violation.ts
RUN echo "const srcConst = 2; console.log(srcConst);" > src/clean.ts
RUN echo "var libVar = 3; console.log(libVar);" > lib/violation.ts
RUN echo "const rootConst = 4; console.log(rootConst);" > root.ts

# Symlink node_modules from cmc
RUN ln -s /cmc/node_modules ./node_modules

ENTRYPOINT ["node", "/cmc/dist/cli/index.js"]
CMD ["check"]
