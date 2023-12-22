import EventEmitter from 'eventemitter3'; 
import * as redis from 'redis';

const publisher = redis.createClient({
    url: process.env.REDIS_URI,
});

const subscriber = redis.createClient({
    url: process.env.REDIS_URI,
});

const on = (key: string, callback: any) => {
    subscriber.on(key, callback); 
}

const unsubscribe = (key: string) => {
    subscriber.unsubscribe(key); 
}

const subscribe = (key: string) => {
    subscriber.subscribe(key); 
}

const publish = (key: string, value: string | object) => {
    if(typeof value !== "string")
        value = JSON.stringify(value);
    publisher.publish(key, value); 
}

const events = new EventEmitter(); 

subscriber.on('message', (channel: string, messageStr: string) => {
    try {
        const message = JSON.parse(messageStr); 
        events.emit(channel, message); 
    } catch (error) {
        console.error(error);
    }
});


export default {
    on,
    unsubscribe,
    subscribe,
    publish, 
    events
}