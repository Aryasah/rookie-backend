import {
  ConnectedSocket,
  MessageBody,
  OnMessage,
  SocketController,
  SocketIO,
} from "socket-controllers";
import { Server, Socket } from "socket.io";

@SocketController()
export class GameController {
  private getSocketGameRoom(socket: Socket): string {
    const socketRooms = Array.from(socket.rooms.values()).filter(
      (r) => r !== socket.id
    );
    const gameRoom = socketRooms && socketRooms[0];

    return gameRoom;
  }

  @OnMessage("update_game")
  public async updateGame(
    @SocketIO() io: Server,
    @ConnectedSocket() socket: Socket,
    @MessageBody() message: any
  ) {
    const gameRoom = this.getSocketGameRoom(socket);
    socket.to(gameRoom).emit("on_game_update", message);

    // Restart the timer on each game update
    this.restartTimer(io, gameRoom);
  }

  @OnMessage("game_win")
  public async gameWin(
    @SocketIO() io: Server,
    @ConnectedSocket() socket: Socket,
    @MessageBody() message: any
  ) {
    const gameRoom = this.getSocketGameRoom(socket);
    socket.to(gameRoom).emit("on_game_win", { message, reason: "win" });
    this.stopTimer(io, gameRoom); // Stop the timer when the game is won
  }
  @OnMessage("game_end_due_to_timer")
  public async gameEndDueToTimer(
    @SocketIO() io: Server,
    @ConnectedSocket() socket: Socket
  ) {
    const gameRoom = this.getSocketGameRoom(socket);
    const remainingPlayer = this.getRemainingPlayer(io, gameRoom, socket.id);

    if (remainingPlayer) {
      io.to(remainingPlayer).emit("on_game_win", {
        reason: "timer",
        message: "Timer Over,Opponent ran out of time. You win!",
      });
    }
  }

  @OnMessage("opponent_time_update")
  public async opponentTimeUpdate(
    @SocketIO() io: Server,
    @ConnectedSocket() socket: Socket,
    @MessageBody() message: any
  ) {
    const gameRoom = this.getSocketGameRoom(socket);
    socket.to(gameRoom).emit("opponent_time_update", message);
  }

  private restartTimer(io: Server, gameRoom: string) {
    // Send a message to all players in the room to restart their timers
    io.to(gameRoom).emit("restart_timer");
  }

  private stopTimer(io: Server, gameRoom: string) {
    // Send a message to all players in the room to stop their timers
    io.to(gameRoom).emit("stop_timer");
  }

  private getRemainingPlayer(
    io: Server,
    gameRoom: string,
    currentSocketId: string
  ): string | undefined {
    const playersInRoom = Array.from(
      io.sockets.adapter.rooms.get(gameRoom) || []
    );
    return playersInRoom.find((socketId) => socketId !== currentSocketId);
  }
}
