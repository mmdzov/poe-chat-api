require("dotenv").config();
const Client = require("../client");

(async () => {
  const instance = new Client(process.env.TOKEN, {
    showSteps: true,
  });

  const client = await instance.init();

  await client.sendMessage(
    {
      message: "Hello world",
    },
    (response) => {
      console.log(response);
    },
  );
})();
