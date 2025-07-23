# Use Node.js base image
FROM node:20

# Set environment variable for pnpm
# Install pnpm
RUN npm install -g pnpm

# Create app directory
WORKDIR /app

# Copy everything
COPY . .

# Move to backend directory and install
RUN pnpm install
WORKDIR /app/backend


# Expose the port your dev server listens on
EXPOSE 3000

# Start the server
CMD ["pnpm", "run", "dev"]
