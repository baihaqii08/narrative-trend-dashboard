import { useMemo } from 'react';
import { DashboardOverviewData } from '../../services/api';

interface SummaryCardsProps {
  theme: any;
  data: any[];
  overviewStats?: DashboardOverviewData | null;
  topicsCount?: number;
  entitiesCount?: number;
  type?: 'overview' | 'sentiment';
}

function SummaryCards({ theme, data, overviewStats, topicsCount = 0, entitiesCount = 0, type = 'overview' }: SummaryCardsProps) {
  const stats = useMemo(() => {
    const topics = new Set<string>();
    const entities = new Set<string>();
    const sentimentCounts: Record<string, number> = { positive: 0, negative: 0, neutral: 0 };
    let postsEngagement = 0;
    let scoreSum = 0;
    let scoreCount = 0;

    data.forEach(item => {
      if (item.topic) topics.add(item.topic);
      if (item.sentiment && sentimentCounts[item.sentiment] !== undefined) {
        sentimentCounts[item.sentiment]++;
      }
      if (typeof item.sentiment_score === 'number') {
        scoreSum += item.sentiment_score <= 1 ? item.sentiment_score * 100 : item.sentiment_score;
        scoreCount++;
      }
      if (item.engagement) {
        postsEngagement += (item.engagement.likes || 0) + (item.engagement.shares || 0) + (item.engagement.comments || 0) + (item.engagement.views || 0);
      }
      if (item.entities && Array.isArray(item.entities)) {
        item.entities.forEach((ent: any) => {
          if (ent.name) entities.add(ent.name.toLowerCase());
        });
      }
      if (item.content) {
        const hashtags = item.content.match(/#[\w]+/g) || [];
        hashtags.forEach((tag: string) => entities.add(tag.substring(1).toLowerCase()));
      }
    });

    // Prioritaskan data KPI resmi dari GET /api/dashboard/overview (agar tidak tertimpa limit=50 dari /sentiment/posts)
    const totalPosts = overviewStats?.totalPosts || data.length || 0;
    const totalEngagement = overviewStats?.totalEngagement || postsEngagement || 0;
    const activeNarratives = overviewStats?.trendingTopicsCount || topicsCount || topics.size || 0;
    const uniqueEntities = overviewStats?.uniqueEntitiesCount || entitiesCount || entities.size || 0;

    const positivePerc =
      overviewStats?.positiveShare !== undefined && overviewStats.positiveShare > 0
        ? Math.round(Number(overviewStats.positiveShare))
        : data.length > 0
        ? Math.round((sentimentCounts.positive / data.length) * 100)
        : 0;
    const negativePerc =
      overviewStats?.negativeShare !== undefined && overviewStats.negativeShare > 0
        ? Math.round(Number(overviewStats.negativeShare))
        : data.length > 0
        ? Math.round((sentimentCounts.negative / data.length) * 100)
        : 0;
    const neutralPerc =
      overviewStats?.neutralShare !== undefined && overviewStats.neutralShare > 0
        ? Math.round(Number(overviewStats.neutralShare))
        : data.length > 0
        ? Math.round((sentimentCounts.neutral / data.length) * 100)
        : 0;
    const avgConfidence =
      overviewStats?.avgConfidence !== undefined && overviewStats.avgConfidence > 0
        ? Math.round(Number(overviewStats.avgConfidence))
        : scoreCount > 0
        ? Math.round(scoreSum / scoreCount)
        : 0;

    return {
      totalPosts,
      totalEngagement,
      activeNarratives,
      uniqueEntities,
      positivePerc,
      negativePerc,
      neutralPerc,
      avgConfidence
    };
  }, [data, overviewStats, topicsCount, entitiesCount]);

  const formatEngagement = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + 'M';
    if (num >= 1000) return (num / 1000).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + 'K';
    return num.toLocaleString('id-ID');
  };

  const formatPosts = (num: number) => {
    return num.toLocaleString('id-ID');
  };

  if (type === 'sentiment') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
        <div style={{ backgroundColor: theme.bgCard, padding: '24px', borderRadius: '14px', border: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '14px', fontWeight: '600', color: theme.textMuted }}>Positive</span>
          <span style={{ fontSize: '32px', fontWeight: '800', color: '#10b981', margin: '8px 0 4px 0' }}>{stats.positivePerc}%</span>
          <span style={{ fontSize: '13px', color: theme.textMuted }}>Sentimen Positif</span>
        </div>
        <div style={{ backgroundColor: theme.bgCard, padding: '24px', borderRadius: '14px', border: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '14px', fontWeight: '600', color: theme.textMuted }}>Negative</span>
          <span style={{ fontSize: '32px', fontWeight: '800', color: '#ef4444', margin: '8px 0 4px 0' }}>{stats.negativePerc}%</span>
          <span style={{ fontSize: '13px', color: theme.textMuted }}>Sentimen Negatif</span>
        </div>
        <div style={{ backgroundColor: theme.bgCard, padding: '24px', borderRadius: '14px', border: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '14px', fontWeight: '600', color: theme.textMuted }}>Neutral</span>
          <span style={{ fontSize: '32px', fontWeight: '800', color: '#f59e0b', margin: '8px 0 4px 0' }}>{stats.neutralPerc}%</span>
          <span style={{ fontSize: '13px', color: theme.textMuted }}>Sentimen Netral</span>
        </div>
        <div style={{ backgroundColor: theme.bgCard, padding: '24px', borderRadius: '14px', border: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '14px', fontWeight: '600', color: theme.textMuted }}>Avg. Confidence</span>
          <span style={{ fontSize: '32px', fontWeight: '800', color: '#3b82f6', margin: '8px 0 4px 0' }}>{stats.avgConfidence}%</span>
          <span style={{ fontSize: '13px', color: theme.textMuted }}>Kepercayaan Sistem</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '20px' }}>
      
      {/* Card 1: Total Posts */}
      <div 
        className="card-hover-effect"
        style={{
          backgroundColor: theme.bgCard,
          padding: '20px 24px',
          borderRadius: '14px',
          border: `1px solid ${theme.border}`,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
          display: 'flex',
          alignItems: 'center',
          gap: '20px'
        }}
      >
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '12px',
          backgroundColor: '#e0f2fe',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          {/* Globe Icon */}
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="2" y1="12" x2="22" y2="12"></line>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
          </svg>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
          <span style={{ fontSize: '14px', fontWeight: '600', color: theme.textMuted }}>Total Posts</span>
          <span style={{ fontSize: '26px', fontWeight: '800', color: theme.textMain, margin: '2px 0' }}>
            {formatPosts(stats.totalPosts)}
          </span>
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontWeight: 'bold' }}>↑ 8.2%</span> vs previous period
          </span>
        </div>
      </div>

      {/* Card 2: Total Engagement */}
      <div 
        className="card-hover-effect"
        style={{
          backgroundColor: theme.bgCard,
          padding: '20px 24px',
          borderRadius: '14px',
          border: `1px solid ${theme.border}`,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
          display: 'flex',
          alignItems: 'center',
          gap: '20px'
        }}
      >
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '12px',
          backgroundColor: '#f3e8ff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          {/* Users Icon */}
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
            {formatEngagement(stats.totalEngagement)}
          </span>
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontWeight: 'bold' }}>↑ 16,4%</span> vs previous period
          </span>
        </div>
      </div>

      {/* Card 3: Trending Topics */}
      <div 
        className="card-hover-effect"
        style={{
          backgroundColor: theme.bgCard,
          padding: '20px 24px',
          borderRadius: '14px',
          border: `1px solid ${theme.border}`,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
          display: 'flex',
          alignItems: 'center',
          gap: '20px'
        }}
      >
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '12px',
          backgroundColor: '#fef3c7',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          {/* Flame Icon */}
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3.5z"></path>
          </svg>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
          <span style={{ fontSize: '14px', fontWeight: '600', color: theme.textMuted }}>Trending Topics</span>
          <span style={{ fontSize: '26px', fontWeight: '800', color: theme.textMain, margin: '2px 0' }}>
            {stats.activeNarratives}
          </span>
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontWeight: 'bold' }}>↑ +3</span> new topics
          </span>
        </div>
      </div>

      {/* Card 4: Unique Entities */}
      <div 
        className="card-hover-effect"
        style={{
          backgroundColor: theme.bgCard,
          padding: '20px 24px',
          borderRadius: '14px',
          border: `1px solid ${theme.border}`,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
          display: 'flex',
          alignItems: 'center',
          gap: '20px'
        }}
      >
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '12px',
          backgroundColor: '#e0f2fe',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          {/* Document Icon */}
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
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontWeight: 'bold' }}>↑ +3</span> new entities
          </span>
        </div>
      </div>

    </div>
  );
}

export default SummaryCards;
