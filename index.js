require("dotenv").config(); // 1. Load security variables
const { TelegramClient, Api } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");
const express = require("express");
const app = express();

// Health check for Render/UptimeRobot
app.get("/", (req, res) => res.send("Bot is active and healthy!"));
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Monitor live on port ${PORT}`));

// Variables loaded from .env file
const apiId = parseInt(process.env.API_ID);
const apiHash = process.env.API_HASH;
const stringSession = new StringSession(process.env.SESSION_STRING);
const botUsername = "FlameStarsBot";

(async () => {
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });
  await client.start();
  console.log("✅ Bot Connected");

  let menuMsg = null;

  // --- MATH SOLVER ---
  client.addEventHandler(async (event) => {
    const text = event.message.text || "";
    if (text.includes("решите пример")) {
      const match = text.match(/(\d+[\+\-\*\/]\d+)/);
      if (match) {
        const answer = new Function(`return ${match[0]}`)();
        console.log(`[MATH] Solving: ${match[0]} = ${answer}`);
        await new Promise((r) => setTimeout(r, 4000)); // Slightly longer human delay
        await client.sendMessage(botUsername, { message: answer.toString() });
      }
    }
  }, new NewMessage({ fromUsers: [botUsername] }));

  // --- SMART CLICKER WITH RANDOM BREAKS ---
  const farmLoop = async () => {
    try {
      // ANTI-DETECTION: 5% chance to take a long break (approx every 30-60 mins)
      if (Math.random() < 0.05) {
        const breakMins = 15 + Math.floor(Math.random() * 25); // 15 to 40 mins
        console.log(`☕ Taking a human break for ${breakMins} minutes...`);
        return setTimeout(farmLoop, breakMins * 60000);
      }

      if (!menuMsg) {
        const msgs = await client.getMessages(botUsername, { limit: 5 });
        menuMsg = msgs.find(
          (m) =>
            m.replyMarkup &&
            JSON.stringify(m.replyMarkup).includes("Фармить звёзды")
        );

        if (!menuMsg) {
          const mainMenu = msgs.find(
            (m) =>
              m.replyMarkup &&
              JSON.stringify(m.replyMarkup).includes("Фарм звезд")
          );
          if (mainMenu) {
            await mainMenu.click({ text: "✨ Фарм звезд" });
            await new Promise((r) => setTimeout(r, 3000));
            return farmLoop();
          } else {
            await client.sendMessage(botUsername, { message: "/start" });
            await new Promise((r) => setTimeout(r, 5000));
            return farmLoop();
          }
        }
      }

      console.log(`[CLICK] Farming at ${new Date().toLocaleTimeString()}...`);
      await menuMsg.click({ text: "✨ Фармить звёзды" }).catch(() => {
        menuMsg = null;
      });
    } catch (err) {
      console.error("[ERROR]", err.message);
      menuMsg = null;
    }

    // Normal interval: 100-120 seconds
    setTimeout(farmLoop, 100000 + Math.floor(Math.random() * 20000));
  };

  farmLoop();
})();
