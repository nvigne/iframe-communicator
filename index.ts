var button = document.getElementById("button");
var iframe = document.getElementById("iframe") as HTMLIFrameElement;
button.addEventListener("click", () => {
    console.log("test");
    iframe.contentWindow.postMessage("simpleMessage", "*");
})

