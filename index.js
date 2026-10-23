const express = require('express');
const app = express();
const qrcode = require('qrcode');
let latestQR = null;
let BOT_ENABLED = true;
app.get('/', async (req,res)=>{
  if(!latestQR) return res.send(`<h1>Bot ${BOT_ENABLED?'🟢 ON':'🔴 OFF'}</h1>`);
  res.send(`<h1>Scan QR</h1><img src="${latestQR}" style="width:350px"/><script>setTimeout(()=>location.reload(),8000)</script>`);
});
app.listen(process.env.PORT || 3000);

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const P = require('pino');

const OWNER_NUMBER = "254707734799";
const STARTER_WORDS = ["rada mzee","rada","sasa","mambo","hey","hi","hello","niaje","uko","poa","semaje","vipi","yo","habari","alo","woza","marada","yobi",];

const userState = new Map();

async function googleSearch(q){
  try{
    const r = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1`);
    const d = await r.json();
    return d.AbstractText || d.Results?.[0]?.Text || `I searched "${q}" - Brian will get back with details soon. Anything else?`;
  }catch(e){ return `Got it - "${q}". Brian will check soon. Need anything else?`; }
}

async function startBot(){
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const sock = makeWASocket({ auth:state, logger:P({level:'silent'}), browser:["Brian","Chrome","10.0"], markOnlineOnConnect:true });
  sock.ev.on('creds.update',saveCreds);
  sock.ev.on('connection.update',async(u)=>{
    if(u.qr) latestQR = await qrcode.toDataURL(u.qr);
    if(u.connection==='close'){ if(u.lastDisconnect?.error?.output?.statusCode!==DisconnectReason.loggedOut) startBot(); }
    if(u.connection==='open'){ latestQR=null; await sock.sendPresenceUpdate('available'); }
  });

  sock.ev.on('messages.upsert',async({messages})=>{
    for(let m of messages){
      if(!m.message||m.key.fromMe) continue;
      const from=m.key.remoteJid; if(from.endsWith('@g.us')) continue;
      const text=m.message.conversation||m.message.extendedTextMessage?.text||""; if(!text) continue;
      const lower=text.toLowerCase().trim();
      const isOwner=from.includes(OWNER_NUMBER);

      if(isOwner && lower===".off"){ BOT_ENABLED=false; userState.clear(); await sock.sendMessage(from,{text:"🔴 OFF"}); continue; }
      if(isOwner && lower===".on"){ BOT_ENABLED=true; await sock.sendMessage(from,{text:"🟢 ON"}); continue; }
      if(!BOT_ENABLED) continue;

      const s = userState.get(from);

      if(s){
        if(s.stage===1){
          await new Promise(r=>setTimeout(r,2000));
          await sock.sendMessage(from,{text:"Good, wossap?"});
          userState.set(from,{stage:2});
          continue;
        }
        if(s.stage===2){
          await new Promise(r=>setTimeout(r,2000));
          await sock.sendMessage(from,{text:"I will get back to you shortly, I'm Brian's bot not him.. he'll be back soon"});
          await new Promise(r=>setTimeout(r,1000));
          await sock.sendMessage(from,{text:"Do you need any services from me, his AI assistant? I can look into anything you want from Google - just ask"});
          userState.set(from,{stage:3});
          continue;
        }
        if(s.stage===3){
          if(["no","hapana","sawa"].includes(lower)){ await sock.sendMessage(from,{text:"Sawa, Brian will get back soon."}); userState.delete(from); continue; }
          await sock.sendPresenceUpdate('composing',from);
          const ans = await googleSearch(text);
          await sock.sendMessage(from,{text:ans});
          continue;
        }
      }

      if(!STARTER_WORDS.some(w=>lower.startsWith(w))) continue;

      await new Promise(r=>setTimeout(r,8000));
      await sock.sendMessage(from,{text:"niko poa wewe uko aje?"});
      userState.set(from,{stage:1});
    }
  });
}
startBot();
