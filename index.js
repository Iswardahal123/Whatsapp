// index.js
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fetch = require('node-fetch');
const os = require('os');
const fs = require('fs');
const path = require('path');

// ---------------------
// Google API Keys
// ---------------------
const GOOGLE_API_KEYS = [
    "AIzaSyA6Zh5GVB24w7bloM99lfgBhANbMeLO1SM",
    "AIzaSyA6Zh5GVB24w7bloM99lfgBhANbMeLO1SM",
    "AIzaSyA6Zh5GVB24w7bloM99lfgBhANbMeLO1SM"
];
let currentKeyIndex = 0;

function getApiKey() {
    const key = GOOGLE_API_KEYS[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % GOOGLE_API_KEYS.length;
    return key;
}

// ---------------------
// Puppeteer Chromium Path for Termux
// ---------------------
let chromiumPath;
if (os.platform() === 'android') {
    chromiumPath = '/data/data/com.termux/files/usr/bin/chromium';
    if (!fs.existsSync(chromiumPath)) {
        console.error("❌ Chromium nahi mila. Install karo: pkg install chromium");
        process.exit(1);
    }
} else {
    chromiumPath = undefined; // Default path for other OS
}

// ---------------------
// WhatsApp Client
// ---------------------
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        executablePath: chromiumPath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    }
});

// ---------------------
// QR Code
// ---------------------
client.on('qr', qr => {
    console.log("📌 QR code scan karo:");
    qrcode.generate(qr, { small: true });
});

// ---------------------
// Bot Ready
// ---------------------
client.on('ready', () => {
    console.log('✅ WhatsApp Bot Ready!');
});

// ---------------------
// Message Listener
// ---------------------
client.on('message', async msg => {
    console.log(`📩 ${msg.from}: ${msg.body}`);

    const prompt = msg.body;
    try {
        const apiKey = getApiKey();
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            }
        );

        const data = await response.json();
        let reply = "⚠ Error: Koi reply nahi mila.";

        if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
            reply = data.candidates[0].content.parts[0].text;
        }

        await msg.reply(reply);

    } catch (err) {
        console.error("❌ Error:", err);
        await msg.reply("❌ Reply generate karte waqt error aayi.");
    }
});

// ---------------------
// Initialize Client
// ---------------------
client.initialize();
