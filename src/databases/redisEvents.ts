import EventEmitter from 'eventemitter3'; 
import { createClient, RedisClient } from 'redis';
import config from '../lib/utilities/config';

type clientsMap = {
  publisher: RedisClient;
  subscriber: RedisClient;
};

const clients: clientsMap = {
  publisher: createClient({url: config.redisUri}),
  subscriber: createClient({url: config.redisUri}),
};

const on = (key: string, callback: any) => {
    clients.subscriber.on(key, callback); 
}

const unsubscribe = (key: string) => {
    clients.subscriber.unsubscribe(key); 
}

const subscribe = (key: string) => {
    clients.subscriber.subscribe(key); 
}

const publish = (key: string, value: string | object) => {
    if(typeof value !== "string")
        value = JSON.stringify(value);
    clients.publisher.publish(key, value); 
}

const events = new EventEmitter(); 

clients.subscriber.on('message', (channel: string, messageStr: string) => {
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
    events,
};

export { clients };
