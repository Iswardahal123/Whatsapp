// index.js
const wa = require('@open-wa/wa-automate');
const fetch = require('node-fetch');
const express = require('express');
const QRCode = require('qrcode');

// ---------------------
// Express Server Setup (Required for Render)
// ---------------------
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Global variables for bot status
global.qrCode = null;
global.authenticated = false;
global.botReady = false;
global.botClient = null;

// Health check endpoint with better styling
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>WhatsApp Gemini Bot</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body { 
                    font-family: Arial, sans-serif; 
                    text-align: center; 
                    padding: 20px;
                    background: linear-gradient(135deg, #25D366, #128C7E);
                    color: white;
                    min-height: 100vh;
                    margin: 0;
                }
                .container {
                    background: rgba(255,255,255,0.1);
                    border-radius: 15px;
                    padding: 40px;
                    margin: 20px auto;
                    max-width: 600px;
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255,255,255,0.2);
                }
                h1 { font-size: 2.5em; margin-bottom: 10px; }
                .status { font-size: 1.2em; margin: 20px 0; }
                .timestamp { opacity: 0.8; font-size: 0.9em; }
                .button {
                    display: inline-block;
                    background: white;
                    color: #25D366;
                    text-decoration: none;
                    padding: 15px 30px;
                    border-radius: 25px;
                    font-weight: bold;
                    margin: 10px;
                    transition: transform 0.2s;
                }
                .button:hover { transform: scale(1.05); }
                .status-indicator {
                    display: inline-block;
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    margin-right: 8px;
                    background-color: ${global.botReady ? '#4CAF50' : '#FFC107'};
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🤖 WhatsApp Gemini Bot</h1>
                <div class="status">
                    <span class="status-indicator"></span>
                    ${global.botReady ? '✅ Bot is ready!' : '🔄 Bot is initializing...'}
                </div>
                <div class="timestamp">Server started: ${new Date().toISOString()}</div>
                
                <div style="margin-top: 30px;">
                    <a href="/qr" class="button">📱 Get QR Code</a>
                    <a href="/status" class="button">📊 Bot Status</a>
                </div>
                
                <div style="margin-top: 30px; opacity: 0.9; font-size: 0.9em;">
                    <p>🔗 ${global.authenticated ? 'WhatsApp Connected!' : 'Scan QR code to connect WhatsApp'}</p>
                    <p>🤖 Send any message to get AI responses powered by Google Gemini</p>
                </div>
            </div>
        </body>
        </html>
    `);
});

// Bot status endpoint
app.get('/status', (req, res) => {
    res.json({
        status: global.botReady ? 'ready' : 'initializing',
        timestamp: new Date().toISOString(),
        qrCodeAvailable: !!global.qrCode,
        authenticated: global.authenticated,
        botReady: global.botReady,
        uptime: process.uptime()
    });
});

// QR Code endpoint with HTML display
app.get('/qr', async (req, res) => {
    if (global.qrCode) {
        try {
            // Generate QR code as data URL
            const qrDataURL = await QRCode.toDataURL(global.qrCode);
            
            res.send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>WhatsApp Bot QR Code</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <meta http-equiv="refresh" content="30">
                    <style>
                        body { 
                            font-family: Arial, sans-serif; 
                            text-align: center; 
                            padding: 20px;
                            background-color: #f5f5f5;
                        }
                        .container {
                            background: white;
                            border-radius: 10px;
                            padding: 30px;
                            margin: 20px auto;
                            max-width: 500px;
                            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                        }
                        .qr-code {
                            max-width: 300px;
                            margin: 20px auto;
                            padding: 20px;
                            background: white;
                            border-radius: 10px;
                            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                        }
                        h1 { color: #25D366; }
                        .instructions {
                            background: #e7f5e7;
                            padding: 15px;
                            border-radius: 5px;
                            margin: 20px 0;
                            text-align: left;
                        }
                        .refresh-info {
                            background: #fff3cd;
                            border: 1px solid #ffeaa7;
                            color: #856404;
                            padding: 10px;
                            border-radius: 5px;
                            margin: 15px 0;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>📱 WhatsApp Bot QR Code</h1>
                        <div class="qr-code">
                            <img src="${qrDataURL}" alt="QR Code" style="max-width: 100%; height: auto;">
                        </div>
                        <div class="instructions">
                            <h3>How to connect:</h3>
                            <ol>
                                <li>Open WhatsApp on your phone</li>
                                <li>Go to <strong>Settings</strong> > <strong>Linked Devices</strong></li>
                                <li>Tap <strong>"Link a Device"</strong></li>
                                <li>Scan this QR code with your phone</li>
                            </ol>
                        </div>
                        <div class="refresh-info">
                            <strong>⚠️ Auto-refresh:</strong> This page refreshes every 30 seconds
                        </div>
                        <button onclick="location.reload()" style="
                            background: #25D366; 
                            color: white; 
                            border: none; 
                            padding: 10px 20px; 
                            border-radius: 5px; 
                            cursor: pointer;
                            font-size: 16px;
                        ">🔄 Refresh Now</button>
                    </div>
                </body>
                </html>
            `);
        } catch (error) {
            console.error('Error generating QR code:', error);
            res.status(500).send('Error generating QR code');
        }
    } else {
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>WhatsApp Bot - No QR Code</title>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <meta http-equiv="refresh" content="10">
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        text-align: center; 
                        padding: 20px;
                        background-color: #f5f5f5;
                    }
                    .container {
                        background: white;
                        border-radius: 10px;
                        padding: 30px;
                        margin: 20px auto;
                        max-width: 500px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    }
                    .status {
                        font-size: 1.1em;
                        margin: 20px 0;
                        color: ${global.authenticated ? '#4CAF50' : '#FF9800'};
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>📱 WhatsApp Bot</h1>
                    <div class="status">
                        ${global.authenticated ? '✅ Already authenticated!' : '🔄 Waiting for QR code...'}
                    </div>
                    <p>Current status:</p>
                    <ul style="text-align: left; display: inline-block;">
                        <li>Bot Ready: ${global.botReady ? '✅' : '❌'}</li>
                        <li>Authenticated: ${global.authenticated ? '✅' : '❌'}</li>
                        <li>QR Available: ${global.qrCode ? '✅' : '❌'}</li>
                    </ul>
                    <div style="margin-top: 20px;">
                        <p><em>This page refreshes automatically every 10 seconds</em></p>
                        <button onclick="location.reload()" style="
                            background: #25D366; 
                            color: white; 
                            border: none; 
                            padding: 10px 20px; 
                            border-radius: 5px; 
                            cursor: pointer;
                            font-size: 16px;
                        ">🔄 Refresh Now</button>
                    </div>
                </div>
            </body>
            </html>
        `);
    }
});

// ---------------------
// Google API Keys (Use Environment Variables)
// ---------------------
const GOOGLE_API_KEYS = [
    process.env.GOOGLE_API_KEY_1,
    process.env.GOOGLE_API_KEY_2,
    process.env.GOOGLE_API_KEY_3
].filter(key => key); // Remove undefined keys

// Fallback API key if no environment variables are set
if (GOOGLE_API_KEYS.length === 0) {
    console.warn('⚠️ No GOOGLE_API_KEY environment variables found. Please set them in Render dashboard.');
    GOOGLE_API_KEYS.push('PLACEHOLDER_KEY'); // This will cause API calls to fail gracefully
}

let currentKeyIndex = 0;

function getApiKey() {
    const key = GOOGLE_API_KEYS[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % GOOGLE_API_KEYS.length;
    return key;
}

// ---------------------
// WhatsApp Bot Functions
// ---------------------
async function startBot() {
    try {
        console.log('🤖 Initializing WhatsApp bot...');
        
        // Try to find Chrome executable
        const possiblePaths = [
            process.env.PUPPETEER_EXECUTABLE_PATH,
            process.env.CHROME_BIN,
            '/usr/bin/google-chrome-stable',
            '/usr/bin/google-chrome',
            '/usr/bin/chromium-browser',
            '/usr/bin/chromium'
        ].filter(Boolean);

        let chromePath = null;
        for (const path of possiblePaths) {
            try {
                const fs = require('fs');
                if (fs.existsSync(path)) {
                    chromePath = path;
                    console.log(`✅ Found Chrome at: ${path}`);
                    break;
                }
            } catch (err) {
                // Continue trying other paths
            }
        }

        if (!chromePath) {
            console.log('⚠️ No Chrome found, using default Puppeteer');
        }
        
        const client = await wa.create({
            sessionId: "RenderBot",
            multiDevice: true,
            headless: "new",
            qrTimeout: 0,
            authTimeout: 0,
            blockCrashLogs: true,
            disableSpins: true,
            hostNotificationLang: 'en',
            logConsole: false,
            popup: false,
            qrFormat: 'terminal',
            sessionDataPath: './session',
            useChrome: !!chromePath,
            executablePath: chromePath,
            chromiumArgs: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--disable-features=TranslateUI,VizDisplayCompositor',
                '--disable-ipc-flooding-protection',
                '--memory-pressure-off',
                '--max_old_space_size=4096',
                '--disable-extensions',
                '--disable-plugins',
                '--disable-images',
                '--disable-javascript',
                '--disable-default-apps',
                '--disable-sync'
            ],
            // Add Puppeteer launch options for better Render compatibility
            puppeteerOptions: {
                headless: "new",
                executablePath: chromePath,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process',
                    '--disable-gpu',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor',
                    '--memory-pressure-off'
                ]
            }
        });

        global.botClient = client;
        console.log("✅ WhatsApp Bot initialized!");

        // Handle QR Code for authentication
        client.onQr((qrData) => {
            console.log("📱 QR Code received! Visit /qr endpoint to scan it.");
            global.qrCode = qrData;
            global.authenticated = false;
        });

        // Handle authentication
        client.onAuthenticated(() => {
            console.log("🔐 WhatsApp Authenticated!");
            global.qrCode = null;
            global.authenticated = true;
        });

        // Handle when bot is ready
        client.onReady(() => {
            console.log("🎉 WhatsApp Bot is fully ready!");
            global.botReady = true;
        });

        // Listen for incoming messages
        client.onMessage(async (msg) => {
            // Ignore messages from status updates and groups (optional)
            if (msg.isGroupMsg || msg.from === 'status@broadcast') {
                return;
            }

            console.log(`📩 Message from ${msg.from}: ${msg.body}`);

            const prompt = msg.body.trim();
            
            // Ignore empty messages or commands
            if (!prompt || prompt.startsWith('/')) return;

            try {
                const apiKey = getApiKey();
                
                if (apiKey === 'PLACEHOLDER_KEY') {
                    await client.sendText(msg.from, "❌ Bot configuration error: No valid API key found. Please contact the administrator.");
                    return;
                }

                console.log('🤖 Generating AI response...');
                
                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: prompt }] }],
                            generationConfig: {
                                temperature: 0.7,
                                topK: 40,
                                topP: 0.95,
                                maxOutputTokens: 1024,
                            }
                        }),
                        timeout: 30000 // 30 second timeout
                    }
                );

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`API Error ${response.status}:`, errorText);
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();
                let reply = "⚠️ Sorry, I couldn't generate a response.";

                if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
                    reply = data.candidates[0].content.parts[0].text;
                } else if (data?.error) {
                    reply = `❌ API Error: ${data.error.message}`;
                    console.error('Gemini API Error:', data.error);
                }

                console.log('✅ Sending AI response');
                await client.sendText(msg.from, reply);

            } catch (err) {
                console.error("❌ Error processing message:", err);
                
                let errorMsg = "❌ Sorry, I encountered an error processing your message.";
                
                if (err.message.includes('timeout')) {
                    errorMsg = "⏱️ Request timed out. Please try again with a shorter message.";
                } else if (err.message.includes('quota')) {
                    errorMsg = "📊 API quota exceeded. Please try again later.";
                }
                
                try {
                    await client.sendText(msg.from, errorMsg);
                } catch (sendErr) {
                    console.error("❌ Failed to send error message:", sendErr);
                }
            }
        });

        // Handle disconnection
        client.onStateChanged((state) => {
            console.log('📱 WhatsApp State changed:', state);
            if (state === 'CONFLICT') {
                console.log('⚠️ WhatsApp Web session conflict detected');
            } else if (state === 'DISCONNECTED') {
                console.log('🔄 WhatsApp disconnected, will attempt to reconnect...');
                global.authenticated = false;
                global.botReady = false;
            }
        });

        return client;

    } catch (err) {
        console.error("❌ Bot initialization failed:", err);
        global.botReady = false;
        global.authenticated = false;
        
        // Restart after delay
        console.log("🔄 Restarting bot in 30 seconds...");
        setTimeout(() => {
            startBot();
        }, 30000);
    }
}

// ---------------------
// Start Express Server FIRST (Critical for Render)
// ---------------------
const server = app.listen(PORT, '0.0.0.0', (err) => {
    if (err) {
        console.error('❌ Failed to start server:', err);
        process.exit(1);
    }
    console.log(`🚀 Express server running on 0.0.0.0:${PORT}`);
    console.log(`📡 Health check: http://0.0.0.0:${PORT}/`);
    console.log(`📱 QR Code: http://0.0.0.0:${PORT}/qr`);
    console.log(`📊 Status: http://0.0.0.0:${PORT}/status`);
    
    // Start WhatsApp bot AFTER server is running
    setTimeout(() => {
        startBot();
    }, 2000); // Give server time to fully start
});

// Graceful shutdown
function gracefulShutdown(signal) {
    console.log(`\n👋 Received ${signal}, shutting down gracefully...`);
    
    if (global.botClient) {
        try {
            global.botClient.kill();
        } catch (err) {
            console.error('Error closing WhatsApp client:', err);
        }
    }
    
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
    
    // Force exit after 10 seconds
    setTimeout(() => {
        console.log('⚠️ Forcing exit after 10 seconds');
        process.exit(1);
    }, 10000);
}

// Handle process termination
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle unhandled errors
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection:', reason);
    // Don't crash the process for unhandled rejections
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});
