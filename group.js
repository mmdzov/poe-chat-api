const Client = require("./client");

class Group {
  constructor(clients = [new Client()]) {
    this.clients = clients;
  }

  async sendMessage(
    params = {
      message,
      withChatBreak: true,
      messageId: 0,
    },
    callback = (response) => {},
  ) {
    const getLenMsgQueue = (client) =>
      client.answering.array.length + client.answerQueue.array.length;

    const client = this.clients.sort(
      (a, b) => getLenMsgQueue(a) - getLenMsgQueue(b),
    )[0];

    await client.sendMessage(params, callback);

    return this;
  }
}

module.exports = Group;
