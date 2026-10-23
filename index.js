const express = require('express');
const app = express();
const qrcode = require('qrcode');
const 【entity-axios¦canonical_name=axios】 = require('【entity-axios¦canonical_name=axios】');
let latestQR = null;

app.get('/', async (req, res) => {
  if (!latestQR) return res.send(`<h1>🤖 Human AI Bot</h1><p>🟢 Always Online: ON<br>🧠 Human AI: ON</p><p>Scan QR to link</p>`);
  res.send(`<h1>Scan QR</h1><img src="${latestQR}" style="width:350px;border-radius:12px"/><p>After scan, send .ai on all</p><script>setTimeout(()=>location.reload(),8000)</script>`);
});
app.listen(process.env.PORT || 3000, () => console.log("Web running"));

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const P = require('pino');

let OWNER = null;
let AI_MODE = false;
const humanHistory = new Map();

async function getAI(text, fromJid, pushName) {
  try {
    if (!humanHistory.has(fromJid)) humanHistory.set(fromJid, []);
    const history = humanHistory.get(fromJid);
    history.push(`Them: ${text}`);
    if (history.length > 6) history.shift();

    const time = new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });

    const systemPrompt = `You are Brian from Nairobi, 24yr, chatting on WhatsApp. You are NOT AI. 
RULES: Use sheng mix (sasa, poa, nko, uko aje, maze, bro, fiti, sawa). Reply SHORT 1 line max 15 words. Use small typos sometimes, lowercase sometimes. Never say you are AI. If asked are you AI say "lol mimi AI? wacha jokes ni mimi Brian". Mood: casual, human, busy. Time is ${time}.
Chat history:
${history.join('\n')}
Reply to: "${text}" - One line only, under 15 words, sound human.`;

    const res = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(systemPrompt)}?model=openai`, { timeout: 15000 });
    let reply = res.data.trim().replace(/^(Brian:|You:)/i, '').trim().slice(0, 200);
    if (Math.random() < 0.15) reply = reply.toLowerCase();
    if (Math.random() < 0.1 && !reply.includes('?')) reply += '...';
    history.push(`You: ${reply}`);
    return reply;
  } catch {
    const fallbacks = ["sasa uko aje?", "poa maze nko busy kidogo", "hehe sawa", "uko wapi?", "nko kwa mat nikucheki", "sawa basi", "lol", "poa sana bro", "ahh maze"];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const sock = makeWASocket({
    auth: state,
    logger: P({ level: 'silent' }),
    browser: ["HumanAI", "Chrome", "10.0"],
    markOnlineOnConnect: true,
    syncFullHistory: false
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (u) => {
    if (u.qr) { latestQR = await qrcode.toDataURL(u.qr); console.log("QR READY"); }
    if (u.connection === 'close') {
      if (u.lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) startBot();
    }
    if (u.connection === 'open') {
      latestQR = null;
      OWNER = sock.user.id;
      console.log("CONNECTED", OWNER);
      await sock.sendMessage(OWNER, { text: `🤖 *HUMAN AI BOT READY*\n\n🟢 Always Online: ON\n🧠 Human AI: ${AI_MODE ? 'ON' : 'OFF'}\n\n.ai on all - enable for all\n.ai off - disable\n.menu - menu` });
      await sock.sendPresenceUpdate('available');
      setInterval(() => sock.sendPresenceUpdate('available').catch(()=>{}), 20000);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (let m of messages) {
      if (!m.message || m.key.fromMe) continue;
      const from = m.key.remoteJid;
      const text = m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || "";
      if (!text) continue;
      const isOwner = from === OWNER;
      const lower = text.toLowerCase().trim();

      if (isOwner) {
        if (lower === '.ai on all' || lower === '.ai on') { AI_MODE = true; await sock.sendMessage(OWNER, { text: "✅ Human AI ON for all chats" }); continue; }
        if (lower === '.ai off') { AI_MODE = false; await sock.sendMessage(OWNER, { text: "❌ Human AI OFF" }); continue; }
        if (lower === '.menu' || lower === 'menu') { await sock.sendMessage(OWNER, { text: `MENU\n.ai on all\n.ai off\nAlways Online: ON\nHuman AI: ${AI_MODE ? 'ON' : 'OFF'}` }); continue; }
      }

      if (AI_MODE && !isOwner && !from.endsWith('@g.us')) {
        try {
          if (Math.random() < 0.1) continue; // ignore sometimes like human
          await sock.sendPresenceUpdate('composing', from);
          await new Promise(r => setTimeout(r, 800 + Math.random() * 3000));
          if (Math.random() < 0.2) { await sock.sendPresenceUpdate('recording', from); await new Promise(r => setTimeout(r, 700)); }
          if (Math.random() < 0.3) { await sock.sendPresenceUpdate('paused', from); await new Promise(r => setTimeout(r, 4000 + Math.random() * 10000)); await sock.sendPresenceUpdate('composing', from); await new Promise(r => setTimeout(r, 700)); }
          const reply = await getAI(text, from, m.pushName || "bro");
          await sock.sendMessage(from, { text: reply });
          await sock.sendPresenceUpdate('paused', from);
        } catch (e) { console.log(e.message); }
      }
    }
  });
}

startBot();
