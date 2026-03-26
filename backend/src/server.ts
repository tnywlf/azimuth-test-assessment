import { createServer } from "http";
import app from "./app";
import { config } from "./config/config";
import { initSocket } from "./config/socket";

const PORT = config.port;

// Create HTTP server and attach Socket.IO
const httpServer = createServer(app);
initSocket(httpServer);

httpServer.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`WebSocket server ready on ws://localhost:${PORT}`);
});
