require("dotenv").config();
const Client = require("../index");

(async () => {
  const instance = new Client(process.env.TOKEN, {
    showSteps: true,
  });

  const client = await instance.init();

  const messages = await client.getMessages({
    range: 2, // The last 2 messages
  });

  console.log(messages);
})();
