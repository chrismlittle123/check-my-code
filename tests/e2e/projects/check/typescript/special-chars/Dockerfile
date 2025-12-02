# Special characters in file paths test environment
# Used for: Testing handling of files with dashes, underscores, and multiple dots in names
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

# Copy test files - including those with special chars
COPY tests/e2e/projects/check/typescript/special-chars/cmc.toml ./
COPY tests/e2e/projects/check/typescript/special-chars/eslint.config.js ./
COPY tests/e2e/projects/check/typescript/special-chars/file-with-dashes.ts ./
COPY tests/e2e/projects/check/typescript/special-chars/file_with_underscores.ts ./
COPY tests/e2e/projects/check/typescript/special-chars/file.multiple.dots.ts ./

# Symlink node_modules from cmc
RUN ln -s /cmc/node_modules ./node_modules

ENTRYPOINT ["node", "/cmc/dist/cli/index.js"]
CMD ["check"]
