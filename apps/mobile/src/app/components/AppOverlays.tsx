import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  ImageBackground,
  Image,
  Alert,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { styles } from '../styles/appStyles';
import { ecoTheme } from '../../shared/theme/ecoTheme';
import { LoadingGlyph } from '../../shared/ui/OptimizedLoading';
import { EcoBadge, EcoBudMobileModel } from '../types/home';
import {
  formatLongDate,
  formatEventDateTag,
  shortHash,
} from '../utils/appUtils';
import {
  TopNavbar,
  OverlayScaffold,
  LessonMedia,
  SurfaceCard,
  TinyBadge,
  ChallengeMeta,
  PrimaryButton,
  AvatarBubble,
  BadgeCard,
  SecondaryButton,
} from './CommonComponents';

export function OverlayRouter({ model }: { model: EcoBudMobileModel }) {
  switch (model.activeOverlay) {
    case 'assistant':
      return <AssistantOverlay model={model} />;
    case 'events':
      return <EventsOverlay model={model} />;
    case 'lesson':
      return <LessonOverlay model={model} />;
    case 'leaderboard':
      return <LeaderboardOverlay model={model} />;
    case 'rewards':
      return <RewardsOverlay model={model} />;
    case 'transparency':
      return <TransparencyOverlay model={model} />;
    default:
      return null;
  }
}

export function AssistantOverlay({ model }: { model: EcoBudMobileModel }) {
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
          {model.sendingMessage ? (
            <LoadingGlyph size="md" style={{ marginTop: 8, alignSelf: 'flex-start' }} />
          ) : null}
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
}

export function EventsOverlay({ model }: { model: EcoBudMobileModel }) {
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
             <View style={styles.filterPillActive}><MaterialCommunityIcons name="view-list" size={16} color="#126027"/><Text style={styles.filterPillActiveText}> List</Text></View>
             <View style={styles.filterPillInactive}><MaterialCommunityIcons name="map" size={16} color="#6B7A75"/><Text style={styles.filterPillInactiveText}> Map</Text></View>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 8, marginTop: 16, marginBottom: 24}}>
           <View style={styles.categoryPillActive}><Text style={styles.categoryPillActiveText}>All Events</Text></View>
           <View style={styles.categoryPillInactive}><Text style={styles.categoryPillInactiveText}>Clean-ups</Text></View>
           <View style={styles.categoryPillInactive}><Text style={styles.categoryPillInactiveText}>Tree Planting</Text></View>
        </ScrollView>

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

              <View style={{flexDirection: 'row', gap: 16, marginBottom: 8, marginTop: 40}}>
                <View style={styles.rowMeta}><Ionicons name="calendar" size={14} color="#FFF"/><Text style={styles.metaTextWhite}> {formatLongDate(featuredEvent.date)}</Text></View>
                <View style={styles.rowMeta}><Ionicons name="location" size={14} color="#FFF"/><Text style={styles.metaTextWhite}> {featuredEvent.location}</Text></View>
              </View>
              <Text style={styles.featuredProgramTitle}>{featuredEvent.title}</Text>
              <Text style={styles.featuredProgramDesc}>{featuredEvent.description}</Text>

              <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
                <Text style={styles.metaTextWhite}>
                  {featuredEvent.spotsLeft != null ? `${featuredEvent.spotsLeft} spots left` : `${featuredEvent.pointsReward} ECO points reward`}
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
                <Ionicons name="location" size={14} color="#6B7A75"/>
                <Text style={styles.metaTextSmallDark}> {event.location}</Text>
              </View>
              <View style={[styles.rowMeta, { marginBottom: 16 }]}>
                <Ionicons name="leaf" size={14} color="#6B7A75"/>
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

      <View style={{height: 100}} />
      </ScrollView>
    </View>
  );
}

export function LessonOverlay({ model }: { model: EcoBudMobileModel }) {
  return (
    <OverlayScaffold
      title={model.selectedLesson?.title ?? 'Lesson Detail'}
      subtitle={model.selectedLesson?.status ?? 'eco course'}
      onBack={() => model.setActiveOverlay(null)}
    >
      <ScrollView contentContainerStyle={styles.overlayScroll}>
        {model.selectedLesson ? (
          <>
            <SurfaceCard style={styles.lessonDetailCard}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>{model.selectedLesson.title}</Text>
                <TinyBadge label={`${model.selectedLesson.progress}%`} />
              </View>
              <Text style={styles.sectionCaption}>{model.selectedLesson.description}</Text>
              <View style={styles.lessonMetaRow}>
                <ChallengeMeta icon="eye-outline" label={model.selectedLesson.status.toUpperCase()} />
                <ChallengeMeta icon="stats-chart-outline" label={`${model.selectedLesson.progress}% progress`} />
              </View>
              <Text style={styles.lessonBodyText}>{model.selectedLesson.content}</Text>
              <PrimaryButton
                label={model.selectedLesson.status === 'completed' ? 'Lesson Completed' : 'Complete Lesson'}
                onPress={() => void model.handleCompleteLesson()}
                disabled={model.selectedLesson.status === 'completed'}
              />
            </SurfaceCard>
          </>
        ) : null}
      </ScrollView>
    </OverlayScaffold>
  );
}

export function LeaderboardOverlay({ model }: { model: EcoBudMobileModel }) {
  const featuredLeaders: Array<{
    rank: number;
    name: string;
    points: string;
    badgeColor: string;
    avatarSize: number;
    cardStyle?: StyleProp<ViewStyle>;
  }> = [
    {
      rank: 2,
      name: 'Sarah M.',
      points: '12.4k pts',
      badgeColor: '#B0BEC5',
      avatarSize: 64,
      cardStyle: { marginTop: 40 },
    },
    {
      rank: 1,
      name: 'Alex Eco',
      points: '15.2k pts',
      badgeColor: '#FFD700',
      avatarSize: 80,
    },
    {
      rank: 3,
      name: 'John D.',
      points: '11.1k pts',
      badgeColor: '#CD7F32',
      avatarSize: 64,
      cardStyle: { marginTop: 40 },
    },
  ];

  return (
    <View style={styles.fullscreenOverlay}>
      <TopNavbar model={model} showBack={true} title="Leaderboard" />
      <View style={[styles.homeContent, {flex: 1}]}>
        <View style={styles.leaderboardFilterRow}>
          <TouchableOpacity style={[styles.filterPillActive, {flex: 1, justifyContent: 'center'}]}><Text style={styles.filterPillActiveText}>Global</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.filterPillInactive, {flex: 1, justifyContent: 'center'}]}><Text style={styles.filterPillInactiveText}>Friends</Text></TouchableOpacity>
        </View>

        <View style={styles.leaderboardTop3}>
          {featuredLeaders.map((leader) => (
            <View key={leader.rank} style={[styles.lbTopCard, leader.cardStyle]}>
              <View style={styles.lbAvatarWrap}>
                <AvatarBubble
                  label={leader.name}
                  size={leader.avatarSize}
                  style={styles.lbAvatarImg}
                  textStyle={leader.avatarSize > 64 ? styles.lbAvatarTextLarge : styles.lbAvatarText}
                />
                <View
                  style={[
                    styles.lbRankBadge,
                    {
                      backgroundColor: leader.badgeColor,
                      width: leader.rank === 1 ? 28 : 24,
                      height: leader.rank === 1 ? 28 : 24,
                      borderRadius: leader.rank === 1 ? 14 : 12,
                    },
                  ]}
                >
                  <Text style={[styles.lbRankText, leader.rank === 1 ? { fontSize: 14 } : null]}>{leader.rank}</Text>
                </View>
              </View>
              <Text
                style={[
                  styles.lbTopName,
                  leader.rank === 1 ? { fontSize: 18, fontWeight: 'bold' } : null,
                ]}
              >
                {leader.name}
              </Text>
              <Text
                style={[
                  styles.lbTopPoints,
                  leader.rank === 1 ? { color: '#126027', fontWeight: 'bold' } : null,
                ]}
              >
                {leader.points}
              </Text>
            </View>
          ))}
        </View>

        <ScrollView style={{flex: 1, marginTop: 24, paddingHorizontal: 4}}>
           {[4,5,6,7,8,9,10].map(rank => (
             <View key={rank} style={styles.lbListRow}>
                <Text style={styles.lbListRank}>{rank}</Text>
                <AvatarBubble
                  label={`User ${rank}`}
                  size={40}
                  style={styles.lbListAvatar}
                  textStyle={styles.lbListAvatarText}
                />
                <View style={{flex: 1, marginLeft: 16}}>
                   <Text style={styles.cardTitle}>User {rank}</Text>
                </View>
                <Text style={styles.lbListPoints}>{11000 - rank*500} pts</Text>
             </View>
           ))}
        </ScrollView>
        
        <View style={styles.lbCurrentUserCard}>
           <Text style={styles.lbListRank}>42</Text>
           <AvatarBubble
             label={model.userDisplayName}
             size={40}
             style={[styles.lbListAvatar, styles.lbCurrentUserAvatar]}
             textStyle={styles.lbCurrentUserAvatarText}
           />
           <View style={{flex: 1, marginLeft: 16}}>
              <Text style={[styles.cardTitle, {color: '#FFF'}]}>{model.userDisplayName}</Text>
           </View>
           <Text style={[styles.lbListPoints, {color: '#FFF'}]}>{model.dashboard?.ecoPoints ?? model.session?.user.points ?? 0} pts</Text>
        </View>

      </View>
    </View>
  );
}

export function RewardsOverlay({ model }: { model: EcoBudMobileModel }) {
  return (
    <OverlayScaffold
      title="Rewards & Badges"
      subtitle="Track unlocks and next milestones"
      onBack={() => model.setActiveOverlay(null)}
    >
      <ScrollView contentContainerStyle={styles.overlayScroll}>
        <SurfaceCard style={styles.rewardsHeroCard}>
          <Text style={styles.rewardsHeroValue}>{model.rewards?.points ?? 0} ECO Points</Text>
          <Text style={styles.sectionCaption}>Available for exchange</Text>
        </SurfaceCard>

        <Text style={styles.sectionHeadline}>Badges</Text>
        <View style={styles.badgesGrid}>
          {(model.rewards?.badges ?? []).map((badge) => (
            <BadgeCard key={badge.id} badge={badge} fullWidth />
          ))}
        </View>

        <Text style={styles.sectionHeadline}>Lifetime Achievements</Text>
        {(model.rewards?.achievements ?? []).map((achievement) => {
          const progress = Math.min(100, Math.round((achievement.current / achievement.target) * 100));

          return (
            <SurfaceCard key={achievement.id} style={styles.achievementCard}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>
                  {achievement.label} ({achievement.current}/{achievement.target})
                </Text>
                <Text style={styles.logPoints}>{achievement.reward} pts</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progress}%` }]} />
              </View>
            </SurfaceCard>
          );
        })}
      </ScrollView>
    </OverlayScaffold>
  );
}

export function TransparencyOverlay({ model }: { model: EcoBudMobileModel }) {
  return (
    <OverlayScaffold
      title="Activity Transparency"
      subtitle="Verified impact logs and immutable reward history"
      onBack={() => model.setActiveOverlay(null)}
    >
      <ScrollView contentContainerStyle={styles.overlayScroll}>
        <View style={styles.timelineRail}>
          {(model.transparency?.logs ?? []).map((log, index) => (
            <View key={log.id} style={styles.timelineRow}>
              <View style={styles.timelineNodeWrap}>
                <View style={styles.timelineNode} />
                {index < (model.transparency?.logs.length ?? 0) - 1 ? <View style={styles.timelineLine} /> : null}
              </View>
              <SurfaceCard style={styles.timelineCard}>
                <Text style={styles.cardTitle}>{log.publicLabel}</Text>
                <Text style={styles.sectionCaption}>{formatLongDate(log.timestamp)}</Text>
                <Text style={styles.hashText}>{shortHash(log.currentHash)}</Text>
              </SurfaceCard>
            </View>
          ))}
        </View>

        {(model.transparency?.logs ?? []).map((log) => (
          <SurfaceCard key={`detail-${log.id}`} style={styles.transparencyDetailCard}>
            <View style={styles.rowMeta}>
              <MaterialCommunityIcons name="leaf" size={22} color={ecoTheme.colors.primaryDark} />
              <Text style={styles.cardTitle}>Verified on ECOBUD ledger</Text>
            </View>
            <Text style={styles.transparencyLine}>Action: {log.actionType}</Text>
            <Text style={styles.transparencyLine}>Points: +{log.pointsAwarded}</Text>
            <Text style={styles.transparencyLine}>Date: {formatLongDate(log.timestamp)}</Text>
            <Text style={styles.transparencyLine}>Transaction: {shortHash(log.currentHash)}</Text>
            <SecondaryButton
              label="View Explorer"
              onPress={() => Alert.alert('Explorer placeholder', `Transaction hash:\n${log.currentHash}`)}
            />
          </SurfaceCard>
        ))}
      </ScrollView>
    </OverlayScaffold>
  );
}
