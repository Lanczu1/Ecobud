const fs = require('fs');
const file = 'c:/xampz/htdocs/Ecobud/apps/mobile/src/app/components/AppOverlays.tsx';
let content = fs.readFileSync(file, 'utf8');

const target = `    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'transparent', zIndex: 10000 }]} pointerEvents="none">
              left: 0,
              top: 0,
              transform: [
                { translateX: particle.pos.x },
                { translateY: particle.pos.y },
                { scale: particle.scale },
              ],
              opacity: particle.opacity,`;

const replacement = `    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'transparent', zIndex: 10000 }]} pointerEvents="none">
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
              opacity: particle.opacity,`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(file, content);
  console.log('Fixed syntax correctly');
} else {
  console.log('Target not found');
}
