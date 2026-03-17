const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, 'index.html');
let content = fs.readFileSync(targetPath, 'utf8');

const targetLine = '<section class="hero animate-fade-in">';
const replacement = `    <section class="hero animate-fade-in">
      <div class="hero-beams">
        <div class="beam"></div>
        <div class="beam"></div>
        <div class="beam"></div>
        <div class="beam"></div>
        <div class="beam"></div>
      </div>`;

if (content.includes(targetLine)) {
    content = content.replace(targetLine, replacement);
    fs.writeFileSync(targetPath, content);
    console.log("Replaced successfully.");
} else {
    console.log("Target not found.");
}
