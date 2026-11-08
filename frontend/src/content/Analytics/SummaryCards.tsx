import React, { useMemo } from 'react';
import { DashboardOverviewData } from '../../services/api';

interface SummaryCardsProps {
  theme: any;
  data: any[];
  overviewStats?: DashboardOverviewData | null;
  topicsCount?: number;
  entitiesCount?: number;
  type?: 'overview' | 'sentiment';
  timeFilter?: string;
}

interface ComputedSummaryStats {
  totalPosts: number;
  totalEngagement: number;
  activeNarratives: number;
  uniqueEntities: number;
  positivePercentage: number;
  negativePercentage: number;
  neutralPercentage: number;
  avgConfidence: number;
}

const MILLION_THRESHOLD = 1_000_000;
const THOUSAND_THRESHOLD = 1_000;
const PERCENTAGE_MULTIPLIER = 100;

function SummaryCards({
  theme,
  data,
  overviewStats,
  topicsCount = 0,
  entitiesCount = 0,
  type = 'overview',
  timeFilter = 'all',
}: SummaryCardsProps) {
  const stats = useMemo(
    () => computeSummaryStats(data, overviewStats, topicsCount, entitiesCount),
    [data, overviewStats, topicsCount, entitiesCount]
  );

  if (type === 'sentiment') {
    return <SentimentSummaryGrid theme={theme} stats={stats} />;
  }

  const postsGrowth = overviewStats?.postsGrowth;
  const engagementGrowth = overviewStats?.engagementGrowth;
  const isAllTime = !timeFilter || timeFilter === 'all';
  const comparisonPeriodLabel = isAllTime ? 'vs paruh awal' : 'vs previous period';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '20px' }}>
      <div className="card-hover-effect" style={buildCardContainerStyle(theme)}>
        <div style={buildIconBadgeStyle('#e0f2fe')}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="2" y1="12" x2="22" y2="12"></line>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
          </svg>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
          <span style={{ fontSize: '14px', fontWeight: '600', color: theme.textMuted }}>Total Posts</span>
          <span style={{ fontSize: '26px', fontWeight: '800', color: theme.textMain, margin: '2px 0' }}>
            {formatPostCount(stats.totalPosts)}
          </span>
          <GrowthSubtitle
            growthValue={postsGrowth}
            comparisonLabel={comparisonPeriodLabel}
            fallbackHighlight="100%"
            fallbackText="total dataset"
            fallbackColor="#16a34a"
          />
        </div>
      </div>

      <div className="card-hover-effect" style={buildCardContainerStyle(theme)}>
        <div style={buildIconBadgeStyle('#f3e8ff')}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9333ea" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
          <span style={{ fontSize: '14px', fontWeight: '600', color: theme.textMuted }}>Total Engagement</span>
          <span style={{ fontSize: '26px', fontWeight: '800', color: theme.textMain, margin: '2px 0' }}>
            {formatEngagementCount(stats.totalEngagement)}
          </span>
          <GrowthSubtitle
            growthValue={engagementGrowth}
            comparisonLabel={comparisonPeriodLabel}
            fallbackHighlight="Total interaksi"
            fallbackText="likes & comments"
            fallbackColor="#9333ea"
          />
        </div>
      </div>

      <div className="card-hover-effect" style={buildCardContainerStyle(theme)}>
        <div style={buildIconBadgeStyle('#fef3c7')}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3.5z"></path>
          </svg>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
          <span style={{ fontSize: '14px', fontWeight: '600', color: theme.textMuted }}>Trending Topics</span>
          <span style={{ fontSize: '26px', fontWeight: '800', color: theme.textMain, margin: '2px 0' }}>
            {stats.activeNarratives}
          </span>
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#ea580c', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontWeight: 'bold' }}>{stats.activeNarratives} topik aktif</span> terverifikasi
          </span>
        </div>
      </div>

      <div className="card-hover-effect" style={buildCardContainerStyle(theme)}>
        <div style={buildIconBadgeStyle('#e0f2fe')}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
          <span style={{ fontSize: '14px', fontWeight: '600', color: theme.textMuted }}>Unique Entities</span>
          <span style={{ fontSize: '26px', fontWeight: '800', color: theme.textMain, margin: '2px 0' }}>
            {stats.uniqueEntities}
          </span>
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#0284c7', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontWeight: 'bold' }}>{stats.uniqueEntities} entitas</span> di Knowledge Graph
          </span>
        </div>
      </div>
    </div>
  );
}

function SentimentSummaryGrid({
  theme,
  stats,
}: {
  theme: any;
  stats: ComputedSummaryStats;
}) {
  const cardStyle: React.CSSProperties = {
    backgroundColor: theme.bgCard,
    padding: '24px',
    borderRadius: '14px',
    border: `1px solid ${theme.border}`,
    display: 'flex',
    flexDirection: 'column',
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
      <div style={cardStyle}>
        <span style={{ fontSize: '14px', fontWeight: '600', color: theme.textMuted }}>Positive</span>
        <span style={{ fontSize: '32px', fontWeight: '800', color: '#10b981', margin: '8px 0 4px 0' }}>
          {stats.positivePercentage}%
        </span>
        <span style={{ fontSize: '13px', color: theme.textMuted }}>Sentimen Positif</span>
      </div>
      <div style={cardStyle}>
        <span style={{ fontSize: '14px', fontWeight: '600', color: theme.textMuted }}>Negative</span>
        <span style={{ fontSize: '32px', fontWeight: '800', color: '#ef4444', margin: '8px 0 4px 0' }}>
          {stats.negativePercentage}%
        </span>
        <span style={{ fontSize: '13px', color: theme.textMuted }}>Sentimen Negatif</span>
      </div>
      <div style={cardStyle}>
        <span style={{ fontSize: '14px', fontWeight: '600', color: theme.textMuted }}>Neutral</span>
        <span style={{ fontSize: '32px', fontWeight: '800', color: '#f59e0b', margin: '8px 0 4px 0' }}>
          {stats.neutralPercentage}%
        </span>
        <span style={{ fontSize: '13px', color: theme.textMuted }}>Sentimen Netral</span>
      </div>
      <div style={cardStyle}>
        <span style={{ fontSize: '14px', fontWeight: '600', color: theme.textMuted }}>Avg. Confidence</span>
        <span style={{ fontSize: '32px', fontWeight: '800', color: '#3b82f6', margin: '8px 0 4px 0' }}>
          {stats.avgConfidence}%
        </span>
        <span style={{ fontSize: '13px', color: theme.textMuted }}>Kepercayaan Sistem</span>
      </div>
    </div>
  );
}

function GrowthSubtitle({
  growthValue,
  comparisonLabel,
  fallbackHighlight,
  fallbackText,
  fallbackColor,
}: {
  growthValue?: number;
  comparisonLabel: string;
  fallbackHighlight: string;
  fallbackText: string;
  fallbackColor: string;
}) {
  if (growthValue !== undefined && growthValue !== null) {
    const isNonNegative = growthValue >= 0;
    const growthColor = isNonNegative ? '#16a34a' : '#dc2626';
    const formattedRate = isNonNegative
      ? `↑ +${growthValue}%`
      : `↓ ${Math.abs(growthValue)}%`;

    return (
      <span style={{
        fontSize: '13px',
        fontWeight: '600',
        color: growthColor,
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
      }}>
        <span style={{ fontWeight: 'bold' }}>{formattedRate}</span>
        <span>{comparisonLabel}</span>
      </span>
    );
  }

  return (
    <span style={{ fontSize: '13px', fontWeight: '600', color: fallbackColor, display: 'flex', alignItems: 'center', gap: '4px' }}>
      <span style={{ fontWeight: 'bold' }}>{fallbackHighlight}</span> {fallbackText}
    </span>
  );
}

function computeSummaryStats(
  posts: any[],
  overviewStats: DashboardOverviewData | null | undefined,
  topicsCount: number,
  entitiesCount: number
): ComputedSummaryStats {
  const uniqueTopics = new Set<string>();
  const uniqueEntities = new Set<string>();
  const sentimentCounts: Record<string, number> = { positive: 0, negative: 0, neutral: 0 };
  let localEngagementTotal = 0;
  let confidenceScoreSum = 0;
  let confidenceScoreCount = 0;

  posts.forEach((postItem) => {
    if (postItem.topic) {
      uniqueTopics.add(postItem.topic);
    }
    if (postItem.sentiment && sentimentCounts[postItem.sentiment] !== undefined) {
      sentimentCounts[postItem.sentiment]++;
    }
    if (typeof postItem.sentiment_score === 'number') {
      const normalizedScore =
        postItem.sentiment_score <= 1
          ? postItem.sentiment_score * PERCENTAGE_MULTIPLIER
          : postItem.sentiment_score;
      confidenceScoreSum += normalizedScore;
      confidenceScoreCount++;
    }
    if (postItem.engagement) {
      localEngagementTotal +=
        (postItem.engagement.likes || 0) +
        (postItem.engagement.shares || 0) +
        (postItem.engagement.comments || 0) +
        (postItem.engagement.views || 0);
    }
    if (Array.isArray(postItem.entities)) {
      postItem.entities.forEach((entityEntry: any) => {
        if (entityEntry.name) {
          uniqueEntities.add(entityEntry.name.toLowerCase());
        }
      });
    }
    if (postItem.content) {
      const matchedHashtags = postItem.content.match(/#[\w]+/g) || [];
      matchedHashtags.forEach((hashtag: string) => {
        uniqueEntities.add(hashtag.substring(1).toLowerCase());
      });
    }
  });

  const totalPosts = overviewStats?.totalPosts || posts.length || 0;
  const totalEngagement = overviewStats?.totalEngagement || localEngagementTotal || 0;
  const activeNarratives = overviewStats?.trendingTopicsCount || topicsCount || uniqueTopics.size || 0;
  const uniqueEntitiesTotal = overviewStats?.uniqueEntitiesCount || entitiesCount || uniqueEntities.size || 0;

  const positivePercentage =
    overviewStats?.positiveShare !== undefined && overviewStats.positiveShare > 0
      ? Math.round(Number(overviewStats.positiveShare))
      : posts.length > 0
        ? Math.round((sentimentCounts.positive / posts.length) * PERCENTAGE_MULTIPLIER)
        : 0;
  const negativePercentage =
    overviewStats?.negativeShare !== undefined && overviewStats.negativeShare > 0
      ? Math.round(Number(overviewStats.negativeShare))
      : posts.length > 0
        ? Math.round((sentimentCounts.negative / posts.length) * PERCENTAGE_MULTIPLIER)
        : 0;
  const neutralPercentage =
    overviewStats?.neutralShare !== undefined && overviewStats.neutralShare > 0
      ? Math.round(Number(overviewStats.neutralShare))
      : posts.length > 0
        ? Math.round((sentimentCounts.neutral / posts.length) * PERCENTAGE_MULTIPLIER)
        : 0;
  const avgConfidence =
    overviewStats?.avgConfidence !== undefined && overviewStats.avgConfidence > 0
      ? Math.round(Number(overviewStats.avgConfidence))
      : confidenceScoreCount > 0
        ? Math.round(confidenceScoreSum / confidenceScoreCount)
        : 0;

  return {
    totalPosts,
    totalEngagement,
    activeNarratives,
    uniqueEntities: uniqueEntitiesTotal,
    positivePercentage,
    negativePercentage,
    neutralPercentage,
    avgConfidence,
  };
}

function formatEngagementCount(value: number): string {
  if (value >= MILLION_THRESHOLD) {
    return `${(value / MILLION_THRESHOLD).toLocaleString('id-ID', { maximumFractionDigits: 1 })}M`;
  }
  if (value >= THOUSAND_THRESHOLD) {
    return `${(value / THOUSAND_THRESHOLD).toLocaleString('id-ID', { maximumFractionDigits: 1 })}K`;
  }
  return value.toLocaleString('id-ID');
}

function formatPostCount(value: number): string {
  return value.toLocaleString('id-ID');
}

function buildCardContainerStyle(theme: any): React.CSSProperties {
  return {
    backgroundColor: theme.bgCard,
    padding: '20px 24px',
    borderRadius: '14px',
    border: `1px solid ${theme.border}`,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  };
}

function buildIconBadgeStyle(backgroundColor: string): React.CSSProperties {
  return {
    width: '56px',
    height: '56px',
    borderRadius: '12px',
    backgroundColor,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  };
}

export default SummaryCards;
