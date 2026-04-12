import React from 'react';
import { Text, View } from 'react-native';
import { styles } from '../styles/appStyles';
import { type EcoBudMobileModel } from '../types/home';
import { ActiveChallengeCard } from './ActiveChallengeCard';
import { TopNavbar, SurfaceCard } from './CommonComponents';
import { LearnLessonCard } from './LearnLessonCard';
import { QuickActions } from './QuickActions';
import { SummaryCards } from './SummaryCards';

export function HomeView({ model }: { model: EcoBudMobileModel }) {
  const currentStreak = model.dashboard?.streak ?? model.session?.user.currentStreak ?? 0;
  const ecoPoints = model.dashboard?.ecoPoints ?? model.session?.user.points ?? 0;
  const weeklyGoal = model.dashboard?.weeklyGoal ?? 0;
  const primaryChallenge = model.challenges[0] ?? null;

  return (
    <>
      <TopNavbar model={model} />
      <View style={styles.homeContent}>
        <Text style={styles.welcomeLabel}>HOME DASHBOARD</Text>
        <Text style={styles.welcomeTitle}>Hello, {model.userDisplayName.split(' ')[0]}!</Text>
        <Text style={styles.welcomeSubtitle}>Your live sustainability stats are synced from the API.</Text>

        <SummaryCards currentStreak={currentStreak} ecoPoints={ecoPoints} />
        <QuickActions weeklyGoal={weeklyGoal} />

        {!model.dashboard ? (
          <SurfaceCard style={{ padding: 20, borderRadius: 24 }}>
            <Text style={styles.cardTitle}>Dashboard unavailable</Text>
            <Text style={styles.metaTextSmallDark}>Pull to refresh and load your latest streak, eco points, and weekly goal.</Text>
          </SurfaceCard>
        ) : null}

        {primaryChallenge ? (
          <ActiveChallengeCard
            dailyChallenge={primaryChallenge}
            onComplete={() => void model.handleChallengeProgress(primaryChallenge, 100)}
          />
        ) : null}

        <View style={{ height: 100 }} />
      </View>
    </>
  );
}

export function LearnView({ model }: { model: EcoBudMobileModel }) {
  return (
    <>
      <TopNavbar model={model} />
      <View style={styles.homeContent}>
        <Text style={styles.pageTitle}>Learn</Text>
        <Text style={styles.pageSubtitle}>Published lessons are loaded from the API with tracked progress for your account.</Text>

        <View style={{ marginTop: 24 }}>
          {model.filteredLessons.length === 0 ? (
            <SurfaceCard style={{ padding: 20, borderRadius: 24 }}>
              <Text style={styles.cardTitle}>No lessons available</Text>
              <Text style={styles.metaTextSmallDark}>There are no published lessons to display right now.</Text>
            </SurfaceCard>
          ) : (
            model.filteredLessons.map((lesson) => (
              <LearnLessonCard
                key={lesson.id}
                lesson={lesson}
                onPress={() => void model.openLesson(lesson.id)}
              />
            ))
          )}
        </View>

        <View style={{ height: 100 }} />
      </View>
    </>
  );
}
