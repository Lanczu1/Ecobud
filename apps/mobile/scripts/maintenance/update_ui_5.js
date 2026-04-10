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

const newTrackerView = `function TrackerView({ model }: { model: EcoBudMobileModel }) {
  const trackerMonth = model.tracker?.month ?? new Date().toISOString().slice(0, 7);
  const calendarCells = buildCalendarCells(trackerMonth, model.tracker?.completedDays ?? []);

  return (
    <>
      <TopNavbar model={model} showBack={true} title="Habits Tracker" />

      <ScrollView contentContainerStyle={styles.homeContent}>
        <SurfaceCard style={[styles.trackerHeroCard, {backgroundColor: '#126027', borderRadius: 24, padding: 24}]}>
          <View style={styles.trackerHeroLeft}>
            <Text style={[styles.trackerHeroTitle, {color: '#FFF', fontSize: 20, fontWeight: '800'}]}>You are on fire!</Text>
            <Text style={[styles.trackerHeroStreak, {color: '#4ADE80', fontSize: 28, fontWeight: '900', marginTop: 8}]}>{model.tracker?.currentStreak ?? 0} day streak</Text>
            <Text style={[styles.metaTextWhite, {marginTop: 8}]}>Weekly Eco Goal: {model.todaysCompletedHabits}/7 days</Text>
          </View>
        </SurfaceCard>

        <SurfaceCard style={[styles.calendarCard, {marginTop: 16, backgroundColor: '#FFF', borderRadius: 24, padding: 20}]}>
          <View style={styles.rowBetween}>
            <TouchableOpacity onPress={() => void model.loadTrackerMonth(-1)}>
              <Feather name="chevron-left" size={24} color="#6B7A75" />
            </TouchableOpacity>
            <Text style={[styles.calendarMonth, {fontSize: 16, fontWeight: '800', color: '#1A211D'}]}>{formatMonthLabel(trackerMonth)}</Text>
            <TouchableOpacity onPress={() => void model.loadTrackerMonth(1)}>
              <Feather name="chevron-right" size={24} color="#6B7A75" />
            </TouchableOpacity>
          </View>

          <View style={[styles.calendarWeekRow, {flexDirection: 'row', justifyContent: 'space-between', marginTop: 16}]}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <Text key={day} style={[styles.calendarWeekLabel, {width: 40, textAlign: 'center', color: '#6B7A75', fontSize: 12, fontWeight: '700'}]}>
                {day}
              </Text>
            ))}
          </View>

          <View style={[styles.calendarGrid, {flexDirection: 'row', flexWrap: 'wrap', marginTop: 8}]}>
            {calendarCells.map((cell, index) => (
              <View key={\`\${cell.dateKey ?? 'empty'}-\${index}\`} style={[styles.calendarCell, {width: '14.28%', padding: 4, alignItems: 'center'}]}>
                {cell.dateKey ? (
                  <View style={[
                    {width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center'},
                    cell.completed && {backgroundColor: '#4ADE80'},
                    cell.isToday && !cell.completed && {borderWidth: 2, borderColor: '#126027'}
                  ]}>
                    <Text style={[
                      {color: '#1A211D', fontSize: 12, fontWeight: '600'},
                      cell.completed && {color: '#126027', fontWeight: '800'},
                      cell.isToday && {fontWeight: '800'}
                    ]}>{cell.day}</Text>
                  </View>
                ) : (
                  <View style={{width: 36, height: 36}} />
                )}
              </View>
            ))}
          </View>
        </SurfaceCard>

        <Text style={[styles.sectionHeadline, {marginTop: 24, marginBottom: 12}]}>Daily Check-in</Text>
        {model.tracker?.todayHabits.map((habit) => (
          <SurfaceCard key={habit.id} style={[styles.checkInCard, {flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 20, padding: 16, marginBottom: 12, alignItems: 'center'}]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, {fontSize: 16, fontWeight: '700', color: '#1A211D'}]}>{habit.title}</Text>
              <Text style={{fontSize: 12, color: '#6B7A75', marginTop: 4}}>{habit.pointsReward} XP</Text>
            </View>
            <TouchableOpacity
              onPress={() => void model.handleHabitCheckIn(habit.id)}
              disabled={habit.completedToday}
              style={{
                width: 32, height: 32, borderRadius: 16,
                backgroundColor: habit.completedToday ? '#F0F5F2' : '#126027',
                alignItems: 'center', justifyContent: 'center'
              }}
            >
              {habit.completedToday ? <Ionicons name="checkmark" size={16} color="#4ADE80" /> : <Feather name="plus" size={16} color="#FFF" />}
            </TouchableOpacity>
          </SurfaceCard>
        ))}
      </ScrollView>
    </>
  );
}`;
code = replaceFunction(code, 'function TrackerView({ model }: { model: EcoBudMobileModel })', newTrackerView);

fs.writeFileSync(targetFile, code);
