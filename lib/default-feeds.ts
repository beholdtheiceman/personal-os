import type { NewsFeed } from "@/types";

export type FeedTemplate = Omit<NewsFeed, "id" | "created_at">;

export const DEFAULT_FEEDS: FeedTemplate[] = [
  // Tech
  { name: "Hacker News",  url: "https://hnrss.org/frontpage",                               type: "rss",    tags: ["tech"],            enabled: true  },
  { name: "The Verge",    url: "https://www.theverge.com/rss/index.xml",                    type: "rss",    tags: ["tech"],            enabled: true  },
  { name: "TechCrunch",   url: "https://feeds.feedburner.com/TechCrunch",                   type: "rss",    tags: ["tech"],            enabled: false },

  // World
  { name: "BBC News",     url: "https://feeds.bbci.co.uk/news/rss.xml",                     type: "rss",    tags: ["world"],           enabled: true  },
  { name: "NPR News",     url: "https://feeds.npr.org/1001/rss.xml",                        type: "rss",    tags: ["world"],           enabled: false },

  // Finance
  { name: "Yahoo Finance",       url: "https://finance.yahoo.com/rss/",                     type: "rss",    tags: ["finance"],         enabled: true  },
  { name: "r/personalfinance",   url: "personalfinance",                                    type: "reddit", tags: ["finance"],         enabled: false },

  // Faith
  { name: "Desiring God", url: "https://www.desiringgod.org/articles.rss",                  type: "rss",    tags: ["faith"],           enabled: false },

  // Sports
  { name: "ESPN",         url: "https://www.espn.com/espn/rss/news",                        type: "rss",    tags: ["sports"],          enabled: false },
];
