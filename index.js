require("dotenv").config();
const { TelegramClient, Api } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");
const express = require("express");
const app = express();

// --- WEB SERVER FOR UPTIMEROBOT ---
app.get("/", (req, res) => {
  res.send("Bot is active. UptimeRobot ping received.");
});
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Health check server live on port ${PORT}`));

// --- CONFIGURATION ---
const apiId = parseInt(process.env.API_ID);
const apiHash = process.env.API_HASH;
const stringSession = new StringSession(process.env.SESSION_STRING);
const botUsername = "FlameStarsBot";

let menuMsg = null;
let clickCount = 0; // Tracks consecutive clicks to manage breaks

(async () => {
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });
  await client.start();
  console.log("✅ Bot Connected");

  // --- 1. THE MATH SOLVER ---
  client.addEventHandler(async (event) => {
    const text = event.message.text || "";
    if (text.includes("решите пример")) {
      const match = text.match(/(\d+[\+\-\*\/]\d+)/);
      if (match) {
        try {
          const mathExpression = match[0];
          const answer = new Function(`return ${mathExpression}`)();
          console.log(`[MATH] Solving: ${mathExpression} = ${answer}`);

          // Human delay: 3-6 seconds
          await new Promise((r) => setTimeout(r, 3000 + Math.random() * 3000));
          await client.sendMessage(botUsername, { message: answer.toString() });
        } catch (e) {
          console.error("[MATH] Error solving equation:", e);
        }
      }
    }
  }, new NewMessage({ fromUsers: [botUsername] }));

  // --- 2. THE SMART CLICKER WITH COUNTER-BREAKS ---
  const farmLoop = async () => {
    try {
      // ANTI-DETECTION: Check if we should take a break
      // Only allows a break after at least 15 clicks (~25-30 mins of work)
      if (clickCount >= 15) {
        if (Math.random() < 0.15) {
          // 15% chance to rest after the work threshold
          const breakMins = 20 + Math.floor(Math.random() * 25); // 20 to 45 mins
          console.log(
            `☕ Work session complete (${clickCount} clicks). Resting for ${breakMins} mins...`
          );
          clickCount = 0; // Reset counter after break
          return setTimeout(farmLoop, breakMins * 60000);
        }
      }

      // Find or Refresh Menu logic
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
            console.log("[MENU] Navigating to Farm Menu...");
            await mainMenu.click({ text: "✨ Фарм звезд" });
            await new Promise((r) => setTimeout(r, 4000));
            return farmLoop();
          } else {
            console.log("[WARN] No menu found. Resetting with /start...");
            await client.sendMessage(botUsername, { message: "/start" });
            await new Promise((r) => setTimeout(r, 5000));
            return farmLoop();
          }
        }
      }

      // Execute the Click
      console.log(
        `[CLICK #${
          clickCount + 1
        }] Farming at ${new Date().toLocaleTimeString()}...`
      );
      await menuMsg
        .click({ text: "✨ Фармить звёзды" })
        .then(() => {
          clickCount++; // Only increment if the click was successful
        })
        .catch(async () => {
          console.log("[INFO] Menu expired. Refreshing...");
          menuMsg = null;
        });
    } catch (err) {
      console.error("[ERROR]", err.message);
      menuMsg = null;
    }

    // Wait 100-120 seconds for the next click
    const nextInterval = 100000 + Math.floor(Math.random() * 20000);
    setTimeout(farmLoop, nextInterval);
  };

  // Start the cycle
  farmLoop();
})();
