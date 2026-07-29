const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'apps/mobile/src/app/components/AppOverlays.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Replace chatInput
content = content.replace('style={styles.chatInput}', 'style={styles.assistantInput}');

// Replace circularAddBtn
content = content.replace('style={styles.circularAddBtn}', 'style={styles.sendButton}');

// Add paddingBottom to assistantComposer
content = content.replace('<View style={styles.assistantComposer}>', "<View style={[styles.assistantComposer, { paddingBottom: Platform.OS === 'android' ? 32 : 22 }]}>");

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed successfully with regex');
