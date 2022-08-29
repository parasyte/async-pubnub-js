# Async PubNub Client

This is an implementation of the sketch shown in [this gist](https://gist.github.com/parasyte/c0a32db68326df9d1f606f1508136c2c).

The core principle is to eliminate callbacks by taking advantage of `async/await`. Subscribing to a channel creates a unique `Stream`. The `Stream` in turn provides a method to produce messages (`publish()`) and an async iterator interface to consume messages.

This design tightly couples the PubNub "publish/subscribe" duality into a single `Stream` and hides the complexity of message routing within the global listeners.

See [`example.js`](./examples/example.js) for usage.
