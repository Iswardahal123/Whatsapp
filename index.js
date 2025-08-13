const { Client, LocalAuth } = require('whatsapp-web.js');
const fetch = require('node-fetch');
const qrcode = require('qrcode');
const express = require('express');

// Google API keys (multiple)
const API_KEYS = [
    "KEY1",
    "KEY2",
    "KEY3"
];
let currentKeyIndex = 0;
function getApiKey() {
    const key = API_KEYS[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
    return key;
}

const app = express();
let qrImageData = null; // QR store karenge

const client = new Client({
    authStrategy: new LocalAuth()
});

client.on('qr', async qr => {
    console.log("📌 QR code ready, image generate ho rahi hai...");
    qrImageData = await qrcode.toDataURL(qr); // PNG base64
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

// QR serve karne ka route
app.get('/', (req, res) => {
    if (qrImageData) {
        res.send(`<img src="${qrImageData}" />`);
    } else {
        res.send("QR abhi ready nahi hai. Thoda wait karo...");
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🌐 Web server started on port ${PORT}`);
});

client.initialize();
