const fs = require('fs');
const file = 'c:/xampz/htdocs/Ecobud/apps/mobile/src/app/components/AppOverlays.tsx';
const content = fs.readFileSync(file, 'utf8');

const target = `  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'transparent', zIndex: 10000 }]} pointerEvents="none">
export function NotificationsOverlay`;

const replacement = `  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'transparent', zIndex: 10000 }]} pointerEvents="none">
      {particleAnims.map((particle, index) => {
        const type = particleTypes[index];
        return (
          <Animated.View
            key={index}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              transform: [
                { translateX: particle.pos.x },
                { translateY: particle.pos.y },
                { scale: particle.scale },
              ],
              opacity: particle.opacity,
              zIndex: 9999,
              shadowColor: type === 'leaf' ? '#10b981' : '#F59E0B',
              shadowRadius: 10,
              shadowOpacity: 0.8,
              shadowOffset: { width: 0, height: 0 },
              elevation: 10,
            }}
          >
            <View style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              backgroundColor: type === 'coin' ? 'transparent' : '#10b981',
              justifyContent: 'center',
              alignItems: 'center',
              borderWidth: type === 'coin' ? 0 : 2,
              borderColor: '#FFF',
            }}>
              {type === 'coin' ? (
                <Image
                  source={require('../../../assets/coin.png')}
                  style={{ width: 34, height: 34, resizeMode: 'contain' }}
                />
              ) : (
                <Ionicons name="leaf" size={16} color="#FFF" />
              )}
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

export function NotificationsOverlay`;

// Use regex to allow variable newlines/spaces between the elements
const regex = /return \(\s*<View style=\{\[StyleSheet\.absoluteFill, \{ backgroundColor: 'transparent', zIndex: 10000 \}\]\} pointerEvents="none">\s*export function NotificationsOverlay/m;

if (regex.test(content)) {
  const newContent = content.replace(regex, replacement);
  fs.writeFileSync(file, newContent);
  console.log('Fixed correctly!');
} else {
  console.log('Regex target not found!');
}
