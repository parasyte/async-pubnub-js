import persist from 'node-persist';
import PubNub from 'pubnub';

await persist.init();

/** @return {Promise<String>} */
export async function userId() {
  let userId = await persist.getItem('userId');
  if (!userId) {
    userId = PubNub.generateUUID();
    await persist.setItem('userId', userId);
  }

  return userId;
}
