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

// TopNavbar
code = replaceFunction(code, 'function TopNavbar', ''); // Delete if exists
const topNavContent = `function TopNavbar({ model, title, showBack }: { model: EcoBudMobileModel; title?: string; showBack?: boolean }) {
  return (
    <View style={styles.topNavbar}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {showBack ? (
          <TouchableOpacity onPress={() => model.setActiveOverlay(null)} style={{ marginRight: 12 }}>
            <Feather name="arrow-left" size={24} color="#1A211D" />
          </TouchableOpacity>
        ) : (
          <Image source={{ uri: model.session?.user.avatarUrl ?? 'https://i.pravatar.cc/150?u=' + (model.session?.user.id || '1') }} style={styles.topNavAvatar} />
        )}
      </View>
      <Text style={[styles.topNavTitle, title ? styles.topNavTitleDark : {}]}>{title || 'ECOBUD'}</Text>
      <TouchableOpacity>
        <Ionicons name="notifications" size={24} color="#126027" />
        {model.notificationCount > 0 && <View style={styles.topNavBadge} />}
      </TouchableOpacity>
    </View>
  );
}`;
// Insert TopNavbar above HomeView if it doesn't exist
if (!code.includes('function TopNavbar')) {
    code = code.replace('function HomeView', topNavContent + '\n\nfunction HomeView');
} else {
    code = replaceFunction(code, 'function TopNavbar({ model, title, showBack }:', topNavContent);
}

// BottomTabBar replacement
const newBottomTabBar = `function BottomTabBar({ model }: { model: EcoBudMobileModel }) {
  const tabs: { id: AppTab; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
    { id: 'home', icon: 'home', label: 'HOME' },
    { id: 'learn', icon: 'book', label: 'LEARN' },
    { id: 'challenges', icon: 'trophy', label: 'CHALLENGES' },
    { id: 'profile', icon: 'person', label: 'PROFILE' },
  ];

  return (
    <View style={styles.bottomTabBar}>
      {tabs.map((tab) => {
        const isActive = model.activeTab === tab.id;
        return (
          <Pressable key={tab.id} style={styles.tabButton} onPress={() => model.setActiveTab(tab.id)}>
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
code = replaceFunction(code, 'function BottomTabBar({ model }: { model: EcoBudMobileModel })', newBottomTabBar);

// HomeView
const newHomeView = `function HomeView({ model }: { model: EcoBudMobileModel }) {
  return (
    <>
      <TopNavbar model={model} />
      <View style={styles.homeContent}>
        <Text style={styles.welcomeLabel}>WELCOME BACK</Text>
        <Text style={styles.welcomeTitle}>Hello, {model.userDisplayName.split(' ')[0]}!</Text>
        <Text style={styles.welcomeSubtitle}>You've saved 4.2kg of CO2 today.</Text>

        <View style={styles.homeMetricRow}>
          <View style={styles.homeMetricCard}>
            <View style={styles.homeMetricIconWrapBadge}>
               <MaterialCommunityIcons name="fire" size={20} color="#126027" />
            </View>
            <Text style={styles.homeMetricValue}>{model.dashboard?.user.currentStreak ?? model.session?.user.currentStreak ?? 0}</Text>
            <Text style={styles.homeMetricLabel}>DAY STREAK</Text>
          </View>
          <View style={styles.homeMetricCard}>
            <View style={[styles.homeMetricIconWrapBadge, { backgroundColor: '#F0F5F2' }]}>
               <Ionicons name="leaf" size={18} color="#126027" />
            </View>
            <Text style={styles.homeMetricValue}>{model.dashboard?.user.points ?? model.session?.user.points ?? 0}</Text>
            <Text style={styles.homeMetricLabel}>ECO POINTS</Text>
          </View>
        </View>

        <View style={styles.weeklyGoalCard}>
          <Text style={styles.weeklyGoalLabel}>WEEKLY GOAL</Text>
          <View style={styles.rowBetween}>
            <Text style={styles.weeklyGoalTitle}>85% Complete</Text>
            <Text style={styles.weeklyGoalText}>15kg / 20kg</Text>
          </View>
          <ProgressBar progress={85} />
        </View>

        {model.dashboard?.dailyChallenge ? (
          <View style={styles.todayChallengeCard}>
            <View style={styles.challengeBadge}>
              <Text style={styles.challengeBadgeText}>TODAY'S CHALLENGE</Text>
            </View>
            <Text style={styles.todayChallengeTitle}>{model.dashboard.dailyChallenge.title}</Text>
            <Text style={styles.todayChallengeDesc}>{model.dashboard.dailyChallenge.description}</Text>
            <TouchableOpacity style={styles.challengeCompleteBtn} onPress={() => void model.handleChallengeProgress(model.dashboard!.dailyChallenge!, 100)}>
              <Ionicons name="checkmark-circle" size={18} color="#126027" />
              <Text style={styles.challengeCompleteBtnText}>Mark as Complete</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.dailyTipCard}>
          <View style={{ flex: 1, paddingRight: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <MaterialCommunityIcons name="lightbulb-on" size={12} color="#126027" />
              <Text style={[styles.welcomeLabel, { marginLeft: 4 }]}>DAILY TIP</Text>
            </View>
            <Text style={styles.tipTitle}>Cold Wash Advantage</Text>
            <Text style={styles.tipDesc}>Washing clothes at 30°C instead of 40°C can save up to 40% of energy usage over a year.</Text>
          </View>
          <Image source={{ uri: 'https://images.unsplash.com/photo-1582735689369-dbcf0e2c8a7b?q=80&w=400&auto=format&fit=crop' }} style={styles.tipImage} />
        </View>

        <View style={styles.articleCard}>
          <Image source={{ uri: 'https://images.unsplash.com/photo-1448375240586-882707db888b?q=80&w=800&auto=format&fit=crop' }} style={styles.articleImage} />
          <View style={styles.articleContent}>
            <View style={styles.rowBetween}>
              <Text style={styles.articleTitle}>Understanding Carbon Sequestration</Text>
              <Feather name="arrow-right" size={20} color="#126027" />
            </View>
            <Text style={styles.articleDesc}>Learn how our local forests are the unsung heroes of climate stability and how you can...</Text>
          </View>
        </View>
        <View style={{height: 100}} />
      </View>
    <//>
  );
}`;
code = replaceFunction(code, 'function HomeView({ model }: { model: EcoBudMobileModel })', newHomeView);

// ChallengesView
const newChallengesView = `function ChallengesView({ model }: { model: EcoBudMobileModel }) {
  return (
    <>
      <TopNavbar model={model} />
      <View style={styles.homeContent}>
        <Text style={styles.pageTitle}>Challenges</Text>
        <Text style={styles.pageSubtitle}>Turn your eco-intentions into daily impact.</Text>

        <View style={[styles.rowBetween, { marginTop: 24, marginBottom: 16 }]}>
          <Text style={styles.welcomeLabel}>TODAY'S HABITS</Text>
        </View>
        <Text style={[styles.sectionHeadline, { marginTop: 0 }]}>Consistency is Key</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 24, gap: 16, paddingBottom: 16 }}>
          {model.habitsToday?.items.map((habit) => (
            <View key={habit.id} style={styles.habitSquareCard}>
              <View style={styles.habitIconWrap}>
                 <Ionicons name="leaf" size={18} color="#126027" />
              </View>
              <Text style={styles.habitTopText}>{habit.title}</Text>
              <Text style={styles.habitMetaText}>Daily • {habit.pointsReward} XP</Text>
              <TouchableOpacity
                disabled={habit.completedToday}
                onPress={() => void model.handleHabitCheckIn(habit.id)}
                style={[styles.habitSquareBtn, habit.completedToday && { backgroundColor: 'transparent' }]}
              >
                {habit.completedToday ? (
                  <View style={{flexDirection: 'row', alignItems: 'center'}}>
                    <View style={styles.activeDot} />
                    <Text style={styles.habitActiveText}>ACTIVE</Text>
                  </View>
                ) : (
                  <Text style={styles.habitSquareBtnText}>LOG TASK</Text>
                )}
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>

        <Text style={[styles.welcomeLabel, { marginTop: 24, marginBottom: 8 }]}>ACTIVE CHALLENGES</Text>
        <Text style={styles.sectionHeadline}>Featured Programs</Text>

        <ImageBackground source={{ uri: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?q=80&w=800&auto=format&fit=crop' }} style={styles.featuredProgramCard} imageStyle={{ borderRadius: 24 }}>
          <View style={styles.featuredProgramOverlay} />
          <View style={styles.featuredProgramContent}>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <View style={styles.tagDark}><Text style={styles.tagDarkText}>HARD</Text></View>
              <View style={styles.tagLight}><Text style={styles.tagLightText}>1,200 XP</Text></View>
            </View>
            <Text style={styles.featuredProgramTitle}>The Forest Legacy Project</Text>
            <Text style={styles.featuredProgramDesc}>Commit to 30 days of plastic-free living and tree planting advocacy.</Text>
            
            <View style={styles.featuredGlassBar}>
               <View style={styles.rowBetween}>
                 <Text style={styles.progressLabelLight}>OVERALL PROGRESS</Text>
                 <Text style={styles.progressLabelLight}>65%</Text>
               </View>
               <View style={styles.progressTrackLight}>
                 <View style={[styles.progressFillLight, { width: '65%' }]} />
               </View>
            </View>
            <TouchableOpacity style={styles.featuredProgramBtn}>
              <Text style={styles.featuredProgramBtnText}>CONTINUE JOURNEY</Text>
            </TouchableOpacity>
          </View>
        </ImageBackground>

        <View style={styles.taskCard}>
          <Image source={{ uri: 'https://images.unsplash.com/photo-1585320806055-e7bb0fff6ca2?q=80&w=200&auto=format&fit=crop' }} style={styles.taskCardImg} />
          <View style={styles.taskCardBody}>
            <View style={styles.rowBetween}>
               <Text style={styles.taskMetaLabel}>INTERMEDIATE</Text>
               <Text style={styles.taskMetaValue}>4/10 DAYS</Text>
            </View>
            <Text style={styles.taskCardTitle}>Urban Micro-Garden</Text>
            <ProgressBar progress={40} />
            <TouchableOpacity style={styles.taskActionBtn}><Text style={styles.taskActionBtnText}>START TASK</Text></TouchableOpacity>
          </View>
        </View>
        <View style={styles.taskCard}>
          <Image source={{ uri: 'https://images.unsplash.com/photo-1433086966358-54859d0ed716?q=80&w=200&auto=format&fit=crop' }} style={styles.taskCardImg} />
          <View style={styles.taskCardBody}>
            <View style={styles.rowBetween}>
               <Text style={styles.taskMetaLabel}>BEGINNER</Text>
               <Text style={styles.taskMetaValue}>0/7 DAYS</Text>
            </View>
            <Text style={styles.taskCardTitle}>Pure Water Guardian</Text>
            <ProgressBar progress={0} />
            <TouchableOpacity style={styles.taskActionBtn}><Text style={styles.taskActionBtnText}>START TASK</Text></TouchableOpacity>
          </View>
        </View>

        <View style={styles.nftPromoCard}>
          <Text style={styles.welcomeLabelLight}>UNLOCKED SOON</Text>
          <Text style={styles.nftPromoTitle}>Rare Digital Seed</Text>
          <Text style={styles.nftPromoDesc}>Complete 2 more challenges this week to earn the exclusive 'Ancient Oak' NFT badge.</Text>
          <View style={{ flexDirection: 'row', gap: -8, marginTop: 12 }}>
            <View style={styles.nftAvatar}><Ionicons name="trophy" size={14} color="#FFF" /></View>
            <View style={[styles.nftAvatar, {backgroundColor: '#7D9984'}]}><Ionicons name="star" size={14} color="#FFF" /></View>
            <View style={[styles.nftAvatar, {backgroundColor: '#5C7A63'}]}><Text style={{color: '#FFF', fontSize: 10, fontWeight: 'bold'}}>+3</Text></View>
          </View>
        </View>

        <View style={{height: 100}} />
      </View>
    <//>
  );
}`;
code = replaceFunction(code, 'function ChallengesView({ model }: { model: EcoBudMobileModel })', newChallengesView);

fs.writeFileSync(targetFile, code);
console.log("Replaced Home and Challenges");
