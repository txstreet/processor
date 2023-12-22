// This is currently an unused event, but will be processed in the event that any 
// middleware throws an error. 
import SocketIO from 'socket.io';

const STATUS_UNAUTHORIZED = "401"; 

export default async (socket: SocketIO.Socket, error: Error) => {
    if(error && error.message === STATUS_UNAUTHORIZED) {
        socket.disconnect();
    }
}