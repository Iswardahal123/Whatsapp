// index.js
const wa = require('@open-wa/wa-automate');
const fetch = require('node-fetch');
const express = require('express');

// ---------------------
// Express Server Setup (Required for Render)
// ---------------------
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
    res.json({ 
        status: 'WhatsApp Bot is running!', 
        timestamp: new Date().toISOString() 
    });
});

// QR Code endpoint
app.get('/qr', (req, res) => {
    if (global.qrCode) {
        res.json({ qrCode: global.qrCode });
    } else {
        res.json({ message: 'QR Code not available yet' });
    }
});

// ---------------------
// Google API Keys (Use Environment Variables)
// ---------------------
const GOOGLE_API_KEYS = [
    process.env.GOOGLE_API_KEY_1 || "AIzaSyA6Zh5GVB24w7bloM99lfgBhANbMeLO1SM",
    process.env.GOOGLE_API_KEY_2 || "AIzaSyA6Zh5GVB24w7bloM99lfgBhANbMeLO1SM",
    process.env.GOOGLE_API_KEY_3 || "AIzaSyA6Zh5GVB24w7bloM99lfgBhANbMeLO1SM"
];
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
        const client = await wa.create({
            sessionId: "RenderBot",
            multiDevice: true,
            headless: true,
            qrTimeout: 0,
            authTimeout: 0,
            blockCrashLogs: true,
            disableSpins: true,
            hostNotificationLang: 'PT_BR',
            logConsole: false,
            popup: false,
            qrFormat: 'png',
            sessionDataPath: './session',
            // Render-specific configurations
            chromiumArgs: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu'
            ]
        });

        console.log("✅ WhatsApp Bot Ready!");

        // Handle QR Code for authentication
        client.onQr((qrData) => {
            global.qrCode = qrData;
            console.log("📱 QR Code received! Visit /qr endpoint to get it.");
        });

        // Handle authentication
        client.onAuthenticated(() => {
            console.log("🔐 WhatsApp Authenticated!");
            global.qrCode = null;
        });

        // Listen for incoming messages
        client.onMessage(async msg => {
            // Ignore messages from status updates and groups (optional)
            if (msg.isGroupMsg || msg.from === 'status@broadcast') {
                return;
            }

            console.log(`📩 ${msg.from}: ${msg.body}`);

            const prompt = msg.body.trim();
            
            // Ignore empty messages
            if (!prompt) return;

            try {
                const apiKey = getApiKey();
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
                        })
                    }
                );

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                let reply = "⚠ Error: No response received.";

                if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
                    reply = data.candidates[0].content.parts[0].text;
                } else if (data?.error) {
                    reply = `❌ API Error: ${data.error.message}`;
                }

                await client.sendText(msg.from, reply);

            } catch (err) {
                console.error("❌ Error:", err);
                await client.sendText(msg.from, "❌ Sorry, there was an error processing your message.");
            }
        });

        // Handle disconnection
        client.onStateChanged((state) => {
            console.log('📱 WhatsApp State:', state);
            if (state === 'CONFLICT' || state === 'DISCONNECTED') {
                console.log('🔄 Attempting to restart...');
            }
        });

    } catch (err) {
        console.error("❌ Bot initialization failed:", err);
        // Restart after 30 seconds
        setTimeout(() => {
            console.log("🔄 Restarting bot...");
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
    
    // Start WhatsApp bot AFTER server is running
    startBot();
});

// Handle process termination
process.on('SIGINT', () => {
    console.log('👋 Bot shutting down...');
    server.close(() => {
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log('👋 Bot shutting down...');
    server.close(() => {
        process.exit(0);
    });
});        });

        // Handle authentication
        client.onAuthenticated(() => {
            console.log("🔐 WhatsApp Authenticated!");
            global.qrCode = null;
        });

        // Listen for incoming messages
        client.onMessage(async msg => {
            // Ignore messages from status updates and groups (optional)
            if (msg.isGroupMsg || msg.from === 'status@broadcast') {
                return;
            }

            console.log(`📩 ${msg.from}: ${msg.body}`);

            const prompt = msg.body.trim();
            
            // Ignore empty messages
            if (!prompt) return;

            try {
                const apiKey = getApiKey();
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
                        })
                    }
                );

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                let reply = "⚠ Error: No response received.";

                if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
                    reply = data.candidates[0].content.parts[0].text;
                } else if (data?.error) {
                    reply = `❌ API Error: ${data.error.message}`;
                }

                await client.sendText(msg.from, reply);

            } catch (err) {
                console.error("❌ Error:", err);
                await client.sendText(msg.from, "❌ Sorry, there was an error processing your message.");
            }
        });

        // Handle disconnection
        client.onStateChanged((state) => {
            console.log('📱 WhatsApp State:', state);
            if (state === 'CONFLICT' || state === 'DISCONNECTED') {
                console.log('🔄 Attempting to restart...');
            }
        });

    } catch (err) {
        console.error("❌ Bot initialization failed:", err);
        // Restart after 30 seconds
        setTimeout(() => {
            console.log("🔄 Restarting bot...");
            startBot();
        }, 30000);
    }
}

// Start the bot (this will be called after Express server starts)
// startBot(); // Removed from here - now called after server starts

// Handle process termination
process.on('SIGINT', () => {
    console.log('👋 Bot shutting down...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('👋 Bot shutting down...');
    process.exit(0);
});    console.log(`📡 Health check: http://0.0.0.0:${PORT}/`);
    console.log(`📱 QR Code: http://0.0.0.0:${PORT}/qr`);
});

// ---------------------
// Google API Keys (Use Environment Variables)
// ---------------------
const GOOGLE_API_KEYS = [
    process.env.GOOGLE_API_KEY_1 || "AIzaSyA6Zh5GVB24w7bloM99lfgBhANbMeLO1SM",
    process.env.GOOGLE_API_KEY_2 || "AIzaSyA6Zh5GVB24w7bloM99lfgBhANbMeLO1SM",
    process.env.GOOGLE_API_KEY_3 || "AIzaSyA6Zh5GVB24w7bloM99lfgBhANbMeLO1SM"
];
let currentKeyIndex = 0;

function getApiKey() {
    const key = GOOGLE_API_KEYS[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % GOOGLE_API_KEYS.length;
    return key;
}

// ---------------------
// Start WhatsApp Bot
// ---------------------
async function startBot() {
    try {
        const client = await wa.create({
            sessionId: "RenderBot",
            multiDevice: true,
            headless: true,
            qrTimeout: 0,
            authTimeout: 0,
            blockCrashLogs: true,
            disableSpins: true,
            hostNotificationLang: 'PT_BR',
            logConsole: false,
            popup: false,
            qrFormat: 'png',
            sessionDataPath: './session',
            // Render-specific configurations
            chromiumArgs: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu'
            ]
        });

        console.log("✅ WhatsApp Bot Ready!");

        // Handle QR Code for authentication
        client.onQr((qrData) => {
            global.qrCode = qrData;
            console.log("📱 QR Code received! Visit /qr endpoint to get it.");
        });

        // Handle authentication
        client.onAuthenticated(() => {
            console.log("🔐 WhatsApp Authenticated!");
            global.qrCode = null;
        });

        // Listen for incoming messages
        client.onMessage(async msg => {
            // Ignore messages from status updates and groups (optional)
            if (msg.isGroupMsg || msg.from === 'status@broadcast') {
                return;
            }

            console.log(`📩 ${msg.from}: ${msg.body}`);

            const prompt = msg.body.trim();
            
            // Ignore empty messages
            if (!prompt) return;

            try {
                const apiKey = getApiKey();
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
                        })
                    }
                );

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                let reply = "⚠ Error: No response received.";

                if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
                    reply = data.candidates[0].content.parts[0].text;
                } else if (data?.error) {
                    reply = `❌ API Error: ${data.error.message}`;
                }

                await client.sendText(msg.from, reply);

            } catch (err) {
                console.error("❌ Error:", err);
                await client.sendText(msg.from, "❌ Sorry, there was an error processing your message.");
            }
        });

        // Handle disconnection
        client.onStateChanged((state) => {
            console.log('📱 WhatsApp State:', state);
            if (state === 'CONFLICT' || state === 'DISCONNECTED') {
                console.log('🔄 Attempting to restart...');
            }
        });

    } catch (err) {
        console.error("❌ Bot initialization failed:", err);
        // Restart after 30 seconds
        setTimeout(() => {
            console.log("🔄 Restarting bot...");
            startBot();
        }, 30000);
    }
}

// Start the bot
startBot();

// Handle process termination
process.on('SIGINT', () => {
    console.log('👋 Bot shutting down...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('👋 Bot shutting down...');
    process.exit(0);
});            if (msg.isGroupMsg || msg.from === 'status@broadcast') {
                return;
            }

            console.log(`📩 ${msg.from}: ${msg.body}`);

            const prompt = msg.body.trim();
            
            // Ignore empty messages
            if (!prompt) return;

            try {
                const apiKey = getApiKey();
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
                        })
                    }
                );

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                let reply = "⚠ Error: No response received.";

                if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
                    reply = data.candidates[0].content.parts[0].text;
                } else if (data?.error) {
                    reply = `❌ API Error: ${data.error.message}`;
                }

                await client.sendText(msg.from, reply);

            } catch (err) {
                console.error("❌ Error:", err);
                await client.sendText(msg.from, "❌ Sorry, there was an error processing your message.");
            }
        });

        // Handle disconnection
        client.onStateChanged((state) => {
            console.log('📱 WhatsApp State:', state);
            if (state === 'CONFLICT' || state === 'DISCONNECTED') {
                console.log('🔄 Attempting to restart...');
            }
        });

    } catch (err) {
        console.error("❌ Bot initialization failed:", err);
        // Restart after 30 seconds
        setTimeout(() => {
            console.log("🔄 Restarting bot...");
            startBot();
        }, 30000);
    }
}

// Start the bot
startBot();

// Handle process termination
process.on('SIGINT', () => {
    console.log('👋 Bot shutting down...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('👋 Bot shutting down...');
    process.exit(0);
});
