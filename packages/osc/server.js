#!/usr/bin/env node

/*
server.js - <short description TODO>
Copyright (C) 2022 Strudel contributors - see <https://codeberg.org/uzu/strudel/src/branch/main/packages/osc/server.js>
This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Affero General Public License for more details. You should have received a copy of the GNU Affero General Public License along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

// import OSC from 'osc-js';

import { WebSocketServer } from 'ws';
import osc from 'osc';

const WS_PORT = 8080; // WebSocket server port

const udpPort = new osc.UDPPort({
  localAddress: '0.0.0.0',
  localPort: 0,
});

udpPort.open();

udpPort.on('error', (e) => {
  console.log('Error: ', e);
});

const wss = new WebSocketServer({ port: WS_PORT });
console.log(`[Listening WS] ws://localhost:${WS_PORT}`);

wss.on('connection', (ws) => {
  console.log('New WebSocket connection');

  ws.on('message', (message) => {
    let oschost = '127.0.0.1';
    let oscport = 57120;

    try {
      const data = JSON.parse(message);
      if ('oschost' in data) {
        oschost = data['oschost'];
        delete data['oschost'];
      }
      if ('oscport' in data) {
        oscport = data['oscport'];
        delete data['oscport'];
      }
      let msg = { address: data['address'], args: data['args'] };
      if ('timestamp' in data) {
        msg = { timeTag: osc.timeTag(0, data['timestamp']), packets: [msg] };
      }
      udpPort.send(msg, oschost, oscport);
    } catch (err) {
      console.error('Error parsing message:', err);
    }
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed');
  });
});
