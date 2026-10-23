const express = require('express');
const app = express();
const qrcode = require('qrcode');
let latestQR = null;
let BOT_ENABLED = true; // Bot ON/OFF switch

// DON'T EDIT - This keeps bot online 24/7 and shows QR code on your Koyeb link
app.get('/', async (req,res)=>{
  if(!latestQR) return res.send(`<h1>Bot ${BOT_ENABLED?'🟢 ON':'🔴 OFF'} - 24/7 Online</h1><p>Send .off or .on from your number</p>`);
  res.send(`<h1>Scan QR to link WhatsApp</h1><img src="${latestQR}" style="width:350px"/><p>Scan with WhatsApp > Linked Devices</p><script>setTimeout(()=>location.reload(),8000)</script>`);
});
app.listen(process.env.PORT || 3000); 

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const P = require('pino');

// ============================================================================
// ========================= EDIT HERE ONLY ===================================
// ============================================================================

// 1. EDIT HERE - YOUR NUMBER (Only this number can turn bot ON/OFF)
//    Example: "254712345678" - Don't add + or spaces
const OWNER_NUMBER = "254707734799"; 
const GROQ_KEY = "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"; 
const GEMINI_KEY = "AQ.Ab8RN6ISIfTWlqNL6yPAmHqTNQFbKOrg04ZqFzSKYtAlQEZ92g"; 
const STARTER_WORDS = [
  "rada mzee",  // <-- YOU CAN EDIT/ADD HERE
  "rada",       // <-- YOU CAN EDIT/ADD HERE
  "sasa",       // <-- YOU CAN EDIT/ADD HERE
  "mambo",      // <-- YOU CAN EDIT/ADD HERE
  "hey",        // <-- YOU CAN EDIT/ADD HERE
  "hi",         // <-- YOU CAN EDIT/ADD HERE
  "hello",      // <-- YOU CAN EDIT/ADD HERE
  "niaje",      // <-- YOU CAN EDIT/ADD HERE
  "uko",        // <-- YOU CAN EDIT/ADD HERE
  "poa",        // <-- YOU CAN EDIT/ADD HERE
  "semaje",     // <-- YOU CAN EDIT/ADD HERE
  "vipi",       // <-- YOU CAN EDIT/ADD HERE
  "yo",         // <-- YOU CAN EDIT/ADD HERE
  "habari", 
  "hi",
  "hey",
  "yoh",
  "woza",
  "mzee",
  "yobi",
  "alo",
  "bro",
  "morning",// <-- YOU CAN EDIT/ADD HERE
  // ADD MORE WORDS BELOW LIKE THIS:
  // "bro",
  // "morning",
];

// 4. EDIT HERE - WHAT BOT SAYS (Change messages bot sends)
const REPLY_1 = "niko poa wewe uko aje?"; // <-- EDIT FIRST MESSAGE
const REPLY_2 = "Good, wossap?"; // <-- EDIT SECOND MESSAGE
const REPLY_3 = "I will get back to you shortly, I'm Brian's bot not him.. he'll be back soon"; // <-- EDIT THIRD
const REPLY_4 = "Do you need any services from me, his AI assistant? I can look into anything you want from Google - just ask"; // <-- EDIT FOURTH

// 5. EDIT HERE - DELAY TIME (How long bot waits before replying - makes it human)
const MIN_DELAY = 5000;  // 8000 = 8 seconds <-- EDIT MIN WAIT
const MAX_DELAY = 15000; // 15000 = 15 seconds <-- EDIT MAX WAIT

// ============================================================================
// ========================= DON'T EDIT BELOW =================================
// ============================================================================
// DON'T EDIT - Tracks who is in Google AI mode
const aiMode = new Map();
const chatMemory = new Map();

// DON'T EDIT - Google AI brain with Groq + Gemini fallback
async function getAIWithFallback(text, from){
  if(!chatMemory.has(from)) chatMemory.set(from, []);
  const chat = chatMemory.get(from);
  chat.push({role:"user", text:text});
  if(chat.length > 10) chat.shift();
  const history = chat.slice(-6).map(m=>`${m.role}: ${m.text}`).join('\n');
  const system = `You are Brian's professional Google AI assistant. Formal, helpful, Kenyan context if relevant. Short-medium answers.\nHistory:\n${history}\nUser: ${text}\nAnswer:`;
  try{
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions",{
      method:"POST",
      headers:{ "Authorization":`Bearer ${GROQ_KEY}`, "Content-Type":"application/json" },
      body: JSON.stringify({ model:"llama-3.3-70b-versatile", messages:[{role:"system",content:system},{role:"user",content:text}], max_tokens:350, temperature:0.7 })
    });
    const data = await res.json();
    if(data.choices?.[0]){ const r=data.choices[0].message.content.trim(); chat.push({role:"assistant", text:r}); return r; }
    throw new Error("groq fail");
  }catch(e){
    try{
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,{
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ contents:[{parts:[{text: system + "\nUser: " + text}]}], generationConfig:{maxOutputTokens:350} })
      });
      const data = await res.json();
      const r = data.candidates[0].content.parts[0].text.trim();
      chat.push({role:"assistant", text:r});
      return r;
    }catch(e2){ return "Pole, connection issue. Try again - niko hapa."; }
  }
}

// DON'T EDIT - Main bot engine
async function startBot(){
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const sock = makeWASocket({ auth:state, logger:P({level:'silent'}), browser:["Brian","Chrome","10.0"], markOnlineOnConnect:true });
  sock.ev.on('creds.update',saveCreds);
  sock.ev.on('connection.update',async(u)=>{
    if(u.qr) latestQR = await qrcode.toDataURL(u.qr);
    if(u.connection==='close'){ if(u.lastDisconnect?.error?.output?.statusCode!==DisconnectReason.loggedOut) startBot(); }
    if(u.connection==='open'){ latestQR=null; console.log("BOT ONLINE"); await sock.sendPresenceUpdate('available'); setInterval(()=>sock.sendPresenceUpdate('available').catch(()=>{}),10000); }
  });

  sock.ev.on('messages.upsert',async({messages})=>{
    for(let m of messages){
      if(!m.message||m.key.fromMe) continue;
      const from=m.key.remoteJid; if(from.endsWith('@g.us')) continue;
      const text=m.message.conversation||m.message.extendedTextMessage?.text||""; if(!text) continue;
      const lower=text.toLowerCase().trim();
      const isOwner=from.includes(OWNER_NUMBER);

      // DON'T EDIT - Owner control commands - ONLY YOUR NUMBER CAN USE
      if(isOwner && [".off","bot off","off","stop bot"].includes(lower)){ 
        BOT_ENABLED=false; 
        aiMode.clear();
        await sock.sendMessage(from,{text:"🔴 Bot OFF - silent but online 24/7\nSend .on to turn back on"}); 
        continue; 
      }
      if(isOwner && [".on","bot on","on","start bot"].includes(lower)){ 
        BOT_ENABLED=true; 
        await sock.sendMessage(from,{text:"🟢 Bot ON - niko fiti, ready"}); 
        continue; 
      }
      if(isOwner && lower===".reset"){ aiMode.clear(); chatMemory.clear(); await sock.sendMessage(from,{text:"✅ Reset done"}); continue; }

      if(!BOT_ENABLED) continue;

      // DON'T EDIT - Google AI mode
      if(aiMode.has(from)){
        if(["no","hapana","no thanks","sawa","no need","exit"].includes(lower)){
          await sock.sendMessage(from,{text:"Sawa, Brian will get back to you soon. Niko hapa if you need me."});
          aiMode.delete(from);
          continue;
        }
        await sock.sendPresenceUpdate('composing',from);
        const reply = await getAIWithFallback(text, from);
        await sock.sendMessage(from,{text:reply});
        continue;
      }

      // DON'T EDIT - Checks if message starts with allowed words
      if(!STARTER_WORDS.some(w=>lower.startsWith(w))) continue;

      try{
        await new Promise(r=>setTimeout(r, MIN_DELAY + Math.random()*(MAX_DELAY-MIN_DELAY)));
        await sock.sendMessage(from,{text:REPLY_1});
        await new Promise(r=>setTimeout(r, 1200));
        await sock.sendMessage(from,{text:REPLY_2});
        await new Promise(r=>setTimeout(r, 1200));
        await sock.sendMessage(from,{text:REPLY_3});
        await new Promise(r=>setTimeout(r, 1500));
        await sock.sendMessage(from,{text:REPLY_4});
        aiMode.set(from, true);
      }catch(e){}
    }
  });
}
startBot();
