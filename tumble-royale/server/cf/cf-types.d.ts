// Minimal Cloudflare Workers declarations used by the adapter (keeps the main
// tsconfig free of @cloudflare/workers-types).
declare module 'cloudflare:workers' {
  export class DurableObject<Env = unknown> {
    protected ctx: DurableObjectState;
    protected env: Env;
    constructor(ctx: DurableObjectState, env: Env);
  }
}
interface DurableObjectStorage {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
  list<T = unknown>(opts?: { prefix?: string; limit?: number }): Promise<Map<string, T>>;
}
interface DurableObjectState { storage: DurableObjectStorage; id: { toString(): string; name?: string }; waitUntil(p: Promise<unknown>): void }
interface DurableObjectStub { fetch(input: string | Request, init?: RequestInit): Promise<Response> }
interface DurableObjectNamespace { idFromName(name: string): unknown; get(id: unknown): DurableObjectStub }
interface Fetcher { fetch(input: Request | string, init?: RequestInit): Promise<Response> }
interface CfWebSocket {
  accept(): void;
  send(data: string | ArrayBuffer | ArrayBufferView): void;
  close(code?: number, reason?: string): void;
  addEventListener(type: 'message', fn: (e: { data: string | ArrayBuffer }) => void): void;
  addEventListener(type: 'close' | 'error', fn: () => void): void;
}
declare const WebSocketPair: { new (): { 0: CfWebSocket; 1: CfWebSocket } };
