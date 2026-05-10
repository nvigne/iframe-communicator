# iframe-messaging

This package helps browser pages exchange messages between a parent window and an iframe with a small `postMessage` wrapper.

The service performs a three-way handshake before application messages are delivered:

1. Parent sends `SYN` to the iframe.
2. Iframe responds with `SYN+ACK`.
3. Parent sends `ACK`; both sides can then exchange messages.

The target origin must be explicit. The wildcard origin (`"*"`) is rejected.

## Parent window

```ts
import { MessagingService } from "iframe-messaging";

const iframe = document.querySelector<HTMLIFrameElement>("#child-frame");

if (!iframe) {
    throw new Error("Missing iframe");
}

const messaging = new MessagingService("https://child.example", iframe);

const handlerId = messaging.addMessageHandler(message => {
    console.log("Message from iframe:", message);
});

messaging.postMessage({ type: "parent-ready" });

// Remove handlers when they are no longer needed.
messaging.removeMessageHandler(handlerId);
```

## Iframe window

```ts
import { MessagingService } from "iframe-messaging";

const messaging = new MessagingService("https://parent.example");

messaging.addMessageHandler(message => {
    console.log("Message from parent:", message);
});

messaging.postMessage({ type: "iframe-ready" });
```

## Notes

- Call `postMessage` only after the handshake has completed.
- Messages sent before a channel is initialized throw an error.
- Messages whose origin does not match the configured target are rejected.
- Messages with unknown channel tokens are ignored.

## Release notes

### 0.1.4

- Added tests for handshake states, timer cleanup, origin validation, unknown tokens, and uninitialized channels.
- Improved reconnect timer cleanup after successful handshakes.
- Tightened message handler typings while keeping the existing API shape.
- Expanded usage documentation.
