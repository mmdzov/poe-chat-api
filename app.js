const Client = require("./client");
const crypto = require("crypto");
const dotenv = require("dotenv");

dotenv.config();

const cl = new Client(process.env.TOKEN);

(async () => {
  await cl.initialize();

  const res = await cl.sendMessage(
    {
      message: "Hello world",
      withChatBreak: false,
    },
    (data) => {
      console.log(data.messages, "From callback");
    },
  );

  // await cl.sendMessage(
  //   {
  //     message: "How are you doing?",
  //     withChatBreak: false,
  //   },
  //   (data) => {
  //     console.log(data, "From callback");
  //   },
  // );
})();
