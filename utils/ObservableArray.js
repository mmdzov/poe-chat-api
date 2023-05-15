const EventEmitter = require("events");

class ObservableArray extends EventEmitter {
  constructor(array) {
    super();
    this.array = array;
  }

  push(item) {
    this.array.push(item);
    this.emit("change", "push", item);
  }

  pop() {
    const item = this.array.pop();
    this.emit("change", "pop", item);
    return item;
  }

  shift() {
    const item = this.array.shift();
    this.emit("change", "shift", item);
    return item;
  }

  unshift(...items) {
    this.array.unshift(...items);
    this.emit("change", "unshift", items);
  }

  splice(start, deleteCount, ...items) {
    this.array.splic(start, deleteCount, items);
    this.emit("change", "splice", items);
  }

  remove(key, value) {
    const index = this.array.findIndex((item) => item[key] === value);

    if (index === -1) return this.emit("change", "remove", false);

    this.array.splice(index, 1);

    this.emit("change", "remove", true);
  }
}

module.exports = ObservableArray;
