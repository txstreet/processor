import SocketIO from 'socket.io';

export default async (socket: SocketIO.Socket, room: string) => {
    if(!socket.in(room)) return; 
    socket.leave(room);
}