# Use an official Node.js runtime as the base image
FROM node:18

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json (to leverage Docker cache for dependencies)
COPY package*.json ./

# Install dependencies (this step will be cached unless package.json changes)
RUN npm install

# Copy the entire backend code
COPY . .

# Expose the backend port
EXPOSE 5000

# Run the server as a non-root user (optional for security)
# Create a new user (non-root) to run the application
RUN useradd -m nodeuser
USER nodeuser

# Start the server
CMD ["node", "app.js"]
