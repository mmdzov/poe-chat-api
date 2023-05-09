require("dotenv").config();
const Client = require("../client");

(async () => {
  const instance = new Client(process.env.TOKEN, {
    showSteps: true,
  });

  const client = await instance.init();

  const res = await client.createBot({
    prompt: `Talk to me like a pirate.`,
  });

  console.log(res);
})();
