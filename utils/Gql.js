const fs = require("fs");
const { join } = require("path");
const { cwd } = require("process");
const crypto = require("crypto");

class Gql {
  query = null;
  queryHash = null;

  readyQuery(query = "", variables = {}) {
    const queryGetted = fs.readFileSync(
      join(cwd(), `graphql/${query}.graphql`),
      "utf8",
    );

    const data = {
      query: queryGetted,
      queryName: query,
      variables,
    };

    let jsonData = JSON.stringify({
      queryName: data.queryName,
      variables: data.variables,
      query: this.sanatize(data.query),
    });

    this.query = jsonData;

    return this;
  }

  sanatize(data) {
    return data.replace(/\r?\n|\r/g, "\n");
  }

  setQueryHash(formKey) {
    if (this.queryHash) return this;

    const payload = this.query + formKey + "WpuLMiXEKKE98j56k";

    const hash = crypto.createHash("md5").update(payload).digest("hex");

    this.queryHash = hash;

    return this;
  }

  setHeaders(formkey, channel) {
    this.setQueryHash(formkey);

    this.headers = {
      "poe-formkey": formkey,
      "poe-tag-id": this.queryHash,
      "poe-tchannel": channel,
    };

    return this;
  }

  // Get Subscriptions
  getSubs(...subs) {
    let subList = [];

    for (let i in subs) {
      const subName = subs[i];

      const sub = fs.readFileSync(
        join(cwd(), `graphql/subscriptions_${subName}_Subscription.graphql`),
        "utf8",
      );

      subList.push({
        query: this.sanatize(sub),
        subscriptionName: subName,
      });
    }

    this.subList = subList;

    return this;
  }
}

module.exports = Gql;
