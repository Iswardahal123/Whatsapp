# Use Node.js with Chrome pre-installed
FROM node:18-slim

# Install dependencies for Chrome
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    procps \
    libxss1 \
    libgconf-2-4 \
    libxrandr2 \
    libasound2 \
    libpangocairo-1.0-0 \
    libatk1.0-0 \
    libcairo-gobject2 \
    libgtk-3-0 \
    libgdk-pixbuf2.0-0 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrender1 \
    libxtst6 \
    libcups2 \
    libdrm2 \
    libgtk-3-0 \
    libgtk2.0-0 \
    libnotify4 \
    libnss3 \
    libxss1 \
    libxtst6 \
    xdg-utils \
    libatspi2.0-0 \
    libdrm2 \
    libxkbcommon0 \
    libepoxy0 \
    libwayland-client0 \
    libwayland-egl1 \
    libwayland-server0 \
    libxkbfile1

# Install Chrome
RUN wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

# Set Chrome path
ENV GOOGLE_CHROME_BIN=/usr/bin/google-chrome-stable

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install npm dependencies
RUN npm install

# Copy app source
COPY . .

# Create directory for WhatsApp auth
RUN mkdir -p .wwebjs_auth

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
