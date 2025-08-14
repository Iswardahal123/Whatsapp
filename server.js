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
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || 'AIzaSyA6Zh5GVB24w7bloM99lfgBhANbMeLO1SM';

// WhatsApp Client Setup with Render-compatible config
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "whatsapp-bot-render"
    }),
    puppeteer: {
        headless: true,
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
            '--max_old_space_size=4096'
        ],
        executablePath: process.env.GOOGLE_CHROME_BIN || undefined
    }
});

// Store QR code and client state
let qrCodeString = '';
let isClientReady = false;
let initializationError = null;

// WhatsApp Client Events
client.on('qr', async (qr) => {
    console.log('QR Code received');
    try {
        qrCodeString = await qrcode.toDataURL(qr);
    } catch (error) {
        console.error('Error generating QR code:', error);
    }
});

client.on('ready', () => {
    console.log('WhatsApp Client is ready!');
    isClientReady = true;
    initializationError = null;
});

client.on('authenticated', () => {
    console.log('WhatsApp Client authenticated');
});

client.on('auth_failure', (msg) => {
    console.error('Authentication failed:', msg);
    initializationError = 'Authentication failed';
});

client.on('disconnected', (reason) => {
    console.log('WhatsApp Client was logged out:', reason);
    isClientReady = false;
});

// Message handler - Only respond to specific number
client.on('message', async (message) => {
    try {
        const chat = await message.getChat();
        const contact = await message.getContact();
        
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
                <title>Personal WhatsApp Bot</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        text-align: center; 
                        margin: 0;
                        padding: 20px;
                        background-color: #f0f0f0;
                    }
                    .container {
                        max-width: 600px;
                        margin: 0 auto;
                        background: white;
                        padding: 30px;
                        border-radius: 10px;
                        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                    }
                    .status {
                        padding: 15px;
                        border-radius: 5px;
                        margin: 20px 0;
                    }
                    .ready { background-color: #d4edda; color: #155724; }
                    .initializing { background-color: #fff3cd; color: #856404; }
                    .error { background-color: #f8d7da; color: #721c24; }
                    .qr-code {
                        margin: 20px 0;
                        padding: 20px;
                        border: 1px solid #ddd;
                        border-radius: 8px;
                        background: #f8f9fa;
                    }
                    .qr-code img {
                        max-width: 300px;
                        width: 100%;
                        height: auto;
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
                    <h1>🤖 Personal WhatsApp Bot</h1>
                    <p><strong>Authorized Number:</strong> +${ALLOWED_NUMBER}</p>
                    <div class="status ${isClientReady ? 'ready' : initializationError ? 'error' : 'initializing'}">
                        ${isClientReady ? '✅ Bot is Ready!' : 
                          initializationError ? `❌ ${initializationError}` : 
                          '⏳ Initializing...'}
                    </div>
                    <div id="status"></div>
                    <p><small>This bot only responds to the authorized number above.</small></p>
                    ${process.env.NODE_ENV === 'production' ? 
                        '<p><small>Running on Render.com</small>' : ''}
                </div>
                
                <script>
                    setInterval(async () => {
                        try {
                            const response = await fetch('/status');
                            const data = await response.json();
                            let statusHtml = '';
                            
                            if (data.ready) {
                                statusHtml = '<p style="color: green; font-weight: bold;">✅ Bot is Active</p>';
                            } else if (data.error) {
                                statusHtml = '<p style="color: red; font-weight: bold;">❌ ' + data.error + '</p>';
                            } else if (data.qr) {
                                statusHtml = '<div class="qr-code"><p><strong>Scan this QR code with WhatsApp:</strong></p><img src="' + data.qr + '" alt="QR Code"></div>';
                            } else {
                                statusHtml = '<p style="color: orange;">⏳ Starting up...</p>';
                            }
                            
                            document.getElementById('status').innerHTML = statusHtml;
                        } catch (error) {
                            console.error('Error fetching status:', error);
                            document.getElementById('status').innerHTML = '<p style="color: red;">❌ Connection Error</p>';
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
        error: initializationError
    });
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        ready: isClientReady,
        authorizedNumber: ALLOWED_NUMBER,
        timestamp: new Date().toISOString(),
        error: initializationError
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📱 Authorized WhatsApp number: +${ALLOWED_NUMBER}`);
    console.log('🔄 Initializing WhatsApp client...');
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    
    // Initialize WhatsApp client with error handling
    setTimeout(() => {
        client.initialize().catch(error => {
            console.error('❌ Bot initialization failed:', error);
            initializationError = error.message;
        });
    }, 2000);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('🛑 Shutting down gracefully...');
    try {
        if (client) {
            await client.destroy();
            console.log('✅ WhatsApp client destroyed');
        }
    } catch (error) {
        console.error('Error during shutdown:', error);
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('🛑 Shutting down gracefully...');
    try {
        if (client) {
            await client.destroy();
            console.log('✅ WhatsApp client destroyed');
        }
    } catch (error) {
        console.error('Error during shutdown:', error);
    }
    process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
