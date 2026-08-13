const fs = require('fs');
let f = fs.readFileSync('src/app/components/AppOverlays.tsx', 'utf8');

f = f.replace(`      Animated.parallel(animations).start(() => {
        model.setActiveOverlay(null);
        DeviceEventEmitter.emit('ECO_POINTS_DROP_ANIMATION');
      });
    }, 100);`, `      setTimeout(() => playPopSound(), 100);
      setTimeout(() => playPopSound(), 350);
      setTimeout(() => playPopSound(), 600);
      setTimeout(() => playPopSound(), 850);
      setTimeout(() => playPopSound(), 1100);

      Animated.parallel(animations).start(() => {
        model.setActiveOverlay(null);
        DeviceEventEmitter.emit('ECO_POINTS_DROP_ANIMATION');
      });
    }, 100);`);

fs.writeFileSync('src/app/components/AppOverlays.tsx', f);
console.log('Fixed EventApprovedOverlay timeouts');
