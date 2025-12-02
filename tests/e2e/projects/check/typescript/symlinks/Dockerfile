# Symlinks test environment
# Used for: Testing that symlinks to files are handled correctly
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

# Copy test files
COPY tests/e2e/projects/check/typescript/symlinks/cmc.toml ./
COPY tests/e2e/projects/check/typescript/symlinks/eslint.config.js ./
COPY tests/e2e/projects/check/typescript/symlinks/actual.ts ./

# Create a symlink to the actual file
RUN ln -s actual.ts linked.ts

# Create a directory and symlink to it
RUN mkdir real_dir && echo 'var broken = 1;' > real_dir/inner.ts
RUN ln -s real_dir linked_dir

# Symlink node_modules from cmc
RUN ln -s /cmc/node_modules ./node_modules

ENTRYPOINT ["node", "/cmc/dist/cli/index.js"]
CMD ["check"]
