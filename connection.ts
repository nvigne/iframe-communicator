const WILDCARD_TARGET: string = "*";
const UNKNOWN_DESTINATION: string = "UNKNOWN_DESTINATION"

export type MessageHandler = { (data: any): void };

export interface Logger { 
    log(data: string): void;
};

type Channel = {
    destination: string;
    initialized: boolean;
    token: string;
    window: WindowProxy | undefined | null;
}

type State = "SYN" | "ACK" | "SYN+ACK"

interface ChannelInitializationMessage extends TokenMessage {
    source: string;
    state: State;
    frame: number;
}

interface ChannelMessage extends TokenMessage {
    data: any,
}

interface TokenMessage {
    token: string,
}

enum WindowType {
    Window = "Window",
    Frame = "Frame",
}

/**
 * Messaging service is used to perform communication between main window an a frame. It enables two-ways communication.
 */
export class MessagingService {
    private interval: number | undefined;
    private handlers: Map<number, MessageHandler> = new Map<number, MessageHandler>();

    private channels: Map<string, Channel> = new Map<string, Channel>();

    /**
     * Unique id which represent the current window.
     */
    private id: string;

    /**
     * Default constructor for the messaging service. 
     * @param target The target origin use to send message. 
     * @param frame A reference to the frame we want to communicate with. if no frame is passed, we assume we initialize the frame communication object.
     */
    constructor(private target: string, private frame?: HTMLIFrameElement, overrideId?: string, private logger?: Logger) {
        if (target == WILDCARD_TARGET) {
            throw new Error("Don't use '*' as target.");
        }

        
        this.id = overrideId ?? this.GetRandomNumber();
        
        window.addEventListener("message", this.listener.bind(this));

        // Use to correctly initialize the messaging service.
        if (this.frame) {
            this.interval = setInterval(this.connectToFrame.bind(this), Math.random() * 1000)
        }
    }

    /**
     * Append a message handler. The callback will be called when receiving a message.
     * @param handler The message handler that will receive the message.
     */
    addMessageHandler(handler: MessageHandler): number {
        var handlerId = parseInt(this.GetRandomNumber());
        this.handlers.set(handlerId, handler);
        return handlerId;
    }

    /**
     * Delete a message handler from the pool.
     * @param handlerId The handler id returned by the addMessageHandler method.
     */
    removeMessageHandler(handlerId: number): void {
        if (this.handlers.has(handlerId)) {
            this.handlers.delete(handlerId);
        }
    }

    /**
     * Post a message.
     * 
     * Depending on the context, it will send the message to the correct frame (either the main window or the embeded iframe).
     * 
     * @param data The data to be send.
     */
    postMessage<T>(data: T): void {
        if (this.channels.size == 0) {
            throw new Error("No channel.");
        }

        if (!this.AtLeastOneInitializedChannel()) {
            throw new Error("No channel initialized");
        }

        // Post to each channel a message.
        this.channels.forEach(channel => {
            var message: ChannelMessage = {
                token: channel.token,
                data: data
            }
            
            this.postMessageInternal(message, channel);
        });

    }

    private postMessageInternal<T>(data: T, channel: Channel): void {
        if (!channel.window) {
            return;
        }

        this.logger?.log("send message to: " + channel.destination + " with token: " + channel.token);
        this.logger?.log("send message using: " + this.GetType())

        switch (this.GetType()) {
            case WindowType.Window:
                channel.window.postMessage(data, this.target);
                break;
            case WindowType.Frame:
                channel.window.postMessage(data, this.target);
                break;
        }
    }

    private postInitializationMessage(data: ChannelInitializationMessage, channel: Channel) {
        this.logger?.log("send handshake with state: " + data.state);

        this.postMessageInternal<ChannelInitializationMessage>(data, channel);
    }

    private connectToFrame(): void {
        if (!this.frame?.contentWindow) {
            throw new Error("Frame or contentWindow is null.");
        }

        var token = this.GetRandomNumber();
        var channel: Channel = {
            token: token,
            destination: UNKNOWN_DESTINATION,
            initialized: false,
            window: this.frame.contentWindow,
        };

        this.channels.set(token, channel)

        this.postInitializationMessage({
            source: this.id,
            token: token,
            state: "SYN",
            frame: 1,
        }, channel);
    }

    private listener(event: MessageEvent<any>): void {
        if (event.origin != this.target) {
            throw new Error("Origin does not match expected target");
        }

        this.logger?.log("receive message on " + this.id + ", type: " + this.GetType());

        if (event.data) {
            var initializationMessage = event.data as ChannelInitializationMessage;
            if (initializationMessage.state) {
                this.initialize(event);
                return;
            }

            this.dispatchEvent(event.data);
        }
    }

    private initialize(event: MessageEvent<any>): void {
        var message = event.data as ChannelInitializationMessage;

        var updatedOrNewChannel: Channel;
        var state: State;

        this.logger?.log("receive initialization with state: " + message.state + ", frame: " + message.frame)

        if (message.state == "SYN+ACK") {
            if (this.channels.has(message.token)) {
                var channel = this.channels.get(message.token);
                if (!channel || channel?.initialized) {
                    return;
                }
    
                state = "ACK";
    
                updatedOrNewChannel = {
                    token: message.token,
                    destination: message.source,
                    initialized: true,
                    window: channel?.window,
                }

                this.channels.set(message.token, updatedOrNewChannel);

                this.postInitializationMessage({
                    token: message.token,
                    source: this.id,
                    state: state,
                    frame: message.frame + 1,
                }, updatedOrNewChannel);

                
                if (this.interval) {
                    clearInterval(this.interval);
                }
            }
        } else if (message.state == "SYN") {
            updatedOrNewChannel = {
                token: message.token,
                destination: UNKNOWN_DESTINATION,
                initialized: false,
                window: event.source as WindowProxy,
            };

            state = "SYN+ACK"

            this.channels.set(message.token, updatedOrNewChannel);

            this.postInitializationMessage({
                token: message.token,
                source: this.id,
                state: state,
                frame: message.frame + 1,
            }, updatedOrNewChannel);
        } else if (message.state == "ACK") {
            if (this.channels.has(message.token)) {
                var channel = this.channels.get(message.token);
                if (!channel || channel?.initialized) {
                    return;
                }
    
                state = "ACK";
    
                updatedOrNewChannel = {
                    token: message.token,
                    destination: message.source,
                    initialized: true,
                    window: channel?.window,
                }

                this.channels.set(message.token, updatedOrNewChannel);
            }

            return;
        }
    }

    private dispatchEvent(message: any): void {
        var channelMessage = message as ChannelMessage
        
        // If we don't have a channel for this token, we don't deal with it.
        if (!this.channels.has(channelMessage.token)) {
            this.logger?.log("receive a message with no valid token. drop.")
            return
        }

        this.logger?.log("receive a message from: " + this.channels.get(channelMessage.token)?.destination)

        this.handlers.forEach(handler => {
            handler(channelMessage.data);
        });
    }

    private GetType(): WindowType {
        return this.frame ? WindowType.Window : WindowType.Frame;
    }

    private GetRandomNumber(): string {
        return Math.random().toString().substring(2, 8)
    }

    private AtLeastOneInitializedChannel(): boolean {
        var atLeastOne: boolean = false;
        
        this.channels.forEach(element => {
            if (element.initialized) {
                atLeastOne = true;
            }
        });

        return atLeastOne;
    }
}