// server.js
const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const { google } = require('googleapis');
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

// WhatsApp Client Setup
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "whatsapp-bot-simple"
    }),
    puppeteer: {
        headless: "new",
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
            '--disable-features=VizDisplayCompositor'
        ]
    }
});

// Store QR code and client state
let qrCodeString = '';
let isClientReady = false;

// WhatsApp Client Events
client.on('qr', async (qr) => {
    console.log('QR Code received');
    qrCodeString = await qrcode.toDataURL(qr);
});

client.on('ready', () => {
    console.log('WhatsApp Client is ready!');
    isClientReady = true;
});

client.on('authenticated', () => {
    console.log('WhatsApp Client authenticated');
});

client.on('auth_failure', (msg) => {
    console.error('Authentication failed:', msg);
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
                }
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
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        text-align: center; 
                        margin-top: 50px; 
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
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>🤖 Personal WhatsApp Bot</h1>
                    <p><strong>Authorized Number:</strong> +${ALLOWED_NUMBER}</p>
                    <div class="status ${isClientReady ? 'ready' : 'initializing'}">
                        ${isClientReady ? '✅ Bot is Ready!' : '⏳ Initializing...'}
                    </div>
                    <div id="status"></div>
                    <p><small>This bot only responds to the authorized number above.</small></p>
                </div>
                
                <script>
                    setInterval(async () => {
                        try {
                            const response = await fetch('/status');
                            const data = await response.json();
                            document.getElementById('status').innerHTML = 
                                data.ready ? '<p style="color: green; font-weight: bold;">✅ Bot is Active</p>' : 
                                data.qr ? '<div><p><strong>Scan this QR code with WhatsApp:</strong></p><img src="' + data.qr + '" alt="QR Code" style="max-width: 300px; border: 1px solid #ddd; padding: 10px;"></div>' :
                                '<p style="color: orange;">⏳ Starting up...</p>';
                        } catch (error) {
                            console.error('Error fetching status:', error);
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
        authorizedNumber: ALLOWED_NUMBER
    });
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        ready: isClientReady,
        authorizedNumber: ALLOWED_NUMBER,
        timestamp: new Date().toISOString()
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📱 Authorized WhatsApp number: +${ALLOWED_NUMBER}`);
    console.log('🔄 Initializing WhatsApp client...');
    
    // Initialize WhatsApp client with error handling
    client.initialize().catch(error => {
        console.error('❌ Bot initialization failed:', error);
    });
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('🛑 Shutting down gracefully...');
    try {
        await client.destroy();
        console.log('✅ WhatsApp client destroyed');
    } catch (error) {
        console.error('Error during shutdown:', error);
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('🛑 Shutting down gracefully...');
    try {
        await client.destroy();
        console.log('✅ WhatsApp client destroyed');
    } catch (error) {
        console.error('Error during shutdown:', error);
    }
    process.exit(0);
});
