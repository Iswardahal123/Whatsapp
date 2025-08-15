# Use Node.js with Chrome pre-installed
FROM ghcr.io/puppeteer/puppeteer:21.5.2

# Set working directory
WORKDIR /usr/src/app

# Switch to root to install dependencies
USER root

# Install additional dependencies if needed
RUN apt-get update && apt-get install -y \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libgtk-3-0 \
    libu2f-udev \
    libvulkan1 \
    xdg-utils \
    zip \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create necessary directories and set permissions
RUN mkdir -p /usr/src/app/.wwebjs_auth && \
    chown -R pptruser:pptruser /usr/src/app && \
    chmod -R 755 /usr/src/app

# Switch to non-root user
USER pptruser

# Expose port
EXPOSE 10000

# Set environment variables
ENV NODE_ENV=production
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Start the application
CMD ["npm", "start"]
