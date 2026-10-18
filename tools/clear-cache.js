const fs = require('fs');
const http = require('http');
const WebSocket = require('ws');
const get = (p) => new Promise((res, rej) => http.get({host:'127.0.0.1',port:9223,path:p}, r => {let d='';r.on('data',c=>d+=c);r.on('end',()=>res(JSON.parse(d)));}).on('error',rej));
(async () => {
  const targets = await get('/json/list');
  const page = targets.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const cbs = new Map();
  ws.on('message', raw => { const m = JSON.parse(raw); if (m.id && cbs.has(m.id)) { cbs.get(m.id)(m); cbs.delete(m.id); } });
  const send = (method, params={}) => new Promise(r => { const i=++id; cbs.set(i,r); ws.send(JSON.stringify({id:i,method,params})); });
  await new Promise(r => ws.on('open', r));
  await send('Network.enable');
  await send('Network.clearBrowserCache');
  await send('Page.reload', { ignoreCache: true });
  await new Promise(r => setTimeout(r, 2500));
  console.log('cache cleared + reloaded');
  ws.close();
})();
