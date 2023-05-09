const Client = require("./client");
const dotenv = require("dotenv");

dotenv.config();

(async () => {
  const instance = new Client(process.env.TOKEN, {
    showSteps: true,
  });

  const client = await instance.init({ bot: "MmdJunior" });

  await client.deleteAllMessages();


  // await client.sendMessage(
  //   {
  //     message: "Hello world",
  //   },
  //   (data) => {
  //     console.log(data.messages, "From callback");
  //   },
  // );

  // // const bots = await cl.getBots();

  // // console.log(bots)
})();
