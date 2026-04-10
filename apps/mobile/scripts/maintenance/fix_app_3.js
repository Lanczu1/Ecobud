const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, 'App.tsx');
let code = fs.readFileSync(targetFile, 'utf8');

// 1. Fix the double model issue
code = code.replace(/(\{ model  model: EcoBudMobileModel \})/g, "({ model }: { model: EcoBudMobileModel })");

// 2. Remove the garbage functions
// These start exactly with " model: EcoBudMobileModel }) {" (note the leading space, not preceded by '{' or 'function X(').
// Actually, since I ran the first fix script, "}: { model..." became ": { model..." and then maybe " model..." 
// Let's just search for the exact string: "\n model: EcoBudMobileModel }) {"

// We'll repeatedly find "\n model: EcoBudMobileModel }) {"
const garbageSig = "\n model: EcoBudMobileModel }) {";

let occurrences = 0;
while (code.includes(garbageSig)) {
    const startIndex = code.indexOf(garbageSig);

    // We need to parse until the matching closing brace.
    // The brace count starts when we hit the first '{' AFTER the '})'.
    // The garbageSig ends with '{'.
    const startBraceIndex = startIndex + garbageSig.length - 1; // index of '{'
    
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
        console.error("No balancing brace found!");
        break;
    }
}

fs.writeFileSync(targetFile, code);
console.log("Fixed double models. Removed", occurrences, "garbage blocks!");
