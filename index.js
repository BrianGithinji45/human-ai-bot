const express = require('express');
const app = express();
const qrcode = require('qrcode');
let latestQR = null;
app.get('/', async (req,res)=>{ if(!latestQR) return res.send(`<h1>Bot Online 24/7</h1><p>Meta AI + Gemini<br>Human Mode: ON</p>`); res.send(`<h1>Scan QR</h1><img src="${latestQR}" style="width:350px"/><script>setTimeout(()=>location.reload(),8000)</script>`); });
app.listen(process.env.PORT || 3000);

const GROQ_KEY = "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";
const GEMINI_KEY = "AQ.Ab8RN6ISIfTWlqNL6yPAmHqTNQFbKOrg04ZqFzSKYtAlQEZ92g";

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const P = require('pino');
const humanHistory = new Map();

async function getMetaAI(text, from){
  if(!humanHistory.has(from)) humanHistory.set(from,[]);
  const h = humanHistory.get(from); h.push(text); if(h.length>6) h.shift();
  const lower = text.toLowerCase().trim();
  if(lower === "rada mzee" || lower === "rada" || lower.includes("rada mzee")) return "semaje? 😂";
  
  const system = `You are Brian, 23, normal human guy. Talk exactly like Meta AI when casual - natural, friendly, real.

  RULES:
    - Short, 1 line, 6-14 words max
    - Natural English like texting friend. Understand Swahili/Sheng perfectly but reply English only
    - Don't force broken English. Just natural: "I'm good", "you good?", "lol", "haha"
    - Emoji: 85% no emoji, 15% only 😂 or 🙂, max 1
    - Never say you're AI. If asked say "lol nah it's me Brian"
  
  Examples:
  "uko wapi" -> "I'm home, you at?"
  "mambo" -> "I'm good, you good?"
  "bored" -> "lol same here"
  "nipe pesa" -> "haha I'm broke too 😂"
  "rada mzee" -> "semaje?"
  "are you AI?" -> "lol nah it's me Brian"

  Chat: ${h.join(' | ')}
  Reply to: "${text}"`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions",{
    method:"POST",
    headers:{ "Authorization":`Bearer ${GROQ_KEY}`, "Content-Type":"application/json" },
    body: JSON.stringify({
      model:"llama-3.3-70b-versatile",
      messages:[{role:"system",content:system},{role:"user",content:text}],
      max_tokens:60,
      temperature:0.85
    })
  });
  const data = await res.json();
  let reply = data.choices[0].message.content.trim().replace(/"/g,"");
  if(Math.random() > 0.15) reply = reply.replace(/😂|🙂|😊|😅|🤣/g,"").trim();
  h.push(reply);
  return reply.slice(0,140);
}

async function getGeminiAI(text){
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,{
    method:"POST", headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ contents:[{ parts:[{ text:`You are Brian 23 human natural casual short 6-14 words English only understand Swahili but reply English. Reply to: ${text}` }] }], generationConfig:{ maxOutputTokens:60, temperature:0.85 } })
  });
  const data = await res.json();
  return data.candidates[0].content.parts[0].text.trim().slice(0,140);
}

async function getAI(text,from){
  try{ return await getMetaAI(text,from); }
  catch(e){ try{ return await getGeminiAI(text); } catch{ return ["I'm good, you good?","lol same here","haha yeah 😂","I'm home, you at?","yeah I'm good","lol stop playing 😂","semaje?"][Math.floor(Math.random()*7)]; } }
}

async function startBot(){
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const sock = makeWASocket({ auth:state, logger:P({level:'silent'}), browser:["HumanBrian","Chrome","10.0"], markOnlineOnConnect:true });
  sock.ev.on('creds.update',saveCreds);
  sock.ev.on('connection.update',async(u)=>{
    if(u.qr) latestQR = await qrcode.toDataURL(u.qr);
    if(u.connection==='close'){ if(u.lastDisconnect?.error?.output?.statusCode!==DisconnectReason.loggedOut) startBot(); }
    if(u.connection==='open'){ latestQR=null; console.log("ONLINE 24/7"); await sock.sendPresenceUpdate('available'); setInterval(()=>sock.sendPresenceUpdate('available').catch(()=>{}),10000); }
  });
  sock.ev.on('messages.upsert',async({messages})=>{
    for(let m of messages){
      if(!m.message||m.key.fromMe) continue;
      const from=m.key.remoteJid; if(from.endsWith('@g.us')) continue;
      const text=m.message.conversation||m.message.extendedTextMessage?.text||""; if(!text) continue;
      if(Math.random()<0.07) continue;
      try{
        await sock.sendPresenceUpdate('composing',from);
        await new Promise(r=>setTimeout(r,700+Math.random()*2000));
        const reply = await getAI(text,from);
        await sock.sendMessage(from,{text:reply});
        await sock.sendPresenceUpdate('paused',from);
      }catch(e){}
    }
  });
}
startBot();
