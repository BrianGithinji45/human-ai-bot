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
const STARTER_WORDS = ["rada mzee","rada","sasa","mambo","hey","hi","hello","niaje","uko","poa","semaje","vipi","yo","habari","alo","yobi","woza"];
const FOUR_HOURS = 4 * 60 * 60 * 1000;

const userState = new Map();
const cooldown = new Map();

async function googleSearch(q){
  try{
    const r = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1`);
    const d = await r.json();
    return d.AbstractText || d.Results?.[0]?.Text || `Results for "${q}"`;
  }catch(e){ return `Info about "${q}"`; }
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
      if(!m.message) continue;
      const from=m.key.remoteJid; 
      if(from.endsWith('@g.us')) continue;
      const isFromMe = m.key.fromMe;
      const text=m.message.conversation||m.message.extendedTextMessage?.text||""; 
      if(!text) continue;
      const lower=text.toLowerCase().trim();
      const isOwnerChat = from.includes(OWNER_NUMBER);

      if(isFromMe){
        if(!isOwnerChat){
          userState.delete(from);
          cooldown.set(from, Date.now());
        }
        if(isOwnerChat && lower===".off"){ BOT_ENABLED=false; userState.clear(); await sock.sendMessage(from,{text:"🔴 OFF"}); continue; }
        if(isOwnerChat && lower===".on"){ BOT_ENABLED=true; cooldown.clear(); await sock.sendMessage(from,{text:"🟢 ON"}); continue; }
        continue;
      }

      if(!BOT_ENABLED) continue;

      if(cooldown.has(from)){
        if(Date.now() - cooldown.get(from) < FOUR_HOURS) continue;
        cooldown.delete(from);
      }

      const s = userState.get(from);

      if(s){
        if(s.stage===1){
          await new Promise(r=>setTimeout(r,2000));
          await sock.sendMessage(from,{text:"Good, Wossap?"});
          userState.set(from,{stage:2});
          continue;
        }
        if(s.stage===2){
          await new Promise(r=>setTimeout(r,2000));
          await sock.sendMessage(from,{text:"I will get back to you shortly, I'm Brian's bot not him.. he'll be back soon"});
          await new Promise(r=>setTimeout(r,1000));
          await sock.sendMessage(from,{text:"Do you need any services from me, his AI assistant? I can look into anything you want from Google - just ask (use \"\" to search) e.g. \"weather in Nairobi\""});
          userState.set(from,{stage:3});
          continue;
        }
        if(s.stage===3){
          const quoted = text.match(/"([^"]+)"/);
          if(quoted){
            await sock.sendPresenceUpdate('composing',from);
            const ans = await googleSearch(quoted[1]);
            await sock.sendMessage(from,{text:ans});
          }else{
            await sock.sendMessage(from,{text:"My master  his Excellency Brian will get back to you shortly"});
            userState.delete(from);
            cooldown.set(from, Date.now());
          }
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
