// Service API Resmi untuk sinkronisasi Frontend dengan Backend FastAPI (PostgreSQL & Neo4J)
import mbgGraphFallback from './mbgGraphFallback.json';

const rawBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api').replace(/\/+$/, '');
export const API_BASE_URL = rawBaseUrl.endsWith('/api') ? rawBaseUrl : `${rawBaseUrl}/api`;

export interface SocialPost {
  id: string | number;
  platform: string;
  user_id: string;
  topic: string;
  topic_id?: number | string;
  content: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  sentiment_score?: number;
  entities: Array<{ name: string; type: string }>;
  engagement: {
    likes: number;
    shares: number;
    comments: number;
    views: number;
  };
  hashtags?: string[];
  timestamp: string;
}

export interface TopicItem {
  id?: number | string;
  rank: number;
  title: string;
  postCount: number;
  posts: string;
  growth: string;
  sentiment?: string;
}

export interface EntityItem {
  id?: number | string;
  rank: number;
  name: string;
  type: string;
  mentionCount: number;
  mentions: string;
}

export interface TimelinePoint {
  date: string;
  positive: number;
  neutral: number;
  negative: number;
  timestamp?: number;
  topPositiveTopic?: string;
  topNegativeTopic?: string;
  topNeutralTopic?: string;
}

export interface PlatformDistribution {
  instagram: { percentage: number; posts: number };
  x: { percentage: number; posts: number };
  tiktok?: { percentage: number; posts: number };
}

export interface DashboardOverviewData {
  totalPosts: number;
  totalEngagement: number;
  trendingTopicsCount: number;
  uniqueEntitiesCount: number;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  positiveShare: number;
  negativeShare: number;
  neutralShare: number;
  avgConfidence: number;
  dominantSentiment: 'positive' | 'negative' | 'neutral';
  topPositiveTopic?: string;
  topNegativeTopic?: string;
  topNeutralTopic?: string;
  dominantTopic?: string;
  narrativeSummary?: string;
  peakDateStr?: string;
  platformDistribution?: PlatformDistribution;
  keyInsights?: Array<{ title: string; description: string }>;
  topTopics?: TopicItem[];
  topEntities?: EntityItem[];
  postsGrowth?: number;
  engagementGrowth?: number;
}

export function normalizeEntityType(type?: string): string {
  if (!type) return 'topic';
  const lower = type.toLowerCase().trim();
  if (lower === 'person' || lower === 'per') return 'person';
  if (lower === 'organization' || lower === 'org') return 'organization';
  if (lower === 'geopolitical' || lower === 'gpe') return 'geopolitical';
  if (lower === 'location' || lower === 'loc') return 'location';
  if (lower === 'product' || lower === 'prd') return 'product';
  if (lower === 'event' || lower === 'evt') return 'event';
  if (lower === 'norm' || lower === 'nor') return 'norm';
  if (lower === 'facility' || lower === 'fac') return 'facility';
  if (lower === 'topic') return 'topic';
  return lower;
}

export function normalizePlatform(platform?: string): string {
  if (!platform) return 'instagram';
  const lower = platform.toLowerCase();
  if (lower === 'twitter' || lower === 'x') return 'x';
  if (lower === 'instagram' || lower === 'ig') return 'instagram';
  if (lower === 'tiktok') return 'tiktok';
  return lower;
}

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('access_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * 1. Builder Query Parameter sesuai kontrak Backend:
 *    - 'last7' / '7_hari' -> days=7 & time_filter=last7
 *    - 'last14' / '14_hari' -> days=14 & time_filter=last14
 *    - 'last30' / '30_hari' -> days=30 & time_filter=last30
 *    - 'all' / 'sepanjang_waktu' -> HANYA time_filter=all (tanpa days)
 */
export function buildTimeAndPlatformQuery(params?: {
  platform?: string;
  timeFilter?: string;
  limit?: number;
  minFreq?: string | number;
  entityType?: string;
  topic?: string | null;
  date?: string | null;
}): string {
  const query = new URLSearchParams();

  if (params?.platform && params.platform !== 'all') {
    query.set('platform', params.platform.toLowerCase());
  }

  if (params?.timeFilter) {
    const tf = params.timeFilter;
    if (tf === 'last7' || tf === '7_hari') {
      query.set('days', '7');
      query.set('time_filter', 'last7');
    } else if (tf === 'last14' || tf === '14_hari') {
      query.set('days', '14');
      query.set('time_filter', 'last14');
    } else if (tf === 'last30' || tf === '30_hari') {
      query.set('days', '30');
      query.set('time_filter', 'last30');
    } else {
      // Untuk 'all' / 'sepanjang_waktu', cukup kirim time_filter=all (JANGAN kirim days)
      query.set('time_filter', 'all');
    }
  }

  if (params?.limit !== undefined) {
    query.set('limit', String(params.limit));
  }
  if (params?.minFreq !== undefined) {
    query.set('min_freq', String(params.minFreq));
  }
  if (params?.entityType && params.entityType !== 'All') {
    query.set('entity_type', params.entityType.toLowerCase());
  }
  if (params?.topic) {
    query.set('topic', params.topic);
  }
  if (params?.date) {
    query.set('date', params.date);
  }

  const str = query.toString();
  return str ? `?${str}` : '';
}

export function normalizePostRecord(row: any): SocialPost {
  const rawEntities = Array.isArray(row.entities) ? row.entities : [];
  const normalizedEntities = rawEntities
    .map((ent: any) => {
      if (typeof ent === 'string') {
        return { name: ent, type: 'Topic' };
      }
      return {
        name: ent.name || ent.entity_name || '',
        type: normalizeEntityType(ent.type || ent.entity_type)
      };
    })
    .filter((e: any) => Boolean(e.name));

  if (Array.isArray(row.hashtags)) {
    const existingNames = new Set(normalizedEntities.map((e: any) => e.name.toLowerCase()));
    row.hashtags.forEach((tag: string) => {
      const cleanTag = String(tag).replace(/^#/, '').trim();
      if (cleanTag && !existingNames.has(cleanTag.toLowerCase())) {
        existingNames.add(cleanTag.toLowerCase());
        normalizedEntities.push({ name: cleanTag, type: 'Topic' });
      }
    });
  }

  const engagement = {
    likes: Number(row.engagement?.likes ?? row.likes ?? row.like_count ?? 0),
    shares: Number(row.engagement?.shares ?? row.shares ?? row.retweets ?? row.reposts ?? row.retweet_count ?? 0),
    comments: Number(row.engagement?.comments ?? row.comments ?? row.replies ?? row.reply_count ?? 0),
    views: Number(row.engagement?.views ?? row.views ?? row.impressions ?? row.view_count ?? 0)
  };

  const topicName =
    (typeof row.topic === 'object' && row.topic !== null ? row.topic.name : row.topic) ||
    row.topic_name ||
    row.topic_label ||
    (row.topic_id ? `Topik #${row.topic_id}` : '');

  const rawSentiment = String(row.sentiment || 'neutral').toLowerCase();
  const sentiment: 'positive' | 'negative' | 'neutral' =
    rawSentiment === 'positive' || rawSentiment === 'positif'
      ? 'positive'
      : rawSentiment === 'negative' || rawSentiment === 'negatif'
      ? 'negative'
      : 'neutral';

  return {
    id: row.id ?? row.platform_post_id ?? Math.random().toString(36).slice(2),
    platform: normalizePlatform(row.platform),
    user_id: row.author_username || row.user_id || row.username || row.screen_name || row.author || '@anonymous',
    topic: String(topicName),
    topic_id: row.topic_id,
    content: String(row.content || row.text || row.full_text || ''),
    sentiment,
    sentiment_score: row.sentiment_score !== undefined ? Number(row.sentiment_score) : undefined,
    entities: normalizedEntities,
    engagement,
    hashtags: Array.isArray(row.hashtags) ? row.hashtags : undefined,
    timestamp: row.posted_at || row.timestamp || row.scraped_at || row.created_at || new Date().toISOString()
  };
}

export function normalizeTopicRecord(row: any, index: number): TopicItem {
  const count = Number(row.post_count ?? row.count ?? row.total_posts ?? row.posts_count ?? row.mentions ?? 0);
  const rawGrowth = row.growth ?? row.growth_rate ?? row.percentage_change ?? row.share;
  const growthStr =
    rawGrowth !== undefined && rawGrowth !== null
      ? typeof rawGrowth === 'number'
        ? `${rawGrowth >= 0 ? '+' : ''}${rawGrowth.toFixed(1)}%`
        : String(rawGrowth)
      : `${count.toLocaleString('id-ID')} post`;

  return {
    id: row.id ?? row.topic_id ?? index + 1,
    rank: Number(row.rank ?? index + 1),
    title: String(row.name ?? row.title ?? row.topic ?? row.label ?? `Topik #${index + 1}`),
    postCount: count,
    posts: typeof row.posts === 'string' ? row.posts : `${count.toLocaleString('id-ID')} postingan`,
    growth: growthStr,
    sentiment: row.sentiment || row.dominant_sentiment
  };
}

export function normalizeEntityRecord(row: any, index: number): EntityItem {
  const d = row.data ? row.data : row;
  const count = Number(d.mention_count ?? d.mentions_count ?? d.count ?? d.weight ?? d.mentions ?? 0);
  return {
    id: d.id ?? d.entity_id ?? index + 1,
    rank: Number(d.rank ?? index + 1),
    name: String(d.name ?? d.label ?? d.entity_name ?? `Entitas #${index + 1}`),
    type: normalizeEntityType(d.type ?? d.entity_type ?? d.group),
    mentionCount: count,
    mentions: typeof d.mentions === 'string' ? d.mentions : `${count.toLocaleString('id-ID')} sebutan`
  };
}

/**
 * Kontrak 1 & 3:
 * - GET /api/dashboard/overview?platform=instagram&time_filter=all
 * - GET /api/sentiment/distribution?platform=instagram&time_filter=all
 */
export async function fetchDashboardOverviewFromApi(params?: {
  platform?: string;
  timeFilter?: string;
  date?: string | null;
}): Promise<DashboardOverviewData | null> {
  const qs = buildTimeAndPlatformQuery({
    platform: params?.platform,
    timeFilter: params?.timeFilter || 'all',
    date: params?.date
  });

  const [overviewRes, distRes] = await Promise.allSettled([
    fetch(`${API_BASE_URL}/dashboard/overview${qs}`, { method: 'GET', headers: getAuthHeaders() }),
    fetch(`${API_BASE_URL}/sentiment/distribution${qs}`, { method: 'GET', headers: getAuthHeaders() })
  ]);

  let overviewRaw: any = null;
  let distRaw: any = null;

  if (overviewRes.status === 'fulfilled' && overviewRes.value.ok) {
    overviewRaw = await overviewRes.value.json().catch(() => null);
  }
  if (distRes.status === 'fulfilled' && distRes.value.ok) {
    distRaw = await distRes.value.json().catch(() => null);
  }

  if (!overviewRaw && !distRaw) {
    return null;
  }

  // Sesuai instruksi Backend: baca dari level teratas maupun di dalam objek `kpi` atau `data`
  const data = overviewRaw?.data && !overviewRaw?.total_posts && !overviewRaw?.kpi ? overviewRaw.data : (overviewRaw || {});
  const kpi = data.kpi || {};
  const sd = distRaw?.data && !distRaw?.positive && !distRaw?.neutral_share ? distRaw.data : (distRaw || {});

  const totalPosts = Number(data.total_posts ?? kpi.total_posts ?? sd.total_posts ?? 0);
  const totalEngagement = Number(data.total_engagement ?? kpi.total_engagement ?? 0);
  const uniqueEntitiesCount = Number(
    data.unique_entities ?? kpi.unique_entities ?? data.unique_entities_count ?? kpi.unique_entities_count ?? 0
  );
  const trendingTopicsCount = Number(
    data.trending_topics ?? kpi.trending_topics ?? data.trending_topics_count ?? kpi.trending_topics_count ?? 0
  );

  // Sentimen counts & shares dari overview maupun sentiment/distribution
  const sentObj = data.sentiment || data.sentiment_distribution || sd.sentiment || sd.distribution || sd;

  const positiveCount = Number(
    data.positive_count ?? kpi.positive_count ?? sentObj?.positive?.count ?? (typeof sentObj?.positive === 'number' ? sentObj.positive : 0)
  );
  const negativeCount = Number(
    data.negative_count ?? kpi.negative_count ?? sentObj?.negative?.count ?? (typeof sentObj?.negative === 'number' ? sentObj.negative : 0)
  );
  const neutralCount = Number(
    data.neutral_count ?? kpi.neutral_count ?? sentObj?.neutral?.count ?? (typeof sentObj?.neutral === 'number' ? sentObj.neutral : 0)
  );

  const sumSentCounts = positiveCount + negativeCount + neutralCount;

  const positiveShare = Number(
    data.positive_share ??
      kpi.positive_share ??
      sd.positive_share ??
      sentObj?.positive?.percentage ??
      sentObj?.positive_pct ??
      (sumSentCounts > 0 ? ((positiveCount / sumSentCounts) * 100).toFixed(1) : 0)
  );

  const negativeShare = Number(
    data.negative_share ??
      kpi.negative_share ??
      sd.negative_share ??
      sentObj?.negative?.percentage ??
      sentObj?.negative_pct ??
      (sumSentCounts > 0 ? ((negativeCount / sumSentCounts) * 100).toFixed(1) : 0)
  );

  const neutralShare = Number(
    data.neutral_share ??
      kpi.neutral_share ??
      sd.neutral_share ??
      sentObj?.neutral?.percentage ??
      sentObj?.neutral_pct ??
      (sumSentCounts > 0 ? ((neutralCount / sumSentCounts) * 100).toFixed(1) : 0)
  );

  // Tentukan sentimen dominan berdasarkan persentase riil dari database
  let dominantSentiment: 'positive' | 'negative' | 'neutral' = 'neutral';
  if (data.dominant_sentiment || sd.dominant_sentiment) {
    const domRaw = String(data.dominant_sentiment || sd.dominant_sentiment).toLowerCase();
    if (domRaw.includes('pos')) dominantSentiment = 'positive';
    else if (domRaw.includes('neg')) dominantSentiment = 'negative';
    else dominantSentiment = 'neutral';
  } else {
    if (positiveShare > neutralShare && positiveShare > negativeShare) dominantSentiment = 'positive';
    else if (negativeShare > neutralShare && negativeShare > positiveShare) dominantSentiment = 'negative';
    else dominantSentiment = 'neutral';
  }

  // Platform Distribution dari overview / distribution
  let platformDistribution: PlatformDistribution | undefined = undefined;
  const rawPlat =
    data.platform_distribution ||
    data.platforms ||
    kpi.platform_distribution ||
    sd.platform_distribution ||
    sd.platforms ||
    sd.by_platform;

  if (rawPlat) {
    let igPosts = 0;
    let xPosts = 0;
    let igPerc: number | undefined;
    let xPerc: number | undefined;

    if (Array.isArray(rawPlat)) {
      rawPlat.forEach((p: any) => {
        const name = String(p.platform || p.name || '').toLowerCase();
        const count = Number(p.count ?? p.posts ?? p.post_count ?? p.total ?? 0);
        const perc = p.percentage ?? p.share;
        if (name === 'instagram' || name === 'ig') {
          igPosts += count;
          if (perc !== undefined) igPerc = Number(perc);
        } else if (name === 'twitter' || name === 'x') {
          xPosts += count;
          if (perc !== undefined) xPerc = Number(perc);
        }
      });
    } else if (typeof rawPlat === 'object') {
      const igObj = rawPlat.instagram ?? rawPlat.Instagram ?? rawPlat.ig;
      const xObj = rawPlat.x ?? rawPlat.X ?? rawPlat.twitter ?? rawPlat.Twitter;
      igPosts = typeof igObj === 'number' ? igObj : Number(igObj?.posts ?? igObj?.count ?? igObj?.post_count ?? igObj?.total ?? 0);
      xPosts = typeof xObj === 'number' ? xObj : Number(xObj?.posts ?? xObj?.count ?? xObj?.post_count ?? xObj?.total ?? 0);
      if (typeof igObj === 'object' && (igObj?.percentage !== undefined || igObj?.share !== undefined)) {
        igPerc = Number(igObj.percentage ?? igObj.share);
      }
      if (typeof xObj === 'object' && (xObj?.percentage !== undefined || xObj?.share !== undefined)) {
        xPerc = Number(xObj.percentage ?? xObj.share);
      }
    }

    const totalP = igPosts + xPosts;
    const finalIgPerc = igPerc !== undefined ? Math.round(igPerc) : totalP > 0 ? Math.round((igPosts / totalP) * 100) : 0;
    const finalXPerc = xPerc !== undefined ? Math.round(xPerc) : totalP > 0 ? Math.max(0, 100 - finalIgPerc) : 0;

    let resolvedIgPosts = igPosts;
    let resolvedXPosts = xPosts;
    // Jika posts masih merupakan sample count (misal <= 50 atau < totalPosts), sinkronkan dengan totalPosts
    if (totalPosts > 0 && (resolvedIgPosts + resolvedXPosts < totalPosts || resolvedIgPosts + resolvedXPosts <= 50)) {
      resolvedIgPosts = Math.round((finalIgPerc / 100) * totalPosts);
      resolvedXPosts = Math.max(0, totalPosts - resolvedIgPosts);
    }

    platformDistribution = {
      instagram: { percentage: finalIgPerc, posts: resolvedIgPosts },
      x: { percentage: finalXPerc, posts: resolvedXPosts }
    };
  } else if (totalPosts > 0) {
    const isX = params?.platform?.toLowerCase() === 'x' || params?.platform?.toLowerCase() === 'twitter';
    platformDistribution = {
      instagram: { percentage: isX ? 0 : 100, posts: isX ? 0 : totalPosts },
      x: { percentage: isX ? 100 : 0, posts: isX ? totalPosts : 0 }
    };
  }

  const topTopicsRaw = data.top_topics || data.trending_topics_list || (Array.isArray(data.topics) ? data.topics : null);
  const topEntitiesRaw = data.top_entities || data.most_mentioned_entities || (Array.isArray(data.entities) ? data.entities : null);

  return {
    totalPosts,
    totalEngagement,
    trendingTopicsCount,
    uniqueEntitiesCount,
    positiveCount,
    negativeCount,
    neutralCount,
    positiveShare,
    negativeShare,
    neutralShare,
    avgConfidence: Number(data.avg_confidence ?? kpi.avg_confidence ?? sd.avg_confidence ?? 0),
    dominantSentiment,
    topPositiveTopic: data.top_positive_topic || data.peak_topic || data.top_topic,
    topNegativeTopic: data.top_negative_topic,
    topNeutralTopic: data.top_neutral_topic || data.top_topic,
    dominantTopic: data.dominant_topic || data.top_topic || data.main_topic,
    narrativeSummary: data.narrative_summary || data.summary || data.description,
    peakDateStr: data.peak_date || data.peak_date_str,
    platformDistribution,
    keyInsights: Array.isArray(data.key_insights || data.insights) ? (data.key_insights || data.insights) : undefined,
    topTopics: Array.isArray(topTopicsRaw) ? topTopicsRaw.map(normalizeTopicRecord) : undefined,
    topEntities: Array.isArray(topEntitiesRaw) ? topEntitiesRaw.map(normalizeEntityRecord) : undefined,
    postsGrowth:
      data.posts_growth !== undefined && data.posts_growth !== null
        ? Number(data.posts_growth)
        : kpi.posts_growth !== undefined && kpi.posts_growth !== null
        ? Number(kpi.posts_growth)
        : undefined,
    engagementGrowth:
      data.engagement_growth !== undefined && data.engagement_growth !== null
        ? Number(data.engagement_growth)
        : kpi.engagement_growth !== undefined && kpi.engagement_growth !== null
        ? Number(kpi.engagement_growth)
        : undefined
  };
}

/**
 * Kontrak Tambahan: Platform Distribution Gabungan (Instagram vs X)
 * Mengambil proporsi riil gabungan seluruh platform dari database PostgreSQL.
 */
export async function fetchCombinedPlatformDistributionFromApi(params?: {
  timeFilter?: string;
}): Promise<PlatformDistribution | null> {
  const timeFilter = params?.timeFilter || 'all';

  // 1. Coba request sentiment distribution / overview global tanpa filter platform
  try {
    const qs = buildTimeAndPlatformQuery({ timeFilter });
    const distRes = await fetch(`${API_BASE_URL}/sentiment/distribution${qs}`, {
      method: 'GET',
      headers: getAuthHeaders()
    });

    if (distRes.ok) {
      const distRaw = await distRes.json().catch(() => null);
      const sd = distRaw?.data || distRaw || {};
      const rawPlat = sd.platform_distribution || sd.platforms || sd.by_platform;

      if (rawPlat) {
        let igPosts = 0;
        let xPosts = 0;
        let igPerc: number | undefined;
        let xPerc: number | undefined;

        if (Array.isArray(rawPlat)) {
          rawPlat.forEach((p: any) => {
            const name = String(p.platform || p.name || '').toLowerCase();
            const count = Number(p.count ?? p.posts ?? p.total ?? 0);
            if (name === 'instagram' || name === 'ig') {
              igPosts += count;
              if (p.percentage !== undefined) igPerc = Number(p.percentage);
            } else if (name === 'twitter' || name === 'x') {
              xPosts += count;
              if (p.percentage !== undefined) xPerc = Number(p.percentage);
            }
          });
        } else if (typeof rawPlat === 'object') {
          const igObj = rawPlat.instagram ?? rawPlat.Instagram ?? rawPlat.ig;
          const xObj = rawPlat.x ?? rawPlat.X ?? rawPlat.twitter ?? rawPlat.Twitter;
          igPosts = typeof igObj === 'number' ? igObj : Number(igObj?.posts ?? igObj?.count ?? 0);
          xPosts = typeof xObj === 'number' ? xObj : Number(xObj?.posts ?? xObj?.count ?? 0);
          if (typeof igObj === 'object' && igObj?.percentage !== undefined) igPerc = Number(igObj.percentage);
          if (typeof xObj === 'object' && xObj?.percentage !== undefined) xPerc = Number(xObj.percentage);
        }

        const totalP = igPosts + xPosts;
        if (totalP > 0) {
          const finalIgPerc = igPerc !== undefined ? Math.round(igPerc) : Math.round((igPosts / totalP) * 100);
          const finalXPerc = xPerc !== undefined ? Math.round(xPerc) : Math.max(0, 100 - finalIgPerc);
          return {
            instagram: { percentage: finalIgPerc, posts: igPosts },
            x: { percentage: finalXPerc, posts: xPosts }
          };
        }
      }
    }
  } catch {
    // lanjut ke fallback
  }

  // 2. Fallback: Ambil overview Instagram dan X secara paralel langsung dari FastAPI
  try {
    const [igRes, xRes] = await Promise.allSettled([
      fetchDashboardOverviewFromApi({ platform: 'instagram', timeFilter }),
      fetchDashboardOverviewFromApi({ platform: 'x', timeFilter })
    ]);

    const igData = igRes.status === 'fulfilled' ? igRes.value : null;
    const xData = xRes.status === 'fulfilled' ? xRes.value : null;

    const igPosts = igData?.totalPosts || 0;
    const xPosts = xData?.totalPosts || 0;
    const totalP = igPosts + xPosts;

    if (totalP > 0) {
      const igPerc = Math.round((igPosts / totalP) * 100);
      const xPerc = Math.max(0, 100 - igPerc);
      return {
        instagram: { percentage: igPerc, posts: igPosts },
        x: { percentage: xPerc, posts: xPosts }
      };
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * Kontrak 2: Grafik Line Sentimen
 * GET /api/sentiment/timeline?platform=instagram&time_filter=all
 */
export async function fetchSentimentTimelineFromApi(params?: {
  platform?: string;
  timeFilter?: string;
}): Promise<TimelinePoint[]> {
  const qs = buildTimeAndPlatformQuery({
    platform: params?.platform,
    timeFilter: params?.timeFilter || 'all'
  });

  const endpoints = [
    `${API_BASE_URL}/sentiment/timeline${qs}`,
    `${API_BASE_URL}/dashboard/timeline${qs}`
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      if (!res.ok) continue;

      const payload = await res.json();
      const rawList = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.timeline)
        ? payload.timeline
        : Array.isArray(payload?.items)
        ? payload.items
        : null;

      if (rawList && rawList.length > 0) {
        return rawList.map((row: any) => {
          const rawDate = row.date || row.day || row.timestamp || row.posted_at;
          const parsedDate = rawDate ? new Date(rawDate) : null;
          const isValidDate = parsedDate && !isNaN(parsedDate.getTime()) && String(rawDate).includes('-');
          const formattedDate = isValidDate
            ? `${String(parsedDate.getDate()).padStart(2, '0')} ${parsedDate.toLocaleString('default', { month: 'short' })}`
            : String(rawDate || '');

          return {
            date: formattedDate,
            positive: Number(row.positive ?? row.positive_count ?? 0),
            neutral: Number(row.neutral ?? row.neutral_count ?? 0),
            negative: Number(row.negative ?? row.negative_count ?? 0),
            timestamp: isValidDate ? parsedDate.getTime() : undefined,
            topPositiveTopic: row.top_positive_topic || row.top_topic || row.peak_topic || undefined,
            topNegativeTopic: row.top_negative_topic || undefined,
            topNeutralTopic: row.top_neutral_topic || undefined
          };
        });
      }
    } catch {
      // Lanjut ke kandidat endpoint berikutnya
    }
  }

  return [];
}

/**
 * Kontrak 4: Top 4 Entitas
 * GET /api/entities?limit=4
 */
export async function fetchEntitiesFromApi(params?: {
  platform?: string;
  timeFilter?: string;
  date?: string | null;
  limit?: number;
}): Promise<EntityItem[]> {
  const limit = params?.limit ?? 4;
  const queryWithFilter = buildTimeAndPlatformQuery({
    platform: params?.platform,
    timeFilter: params?.timeFilter,
    date: params?.date,
    limit
  });

  const endpoints = [
    `${API_BASE_URL}/entities?limit=${limit}`,
    `${API_BASE_URL}/entities${queryWithFilter}`,
    `${API_BASE_URL}/graph/nodes?limit=${limit}`
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      if (!res.ok) continue;

      const payload = await res.json();
      const rawList = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.entities)
        ? payload.entities
        : Array.isArray(payload?.nodes)
        ? payload.nodes
        : Array.isArray(payload?.items)
        ? payload.items
        : null;

      if (rawList && rawList.length > 0) {
        const filtered = rawList.filter((item: any) => {
          const d = item.data ? item.data : item;
          const t = String(d.type || d.entity_type || '').toLowerCase();
          return t !== 'topic';
        });
        const listToUse: any[] = filtered.length > 0 ? filtered : rawList;
        return listToUse
          .map((row: any, i: number) => normalizeEntityRecord(row, i))
          .sort((a: EntityItem, b: EntityItem) => b.mentionCount - a.mentionCount)
          .slice(0, limit)
          .map((item: EntityItem, idx: number) => ({ ...item, rank: idx + 1 }));
      }
    } catch {
      // Lanjut ke kandidat endpoint berikutnya
    }
  }

  return [];
}

/**
 * Top Topics Driving Conversation
 * GET /api/topics
 */
export async function fetchTopicsFromApi(params?: {
  platform?: string;
  timeFilter?: string;
  date?: string | null;
  limit?: number;
}): Promise<TopicItem[]> {
  const limit = params?.limit ?? 4;
  const qs = buildTimeAndPlatformQuery({
    platform: params?.platform,
    timeFilter: params?.timeFilter || 'all',
    date: params?.date,
    limit
  });

  const endpoints = [
    `${API_BASE_URL}/topics${qs}`,
    `${API_BASE_URL}/topics?limit=${limit}`
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      if (!res.ok) continue;

      const payload = await res.json();
      const list = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.topics)
        ? payload.topics
        : Array.isArray(payload?.items)
        ? payload.items
        : null;

      if (list && list.length > 0) {
        return list.slice(0, limit).map(normalizeTopicRecord);
      }
    } catch {
      // Lanjut ke kandidat berikutnya
    }
  }

  return [];
}

/**
 * Kontrak 5: Daftar Postingan
 * GET /api/sentiment/posts?limit=50&time_filter=all
 */
export async function fetchPostsFromApi(params?: {
  platform?: string;
  timeFilter?: string;
  limit?: number;
}): Promise<SocialPost[]> {
  const qs = buildTimeAndPlatformQuery({
    platform: params?.platform,
    timeFilter: params?.timeFilter || 'all',
    limit: params?.limit ?? 50
  });

  const candidateEndpoints = [
    `${API_BASE_URL}/sentiment/posts${qs}`,
    `${API_BASE_URL}/posts${qs}`
  ];

  let lastError: Error | null = null;

  for (const endpoint of candidateEndpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        lastError = new Error(`HTTP ${response.status} pada ${endpoint}`);
        continue;
      }

      const payload = await response.json();
      const rawList = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.posts)
        ? payload.posts
        : Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload?.results)
        ? payload.results
        : null;

      if (rawList) {
        return rawList.map(normalizePostRecord);
      }
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError || new Error('Gagal mengambil data posts dari FastAPI');
}

export function buildMbgFallbackGraph(): { nodes: any[]; edges: any[] } {
  const nodes: any[] = [];
  const edges: any[] = [];
  const nodeIds = new Set<string>();

  (mbgGraphFallback.topics || []).forEach((tName: string) => {
    const id = `topic_${tName}`;
    nodeIds.add(id);
    nodes.push({
      data: {
        id,
        label: tName,
        type: 'topic',
        weight: 40
      }
    });
  });

  (mbgGraphFallback.entities || []).forEach((ent: any) => {
    const eName = String(ent.name).trim();
    const id = `entity_${eName}`;
    const tName = String(ent.topic || '').trim();
    const tId = `topic_${tName}`;
    nodeIds.add(id);
    nodes.push({
      data: {
        id,
        label: eName,
        type: normalizeEntityType(ent.type),
        weight: Number(ent.mention_count || 1),
        topic: tName
      }
    });

    if (tName && nodeIds.has(tId)) {
      edges.push({
        data: {
          id: `rel_bt_${eName}_${tName}`,
          source: id,
          target: tId,
          sourceName: eName,
          targetName: tName,
          type: 'BELONGS_TO_TOPIC',
          label: 'BELONGS_TO_TOPIC',
          weight: 1,
          style: 'dashed'
        }
      });
    }
  });

  (mbgGraphFallback.co_occurs || []).forEach((co: any, idx: number) => {
    const sName = String(co.source).trim();
    const tName = String(co.target).trim();
    const sId = `entity_${sName}`;
    const tId = `entity_${tName}`;
    const npmi = Number(co.weight || 0.5);
    const cooccur = Number(co.cooccur || 3);
    const pmi = Number(co.pmi || 0);
    if (nodeIds.has(sId) && nodeIds.has(tId)) {
      edges.push({
        data: {
          id: `rel_co_${sName}_${tName}_${idx}`,
          source: sId,
          target: tId,
          sourceName: sName,
          targetName: tName,
          type: 'CO_OCCURS_WITH',
          label: `NPMI ${npmi.toFixed(2)}`,
          weight: npmi,
          npmi,
          cooccur,
          pmi,
          style: 'solid'
        }
      });
    }
  });

  return { nodes, edges };
}

/**
 * Kontrak 6: Knowledge Graph
 * GET /api/graph/data?platform=instagram&min_freq=0
 */
export async function fetchKnowledgeGraphFromApi(params?: {
  platform?: string;
  timeFilter?: string;
  entityType?: string;
  minFreq?: string | number;
  topic?: string | null;
}): Promise<{ nodes: any[]; edges: any[] } | null> {
  try {
    const qs = buildTimeAndPlatformQuery({
      platform: params?.platform,
      timeFilter: params?.timeFilter,
      minFreq: params?.minFreq ?? 0,
      entityType: params?.entityType,
      topic: params?.topic
    });

    const response = await fetch(`${API_BASE_URL}/graph/data${qs}`, {
      method: 'GET',
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      return buildMbgFallbackGraph();
    }

    const payload = await response.json();
    const rawNodes = payload?.nodes || payload?.data?.nodes || payload?.elements?.nodes;
    const rawEdges =
      payload?.edges || payload?.data?.edges || payload?.links || payload?.data?.links || payload?.elements?.edges;

    if (!Array.isArray(rawNodes) || !Array.isArray(rawEdges) || rawNodes.length === 0) {
      return buildMbgFallbackGraph();
    }

    const nodes = rawNodes.map((n: any) => {
      const d = n.data ? n.data : n;
      const rawType = String(d.type || d.group || d.category || 'Topic');
      const normType = rawType.toLowerCase() === 'topic' ? 'topic' : normalizeEntityType(rawType);
      return {
        data: {
          id: String(d.id ?? d.name ?? d.label),
          label: String(d.label ?? d.name ?? d.id),
          type: normType,
          weight: Number(d.weight ?? d.mention_count ?? d.post_count ?? d.count ?? d.size ?? 10),
          topic: d.topic ? String(d.topic) : undefined
        }
      };
    });

    const edges = rawEdges.map((e: any, idx: number) => {
      const d = e.data ? e.data : e;
      const rawEdgeType = String(d.type || d.relationship || d.label || 'CO_OCCURS_WITH');
      const isTopicEdge = rawEdgeType.includes('BELONGS_TO') || rawEdgeType.includes('TOPIC') || d.style === 'dashed';
      const edgeType = isTopicEdge ? 'BELONGS_TO_TOPIC' : 'CO_OCCURS_WITH';
      const rawWeight = Number(d.npmi ?? d.weight ?? d.value ?? 1);
      // Normalize weight if backend multiplied NPMI by 10
      const npmiVal = !isTopicEdge && rawWeight > 1.5 ? Number((rawWeight / 10).toFixed(4)) : rawWeight;
      const cooccurVal = Number(d.cooccur ?? d.value ?? 3);
      const pmiVal = Number(d.pmi ?? 0);
      const srcStr = String(d.source ?? d.from);
      const tgtStr = String(d.target ?? d.to);
      return {
        data: {
          id: String(d.id ?? `edge_${srcStr}_${tgtStr}_${idx}`),
          source: srcStr,
          target: tgtStr,
          sourceName: String(d.source_name ?? srcStr.replace(/^(entity_|topic_)/, '')),
          targetName: String(d.target_name ?? tgtStr.replace(/^(entity_|topic_)/, '')),
          type: edgeType,
          label: isTopicEdge ? 'BELONGS_TO_TOPIC' : `NPMI ${npmiVal.toFixed(2)}`,
          weight: isTopicEdge ? 1 : npmiVal,
          npmi: isTopicEdge ? undefined : npmiVal,
          cooccur: isTopicEdge ? undefined : cooccurVal,
          pmi: isTopicEdge ? undefined : pmiVal,
          style: isTopicEdge ? 'dashed' : 'solid'
        }
      };
    });

    // Jika backend lama belum mengembalikan edge CO_OCCURS_WITH, lengkapi otomatis dari dataset MBG resmi
    const hasCoOccurs = edges.some((e: any) => e.data.type === 'CO_OCCURS_WITH');
    if (!hasCoOccurs) {
      const validIds = new Set(nodes.map((n: any) => String(n.data.id)));
      (mbgGraphFallback.co_occurs || []).forEach((co: any, idx: number) => {
        const sName = String(co.source).trim();
        const tName = String(co.target).trim();
        const sId = `entity_${sName}`;
        const tId = `entity_${tName}`;
        const npmi = Number(co.weight || 0.5);
        if (validIds.has(sId) && validIds.has(tId)) {
          edges.push({
            data: {
              id: `rel_co_fallback_${sName}_${tName}_${idx}`,
              source: sId,
              target: tId,
              sourceName: sName,
              targetName: tName,
              type: 'CO_OCCURS_WITH',
              label: `NPMI ${npmi.toFixed(2)}`,
              weight: npmi,
              npmi,
              cooccur: Number(co.cooccur || 3),
              pmi: Number(co.pmi || 0),
              style: 'solid'
            }
          });
        }
      });
    }

    return { nodes, edges };
  } catch {
    return buildMbgFallbackGraph();
  }
}

/**
 * Autentikasi Login ke PostgreSQL via FastAPI (`POST /api/auth/login`)
 */
export async function loginWithFastApi(emailOrUsername: string, password: string) {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({
      username: emailOrUsername,
      email: emailOrUsername,
      password
    })
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody?.detail || errBody?.message || 'Email/username atau kata sandi salah.');
  }

  const data = await response.json();
  if (data?.access_token || data?.token) {
    localStorage.setItem('access_token', data.access_token || data.token);
  }
  return data;
}

/**
 * Logout dari sesi FastAPI (`POST /api/auth/logout`)
 */
export async function logoutFromFastApi() {
  try {
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
  } catch {
    // Abaikan jika jaringan terputus saat logout
  } finally {
    localStorage.removeItem('access_token');
  }
}
