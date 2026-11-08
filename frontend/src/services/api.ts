import mbgGraphFallback from './mbgGraphFallback.json';

const rawBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api').replace(/\/+$/, '');
export const API_BASE_URL = rawBaseUrl.endsWith('/api') ? rawBaseUrl : `${rawBaseUrl}/api`;

const DEFAULT_POST_LIMIT = 50;
const DEFAULT_TOP_ITEMS_LIMIT = 4;
const TOPIC_NODE_DEFAULT_WEIGHT = 40;
const PERCENTAGE_MULTIPLIER = 100;

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

export async function fetchDashboardOverviewFromApi(params?: {
  platform?: string;
  timeFilter?: string;
  date?: string | null;
}): Promise<DashboardOverviewData | null> {
  const queryString = buildTimeAndPlatformQuery({
    platform: params?.platform,
    timeFilter: params?.timeFilter || 'all',
    date: params?.date,
  });

  const [overviewResult, distributionResult] = await Promise.allSettled([
    fetch(`${API_BASE_URL}/dashboard/overview${queryString}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    }),
    fetch(`${API_BASE_URL}/sentiment/distribution${queryString}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    }),
  ]);

  const overviewRaw = await extractSettledJson(overviewResult);
  const distributionRaw = await extractSettledJson(distributionResult);

  if (!overviewRaw && !distributionRaw) {
    return null;
  }

  return buildDashboardOverviewData(overviewRaw, distributionRaw, params?.platform);
}

export async function fetchCombinedPlatformDistributionFromApi(params?: {
  timeFilter?: string;
}): Promise<PlatformDistribution | null> {
  const timeFilterValue = params?.timeFilter || 'all';

  const directDistribution = await fetchGlobalPlatformDistribution(timeFilterValue);
  if (directDistribution) {
    return directDistribution;
  }

  return await fetchParallelPlatformDistribution(timeFilterValue);
}

export async function fetchSentimentTimelineFromApi(params?: {
  platform?: string;
  timeFilter?: string;
}): Promise<TimelinePoint[]> {
  const queryString = buildTimeAndPlatformQuery({
    platform: params?.platform,
    timeFilter: params?.timeFilter || 'all',
  });

  const candidateEndpoints = [
    `${API_BASE_URL}/sentiment/timeline${queryString}`,
    `${API_BASE_URL}/dashboard/timeline${queryString}`,
  ];

  const payload = await fetchFirstAvailableJson(candidateEndpoints);
  const rawList = extractListFromPayload(payload, ['data', 'timeline', 'items']);
  if (!rawList || rawList.length === 0) {
    return [];
  }

  return rawList.map(mapRawRowToTimelinePoint);
}

export async function fetchEntitiesFromApi(params?: {
  platform?: string;
  timeFilter?: string;
  date?: string | null;
  limit?: number;
}): Promise<EntityItem[]> {
  const itemLimit = params?.limit ?? DEFAULT_TOP_ITEMS_LIMIT;
  const queryString = buildTimeAndPlatformQuery({
    platform: params?.platform,
    timeFilter: params?.timeFilter,
    date: params?.date,
    limit: itemLimit,
  });

  const candidateEndpoints = [
    `${API_BASE_URL}/entities?limit=${itemLimit}`,
    `${API_BASE_URL}/entities${queryString}`,
    `${API_BASE_URL}/graph/nodes?limit=${itemLimit}`,
  ];

  const payload = await fetchFirstAvailableJson(candidateEndpoints);
  const rawList = extractListFromPayload(payload, ['data', 'entities', 'nodes', 'items']);
  if (!rawList || rawList.length === 0) {
    return [];
  }

  const nonTopicRows = rawList.filter((item: any) => {
    const recordData = item.data ? item.data : item;
    const rawType = String(recordData.type || recordData.entity_type || '').toLowerCase();
    return rawType !== 'topic';
  });

  const rowsToNormalize = nonTopicRows.length > 0 ? nonTopicRows : rawList;
  return rowsToNormalize
    .map((row: any, index: number) => normalizeEntityRecord(row, index))
    .sort((first: EntityItem, second: EntityItem) => second.mentionCount - first.mentionCount)
    .slice(0, itemLimit)
    .map((item: EntityItem, index: number) => ({ ...item, rank: index + 1 }));
}

export async function fetchTopicsFromApi(params?: {
  platform?: string;
  timeFilter?: string;
  date?: string | null;
  limit?: number;
}): Promise<TopicItem[]> {
  const itemLimit = params?.limit ?? DEFAULT_TOP_ITEMS_LIMIT;
  const queryString = buildTimeAndPlatformQuery({
    platform: params?.platform,
    timeFilter: params?.timeFilter || 'all',
    date: params?.date,
    limit: itemLimit,
  });

  const candidateEndpoints = [
    `${API_BASE_URL}/topics${queryString}`,
    `${API_BASE_URL}/topics?limit=${itemLimit}`,
  ];

  const payload = await fetchFirstAvailableJson(candidateEndpoints);
  const rawList = extractListFromPayload(payload, ['data', 'topics', 'items']);
  if (!rawList || rawList.length === 0) {
    return [];
  }

  return rawList.slice(0, itemLimit).map(normalizeTopicRecord);
}

export async function fetchPostsFromApi(params?: {
  platform?: string;
  timeFilter?: string;
  limit?: number;
}): Promise<SocialPost[]> {
  const queryString = buildTimeAndPlatformQuery({
    platform: params?.platform,
    timeFilter: params?.timeFilter || 'all',
    limit: params?.limit ?? DEFAULT_POST_LIMIT,
  });

  const candidateEndpoints = [
    `${API_BASE_URL}/sentiment/posts${queryString}`,
    `${API_BASE_URL}/posts${queryString}`,
  ];

  let lastError: Error | null = null;

  for (const endpointUrl of candidateEndpoints) {
    try {
      const response = await fetch(endpointUrl, {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        lastError = new Error(`HTTP ${response.status} pada ${endpointUrl}`);
        continue;
      }

      const payload = await response.json();
      const rawList = extractListFromPayload(payload, ['data', 'posts', 'items', 'results']);
      if (rawList) {
        return rawList.map(normalizePostRecord);
      }
    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError || new Error('Gagal mengambil data posts dari FastAPI');
}

export async function fetchKnowledgeGraphFromApi(params?: {
  platform?: string;
  timeFilter?: string;
  entityType?: string;
  minFreq?: string | number;
  topic?: string | null;
}): Promise<{ nodes: any[]; edges: any[] } | null> {
  try {
    const queryString = buildTimeAndPlatformQuery({
      platform: params?.platform,
      timeFilter: params?.timeFilter,
      minFreq: params?.minFreq ?? 0,
      entityType: params?.entityType,
      topic: params?.topic,
    });

    const response = await fetch(`${API_BASE_URL}/graph/data${queryString}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      return buildMbgFallbackGraph();
    }

    const payload = await response.json();
    return parseLiveGraphPayload(payload);
  } catch {
    return buildMbgFallbackGraph();
  }
}

export function buildMbgFallbackGraph(): { nodes: any[]; edges: any[] } {
  const nodes: any[] = [];
  const edges: any[] = [];
  const nodeIds = new Set<string>();

  (mbgGraphFallback.topics || []).forEach((topicName: string) => {
    const topicNodeId = `topic_${topicName}`;
    nodeIds.add(topicNodeId);
    nodes.push({
      data: {
        id: topicNodeId,
        label: topicName,
        type: 'topic',
        weight: TOPIC_NODE_DEFAULT_WEIGHT,
      },
    });
  });

  (mbgGraphFallback.entities || []).forEach((entityItem: any) => {
    const entityName = String(entityItem.name).trim();
    const entityNodeId = `entity_${entityName}`;
    const topicName = String(entityItem.topic || '').trim();
    const topicNodeId = `topic_${topicName}`;

    nodeIds.add(entityNodeId);
    nodes.push({
      data: {
        id: entityNodeId,
        label: entityName,
        type: normalizeEntityType(entityItem.type),
        weight: Number(entityItem.mention_count || 1),
        topic: topicName,
      },
    });

    if (topicName && nodeIds.has(topicNodeId)) {
      edges.push(createBelongsToTopicCytoscapeEdge(entityName, topicName, entityNodeId, topicNodeId));
    }
  });

  appendCoOccurrenceFallbackEdges(edges, nodeIds);
  return { nodes, edges };
}

export async function loginWithFastApi(emailOrUsername: string, password: string) {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      username: emailOrUsername,
      email: emailOrUsername,
      password,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody?.detail || errorBody?.message || 'Email/username atau kata sandi salah.');
  }

  const responseData = await response.json();
  if (responseData?.access_token || responseData?.token) {
    localStorage.setItem('access_token', responseData.access_token || responseData.token);
  }
  return responseData;
}

export async function logoutFromFastApi() {
  try {
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
  } catch {
    // Ignore network errors during logout cleanup
  } finally {
    localStorage.removeItem('access_token');
  }
}

export function normalizeEntityType(type?: string): string {
  if (!type) {
    return 'topic';
  }
  const lowerType = type.toLowerCase().trim();
  if (lowerType === 'person' || lowerType === 'per') {
    return 'person';
  }
  if (lowerType === 'organization' || lowerType === 'org') {
    return 'organization';
  }
  if (lowerType === 'geopolitical' || lowerType === 'gpe') {
    return 'geopolitical';
  }
  if (lowerType === 'location' || lowerType === 'loc') {
    return 'location';
  }
  if (lowerType === 'product' || lowerType === 'prd') {
    return 'product';
  }
  if (lowerType === 'event' || lowerType === 'evt') {
    return 'event';
  }
  if (lowerType === 'norm' || lowerType === 'nor') {
    return 'norm';
  }
  if (lowerType === 'facility' || lowerType === 'fac') {
    return 'facility';
  }
  if (lowerType === 'topic') {
    return 'topic';
  }
  return lowerType;
}

export function normalizePlatform(platform?: string): string {
  if (!platform) {
    return 'instagram';
  }
  const lowerPlatform = platform.toLowerCase();
  if (lowerPlatform === 'twitter' || lowerPlatform === 'x') {
    return 'x';
  }
  if (lowerPlatform === 'instagram' || lowerPlatform === 'ig') {
    return 'instagram';
  }
  if (lowerPlatform === 'tiktok') {
    return 'tiktok';
  }
  return lowerPlatform;
}

export function buildTimeAndPlatformQuery(params?: {
  platform?: string;
  timeFilter?: string;
  limit?: number;
  minFreq?: string | number;
  entityType?: string;
  topic?: string | null;
  date?: string | null;
}): string {
  const queryParams = new URLSearchParams();

  if (params?.platform && params.platform !== 'all') {
    queryParams.set('platform', params.platform.toLowerCase());
  }

  if (params?.timeFilter) {
    const timeFilterValue = params.timeFilter;
    if (timeFilterValue === 'last7' || timeFilterValue === '7_hari') {
      queryParams.set('days', '7');
      queryParams.set('time_filter', 'last7');
    } else if (timeFilterValue === 'last14' || timeFilterValue === '14_hari') {
      queryParams.set('days', '14');
      queryParams.set('time_filter', 'last14');
    } else if (timeFilterValue === 'last30' || timeFilterValue === '30_hari') {
      queryParams.set('days', '30');
      queryParams.set('time_filter', 'last30');
    } else {
      queryParams.set('time_filter', 'all');
    }
  }

  if (params?.limit !== undefined) {
    queryParams.set('limit', String(params.limit));
  }
  if (params?.minFreq !== undefined) {
    queryParams.set('min_freq', String(params.minFreq));
  }
  if (params?.entityType && params.entityType !== 'All') {
    queryParams.set('entity_type', params.entityType.toLowerCase());
  }
  if (params?.topic) {
    queryParams.set('topic', params.topic);
  }
  if (params?.date) {
    queryParams.set('date', params.date);
  }

  const serializedQuery = queryParams.toString();
  return serializedQuery ? `?${serializedQuery}` : '';
}

export function normalizePostRecord(row: any): SocialPost {
  const rawEntities = Array.isArray(row.entities) ? row.entities : [];
  const normalizedEntities = rawEntities
    .map((entityEntry: any) => {
      if (typeof entityEntry === 'string') {
        return { name: entityEntry, type: 'Topic' };
      }
      return {
        name: entityEntry.name || entityEntry.entity_name || '',
        type: normalizeEntityType(entityEntry.type || entityEntry.entity_type),
      };
    })
    .filter((entityEntry: any) => Boolean(entityEntry.name));

  if (Array.isArray(row.hashtags)) {
    const existingEntityNames = new Set(
      normalizedEntities.map((entityEntry: any) => entityEntry.name.toLowerCase())
    );
    row.hashtags.forEach((hashtag: string) => {
      const cleanHashtag = String(hashtag).replace(/^#/, '').trim();
      if (cleanHashtag && !existingEntityNames.has(cleanHashtag.toLowerCase())) {
        existingEntityNames.add(cleanHashtag.toLowerCase());
        normalizedEntities.push({ name: cleanHashtag, type: 'Topic' });
      }
    });
  }

  const engagement = {
    likes: Number(row.engagement?.likes ?? row.likes ?? row.like_count ?? 0),
    shares: Number(
      row.engagement?.shares ??
        row.shares ??
        row.retweets ??
        row.reposts ??
        row.retweet_count ??
        0
    ),
    comments: Number(
      row.engagement?.comments ?? row.comments ?? row.replies ?? row.reply_count ?? 0
    ),
    views: Number(
      row.engagement?.views ?? row.views ?? row.impressions ?? row.view_count ?? 0
    ),
  };

  const topicName =
    (typeof row.topic === 'object' && row.topic !== null ? row.topic.name : row.topic) ||
    row.topic_name ||
    row.topic_label ||
    (row.topic_id ? `Topik #${row.topic_id}` : '');

  const rawSentiment = String(row.sentiment || 'neutral').toLowerCase();
  let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';
  if (rawSentiment === 'positive' || rawSentiment === 'positif') {
    sentiment = 'positive';
  } else if (rawSentiment === 'negative' || rawSentiment === 'negatif') {
    sentiment = 'negative';
  }

  return {
    id: row.id ?? row.platform_post_id ?? Math.random().toString(36).slice(2),
    platform: normalizePlatform(row.platform),
    user_id:
      row.author_username ||
      row.user_id ||
      row.username ||
      row.screen_name ||
      row.author ||
      '@anonymous',
    topic: String(topicName),
    topic_id: row.topic_id,
    content: String(row.content || row.text || row.full_text || ''),
    sentiment,
    sentiment_score:
      row.sentiment_score !== undefined ? Number(row.sentiment_score) : undefined,
    entities: normalizedEntities,
    engagement,
    hashtags: Array.isArray(row.hashtags) ? row.hashtags : undefined,
    timestamp:
      row.posted_at ||
      row.timestamp ||
      row.scraped_at ||
      row.created_at ||
      new Date().toISOString(),
  };
}

export function normalizeTopicRecord(row: any, index: number): TopicItem {
  const postCount = Number(
    row.post_count ?? row.count ?? row.total_posts ?? row.posts_count ?? row.mentions ?? 0
  );
  const rawGrowth = row.growth ?? row.growth_rate ?? row.percentage_change ?? row.share;
  const growthLabel =
    rawGrowth !== undefined && rawGrowth !== null
      ? typeof rawGrowth === 'number'
        ? `${rawGrowth >= 0 ? '+' : ''}${rawGrowth.toFixed(1)}%`
        : String(rawGrowth)
      : `${postCount.toLocaleString('id-ID')} post`;

  return {
    id: row.id ?? row.topic_id ?? index + 1,
    rank: Number(row.rank ?? index + 1),
    title: String(row.name ?? row.title ?? row.topic ?? row.label ?? `Topik #${index + 1}`),
    postCount,
    posts:
      typeof row.posts === 'string'
        ? row.posts
        : `${postCount.toLocaleString('id-ID')} postingan`,
    growth: growthLabel,
    sentiment: row.sentiment || row.dominant_sentiment,
  };
}

export function normalizeEntityRecord(row: any, index: number): EntityItem {
  const recordData = row.data ? row.data : row;
  const mentionCount = Number(
    recordData.mention_count ??
      recordData.mentions_count ??
      recordData.count ??
      recordData.weight ??
      recordData.mentions ??
      0
  );

  return {
    id: recordData.id ?? recordData.entity_id ?? index + 1,
    rank: Number(recordData.rank ?? index + 1),
    name: String(
      recordData.name ?? recordData.label ?? recordData.entity_name ?? `Entitas #${index + 1}`
    ),
    type: normalizeEntityType(recordData.type ?? recordData.entity_type ?? recordData.group),
    mentionCount,
    mentions:
      typeof recordData.mentions === 'string'
        ? recordData.mentions
        : `${mentionCount.toLocaleString('id-ID')} sebutan`,
  };
}

function buildDashboardOverviewData(
  overviewRaw: any,
  distributionRaw: any,
  activePlatform?: string
): DashboardOverviewData {
  const overviewData =
    overviewRaw?.data && !overviewRaw?.total_posts && !overviewRaw?.kpi
      ? overviewRaw.data
      : overviewRaw || {};
  const kpiData = overviewData.kpi || {};
  const sentimentData =
    distributionRaw?.data && !distributionRaw?.positive && !distributionRaw?.neutral_share
      ? distributionRaw.data
      : distributionRaw || {};

  const totalPosts = Number(
    overviewData.total_posts ?? kpiData.total_posts ?? sentimentData.total_posts ?? 0
  );
  const totalEngagement = Number(
    overviewData.total_engagement ?? kpiData.total_engagement ?? 0
  );
  const uniqueEntitiesCount = Number(
    overviewData.unique_entities ??
      kpiData.unique_entities ??
      overviewData.unique_entities_count ??
      kpiData.unique_entities_count ??
      0
  );
  const trendingTopicsCount = Number(
    overviewData.trending_topics ??
      kpiData.trending_topics ??
      overviewData.trending_topics_count ??
      kpiData.trending_topics_count ??
      0
  );

  const sentimentSummary = extractSentimentCountsAndShares(overviewData, kpiData, sentimentData);
  const dominantSentiment = resolveDominantSentimentLabel(
    overviewData,
    sentimentData,
    sentimentSummary
  );

  const rawPlatformDistribution =
    overviewData.platform_distribution ||
    overviewData.platforms ||
    kpiData.platform_distribution ||
    sentimentData.platform_distribution ||
    sentimentData.platforms ||
    sentimentData.by_platform;

  const platformDistribution = parsePlatformDistributionPayload(
    rawPlatformDistribution,
    totalPosts,
    activePlatform
  );

  const topTopicsRaw =
    overviewData.top_topics ||
    overviewData.trending_topics_list ||
    (Array.isArray(overviewData.topics) ? overviewData.topics : null);
  const topEntitiesRaw =
    overviewData.top_entities ||
    overviewData.most_mentioned_entities ||
    (Array.isArray(overviewData.entities) ? overviewData.entities : null);

  return {
    totalPosts,
    totalEngagement,
    trendingTopicsCount,
    uniqueEntitiesCount,
    positiveCount: sentimentSummary.positiveCount,
    negativeCount: sentimentSummary.negativeCount,
    neutralCount: sentimentSummary.neutralCount,
    positiveShare: sentimentSummary.positiveShare,
    negativeShare: sentimentSummary.negativeShare,
    neutralShare: sentimentSummary.neutralShare,
    avgConfidence: Number(
      overviewData.avg_confidence ?? kpiData.avg_confidence ?? sentimentData.avg_confidence ?? 0
    ),
    dominantSentiment,
    topPositiveTopic:
      overviewData.top_positive_topic || overviewData.peak_topic || overviewData.top_topic,
    topNegativeTopic: overviewData.top_negative_topic,
    topNeutralTopic: overviewData.top_neutral_topic || overviewData.top_topic,
    dominantTopic:
      overviewData.dominant_topic || overviewData.top_topic || overviewData.main_topic,
    narrativeSummary:
      overviewData.narrative_summary || overviewData.summary || overviewData.description,
    peakDateStr: overviewData.peak_date || overviewData.peak_date_str,
    platformDistribution,
    keyInsights: Array.isArray(overviewData.key_insights || overviewData.insights)
      ? overviewData.key_insights || overviewData.insights
      : undefined,
    topTopics: Array.isArray(topTopicsRaw) ? topTopicsRaw.map(normalizeTopicRecord) : undefined,
    topEntities: Array.isArray(topEntitiesRaw)
      ? topEntitiesRaw.map(normalizeEntityRecord)
      : undefined,
    postsGrowth:
      overviewData.posts_growth !== undefined && overviewData.posts_growth !== null
        ? Number(overviewData.posts_growth)
        : kpiData.posts_growth !== undefined && kpiData.posts_growth !== null
          ? Number(kpiData.posts_growth)
          : undefined,
    engagementGrowth:
      overviewData.engagement_growth !== undefined && overviewData.engagement_growth !== null
        ? Number(overviewData.engagement_growth)
        : kpiData.engagement_growth !== undefined && kpiData.engagement_growth !== null
          ? Number(kpiData.engagement_growth)
          : undefined,
  };
}

function extractSentimentCountsAndShares(
  overviewData: any,
  kpiData: any,
  sentimentData: any
) {
  const sentimentObject =
    overviewData.sentiment ||
    overviewData.sentiment_distribution ||
    sentimentData.sentiment ||
    sentimentData.distribution ||
    sentimentData;

  const positiveCount = Number(
    overviewData.positive_count ??
      kpiData.positive_count ??
      sentimentObject?.counts?.positive ??
      sentimentObject?.positive?.count ??
      (typeof sentimentObject?.positive === 'number' ? sentimentObject.positive : 0)
  );
  const negativeCount = Number(
    overviewData.negative_count ??
      kpiData.negative_count ??
      sentimentObject?.counts?.negative ??
      sentimentObject?.negative?.count ??
      (typeof sentimentObject?.negative === 'number' ? sentimentObject.negative : 0)
  );
  const neutralCount = Number(
    overviewData.neutral_count ??
      kpiData.neutral_count ??
      sentimentObject?.counts?.neutral ??
      sentimentObject?.neutral?.count ??
      (typeof sentimentObject?.neutral === 'number' ? sentimentObject.neutral : 0)
  );

  const totalSentimentCount = positiveCount + negativeCount + neutralCount;

  const positiveShare = Number(
    overviewData.positive_share ??
      kpiData.positive_share ??
      sentimentData.positive_share ??
      sentimentObject?.percentages?.positive ??
      sentimentObject?.positive?.percentage ??
      sentimentObject?.positive_pct ??
      (totalSentimentCount > 0
        ? ((positiveCount / totalSentimentCount) * PERCENTAGE_MULTIPLIER).toFixed(1)
        : 0)
  );

  const negativeShare = Number(
    overviewData.negative_share ??
      kpiData.negative_share ??
      sentimentData.negative_share ??
      sentimentObject?.percentages?.negative ??
      sentimentObject?.negative?.percentage ??
      sentimentObject?.negative_pct ??
      (totalSentimentCount > 0
        ? ((negativeCount / totalSentimentCount) * PERCENTAGE_MULTIPLIER).toFixed(1)
        : 0)
  );

  const neutralShare = Number(
    overviewData.neutral_share ??
      kpiData.neutral_share ??
      sentimentData.neutral_share ??
      sentimentObject?.percentages?.neutral ??
      sentimentObject?.neutral?.percentage ??
      sentimentObject?.neutral_pct ??
      (totalSentimentCount > 0
        ? ((neutralCount / totalSentimentCount) * PERCENTAGE_MULTIPLIER).toFixed(1)
        : 0)
  );

  return {
    positiveCount,
    negativeCount,
    neutralCount,
    positiveShare,
    negativeShare,
    neutralShare,
  };
}

function resolveDominantSentimentLabel(
  overviewData: any,
  sentimentData: any,
  sentimentSummary: {
    positiveShare: number;
    negativeShare: number;
    neutralShare: number;
  }
): 'positive' | 'negative' | 'neutral' {
  if (overviewData.dominant_sentiment || sentimentData.dominant_sentiment) {
    const rawDominant = String(
      overviewData.dominant_sentiment || sentimentData.dominant_sentiment
    ).toLowerCase();
    if (rawDominant.includes('pos')) {
      return 'positive';
    }
    if (rawDominant.includes('neg')) {
      return 'negative';
    }
    return 'neutral';
  }

  if (
    sentimentSummary.positiveShare > sentimentSummary.neutralShare &&
    sentimentSummary.positiveShare > sentimentSummary.negativeShare
  ) {
    return 'positive';
  }
  if (
    sentimentSummary.negativeShare > sentimentSummary.neutralShare &&
    sentimentSummary.negativeShare > sentimentSummary.positiveShare
  ) {
    return 'negative';
  }
  return 'neutral';
}

function parsePlatformDistributionPayload(
  rawPlatformDistribution: any,
  totalPosts: number,
  activePlatform?: string
): PlatformDistribution | undefined {
  if (rawPlatformDistribution) {
    const extracted = extractPlatformCountsAndPercentages(rawPlatformDistribution);
    const totalPlatformPosts = extracted.instagramPosts + extracted.xPosts;

    const finalInstagramPercentage =
      extracted.instagramPercentage !== undefined
        ? Math.round(extracted.instagramPercentage)
        : totalPlatformPosts > 0
          ? Math.round((extracted.instagramPosts / totalPlatformPosts) * PERCENTAGE_MULTIPLIER)
          : 0;
    const finalXPercentage =
      extracted.xPercentage !== undefined
        ? Math.round(extracted.xPercentage)
        : totalPlatformPosts > 0
          ? Math.max(0, PERCENTAGE_MULTIPLIER - finalInstagramPercentage)
          : 0;

    let resolvedInstagramPosts = extracted.instagramPosts;
    let resolvedXPosts = extracted.xPosts;

    if (
      totalPosts > 0 &&
      (resolvedInstagramPosts + resolvedXPosts < totalPosts ||
        resolvedInstagramPosts + resolvedXPosts <= DEFAULT_POST_LIMIT)
    ) {
      resolvedInstagramPosts = Math.round((finalInstagramPercentage / PERCENTAGE_MULTIPLIER) * totalPosts);
      resolvedXPosts = Math.max(0, totalPosts - resolvedInstagramPosts);
    }

    return {
      instagram: { percentage: finalInstagramPercentage, posts: resolvedInstagramPosts },
      x: { percentage: finalXPercentage, posts: resolvedXPosts },
    };
  }

  if (totalPosts > 0) {
    const isXPlatform =
      activePlatform?.toLowerCase() === 'x' || activePlatform?.toLowerCase() === 'twitter';
    return {
      instagram: {
        percentage: isXPlatform ? 0 : PERCENTAGE_MULTIPLIER,
        posts: isXPlatform ? 0 : totalPosts,
      },
      x: {
        percentage: isXPlatform ? PERCENTAGE_MULTIPLIER : 0,
        posts: isXPlatform ? totalPosts : 0,
      },
    };
  }

  return undefined;
}

function extractPlatformCountsAndPercentages(rawPlatformDistribution: any): {
  instagramPosts: number;
  xPosts: number;
  instagramPercentage?: number;
  xPercentage?: number;
} {
  let instagramPosts = 0;
  let xPosts = 0;
  let instagramPercentage: number | undefined;
  let xPercentage: number | undefined;

  if (Array.isArray(rawPlatformDistribution)) {
    rawPlatformDistribution.forEach((platformRow: any) => {
      const platformName = String(platformRow.platform || platformRow.name || '').toLowerCase();
      const postCount = Number(
        platformRow.count ?? platformRow.posts ?? platformRow.post_count ?? platformRow.total ?? 0
      );
      const percentageValue = platformRow.percentage ?? platformRow.share;

      if (platformName === 'instagram' || platformName === 'ig') {
        instagramPosts += postCount;
        if (percentageValue !== undefined) {
          instagramPercentage = Number(percentageValue);
        }
      } else if (platformName === 'twitter' || platformName === 'x') {
        xPosts += postCount;
        if (percentageValue !== undefined) {
          xPercentage = Number(percentageValue);
        }
      }
    });
  } else if (typeof rawPlatformDistribution === 'object') {
    const instagramEntry =
      rawPlatformDistribution.instagram ??
      rawPlatformDistribution.Instagram ??
      rawPlatformDistribution.ig;
    const xEntry =
      rawPlatformDistribution.x ??
      rawPlatformDistribution.X ??
      rawPlatformDistribution.twitter ??
      rawPlatformDistribution.Twitter;

    instagramPosts =
      typeof instagramEntry === 'number'
        ? instagramEntry
        : Number(
            instagramEntry?.posts ??
              instagramEntry?.count ??
              instagramEntry?.post_count ??
              instagramEntry?.total ??
              0
          );
    xPosts =
      typeof xEntry === 'number'
        ? xEntry
        : Number(
            xEntry?.posts ?? xEntry?.count ?? xEntry?.post_count ?? xEntry?.total ?? 0
          );

    if (
      typeof instagramEntry === 'object' &&
      (instagramEntry?.percentage !== undefined || instagramEntry?.share !== undefined)
    ) {
      instagramPercentage = Number(instagramEntry.percentage ?? instagramEntry.share);
    }
    if (
      typeof xEntry === 'object' &&
      (xEntry?.percentage !== undefined || xEntry?.share !== undefined)
    ) {
      xPercentage = Number(xEntry.percentage ?? xEntry.share);
    }
  }

  return { instagramPosts, xPosts, instagramPercentage, xPercentage };
}

async function fetchGlobalPlatformDistribution(
  timeFilterValue: string
): Promise<PlatformDistribution | null> {
  try {
    const queryString = buildTimeAndPlatformQuery({ timeFilter: timeFilterValue });
    const response = await fetch(`${API_BASE_URL}/sentiment/distribution${queryString}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      return null;
    }

    const distributionRaw = await response.json().catch(() => null);
    const sentimentData = distributionRaw?.data || distributionRaw || {};
    const rawPlatformDistribution =
      sentimentData.platform_distribution ||
      sentimentData.platforms ||
      sentimentData.by_platform;

    if (!rawPlatformDistribution) {
      return null;
    }

    const extracted = extractPlatformCountsAndPercentages(rawPlatformDistribution);
    const totalPlatformPosts = extracted.instagramPosts + extracted.xPosts;
    if (totalPlatformPosts <= 0) {
      return null;
    }

    const instagramPercentage =
      extracted.instagramPercentage !== undefined
        ? Math.round(extracted.instagramPercentage)
        : Math.round((extracted.instagramPosts / totalPlatformPosts) * PERCENTAGE_MULTIPLIER);
    const xPercentage =
      extracted.xPercentage !== undefined
        ? Math.round(extracted.xPercentage)
        : Math.max(0, PERCENTAGE_MULTIPLIER - instagramPercentage);

    return {
      instagram: { percentage: instagramPercentage, posts: extracted.instagramPosts },
      x: { percentage: xPercentage, posts: extracted.xPosts },
    };
  } catch {
    return null;
  }
}

async function fetchParallelPlatformDistribution(
  timeFilterValue: string
): Promise<PlatformDistribution | null> {
  try {
    const [instagramResult, xResult] = await Promise.allSettled([
      fetchDashboardOverviewFromApi({ platform: 'instagram', timeFilter: timeFilterValue }),
      fetchDashboardOverviewFromApi({ platform: 'x', timeFilter: timeFilterValue }),
    ]);

    const instagramData = instagramResult.status === 'fulfilled' ? instagramResult.value : null;
    const xData = xResult.status === 'fulfilled' ? xResult.value : null;

    const instagramPosts = instagramData?.totalPosts || 0;
    const xPosts = xData?.totalPosts || 0;
    const totalPlatformPosts = instagramPosts + xPosts;

    if (totalPlatformPosts <= 0) {
      return null;
    }

    const instagramPercentage = Math.round((instagramPosts / totalPlatformPosts) * PERCENTAGE_MULTIPLIER);
    const xPercentage = Math.max(0, PERCENTAGE_MULTIPLIER - instagramPercentage);
    return {
      instagram: { percentage: instagramPercentage, posts: instagramPosts },
      x: { percentage: xPercentage, posts: xPosts },
    };
  } catch {
    return null;
  }
}

function mapRawRowToTimelinePoint(row: any): TimelinePoint {
  const rawDate = row.date || row.day || row.timestamp || row.posted_at;
  const parsedDate = rawDate ? new Date(rawDate) : null;
  const isValidDate =
    parsedDate !== null && !isNaN(parsedDate.getTime()) && String(rawDate).includes('-');

  const formattedDate = isValidDate
    ? `${String(parsedDate.getDate()).padStart(2, '0')} ${parsedDate.toLocaleString('default', { month: 'short' })}`
    : String(rawDate || '');

  return {
    date: formattedDate,
    positive: Number(row.positive ?? row.positive_count ?? 0),
    neutral: Number(row.neutral ?? row.neutral_count ?? 0),
    negative: Number(row.negative ?? row.negative_count ?? 0),
    timestamp: isValidDate ? parsedDate.getTime() : undefined,
    topPositiveTopic: row.top_topic_positive || row.top_positive_topic || row.top_topic || row.peak_topic || undefined,
    topNegativeTopic: row.top_topic_negative || row.top_negative_topic || undefined,
    topNeutralTopic: row.top_topic_neutral || row.top_neutral_topic || undefined,
  };
}

function parseLiveGraphPayload(payload: any): { nodes: any[]; edges: any[] } {
  const rawNodes = payload?.nodes || payload?.data?.nodes || payload?.elements?.nodes;
  const rawEdges =
    payload?.edges ||
    payload?.data?.edges ||
    payload?.links ||
    payload?.data?.links ||
    payload?.elements?.edges;

  if (!Array.isArray(rawNodes) || !Array.isArray(rawEdges) || rawNodes.length === 0) {
    return buildMbgFallbackGraph();
  }

  const nodes = rawNodes.map((nodeRecord: any) => {
    const nodeData = nodeRecord.data ? nodeRecord.data : nodeRecord;
    const rawType = String(nodeData.type || nodeData.group || nodeData.category || 'Topic');
    const normalizedType = rawType.toLowerCase() === 'topic' ? 'topic' : normalizeEntityType(rawType);
    return {
      data: {
        id: String(nodeData.id ?? nodeData.name ?? nodeData.label),
        label: String(nodeData.label ?? nodeData.name ?? nodeData.id),
        type: normalizedType,
        weight: Number(
          nodeData.weight ??
            nodeData.mention_count ??
            nodeData.post_count ??
            nodeData.count ??
            nodeData.size ??
            10
        ),
        topic: nodeData.topic ? String(nodeData.topic) : undefined,
      },
    };
  });

  const edges = rawEdges.map((edgeRecord: any, index: number) =>
    mapRawGraphEdgeToCytoscapeEdge(edgeRecord, index)
  );

  const hasCoOccursEdges = edges.some((edgeItem: any) => edgeItem.data.type === 'CO_OCCURS_WITH');
  if (!hasCoOccursEdges) {
    const validNodeIds = new Set(nodes.map((nodeItem: any) => String(nodeItem.data.id)));
    appendCoOccurrenceFallbackEdges(edges, validNodeIds);
  }

  return { nodes, edges };
}

function mapRawGraphEdgeToCytoscapeEdge(edgeRecord: any, index: number) {
  const edgeData = edgeRecord.data ? edgeRecord.data : edgeRecord;
  const rawEdgeType = String(edgeData.type || edgeData.relationship || edgeData.label || 'CO_OCCURS_WITH');
  const isTopicEdge =
    rawEdgeType.includes('BELONGS_TO') ||
    rawEdgeType.includes('TOPIC') ||
    edgeData.style === 'dashed';
  const edgeType = isTopicEdge ? 'BELONGS_TO_TOPIC' : 'CO_OCCURS_WITH';

  const rawWeight = Number(edgeData.npmi ?? edgeData.weight ?? edgeData.value ?? 1);
  const npmiScore =
    !isTopicEdge && rawWeight > 1.5 ? Number((rawWeight / 10).toFixed(4)) : rawWeight;
  const cooccurCount = Number(edgeData.cooccur ?? edgeData.value ?? 3);
  const pmiScore = Number(edgeData.pmi ?? 0);
  const sourceId = String(edgeData.source ?? edgeData.from);
  const targetId = String(edgeData.target ?? edgeData.to);

  return {
    data: {
      id: String(edgeData.id ?? `edge_${sourceId}_${targetId}_${index}`),
      source: sourceId,
      target: targetId,
      sourceName: String(edgeData.source_name ?? sourceId.replace(/^(entity_|topic_)/, '')),
      targetName: String(edgeData.target_name ?? targetId.replace(/^(entity_|topic_)/, '')),
      type: edgeType,
      label: isTopicEdge ? 'BELONGS_TO_TOPIC' : `NPMI ${npmiScore.toFixed(2)}`,
      weight: isTopicEdge ? 1 : npmiScore,
      npmi: isTopicEdge ? undefined : npmiScore,
      cooccur: isTopicEdge ? undefined : cooccurCount,
      pmi: isTopicEdge ? undefined : pmiScore,
      style: isTopicEdge ? 'dashed' : 'solid',
    },
  };
}

function createBelongsToTopicCytoscapeEdge(
  entityName: string,
  topicName: string,
  entityNodeId: string,
  topicNodeId: string
) {
  return {
    data: {
      id: `rel_bt_${entityName}_${topicName}`,
      source: entityNodeId,
      target: topicNodeId,
      sourceName: entityName,
      targetName: topicName,
      type: 'BELONGS_TO_TOPIC',
      label: 'BELONGS_TO_TOPIC',
      weight: 1,
      style: 'dashed',
    },
  };
}

function appendCoOccurrenceFallbackEdges(edges: any[], validNodeIds: Set<string>): void {
  (mbgGraphFallback.co_occurs || []).forEach((coOccurrence: any, index: number) => {
    const sourceName = String(coOccurrence.source).trim();
    const targetName = String(coOccurrence.target).trim();
    const sourceId = `entity_${sourceName}`;
    const targetId = `entity_${targetName}`;
    const npmiScore = Number(coOccurrence.weight || 0.5);

    if (validNodeIds.has(sourceId) && validNodeIds.has(targetId)) {
      edges.push({
        data: {
          id: `rel_co_${sourceName}_${targetName}_${index}`,
          source: sourceId,
          target: targetId,
          sourceName,
          targetName,
          type: 'CO_OCCURS_WITH',
          label: `NPMI ${npmiScore.toFixed(2)}`,
          weight: npmiScore,
          npmi: npmiScore,
          cooccur: Number(coOccurrence.cooccur || 3),
          pmi: Number(coOccurrence.pmi || 0),
          style: 'solid',
        },
      });
    }
  });
}

function getAuthHeaders(): HeadersInit {
  const accessToken = localStorage.getItem('access_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  return headers;
}

async function extractSettledJson(
  settledResult: PromiseSettledResult<Response>
): Promise<any | null> {
  if (settledResult.status === 'fulfilled' && settledResult.value.ok) {
    return await settledResult.value.json().catch(() => null);
  }
  return null;
}

async function fetchFirstAvailableJson(candidateUrls: string[]): Promise<any | null> {
  for (const endpointUrl of candidateUrls) {
    try {
      const response = await fetch(endpointUrl, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        continue;
      }
      const payload = await response.json();
      if (payload !== null && payload !== undefined) {
        return payload;
      }
    } catch {
      continue;
    }
  }
  return null;
}

function extractListFromPayload(payload: any, candidateKeys: string[]): any[] | null {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload && typeof payload === 'object') {
    for (const key of candidateKeys) {
      if (Array.isArray(payload[key])) {
        return payload[key];
      }
    }
  }
  return null;
}
