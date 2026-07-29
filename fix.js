const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'apps/mobile/src/app/components/AppOverlays.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const target = `<View style={styles.assistantComposer}>
          <TextInput
            value={model.assistantInput}
            onChangeText={model.setAssistantInput}
            placeholder="Message ECOBUD..."
            placeholderTextColor="#6B7A75"
            style={styles.chatInput}
          />
          <TouchableOpacity onPress={() => void model.handleAssistantSend()} style={styles.circularAddBtn}>
            <Ionicons name="send" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>`;

const replacement = `<View style={[styles.assistantComposer, { paddingBottom: Platform.OS === 'android' ? 32 : 22 }]}>
          <TextInput
            value={model.assistantInput}
            onChangeText={model.setAssistantInput}
            placeholder="Message ECOBUD..."
            placeholderTextColor="#6B7A75"
            style={styles.assistantInput}
          />
          <TouchableOpacity onPress={() => void model.handleAssistantSend()} style={styles.sendButton}>
            <Ionicons name="send" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>`;

content = content.replace(target, replacement);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed successfully');
