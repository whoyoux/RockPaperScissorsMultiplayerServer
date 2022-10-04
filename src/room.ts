import { Socket } from "socket.io";

export type TRoomStatus =
  | "created"
  | "waiting"
  | "ready"
  | "playing"
  | "cancelled"
  | "notInRoom";

export class Room {
  public firstPlayerUid: string | null;
  public firstPlayerSocket: Socket | null;

  public secondPlayerUid: string | null;
  public secondPlayerSocket: Socket | null;

  public status: TRoomStatus = "created";

  constructor(
    firstPlayerUid: string,
    firstPlayerSocket: Socket,
    secondPlayerUid?: string,
    secondPlayerSocket?: Socket
  ) {
    this.firstPlayerUid = firstPlayerUid;
    this.firstPlayerSocket = firstPlayerSocket;

    this.secondPlayerUid = secondPlayerUid ? secondPlayerUid : null;
    this.secondPlayerSocket = secondPlayerSocket ? secondPlayerSocket : null;

    if (secondPlayerUid === null) this.status = "waiting";
    else this.status = "ready";
  }

  startGame() {
    console.log("[Room] Everything is prepared. Game is about to start!");
    this.status = "playing";
  }

  isOwnerOfRoom(uid: string): boolean {
    return this.firstPlayerUid === uid;
  }

  removePlayer(uid: string) {
    if (this.firstPlayerUid === uid) {
    } else {
      this.secondPlayerUid = null;
      this.secondPlayerSocket = null;

      this.status = "waiting";
    }
  }

  join(uid: string, socket: Socket) {
    this.secondPlayerUid = uid;
    this.secondPlayerSocket = socket;

    this.status = "ready";
  }

  removeRoom() {
    this.status = "cancelled";
  }
}
