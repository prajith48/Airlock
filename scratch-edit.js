import fs from 'fs';

// 1. Update utils/logger.ts
let loggerTs = fs.readFileSync('src/utils/logger.ts', 'utf8');
loggerTs = loggerTs.replace('singleLine: true,', 'singleLine: true,\n      destination: 2,');
fs.writeFileSync('src/utils/logger.ts', loggerTs);

// 2. Update utils/banner.ts
let bannerTs = fs.readFileSync('src/utils/banner.ts', 'utf8');
bannerTs = bannerTs.replace(/process\.stdout\.write/g, 'process.stderr.write');
fs.writeFileSync('src/utils/banner.ts', bannerTs);

console.log("Logger and Banner updated.");
