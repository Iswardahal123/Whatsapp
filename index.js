// index.js
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fetch = require('node-fetch');

// Yaha apne multiple Google API keys daal do
const GOOGLE_API_KEYS = [
    "AIzaSyA6Zh5GVB24w7bloM99lfgBhANbMeLO1SM",
    "AIzaSyA6Zh5GVB24w7bloM99lfgBhANbMeLO1SM",
    "AIzaSyA6Zh5GVB24w7bloM99lfgBhANbMeLO1SM"
];
let currentKeyIndex = 0;

// API key rotate function
function getApiKey() {
    const key = GOOGLE_API_KEYS[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % GOOGLE_API_KEYS.length;
    return key;
}

// WhatsApp Client Setup (Termux Safe)
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// QR Generate
client.on('qr', qr => {
    console.log("📌 QR code scan karo:");
    qrcode.generate(qr, { small: true });
});

// Bot Ready
client.on('ready', () => {
    console.log('✅ WhatsApp Bot Ready!');
});

// Message Listener
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

client.initialize();
