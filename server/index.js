import { createApp } from './app.js';
import { APP_PORT, ATTACKER_PORT, HOST } from './config.js';
import { createAttackerApp } from '../attacker/server.js';

export function startServers({ appPort = APP_PORT, attackerPort = ATTACKER_PORT } = {}) {
  const app = createApp().listen(appPort, HOST, () => {
    console.log(`\n  Halden & Voss storefront   http://${HOST}:${appPort}`);
    console.log(`  Security Lab               http://${HOST}:${appPort}/lab`);
  });
  const attacker = createAttackerApp(appPort).listen(attackerPort, HOST, () => {
    console.log(`  Attacker demo site         http://${HOST}:${attackerPort}  (same-site)`);
    console.log(`                             http://localhost:${attackerPort}  (cross-site)`);
    console.log('\n  INTENTIONALLY VULNERABLE. Bound to loopback only. Press Ctrl+C to stop.\n');
  });

  for (const [name, server, port] of [['storefront', app, appPort], ['attacker site', attacker, attackerPort]]) {
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`\nPort ${port} (${name}) is already in use. Stop the other process, or see TROUBLESHOOTING.md.\n`);
        process.exit(1);
      }
      throw error;
    });
  }
  return { app, attacker };
}
