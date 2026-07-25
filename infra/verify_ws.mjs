const url = process.argv[2];
const roomId = `verify-${Date.now()}`;
const joinId = `join-${Date.now()}`;
const pingId = `ping-${Date.now()}`;
const socket = new WebSocket(url);

const result = await new Promise((resolve, reject) => {
  const timeout = setTimeout(
    () => reject(new Error("WebSocket verification timed out")),
    15_000,
  );

  socket.addEventListener("error", () => {
    clearTimeout(timeout);
    reject(new Error("WebSocket connection failed"));
  });
  socket.addEventListener("open", () => {
    socket.send(JSON.stringify({
      type: "join",
      request_id: joinId,
      room_id: roomId,
      client_id: "deploy-verifier",
    }));
  });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.type === "ack" && message.kind === "joined") {
      socket.send(JSON.stringify({
        type: "ping",
        request_id: pingId,
        room_id: roomId,
      }));
    } else if (message.type === "ack" && message.kind === "pong") {
      clearTimeout(timeout);
      resolve(message);
    } else if (message.type === "error") {
      clearTimeout(timeout);
      reject(new Error(`${message.code}: ${message.message}`));
    }
  });
});

socket.close();
console.log(`WebSocket joined and pinged at ${result.server_time}`);
