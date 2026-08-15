const fs = require('fs');
const path = require('path');

function replaceInFile(filePath, replacements) {
  const file = path.join(__dirname, filePath);
  let content = fs.readFileSync(file, 'utf8');
  for (const rep of replacements) {
    if (rep.regex) {
      content = content.replace(rep.regex, rep.with);
    } else {
      content = content.replace(rep.search, rep.with);
    }
  }
  fs.writeFileSync(file, content, 'utf8');
  console.log(`Patched ${filePath}`);
}

// 2. experienceRoutes.ts fixes
replaceInFile('apps/api/src/routes/experienceRoutes.ts', [
  {
    search: `userChallenges: {
              where: { userId },
              orderBy: { startedAt: 'desc' },
              take: 1,
            },`,
    with: `instances: {
              where: { status: 'OPEN' },
              include: {
                userChallenges: {
                  where: { userId },
                  orderBy: { startedAt: 'desc' },
                  take: 1,
                },
              },
            },`
  },
  {
    search: `const progress = challenge.userChallenges[0]?.progressPercentage || 0;`,
    with: `const activeInstance = challenge.instances?.[0];
        const progress = activeInstance?.userChallenges?.[0]?.progressPercentage || 0;`
  }
]);
