const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, 'App.tsx');
let code = fs.readFileSync(targetFile, 'utf8');

// 1. Fix the double parenthesis issue on the model components
code = code.replace(/\(\(\{ model \}: \{ model: EcoBudMobileModel \}\)\)/g, "({ model }: { model: EcoBudMobileModel })");

// 2. We need to find all occurrences of "\n}: {\n" or similar that are dangling.
// To do this reliably, let's use a regex that matches the start of the dangling type annotation:
// "\n}: {" followed by some chars until "}) {"
const danglingRegex = /\n\}: \{[^]*?\}\) \{/g;

let occurrences = 0;
while (true) {
    const match = danglingRegex.exec(code);
    if (!match) break;
    
    // Found a dangling block! match.index is the start of "\n}: {"
    const startIndex = match.index;
    
    // match[0] ends exactly with "}) {", which means the last brace is '{' of the function body!
    const bodyBraceIndex = startIndex + match[0].length - 1;
    
    let braceCount = 0;
    let started = false;
    let endIndex = -1;
    
    for (let i = bodyBraceIndex; i < code.length; i++) {
        if (code[i] === '{') {
            braceCount++;
            started = true;
        } else if (code[i] === '}') {
            braceCount--;
        }
        
        if (started && braceCount === 0) {
            endIndex = i;
            break;
        }
    }
    
    if (endIndex !== -1) {
        // Remove from the start of "\n}: {" until the closing brace of the function block
        code = code.substring(0, startIndex) + code.substring(endIndex + 1);
        occurrences++;
        // Reset the regex since we modified the string
        danglingRegex.lastIndex = 0;
    } else {
        console.error("Could not find balancing brace for dangling block at", startIndex);
        break;
    }
}

fs.writeFileSync(targetFile, code);
console.log("Fixed double parenthesis. Removed", occurrences, "dangling blocks!");
