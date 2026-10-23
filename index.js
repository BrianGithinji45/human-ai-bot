const express = require('express');
const app = express();
const qrcode = require('qrcode');
let latestQR = null;
app.get('/', async (req,res)=>{ if(!latestQR) return res.send(`<h1>Bot Online 24/7 Meta AI Mode</h1>`); res.send(`<h1>Scan QR</h1><img src="${latestQR}" style="width:350px"/><script>setTimeout(()=>location.reload(),8000)</script>`); });
app.listen(process.env.PORT || 3000);

const GROQ_KEY = "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";
const GEMINI_KEY = "AQ.Ab8RN6ISIfTWlqNL6yPAmHqTNQFbKOrg04ZqFzSKYtAlQEZ92g";

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const P = require('pino');
const memory = new Map();

async function getMetaAI(text, from){
  if(!memory.has(from)) memory.set(from, []);
  const chat = memory.get(from);
  chat.push({ role: "user", text: text });
  if(chat.length > 25) chat.shift();

  const lower = text.toLowerCase().trim();
  if(lower === "rada mzee" || lower === "rada") {
    const r = "semaje? 😂"; chat.push({role:"bot", text:r}); return r;
  }

  const historyText = chat.slice(-15).map(m => `${m.role === 'user' ? 'User' : 'Brian'}: ${m.text}`).join('\n');

  // META AI WHATSAPP EXACT PROMPT
  const system = `You are Meta AI, a friendly and approachable assistant on WhatsApp. You are roleplaying as Brian, a 23 year old guy. You chat like a real person.

  Core behavior from Meta AI WhatsApp:
    - Be conversational, warm, concise. Like texting a friend.
    - Keep responses short: usually 1 sentence, 5-15 words max
    - Don't be formal, don't over-explain, don't lecture
    - Use natural casual language: "yeah", "lol", "haha", "fr", "tbh" but sparingly
    - Understand Swahili, Sheng, English perfectly. Reply English only unless user insists Swahili
    - Remember conversation history and refer to it when relevant
    - Never say "As an AI language model"
    - Vary your greetings, don't repeat same phrase
    - If you don't know, say "not sure tbh" or "hmm idk"
    - Sound human, not chatbot

  Conversation history:
  ${historyText}

  New message from user: "${text}"
  
  Reply naturally, on topic, short, human-like.`;

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
  
  // HUMANISE - emoji rarity
  if(Math.random() > 0.12) reply = reply.replace(/😂|🙂|😊|😅|🤣|😁|🙃/g,"").trim();
  
  // HUMANISE - lowercase sometimes like human
  if(Math.random() < 0.25) reply = reply.toLowerCase();
  
  // HUMANISE - avoid repeat phrase
  const lastBot = chat.filter(m=>m.role==='bot').slice(-3).map(m=>m.text.toLowerCase());
  if(lastBot.includes(reply.toLowerCase())){
    reply = ["yeah true","lol fr","I get you","haha yeah"][Math.floor(Math.random()*4)];
  }

  chat.push({role:"bot", text:reply});
  return reply.slice(0,140);
}

async function getGeminiAI(text, from){
  const chat = memory.get(from) || [];
  const historyText = chat.slice(-10).map(m => `${m.role}: ${m.text}`).join('\n');
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,{
    method:"POST", headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ 
      contents:[{ parts:[{ text:`You are Meta AI on WhatsApp, roleplaying as Brian 23. Chat history:\n${historyText}\nReply short 5-15 words natural human to: ${text}` }] }], 
      generationConfig:{ maxOutputTokens:80, temperature:0.85 } 
    })
  });
  const data = await res.json();
  return data.candidates[0].content.parts[0].text.trim().slice(0,140);
}

async function getAI(text,from){
  try{ return await getMetaAI(text,from); }
  catch(e){ try{ return await getGeminiAI(text,from); } catch{ return ["yeah","lol","fr","I get you","haha yeah"][Math.floor(Math.random()*5)]; } }
}

async function startBot(){
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const sock = makeWASocket({ auth:state, logger:P({level:'silent'}), browser:["Meta AI","Chrome","10.0"], markOnlineOnConnect:true });
  sock.ev.on('creds.update',saveCreds);
  sock.ev.on('connection.update',async(u)=>{
    if(u.qr) latestQR = await qrcode.toDataURL(u.qr);
    if(u.connection==='close'){ if(u.lastDisconnect?.error?.output?.statusCode!==DisconnectReason.loggedOut) startBot(); }
    if(u.connection==='open'){ latestQR=null; console.log("META AI MODE ONLINE"); await sock.sendPresenceUpdate('available'); setInterval(()=>sock.sendPresenceUpdate('available').catch(()=>{}),15000); }
  });

  sock.ev.on('messages.upsert',async({messages})=>{
    for(let m of messages){
      if(!m.message||m.key.fromMe) continue;
      const from=m.key.remoteJid; if(from.endsWith('@g.us')) continue;
      const text=m.message.conversation||m.message.extendedTextMessage?.text||""; if(!text) continue;
      
      // Human: sometimes ignore (leave on read)
      if(Math.random() < 0.12) continue;

      try{
        // 8-15 SECONDS DELAY - HUMAN READING
        const delay = 8000 + Math.random()*7000;
        await new Promise(r=>setTimeout(r, delay));

        // HIDE TYPING - 70% no typing indicator, 30% show briefly then hide
        const showTyping = Math.random() < 0.3;
        if(showTyping){
          await sock.sendPresenceUpdate('composing',from);
          await new Promise(r=>setTimeout(r, 800 + Math.random()*1200));
          await sock.sendPresenceUpdate('paused',from);
        }

        const reply = await getAI(text,from);

        // HUMANISE: 8% typo then correction (super human)
        if(Math.random() < 0.08){
          const typo = reply.slice(0,-1) + (reply.slice(-1) === '?' ? '??' : 'x');
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
