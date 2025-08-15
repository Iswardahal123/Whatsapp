// install-chrome.js
const { install } = require('@puppeteer/browsers');
const fs = require('fs');
const path = require('path');

async function installChrome() {
    try {
        console.log('🔄 Installing Chrome for Puppeteer...');
        
        // Set cache directory
        const cacheDir = process.env.PUPPETEER_CACHE_DIR || path.join(__dirname, '.cache', 'puppeteer');
        
        // Ensure cache directory exists
        if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true });
        }
        
        console.log(`📁 Using cache directory: ${cacheDir}`);
        
        // Install Chrome
        const result = await install({
            browser: 'chrome',
            buildId: '1108766', // Chrome version that matches Puppeteer 21.5.0
            cacheDir: cacheDir
        });
        
        console.log('✅ Chrome installed successfully!');
        console.log(`📍 Chrome path: ${result.executablePath}`);
        
        // Save the executable path for later use
        const configPath = path.join(__dirname, 'chrome-config.json');
        fs.writeFileSync(configPath, JSON.stringify({
            executablePath: result.executablePath,
            cacheDir: cacheDir
        }, null, 2));
        
        console.log('💾 Chrome configuration saved');
        
    } catch (error) {
        console.error('❌ Failed to install Chrome:', error);
        console.log('🔄 Continuing without Chrome installation...');
        
        // Create empty config file so the app doesn't crash
        const configPath = path.join(__dirname, 'chrome-config.json');
        fs.writeFileSync(configPath, JSON.stringify({
            executablePath: null,
            cacheDir: null
        }, null, 2));
    }
}

// Only run if this script is called directly (not required)
if (require.main === module) {
    installChrome();
}

module.exports = { installChrome };
