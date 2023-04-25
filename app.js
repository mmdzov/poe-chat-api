const Client = require("./client");
const crypto = require("crypto");
const dotenv = require("dotenv");

const cl = new Client(process.env.TOKEN);

(async () => {
  await cl.initialize();

  await cl.sendMessage(
    {
      message: "Hello world",
      withChatBreak: true,
    },
    (data) => {
      console.log(data);
    },
  );

  await cl.sendMessage(
    {
      message: "How are you doing?",
      withChatBreak: true,
    },
    (data) => {
      console.log(data);
    },
  );
})();
