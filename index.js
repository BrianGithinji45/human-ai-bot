const express = require('express');
const app = express();
const qrcode = require('qrcode');
let latestQR = null;
app.get('/', async (req,res)=>{ if(!latestQR) return res.send(`<h1>Bot Online 24/7</h1>`); res.send(`<h1>Scan QR</h1><img src="${latestQR}" style="width:350px"/><script>setTimeout(()=>location.reload(),8000)</script>`); });
app.listen(process.env.PORT || 3000);

const GROQ_KEY = "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";
const GEMINI_KEY = "AQ.Ab8RN6ISIfTWlqNL6yPAmHqTNQFbKOrg04ZqFzSKYtAlQEZ92g";

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const P = require('pino');

// MEMORY - REMEMBERS 20 MESSAGES PER PERSON
const memory = new Map();

async function getMetaAI(text, from){
  if(!memory.has(from)) memory.set(from, []);
  const chat = memory.get(from);
  
  const lower = text.toLowerCase().trim();
  // Always remember
  chat.push({ role: "user", text: text, time: Date.now() });
  if(chat.length > 20) chat.shift(); // keep last 20

  // HARD TRIGGERS - ALWAYS ON TOPIC
  if(lower === "rada mzee" || lower === "rada") {
    const r = "semaje? 😂"; chat.push({role:"bot", text:r}); return r;
  }
  if(lower.includes("how are you") || lower.match(/mambo|uko aje|uko poa|how r u/)){
    const r = ["I'm good, you good?","Good man, you?","I'm okay, you good?"][Math.floor(Math.random()*3)];
    chat.push({role:"bot", text:r}); return r;
  }
  if(lower.includes("uko wapi") || lower.includes("wapi we") || lower.includes("where are you")){
    const r = ["I'm home, you at?","I'm around, you at?","I'm home man"][Math.floor(Math.random()*3)];
    chat.push({role:"bot", text:r}); return r;
  }
  if(lower.match(/\bbored\b/)){
    const r = "lol same here"; chat.push({role:"bot", text:r}); return r;
  }

  // Build history string for AI to remember
  const historyText = chat.slice(-10).map(m => `${m.role === 'user' ? 'Them' : 'You'}: ${m.text}`).join('\n');

  const system = `You are Brian, 23, human. You remember old chats and reply ON TOPIC.

  MEMORY:
  ${historyText}

  RULES:
    1. RELEVANCE: Reply to what user JUST said, using memory if needed
    2. If user asks "how are you" -> say how you are: "I'm good"
    3. If user says something you talked before, reference it: "yeah you said..."
    4. Short: 5-12 words, 1 line, natural English like Meta AI
    5. Understand Swahili but reply English only
    6. Emoji: 85% no emoji, 15% only 😂 or 🙂 max 1
    7. Never say you are AI

  User just said: "${text}"
  Reply ON TOPIC using memory.`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions",{
    method:"POST",
    headers:{ "Authorization":`Bearer ${GROQ_KEY}`, "Content-Type":"application/json" },
    body: JSON.stringify({
      model:"llama-3.3-70b-versatile",
      messages:[{role:"system",content:system},{role:"user",content:text}],
      max_tokens:60,
      temperature:0.6
    })
  });
  const data = await res.json();
  let reply = data.choices[0].message.content.trim().replace(/"/g,"");
  if(Math.random() > 0.15) reply = reply.replace(/😂|🙂|😊|😅|🤣/g,"").trim();
  
  chat.push({role:"bot", text:reply, time: Date.now()});
  return reply.slice(0,130);
}

async function getGeminiAI(text, from){
  const chat = memory.get(from) || [];
  const historyText = chat.slice(-8).map(m => `${m.role}: ${m.text}`).join('\n');
  
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,{
    method:"POST", headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ 
      contents:[{ parts:[{ text:`You are Brian human, remember chat:\n${historyText}\n\nReply ON TOPIC short 5-12 words natural English to: ${text}` }] }], 
      generationConfig:{ maxOutputTokens:60, temperature:0.6 } 
    })
  });
  const data = await res.json();
  return data.candidates[0].content.parts[0].text.trim().slice(0,130);
}

async function getAI(text,from){
  try{ return await getMetaAI(text,from); }
  catch(e){ try{ return await getGeminiAI(text,from); } catch{ return "I'm good, you good?"; } }
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
      try{
        await sock.sendPresenceUpdate('composing',from);
        await new Promise(r=>setTimeout(r,600+Math.random()*1500));
        const reply = await getAI(text,from);
        await sock.sendMessage(from,{text:reply});
        await sock.sendPresenceUpdate('paused',from);
      }catch(e){}
    }
  });
}
startBot();
