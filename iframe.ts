import { MessagingService } from "./connection.js";

var logger = {
    log(data: string) {
        console.log(data);
    }
}

var c = new MessagingService("http://127.0.0.1:8080", undefined, "iframe", logger);

var button = document.getElementById("button");

c.addMessageHandler((data) => console.log("iframe" + data));

button?.addEventListener("click", () => {
    c.postMessage("qqqq");
})