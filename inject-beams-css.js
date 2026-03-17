const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, 'styles', 'main.css');
let css = fs.readFileSync(cssPath, 'utf8');

const anchor = '/* ── Features Grid ── */';
const newStyles = `
.hero-beams {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
}

.beam {
  position: absolute;
  background: linear-gradient(to bottom, transparent, var(--primary-500), transparent);
  width: 1.5px;
  height: 150px;
  opacity: 0;
  border-radius: var(--radius-full);
  animation: shine 8s linear infinite;
}

.beam:nth-child(1) { left: 15%; top: -150px; animation-duration: 4s; animation-delay: 0.2s; }
.beam:nth-child(2) { left: 35%; top: -150px; animation-duration: 10s; animation-delay: 1s; }
.beam:nth-child(3) { left: 55%; top: -150px; animation-duration: 6s; animation-delay: 3s; }
.beam:nth-child(4) { left: 75%; top: -150px; animation-duration: 8s; animation-delay: 1.5s; }
.beam:nth-child(5) { left: 95%; top: -150px; animation-duration: 5s; animation-delay: 4.5s; }

@keyframes shine {
  0% { transform: translateY(-10vh) rotate(15deg); opacity: 0; }
  20% { opacity: 0.3; }
  80% { opacity: 0.3; }
  100% { transform: translateY(110vh) rotate(15deg); opacity: 0; }
}

.hero .container {
  position: relative;
  z-index: 10;
}

`;

if (css.includes(anchor)) {
    css = css.replace(anchor, newStyles + anchor);
    fs.writeFileSync(cssPath, css);
    console.log("Styles injected successfuly.");
} else {
    console.log("Anchor not found.");
}
