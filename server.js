

// server.js
const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const { google } = require('googleapis');
const axios = require('axios');
require('dotenv').config();
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.static('public'));

// WhatsApp Client Setup
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "whatsapp-bot"
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
        ]
    }
});

// Google APIs Setup
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || 'AIzaSyA6Zh5GVB24w7bloM99lfgBhANbMeLO1SM';

// Google Custom Search Engine ID (you need to create one)
const SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID;

// Google APIs instances
const youtube = google.youtube({ version: 'v3', auth: GOOGLE_API_KEY });
const customSearch = google.customsearch({ version: 'v1', auth: GOOGLE_API_KEY });
const translate = google.translate({ version: 'v2', auth: GOOGLE_API_KEY });

// Store QR code and client state
let qrCodeString = '';
let isClientReady = false;

// WhatsApp Client Events
client.on('qr', async (qr) => {
    console.log('QR Code received');
    qrCodeString = await qrcode.toDataURL(qr);
});

client.on('ready', () => {
    console.log('WhatsApp Client is ready!');
    isClientReady = true;
});

client.on('authenticated', () => {
    console.log('WhatsApp Client authenticated');
});

client.on('auth_failure', (msg) => {
    console.error('Authentication failed:', msg);
});

client.on('disconnected', (reason) => {
    console.log('WhatsApp Client was logged out:', reason);
    isClientReady = false;
});

// Message handler
client.on('message', async (message) => {
    try {
        const chat = await message.getChat();
        const contact = await message.getContact();
        
        console.log(`Message from ${contact.name || contact.pushname}: ${message.body}`);
        
        // Don't respond to group messages or if message is from status
        if (chat.isGroup || message.isStatus) return;
        
        const messageBody = message.body.toLowerCase().trim();
        
        // Command processing
        if (messageBody.startsWith('/')) {
            await handleCommand(message, messageBody);
        } else {
            // Default response for non-command messages
            await message.reply('Hello! I\'m your WhatsApp bot. Use /help to see available commands.');
        }
    } catch (error) {
        console.error('Error handling message:', error);
        await message.reply('Sorry, I encountered an error processing your message.');
    }
});

// Command handler
async function handleCommand(message, command) {
    const parts = command.split(' ');
    const cmd = parts[0];
    const args = parts.slice(1).join(' ');
    
    switch (cmd) {
        case '/help':
            await sendHelpMessage(message);
            break;
            
        case '/search':
            if (!args) {
                await message.reply('Please provide a search query. Example: /search artificial intelligence');
                return;
            }
            await handleGoogleSearch(message, args);
            break;
            
        case '/youtube':
            if (!args) {
                await message.reply('Please provide a search query. Example: /youtube funny cats');
                return;
            }
            await handleYouTubeSearch(message, args);
            break;
            
        case '/translate':
            const translateParts = args.split(' to ');
            if (translateParts.length !== 2) {
                await message.reply('Format: /translate [text] to [language]. Example: /translate hello to spanish');
                return;
            }
            await handleTranslation(message, translateParts[0].trim(), translateParts[1].trim());
            break;
            
        case '/weather':
            if (!args) {
                await message.reply('Please provide a city name. Example: /weather London');
                return;
            }
            await handleWeather(message, args);
            break;
            
        case '/joke':
            await handleJoke(message);
            break;
            
        case '/quote':
            await handleQuote(message);
            break;
            
        default:
            await message.reply('Unknown command. Use /help to see available commands.');
    }
}

// Help message
async function sendHelpMessage(message) {
    const helpText = `
🤖 *WhatsApp Bot Commands*

📝 *General Commands:*
• /help - Show this help message
• /search [query] - Search Google
• /translate [text] to [language] - Translate text
• /weather [city] - Get weather information

🎥 *Entertainment:*
• /youtube [query] - Search YouTube videos
• /joke - Get a random joke
• /quote - Get an inspirational quote

💡 *Example usage:*
• /search artificial intelligence
• /youtube funny cats
• /translate hello to spanish
• /weather New York
    `;
    
    await message.reply(helpText);
}

// Google Search handler
async function handleGoogleSearch(message, query) {
    if (!SEARCH_ENGINE_ID) {
        await message.reply('Google Search is not configured. Please set up a Custom Search Engine ID.');
        return;
    }
    
    try {
        const response = await customSearch.cse.list({
            cx: SEARCH_ENGINE_ID,
            q: query,
            num: 3
        });
        
        if (!response.data.items || response.data.items.length === 0) {
            await message.reply('No search results found.');
            return;
        }
        
        let searchResults = `🔍 *Search results for: "${query}"*\n\n`;
        
        response.data.items.forEach((item, index) => {
            searchResults += `${index + 1}. *${item.title}*\n${item.link}\n${item.snippet}\n\n`;
        });
        
        await message.reply(searchResults);
    } catch (error) {
        console.error('Google Search error:', error);
        await message.reply('Error performing search. Please try again later.');
    }
}

// YouTube search handler
async function handleYouTubeSearch(message, query) {
    try {
        const response = await youtube.search.list({
            part: 'snippet',
            q: query,
            type: 'video',
            maxResults: 3
        });
        
        if (!response.data.items || response.data.items.length === 0) {
            await message.reply('No YouTube videos found.');
            return;
        }
        
        let videoResults = `🎥 *YouTube results for: "${query}"*\n\n`;
        
        response.data.items.forEach((item, index) => {
            const videoUrl = `https://www.youtube.com/watch?v=${item.id.videoId}`;
            videoResults += `${index + 1}. *${item.snippet.title}*\n${videoUrl}\n${item.snippet.description.substring(0, 100)}...\n\n`;
        });
        
        await message.reply(videoResults);
    } catch (error) {
        console.error('YouTube search error:', error);
        await message.reply('Error searching YouTube. Please try again later.');
    }
}

// Translation handler
async function handleTranslation(message, text, targetLanguage) {
    try {
        const response = await translate.translations.list({
            q: text,
            target: getLanguageCode(targetLanguage)
        });
        
        if (response.data.translations && response.data.translations.length > 0) {
            const translatedText = response.data.translations[0].translatedText;
            await message.reply(`🌐 *Translation:*\n\n*Original:* ${text}\n*Translated to ${targetLanguage}:* ${translatedText}`);
        } else {
            await message.reply('Translation failed. Please try again.');
        }
    } catch (error) {
        console.error('Translation error:', error);
        await message.reply('Error translating text. Please check the language and try again.');
    }
}

// Weather handler (using OpenWeatherMap API)
async function handleWeather(message, city) {
    try {
        // You need to get a free API key from openweathermap.org
        const WEATHER_API_KEY = process.env.WEATHER_API_KEY;
        
        if (!WEATHER_API_KEY) {
            await message.reply('Weather service is not configured. Please set up OpenWeatherMap API key.');
            return;
        }
        
        const response = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${WEATHER_API_KEY}&units=metric`);
        
        const weather = response.data;
        const weatherText = `
🌤️ *Weather in ${weather.name}, ${weather.sys.country}*

🌡️ Temperature: ${weather.main.temp}°C
🌡️ Feels like: ${weather.main.feels_like}°C
💧 Humidity: ${weather.main.humidity}%
🌬️ Wind: ${weather.wind.speed} m/s
☁️ Conditions: ${weather.weather[0].description}
        `;
        
        await message.reply(weatherText);
    } catch (error) {
        console.error('Weather error:', error);
        await message.reply('Error getting weather information. Please check the city name and try again.');
    }
}

// Joke handler
async function handleJoke(message) {
    try {
        const response = await axios.get('https://official-joke-api.appspot.com/random_joke');
        const joke = response.data;
        await message.reply(`😄 *Here's a joke for you:*\n\n${joke.setup}\n\n${joke.punchline}`);
    } catch (error) {
        console.error('Joke error:', error);
        await message.reply('Sorry, I couldn\'t fetch a joke right now. Try again later!');
    }
}

// Quote handler
async function handleQuote(message) {
    try {
        const response = await axios.get('https://api.quotable.io/random');
        const quote = response.data;
        await message.reply(`💭 *Inspirational Quote:*\n\n"${quote.content}"\n\n- ${quote.author}`);
    } catch (error) {
        console.error('Quote error:', error);
        await message.reply('Sorry, I couldn\'t fetch a quote right now. Try again later!');
    }
}

// Utility function to get language codes
function getLanguageCode(language) {
    const languageCodes = {
        'spanish': 'es',
        'french': 'fr',
        'german': 'de',
        'italian': 'it',
        'portuguese': 'pt',
        'russian': 'ru',
        'chinese': 'zh',
        'japanese': 'ja',
        'korean': 'ko',
        'arabic': 'ar',
        'hindi': 'hi',
        'turkish': 'tr',
        'dutch': 'nl',
        'swedish': 'sv',
        'norwegian': 'no',
        'danish': 'da',
        'finnish': 'fi',
        'polish': 'pl',
        'czech': 'cs',
        'hungarian': 'hu',
        'romanian': 'ro',
        'bulgarian': 'bg',
        'croatian': 'hr',
        'serbian': 'sr',
        'slovak': 'sk',
        'slovenian': 'sl',
        'estonian': 'et',
        'latvian': 'lv',
        'lithuanian': 'lt',
        'ukrainian': 'uk',
        'greek': 'el',
        'hebrew': 'he',
        'thai': 'th',
        'vietnamese': 'vi',
        'indonesian': 'id',
        'malay': 'ms',
        'filipino': 'fil'
    };
    
    return languageCodes[language.toLowerCase()] || language.substring(0, 2);
}

// API Routes
app.get('/', (req, res) => {
    res.send(`
        <html>
            <head><title>WhatsApp Bot</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; margin-top: 50px;">
                <h1>🤖 WhatsApp Bot Server</h1>
                <p>Status: ${isClientReady ? '✅ Ready' : '⏳ Initializing...'}</p>
                <div id="status"></div>
                <script>
                    setInterval(async () => {
                        try {
                            const response = await fetch('/status');
                            const data = await response.json();
                            document.getElementById('status').innerHTML = 
                                data.ready ? '<p style="color: green;">Bot is ready!</p>' : 
                                data.qr ? '<div><p>Scan this QR code with WhatsApp:</p><img src="' + data.qr + '" alt="QR Code" style="max-width: 300px;"></div>' :
                                '<p style="color: orange;">Initializing...</p>';
                        } catch (error) {
                            console.error('Error fetching status:', error);
                        }
                    }, 2000);
                </script>
            </body>
        </html>
    `);
});

app.get('/status', (req, res) => {
    res.json({
        ready: isClientReady,
        qr: qrCodeString
    });
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', ready: isClientReady });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Initializing WhatsApp client...');
    
    // Initialize WhatsApp client
    client.initialize();
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down gracefully...');
    await client.destroy();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('Shutting down gracefully...');
    await client.destroy();
    process.exit(0);
});
