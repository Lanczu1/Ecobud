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

const newBottomTabBar = `function BottomTabBar({
  activeTab,
  onChange,
}: {
  activeTab: AppTab;
  onChange: (tab: AppTab) => void;
}) {
  const tabs: { id: AppTab; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
    { id: 'home', icon: 'home', label: 'HOME' },
    { id: 'learn', icon: 'book', label: 'LEARN' },
    { id: 'challenges', icon: 'trophy', label: 'CHALLENGES' },
    { id: 'profile', icon: 'person', label: 'PROFILE' },
  ];

  return (
    <View style={styles.bottomTabBar}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <Pressable key={tab.id} style={styles.tabButton} onPress={() => onChange(tab.id)}>
            <View style={[styles.tabIconContainer, isActive && styles.tabIconActive]}>
              <Ionicons
                name={isActive ? tab.icon : (tab.icon + '-outline') as any}
                size={24}
                color={isActive ? '#126027' : '#6B7A75'}
              />
            </View>
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}`;
code = replaceFunction(code, 'function BottomTabBar({', newBottomTabBar);

const newLeaderboardOverlay = `function LeaderboardOverlay({ model }: { model: EcoBudMobileModel }) {
  return (
    <View style={styles.fullscreenOverlay}>
      <TopNavbar model={model} showBack={true} title="Leaderboard" />
      <View style={[styles.homeContent, {flex: 1}]}>
        <View style={styles.leaderboardFilterRow}>
          <TouchableOpacity style={[styles.filterPillActive, {flex: 1, justifyContent: 'center'}]}><Text style={styles.filterPillActiveText}>Global</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.filterPillInactive, {flex: 1, justifyContent: 'center'}]}><Text style={styles.filterPillInactiveText}>Friends</Text></TouchableOpacity>
        </View>

        <View style={styles.leaderboardTop3}>
           <View style={[styles.lbTopCard, {marginTop: 40}]}>
              <View style={styles.lbAvatarWrap}>
                 <Image source={{uri: 'https://i.pravatar.cc/150?img=12'}} style={styles.lbAvatarImg} />
                 <View style={[styles.lbRankBadge, {backgroundColor: '#B0BEC5'}]}><Text style={styles.lbRankText}>2</Text></View>
              </View>
              <Text style={styles.lbTopName}>Sarah M.</Text>
              <Text style={styles.lbTopPoints}>12.4k pts</Text>
           </View>
           <View style={styles.lbTopCard}>
              <View style={styles.lbAvatarWrap}>
                 <Image source={{uri: 'https://i.pravatar.cc/150?img=33'}} style={[styles.lbAvatarImg, {width: 80, height: 80}]} />
                 <View style={[styles.lbRankBadge, {backgroundColor: '#FFD700', width: 28, height: 28, borderRadius: 14}]}><Text style={[styles.lbRankText, {fontSize: 14}]}>1</Text></View>
              </View>
              <Text style={[styles.lbTopName, {fontSize: 18, fontWeight: 'bold'}]}>Alex Eco</Text>
              <Text style={[styles.lbTopPoints, {color: '#126027', fontWeight: 'bold'}]}>15.2k pts</Text>
           </View>
           <View style={[styles.lbTopCard, {marginTop: 40}]}>
              <View style={styles.lbAvatarWrap}>
                 <Image source={{uri: 'https://i.pravatar.cc/150?img=44'}} style={styles.lbAvatarImg} />
                 <View style={[styles.lbRankBadge, {backgroundColor: '#CD7F32'}]}><Text style={styles.lbRankText}>3</Text></View>
              </View>
              <Text style={styles.lbTopName}>John D.</Text>
              <Text style={styles.lbTopPoints}>11.1k pts</Text>
           </View>
        </View>

        <ScrollView style={{flex: 1, marginTop: 24, paddingHorizontal: 4}}>
           {[4,5,6,7,8,9,10].map(rank => (
             <View key={rank} style={styles.lbListRow}>
                <Text style={styles.lbListRank}>{rank}</Text>
                <Image source={{uri: \`https://i.pravatar.cc/100?img=\${rank+10}\`}} style={styles.lbListAvatar} />
                <View style={{flex: 1, marginLeft: 16}}>
                   <Text style={styles.cardTitle}>User {rank}</Text>
                </View>
                <Text style={styles.lbListPoints}>{11000 - rank*500} pts</Text>
             </View>
           ))}
        </ScrollView>
        
        <View style={styles.lbCurrentUserCard}>
           <Text style={styles.lbListRank}>42</Text>
           <Image source={{uri: model.session?.user.avatarUrl ?? 'https://i.pravatar.cc/100'}} style={styles.lbListAvatar} />
           <View style={{flex: 1, marginLeft: 16}}>
              <Text style={[styles.cardTitle, {color: '#FFF'}]}>You</Text>
           </View>
           <Text style={[styles.lbListPoints, {color: '#FFF'}]}>{model.dashboard?.user?.points ?? 2450} pts</Text>
        </View>

      </View>
    </View>
  );
}`;
code = replaceFunction(code, 'function LeaderboardOverlay({ model }: { model: EcoBudMobileModel })', newLeaderboardOverlay);

const newStyleAppends = `
  topNavbar: {
    paddingTop: 50,
    paddingHorizontal: 24,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F7F9F7',
  },
  topNavAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#4ADE80',
  },
  topNavTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#126027',
    letterSpacing: 2,
    flex: 1,
    textAlign: 'center',
  },
  topNavTitleDark: {
    color: '#1A211D',
  },
  topNavBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F59E0B',
  },
  homeContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  welcomeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7A75',
    letterSpacing: 1.5,
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1A211D',
    marginTop: 4,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#6B7A75',
    marginTop: 4,
    marginBottom: 24,
  },
  homeMetricRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  homeMetricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#126027',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  homeMetricIconWrapBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  homeMetricValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1A211D',
    marginBottom: 4,
  },
  homeMetricLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7A75',
    letterSpacing: 1,
  },
  weeklyGoalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#126027',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  weeklyGoalLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7A75',
    letterSpacing: 1,
    marginBottom: 12,
  },
  weeklyGoalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A211D',
    marginBottom: 12,
  },
  weeklyGoalText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7A75',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  todayChallengeCard: {
    backgroundColor: '#D4F7D4',
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#4ADE80',
  },
  challengeBadge: {
    backgroundColor: '#126027',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 16,
  },
  challengeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  todayChallengeTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#126027',
    marginBottom: 8,
  },
  todayChallengeDesc: {
    fontSize: 15,
    color: '#126027',
    opacity: 0.8,
    marginBottom: 24,
  },
  challengeCompleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
  },
  challengeCompleteBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#126027',
  },
  dailyTipCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#126027',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A211D',
    marginBottom: 4,
  },
  tipDesc: {
    fontSize: 14,
    color: '#6B7A75',
    lineHeight: 20,
  },
  tipImage: {
    width: 80,
    height: 80,
    borderRadius: 16,
  },
  articleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#126027',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
  },
  articleImage: {
    width: '100%',
    height: 160,
  },
  articleContent: {
    padding: 20,
  },
  articleTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A211D',
    flex: 1,
    marginRight: 16,
  },
  articleDesc: {
    fontSize: 14,
    color: '#6B7A75',
    lineHeight: 22,
    marginTop: 8,
  },
  bottomTabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingBottom: 32,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -5 },
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  tabButton: {
    alignItems: 'center',
    gap: 4,
  },
  tabIconContainer: {
    padding: 10,
    borderRadius: 16,
  },
  tabIconActive: {
    backgroundColor: '#EDF6F1',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6B7A75',
    letterSpacing: 0.5,
  },
  tabLabelActive: {
    color: '#126027',
    fontWeight: '800',
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1A211D',
  },
  pageSubtitle: {
    fontSize: 16,
    color: '#6B7A75',
    marginTop: 4,
  },
  habitSquareCard: {
    width: 140,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#126027',
    shadowOpacity: 0.05,
    shadowRadius: 12,
  },
  habitIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EDF6F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  habitTopText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A211D',
    textAlign: 'center',
    marginBottom: 4,
  },
  habitMetaText: {
    fontSize: 12,
    color: '#6B7A75',
    marginBottom: 16,
  },
  habitSquareBtn: {
    backgroundColor: '#126027',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
  },
  habitSquareBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ADE80',
    marginRight: 6,
  },
  habitActiveText: {
    color: '#126027',
    fontSize: 12,
    fontWeight: '800',
  },
  featuredProgramCard: {
    width: '100%',
    height: 380,
    borderRadius: 24,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    marginBottom: 24,
  },
  featuredProgramOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(18, 96, 39, 0.4)',
  },
  featuredProgramContent: {
    padding: 24,
  },
  tagDark: { backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  tagDarkText: { color: '#FFF', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  tagLight: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  tagLightText: { color: '#FFF', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  featuredProgramTitle: { fontSize: 24, fontWeight: '800', color: '#FFF', marginBottom: 8, lineHeight: 30 },
  featuredProgramDesc: { fontSize: 15, color: 'rgba(255,255,255,0.8)', marginBottom: 20, lineHeight: 22 },
  featuredProgramBtn: { backgroundColor: '#126027', paddingVertical: 14, borderRadius: 16, alignItems: 'center' },
  featuredProgramBtnText: { color: '#FFF', fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  featuredGlassBar: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 16, padding: 16, marginBottom: 16 },
  progressLabelLight: { color: '#FFF', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  progressTrackLight: { backgroundColor: 'rgba(255,255,255,0.3)', height: 6, borderRadius: 3, marginTop: 8 },
  progressFillLight: { backgroundColor: '#FFF', height: 6, borderRadius: 3 },
  taskCard: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 20, padding: 12, marginBottom: 16, alignItems: 'center' },
  taskCardImg: { width: 80, height: 80, borderRadius: 14 },
  taskCardBody: { flex: 1, paddingLeft: 16 },
  taskMetaLabel: { fontSize: 10, fontWeight: '800', color: '#4ADE80', letterSpacing: 1 },
  taskMetaValue: { fontSize: 10, fontWeight: '800', color: '#6B7A75' },
  taskCardTitle: { fontSize: 16, fontWeight: '700', color: '#1A211D', marginVertical: 6 },
  taskActionBtn: { backgroundColor: '#F0F5F2', paddingVertical: 8, borderRadius: 12, alignItems: 'center', marginTop: 12 },
  taskActionBtnText: { color: '#126027', fontSize: 12, fontWeight: '800' },
  nftPromoCard: { backgroundColor: '#126027', borderRadius: 24, padding: 20, marginTop: 16 },
  welcomeLabelLight: { fontSize: 10, fontWeight: '800', color: '#4ADE80', letterSpacing: 1.5, marginBottom: 8 },
  nftPromoTitle: { fontSize: 24, fontWeight: '800', color: '#FFF', marginBottom: 8 },
  nftPromoDesc: { fontSize: 14, color: 'rgba(255,255,255,0.8)', lineHeight: 20 },
  nftAvatar: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: '#126027', alignItems: 'center', justifyContent: 'center' },
  availablePointsCard: { backgroundColor: '#126027', padding: 24, borderRadius: 24, marginTop: 16 },
  pointsLabel: { color: '#4ADE80', fontSize: 12, fontWeight: '800', letterSpacing: 1, marginBottom: 12 },
  pointsBigValue: { color: '#FFF', fontSize: 48, fontWeight: '800' },
  pointsUnit: { color: 'rgba(255,255,255,0.7)', fontSize: 18, fontWeight: '600' },
  pointsBtnPrimary: { backgroundColor: '#FFF', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 16 },
  pointsBtnPrimaryText: { color: '#126027', fontSize: 14, fontWeight: '800' },
  pointsBtnSecondary: { backgroundColor: 'rgba(255,255,255,0.2)', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 16 },
  pointsBtnSecondaryText: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  taskMetaValueDark: { fontSize: 12, fontWeight: '800', color: '#126027' },
  carbonOffsetCard: { backgroundColor: '#FFF', borderRadius: 24, padding: 20, flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  carbonIconWrap: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#EDF6F1', alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  carbonValueDark: { fontSize: 16, fontWeight: '800', color: '#126027' },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 16 },
  badgeCard: { width: '47%', backgroundColor: '#FFF', borderRadius: 24, padding: 16, alignItems: 'center' },
  badgeCircleDark: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#126027', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  badgeCircleMedium: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#4ADE80', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  badgeCircleLight: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#F0F5F2', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  badgeCircleLightGreen: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#4ADE80', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  badgeTagGold: { position: 'absolute', bottom: -10, backgroundColor: '#F59E0B', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 2, borderColor: '#FFF' },
  badgeTagGoldText: { color: '#FFF', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  badgeTitle: { fontSize: 14, fontWeight: '800', color: '#1A211D', textAlign: 'center', marginBottom: 4 },
  badgeTitleLight: { fontSize: 14, fontWeight: '800', color: '#6B7A75', textAlign: 'center', marginBottom: 4 },
  badgeDesc: { fontSize: 12, color: '#6B7A75', textAlign: 'center' },
  lockedRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  lockedText: { fontSize: 10, fontWeight: '800', color: '#126027', letterSpacing: 1 },
  nftPromoCardLight: { backgroundColor: '#FFF', borderRadius: 24, padding: 16, flexDirection: 'row', alignItems: 'center', marginTop: 24 },
  nftPromoLightImg: { width: 80, height: 80, borderRadius: 16, marginRight: 16 },
  nftPromoTitleDark: { fontSize: 18, fontWeight: '800', color: '#1A211D', marginBottom: 4 },
  nftPromoDescDark: { fontSize: 12, color: '#6B7A75', lineHeight: 18 },
  metaTextSmall: { fontSize: 12, color: '#6B7A75', marginTop: 8 },
  metaTextSmallDark: { fontSize: 12, color: '#6B7A75', lineHeight: 18 },
  metaTextWhite: { fontSize: 12, color: '#FFF', fontWeight: '600' },
  knowledgePointsCard: { backgroundColor: '#F59E0B', borderRadius: 20, padding: 20, flexDirection: 'row', alignItems: 'center', marginTop: 24 },
  knowledgeIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  knowledgePointsLabel: { fontSize: 10, color: 'rgba(255,255,255,0.8)', fontWeight: '800', letterSpacing: 1 },
  knowledgePointsValue: { fontSize: 24, color: '#FFF', fontWeight: '800' },
  categoryLargeCard: { width: '100%', height: 200, borderRadius: 24, overflow: 'hidden', justifyContent: 'flex-end', marginTop: 16, marginBottom: 16 },
  categoryLargeOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(26, 33, 29, 0.5)' },
  categoryLargeTitle: { fontSize: 20, fontWeight: '800', color: '#FFF', marginBottom: 4 },
  categoryLargeDesc: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 16 },
  categoryMediumCard: { backgroundColor: '#126027', borderRadius: 24, padding: 24, marginBottom: 16 },
  categoryMediumTitle: { fontSize: 18, fontWeight: '800', color: '#FFF', marginBottom: 8 },
  categoryMediumDesc: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 16, lineHeight: 22 },
  categoryOutlineBtn: { borderWidth: 1, borderColor: '#4ADE80', borderRadius: 16, paddingVertical: 12, alignItems: 'center' },
  categoryOutlineBtnText: { color: '#4ADE80', fontSize: 14, fontWeight: '800' },
  categorySmallCard: { backgroundColor: '#FFF', padding: 16, borderRadius: 20, marginBottom: 12 },
  activeCourseRow: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 20, padding: 12, marginBottom: 12, alignItems: 'center' },
  courseThumb: { width: 60, height: 60, borderRadius: 12, marginRight: 16 },
  coursePercentText: { fontSize: 10, fontWeight: '800', color: '#6B7A75', letterSpacing: 1 },
  fullscreenOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#F7F9F7', zIndex: 100 },
  filterPillGroup: { flexDirection: 'row', backgroundColor: '#EDF6F1', borderRadius: 20, padding: 4 },
  filterPillActive: { flexDirection: 'row', backgroundColor: '#FFF', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, alignItems: 'center' },
  filterPillActiveText: { color: '#1A211D', fontSize: 12, fontWeight: '700' },
  filterPillInactive: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, alignItems: 'center' },
  filterPillInactiveText: { color: '#6B7A75', fontSize: 12, fontWeight: '600' },
  categoryPillActive: { backgroundColor: '#126027', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  categoryPillActiveText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  categoryPillInactive: { backgroundColor: '#FFF', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  categoryPillInactiveText: { color: '#6B7A75', fontSize: 14, fontWeight: '600' },
  eventFeaturedCard: { width: '100%', height: 350, borderRadius: 24, overflow: 'hidden', justifyContent: 'flex-end', marginBottom: 24 },
  eventFeaturedOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(26, 33, 29, 0.4)' },
  eventJoinBtnInfo: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16 },
  eventJoinBtnInfoText: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  eventListCard: { backgroundColor: '#FFF', borderRadius: 24, overflow: 'hidden', marginBottom: 20 },
  eventListImg: { width: '100%', height: 160 },
  dateTagRight: { position: 'absolute', right: 16, top: 16, backgroundColor: '#FFF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  dateTagRightText: { color: '#1A211D', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  eventListBody: { padding: 20 },
  quickJoinBtn: { backgroundColor: '#EDF6F1', paddingVertical: 12, borderRadius: 16, alignItems: 'center' },
  quickJoinBtnText: { color: '#126027', fontSize: 14, fontWeight: '800' },
  circularAddBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#126027', alignItems: 'center', justifyContent: 'center' },
  leaderboardFilterRow: { flexDirection: 'row', backgroundColor: '#EDF6F1', borderRadius: 20, padding: 4, marginTop: 16 },
  leaderboardTop3: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 32, paddingHorizontal: 16 },
  lbTopCard: { alignItems: 'center', width: '30%' },
  lbAvatarWrap: { marginBottom: 12, alignItems: 'center' },
  lbAvatarImg: { width: 64, height: 64, borderRadius: 32, borderWidth: 3, borderColor: '#FFF' },
  lbRankBadge: { position: 'absolute', bottom: -8, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFF' },
  lbRankText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  lbTopName: { fontSize: 16, fontWeight: '700', color: '#1A211D', marginBottom: 4 },
  lbTopPoints: { fontSize: 14, fontWeight: '600', color: '#6B7A75' },
  lbListRow: { flexDirection: 'row', backgroundColor: '#FFF', alignItems: 'center', padding: 12, borderRadius: 20, marginBottom: 8 },
  lbListRank: { width: 30, fontSize: 16, fontWeight: '800', color: '#6B7A75', textAlign: 'center' },
  lbListAvatar: { width: 40, height: 40, borderRadius: 20 },
  lbListPoints: { fontSize: 14, fontWeight: '800', color: '#126027' },
  lbCurrentUserCard: { flexDirection: 'row', backgroundColor: '#126027', alignItems: 'center', padding: 16, borderRadius: 24, position: 'absolute', bottom: 32, left: 24, right: 24, shadowColor: '#126027', shadowOpacity: 0.2, shadowRadius: 10 },
`;

const styleInsertionIndex = code.lastIndexOf('});');
if (styleInsertionIndex !== -1) {
    code = code.substring(0, styleInsertionIndex) + newStyleAppends + code.substring(styleInsertionIndex);
    console.log("Successfully appended new styles.");
}

fs.writeFileSync(targetFile, code);
