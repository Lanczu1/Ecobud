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

// ProfileView (Rewards & Badges)
const newProfileView = `function ProfileView({ model }: { model: EcoBudMobileModel }) {
  return (
    <>
      <TopNavbar model={model} />
      <View style={styles.homeContent}>
        <View style={styles.availablePointsCard}>
          <Text style={styles.pointsLabel}>AVAILABLE POINTS</Text>
          <View style={{flexDirection: 'row', alignItems: 'baseline', marginBottom: 24}}>
            <Text style={styles.pointsBigValue}>{model.dashboard?.user.points?.toLocaleString() ?? '2,450'}</Text>
            <Text style={styles.pointsUnit}> Leaves</Text>
          </View>
          <View style={styles.rowBetween}>
            <TouchableOpacity style={styles.pointsBtnPrimary}><Text style={styles.pointsBtnPrimaryText}>Exchange Points</Text></TouchableOpacity>
            <TouchableOpacity style={styles.pointsBtnSecondary}><Text style={styles.pointsBtnSecondaryText}>History</Text></TouchableOpacity>
          </View>
        </View>

        <Text style={[styles.sectionHeadline, { marginTop: 24 }]}>Lifetime Journey</Text>
        <View style={styles.rowBetween}>
          <Text style={styles.metaText}>Level 12 • Forest Guardian</Text>
          <Text style={styles.taskMetaValueDark}>850 XP TO LEVEL 13</Text>
        </View>
        
        <View style={styles.carbonOffsetCard}>
          <View style={styles.carbonIconWrap}>
             <Ionicons name="leaf" size={24} color="#126027" />
          </View>
          <View style={{flex: 1}}>
             <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>Carbon Offset</Text>
                <Text style={styles.carbonValueDark}>1.2 Tons</Text>
             </View>
             <ProgressBar progress={70} />
          </View>
        </View>

        <Text style={[styles.sectionHeadline, { marginTop: 24 }]}>Collectible Badges</Text>
        <View style={styles.badgeGrid}>
           {/* Badge 1 */}
           <View style={styles.badgeCard}>
             <View style={styles.badgeCircleDark}>
                <Ionicons name="trash" size={32} color="#FFF" />
                <View style={styles.badgeTagGold}><Text style={styles.badgeTagGoldText}>GOLD</Text></View>
             </View>
             <Text style={styles.badgeTitle}>Waste Warrior</Text>
             <Text style={styles.badgeDesc}>Recycled for 30 consecutive days</Text>
           </View>

           {/* Badge 2 */}
           <View style={styles.badgeCard}>
             <View style={styles.badgeCircleMedium}>
                <Ionicons name="flash" size={32} color="#FFF" />
             </View>
             <Text style={styles.badgeTitle}>Energy Saver</Text>
             <Text style={styles.badgeDesc}>Reduced home energy by 15%</Text>
           </View>

           {/* Badge 3 Locked */}
           <View style={styles.badgeCard}>
             <View style={styles.badgeCircleLight}>
                <Ionicons name="bicycle" size={32} color="#B0C4B8" />
             </View>
             <Text style={styles.badgeTitleLight}>Pedal Power</Text>
             <View style={styles.lockedRow}>
               <Ionicons name="lock-closed" size={12} color="#126027" />
               <Text style={styles.lockedText}>LOCKED</Text>
             </View>
             <View style={{width: 60, alignSelf:'center', marginTop: 8}}><ProgressBar progress={30} /></View>
           </View>

           {/* Badge 4 Locked */}
           <View style={styles.badgeCard}>
             <View style={styles.badgeCircleLight}>
                <Ionicons name="water" size={32} color="#B0C4B8" />
             </View>
             <Text style={styles.badgeTitleLight}>Water Wise</Text>
             <View style={styles.lockedRow}>
               <Ionicons name="lock-closed" size={12} color="#126027" />
               <Text style={styles.lockedText}>LOCKED</Text>
             </View>
             <View style={{width: 60, alignSelf:'center', marginTop: 8}}><ProgressBar progress={10} /></View>
           </View>
        </View>

        <View style={styles.nftPromoCardLight}>
          <Image source={{ uri: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?q=80&w=200&auto=format&fit=crop' }} style={styles.nftPromoLightImg} />
          <View style={{flex: 1}}>
             <Text style={styles.welcomeLabel}>NEW CHALLENGE</Text>
             <Text style={styles.nftPromoTitleDark}>Plant 10 Seeds this week</Text>
             <Text style={styles.nftPromoDescDark}>Earn the "Garden Guardian" badge and +500 leaves.</Text>
          </View>
        </View>

        <View style={{height: 100}} />
      </View>
    <//>
  );
}`;
code = replaceFunction(code, 'function ProfileView({ model }: { model: EcoBudMobileModel })', newProfileView);

// LearnView
const newLearnView = `function LearnView({ model }: { model: EcoBudMobileModel }) {
  return (
    <>
      <TopNavbar model={model} />
      <View style={styles.homeContent}>
        
        <ImageBackground source={{ uri: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?q=80&w=800&auto=format&fit=crop' }} style={styles.featuredProgramCard} imageStyle={{ borderRadius: 24 }}>
          <View style={styles.featuredProgramOverlay} />
          <View style={styles.featuredProgramContent}>
            <View style={{ flexDirection: 'row', marginBottom: 12 }}>
              <View style={styles.tagLight}><Text style={styles.tagLightText}>FEATURED COURSE</Text></View>
            </View>
            <Text style={styles.featuredProgramTitle}>Mastering Zero Waste: A Complete Guide</Text>
            <Text style={styles.featuredProgramDesc}>Learn the essential strategies to reduce your footprint and live a circular life through professional-led video lessons.</Text>
            
            <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
               <TouchableOpacity style={styles.featuredProgramBtn}>
                 <Ionicons name="play-circle" size={18} color="#FFF" style={{marginRight: 6}} />
                 <Text style={styles.featuredProgramBtnText}>Start Lesson</Text>
               </TouchableOpacity>

               <View style={{ flexDirection: 'row', gap: -8 }}>
                  <View style={styles.nftAvatar}><Image source={{uri: 'https://i.pravatar.cc/100?img=1'}} style={{width:'100%', height:'100%', borderRadius: 12}}/></View>
                  <View style={styles.nftAvatar}><Image source={{uri: 'https://i.pravatar.cc/100?img=2'}} style={{width:'100%', height:'100%', borderRadius: 12}}/></View>
                  <View style={styles.nftAvatar}><Image source={{uri: 'https://i.pravatar.cc/100?img=3'}} style={{width:'100%', height:'100%', borderRadius: 12}}/></View>
                  <View style={[styles.nftAvatar, {backgroundColor: '#1E4C31'}]}><Text style={{color: '#FFF', fontSize: 10, fontWeight: 'bold'}}>+12k</Text></View>
               </View>
            </View>
          </View>
        </ImageBackground>

        <View style={{marginTop: 24}}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>Your Learning Path</Text>
            <Text style={styles.taskMetaValueDark}>65% Complete</Text>
          </View>
          <ProgressBar progress={65} />
          <Text style={styles.metaTextSmall}>Next: Micro-plastic Awareness (15 min)</Text>
        </View>

        <View style={styles.knowledgePointsCard}>
           <View style={styles.knowledgeIconWrap}>
              <MaterialCommunityIcons name="star-four-points" size={24} color="#FFF" />
           </View>
           <View>
              <Text style={styles.knowledgePointsLabel}>KNOWLEDGE POINTS</Text>
              <Text style={styles.knowledgePointsValue}>2,450</Text>
           </View>
        </View>

        <View style={[styles.rowBetween, { marginTop: 24 }]}>
          <View>
            <Text style={styles.sectionHeadline}>Browse Categories</Text>
            <Text style={styles.pageSubtitle}>Structured knowledge for a greener future</Text>
          </View>
          <TouchableOpacity><Text style={styles.taskMetaValueDark}>View All →</Text></TouchableOpacity>
        </View>
        
        <ImageBackground source={{ uri: 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?q=80&w=800&auto=format&fit=crop' }} style={styles.categoryLargeCard} imageStyle={{ borderRadius: 24 }}>
          <View style={styles.categoryLargeOverlay} />
          <View style={styles.featuredProgramContent}>
            <Text style={styles.categoryLargeTitle}>Waste Management Basics</Text>
            <Text style={styles.categoryLargeDesc}>Master sorting, recycling, and composting like a pro.</Text>
            <View style={{flexDirection: 'row', gap: 16}}>
               <View style={styles.rowMeta}><Ionicons name="document-text" size={14} color="#FFF"/><Text style={styles.metaTextWhite}> 12 Lessons</Text></View>
               <View style={styles.rowMeta}><Ionicons name="time" size={14} color="#FFF"/><Text style={styles.metaTextWhite}> 4.5 Hours</Text></View>
            </View>
          </View>
        </ImageBackground>

        <View style={styles.categoryMediumCard}>
           <View style={styles.badgeCircleLightGreen}><Ionicons name="leaf" size={18} color="#FFF" /></View>
           <Text style={styles.categoryMediumTitle}>Sustainable Living 101</Text>
           <Text style={styles.categoryMediumDesc}>Fundamental habits for an eco-conscious lifestyle.</Text>
           <TouchableOpacity style={styles.categoryOutlineBtn}><Text style={styles.categoryOutlineBtnText}>Start Learning</Text></TouchableOpacity>
        </View>

        <View style={styles.categorySmallCard}>
           <Ionicons name="water" size={18} color="#126027" />
           <Text style={styles.cardTitle}>Water Conservation</Text>
           <Text style={styles.metaTextSmallDark}>Reducing domestic water usage and footprint.</Text>
        </View>

        <View style={styles.categorySmallCard}>
           <Ionicons name="flash" size={18} color="#126027" />
           <Text style={styles.cardTitle}>Renewable Energy</Text>
           <Text style={styles.metaTextSmallDark}>Understanding solar, wind, and smart grids.</Text>
        </View>

        <View style={styles.categorySmallCard}>
           <Ionicons name="basket" size={18} color="#126027" />
           <Text style={styles.cardTitle}>Ethical Consumerism</Text>
           <Text style={styles.metaTextSmallDark}>How to shop with impact and transparency.</Text>
        </View>

        <Text style={[styles.sectionHeadline, { marginTop: 24, marginBottom: 16 }]}>Active Courses</Text>
        
        <View style={styles.activeCourseRow}>
          <Image source={{ uri: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?q=80&w=200&auto=format&fit=crop' }} style={styles.courseThumb} />
          <View style={{flex: 1}}>
             <Text style={styles.cardTitle}>Circular Economy Principles</Text>
             <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
               <View style={{flex: 1}}><ProgressBar progress={30} /></View>
               <Text style={styles.coursePercentText}>30% SEEN</Text>
             </View>
          </View>
          <Ionicons name="play-circle" size={32} color="#126027" />
        </View>

        <View style={styles.activeCourseRow}>
          <Image source={{ uri: 'https://images.unsplash.com/photo-1585320806055-e7bb0fff6ca2?q=80&w=200&auto=format&fit=crop' }} style={styles.courseThumb} />
          <View style={{flex: 1}}>
             <Text style={styles.cardTitle}>Urban Gardening & Composting</Text>
             <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
               <View style={{flex: 1}}><ProgressBar progress={80} /></View>
               <Text style={styles.coursePercentText}>80% SEEN</Text>
             </View>
          </View>
          <Ionicons name="play-circle" size={32} color="#126027" />
        </View>

        <View style={{height: 100}} />
      </View>
    <//>
  );
}`;
code = replaceFunction(code, 'function LearnView({ model }: { model: EcoBudMobileModel })', newLearnView);

// OverlayRouter (injecting Events view into it or modifying how Events is accessed)
// But wait! The images show "Eco Events" as a separate screen OR tab. Looking at the bottom tab bar of Eco Events, it highlights "LEARN"! 
// So maybe Eco Events is a sub-page accessed from Learn?
// Let's create an EventsOverlay that matches this UI.
const newEventsOverlay = `function EventsOverlay({ model }: { model: EcoBudMobileModel }) {
  return (
    <View style={styles.fullscreenOverlay}>
      <TopNavbar model={model} showBack={true} />
      <ScrollView contentContainerStyle={styles.homeContent}>
        <Text style={styles.welcomeLabel}>DIRECTORY</Text>
        <View style={styles.rowBetween}>
          <Text style={styles.pageTitle}>Eco Events</Text>
          <View style={styles.filterPillGroup}>
             <View style={styles.filterPillActive}><MaterialCommunityIcons name="view-list" size={16} color="#126027"/><Text style={styles.filterPillActiveText}> List</Text></View>
             <View style={styles.filterPillInactive}><MaterialCommunityIcons name="map" size={16} color="#6B7A75"/><Text style={styles.filterPillInactiveText}> Map</Text></View>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 8, marginTop: 16, marginBottom: 24}}>
           <View style={styles.categoryPillActive}><Text style={styles.categoryPillActiveText}>All Events</Text></View>
           <View style={styles.categoryPillInactive}><Text style={styles.categoryPillInactiveText}>Clean-ups</Text></View>
           <View style={styles.categoryPillInactive}><Text style={styles.categoryPillInactiveText}>Tree Planting</Text></View>
        </ScrollView>

        <ImageBackground source={{ uri: 'https://images.unsplash.com/photo-1618477461853-cf6ed80fabe5?q=80&w=800&auto=format&fit=crop' }} style={styles.eventFeaturedCard} imageStyle={{ borderRadius: 24 }}>
          <View style={styles.eventFeaturedOverlay} />
          <View style={styles.featuredProgramContent}>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 'auto' }}>
              <View style={styles.tagLight}><Text style={styles.tagLightText}>FEATURED</Text></View>
              <View style={styles.tagDark}><Text style={styles.tagDarkText}>CLEAN-UP</Text></View>
            </View>
            
            <View style={{flexDirection: 'row', gap: 16, marginBottom: 8, marginTop: 40}}>
               <View style={styles.rowMeta}><Ionicons name="calendar" size={14} color="#FFF"/><Text style={styles.metaTextWhite}> Oct 24, 2024</Text></View>
               <View style={styles.rowMeta}><Ionicons name="location" size={14} color="#FFF"/><Text style={styles.metaTextWhite}> Crystal Bay</Text></View>
            </View>
            <Text style={styles.featuredProgramTitle}>The Great Coastal Sweep</Text>
            
            <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
               <View style={{ flexDirection: 'row', gap: -8 }}>
                  <View style={styles.nftAvatar}><Image source={{uri: 'https://i.pravatar.cc/100?img=4'}} style={{width:'100%', height:'100%', borderRadius: 12}}/></View>
                  <View style={styles.nftAvatar}><Image source={{uri: 'https://i.pravatar.cc/100?img=5'}} style={{width:'100%', height:'100%', borderRadius: 12}}/></View>
                  <View style={styles.nftAvatar}><Image source={{uri: 'https://i.pravatar.cc/100?img=6'}} style={{width:'100%', height:'100%', borderRadius: 12}}/></View>
                  <View style={[styles.nftAvatar, {backgroundColor: '#1E4C31'}]}><Text style={{color: '#FFF', fontSize: 10, fontWeight: 'bold'}}>+142</Text></View>
               </View>
               <TouchableOpacity style={styles.eventJoinBtnInfo}>
                 <Text style={styles.eventJoinBtnInfoText}>Join Event</Text>
               </TouchableOpacity>
            </View>
          </View>
        </ImageBackground>

        <View style={styles.eventListCard}>
          <ImageBackground source={{ uri: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?q=80&w=800&auto=format&fit=crop' }} style={styles.eventListImg} imageStyle={{ borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
             <View style={styles.dateTagRight}><Text style={styles.dateTagRightText}>OCT 28</Text></View>
          </ImageBackground>
          <View style={styles.eventListBody}>
            <Text style={styles.welcomeLabel}>TREE PLANTING</Text>
            <Text style={styles.cardTitle}>Urban Forest Revival</Text>
            <View style={[styles.rowMeta, {marginBottom: 16}]}><Ionicons name="location" size={14} color="#6B7A75"/><Text style={styles.metaTextSmallDark}> Lincoln Park, NYC</Text></View>
            <TouchableOpacity style={styles.quickJoinBtn}><Text style={styles.quickJoinBtnText}>Quick Join</Text></TouchableOpacity>
          </View>
        </View>

        <View style={styles.eventListCard}>
          <ImageBackground source={{ uri: 'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=800&auto=format&fit=crop' }} style={styles.eventListImg} imageStyle={{ borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
             <View style={styles.dateTagRight}><Text style={styles.dateTagRightText}>NOV 02</Text></View>
          </ImageBackground>
          <View style={styles.eventListBody}>
            <Text style={styles.welcomeLabel}>WORKSHOP</Text>
            <Text style={styles.cardTitle}>Zero-Waste Living 101</Text>
            <View style={[styles.rowMeta, {marginBottom: 16}]}><Ionicons name="location" size={14} color="#6B7A75"/><Text style={styles.metaTextSmallDark}> Community Hub</Text></View>
            <TouchableOpacity style={styles.quickJoinBtn}><Text style={styles.quickJoinBtnText}>Quick Join</Text></TouchableOpacity>
          </View>
        </View>

        <View style={styles.eventListCard}>
          <ImageBackground source={{ uri: 'https://images.unsplash.com/photo-1531206715517-5c0ba140fea2?q=80&w=800&auto=format&fit=crop' }} style={styles.eventListImg} imageStyle={{ borderTopLeftRadius: 24, borderTopRightRadius: 24 }} />
          <View style={styles.eventListBody}>
            <Text style={styles.welcomeLabel}>CAMPAIGN</Text>
            <Text style={styles.cardTitle}>Eco March for Climate</Text>
            <Text style={styles.metaTextSmallDark}>Join thousands as we walk for a greener future and advocate for sustainable policies in our city center.</Text>
            
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16}}>
               <View>
                  <Text style={styles.metaTextSmallDark}>DATE</Text>
                  <Text style={styles.cardTitle}>Nov 15, 2024</Text>
               </View>
               <TouchableOpacity style={styles.circularAddBtn}>
                  <Ionicons name="add" size={24} color="#FFF" />
               </TouchableOpacity>
            </View>
          </View>
        </View>

      <View style={{height: 100}} />
      </ScrollView>
    </View>
  );
}`;
// App.tsx currently has an EventsOverlay somewhere. Let's try replacing it if it exists, otherwise just declare it.
code = replaceFunction(code, 'function EventsOverlay({ model }: { model: EcoBudMobileModel })', newEventsOverlay);

fs.writeFileSync(targetFile, code);
console.log("Replaced Profile, Learn, Events");
