const axios = require("axios");
const Gql = require("./utils/Gql");
const step = require("./utils/step");
const WebSocket = require("ws");
const ObservableArray = require("./utils/ObservableArray");
const Group = require("./group");

class Client {
  gql_url = "/api/gql_POST";
  settings_url = "/api/settings";
  origin_url = "https://poe.com";

  answering = new ObservableArray([]);
  answerQueue = new ObservableArray([]);

  channel = {};
  bot = "capybara";
  pattern = "p@tter#F";
  noPattern = true;
  mainClass = null;

  constructor(
    token,
    options = {
      showSteps: true,
      request: {
        max_retries: 0,
        retry_delay: 0, // ms
      },
    },
  ) {
    this.options = options;

    this.token = token;
    if (token) this.cookie = `p-b=${token}`;

    this.MAX_RETRIES = options?.request?.max_retries || 25; // 15
    this.RETRY_DELAY = options?.request?.retry_delay || 2000;
    this.PARALLEL_ANSWER_LIMIT = 1;

    this.request = axios.create({
      baseURL: this.origin_url,
      headers: {
        Cookie: this.cookie,
        "Content-Type": "application/json",
        Referrer: "https://poe.com/",
        Origin: this.origin_url,
        Host: "poe.com",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "User-Agent":
          "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Encoding": "gzip, deflate, br",
        "Accept-Language": "en-US,en;q=0.9,und;q=0.8,af;q=0.7",
        "Cache-Control": "no-cache",
        Dnt: "1",
        Pragma: "no-cache",
        "Sec-Ch-Ua":
          '"Google Chrome";v="111", "Not(A:Brand";v="8", "Chromium";v="111"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"Chrome OS"',
        "Sec-Gpc": "1",
        "Upgrade-Insecure-Requests": "1",
      },
    });

    this.request.interceptors.request.use((config) => {
      config.retryCount = config.retryCount || 0;
      return config;
    });

    this.request.interceptors.response.use(
      (response) => {
        return response;
      },
      (error) => {
        const { config } = error;

        step(`Retrying Request : ${config.retryCount}`, this.options.showSteps);

        if (config.retryCount < this.MAX_RETRIES) {
          config.retryCount++;
          return new Promise((resolve) =>
            setTimeout(() => resolve(this.request(config)), this.RETRY_DELAY),
          );
        }

        return Promise.reject(error);
      },
    );
  }

  payload(queryName, variables = {}) {
    return { queryName, variables };
  }

  async getSettings() {
    step("Downloading Settings...", this.options.showSteps);

    let query = "";

    if (Object.keys(this.channel).length > 0)
      query = `?channel=${this.channel.channel}`;

    try {
      let response = {};

      if (query)
        response = await this.request.get(`${this.settings_url}${query}`);
      else response = await this.request.get(this.settings_url);

      this.channel = response.data.tchannelData;
    } catch (e) {
      throw new Error(`Can't load Setting Data ${e}`);
    }
  }

  extractFormkey(html) {
    const script_regex = /<script>if\(.+\)throw new Error;(.+)<\/script>/;
    const script_text = html.match(script_regex)[1];
    const key_regex = /var .="([0-9a-f]+)",/;
    const key_text = script_text.match(key_regex)[1];
    const cipher_regex = /.?\[(\d+)\]=.?\[(\d+)\]/g;
    const cipher_pairs = script_text.matchAll(cipher_regex);

    const formkey_list = Array.from({ length: cipher_pairs.length }, () => "");
    for (const pair of cipher_pairs) {
      const formkey_index = parseInt(pair[1]);
      const key_index = parseInt(pair[2]);
      formkey_list[formkey_index] = key_text[key_index];
    }
    const formkey = formkey_list.join("");

    return formkey;
  }

  getNextData(overwrite_vars = false) {
    step("Downloading next_data...", this.options.showSteps);

    return this.request
      .get(`${this.origin_url}/${this.bot === "capybara" ? "Sage" : this.bot}`)
      .then((res) => {
        const jsonRegex =
          /<script id="__NEXT_DATA__" type="application\/json">(.+?)<\/script>/;
        const jsonText = res.data.match(jsonRegex)[1];
        const nextData = JSON.parse(jsonText);

        if (overwrite_vars) {
          this.formkey = this.extractFormkey(res.data);
          this.viewer = nextData.props.pageProps.payload.viewer;
          this.next_data = nextData;
        }

        return nextData;
      })
      .catch((e) => {
        console.error(`Error in get_next_data: ${e}`);
      });
  }

  dequeueAnswer() {
    this.answering.on("change", (method, item) => {
      if (method === "push") {
        item.handler();
      }
    });

    this.answering.on("change", (method) => {
      if (
        method === "remove" &&
        this.answering.array.length < this.PARALLEL_ANSWER_LIMIT
      ) {
        const dequeued = this.answerQueue.pop();
        if (dequeued) this.answering.push(dequeued);
      }
    });
  }

  async sendMessage(
    params = {
      message,
      withChatBreak: true,
      messageId: 0,
    },
    callback = (response) => {},
  ) {
    let messageId = params?.messageId || Math.floor(Math.random() * 999999999);

    const message = this.noPattern
      ? params.message
      : `[${this.pattern}-${messageId}]

${params.message}
  `;

    const handleSendMessage = async () => {
      let counter = 0;
      let lastUpdate = null;

      const wsMessageHandler = (message) => {
        if (counter > 0) return;
        const response = message.toString("utf-8");

        let data = JSON.parse(response);

        data.messages = data.messages.map((item) => JSON.parse(item));

        const messageAdded = data.messages[0]?.payload?.data?.messageAdded;

        const suggests = messageAdded?.suggestedReplies;

        if (suggests) lastUpdate = data;

        const text = messageAdded?.text;

        let [isThis, clearifiedText] =
          text?.split(`[${this.pattern}-${messageId}]`) || [];

        if (this.noPattern) clearifiedText = text;

        if (
          messageAdded?.state === "complete" &&
          ((messageAdded?.author === "chinchilla" && isThis === "") ||
            messageAdded.author === "capybara")
        ) {
          counter++;

          this.answering.remove("messageId", messageId);

          callback(lastUpdate, clearifiedText?.trim());
        }
      };

      this.ws.on("message", wsMessageHandler);

      step("Sending message...", this.options.showSteps);

      const chatId =
        this.next_data.props.pageProps?.payload?.chatOfBotDisplayName?.chatId;

      const gql = new Gql();

      gql
        .readyQuery("chatHelpers_sendMessageMutation_Mutation", {
          chatId: chatId,
          bot: this.bot ?? "capybara",
          query: message,
          source: null,
          withChatBreak: params.withChatBreak || false,
        })
        .setHeaders(this.formkey, this.channel.channel);

      try {
        const res = await this.request.post(this.gql_url, gql.query, {
          headers: {
            ...gql.headers,
          },
        });
      } catch (e) {
        console.log(e);
      }
    };

    if (this.answering.array.length >= this.PARALLEL_ANSWER_LIMIT) {
      this.answerQueue.unshift({
        messageId,
        handler: handleSendMessage,
      });
    } else {
      this.answering.push({
        messageId,
        handler: handleSendMessage,
      });
    }

    return this;
  }

  async connectWebSocket() {
    step("WebSocket Connecting...", this.options.showSteps);

    let ws = this.ws;

    const connect = async () => {
      if (!ws) {
        const wsDomain = Math.floor(Math.random() * 1000000) + 1;

        const query = `?min_seq=${this.channel?.minSeq}&channel=${this.channel?.channel}&hash=${this.channel?.channelHash}`;

        this.ws = new WebSocket(
          `wss://tch${wsDomain}.tch.${this.channel?.baseHost}/up/${this.channel?.boxName}/updates` +
            query,
          {},
        );

        this.ws.setMaxListeners(100000);
      }

      this.ws.on("close", async (code, reason) => {
        if (reason.includes("should_close")) {
          step("WebSocket Connection Closed", this.options.showSteps);
          process.exit();
        } else {
          step("WebSocket disconnected!", this.options.showSteps);
          if (this.wsRetryCount < this.MAX_RETRIES) {
            step(
              `Retrying WebSocket connection in ${this.RETRY_DELAY}ms...`,
              this.options.showSteps,
            );

            await new Promise((resolve) =>
              setTimeout(resolve, this.RETRY_DELAY),
            );
            await connect();
            this.wsRetryCount++;
          } else {
            console.log(
              `WebSocket connection failed after ${this.MAX_RETRIES} attempts.`,
            );
          }
        }
      });

      this.ws.on("error", (error) => {
        console.error("WebSocket error:", error);
      });

      this.ws.on("unexpected-response", (e) => {
        console.log("Unexpected Response: ", e);
      });

      const openPromise = new Promise((res, rej) => {
        this.ws.on("open", () => {
          step("WebSocket connected!", this.options.showSteps);
          this.wsRetryCount = 0;

          res(true);
        });
      });

      await openPromise;
    };

    await connect();

    return this;
  }

  async getMessages(
    options = {
      update: true,
      botMessagesOnly: false,
      humanMessagesOnly: false,
      textMessages: false,
      range: -1,
    },
  ) {
    if (!this?.next_data || options?.update) await this.getNextData(true);

    let messages =
      this.next_data?.props?.pageProps?.payload?.chatOfBotDisplayName
        ?.messagesConnection?.edges || [];

    if (options?.botMessagesOnly)
      messages = messages.filter((item) => item.node.author === options.bot);
    else if (options?.humanMessagesOnly)
      messages = messages.filter((item) => item.node.author === "human");

    if (options?.textMessages)
      messages = messages.map((item) => item.node.text);

    if (options?.range > 0) messages = messages.slice(-options?.range);

    return messages;
  }

  async chatBreak() {
    step("Breaking Chat...", this.options.showSteps);

    await this.getNextData();

    const data =
      this?.next_data?.props?.pageProps?.payload?.chatOfBotDisplayName;

    if (!data) return console.log("The next_data Not Found");

    const gql = new Gql();

    gql
      .readyQuery("chatHelpers_addMessageBreakEdgeMutation_Mutation", {
        chatId: +data.chatId,
        connections: [
          `client:${data.id}:__ChatMessagesView_chat_messagesConnection_connection`,
        ],
      })
      .setHeaders(this.formkey, this.channel.channel);

    try {
      const res = await this.request.post(this.gql_url, gql.query, {
        headers: {
          ...gql.headers,
        },
      });
    } catch (e) {
      console.log(e);
    }

    return this;
  }

  async subscribe() {
    await this.getNextData(true);

    step("Subscribing...", this.options.showSteps);

    const AnnotateWithIdsProviderQuery = async () => {
      const gql = new Gql();

      gql
        .readyQuery("AnnotateWithIdsProviderQuery")
        .setHeaders(this.formkey, this.channel.channel);

      try {
        const res = await this.request.post(this.gql_url, gql.query, {
          headers: {
            ...gql.headers,
          },
        });
      } catch (e) {
        console.log(e);
      }
    };

    const subscriptionsMutation = async () => {
      const gql = new Gql();

      gql
        .readyQuery("subscriptionsMutation", {
          subscriptions: gql.getSubs(
            "messageAdded",
            "messageDeleted",
            "viewerStateUpdated",
            "viewerMessageLimitUpdated",
          ).subList,
        })
        .setHeaders(this.formkey, this.channel.channel);

      try {
        const res = await this.request.post(this.gql_url, gql.query, {
          headers: {
            ...gql.headers,
          },
        });
      } catch (e) {
        console.log(e);
      }
    };

    await AnnotateWithIdsProviderQuery();

    await subscriptionsMutation();
  }

  async init(options = { bot: "capybara", pattern: "", noPattern: true }) {
    const instance = new Client(this.token, this.options);

    instance.bot = options.bot;

    options?.pattern ? (instance.pattern = options?.pattern) : null;

    instance.noPattern = options?.noPattern;

    this.mainClass = this;

    await instance.getSettings();

    await instance.subscribe();

    await instance.connectWebSocket();

    instance.dequeueAnswer();

    return instance;
  }

  async initGroup(bots = [{ bot: "capybara", pattern: "", noPattern: true }]) {
    const clients = [];

    let requests = [];

    for (let i in bots) {
      const client = bots[i];

      requests.push(async () => {
        const instance = new Client(this.token, this.options);

        instance.bot = client.bot;

        client?.pattern ? (instance.pattern = client?.pattern) : null;
        instance.noPattern = client?.noPattern;

        await instance.getSettings();

        await instance.subscribe();

        await instance.connectWebSocket();

        instance.dequeueAnswer();

        clients.push(instance);
      });
    }

    await Promise.all(requests.map((item) => item()));

    return new Group(clients);
  }

  async createBot(
    data = {
      handle: null,
      introduction: null,
      description: null,
      prompt: null,
      isPrivateBot: false,
      hasLinkification: false,
      hasMarkdownRendering: true,
      hasSuggestedReplies: false,
      profilePictureUrl: null,
      isPromptPublic: false,
      model: "chinchilla",
    },
  ) {
    const gql = new Gql();

    const variables = {
      model: data?.model ?? "chinchilla",
      handle: data?.name ?? `Bot${Math.floor(Math.random() * 999999999)}`,
      prompt: data?.prompt ?? "",
      isPromptPublic: data?.isPromptPublic ?? false,
      introduction: data?.introduction ?? "",
      description: data?.description ?? "",
      profilePictureUrl: data.profilePictureUrl,
      apiUrl: null,
      apiKey: null,
      isApiBot: false,
      hasLinkification: data?.hasLinkification ?? false,
      hasMarkdownRendering: data?.hasMarkdownRendering ?? true,
      hasSuggestedReplies: data?.hasSuggestedReplies ?? false,
      isPrivateBot: data?.isPrivateBot ?? false,
    };

    gql
      .readyQuery("CreateBotMain_poeBotCreate_Mutation", variables)
      .setHeaders(this.formkey, this.channel.channel);

    try {
      const { data } = await this.request.post(this.gql_url, gql.query, {
        headers: {
          ...gql.headers,
        },
      });

      const result = data?.data?.poeBotCreate;

      if (!result) throw data;

      return result;
    } catch (e) {
      console.log(e);
    }
  }

  async getBots(options = { latestUpdate: true }) {
    await this.getNextData(options?.latestUpdate);

    return this.next_data?.props?.pageProps?.payload?.viewer?.availableBots;
  }

  async deleteBot() {
    const gql = new Gql();

    const botId =
      this?.next_data?.props?.pageProps?.payload?.chatOfBotDisplayName
        ?.defaultBotObject?.botId;

    gql
      .readyQuery("BotDeletionButton_poeBotDelete_Mutation", {
        botId,
      })
      .setHeaders(this.formkey, this.channel.channel);

    try {
      const res = await this.request.post(this.gql_url, gql.query, {
        headers: {
          ...gql.headers,
        },
      });

      return true;
    } catch (e) {
      console.log(e);
    }
  }

  async deleteAllMessages() {
    const gql = new Gql();

    gql
      .readyQuery(
        "SettingsDeleteAllMessagesButton_deleteUserMessagesMutation_Mutation",
        {},
      )
      .setHeaders(this.formkey, this.channel.channel);

    try {
      await this.request.post(this.gql_url, gql.query, {
        headers: {
          ...gql.headers,
        },
      });

      return true;
    } catch (e) {
      console.log(e);
    }
  }
}

module.exports = Client;
