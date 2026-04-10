const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, 'App.tsx');
let code = fs.readFileSync(targetFile, 'utf8');

function replaceFunction(code, functionSignature, newContent) {
    const startIndex = code.indexOf(functionSignature);
    if (startIndex === -1) {
        console.error("Could not find function:", functionSignature);
        return code;
    }
    
    let braceCount = 0;
    let started = false;
    let endIndex = startIndex;
    for (let i = startIndex; i < code.length; i++) {
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
    console.log("Successfully replaced:", functionSignature);
    return code.substring(0, startIndex) + newContent + code.substring(endIndex + 1);
}

const newAssistantOverlay = `function AssistantOverlay({ model }: { model: EcoBudMobileModel }) {
  return (
    <View style={styles.fullscreenOverlay}>
      <TopNavbar model={model} showBack={true} title="AI Assistant" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 24, flexGrow: 1 }}>
          
          <View style={{alignItems: 'center', marginBottom: 24, opacity: 0.7}}>
             <View style={[styles.badgeCircleMedium, {width: 48, height: 48, borderRadius: 24, marginBottom: 8}]}>
                <Ionicons name="chatbubbles" size={24} color="#FFF" />
             </View>
             <Text style={styles.metaTextSmallDark}>EcoBud Assistant is here to help</Text>
          </View>

          {model.assistantMessages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.chatBubble,
                message.role === 'user' ? styles.chatBubbleUser : styles.chatBubbleBot,
              ]}
            >
              <Text style={message.role === 'user' ? styles.chatBubbleTextUser : styles.chatBubbleTextBot}>{message.text}</Text>
              <Text style={message.role === 'user' ? styles.chatTimeUser : styles.chatTimeBot}>{message.time}</Text>
            </View>
          ))}
          {model.sendingMessage ? <ActivityIndicator color="#126027" style={{ marginTop: 12, alignSelf: 'flex-start' }} /> : null}
        </ScrollView>

        <View style={{paddingHorizontal: 24, paddingBottom: 12}}>
           <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 8}}>
             {['How to compost?', 'Where is the next event?', 'My Eco Points', 'Find a challenge'].map((reply) => (
                <TouchableOpacity key={reply} onPress={() => void model.handleAssistantSend(reply)} style={styles.categoryOutlineBtn}>
                  <Text style={[styles.categoryOutlineBtnText, {paddingHorizontal: 12}]}>{reply}</Text>
                </TouchableOpacity>
              ))}
           </ScrollView>
        </View>

        <View style={styles.assistantComposer}>
          <TextInput
            value={model.assistantInput}
            onChangeText={model.setAssistantInput}
            placeholder="Mesaage ECOBUD..."
            placeholderTextColor="#6B7A75"
            style={styles.chatInput}
          />
          <TouchableOpacity onPress={() => void model.handleAssistantSend()} style={styles.circularAddBtn}>
            <Ionicons name="send" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}`;
code = replaceFunction(code, 'function AssistantOverlay({ model }: { model: EcoBudMobileModel })', newAssistantOverlay);

const newStyleAppends = `
  chatBubble: {
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    maxWidth: '85%',
  },
  chatBubbleBot: {
    backgroundColor: '#FFF',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  chatBubbleUser: {
    backgroundColor: '#126027',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  chatBubbleTextBot: {
    color: '#1A211D',
    fontSize: 14,
    lineHeight: 22,
  },
  chatBubbleTextUser: {
    color: '#FFF',
    fontSize: 14,
    lineHeight: 22,
  },
  chatTimeBot: {
    fontSize: 10,
    color: '#6B7A75',
    marginTop: 8,
    alignSelf: 'flex-end',
  },
  chatTimeUser: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 8,
    alignSelf: 'flex-end',
  },
  assistantComposer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 32,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#EDF6F1',
    gap: 12,
  },
  chatInput: {
    flex: 1,
    height: 48,
    backgroundColor: '#F7F9F7',
    borderRadius: 24,
    paddingHorizontal: 20,
    fontSize: 14,
    color: '#1A211D',
  },
`;

const styleInsertionIndex = code.lastIndexOf('});');
if (styleInsertionIndex !== -1) {
    code = code.substring(0, styleInsertionIndex) + newStyleAppends + code.substring(styleInsertionIndex);
    console.log("Successfully appended new styles.");
}

fs.writeFileSync(targetFile, code);
