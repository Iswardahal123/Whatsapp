const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fetch = require('node-fetch');

// Yaha apni saari Google API keys add karo
const API_KEYS = [
    "AIzaSyA6Zh5GVB24w7bloM99lfgBhANbMeLO1SM",
    "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",
    
];

let currentKeyIndex = 0;

// WhatsApp Client setup
const client = new Client({
    authStrategy: new LocalAuth()
});

client.on('qr', qr => {
    console.log("📌 QR code scan karo:");
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ Bot Ready!');
});

async function getReplyFromGemini(prompt) {
    let reply = "⚠ Error: Koi reply nahi mila.";
    let triedKeys = 0;

    while (triedKeys < API_KEYS.length) {
        const apiKey = API_KEYS[currentKeyIndex];
        console.log(`🔑 Trying API Key: ${apiKey}`);

        try {
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

            if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
                reply = data.candidates[0].content.parts[0].text;
                break; // Success, loop se nikal jao
            } else {
                console.warn(`⚠ Key failed: ${apiKey}`);
            }
        } catch (err) {
            console.error(`❌ Error with key ${apiKey}:`, err);
        }

        // Next key try karo
        currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
        triedKeys++;
    }

    return reply;
}

client.on('message', async msg => {
    console.log(`📩 ${msg.from}: ${msg.body}`);
    const reply = await getReplyFromGemini(msg.body);
    msg.reply(reply);
});

client.initialize();
