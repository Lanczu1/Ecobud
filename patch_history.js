const fs = require('fs');
const file = 'apps/mobile/src/app/components/AppOverlays.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add to OverlayRouter
const routerSearch = 'switch (model.activeOverlay) {';
if (content.includes(routerSearch) && !content.includes("case 'coinsHistory':")) {
  content = content.replace(
    routerSearch,
    routerSearch + "\n    case 'coinsHistory':\n      return <CoinsHistoryOverlay model={model} />;"
  );
}

// 2. Add CoinsHistoryOverlay component at the end of the file
const componentCode = `
export function CoinsHistoryOverlay({ model }: { model: EcoBudMobileModel }) {
  const logs = model.transparency?.logs ?? [];

  return (
    <View style={styles.fullscreenOverlay}>
      <TopNavbar model={model} showBack={true} />
      <ScrollView contentContainerStyle={styles.homeContent}>
        <Text style={styles.welcomeLabel}>HISTORY</Text>
        <Text style={styles.pageTitle}>Coins & Points</Text>

        <View style={{ marginTop: 24, gap: 12 }}>
          {logs.length > 0 ? (
            logs.map((log) => (
              <SurfaceCard key={log.id} style={{ padding: 16, borderRadius: 16, backgroundColor: '#FFF' }}>
                <View style={styles.rowBetween}>
                  <Text style={[styles.cardTitle, { flex: 1 }]}>{log.publicLabel}</Text>
                  <Text style={{ color: '#10B981', fontWeight: 'bold', fontSize: 16 }}>+{log.pointsAwarded}</Text>
                </View>
                <Text style={[styles.metaTextSmallDark, { marginTop: 4 }]}>Action: {log.actionType}</Text>
                <Text style={[styles.metaTextSmallDark, { marginTop: 4 }]}>Date: {formatLongDate(log.timestamp)}</Text>
              </SurfaceCard>
            ))
          ) : (
            <SurfaceCard style={styles.publicInfoCard}>
              <Text style={styles.sectionHeadline}>No history yet</Text>
              <Text style={styles.metaTextSmallDark}>Complete missions to earn points and coins!</Text>
            </SurfaceCard>
          )}
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}
`;

if (!content.includes('export function CoinsHistoryOverlay')) {
  content += componentCode;
}

fs.writeFileSync(file, content);
console.log('Successfully added CoinsHistoryOverlay');
