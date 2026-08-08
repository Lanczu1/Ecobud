const fs = require('fs');
let code = fs.readFileSync('c:/xampz/htdocs/Ecobud/apps/mobile/src/app/components/AppViews.tsx', 'utf8');

const profileViewStart = code.indexOf('export function ProfileView({ model }: { model: EcoBudMobileModel }) {');
// Find end of ProfileView. It ends at `const localStyles = StyleSheet.create({`
const profileViewEnd = code.indexOf('const localStyles = StyleSheet.create({', profileViewStart);

const restoredProfileView = `export function ProfileView({ model }: { model: EcoBudMobileModel }) {
  const [isViewingAvatar, setIsViewingAvatar] = useState(false);

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera roll permissions to change your profile picture.');
        return;
      }

      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        await model.handleUpdateProfileImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const rawAvatarUrl = model.profile?.profile?.avatarUrl || model.session?.user.avatarUrl;
  let avatarUrl: string | null = null;
  if (rawAvatarUrl && rawAvatarUrl !== 'null') {
    let cleanUrl = rawAvatarUrl.replace(/\\\\/g, '/');
    if (cleanUrl.includes('localhost:3000')) {
      cleanUrl = cleanUrl.replace('http://localhost:3000', ecobudApiOrigin);
    }
    avatarUrl = cleanUrl.startsWith('http') ? cleanUrl : \\\`\\\${ecobudApiOrigin}\\\${cleanUrl}\\\`;
  }

  const totalPoints = model.dashboard?.ecoPoints ?? model.session?.user.points ?? 0;
  const { currentLevelObj, nextLevelObj } = getLevelFromPoints(totalPoints);
  
  const isMaxLevel = currentLevelObj.level === 10;
  let progressPercent = 100;
  let pointsToNext = 0;

  if (!isMaxLevel) {
    const pointsInCurrentLevel = totalPoints - currentLevelObj.points;
    const pointsNeededForNextLevel = nextLevelObj.points - currentLevelObj.points;
    progressPercent = (pointsInCurrentLevel / pointsNeededForNextLevel) * 100;
    pointsToNext = nextLevelObj.points - totalPoints;
  }

  return (
    <>
      <TopNavbar model={model} />
      
      {/* Background Decor Orbs */}
      <View style={profileStyles.backgroundOrbOne} />
      <View style={profileStyles.backgroundOrbTwo} />

      <View style={styles.homeContent}>
        
        {/* Profile Card Banner */}
        <LinearGradient
          colors={['#126027', '#0F4D20', '#0A3B18']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={profileStyles.headerCard}
        >
          <View style={profileStyles.headerTopRow}>
            <View style={profileStyles.headerBadge}>
              <Text style={profileStyles.headerBadgeText}>LEVEL {currentLevelObj.level}</Text>
            </View>
            <TouchableOpacity 
              style={profileStyles.headerSettingsBtn}
              onPress={() => model.setActiveOverlay('settings')}
            >
              <Ionicons name="settings-sharp" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>

          <View style={profileStyles.profileMainInfo}>
            <TouchableOpacity onPress={() => avatarUrl ? setIsViewingAvatar(true) : void pickImage()} style={profileStyles.avatarContainer}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={profileStyles.avatarImg} />
              ) : (
                <AvatarBubble
                  label={model.userDisplayName}
                  size={80}
                  style={profileStyles.avatarImg}
                  textStyle={{ fontSize: 36 }}
                />
              )}
              <TouchableOpacity onPress={() => void pickImage()} style={profileStyles.avatarEditBadge}>
                <Ionicons name="camera" size={12} color="#FFF" />
              </TouchableOpacity>
            </TouchableOpacity>
            
            <View style={profileStyles.profileMeta}>
              <Text style={profileStyles.profileName} numberOfLines={1}>
                {model.userDisplayName}
              </Text>
              <Text style={profileStyles.profileEmail} numberOfLines={1}>
                {model.session?.user.email}
              </Text>
              <View style={profileStyles.titleBadge}>
                <MaterialCommunityIcons name="shield-crown" size={14} color="#F59E0B" />
                <Text style={profileStyles.titleBadgeText}>{currentLevelObj.name}</Text>
              </View>
            </View>

            {/* Horizontal Coin Card Aligned on Right Side */}
            <TouchableOpacity 
              style={profileStyles.coinCardHorizontalRight}
              onPress={() => model.setActiveOverlay('coinsHistory')}
              activeOpacity={0.85}
            >
              <Image source={require('../../../assets/coin.png')} style={profileStyles.coinBalanceIconHoriz} resizeMode="contain" />
              <View style={{ alignItems: 'flex-start' }}>
                <Text style={profileStyles.coinBalanceAmountHoriz}>{model.dashboard?.ecoCoins ?? 0}</Text>
                <Text style={profileStyles.coinBalanceLabelHoriz}>Coins</Text>
              </View>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Progress Bar Info */}
        <View style={profileStyles.progressSection}>
          <View style={profileStyles.progressInfoRow}>
            <Text style={profileStyles.progressInfoText}>Journey Progress</Text>
            <Text style={profileStyles.progressInfoValue}>
              {isMaxLevel ? 'Max Level Reached!' : \`\${pointsToNext} XP to Lv. \${nextLevelObj.level}\`}
            </Text>
          </View>
          <ProgressBar progress={progressPercent} />
        </View>

        {/* Events Quick Card */}
        <View style={profileStyles.sectionContainer}>
          <Text style={profileStyles.sectionHeadline}>My Eco Events</Text>
          <View style={profileStyles.eventBanner}>
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.95)', 'rgba(240, 253, 244, 0.95)']}
              style={profileStyles.eventBannerGrad}
            >
              <View style={profileStyles.eventBannerTextCol}>
                <Text style={profileStyles.eventBannerTitle}>Local Workshops</Text>
                <Text style={profileStyles.eventBannerDesc}>Join clean-ups, eco events, and tree plant activities.</Text>
              </View>
              <TouchableOpacity
                onPress={() => model.setActiveOverlay('events')}
                style={profileStyles.eventBannerBtn}
              >
                <Text style={profileStyles.eventBannerBtnText}>Discover</Text>
                <Ionicons name="arrow-forward" size={14} color="#FFF" />
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </View>

        {/* Unified Eco Actions List */}
        <View style={profileStyles.sectionContainer}>
          <Text style={profileStyles.sectionHeadline}>Eco Hub</Text>
          <View style={profileStyles.actionListCard}>
            <TouchableOpacity 
              style={profileStyles.actionItem}
              onPress={() => model.setActiveOverlay('redeemPoints')}
            >
              <View style={[profileStyles.actionIconWrapper, { backgroundColor: '#FEF3C7' }]}>
                <Image source={require('../../../assets/coin.png')} style={{ width: 22, height: 22 }} resizeMode="contain" />
              </View>
              <View style={profileStyles.actionTextCol}>
                <Text style={[profileStyles.actionLabel, { color: '#D97706' }]}>Redeem Coins</Text>
                <Text style={profileStyles.actionSub}>Exchange your eco coins for rewards</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#B0C4B8" />
            </TouchableOpacity>

            <View style={profileStyles.divider} />

            <TouchableOpacity 
              style={profileStyles.actionItem}
              onPress={() => model.setActiveOverlay('coinsHistory')}
            >
              <View style={[profileStyles.actionIconWrapper, { backgroundColor: '#EDF6F1' }]}>
                <Ionicons name="time-outline" size={20} color="#126027" />
              </View>
              <View style={profileStyles.actionTextCol}>
                <Text style={profileStyles.actionLabel}>Coins History</Text>
                <Text style={profileStyles.actionSub}>Check your points and task completion logs</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#B0C4B8" />
            </TouchableOpacity>

            <View style={profileStyles.divider} />

            <TouchableOpacity 
              style={profileStyles.actionItem}
              onPress={() => model.setActiveOverlay('settings')}
            >
              <View style={[profileStyles.actionIconWrapper, { backgroundColor: '#EDF6F1' }]}>
                <Ionicons name="shield-checkmark-outline" size={20} color="#126027" />
              </View>
              <View style={profileStyles.actionTextCol}>
                <Text style={profileStyles.actionLabel}>Settings & Security</Text>
                <Text style={profileStyles.actionSub}>Manage account security & notifications</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#B0C4B8" />
            </TouchableOpacity>

            <View style={profileStyles.divider} />

            <TouchableOpacity 
              style={profileStyles.actionItem}
              onPress={() => void model.handleLogout()}
            >
              <View style={[profileStyles.actionIconWrapper, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="log-out-outline" size={20} color="#EF4444" />
              </View>
              <View style={profileStyles.actionTextCol}>
                <Text style={[profileStyles.actionLabel, { color: '#EF4444' }]}>Sign Out</Text>
                <Text style={profileStyles.actionSub}>Logout of your current device session</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#FCA5A5" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Rewards & Badges (Moved from Overlay) */}
        <View style={profileStyles.sectionContainer}>
          <Text style={profileStyles.sectionHeadline}>Rewards & Badges</Text>
          <LinearGradient
            colors={['#059669', '#10B981', '#047857']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              width: '100%',
              borderRadius: 24,
              padding: 20,
              marginBottom: 20,
              position: 'relative',
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.25)',
              shadowColor: '#059669',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.25,
              shadowRadius: 16,
              elevation: 6,
            }}
          >
            {/* Background Decorative Circles */}
            <View
              style={{
                position: 'absolute',
                top: -20,
                right: -20,
                width: 120,
                height: 120,
                borderRadius: 60,
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
              }}
            />
            <View
              style={{
                position: 'absolute',
                bottom: -30,
                left: -10,
                width: 90,
                height: 90,
                borderRadius: 45,
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
              }}
            />

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: moderateScale(12), flex: 1, minWidth: 180 }}>
                <View
                  style={{
                    width: moderateScale(48),
                    height: moderateScale(48),
                    borderRadius: moderateScale(24),
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.3)',
                  }}
                >
                  <Ionicons name="leaf" size={moderateScale(24)} color="#FFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#D1FAE5', fontSize: responsiveFontSize(12), fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' }} numberOfLines={1}>
                    Eco Balance
                  </Text>
                  <Text style={{ fontSize: responsiveFontSize(26), fontWeight: '900', color: '#FFF', letterSpacing: -0.5 }} adjustsFontSizeToFit numberOfLines={1}>
                    {model.rewards?.points ?? 0} <Text style={{ fontSize: responsiveFontSize(16), fontWeight: '700', color: '#ECFDF5' }}>Points</Text>
                  </Text>
                </View>
              </View>

              <View
                style={{
                  backgroundColor: 'rgba(0, 0, 0, 0.15)',
                  paddingHorizontal: moderateScale(10),
                  paddingVertical: moderateScale(6),
                  borderRadius: moderateScale(20),
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: moderateScale(4),
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.15)',
                  alignSelf: 'flex-start'
                }}
              >
                <Ionicons name="sparkles" size={moderateScale(12)} color="#FDE68A" />
                <Text style={{ color: '#ECFDF5', fontSize: responsiveFontSize(11), fontWeight: '600' }}>Available</Text>
              </View>
            </View>
          </LinearGradient>
          
          <Text style={[profileStyles.sectionHeadline, { fontSize: 16, marginTop: 8 }]}>Lifetime Achievements</Text>
          {(model.rewards?.achievements ?? []).length > 0 ? (
            (model.rewards?.achievements ?? []).map((achievement) => {
              const progress = Math.min(100, Math.round((achievement.current / achievement.target) * 100));
              return (
                <View key={achievement.id} style={profileStyles.achievementCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                    <Text style={profileStyles.badgeTitle}>
                      {achievement.label} ({achievement.current}/{achievement.target})
                    </Text>
                    <Text style={{ color: '#10B981', fontWeight: 'bold' }}>{achievement.reward} pts</Text>
                  </View>
                  <View style={profileStyles.badgeProgressWrap}>
                    <ProgressBar progress={progress} />
                  </View>
                </View>
              );
            })
          ) : (
            <Text style={{ textAlign: 'center', color: '#6B7A75', marginTop: 16 }}>No achievements yet.</Text>
          )}
        </View>

        {/* Collectible Badges Grid */}
        <View style={profileStyles.sectionContainer}>
          <Text style={profileStyles.sectionHeadline}>Collectible Badges</Text>
          <View style={profileStyles.badgesGrid}>
            {(model.rewards?.badges || []).length > 0 ? (
              (model.rewards?.badges || []).map((badge) => {
                const isUnlocked = badge.unlocked;
                return (
                  <View key={badge.id} style={[profileStyles.badgeCard, !isUnlocked && { opacity: 0.75 }]}>
                    <View style={[profileStyles.badgeIconRing, { borderColor: isUnlocked ? (badge.accentColor || '#10B981') : '#B0C4B8' }]}>
                      {isUnlocked ? (
                        <LinearGradient
                          colors={[badge.accentColor || '#10B981', badge.accentColor ? badge.accentColor + '99' : '#059669']}
                          style={profileStyles.badgeIconBg}
                        >
                          {badge.iconUrl && badge.iconUrl.startsWith('http') ? (
                            <Image source={{ uri: badge.iconUrl }} style={{ width: 30, height: 30 }} resizeMode="contain" />
                          ) : (
                            <Ionicons name="ribbon-outline" size={26} color="#FFF" />
                          )}
                        </LinearGradient>
                      ) : (
                        <View style={[profileStyles.badgeIconBg, { backgroundColor: '#F3F4F6' }]}>
                          {badge.iconUrl && badge.iconUrl.startsWith('http') ? (
                            <Image source={{ uri: badge.iconUrl }} style={{ width: 30, height: 30, tintColor: '#9CA3AF' }} resizeMode="contain" />
                          ) : (
                            <Ionicons name="ribbon-outline" size={26} color="#9CA3AF" />
                          )}
                        </View>
                      )}
                      
                      {!isUnlocked && (
                        <View style={profileStyles.lockBadgeTag}>
                          <Ionicons name="lock-closed" size={10} color="#FFF" />
                        </View>
                      )}
                    </View>
                    <Text style={isUnlocked ? profileStyles.badgeTitle : profileStyles.badgeTitleLocked}>{badge.name}</Text>
                    <Text style={profileStyles.badgeDescription}>{badge.description}</Text>
                    {!isUnlocked && badge.targetProgress ? (
                      <View style={{ marginTop: 8, width: '100%', paddingHorizontal: 4 }}>
                        <ProgressBar progress={(badge.currentProgress ?? 0) / badge.targetProgress} />
                        <Text style={[profileStyles.badgeDescription, { marginTop: 4, textAlign: 'center', fontSize: 10 }]}>
                          {badge.currentProgress} / {badge.targetProgress} completed
                        </Text>
                      </View>
                    ) : !isUnlocked ? (
                      <Text style={[profileStyles.badgeDescription, { marginTop: 4, fontWeight: 'bold' }]}>
                        Unlocks at {badge.requiredPoints} pts
                      </Text>
                    ) : null}
                  </View>
                );
              })
            ) : (
              <Text style={{ textAlign: 'center', color: '#6B7A75', marginTop: 16 }}>No badges available.</Text>
            )}
          </View>
        </View>

        <View style={{ height: 100 }} />
      </View>
      {isViewingAvatar && (
        <Modal visible={isViewingAvatar} transparent={true} animationType="fade" onRequestClose={() => setIsViewingAvatar(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' }}>
            <TouchableOpacity style={{ position: 'absolute', top: 60, right: 30, zIndex: 10 }} onPress={() => setIsViewingAvatar(false)}>
              <Ionicons name="close" size={32} color="#FFF" />
            </TouchableOpacity>
            
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={{ width: '100%', height: '70%', resizeMode: 'contain' }} />
            ) : (
              <AvatarBubble
                label={model.userDisplayName}
                size={200}
                style={{ borderRadius: 100 }}
                textStyle={{ fontSize: 80 }}
              />
            )}
            
            <TouchableOpacity 
              style={{ marginTop: 40, backgroundColor: '#126027', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24, flexDirection: 'row', alignItems: 'center', gap: 8 }} 
              onPress={() => { setIsViewingAvatar(false); void pickImage(); }}
            >
              <Ionicons name="camera" size={20} color="#FFF" />
              <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 16 }}>Change Picture</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      )}
    </>
  );
}
`;

let newCode = code.substring(0, profileViewStart) + restoredProfileView + '\n' + code.substring(profileViewEnd);
fs.writeFileSync('c:/xampz/htdocs/Ecobud/apps/mobile/src/app/components/AppViews.tsx', newCode);
console.log('File successfully fixed!');
