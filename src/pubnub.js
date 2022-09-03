import PN from 'pubnub';

export class PubNub {
  /** @type {Listener} */
  #listener;

  /** @type {PN} */
  #pubnub;

  /**
   * @arg {String} publishKey - PubNub publish key
   * @arg {String} subscribeKey - PubNub subscribe key
   * @arg {String} userId - User ID for this client
   */
  constructor(publishKey, subscribeKey, userId) {
    this.#pubnub = new PN({
      publishKey,
      subscribeKey,
      userId,
    });

    this.#listener = new Listener(this.#pubnub);
    this.#pubnub.addListener(this.#listener);
  }

  /**
   * @arg {String} channel - Channel name
   * @return {Promise<Stream>}
   */
  async subscribe(channel) {
    this.#pubnub.subscribe({ channels: [channel] });

    const promise = this.#listener.waitForSubscribe(channel);

    return promise;
  }
}

class Listener {
  /** @type {PN} */
  #pubnub;

  /** @type {Map<String, Stream[]>} */
  #channels;

  /** @type {Map<String, Array<(value: any) => any>>} */
  #pendingChannels;

  /** @type {Map<String, Array<(value: any) => any>>} */
  #pendingMessages;

  /** @arg {PN} pubnub - Parent PubNub */
  constructor(pubnub) {
    this.#pubnub = pubnub;
    this.#channels = new Map();
    this.#pendingChannels = new Map();
    this.#pendingMessages = new Map();
  }

  /**
   * @arg {String} channel - Channel name
   * @return {Promise<Stream>}
   */
  waitForSubscribe(channel) {
    return new Promise((resolve) => {
      const pending = this.#pendingChannels.get(channel);
      if (pending) {
        pending.push(resolve);
      } else {
        this.#pendingChannels.set(channel, [resolve]);
      }
    });
  }

  /**
   * @arg {String} channel - Channel name
   * @return {Promise<{ value: Object, done: Boolean }>}
   */
  waitForMessage(channel) {
    if (!this.#pendingMessages.has(channel)) {
      throw new Error(`Channel subscription does not exist: '${channel}'`);
    }

    return new Promise((resolve) => {
      const callbacks = this.#pendingMessages.get(channel);
      if (callbacks) {
        callbacks.push(resolve);
      }
    });
  }

  /** @arg {String[]} channels - List of channel names */
  #addChannels(channels) {
    for (const channel of channels) {
      const stream = new Stream(channel, this.#pubnub, this);

      const streams = this.#channels.get(channel);
      if (streams) {
        streams.push(stream);
      } else {
        this.#channels.set(channel, [stream]);
      }

      this.#pendingMessages.set(channel, []);

      // Notify pending channel of the new stream
      const resolvers = this.#pendingChannels.get(channel);
      if (resolvers) {
        for (const resolve of resolvers) {
          resolve(stream);
        }

        this.#pendingChannels.set(channel, []);
      }
    }
  }

  /**
   * @arg {String} channel - Channel name
   * @arg {Stream} stream - Stream reference to remove
   * */
  removeChannel(channel, stream) {
    const streams = this.#channels.get(channel);
    if (streams) {
      for (const [i, s] of streams.entries()) {
        if (s === stream) {
          streams.splice(i, 1);
          break;
        }
      }

      if (streams.length === 0) {
        this.#channels.delete(channel);
        this.#pendingChannels.delete(channel);
      }
    }
  }

  /** @arg {any} event - StatusEvent */
  status(event) {
    switch (event.category) {
      case 'PNConnectedCategory': {
        this.#addChannels(event.affectedChannels);
        break;
      }
    }
  }

  /** @arg {any} event - MessageEvent */
  message(event) {
    // Note that this implementation will drop messages at extremely high volume.
    // It can be fixed by queuing all messages and letting `waitForMesssge` read from the queue.
    const channel = event.subscription || event.channel;
    const callbacks = this.#pendingMessages.get(channel);
    if (callbacks) {
      this.#pendingMessages.set(channel, []);

      // Notify all waiting streams of the new message
      for (const callback of callbacks) {
        callback({ value: event, done: false });
      }
    }
  }
}

export class Stream {
  /** @type {String} */
  #channel;

  /** @type {PN} */
  #pubnub;

  /** @type {Listener} */
  #listener;

  /**
   * @arg {String} channel - Channel name
   * @arg {PN} pubnub - PubNub manager
   * @arg {Listener} listener - Parent listener
   */
  constructor(channel, pubnub, listener) {
    this.#channel = channel;
    this.#pubnub = pubnub;
    this.#listener = listener;
  }

  /** @arg {any} message - Message to publish */
  async publish(message) {
    return await this.#pubnub.publish({
      channel: this.#channel,
      message,
    });
  }

  [Symbol.asyncIterator]() {
    return {
      /** @return {Promise<IteratorResult<any>>} */
      next: () => this.#listener.waitForMessage(this.#channel),

      /** @return {Promise<IteratorResult<any>>} */
      return: () => {
        this.#pubnub.unsubscribe({ channels: [this.#channel] });
        this.#listener.removeChannel(this.#channel, this);

        return Promise.resolve({ value: undefined, done: true });
      }
    }
  }
}
