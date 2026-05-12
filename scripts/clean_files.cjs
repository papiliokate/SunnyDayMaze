const fs = require('fs');
const path = require('path');

function cleanMainJs() {
    let content = fs.readFileSync(path.resolve(__dirname, '../main.js'), 'utf8');
    
    // Replace conversion logic with false in oops-games
    content = content.replace(/const isEmbed = urlParams\.get\('mode'\) === 'embed';/g, "const isEmbed = false;");
    content = content.replace(/const isWaitingRoom = urlParams\.get\('mode'\) === 'waiting-room';/g, "const isWaitingRoom = false;");
    content = content.replace(/const isCaptcha = urlParams\.get\('mode'\) === 'captcha';/g, "const isCaptcha = false;");

    fs.writeFileSync(path.resolve(__dirname, '../main.js'), content);
    console.log("Cleaned main.js");
}

function cleanConversionJs() {
    let content = fs.readFileSync(path.resolve(__dirname, '../conversion.js'), 'utf8');
    
    // Replace oops-games logic with false in conversion.js
    content = content.replace(/const isCarousel = urlParams\.get\('carousel'\) === 'true';/g, "const isCarousel = false;");

    fs.writeFileSync(path.resolve(__dirname, '../conversion.js'), content);
    console.log("Cleaned conversion.js");
}

cleanMainJs();
cleanConversionJs();
