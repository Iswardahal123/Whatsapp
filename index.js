// index.js
const wa = require('@open-wa/wa-automate');
const fetch = require('node-fetch');
const express = require('express');

// ---------------------
// Express Server Setup
// ---------------------
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>WhatsApp Gemini Bot</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 20px; background: linear-gradient(135deg, #25D366, #128C7E); color: white; min-height:100vh; margin:0; }
                .container { background: rgba(255,255,255,0.1); border-radius: 15px; padding: 40px; margin: 20px auto; max-width:600px; backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.2); }
                h1 { font-size: 2.5em; margin-bottom: 10px; }
                .status { font-size:1.2em; margin: 20px 0; }
                .timestamp { opacity: 0.8; font-size: 0.9em; }
                .button { display: inline-block; background: white; color: #25D366; text-decoration:none; padding:15px 30px; border-radius:25px; font-weight:bold; margin:10px; transition: transform 0.2s; }
                .button:hover { transform: scale(1.05); }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🤖 WhatsApp Gemini Bot</h1>
                <div class="status">✅ Bot is running successfully!</div>
                <div class="timestamp">Started: ${new Date().toISOString()}</div>
                <div style="margin-top: 30px;">
                    <a href="/qr" class="button">📱 Get QR Code</a>
                    <a href="/status" class="button">📊 Bot Status</a>
                </div>
                <div style="margin-top:30px; opacity:0.9; font-size:0.9em;">
                    <p>🔗 Scan the QR code to connect your WhatsApp</p>
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
        status: 'running',
        timestamp: new Date().toISOString(),
        qrCodeAvailable: !!global.qrCode,
        authenticated: global.authenticated || false,
        botReady: global.botReady || false
    });
});

// QR Code endpoint
app.get('/qr', (req, res) => {
    if (global.qrCode) {
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>WhatsApp Bot QR Code</title>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; padding: 20px; background-color:#f5f5f5; }
                    .container { background:white; border-radius:10px; padding:30px; margin:20px auto; max-width:500px; box-shadow:0 2px 10px rgba(0,0,0,0.1); }
                    .qr-code { max-width:300px; margin:20px auto; padding:20px; background:white; border-radius:10px; box-shadow:0 2px 5px rgba(0,0,0,0.1); }
                    h1 { color: #25D366; }
                    .instructions { background:#e7f5e7; padding:15px; border-radius:5px; margin:20px 0; text-align:left; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>📱 WhatsApp Bot QR Code</h1>
                    <div class="qr-code">
                        <img src="data:image/png;base64,${global.qrCode}" alt="QR Code" style="max-width:100%;height:auto;">
                    </div>
                    <div class="instructions">
                        <h3>How to connect:</h3>
                        <ol>
                            <li>Open WhatsApp on your phone</li>
                            <li>Go to <strong>Settings</strong> → <strong>Linked Devices</strong></li>
                            <li>Tap <strong>"Link a Device"</strong></li>
                            <li>Scan this QR code</li>
                        </ol>
                    </div>
                    <button onclick="location.reload()" style="background:#25D366;color:white;border:none;padding:10px 20px;border-radius:5px;cursor:pointer;font-size:16px;">🔄 Refresh QR Code</button>
                </div>
            </body>
            </html>
        `);
    } else {
        res.send(`<h1>QR Code not available yet. Please wait...</h1>`);
    }
});

// ---------------------
// Google API Keys directly in file
// ---------------------
const GOOGLE_API_KEYS = [
    "AIzaSyA6Zh5GVB24w7bloM99lfgBhANbMeLO1SM",
    "AIzaSyXXXXXXXXXXXXXX2",
    "AIzaSyXXXXXXXXXXXXXX3"
];
let currentKeyIndex = 0;
function getApiKey() {
    const key = GOOGLE_API_KEYS[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % GOOGLE_API_KEYS.length;
    return key;
}

// ---------------------
// WhatsApp Bot
// ---------------------
async function startBot() {
    try {
        const client = await wa.create({
            sessionId: "RenderBot",
            multiDevice: true,
            headless: true,
            qrTimeout:0,
            authTimeout:0,
            blockCrashLogs:true,
            disableSpins:true,
            logConsole:false,
            popup:false,
            qrFormat:'png',
            sessionDataPath:'./session',
            useChrome:true
        });

        console.log("✅ WhatsApp Bot Ready!");

        client.onQr((qrData) => {
            global.qrCode = qrData;
            global.authenticated = false;
            console.log("📱 QR Code received!");
        });

        client.onAuthenticated(() => {
            console.log("🔐 WhatsApp Authenticated!");
            global.qrCode = null;
            global.authenticated = true;
        });

        client.onReady(() => {
            console.log("🎉 WhatsApp Bot fully ready!");
            global.botReady = true;
        });

        client.onMessage(async (msg) => {
            if(msg.isGroupMsg || msg.from==='status@broadcast') return;

            console.log(`📩 ${msg.from}: ${msg.body}`);
            const prompt = msg.body.trim();
            if(!prompt) return;

            try {
                const apiKey = getApiKey();
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
                    method:'POST',
                    headers:{'Content-Type':'application/json'},
                    body:JSON.stringify({
                        contents:[{parts:[{text:prompt}]}],
                        generationConfig:{temperature:0.7, topK:40, topP:0.95, maxOutputTokens:1024}
                    })
                });

                if(!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data = await response.json();
                const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || "⚠ No response from API";
                await client.sendText(msg.from, reply);

            } catch(err) {
                console.error("❌ Error:", err);
                await client.sendText(msg.from, "❌ Error processing your message.");
            }
        });

        client.onStateChanged((state) => {
            console.log('📱 WhatsApp State:', state);
        });

    } catch(err) {
        console.error("❌ Bot init failed:", err);
        setTimeout(startBot, 30000); // retry 30s
    }
}

// ---------------------
// Start Server & Bot
// ---------------------
app.listen(PORT,'0.0.0.0',()=>{
    console.log(`🚀 Server running on 0.0.0.0:${PORT}`);
    startBot();
});

// Graceful shutdown
process.on('SIGINT',()=>process.exit(0));
process.on('SIGTERM',()=>process.exit(0));
