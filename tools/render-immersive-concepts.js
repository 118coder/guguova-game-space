#!/usr/bin/env node
// Render the immersive-mode concept boards to PNGs.
// Usage: node tools/render-immersive-concepts.js [outDir]
// No running launcher needed: it starts its own headless browser + local server.
const fs = require('fs');
const path = require('path');
const { startHost } = require('./lib/headless-host');
const { connect } = require('./lib/cdp');

const OUT = path.resolve(process.argv[2] || '../_shots/immersive');
const BOARDS = [
  'nova', 'aurum', 'broadcast', 'codex', 'dusk', 'endfield', 'grimoire',
  'mnemo', 'nightflight', 'riot', 'riso', 'steam', 'summer', 'zerohour'
];

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const host = await startHost({ width: 960, height: 540, scale: 1 });
  const cdp = await connect({ port: host.cdpPort });
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 960, height: 540, deviceScaleFactor: 1.5, mobile: false
  });

  const shoot = async (url, file) => {
    await cdp.send('Page.navigate', { url });
    await new Promise((r) => setTimeout(r, 480));
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
    if (!shot.result || !shot.result.data) throw new Error('screenshot failed: ' + url);
    fs.writeFileSync(path.join(OUT, file), Buffer.from(shot.result.data, 'base64'));
    console.log('shot', file);
  };

  // One contact sheet with all 14 boards at thumbnail size.
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1000, height: 2200, deviceScaleFactor: 1, mobile: false
  });
  await shoot(`${host.origin}/tools/immersive-concepts.html`, 'immersive-contact-sheet.png');

  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 960, height: 540, deviceScaleFactor: 1.5, mobile: false
  });
  for (const id of BOARDS) {
    await shoot(`${host.origin}/tools/immersive-concepts.html?board=${id}`, `immersive-${id}.png`);
  }

  await cdp.close();
  await host.close();
  console.log(`\n${BOARDS.length + 1} boards -> ${OUT}`);
}

main().catch((error) => { console.error(error.message || error); process.exit(1); });
