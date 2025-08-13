const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fetch = require('node-fetch');

const GOOGLE_API_KEYS = [
    "AIzaSyA6Zh5GVB24w7bloM99lfgBhANbMeLO1SM",
    "AIzaSyA6Zh5GVB24w7bloM99lfgBhANbMeLO1SM"
];
let apiIndex = 0;

function getApiKey() {
    const key = GOOGLE_API_KEYS[apiIndex];
    apiIndex = (apiIndex + 1) % GOOGLE_API_KEYS.length;
    return key;
}

// Web server to keep Render alive
const app = express();
const PORT = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('✅ WhatsApp Bot Running!'));
app.listen(PORT, () => console.log(`🌐 Web server started on port ${PORT}`));

// WhatsApp client setup
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', qr => {
    console.log("📌 QR code scan karo:");
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ Bot Ready!');
});

client.on('message', async msg => {
    console.log(`📩 ${msg.from}: ${msg.body}`);

    const prompt = msg.body;
    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${getApiKey()}`,
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

        msg.reply(reply);
    } catch (err) {
        console.error("❌ Error:", err);
        msg.reply("❌ Reply generate karte waqt error aayi.");
    }
});

client.initialize();
