const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, 'App.tsx');
let code = fs.readFileSync(targetFile, 'utf8');

// The garbage starts with "}: { model: EcoBudMobileModel }) {"
const sig = "}: { model: EcoBudMobileModel }) {";

let occurrences = 0;
while (code.includes(sig)) {
    const startIndex = code.indexOf(sig);
    
    // We want to find the matching '}' for the '{' that is at the end of the sig string.
    const startBraceIndex = startIndex + sig.length - 1; // points to '{'
    
    let braceCount = 0;
    let started = false;
    let endIndex = -1;
    
    for (let i = startBraceIndex; i < code.length; i++) {
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
        code = code.substring(0, startIndex) + code.substring(endIndex + 1);
        occurrences++;
    } else {
        console.error("Could not find matching brace for occurrence at index", startIndex);
        break; // Infinite loop protection
    }
}

fs.writeFileSync(targetFile, code);
console.log("Removed", occurrences, "garbage blocks!");
