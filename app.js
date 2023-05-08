const Client = require("./client");
const dotenv = require("dotenv");

dotenv.config();

(async () => {
  const cl = new Client(process.env.TOKEN,{
    showSteps: false
  });

  // await cl.initialize();

  // const bots = await cl.getBots();

  // console.log(bots)

  // const res = await cl.sendMessage(
  //   {
  //     message: "Hello world",
  //   },
  //   (data) => {
  //     console.log(data.messages, "From callback");
  //   },
  // );
})();
