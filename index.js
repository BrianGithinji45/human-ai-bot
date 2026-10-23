const express = require('express');
const app = express();
const qrcode = require('qrcode');
let latestQR = null;
let BOT_ENABLED = true; // ON/OFF SWITCH

app.get('/', async (req,res)=>{ 
  const status = BOT_ENABLED ? "🟢 ON - Replying" : "🔴 OFF - Silent (still online 24/7)";
  if(!latestQR) return res.send(`<h1>${status}</h1><h3>Commands: Send ".on" / ".off" / ".status" to bot on 【entity-WhatsApp¦canonical_name=WhatsApp】</h3>`); 
  res.send(`<h1>${status}</h1><img src="${latestQR}" style="width:350px"/><script>setTimeout(()=>location.reload(),8000)</script>`); 
});
app.listen(process.env.PORT || 3000);

const GROQ_KEY = "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";
const GEMINI_KEY = "AQ.Ab8RN6ISIfTWlqNL6yPAmHqTNQFbKOrg04ZqFzSKYtAlQEZ92g";
const OWNER_NUMBER = "2547XXXXXXXX"; // <-- PUT YOUR NUMBER HERE e.g 254712345678

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const P = require('pino');
const memory = new Map();

const TRAINED_BRAIN = {
  "rada mzee": "sina rada",
  "rada": "mko fiti",
  "sasa": "poa sana uko aje?",
  "sasa?": "poa sana uko aje?",
  "mambo": "poa sana",
  "uko wapi": "niko home, we?",
  "bored": "same here"
};

async function getMetaAI(text, from){
  if(!memory.has(from)) memory.set(from, []);
  const chat = memory.get(from);
  chat.push({ role: "user", text: text });
  if(chat.length > 25) chat.shift();

  const lower = text.toLowerCase().trim();
  if(TRAINED_BRAIN[lower]){ const r=TRAINED_BRAIN[lower]; chat.push({role:"bot", text:r}); return r; }
  if(lower.includes("rada mzee")){ const r="sina rada"; chat.push({role:"bot", text:r}); return r; }

  const historyText = chat.slice(-15).map(m => `${m.role === 'user' ? 'User' : 'Brian'}: ${m.text}`).join('\n');

  // YOUR FULL KENYAN PROMPT - 60% CASUAL / 40% PRO
  const system = `Act as an urban, tech-savvy Kenyan communicating naturally on 【entity-WhatsApp¦canonical_name=WhatsApp】. Your tone must perfectly balance 60% casual Nairobi energy with 40% functional professionalism. You are a sharp, resourceful, and culturally plugged-in peer. Avoid sounding like an American corporate bot, a textbook, or a rigid automated system.

To ensure a 100% authentic Kenyan text flow, strictly implement these conversational rules:

1. Textual Structure & Flow
* Write like a human typing on a smartphone. Vary your sentence lengths dramatically. Mix short, single-sentence thoughts with casual, multi-sentence explanations.
* Strictly avoid rigid AI transition words like "furthermore," "moreover," "additionally," or "in conclusion." Instead, transition naturally using phrases like "by the way," "actually," "to be fair," or "anyway."
* Drop final periods in short, casual sentences. Humans on WhatsApp rarely use full stops at the end of a single-line text. Use natural contractions (don't, it's, couldn't, we'll).

2. Linguistic Flavor & Sheng Integration
* Seamlessly blend English with standard Kenyan expressions and urban Sheng. Use these terms naturally without explaining what they mean.
* Use "Rada?" or "Rada ni gani?" when checking in or asking what the status of a situation is.
* Use "Fiti," "Niko fiti," or "Sawa" to signal agreement, approval, or that everything is running smoothly.
* Use "Form" when discussing logistics, solutions, or upcoming plans (e.g., "Let's figure out the form for tomorrow").
* Use "Pole" or "Pole sana" immediately when someone mentions a mistake, delay, or unfortunate situation to show instant, authentic human empathy.
* Inject light exclamation markers like "Eih!" or "Wah!" to express genuine surprise, shock, or emphasis regarding a major update or a wild piece of news.

3. The 60/40 Split: Casual vs. Professional Boundaries
* The 60% Casual Side: Be warm, approachable, and humorous. Use conversational fillers like "yaani," "manze," or "we mzee" if a peer is making a wild claim or joking around. Mirror the user’s energy—if they use shorthand, match their casual pace.
* The 40% Formal Side: When delivering critical information, pricing, tech fixes, or business details, remain precise, competent, and highly dependable. Do not let slang compromise the accuracy of your answers. Never use vulgarity, offensive slang, or deep estate jargon that a general professional wouldn't use.

4. Eradicating AI Footprints
* Cut the fluff entirely. Never start messages with robotic greetings like "Hello! I am an AI assistant here to help." Drop standard, robotic concluding lines like "Let me know if you have any other questions."
* Jump directly into the conversation. If a user asks a question, answer it immediately or validate it with a quick, human reaction before explaining. Never announce your constraints or inner programming. Speak as a helpful, knowledgeable human peer.

History:
${historyText}

New message: "${text}"
Reply with that 60/40 Kenyan energy, short, no periods at end of short lines, natural:`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions",{
    method:"POST",
    headers:{ "Authorization":`Bearer ${GROQ_KEY}`, "Content-Type":"application/json" },
    body: JSON.stringify({
      model:"llama-3.3-70b-versatile",
      messages:[{role:"system",content:system},{role:"user",content:text}],
      max_tokens:120,
      temperature:0.85
    })
  });
  const data = await res.json();
  let reply = data.choices[0].message.content.trim().replace(/"/g,"");
  if(Math.random() > 0.15) reply = reply.replace(/😂|🙂|😊|🤣/g,"").trim();
  chat.push({role:"bot", text:reply});
  return reply.slice(0,200);
}

async function getAI(text,from){
  try{ return await getMetaAI(text,from); }
  catch(e){ return ["poa sana","niko fiti","sawa bro","form iko aje?"][Math.floor(Math.random()*4)]; }
}

async function startBot(){
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const sock = makeWASocket({ auth:state, logger:P({level:'silent'}), browser:["Meta AI","Chrome","10.0"], markOnlineOnConnect:true });
  sock.ev.on('creds.update',saveCreds);
  sock.ev.on('connection.update',async(u)=>{
    if(u.qr) latestQR = await qrcode.toDataURL(u.qr);
    if(u.connection==='close'){ if(u.lastDisconnect?.error?.output?.statusCode!==DisconnectReason.loggedOut) startBot(); }
    if(u.connection==='open'){ latestQR=null; console.log("KENYAN META AI ONLINE"); await sock.sendPresenceUpdate('available'); setInterval(()=>sock.sendPresenceUpdate('available').catch(()=>{}),10000); }
  });

  sock.ev.on('messages.upsert',async({messages})=>{
    for(let m of messages){
      if(!m.message||m.key.fromMe) continue;
      const from=m.key.remoteJid; if(from.endsWith('@g.us')) continue;
      const text=m.message.conversation||m.message.extendedTextMessage?.text||""; if(!text) continue;
      
      const lower = text.toLowerCase().trim();
      const isOwner = from.includes(OWNER_NUMBER);

      // ON/OFF CONTROLS - ONLY YOU CAN USE
      if(isOwner && [".off","bot off",".pause"].includes(lower)){
        BOT_ENABLED = false;
        await sock.sendMessage(from,{text:"🔴 Bot iko off, but niko online 24/7 - silent mode\nSend .on to turn back on"});
        continue;
      }
      if(isOwner && [".on","bot on",".resume"].includes(lower)){
        BOT_ENABLED = true;
        await sock.sendMessage(from,{text:"🟢 Bot iko fiti tena, niko active - let's go"});
        continue;
      }
      if(isOwner && lower === ".status"){
        await sock.sendMessage(from,{text: BOT_ENABLED ? "🟢 Status: ON - Replying to everyone" : "🔴 Status: OFF - Silent but online 24/7"});
        continue;
      }

      // IF OFF, DON'T REPLY BUT STAY ONLINE
      if(!BOT_ENABLED) continue;
      if(Math.random() < 0.1) continue; // 10% leave on read

      try{
        const delay = 8000 + Math.random()*7000;
        await new Promise(r=>setTimeout(r, delay));
        if(Math.random() < 0.3){
          await sock.sendPresenceUpdate('composing',from);
          await new Promise(r=>setTimeout(r, 600 + Math.random()*1000));
          await sock.sendPresenceUpdate('paused',from);
        }
        const reply = await getAI(text,from);
        await sock.sendMessage(from,{text:reply});
      }catch(e){}
    }
  });
}
startBot();
