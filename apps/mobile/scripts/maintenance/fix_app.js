const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, 'App.tsx');
let code = fs.readFileSync(targetFile, 'utf8');

// Fix <//>
code = code.replace(/<\/\/>/g, '</>');

// Now we find all instances of "}: { model: EcoBudMobileModel }) {"
// and remove that entire block.
const garbageSig = "}: { model: EcoBudMobileModel }) {";

let nextGarbage = code.indexOf(garbageSig);
while (nextGarbage !== -1) {
    let braceCount = 0;
    let started = false;
    let endIndex = nextGarbage;
    
    // The garbage block starts with a '{' inside the garbageSig (right at the end of it).
    // Wait, the string "}: { model: EcoBudMobileModel }) {" contains one '{' (after :) and one '}' (at the end).
    // Let's just find the first '{' AFTER the '})' part.
    // Actually, "}: { model: EcoBudMobileModel }) {" has TWO '{' and two '}'.
    // Let's just scan starting from nextGarbage.
    
    for (let i = nextGarbage; i < code.length; i++) {
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
    
    console.log("Removing garbage block starting at index", nextGarbage, "and ending at", endIndex);
    code = code.substring(0, nextGarbage) + code.substring(endIndex + 1);
    
    // Find next
    nextGarbage = code.indexOf(garbageSig);
}

fs.writeFileSync(targetFile, code);
console.log("Fixed App.tsx!");
