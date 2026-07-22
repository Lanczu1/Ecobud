const fs = require('fs');
const file = 'apps/mobile/src/app/components/AppOverlays.tsx';
let content = fs.readFileSync(file, 'utf8');

const animatedMapCode = `
function AnimatedMapMarker({ event, onPress }: { event: any, onPress: () => void }) {
  const pulseAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 2500,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const hash = event.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const left = 15 + (hash % 70);
  const top = 15 + ((hash * 7) % 70);

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={{
        position: 'absolute',
        left: \`\${left}%\`,
        top: \`\${top}%\`,
        width: 60,
        height: 60,
        marginLeft: -30,
        marginTop: -30,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
      }}
    >
      <Animated.View
        style={{
          position: 'absolute',
          width: 60,
          height: 60,
          borderRadius: 30,
          backgroundColor: '#10B981',
          opacity: pulseAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.5, 0],
          }),
          transform: [{
            scale: pulseAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.2, 1.5],
            })
          }]
        }}
      />
      <View
        style={{
          width: 18,
          height: 18,
          borderRadius: 9,
          backgroundColor: '#059669',
          borderWidth: 3,
          borderColor: '#FFF',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 3,
          elevation: 4,
        }}
      />
      <View style={{
        position: 'absolute',
        top: 42,
        backgroundColor: '#FFF',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 3,
        width: 110,
        alignItems: 'center'
      }}>
        <Text style={{ fontSize: 10, fontWeight: '800', color: '#126027', textAlign: 'center' }} numberOfLines={1}>{event.title}</Text>
      </View>
    </TouchableOpacity>
  );
}

function CustomAnimatedMap({ model }: { model: any }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#F1F5F9', borderRadius: 24, overflow: 'hidden' }}>
      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=800&auto=format&fit=crop' }}
        style={{ flex: 1, width: '100%', height: '100%' }}
      >
        <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(248, 250, 252, 0.75)' }} />
        
        {model.events.map((event: any) => (
          <AnimatedMapMarker
            key={event.id}
            event={event}
            onPress={() => {
              if (!model.isReadOnlyExperience) {
                void model.handleJoinEvent(event.id);
              }
            }}
          />
        ))}

        <View style={{ position: 'absolute', bottom: 16, right: 16, backgroundColor: '#FFF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 }}>
          <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#64748B' }}>ECOBUD CUSTOM MAP</Text>
        </View>
      </ImageBackground>
    </View>
  );
}
`;

// Insert the component before EventsOverlay
const eventsOverlayStart = 'export function EventsOverlay';
if (!content.includes('CustomAnimatedMap')) {
  content = content.replace(eventsOverlayStart, animatedMapCode + '\n' + eventsOverlayStart);
}

// Replace the MapView block
const mapStart = '<View style={{ height: 500, width: \'100%\', borderRadius: 24, overflow: \'hidden\', marginTop: 8 }}>';
const mapEnd = '</MapView>\n          </View>';

const startIndex = content.indexOf(mapStart);
const endIndex = content.indexOf(mapEnd) + mapEnd.length;

if (startIndex !== -1 && endIndex !== -1) {
  content = content.substring(0, startIndex) +
    '<View style={{ height: 500, width: \'100%\', marginTop: 8 }}>\n            <CustomAnimatedMap model={model} />\n          </View>' +
    content.substring(endIndex);
  fs.writeFileSync(file, content);
  console.log('Successfully replaced map');
} else {
  console.error('Could not find MapView block');
}
