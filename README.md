# iframe-messaging

This package helps browser pages exchange messages between a parent window and an iframe with a small `postMessage` wrapper.

The service performs a three-way handshake before application messages are delivered:

1. Parent sends `SYN` to the iframe.
2. Iframe responds with `SYN+ACK`.
3. Parent sends `ACK`; both sides can then exchange messages.

The target origin must be explicit. The wildcard origin (`"*"`) is rejected.

## Installation

```sh
npm install iframe-messaging
```

The package ships compiled JavaScript (`connection.js`) and type declarations (`connection.d.ts`), so it works in both JavaScript and TypeScript projects.

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

## API

### `new MessagingService(target, frame?, overrideId?, logger?)`

| Parameter | Type | Description |
| --- | --- | --- |
| `target` | `string` | Required origin used to send and validate messages. The wildcard `"*"` is rejected. |
| `frame` | `HTMLIFrameElement` | Optional. When provided, the service acts as the parent window and initiates the handshake with that iframe. When omitted, the service acts as the iframe side and waits for an incoming handshake. |
| `overrideId` | `string` | Optional fixed identifier for the window. A random id is generated when omitted. |
| `logger` | `Logger` | Optional logger that receives diagnostic messages during the handshake and message exchange. |

### `addMessageHandler(handler): number`

Registers a handler that receives the data of each incoming application message and returns an id used to remove it later.

### `removeMessageHandler(handlerId): void`

Removes a previously registered handler.

### `postMessage(data): void`

Broadcasts `data` to every initialized channel. Throws if no channel exists or none has finished the handshake.

### `Logger`

```ts
interface Logger {
    log(data: string): void;
}
```

## Handshake states

Channels move through the states `SYN`, `SYN+ACK`, and `ACK`. Once a frame accepts the final `ACK`, it transitions to the terminal `FIN` state and the channel is ready for application messages.

## Notes

- Call `postMessage` only after the handshake has completed.
- Messages sent before a channel is initialized throw an error.
- Messages whose origin does not match the configured target are rejected.
- Messages with unknown channel tokens are ignored.

## Development

```sh
npm install      # install dependencies
npm test         # run the Vitest test suite
npx tsc --noEmit # type-check the source
```

## Release notes

### 0.1.4

- Added tests for handshake states, timer cleanup, origin validation, unknown tokens, and uninitialized channels.
- Improved reconnect timer cleanup after successful handshakes.
- Tightened message handler typings while keeping the existing API shape.
- Expanded usage documentation.
