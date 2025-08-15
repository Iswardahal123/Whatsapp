// index.js
const wa = require('@open-wa/wa-automate');
const fetch = require('node-fetch');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Google API Keys
const GOOGLE_API_KEYS = [
    "AIzaSyA6Zh5GVB24w7bloM99lfgBhANbMeLO1SM"
];
let currentKeyIndex = 0;
function getApiKey() {
    const key = GOOGLE_API_KEYS[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % GOOGLE_API_KEYS.length;
    return key;
}

// Online status tracking
let isOwnerOnline = false;
const OWNER_NUMBER = "91xxxxxxxxxx@c.us"; // अपना नंबर यहाँ डाल (country code के साथ)

// Express routes
app.get('/', (req, res) => {
    res.send('<h1>🤖 WhatsApp AI Assistant Running with Pairing Code</h1>');
});

// Start bot
async function startBot() {
    try {
        const client = await wa.create({
            sessionId: "RenderBot",
            multiDevice: true,
            headless: true,
            pairingCode: true, // Pairing code mode
            authTimeout: 0,
            blockCrashLogs: true,
            disableSpins: true,
            logConsole: false,
            popup: false,
            useChrome: true,
            executablePath: '/usr/bin/google-chrome-stable', // Render/Server path
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        console.log("✅ WhatsApp Bot Ready! Waiting for pairing code...");

        // Listen for pairing code
        client.onPairingCode((code) => {
            console.log(`📟 Your WhatsApp Pairing Code: ${code}`);
        });

        // Track presence of owner
        client.onPresenceChanged(async (presence) => {
            if (presence.id._serialized === OWNER_NUMBER) {
                isOwnerOnline = presence.isOnline;
                console.log(`📶 Owner online status: ${isOwnerOnline}`);
            }
        });

        // Message handler
        client.onMessage(async (msg) => {
            if (msg.from === OWNER_NUMBER) return; // अपने मैसेज को ignore करो
            if (isOwnerOnline) return; // Owner online है तो reply मत करो

            const prompt = msg.body.trim();
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

                const data = await response.json();
                let reply = "⚠ Error: No response received.";
                if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
                    reply = data.candidates[0].content.parts[0].text;
                }
                await client.sendText(msg.from, reply);

            } catch (err) {
                console.error("❌ Error:", err);
                await client.sendText(msg.from, "❌ Sorry, there was an error processing your message.");
            }
        });

    } catch (err) {
        console.error("❌ Bot initialization failed:", err);
        setTimeout(startBot, 30000);
    }
}

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    startBot();
});
