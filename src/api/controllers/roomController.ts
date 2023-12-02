import {
  ConnectedSocket,
  OnDisconnect,
  OnMessage,
  SocketController,
  SocketIO,
  MessageBody
} from "socket-controllers";
import { Server, Socket } from "socket.io";

interface PlayerData {
  socketId: string;
  roomId: string;
  symbol: string;
}

@SocketController()
export class RoomController {
  private players: PlayerData[] = [];

  private getPlayer(socketId: string): PlayerData | undefined {
    return this.players.find((player) => player.socketId === socketId);
  }

  private removePlayer(socketId: string): void {
    const index = this.players.findIndex((player) => player.socketId === socketId);
    if (index !== -1) {
      this.players.splice(index, 1);
    }
  }

  private getPlayerSymbol(roomId: string, socket: Socket): string {
    const playersInRoom = this.players.filter((player) => player.roomId === roomId);
    const currentPlayer = playersInRoom.find((player) => player.socketId === socket.id);

    return currentPlayer ? currentPlayer.symbol : "";
  }

  @OnMessage("join_game")
  public async joinGame(
    @SocketIO() io: Server,
    @ConnectedSocket() socket: Socket,
    @MessageBody() message: any
  ) {
    console.log("New User joining room: ", message);

    const connectedSockets = io.sockets.adapter.rooms.get(message.roomId);
    const playerInRoom = this.players.find((player) => player.socketId === socket.id);

    if (
      playerInRoom ||
      (connectedSockets && connectedSockets.size === 2)
    ) {
      socket.emit("room_join_error", {
        error: "Room is full, please choose another room to play!",
      });
    } else {
      await socket.join(message.roomId);
      this.players.push({
        socketId: socket.id,
        roomId: message.roomId,
        symbol: this.players.length === 0 ? "x" : "o",
      });

      socket.emit("room_joined");

      const symbol = this.getPlayerSymbol(message.roomId, socket);

      if (io.sockets.adapter.rooms.get(message.roomId).size === 2) {
        socket.emit("start_game", { start: true, symbol });
        socket
          .to(message.roomId)
          .emit("start_game", { start: false, symbol: symbol === "x" ? "o" : "x" });
      }
    }
  }

  @OnDisconnect()
  public async onDisconnect(
    @SocketIO() io: Server,
    @ConnectedSocket() socket: Socket
  ) {
    const player = this.getPlayer(socket.id);

    if (player) {
      const remainingPlayer = this.players.find((p) => p.roomId === player.roomId && p.socketId !== socket.id);

      if (remainingPlayer) {
        io.to(remainingPlayer.socketId).emit("on_game_win", {
          message: "Opponent left the game. You win!",
        });
      }

      this.removePlayer(socket.id);
    }
  }
}
