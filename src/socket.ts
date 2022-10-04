import { Server as HTTPServer } from "http";
import { Socket, Server } from "socket.io";
import { customAlphabet } from "nanoid";
import { Logger } from "./logger";
import { Room, TRoomStatus } from "./room";

const socketLogger = new Logger("⚡️[SocketServer]");

const roomIdGenerator = customAlphabet("123456789ABCDEF", 6);

export type TChangeRoomStatus = {
  status: TRoomStatus;
  firstPlayerUsername?: string;
  secondPlayerUsername?: string;
};

export class ServerSocket {
  public static instance: ServerSocket;
  public io: Server;

  public users: { [uid: string]: string };

  public rooms: Map<string, Room> = new Map();

  constructor(server: HTTPServer) {
    ServerSocket.instance = this;
    this.users = {};
    this.io = new Server(server, {
      serveClient: false,
      pingInterval: 10000,
      pingTimeout: 5000,
      cookie: false,
      cors: {
        origin: "*",
      },
    });

    this.io.on("connection", this.StartListeners);

    socketLogger.log("Socket IO started.");
  }

  StartListeners = (socket: Socket) => {
    socketLogger.log(`Message received from ${socket.id}`);

    // socket.on(
    //   "handshake",
    //   (callback: (uid: string, users: string[]) => void) => {
    //     socketLogger.log(`Handshake received from ${socket.id}`);

    //     // Check if this is a reconnection
    //     const reconnected = Object.values(this.users).includes(socket.id);

    //     if (reconnected) {
    //       socketLogger.log("This user has reconnected");

    //       const uid = this.GetUidFromSocketId(socket.id);
    //       const users = Object.values(this.users);

    //       if (uid) {
    //         socketLogger.log("Sending callback for reconnect...");
    //         callback(uid, users);
    //         return;
    //       }
    //     }

    //     // Generate new user
    //     const uid = nanoid();
    //     this.users[uid] = socket.id;
    //     const users = Object.values(this.users);

    //     socketLogger.log("Sending callback for handshake...");
    //     callback(uid, users);

    //     // Send new user to all connected users
    //     this.SendMessage(
    //       "user_connected",
    //       users.filter((id) => id !== socket.id),
    //       users
    //     );
    //   }
    // );

    socket.on("handshake", (username: string) => {
      socketLogger.log(`Handshake received from ${socket.id}`);

      const isUsernameTaken = Object.keys(this.users).includes(username);

      const checkUsername = () => {
        const usernameRegex = /^[a-z0-9]+$/i;

        try {
          if (!username)
            throw new Error("You cant leave blank username field!");
          if (typeof username !== "string")
            throw new Error("Username must be a string!");

          const trimmedUsername = username.trimStart().trimEnd();
          if (!trimmedUsername)
            throw new Error("You cant leave blank username field!");

          if (trimmedUsername.length < 3 || trimmedUsername.length >= 10)
            throw new Error(
              "Username must be more than 3 characters and less or equal 10!"
            );

          if (!usernameRegex.test(trimmedUsername))
            throw new Error("Username can be only letters and numbers!");

          return trimmedUsername;
        } catch (err) {
          this.SendMessage("error", [socket.id], err);
        }
      };

      checkUsername();

      if (isUsernameTaken) {
        this.SendMessage(
          "error",
          [socket.id],
          "Someone with that username already exist! Please use diffrent one!"
        );
        return;
      }

      // Generate new user
      const uid = username;
      this.users[uid] = socket.id;
      const users = Object.values(this.users);

      //TODO: Check if that username is correct or if already exist on server
      this.SendMessage("joined", [socket.id], { username, users });

      // Send new user to all connected users
      this.SendMessage(
        "user_connected",
        users.filter((id) => id !== socket.id),
        users
      );
    });

    socket.on("disconnect", () => {
      //TODO: Find if a user was in a room, if he was then delete the room
      socketLogger.log(`Disconnect received from ${socket.id}`);

      const uid = this.GetUidFromSocketId(socket.id);

      if (uid) {
        delete this.users[uid];
        const users = Object.values(this.users);
        this.SendMessage("user_disconnected", users, uid);
      }
    });

    socket.on("create_room", () => {
      //!TODO
      const uid = this.GetUidFromSocketId(socket.id);

      const roomId = roomIdGenerator();

      //TODO: If roomId already exist
      if (this.rooms.has(roomId)) return;

      const room = new Room(uid, socket, null, null);

      this.rooms.set(roomId, room);

      socket.join(roomId);
      // this.io.to(socket.id).emit("created_room", roomId);
      this.SendMessage("created_room", [socket.id], {
        roomId,
        ownerUsername: uid,
      });

      socketLogger.log(
        `User with ID ${uid} is created a room with id: ${roomId}.`
      );
    });

    socket.on("join_room", (roomId: string) => {
      const uid = this.GetUidFromSocketId(socket.id);

      if (!this.rooms.has(roomId))
        return socketLogger.log(`Counldn't find a room with id ${roomId}.`);

      if (this.rooms.get(roomId).secondPlayerUid) {
        // this.io.to(socket.id).emit("error", "Room is full!");
        this.SendMessage("error", [socket.id], "Room is full!");
        return;
      }

      socket.join(roomId);
      this.rooms.get(roomId).join(uid, socket);
      this.io.to(socket.id).emit("joined_room", roomId);

      socketLogger.log(
        `User with ID ${uid} joined to a room with id ${roomId}. Room is ready to play.`
      );

      // {status: '', firstPlayerUsername: '', }

      const currentRoomStatus: TChangeRoomStatus = {
        status: this.rooms.get(roomId).status,
        firstPlayerUsername: this.rooms.get(roomId).firstPlayerUid,
        secondPlayerUsername: this.rooms.get(roomId).secondPlayerUid,
      };

      this.SendMessageToRoom("change_room_status", roomId, currentRoomStatus);
    });

    socket.on("leave_room", (roomId: string) => {
      const uid = this.GetUidFromSocketId(socket.id);
      socketLogger.log(
        `User with ID ${uid} is trying to leave a room with id ${roomId}.`
      );

      const room = this.rooms.get(roomId);

      if (!room) {
        this.SendMessageToRoom("kick", roomId, "Server error.");
        return;
      }

      if (room.isOwnerOfRoom(uid)) {
        const currentRoomStatus: TChangeRoomStatus = {
          status: this.rooms.get(roomId).status,
        };

        this.SendMessageToRoom("change_room_status", roomId, currentRoomStatus);

        this.SendMessageToRoom("kick", roomId, "Owner leaved the room.");

        room.removeRoom();
        this.rooms.delete(roomId);
        socketLogger.log(`Deleted room with id: ${roomId}`);
      } else {
        this.SendMessage("kick", [room.secondPlayerSocket?.id]);

        room.removePlayer(uid);

        socketLogger.log(
          `Kicked a second player from a room with id: ${roomId}`
        );

        const currentRoomStatus: TChangeRoomStatus = {
          status: room.status,
          firstPlayerUsername: room.firstPlayerUid,
        };

        this.SendMessage(
          "change_room_status",
          [room.firstPlayerSocket.id],
          currentRoomStatus
        );

        this.SendMessage("change_room_status", [socket.id], {
          status: "notInRoom",
        });
      }

      socket.leave(roomId);
    });

    socket.on("disconnecting", () => {
      socketLogger.log("User started to disconnecting");
      if (socket.rooms) {
        const uid = this.GetUidFromSocketId(socket.id);

        const [_, roomId] = socket.rooms;
        const room = this.rooms.get(roomId);
        if (!room) return;

        if (room.isOwnerOfRoom(uid)) {
          room.removeRoom();

          this.rooms.delete(roomId);
          socketLogger.log(`Deleted room with id: ${roomId}`);

          // this.io.to(roomId).emit("kick", "Owner leaved the room.");
          this.SendMessageToRoom("kick", roomId, "Owner leaved the room.");
        } else {
          // this.io.to(socket.id).emit("kick");
          this.SendMessage("kick", [socket.id]);
          room.removePlayer(uid);

          socketLogger.log(
            `Kicked a second player from a room with id: ${roomId}`
          );
        }

        this.SendMessageToRoom("change_room_status", roomId, {
          status: room.status,
        });

        socket.leave(roomId);
      }
    });
  };

  GetUidFromSocketId = (id: string) =>
    Object.keys(this.users).find((uid) => this.users[uid] === id);

  /**
   * Send a message through the socket
   * @param name The name of the event, ex: handshake
   * @param users List of socked id's
   * @param payload any information needed by the user for state updates
   */
  SendMessage = (name: string, users: string[], payload?: Object) => {
    socketLogger.log(
      `Emmitting event: ${name} to ${users.length > 0 ? users : "[]"}`
    );
    users.forEach((id) =>
      payload ? this.io.to(id).emit(name, payload) : this.io.to(id).emit(name)
    );
  };

  /**
   * Send a message through the socket
   * @param name The name of the event, ex: handshake
   * @param roomId Room id
   * @param payload any information needed by the user for state updates
   */
  SendMessageToRoom = (name: string, roomId: string, payload?: Object) => {
    socketLogger.log(`Emmitting event: ${name} to room with id: ${roomId}`);
    payload
      ? this.io.to(roomId).emit(name, payload)
      : this.io.to(roomId).emit(name);
  };
}
