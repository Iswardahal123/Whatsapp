const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const qrcode = require('qrcode-terminal');
require('dotenv').config();

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Initialize WhatsApp client
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: './session'
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ],
    }
});

// Store conversation history for context
const conversationHistory = new Map();
const MAX_HISTORY = 10; // Keep last 10 messages for context

// Bot configuration
const BOT_CONFIG = {
    prefix: '!',
    adminNumbers: process.env.ADMIN_NUMBERS ? process.env.ADMIN_NUMBERS.split(',') : [],
    responseDelay: 1000, // Delay before responding (in ms)
    maxMessageLength: 2000,
    enableGroupChat: process.env.ENABLE_GROUP_CHAT === 'true' || false
};

// Generate QR code
client.on('qr', qr => {
    console.log('📱 Scan the QR code below to connect WhatsApp:');
    qrcode.generate(qr, { small: true });
});

// Client ready
client.on('ready', () => {
    console.log('✅ WhatsApp Gemini Bot is ready!');
    console.log('🤖 Bot Commands:');
    console.log('   - Send any message to chat with AI');
    console.log('   - !help - Show help menu');
    console.log('   - !clear - Clear conversation history');
    console.log('   - !ping - Test bot response');
    console.log('   - !info - Bot information');
});

// Handle authentication
client.on('auth_failure', msg => {
    console.error('❌ Authentication failed:', msg);
});

client.on('authenticated', () => {
    console.log('✅ WhatsApp Web authenticated successfully!');
});

// Handle disconnection
client.on('disconnected', (reason) => {
    console.log('❌ WhatsApp Web disconnected:', reason);
    console.log('🔄 Attempting to reconnect...');
});

// Main message handler
client.on('message', async msg => {
    try {
        // Skip messages from status broadcasts
        if (msg.isStatus) return;

        // Get chat and contact info
        const chat = await msg.getChat();
        const contact = await msg.getContact();
        const isGroup = chat.isGroup;
        const userId = contact.id.user;

        console.log(`📩 Message from ${contact.name || contact.pushname || userId}: ${msg.body}`);

        // Skip group messages if not enabled
        if (isGroup && !BOT_CONFIG.enableGroupChat) {
            return;
        }

        // Skip own messages
        if (msg.fromMe) return;

        // Handle commands
        if (msg.body.startsWith(BOT_CONFIG.prefix)) {
            await handleCommand(msg, chat, contact);
            return;
        }

        // Skip empty messages or media without caption
        if (!msg.body || msg.body.trim() === '') {
            if (msg.hasMedia) {
                await msg.reply('🖼️ I can see you sent media! Please add a caption or text with your question.');
            }
            return;
        }

        // Process AI response
        await handleAIMessage(msg, chat, contact, userId);

    } catch (error) {
        console.error('❌ Error handling message:', error);
        try {
            await msg.reply('❌ Sorry, I encountered an error processing your message. Please try again.');
        } catch (replyError) {
            console.error('❌ Error sending error message:', replyError);
        }
    }
});

// Handle commands
async function handleCommand(msg, chat, contact) {
    const command = msg.body.toLowerCase();
    const userId = contact.id.user;

    try {
        switch (command) {
            case '!help':
                const helpMessage = `🤖 *WhatsApp Gemini AI Bot*

*Available Commands:*
• Send any message - Chat with AI
• !help - Show this help menu
• !clear - Clear your conversation history
• !ping - Test bot response
• !info - Bot information

*Tips:*
• Ask questions in any language
• Request explanations, summaries, or creative content
• The bot remembers your last ${MAX_HISTORY} messages for context

*Powered by Google Gemini AI* ✨`;
                await msg.reply(helpMessage);
                break;

            case '!clear':
                conversationHistory.delete(userId);
                await msg.reply('🗑️ Your conversation history has been cleared!');
                break;

            case '!ping':
                const startTime = Date.now();
                const reply = await msg.reply('🏓 Pong!');
                const endTime = Date.now();
                await client.sendMessage(msg.from, `⚡ Response time: ${endTime - startTime}ms`);
                break;

            case '!info':
                const info = await client.getState();
                const infoMessage = `ℹ️ *Bot Information*

*Status:* Connected ✅
*Platform:* WhatsApp Web
*AI Model:* Google Gemini 1.5 Flash
*Version:* 1.0.0
*Uptime:* ${formatUptime(process.uptime())}

*Features:*
• Natural language processing
• Context-aware conversations
• Multi-language support
• Command system`;
                await msg.reply(infoMessage);
                break;

            default:
                await msg.reply('❓ Unknown command. Type !help to see available commands.');
        }
    } catch (error) {
        console.error('❌ Error handling command:', error);
        await msg.reply('❌ Error processing command. Please try again.');
    }
}

// Handle AI messages
async function handleAIMessage(msg, chat, contact, userId) {
    try {
        // Add typing indicator delay
        await new Promise(resolve => setTimeout(resolve, BOT_CONFIG.responseDelay));

        // Get or create conversation history
        if (!conversationHistory.has(userId)) {
            conversationHistory.set(userId, []);
        }

        const history = conversationHistory.get(userId);
        const userMessage = msg.body.trim();

        // Build context from conversation history
        let contextPrompt = "You are a helpful WhatsApp AI assistant. Respond naturally and conversationally.\n\n";
        
        if (history.length > 0) {
            contextPrompt += "Previous conversation:\n";
            history.forEach((entry, index) => {
                contextPrompt += `${entry.role}: ${entry.content}\n`;
            });
            contextPrompt += "\n";
        }

        contextPrompt += `Current message: ${userMessage}`;

        // Generate AI response
        const result = await model.generateContent(contextPrompt);
        let aiResponse = result.response.text();

        // Limit response length
        if (aiResponse.length > BOT_CONFIG.maxMessageLength) {
            aiResponse = aiResponse.substring(0, BOT_CONFIG.maxMessageLength - 50) + '...\n\n_Message truncated due to length_';
        }

        // Update conversation history
        history.push({ role: 'User', content: userMessage });
        history.push({ role: 'Assistant', content: aiResponse });

        // Keep only last MAX_HISTORY messages
        if (history.length > MAX_HISTORY * 2) {
            history.splice(0, history.length - MAX_HISTORY * 2);
        }

        conversationHistory.set(userId, history);

        // Send response
        await msg.reply(aiResponse);

        console.log(`✅ Sent AI response to ${contact.name || contact.pushname || userId}`);

    } catch (error) {
        console.error('❌ Error generating AI response:', error);
        
        let errorMessage = '❌ Sorry, I encountered an error while processing your message.';
        
        if (error.message.includes('API_KEY')) {
            errorMessage += ' Please check the API key configuration.';
        } else if (error.message.includes('quota')) {
            errorMessage += ' API quota exceeded. Please try again later.';
        } else {
            errorMessage += ' Please try again or rephrase your message.';
        }

        await msg.reply(errorMessage);
    }
}

// Utility function to format uptime
function formatUptime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    } else {
        return `${secs}s`;
    }
}

// Handle process termination
process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT. Gracefully shutting down...');
    await client.destroy();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM. Gracefully shutting down...');
    await client.destroy();
    process.exit(0);
});

// Handle unhandled errors
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});

// Initialize the client
console.log('🚀 Starting WhatsApp Gemini Bot...');
console.log('📋 Make sure to create a .env file with your GEMINI_API_KEY');
client.initialize();
