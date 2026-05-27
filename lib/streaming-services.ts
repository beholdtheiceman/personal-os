export interface StreamingQuickLink {
  label: string;
  url: string;
  description: string;
}

export interface StreamingServiceMeta {
  tmdbProviderId: number;  // TMDb watch provider ID for content discovery
  cancelUrl: string;       // Direct link to account/cancel page
  quickLinks: StreamingQuickLink[];
}

export const STREAMING_SERVICES: Record<string, StreamingServiceMeta> = {
  Netflix: {
    tmdbProviderId: 8,
    cancelUrl: 'https://www.netflix.com/account',
    quickLinks: [
      { label: 'Account Overview', url: 'https://www.netflix.com/account', description: 'Plan, billing, and account settings' },
      { label: 'Billing & Payments', url: 'https://www.netflix.com/billingactivity', description: 'View payment history and next charge date' },
      { label: 'Change Plan', url: 'https://www.netflix.com/account/changeplan', description: 'Upgrade, downgrade, or switch tiers' },
      { label: 'Cancel Membership', url: 'https://www.netflix.com/cancel', description: 'Cancel your subscription' },
    ],
  },
  'Disney+': {
    tmdbProviderId: 337,
    cancelUrl: 'https://www.disneyplus.com/account',
    quickLinks: [
      { label: 'Account', url: 'https://www.disneyplus.com/account', description: 'Manage your Disney+ account' },
      { label: 'Billing', url: 'https://www.disneyplus.com/account/subscription', description: 'View and update billing details' },
    ],
  },
  'Apple TV+': {
    tmdbProviderId: 350,
    cancelUrl: 'https://account.apple.com/subscriptions',
    quickLinks: [
      { label: 'Subscriptions', url: 'https://account.apple.com/subscriptions', description: 'Manage Apple subscriptions' },
    ],
  },
  'Prime Video': {
    tmdbProviderId: 9,
    cancelUrl: 'https://www.amazon.com/gp/video/settings/',
    quickLinks: [
      { label: 'Manage Membership', url: 'https://www.amazon.com/gp/primecentral', description: 'Amazon Prime membership settings' },
      { label: 'Video Settings', url: 'https://www.amazon.com/gp/video/settings/', description: 'Prime Video account settings' },
    ],
  },
  Max: {
    tmdbProviderId: 1899,
    cancelUrl: 'https://www.max.com/settings/subscription',
    quickLinks: [
      { label: 'Subscription', url: 'https://www.max.com/settings/subscription', description: 'Manage your Max subscription' },
    ],
  },
  Peacock: {
    tmdbProviderId: 386,
    cancelUrl: 'https://www.peacocktv.com/account',
    quickLinks: [
      { label: 'Account', url: 'https://www.peacocktv.com/account', description: 'Peacock account and billing' },
    ],
  },
  'Paramount+': {
    tmdbProviderId: 531,
    cancelUrl: 'https://www.paramountplus.com/account/subscription',
    quickLinks: [
      { label: 'Subscription', url: 'https://www.paramountplus.com/account/subscription', description: 'Manage your Paramount+ plan' },
    ],
  },
  Hulu: {
    tmdbProviderId: 15,
    cancelUrl: 'https://secure.hulu.com/account/cancel',
    quickLinks: [
      { label: 'Account', url: 'https://secure.hulu.com/account', description: 'Hulu account settings and billing' },
    ],
  },
};

// Helper — returns meta only if the name is a known streaming service
export function getStreamingMeta(name: string): StreamingServiceMeta | null {
  return STREAMING_SERVICES[name] ?? null;
}
