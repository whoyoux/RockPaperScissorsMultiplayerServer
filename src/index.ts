import express, { Express, Request, Response } from "express";
import http from "http";
import { Logger } from "./logger";
import { ServerSocket } from "./socket";

const app: Express = express();
const port = process.env.PORT || 3000;

const httpServer = http.createServer(app);

const serverSocket = new ServerSocket(httpServer);

const expressLogger = new Logger("⚡️[ExpressServer]");

app.use(express.json());

app.get("/", (req: Request, res: Response) => {
  res.send("Express + TypeScript Server");
});

app.get("/rooms", (req: Request, res: Response) => {
  const formattedText = [];
  [...serverSocket.rooms.keys()].forEach((roomId) => {
    const roomObj = serverSocket.rooms.get(roomId);
    const room = {
      id: roomId,
      firstPlayer: roomObj.firstPlayerUid,
      secondPlayer: roomObj.secondPlayerUid,
      roomStatus: roomObj.status,
    };
    expressLogger.log(roomId);
    formattedText.push(room);
  });
  res.json(formattedText);
});

httpServer.listen(port, () => {
  expressLogger.log(`Server is running at https://localhost:${port}`);
});
