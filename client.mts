(async () => {
  const ws = new WebSocket("ws://localhost:6970");
  ws.addEventListener("close", (event) => {
    console.log(event);
  });
  ws.addEventListener("error", (event) => {
    console.log(event);
  });
  ws.addEventListener("message", (event) => {
    console.log(event);
  });
  ws.addEventListener("open", (event) => {
    console.log(event);
  });
})();
