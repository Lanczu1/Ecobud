const fs = require('fs');
const file = 'apps/mobile/src/app/components/AppOverlays.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add map imports
content = content.replace(
  'import * as ImagePicker from \'expo-image-picker\';',
  'import * as ImagePicker from \'expo-image-picker\';\nimport MapView, { Marker, PROVIDER_DEFAULT } from \'react-native-maps\';\nimport * as Location from \'expo-location\';'
);

// 2. Replace EventsOverlay
const searchStart = 'export function EventsOverlay({ model }: { model: EcoBudMobileModel }) {';
const searchEnd = 'export function LessonOverlay({ model }: { model: EcoBudMobileModel }) {';
const startIdx = content.indexOf(searchStart);
const endIdx = content.indexOf(searchEnd);

if (startIdx === -1 || endIdx === -1) {
  console.error('Could not find EventsOverlay boundaries');
  process.exit(1);
}

const replacement = `export function EventsOverlay({ model }: { model: EcoBudMobileModel }) {
  const [viewMode, setViewMode] = React.useState<'list' | 'map'>('list');
  const [userLocation, setUserLocation] = React.useState<{ latitude: number; longitude: number } | null>(null);

  React.useEffect(() => {
    if (viewMode === 'map') {
      (async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({});
          setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        }
      })();
    }
  }, [viewMode]);

  const featuredEvent = model.events[0] ?? null;
  const otherEvents = featuredEvent ? model.events.slice(1) : model.events;

  return (
    <View style={styles.fullscreenOverlay}>
      <TopNavbar model={model} showBack={true} />
      <ScrollView contentContainerStyle={styles.homeContent}>
        <Text style={styles.welcomeLabel}>DIRECTORY</Text>
        <View style={styles.rowBetween}>
          <Text style={styles.pageTitle}>Eco Events</Text>
          <View style={styles.filterPillGroup}>
            <TouchableOpacity onPress={() => setViewMode('list')} style={viewMode === 'list' ? styles.filterPillActive : styles.filterPillInactive}>
              <MaterialCommunityIcons name="view-list" size={16} color={viewMode === 'list' ? "#126027" : "#6B7A75"} />
              <Text style={viewMode === 'list' ? styles.filterPillActiveText : styles.filterPillInactiveText}> List</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setViewMode('map')} style={viewMode === 'map' ? styles.filterPillActive : styles.filterPillInactive}>
              <MaterialCommunityIcons name="map" size={16} color={viewMode === 'map' ? "#126027" : "#6B7A75"} />
              <Text style={viewMode === 'map' ? styles.filterPillActiveText : styles.filterPillInactiveText}> Map</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 16, marginBottom: 24 }}>
          <View style={styles.categoryPillActive}><Text style={styles.categoryPillActiveText}>All Events</Text></View>
          <View style={styles.categoryPillInactive}><Text style={styles.categoryPillInactiveText}>Clean-ups</Text></View>
          <View style={styles.categoryPillInactive}><Text style={styles.categoryPillInactiveText}>Tree Planting</Text></View>
        </ScrollView>

        {viewMode === 'map' ? (
          <View style={{ height: 500, borderRadius: 24, overflow: 'hidden', marginTop: 8 }}>
            <MapView
              provider={PROVIDER_DEFAULT}
              style={{ flex: 1 }}
              showsUserLocation={true}
              initialRegion={{
                latitude: userLocation?.latitude ?? 14.5995,
                longitude: userLocation?.longitude ?? 120.9842,
                latitudeDelta: 0.0922,
                longitudeDelta: 0.0421,
              }}
            >
              {model.events.map((event) => {
                if (!event.latitude || !event.longitude) return null;
                return (
                  <Marker
                    key={event.id}
                    coordinate={{ latitude: event.latitude, longitude: event.longitude }}
                    title={event.title}
                    description={event.location}
                    onCalloutPress={() => {
                      if (!model.isReadOnlyExperience) {
                        void model.handleJoinEvent(event.id);
                      }
                    }}
                  />
                );
              })}
            </MapView>
          </View>
        ) : (
          <>
            {featuredEvent ? (
              <ImageBackground
                source={{ uri: featuredEvent.imageUrl ?? 'https://images.unsplash.com/photo-1618477461853-cf6ed80fabe5?q=80&w=800&auto=format&fit=crop' }}
                style={styles.eventFeaturedCard}
                imageStyle={{ borderRadius: 24 }}
              >
                <View style={styles.eventFeaturedOverlay} />
                <View style={styles.featuredProgramContent}>
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 'auto' }}>
                    <View style={styles.tagLight}><Text style={styles.tagLightText}>FEATURED</Text></View>
                    <View style={styles.tagDark}><Text style={styles.tagDarkText}>PUBLIC EVENT</Text></View>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 16, marginBottom: 8, marginTop: 40 }}>
                    <View style={styles.rowMeta}><Ionicons name="calendar" size={14} color="#FFF" /><Text style={styles.metaTextWhite}> {formatLongDate(featuredEvent.date)}</Text></View>
                    <View style={styles.rowMeta}><Ionicons name="location" size={14} color="#FFF" /><Text style={styles.metaTextWhite}> {featuredEvent.location}</Text></View>
                  </View>
                  <Text style={styles.featuredProgramTitle}>{featuredEvent.title}</Text>
                  <Text style={styles.featuredProgramDesc}>{featuredEvent.description}</Text>

                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={styles.metaTextWhite}>
                      {featuredEvent.spotsLeft != null ? \`\${featuredEvent.spotsLeft} spots left\` : \`\${featuredEvent.pointsReward} ECO points reward\`}
                    </Text>
                    <TouchableOpacity
                      style={styles.eventJoinBtnInfo}
                      onPress={() => (
                        model.isReadOnlyExperience
                          ? void model.leaveReadOnlyAccess()
                          : void model.handleJoinEvent(featuredEvent.id)
                      )}
                    >
                      <Text style={styles.eventJoinBtnInfoText}>
                        {model.isReadOnlyExperience ? 'Sign In to Join' : 'Join Event'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ImageBackground>
            ) : (
              <SurfaceCard style={styles.publicInfoCard}>
                <Text style={styles.sectionHeadline}>No public events yet</Text>
                <Text style={styles.metaTextSmallDark}>Check back soon for new clean-ups, workshops, and community eco campaigns.</Text>
              </SurfaceCard>
            )}

            {otherEvents.map((event) => (
              <View key={event.id} style={styles.eventListCard}>
                <ImageBackground
                  source={{ uri: event.imageUrl ?? 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?q=80&w=800&auto=format&fit=crop' }}
                  style={styles.eventListImg}
                  imageStyle={{ borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
                >
                  <View style={styles.dateTagRight}><Text style={styles.dateTagRightText}>{formatEventDateTag(event.date)}</Text></View>
                </ImageBackground>
                <View style={styles.eventListBody}>
                  <Text style={styles.welcomeLabel}>PUBLIC EVENT</Text>
                  <Text style={styles.cardTitle}>{event.title}</Text>
                  <Text style={styles.metaTextSmallDark}>{event.description}</Text>
                  <View style={[styles.rowMeta, { marginTop: 12 }]}>
                    <Ionicons name="location" size={14} color="#6B7A75" />
                    <Text style={styles.metaTextSmallDark}> {event.location}</Text>
                  </View>
                  <View style={[styles.rowMeta, { marginBottom: 16 }]}>
                    <Ionicons name="leaf" size={14} color="#6B7A75" />
                    <Text style={styles.metaTextSmallDark}> {event.pointsReward} ECO points reward</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.quickJoinBtn}
                    onPress={() => (
                      model.isReadOnlyExperience
                        ? void model.leaveReadOnlyAccess()
                        : void model.handleJoinEvent(event.id)
                    )}
                  >
                    <Text style={styles.quickJoinBtnText}>
                      {model.isReadOnlyExperience ? 'Sign In to Join' : 'Quick Join'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

`;

const newContent = content.substring(0, startIdx) + replacement + content.substring(endIdx);
fs.writeFileSync(file, newContent);
console.log('Successfully patched AppOverlays.tsx');
