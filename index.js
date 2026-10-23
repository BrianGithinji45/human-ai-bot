const express = require('express');
const app = express();
const qrcode = require('qrcode');
let latestQR = null;
app.get('/', async (req,res)=>{ 
  if(!latestQR) return res.send(`<h1>Bot Online 24/7 - Meta AI Mode</h1><p>Scan QR from logs</p>`); 
  res.send(`<h1>Scan QR</h1><img src="${latestQR}" style="width:350px"/><script>setTimeout(()=>location.reload(),8000)</script>`); 
});
app.listen(process.env.PORT || 3000);

const GROQ_KEY = "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";
const GEMINI_KEY = "AQ.Ab8RN6ISIfTWlqNL6yPAmHqTNQFbKOrg04ZqFzSKYtAlQEZ92g";

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const P = require('pino');

// MEMORY + TRAINED BRAIN
const memory = new Map();

// YOUR TRAINED TRIGGERS - 100% EXACT REPLIES
const TRAINED_BRAIN = {
  "rada mzee": "sina rada",
  "rada mzee?": "sina rada",
  "rada": "mko fiti",
  "rada?": "mko fiti",
  "sasa": "poa sana uko aje?",
  "sasa?": "poa sana uko aje?",
  "sasa bro": "poa sana uko aje?",
  "mambo": "poa sana",
  "mambo?": "poa sana",
  "poa?": "poa sana",
  "uko wapi": "niko home, we?",
  "wapi": "niko home, we?",
  "how are you": "poa sana",
  "uko aje": "niko fiti, we?",
  "bored": "same here"
};

const BANNED_PHRASES = ["haha yeah", "yeah", "lol", "i get you", "fr fr", "haha yeah 😂"];

async function getMetaAI(text, from){
  if(!memory.has(from)) memory.set(from, []);
  const chat = memory.get(from);
  chat.push({ role: "user", text: text });
  if(chat.length > 25) chat.shift();

  const lower = text.toLowerCase().trim();

  // 1. TRAINED EXACT REPLIES - 100% ACCURATE
  if(TRAINED_BRAIN[lower]){
    const r = TRAINED_BRAIN[lower];
    chat.push({role:"bot", text:r});
    return r;
  }
  // partial match for rada mzee inside sentence
  if(lower.includes("rada mzee")) { const r="sina rada"; chat.push({role:"bot", text:r}); return r; }
  if(lower === "rada mzee bro" || lower.includes("rada mzee")) { const r="sina rada"; chat.push({role:"bot", text:r}); return r; }

  const historyText = chat.slice(-15).map(m => `${m.role === 'user' ? 'User' : 'Brian'}: ${m.text}`).join('\n');

  // 2. META AI 【entity-WHATSAPP¦canonical_name=WhatsApp】 PROMPT - TRAINED
  const system = `You are Meta AI on WhatsApp, roleplaying as Brian, 23, from Kenya. You talk like a real human.

  Your trained brain:
  ${JSON.stringify(TRAINED_BRAIN, null, 2)}

  Conversation history (remember this):
  ${historyText}

  Rules to sound exactly like Meta AI WhatsApp + human:
    - Reply ON TOPIC to: "${text}"
    - Short: 3-10 words max, 1 line only
    - Natural: use "poa", "niko", "sawa" sometimes but mostly English
    - Never repeat same reply twice in a row
    - Never say "As an AI"
    - Understand Swahili/Sheng perfectly, reply short English/Sheng mix
    - If you don't know, say "sawa" or "poa"
    - Vary replies, don't always say same thing

  User just said: "${text}"
  Your short, relevant, human reply:`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions",{
    method:"POST",
    headers:{ "Authorization":`Bearer ${GROQ_KEY}`, "Content-Type":"application/json" },
    body: JSON.stringify({
      model:"llama-3.3-70b-versatile",
      messages:[{role:"system",content:system},{role:"user",content:text}],
      max_tokens:80,
      temperature:0.85,
      top_p:0.9
    })
  });
  const data = await res.json();
  let reply = data.choices[0].message.content.trim().replace(/"/g,"").replace(/^Brian:\s*/i,"").replace(/^Meta AI:\s*/i,"");
  
  // HUMANISE
  if(Math.random() > 0.12) reply = reply.replace(/😂|🙂|😊|😅|🤣|😁|❤️|🔥/g,"").trim();
  if(Math.random() < 0.2) reply = reply.toLowerCase(); // 20% lowercase like human
  
  // ANTI SPAM - ban haha yeah
  if(BANNED_PHRASES.includes(reply.toLowerCase()) || reply.length < 2){
    reply = ["poa sana","niko fiti","sawa bro","lol true","yeah man"][Math.floor(Math.random()*5)];
  }

  chat.push({role:"bot", text:reply});
  return reply.slice(0,130);
}

async function getGeminiAI(text, from){
  const chat = memory.get(from) || [];
  const historyText = chat.slice(-10).map(m => `${m.role}: ${m.text}`).join('\n');
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,{
    method:"POST", headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ 
      contents:[{ parts:[{ text:`You are Meta AI WhatsApp as Brian 23. History:\n${historyText}\nReply short 3-10 words human to: ${text}` }] }], 
      generationConfig:{ maxOutputTokens:80, temperature:0.85 } 
    })
  });
  const data = await res.json();
  return data.candidates[0].content.parts[0].text.trim().slice(0,130);
}

async function getAI(text,from){
  try{ 
    let r = await getMetaAI(text,from);
    // extra anti-spam
    if(BANNED_PHRASES.includes(r.toLowerCase().trim())) {
      r = ["poa sana","niko fiti","sawa","lol true"][Math.floor(Math.random()*4)];
    }
    return r;
  }
  catch(e){ 
    try{ return await getGeminiAI(text,from); } 
    catch{ return ["poa sana","niko fiti","sawa bro","lol true","yeah man"][Math.floor(Math.random()*5)]; } 
  }
}

async function startBot(){
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const sock = makeWASocket({ auth:state, logger:P({level:'silent'}), browser:["Meta AI","Chrome","10.0"], markOnlineOnConnect:true });
  sock.ev.on('creds.update',saveCreds);
  sock.ev.on('connection.update',async(u)=>{
    if(u.qr) latestQR = await qrcode.toDataURL(u.qr);
    if(u.connection==='close'){ if(u.lastDisconnect?.error?.output?.statusCode!==DisconnectReason.loggedOut) startBot(); }
    if(u.connection==='open'){ latestQR=null; console.log("FINAL META AI MODE ONLINE"); await sock.sendPresenceUpdate('available'); setInterval(()=>sock.sendPresenceUpdate('available').catch(()=>{}),15000); }
  });

  sock.ev.on('messages.upsert',async({messages})=>{
    for(let m of messages){
      if(!m.message||m.key.fromMe) continue;
      const from=m.key.remoteJid; if(from.endsWith('@g.us')) continue;
      const text=m.message.conversation||m.message.extendedTextMessage?.text||""; if(!text) continue;
      
      // Leave on read 12% like human
      if(Math.random() < 0.12) continue;

      try{
        // 8-15 SECONDS DELAY
        const delay = 8000 + Math.random()*7000;
        await new Promise(r=>setTimeout(r, delay));

        // HIDE TYPING - 70% no typing, 30% brief typing
        if(Math.random() < 0.3){
          await sock.sendPresenceUpdate('composing',from);
          await new Promise(r=>setTimeout(r, 600 + Math.random()*1000));
          await sock.sendPresenceUpdate('paused',from);
        }

        const reply = await getAI(text,from);

        // TYPO CORRECTION 8% - super human
        if(Math.random() < 0.08 && reply.length > 4){
          const typo = reply.slice(0,-2) + "x" + reply.slice(-1);
          await sock.sendMessage(from,{text:typo});
          await new Promise(r=>setTimeout(r, 700 + Math.random()*500));
          await sock.sendMessage(from,{text:"*"+reply});
        } else {
          await sock.sendMessage(from,{text:reply});
        }

      }catch(e){ console.log(e); }
    }
  });
}
startBot();
