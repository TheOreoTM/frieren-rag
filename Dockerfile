# Use a Node.js base image. Using a specific LTS version is recommended for stability.
# Based on package.json, you are using node 10+, let's pick a recent LTS.
FROM node:23-slim

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json (or yarn.lock/pnpm-lock.yml) first
# This layer is cached and speeds up builds if only code changes but dependencies don't
COPY package*.json ./

# Install dependencies
# 'npm ci' is recommended in CI environments if package-lock.json exists
RUN npm ci --production # Install only production dependencies

# Copy the rest of your application code, including the src/data/raw directory
# Docker respects .gitignore by default when using COPY . .
COPY . .

# Build the TypeScript code
# This uses the 'build' script defined in your package.json (likely 'tsc')
RUN npm run build

# Expose the port your Express server listens on. Your src/api/server.ts defaults to 3000.
EXPOSE 3000

# Define the command to run your compiled application
# This uses the 'start' script defined in your package.json ('node dist/index.js')
CMD [ "npm", "start" ]