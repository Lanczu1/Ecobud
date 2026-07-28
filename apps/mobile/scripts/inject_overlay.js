const fs = require('fs');
const path = require('path');

const filePath = path.join('c:', 'xampz', 'htdocs', 'Ecobud', 'apps', 'mobile', 'src', 'app', 'components', 'AppOverlays.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const componentCode = `
export function EventApprovedOverlay({ model }: { model: EcoBudMobileModel }) {
  const { width, height } = Dimensions.get('window');
  const contentScale = React.useRef(new Animated.Value(0.8)).current;
  const contentOpacity = React.useRef(new Animated.Value(0)).current;
  const checkScale = React.useRef(new Animated.Value(0)).current;
  const checkRotate = React.useRef(new Animated.Value(0)).current;
  const glowScale = React.useRef(new Animated.Value(0.9)).current;
  const shineAnim = React.useRef(new Animated.Value(-150)).current;
  const btnOpacity = React.useRef(new Animated.Value(1)).current;
  const bgOpacity = React.useRef(new Animated.Value(1)).current;

  const hasPoints = (model.earnedPoints ?? 0) > 0;
  const hasCoins = (model.earnedCoins ?? 0) > 0;
  const numParticles = 24;

  const particleTypes: ('leaf' | 'coin')[] = Array.from({ length: numParticles }, (_, i) => {
    if (hasPoints && hasCoins) return i % 2 === 0 ? 'leaf' : 'coin';
    if (hasCoins) return 'coin';
    return 'leaf';
  });

  const particleAnims = React.useRef(
    Array.from({ length: numParticles }, () => ({
      pos: new Animated.ValueXY({ x: width / 2 - 15, y: height / 2 - 80 }),
      scale: new Animated.Value(0),
      opacity: new Animated.Value(0),
    }))
  ).current;

  const [isAnimatingOut, setIsAnimatingOut] = React.useState(false);

  const startRewardAnimation = () => {
    model.setActiveTab('home', true);
    setTimeout(() => {
      setIsAnimatingOut(true);
      Animated.parallel([
        Animated.timing(contentOpacity, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.timing(btnOpacity, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.timing(bgOpacity, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]).start();

      const animations = particleAnims.map((particle, index) => {
        const type = particleTypes[index];
        const angle = (Math.PI * 2 * index) / numParticles + (Math.random() - 0.5) * 0.4;
        const radius = 70 + Math.random() * 50;
        const burstX = width / 2 - 15 + Math.cos(angle) * radius;
        const burstY = height / 2 - 80 + Math.sin(angle) * radius;
        const targetX = type === 'coin' ? width + 100 : width / 2 - 15 + (Math.random() * 40 - 20);
        const targetY = type === 'coin' ? 150 : 434;

        particle.pos.setValue({ x: width / 2 - 15, y: height / 2 - 80 });
        particle.scale.setValue(0);
        particle.opacity.setValue(0);

        return Animated.sequence([
          Animated.delay(index * 55),
          Animated.parallel([
            Animated.spring(particle.pos, { toValue: { x: burstX, y: burstY }, tension: 80, friction: 6, useNativeDriver: true }),
            Animated.timing(particle.scale, { toValue: 1.5, duration: 250, useNativeDriver: true }),
            Animated.timing(particle.opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
          ]),
          Animated.delay(120),
          Animated.parallel([
            Animated.timing(particle.pos, { toValue: { x: targetX, y: targetY }, duration: 650, easing: Easing.bezier(0.25, 1, 0.5, 1), useNativeDriver: true }),
            Animated.timing(particle.scale, { toValue: 0.4, duration: 650, useNativeDriver: true }),
            Animated.sequence([
              Animated.delay(450),
              Animated.timing(particle.opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
            ]),
          ]),
        ]);
      });

      Animated.parallel(animations).start(() => {
        model.setActiveOverlay(null);
        DeviceEventEmitter.emit('ECO_POINTS_DROP_ANIMATION');
      });
    }, 100);
  };

  React.useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(contentScale, { toValue: 1, friction: 5, tension: 50, useNativeDriver: true }),
        Animated.timing(contentOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.spring(checkScale, { toValue: 1, friction: 3, tension: 40, useNativeDriver: true }),
        Animated.timing(shineAnim, { toValue: 350, duration: 1200, useNativeDriver: true }),
      ]),
    ]).start();
    Animated.loop(Animated.timing(checkRotate, { toValue: 1, duration: 8000, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.sequence([
      Animated.timing(glowScale, { toValue: 1.1, duration: 1500, useNativeDriver: true }),
      Animated.timing(glowScale, { toValue: 0.9, duration: 1500, useNativeDriver: true }),
    ])).start();
  }, []);

  const embers = React.useMemo(() => generateEmbers(8), []);
  const confettiPieces = React.useMemo(() => generateConfettiPieces(25), []);

  return (
    <View style={[styles.fullscreenOverlay, isAnimatingOut && { backgroundColor: 'transparent' }]}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: bgOpacity }]}>
        <LinearGradient colors={['#06231E', '#093B32', '#126027']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: bgOpacity }]} pointerEvents="none">
        <View style={{ position: 'absolute', top: -60, right: -60, width: 280, height: 280, borderRadius: 140, backgroundColor: 'rgba(251,191,36,0.10)' }} />
        <View style={{ position: 'absolute', bottom: -80, left: -80, width: 320, height: 320, borderRadius: 160, backgroundColor: 'rgba(23,160,126,0.08)' }} />
      </Animated.View>
      <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', zIndex: 5 }, { opacity: bgOpacity }]} pointerEvents="none">
        <View style={StyleSheet.absoluteFill}>{embers.map((e) => <FloatingEmber key={e.id} ember={e} />)}</View>
      </Animated.View>
      <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', zIndex: 10 }, { opacity: bgOpacity }]} pointerEvents="none">
        <View style={StyleSheet.absoluteFill}>{confettiPieces.map((p) => <ConfettiParticle key={p.id} piece={p} />)}</View>
      </Animated.View>

      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 }} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: contentOpacity, transform: [{ scale: contentScale }], alignItems: 'center', width: '100%' }}>
          <View style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.09)', borderRadius: 32, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.14)', paddingHorizontal: 24, paddingVertical: 36, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.25, shadowRadius: 24, elevation: 12, overflow: 'hidden' }}>
            <Animated.View style={{ position: 'absolute', top: -150, bottom: -150, width: 60, backgroundColor: 'rgba(255,255,255,0.15)', transform: [{ translateX: shineAnim }, { rotate: '25deg' }] }} />
            <View style={{ position: 'relative', marginBottom: 28 }}>
              <Animated.View style={{ position: 'absolute', top: -12, left: -12, right: -12, bottom: -12, borderRadius: 60, backgroundColor: 'rgba(74,222,128,0.15)', transform: [{ scale: Animated.multiply(checkScale, glowScale) }] }} />
              <Animated.View style={{ position: 'absolute', top: -4, left: -4, right: -4, bottom: -4, borderRadius: 52, borderWidth: 2, borderColor: 'rgba(74,222,128,0.6)', borderStyle: 'dashed', transform: [{ rotate: checkRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }} />
              <Animated.View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: '#10b981', justifyContent: 'center', alignItems: 'center', transform: [{ scale: checkScale }], shadowColor: '#10b981', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 18, elevation: 10, borderWidth: 4, borderColor: 'rgba(255,255,255,0.25)' }}>
                <Ionicons name="checkmark-sharp" size={56} color="#FFFFFF" />
              </Animated.View>
            </View>
            <View style={{ backgroundColor: 'rgba(251,191,36,0.16)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(251,191,36,0.3)' }}>
              <Ionicons name="sparkles" size={14} color="#FBBF24" />
              <Text style={{ fontSize: 11, fontWeight: '900', color: '#FBBF24', letterSpacing: 1, textTransform: 'uppercase' }}>Event Attendance Approved</Text>
            </View>
            <Text style={{ fontSize: 30, fontWeight: '900', color: '#FFFFFF', marginBottom: 8, textAlign: 'center', letterSpacing: -0.5 }}>Attendance Verified!</Text>
            <Text style={{ fontSize: 15, color: '#C2D9CE', marginBottom: 32, textAlign: 'center', lineHeight: 22, paddingHorizontal: 8 }}>Great job showing up! Your eco-event attendance has been approved and your rewards are ready.</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
              {hasPoints && (
                <View style={{ alignItems: 'center' }}>
                  <View style={{ width: 110, height: 110, justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
                    <LinearGradient colors={['#34d399', '#059669']} style={{ width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center' }}>
                      <Ionicons name="leaf" size={44} color="#FFF" />
                    </LinearGradient>
                  </View>
                  <Text style={{ fontSize: 52, fontWeight: '900', color: '#FFF', textShadowColor: 'rgba(16,185,129,0.5)', textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 10, marginBottom: 4 }}>+{model.earnedPoints}</Text>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#6EE7B7', letterSpacing: 1.5, textTransform: 'uppercase' }}>Points Earned</Text>
                </View>
              )}
              {hasCoins && (
                <View style={{ alignItems: 'center' }}>
                  <View style={{ width: 110, height: 110, justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
                    <Image source={require('../../../assets/coin.png')} style={{ width: 100, height: 100, resizeMode: 'contain' }} />
                  </View>
                  <Text style={{ fontSize: 52, fontWeight: '900', color: '#FFF', textShadowColor: 'rgba(245,158,11,0.5)', textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 10, marginBottom: 4 }}>+{model.earnedCoins}</Text>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#FDE68A', letterSpacing: 1.5, textTransform: 'uppercase' }}>Coins Earned</Text>
                </View>
              )}
            </View>
          </View>
        </Animated.View>
      </ScrollView>

      <Animated.View style={{ paddingHorizontal: 24, paddingBottom: 48, backgroundColor: 'transparent', alignItems: 'center', opacity: btnOpacity }}>
        <TouchableOpacity onPress={startRewardAnimation} style={{ width: '100%', height: 58, borderRadius: 20, overflow: 'hidden', shadowColor: '#10b981', shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8 }}>
          <LinearGradient colors={['#10b981', '#059669']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 8 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 }}>Collect Rewards</Text>
            <Ionicons name="arrow-forward-outline" size={18} color="#FFFFFF" />
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {particleAnims.map((particle, index) => {
          const type = particleTypes[index];
          return (
            <Animated.View key={index} style={{ position: 'absolute', left: 0, top: 0, transform: [{ translateX: particle.pos.x }, { translateY: particle.pos.y }, { scale: particle.scale }], opacity: particle.opacity, zIndex: 9999, shadowColor: type === 'leaf' ? '#10b981' : '#F59E0B', shadowRadius: 10, shadowOpacity: 0.8, shadowOffset: { width: 0, height: 0 }, elevation: 10 }}>
              <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: type === 'coin' ? 'transparent' : '#10b981', justifyContent: 'center', alignItems: 'center', borderWidth: type === 'coin' ? 0 : 2, borderColor: '#FFF' }}>
                {type === 'coin' ? (
                  <Image source={require('../../../assets/coin.png')} style={{ width: 34, height: 34, resizeMode: 'contain' }} />
                ) : (
                  <Ionicons name="leaf" size={16} color="#FFF" />
                )}
              </View>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}
`;

// Insert component before OverlayRouter
content = content.replace('export function OverlayRouter({ model }: { model: EcoBudMobileModel }) {', componentCode + '\nexport function OverlayRouter({ model }: { model: EcoBudMobileModel }) {');

// Add case to OverlayRouter
content = content.replace("    case 'settings':\n      return <SettingsOverlay model={model} />;", "    case 'settings':\n      return <SettingsOverlay model={model} />;\n    case 'eventApproved':\n      return <EventApprovedOverlay model={model} />;");

fs.writeFileSync(filePath, content, 'utf8');
console.log('AppOverlays.tsx updated successfully via script.');
