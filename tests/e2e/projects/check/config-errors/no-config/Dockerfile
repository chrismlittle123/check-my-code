# Test environment for missing cmc.toml
# Used for: Testing exit code 2 when config is missing
FROM node:20-slim

WORKDIR /cmc

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Setup project directory (no cmc.toml!)
WORKDIR /project

# Create a dummy file so the project isn't empty
RUN echo "const x = 1;" > test.ts

# Symlink node_modules from cmc
RUN ln -s /cmc/node_modules ./node_modules

ENTRYPOINT ["node", "/cmc/dist/cli/index.js"]
CMD ["check"]
