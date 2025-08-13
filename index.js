// index.js
const wa = require('@open-wa/wa-automate');
const fetch = require('node-fetch');

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
// Start WhatsApp Bot
// ---------------------
wa.create({
    sessionId: "TermuxBot",
    multiDevice: true,        // Recommended for multi-device support
    headless: true,           // Run in background
    qrTimeout: 0,             // Wait indefinitely for QR scan
}).then(client => {
    console.log("✅ WhatsApp Bot Ready!");

    // Listen for incoming messages
    client.onMessage(async msg => {
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

            await client.sendText(msg.from, reply);

        } catch (err) {
            console.error("❌ Error:", err);
            await client.sendText(msg.from, "❌ Reply generate karte waqt error aayi.");
        }
    });
}).catch(err => {
    console.error("❌ Bot initialization failed:", err);
});
