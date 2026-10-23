const express = require('express');
const app = express();
const qrcode = require('qrcode');
let latestQR = null;
app.get('/', async (req,res)=>{ if(!latestQR) return res.send(`<h1>Human Bot Online</h1>`); res.send(`<h1>Scan QR</h1><img src="${latestQR}" style="width:350px"/>`); });
app.listen(process.env.PORT || 3000);

const GROQ_KEY = "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";
const GEMINI_KEY = "AQ.Ab8RN6ISIfTWlqNL6yPAmHqTNQFbKOrg04ZqFzSKYtAlQEZ92g";

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const P = require('pino');
const humanHistory = new Map();

async function getMetaAI(text, from){
  if(!humanHistory.has(from)) humanHistory.set(from,[]);
  const h = humanHistory.get(from); h.push(text); if(h.length>4) h.shift();
  
  const system = `You are Brian 23 US. You speak fluent and broken US English plus some kenayn swahili. You understand Swahili but NEVER reply Swahili. 
  99.9% HUMAN RULES:
    - Max 12 words, 1 line
    - Broken english: am, u, ur, gonna, wanna, idk, tbh, yea, nah
    - Lowercase sometimes, typo sometimes
    - If asked AI say "lol me AI? nah bro its me"
    -rada mzee always reply "semaje?"
    - EMOJI RULE: ONLY use 😂 or 🙂 and ONLY 15% of replies. Most replies NO EMOJI. Never use more than 1 emoji per message. Laughing emoji 😂 only when something funny. Don't overuse.
    - Sound human: lol, haha, bro, yea, for real
    - History: ${h.join(' | ')}
  Reply broken English, under 12 words, emoji rarely.`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions",{
    method:"POST",
    headers:{ "Authorization":`Bearer ${GROQ_KEY}`, "Content-Type":"application/json" },
    body: JSON.stringify({
      model:"llama-3.1-8b-instant",
      messages:[{role:"system",content:system},{role:"user",content:text}],
      max_tokens:50, temperature:1.1
    })
  });
  const data = await res.json();
  let reply = data.choices[0].message.content.trim();
  
  // Force emoji rarity - remove if overused
  if(Math.random() > 0.15) { reply = reply.replace(/[\u{1F600}-\u{1F64F}]/gu, "").replace(/😂|🙂|😊|😅/g,"").trim(); }
  if(Math.random()<0.3) reply = reply.toLowerCase();
  h.push(reply);
  return reply.slice(0,140);
}

async function getGeminiAI(text){
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,{
    method:"POST", headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ contents:[{ parts:[{ text:`Brian broken US English only 5-12 words broken english casual human use emoji rarely only 😂 15% time. Reply: ${text}` }] }], generationConfig:{ maxOutputTokens:50, temperature:1 } })
  });
  const data = await res.json();
  return data.candidates[0].content.parts[0].text.trim().slice(0,140);
}

async function getAI(text,from){
  try{ return await getMetaAI(text,from); }
  catch(e){ try{ return await getGeminiAI(text); } catch{ return ["yea bro","am good u?","lol for real","nah am busy rn","haha yea 😂","am comin","idk bro"][Math.floor(Math.random()*7)]; } }
}

async function startBot(){
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const sock = makeWASocket({ auth:state, logger:P({level:'silent'}), browser:["HumanBrian","Chrome","10.0"], markOnlineOnConnect:true });
  sock.ev.on('creds.update',saveCreds);
  sock.ev.on('connection.update',async(u)=>{
    if(u.qr) latestQR = await qrcode.toDataURL(u.qr);
    if(u.connection==='close'){ if(u.lastDisconnect?.error?.output?.statusCode!==DisconnectReason.loggedOut) startBot(); }
    if(u.connection==='open'){ latestQR=null; await sock.sendPresenceUpdate('available'); setInterval(()=>sock.sendPresenceUpdate('available').catch(()=>{}),10000); }
  });
  sock.ev.on('messages.upsert',async({messages})=>{
    for(let m of messages){
      if(!m.message||m.key.fromMe) continue;
      const from=m.key.remoteJid; if(from.endsWith('@g.us')) continue;
      const text=m.message.conversation||m.message.extendedTextMessage?.text||""; if(!text) continue;
      if(Math.random()<0.08) continue;
      try{
        await sock.sendPresenceUpdate('composing',from);
        await new Promise(r=>setTimeout(r,800+Math.random()*2500));
        const reply = await getAI(text,from);
        await sock.sendMessage(from,{text:reply});
        await sock.sendPresenceUpdate('paused',from);
      }catch(e){}
    }
  });
}
startBot();
