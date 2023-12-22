// This event is fired by the Socket instance upon disconnection.
// Here is the list of possible reasons:
// server namespace disconnect: 
//  - The socket was forcefully disconnected with socket.disconnect()
// client namespace disconnect: 
//  - The client has manually disconnected the socket using socket.disconnect()
// server shutting down:
//  - The server is, well, shutting down
// ping timeout:
//  - The client did not send a PONG packet in the pingTimeout delay
// transport close:
//  - The connection was closed (example: the user has lost connection, or the network was changed from WiFi to 4G)
// transport: error:  
//  - The connection has encountered an error
import SocketIO from 'socket.io';

export default async (socket: SocketIO.Socket, reason: string) => {
    
}