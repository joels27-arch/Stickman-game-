/**
 * The bindings the platform injects at deploy. Keep in step with
 * app.manifest.json.
 */
export interface Env {
  /** Static client files (dist/client), served asset-first. */
  ASSETS: Fetcher;
  /** One Durable Object instance per room — `app.manifest.json` → durableObject. */
  ROOMS: DurableObjectNamespace;
  /** "dev" | "prod" — the CODE's environment label. */
  HF_ENV?: string;
  /** This app's subdomain label. */
  APP_SLUG?: string;
}
