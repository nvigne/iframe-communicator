import { MessagingService } from "./connection.js";

var button = document.getElementById("button");
var iframe = document.getElementById("iframe") as HTMLIFrameElement;

// var d = new MessagingService("http://192.168.156.168:8080", iframe, "d");
var c = new MessagingService("http://192.168.156.168:8080", iframe, "c");

// d.addMessageHandler((data) => console.log("d:" + data))
c.addMessageHandler((data) => console.log(data));

button?.addEventListener("click", () => {
    c.postMessage("testtdsksdhdsk");
})

