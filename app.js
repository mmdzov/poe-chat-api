const Client = require("./client");
const dotenv = require("dotenv");

dotenv.config();

(async () => {
  const cl = new Client(process.env.TOKEN);

  // await cl.initialize();

  // await cl.createBot();

  // const res = await cl.sendMessage(
  //   {
  //     message: "Hello world",
  //   },
  //   (data) => {
  //     console.log(data.messages, "From callback");
  //   },
  // );
})();
