const express = require('express');
const app = express();
const qrcode = require('qrcode');
let latestQR = null;

app.get('/', async (req, res) => {
  if (!latestQR) return res.send(`<h1>Bot Online</h1>`);
  res.send(`<h1>Scan QR</h1><img src="${latestQR}" style="width:350px"/><script>setTimeout(()=>location.reload(),8000)</script>`);
});
app.listen(process.env.PORT || 3000);

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const P = require('pino');

let AI_MODE = true;
const humanHistory = new Map();

async function getAI(text, fromJid) {
  try {
    const prompt = `You are Brian from Nairobi. Reply like Kenyan human WhatsApp. Use sheng sasa poa nko maze bro sawa. Max 12 words 1 line casual Reply to: ${text}`;
    const url = `https://text.pollinations.ai/${encodeURIComponent(prompt)}?model=openai`;
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    const data = await res.text();
    return data.trim().slice(0,180);
  } catch {
    return "poa maze, nko fiti. uko aje?";
  }
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const sock = makeWASocket({
    auth: state,
    logger: P({ level: 'silent' }),
    browser: ["BrianBot", "Chrome", "10.0"],
    markOnlineOnConnect: true
  });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', async (u) => {
    if (u.qr) { latestQR = await qrcode.toDataURL(u.qr); }
    if (u.connection === 'close') {
      if (u.lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) startBot();
    }
    if (u.connection === 'open') {
      latestQR = null;
      console.log("BOT CONNECTED");
      await sock.sendPresenceUpdate('available');
      setInterval(() => sock.sendPresenceUpdate('available').catch(()=>{}), 15000);
    }
  });
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (let m of messages) {
      if (!m.message || m.key.fromMe) continue;
      const from = m.key.remoteJid;
      const text = m.message.conversation || m.message.extendedTextMessage?.text || "";
      if (!text) continue;
      const lower = text.toLowerCase().trim();
      if (lower === '.ai off') { AI_MODE = false; await sock.sendMessage(from, { text: "AI OFF" }); continue; }
      if (lower === '.ai on' || lower === '.ai on all') { AI_MODE = true; await sock.sendMessage(from, { text: "AI ON" }); continue; }
      if (AI_MODE && !from.endsWith('@g.us')) {
        try {
          await sock.sendPresenceUpdate('composing', from);
          await new Promise(r => setTimeout(r, 1200 + Math.random()*2000));
          const reply = await getAI(text, from);
          await sock.sendMessage(from, { text: reply });
          await sock.sendPresenceUpdate('paused', from);
        } catch(e){}
      }
    }
  });
}
startBot();
