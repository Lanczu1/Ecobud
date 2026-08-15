const fs = require('fs');
const filePath = 'src/app/components/AppOverlays.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const targetStr = `<Text style={{ fontSize: 16, fontWeight: 'bold', color: '#3A4B43', marginBottom: 8 }}>Instructions:</Text>`;

const replacementStr = `<Text style={{ fontSize: 16, fontWeight: 'bold', color: '#3A4B43', marginBottom: 8 }}>Schedule:</Text>
            <Text style={{ fontSize: 16, color: '#6B7A75', marginBottom: 16, lineHeight: 24 }}>📅 Available from Monday to Friday only.</Text>

            <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#3A4B43', marginBottom: 8 }}>Instructions:</Text>`;

content = content.replace(targetStr, replacementStr);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done');
