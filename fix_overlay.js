const fs = require('fs');
const path = 'c:/xampz/htdocs/Ecobud/apps/mobile/src/app/components/AppOverlays.tsx';
let content = fs.readFileSync(path, 'utf8');
content = content.replace('ActivityIndicator,', 'ActivityIndicator,\n  RefreshControl,');
content = content.replace('<ScrollView contentContainerStyle={styles.homeContent}>', '<ScrollView\n        contentContainerStyle={styles.homeContent}\n        refreshControl={\n          <RefreshControl\n            refreshing={model.refreshing}\n            onRefresh={() => void model.refreshEverything()}\n            tintColor=\'#126027\'\n          />\n        }\n      >');
fs.writeFileSync(path, content, 'utf8');
