import { inspect } from 'node:util';
import { PubNub, Stream, userId } from '../index.js';

/** @arg {Stream} stream - Consume messages from this stream */
async function subscribe_loop(stream) {
  for await (const event of stream) {
    if (event) {
      console.log(`Received: ${inspect(event.message)}`);

      // Breaking the loop will automatically close the stream.
      if (event.message === 'done') {
        break;
      }
    }
  }
}

/** @arg {Stream} stream - Produce messages into this stream */
async function publish_loop(stream) {
  for (const msg of ['hello', 'world', { num: 123 }, 'done']) {
    await timer(1000, async () => {
      console.log(`Sending: ${inspect(msg)}`);

      await stream.publish(msg);
    });
  }
}

/**
 * @arg {Number} delay - Delay in milliseconds
 * @arg {(value: any) => any} fn - Callback
 */
export async function timer(delay, fn) {
  return new Promise((resolve) => {
    setTimeout(resolve, delay);
  }).then(fn);
}

const pubnub = new PubNub('demo', 'demo', await userId());

console.log('Connecting...');
const stream = await pubnub.subscribe('multi-cloud');

console.log('Starting publish loop...');
publish_loop(stream);

console.log('Starting subscribe loop...');
await subscribe_loop(stream);

console.log('Done!');
