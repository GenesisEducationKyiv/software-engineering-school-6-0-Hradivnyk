export interface Subscription {
  email: string;
  repo: string;
  confirmed: boolean;
  last_seen_tag: string | null;
}
