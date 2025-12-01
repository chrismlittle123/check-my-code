# Generate command test environment with no cmc.toml
FROM node:20-slim

WORKDIR /cmc

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Setup project directory with no cmc.toml
WORKDIR /project

# Create empty directory - no cmc.toml
RUN touch placeholder.txt

ENTRYPOINT ["node", "/cmc/dist/cli/index.js"]
CMD ["generate", "--help"]
