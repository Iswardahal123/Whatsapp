// server.js
const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const axios = require('axios');
require('dotenv').config();
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.static('public'));

// Configuration
const ALLOWED_NUMBER = '919365374458'; // Only this number can get replies
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

// Render-specific Chrome configuration
const getChromeExecutablePath = () => {
    const fs = require('fs');
    
    // Try different possible Chrome paths on Render
    const possiblePaths = [
        process.env.GOOGLE_CHROME_BIN,
        '/usr/bin/google-chrome-stable',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        '/snap/bin/chromium',
        '/opt/google/chrome/chrome',
        '/opt/render/project/.render/chrome/opt/google/chrome/chrome'
    ];
    
    for (const path of possiblePaths) {
        if (path) {
            try {
                // Check if the file exists and is executable
                if (fs.existsSync(path)) {
                    console.log(`✅ Found Chrome at: ${path}`);
                    return path;
                } else {
                    console.log(`❌ Chrome not found at: ${path}`);
                }
            } catch (error) {
                console.log(`❌ Error checking path ${path}:`, error.message);
            }
        }
    }
    
    console.log('⚠️ Using default Chrome path (let Puppeteer auto-detect)');
    return undefined;
};

// WhatsApp Client Setup optimized for Render
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "whatsapp-bot-render",
        dataPath: './.wwebjs_auth'
    }),
    puppeteer: {
        headless: true,
        executablePath: getChromeExecutablePath(),
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu',
            '--disable-extensions',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-features=TranslateUI',
            '--disable-ipc-flooding-protection',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--memory-pressure-off',
            '--max_old_space_size=4096',
            '--disable-background-networking',
            '--disable-client-side-phishing-detection',
            '--disable-default-apps',
            '--disable-hang-monitor',
            '--disable-popup-blocking',
            '--disable-prompt-on-repost',
            '--disable-sync',
            '--metrics-recording-only',
            '--no-default-browser-check',
            '--safebrowsing-disable-auto-update',
            '--enable-automation',
            '--password-store=basic',
            '--use-mock-keychain',
            '--disable-blink-features=AutomationControlled',
            '--ignore-certificate-errors',
            '--ignore-ssl-errors',
            '--ignore-certificate-errors-spki-list'
        ]
    }
});

// Store QR code and client state
let qrCodeString = '';
let isClientReady = false;
let initializationError = null;
let connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 3;

// WhatsApp Client Events
client.on('qr', async (qr) => {
    console.log('QR Code received');
    try {
        qrCodeString = await qrcode.toDataURL(qr);
        console.log('QR Code generated successfully');
    } catch (error) {
        console.error('Error generating QR code:', error);
        initializationError = 'Failed to generate QR code';
    }
});

client.on('ready', () => {
    console.log('WhatsApp Client is ready!');
    isClientReady = true;
    initializationError = null;
    connectionAttempts = 0;
});

client.on('authenticated', () => {
    console.log('WhatsApp Client authenticated');
});

client.on('auth_failure', (msg) => {
    console.error('Authentication failed:', msg);
    initializationError = 'Authentication failed: ' + msg;
});

client.on('disconnected', (reason) => {
    console.log('WhatsApp Client was logged out:', reason);
    isClientReady = false;
    
    // Attempt to reconnect
    if (connectionAttempts < MAX_CONNECTION_ATTEMPTS) {
        connectionAttempts++;
        console.log(`Attempting to reconnect... (${connectionAttempts}/${MAX_CONNECTION_ATTEMPTS})`);
        setTimeout(() => {
            client.initialize().catch(error => {
                console.error('Reconnection failed:', error);
                initializationError = 'Reconnection failed: ' + error.message;
            });
        }, 5000);
    } else {
        initializationError = 'Maximum reconnection attempts reached';
    }
});

// Message handler - Only respond to specific number
client.on('message', async (message) => {
    try {
        const chat = await message.getChat();
        
        // Get the sender's number (remove @ and domain part)
        const senderNumber = message.from.split('@')[0];
        
        console.log(`Message from ${senderNumber}: ${message.body}`);
        
        // Only respond to the allowed number and not to group messages or status
        if (senderNumber !== ALLOWED_NUMBER || chat.isGroup || message.isStatus) {
            console.log(`Ignoring message from ${senderNumber} (not authorized)`);
            return;
        }
        
        // Don't respond to empty messages
        if (!message.body || message.body.trim() === '') {
            return;
        }
        
        console.log(`Processing message from authorized number: ${message.body}`);
        
        // Get AI response using Google Generative AI
        const aiResponse = await getGoogleAIResponse(message.body);
        
        if (aiResponse) {
            await message.reply(aiResponse);
            console.log(`Replied to ${senderNumber}: ${aiResponse.substring(0, 100)}...`);
        } else {
            await message.reply('Sorry, I couldn\'t process your message right now. Please try again later.');
        }
        
    } catch (error) {
        console.error('Error handling message:', error);
        try {
            await message.reply('Sorry, I encountered an error. Please try again.');
        } catch (replyError) {
            console.error('Error sending error reply:', replyError);
        }
    }
});

// Function to get AI response from Google Generative AI (Gemini)
async function getGoogleAIResponse(userMessage) {
    if (!GOOGLE_API_KEY) {
        console.error('Google API Key not configured');
        return 'Sorry, AI service is not configured properly.';
    }
    
    try {
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GOOGLE_API_KEY}`,
            {
                contents: [{
                    parts: [{
                        text: userMessage
                    }]
                }]
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                },
                timeout: 30000 // 30 second timeout
            }
        );

        if (response.data && response.data.candidates && response.data.candidates[0]) {
            const aiText = response.data.candidates[0].content.parts[0].text;
            return aiText;
        } else {
            console.error('Unexpected API response structure:', response.data);
            return 'Sorry, I couldn\'t generate a response right now.';
        }

    } catch (error) {
        console.error('Google AI API Error:', error.response?.data || error.message);
        
        // Fallback responses
        const fallbackResponses = [
            "Thanks for your message! I'm here to help.",
            "I received your message. How can I assist you today?",
            "Hello! I'm your personal WhatsApp assistant.",
            "I'm here and ready to chat with you!",
            "Thanks for reaching out. What would you like to know?"
        ];
        
        return fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
    }
}

// API Routes
app.get('/', (req, res) => {
    res.send(`
        <html>
            <head>
                <title>Personal WhatsApp Bot - Render</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { 
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        text-align: center; 
                        margin: 0;
                        padding: 20px;
                        background: linear-gradient(135deg, #25D366, #128C7E);
                        min-height: 100vh;
                        color: white;
                    }
                    .container {
                        max-width: 600px;
                        margin: 0 auto;
                        background: rgba(255, 255, 255, 0.95);
                        padding: 30px;
                        border-radius: 15px;
                        box-shadow: 0 10px 30px rgba(0,0,0,0.2);
                        color: #333;
                        backdrop-filter: blur(10px);
                    }
                    .header {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 10px;
                        margin-bottom: 20px;
                    }
                    .status {
                        padding: 15px;
                        border-radius: 10px;
                        margin: 20px 0;
                        font-weight: bold;
                    }
                    .ready { 
                        background: linear-gradient(135deg, #d4edda, #c3e6cb); 
                        color: #155724; 
                        border: 1px solid #c3e6cb;
                    }
                    .initializing { 
                        background: linear-gradient(135deg, #fff3cd, #ffeaa7); 
                        color: #856404; 
                        border: 1px solid #ffeaa7;
                    }
                    .error { 
                        background: linear-gradient(135deg, #f8d7da, #f5c6cb); 
                        color: #721c24; 
                        border: 1px solid #f5c6cb;
                    }
                    .qr-code {
                        margin: 20px 0;
                        padding: 20px;
                        border: 2px dashed #ddd;
                        border-radius: 15px;
                        background: #f8f9fa;
                        transition: all 0.3s ease;
                    }
                    .qr-code:hover {
                        border-color: #25D366;
                    }
                    .qr-code img {
                        max-width: 300px;
                        width: 100%;
                        height: auto;
                        border-radius: 10px;
                    }
                    .info-card {
                        background: #f8f9fa;
                        border-radius: 10px;
                        padding: 15px;
                        margin: 15px 0;
                        border-left: 4px solid #25D366;
                    }
                    .pulse {
                        animation: pulse 2s infinite;
                    }
                    @keyframes pulse {
                        0% { opacity: 1; }
                        50% { opacity: 0.7; }
                        100% { opacity: 1; }
                    }
                    @media (max-width: 768px) {
                        .container {
                            margin: 10px;
                            padding: 20px;
                        }
                        .qr-code img {
                            max-width: 250px;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🤖 Personal WhatsApp Bot</h1>
                    </div>
                    
                    <div class="info-card">
                        <strong>📱 Authorized Number:</strong> +${ALLOWED_NUMBER}
                    </div>
                    
                    <div class="status ${isClientReady ? 'ready' : initializationError ? 'error' : 'initializing'} ${!isClientReady ? 'pulse' : ''}">
                        ${isClientReady ? '✅ Bot is Ready & Active!' : 
                          initializationError ? `❌ ${initializationError}` : 
                          '⏳ Initializing WhatsApp Client...'}
                    </div>
                    
                    <div id="status"></div>
                    
                    <div class="info-card">
                        <small>🔒 This bot only responds to the authorized number above.</small><br>
                        <small>🌐 Running on Render.com</small><br>
                        <small>⚡ Powered by Google Gemini AI</small>
                    </div>
                </div>
                
                <script>
                    let lastQrCode = '';
                    
                    setInterval(async () => {
                        try {
                            const response = await fetch('/status');
                            const data = await response.json();
                            let statusHtml = '';
                            
                            if (data.ready) {
                                statusHtml = '<div style="color: green; font-weight: bold; font-size: 18px;">✅ Bot is Active & Monitoring Messages</div>';
                            } else if (data.error) {
                                statusHtml = '<div style="color: red; font-weight: bold;">❌ ' + data.error + '</div>';
                            } else if (data.qr && data.qr !== lastQrCode) {
                                lastQrCode = data.qr;
                                statusHtml = '<div class="qr-code"><p><strong>📱 Scan this QR code with WhatsApp:</strong></p><p><small>Open WhatsApp → Settings → Linked Devices → Link a Device</small></p><img src="' + data.qr + '" alt="QR Code"></div>';
                            } else if (lastQrCode) {
                                statusHtml = '<div class="qr-code"><p><strong>📱 Scan this QR code with WhatsApp:</strong></p><p><small>Open WhatsApp → Settings → Linked Devices → Link a Device</small></p><img src="' + lastQrCode + '" alt="QR Code"></div>';
                            } else {
                                statusHtml = '<div style="color: orange;" class="pulse">⏳ Generating QR Code...</div>';
                            }
                            
                            document.getElementById('status').innerHTML = statusHtml;
                        } catch (error) {
                            console.error('Error fetching status:', error);
                            document.getElementById('status').innerHTML = '<div style="color: red;">❌ Connection Error - Retrying...</div>';
                        }
                    }, 3000);
                </script>
            </body>
        </html>
    `);
});

app.get('/status', (req, res) => {
    res.json({
        ready: isClientReady,
        qr: qrCodeString,
        authorizedNumber: ALLOWED_NUMBER,
        error: initializationError,
        connectionAttempts: connectionAttempts,
        environment: process.env.NODE_ENV || 'development'
    });
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        ready: isClientReady,
        authorizedNumber: ALLOWED_NUMBER,
        timestamp: new Date().toISOString(),
        error: initializationError,
        environment: process.env.NODE_ENV || 'development'
    });
});

// Initialize client after server starts
const initializeClient = async () => {
    try {
        console.log('🔄 Starting WhatsApp client initialization...');
        console.log(`Chrome executable path: ${getChromeExecutablePath()}`);
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`Google API Key configured: ${!!GOOGLE_API_KEY}`);
        
        await client.initialize();
        console.log('✅ Client initialization completed');
    } catch (error) {
        console.error('❌ Client initialization failed:', error);
        initializationError = error.message;
    }
};

// Start the server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📱 Authorized WhatsApp number: +${ALLOWED_NUMBER}`);
    
    // Initialize client after a short delay
    setTimeout(initializeClient, 2000);
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
    console.log(`🛑 Received ${signal}, shutting down gracefully...`);
    try {
        if (client && isClientReady) {
            await client.destroy();
            console.log('✅ WhatsApp client destroyed');
        }
    } catch (error) {
        console.error('Error during shutdown:', error);
    }
    process.exit(0);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    initializationError = 'Uncaught exception: ' + error.message;
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    initializationError = 'Unhandled rejection: ' + reason;
});
