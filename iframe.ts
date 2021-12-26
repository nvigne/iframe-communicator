import { MessagingService } from "./connection.js";

var c = new MessagingService("http://192.168.156.168:8080");

var button = document.getElementById("button");

c.addMessageHandler((data) => console.log(data));

button?.addEventListener("click", () => {
    c.postMessage("qqqq");
})