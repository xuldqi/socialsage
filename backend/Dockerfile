FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY server.js ./

# Create data directory volume
VOLUME [ "/app/data" ]

# Set environment variables
ENV NODE_ENV=production
ENV PORT=9876
ENV DATA_DIR=/app/data

# Expose port
EXPOSE 9876

# Start server
CMD [ "node", "server.js" ]
