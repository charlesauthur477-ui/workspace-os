// Minimal ambient types for guacamole-common-js — the package ships no
// official TypeScript definitions. Only the surface RdpPane.tsx actually
// uses is typed; everything else falls through to `any` deliberately rather
// than guessing at a full API surface we don't exercise.
declare module "guacamole-common-js" {
  export class Status {
    code: number;
    message?: string;
  }

  export namespace Client {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
  }

  export class Tunnel {
    constructor(...args: unknown[]);
  }

  export class WebSocketTunnel extends Tunnel {
    constructor(tunnelUrl: string);
  }

  export class Display {
    getElement(): HTMLElement;
    scale(factor: number): void;
    getWidth(): number;
    getHeight(): number;
  }

  export class Client {
    constructor(tunnel: Tunnel);
    connect(data?: string): void;
    disconnect(): void;
    getDisplay(): Display;
    sendMouseState(state: unknown): void;
    sendKeyEvent(pressed: 0 | 1, keysym: number): void;
    onstatechange: ((state: number) => void) | null;
    onerror: ((status: Status) => void) | null;
  }

  export class Mouse {
    constructor(element: HTMLElement);
    onmousedown: ((state: unknown) => void) | null;
    onmouseup: ((state: unknown) => void) | null;
    onmousemove: ((state: unknown) => void) | null;
  }

  export class Keyboard {
    constructor(element: HTMLElement | Document);
    onkeydown: ((keysym: number) => void) | null;
    onkeyup: ((keysym: number) => void) | null;
  }

  const Guacamole: {
    Status: typeof Status;
    Tunnel: typeof Tunnel;
    WebSocketTunnel: typeof WebSocketTunnel;
    Client: typeof Client;
    Display: typeof Display;
    Mouse: typeof Mouse;
    Keyboard: typeof Keyboard;
  };

  export default Guacamole;
}
