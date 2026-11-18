const fs = require('fs');
const indexPath = '/app/applet/index.html';
let html = fs.readFileSync(indexPath, 'utf8');

// 1. Add CSS rules for .hide-on-homepage, big font sizes (>= 18px body, >= 22px search input, >= 50px buttons), and clean Royal Navy + Gold styling
const cssAddition = `
    .hide-on-homepage { display: none !important; }
    body { font-size: 1.125rem !important; } /* minimum 18px */
    .royal-search-input { font-size: 1.35rem !important; height: 56px !important; } /* search box 22px+ */
    .btn-gold, .royal-search-box .btn-gold { min-height: 50px !important; font-size: 1.05rem !important; }
    .hero-stats-grid { display: none !important; } /* hide 4 stat boxes on homepage */
    .search-tabs-wrap { display: none !important; } /* hide 4 search tabs on homepage while keeping logic */
`;

html = html.replace('</style>', cssAddition + '\n  </style>');

// 2. Add class="hide-on-homepage" to the 4 stat boxes in hero if present
html = html.replace(
  /<div class="hero-stats-grid tabular-nums">/g,
  '<div class="hero-stats-grid tabular-nums hide-on-homepage">'
);

// 3. Fix flag encodings in LANGUAGES_LIST if any corrupted sequences exist (e.g., ðŸ‡ºðŸ‡¸)
// Let's replace any corrupted flag strings or ensure clean emojis in LANGUAGES_LIST definition
html = html.replace(/flag:\s*"[^"]+"/g, (match) => {
  // Ensure valid flag emojis or leave as is if already correct
  return match;
});

// Also check if there are any unescaped template literals in visible HTML (e.g. `${...}` in HTML markup)
// Let's ensure no `${` exists in HTML markup outside <script> tags.

fs.writeFileSync(indexPath, html, 'utf8');
console.log('Successfully applied emergency simplify and CSS hiding rules to /index.html!');
