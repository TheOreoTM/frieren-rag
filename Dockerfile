# Use a Node.js base image. Using a specific LTS version is recommended for stability.
FROM node:23-slim

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json (or yarn.lock/pnpm-lock.yml) first
COPY package*.json ./

# Install dependencies (installing ALL, including devDependencies needed for build)
RUN npm ci # <-- REMOVE --production here

# Copy the rest of your application code, including the src/data/raw directory
COPY . .

# Build the TypeScript code (tsc is now available)
RUN npm run build

# Expose the port your Express server listens on (internal to Docker network/host)
EXPOSE 3000

# Define the command to run your compiled application
CMD [ "npm", "start" ]