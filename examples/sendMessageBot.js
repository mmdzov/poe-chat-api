require("dotenv").config();
const Client = require("../index");

(async () => {
  const instance = new Client(process.env.TOKEN, {
    showSteps: true,
  });

  const client = await instance.init({ bot: "YOUR_BOT_NAME" });

  await client.sendMessage(
    {
      message: "Hello world",
    },
    (response) => {
      console.log(response);
    },
  );
})();
