import { MessagingService } from "./connection.js";

var c = new MessagingService("http://192.168.156.168:8080", undefined, "iframe");

var button = document.getElementById("button");

c.addMessageHandler((data) => console.log("iframe" + data));

button?.addEventListener("click", () => {
    c.postMessage("qqqq");
})