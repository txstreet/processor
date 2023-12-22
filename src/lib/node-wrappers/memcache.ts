/**
 * This is a timed fall-off cache for keeping things in memory, primarily used in it's purpose 
 * to prevent duplicate broadcasts over a short span due to the bitcoind zmq socket bug, because
 * of the nature of the NodeJS Event Loop & The sheer amount of messages coming through zmq when
 * this happens, we need a localized in-memory store on the wrapper level to ensure no duplicates 
 * are processed.
 */

/**
 * The default TTL(time to live) for items that are inserted into the cache. 
 */
const TTL = (1000 * 60) * 5; 

/**
 * A collection of keys mapped to the timestamp that they expire at.
 * This 'collection' keeps track of keys that need to be removed from the cached 'collection'. 
 */
var toBeRemoved: { [key: number]: string[] } = {};

/**
 * The collection holding the actual key=>value store.
 */
 var cache: { [key: string]: any } = {}; 

 /**
  * Obtains a value from the cache for the given key.
  * 
  * @param key The key.
  */
const get = (key: string): any => {
    return cache[key]; 
}

/**
 * Puts a value in the cache for the given key.
 * NOTE: This function cannot overwrite an existing object. 
 * NOTE2: Items are removed on a 100ms cycle. 
 * 
 * @param key The key
 * @param value The value 
 * @param ttl The duration (in milliseconds) the object should persist. Defaults to #TTL
 */
const put = (key: string, value: any, ttl?: number) => {
    if(!key) throw 'Key not provided'; 
    if(!value) throw 'Value not provided'; 
    if(get(key)) throw 'Value for key already exists'; 

    const timestamp = Date.now() + (ttl || TTL); 
    cache[key] = value;
    if(!toBeRemoved[timestamp])
        toBeRemoved[timestamp] = [];
    toBeRemoved[timestamp].push(key); 
}

/**
 * Resets the current cache back to its default state. 
 */
const reset = () => {
    toBeRemoved = {};
    cache = {}; 
}

setInterval(() => {
    const now = Date.now();
    const timestamps = Object.keys(toBeRemoved); 
    for(let i = 0; i < timestamps.length; i++) {
        let timestamp = Number(timestamps[i]); 
        if(now >= timestamp) {
            toBeRemoved[timestamp].forEach((key: string) => {
                delete cache[key]; 
            })
            delete toBeRemoved[timestamp]; 
        }
    }
}, 100);

export default { get, put, reset }; 