const fs = require('fs');
let code = fs.readFileSync('c:/xampz/htdocs/Ecobud/apps/mobile/src/app/components/AppViews.tsx', 'utf8');

// The problematic lines from earlier edits
let lines = code.split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('avatarUrl = cleanUrl.startsWith')) {
    lines[i] = "    avatarUrl = cleanUrl.startsWith('http') ? cleanUrl : `${ecobudApiOrigin}${cleanUrl}`;";
  }
  if (lines[i].includes('Max Level Reached!')) {
    lines[i] = "              {isMaxLevel ? 'Max Level Reached!' : `${pointsToNext} XP to Lv. ${nextLevelObj.level}`}";
  }
}

fs.writeFileSync('c:/xampz/htdocs/Ecobud/apps/mobile/src/app/components/AppViews.tsx', lines.join('\n'));
console.log('Fixed the literal backslashes correctly!');
