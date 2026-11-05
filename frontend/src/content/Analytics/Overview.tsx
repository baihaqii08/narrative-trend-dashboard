// @ts-nocheck
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import SummaryCards from './SummaryCards';
import KnowledgeGraph from './KnowledgeGraph';
import {
  fetchPostsFromApi,
  fetchDashboardOverviewFromApi,
  fetchTopicsFromApi,
  fetchEntitiesFromApi,
  fetchSentimentTimelineFromApi,
  fetchCombinedPlatformDistributionFromApi,
  normalizeEntityType,
  SocialPost,
  TopicItem,
  EntityItem,
  TimelinePoint,
  DashboardOverviewData,
  PlatformDistribution
} from '../../services/api';

const getEntityTypeBadge = (type: string) => {
  const normType = normalizeEntityType(type).toLowerCase();
  switch (normType) {
    case 'person':
      return { bg: '#f3e8ff', color: '#7e22ce', border: '#d8b4fe' };
    case 'organization':
      return { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' };
    case 'geopolitical':
      return { bg: '#ecfeff', color: '#0e7490', border: '#a5f3fc' };
    case 'location':
      return { bg: '#ecfdf5', color: '#047857', border: '#a7f3d0' };
    case 'product':
      return { bg: '#fefce8', color: '#b45309', border: '#fde047' };
    case 'event':
      return { bg: '#fdf2f8', color: '#be185d', border: '#fbcfe8' };
    case 'norm':
      return { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' };
    case 'facility':
      return { bg: '#f0fdfa', color: '#0f766e', border: '#99f6e4' };
    case 'topic':
      return { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' };
    default:
      return { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' };
  }
};

interface DashboardProps {
  theme: any;
  isDark?: boolean;
  timeFilter?: string;
  setTimeFilter?: (val: string) => void;
  platformFilter?: string;
  setPlatformFilter?: (val: string) => void;
  isRefreshing?: boolean;
  toggleTheme?: () => void;
}

function Overview({ theme, isDark, timeFilter = 'all', setTimeFilter, platformFilter = 'all', setPlatformFilter, isRefreshing }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<'instagram' | 'x'>('instagram');
  const [hoveredTrendData, setHoveredTrendData] = useState<any>(null);

  // State Data Real dari PostgreSQL (via FastAPI)
  const [socialDataRaw, setSocialDataRaw] = useState<SocialPost[]>([]);
  const [overviewApiData, setOverviewApiData] = useState<DashboardOverviewData | null>(null);
  const [combinedPlatformDist, setCombinedPlatformDist] = useState<PlatformDistribution | null>(null);
  const [topicsApiData, setTopicsApiData] = useState<TopicItem[]>([]);
  const [entitiesApiData, setEntitiesApiData] = useState<EntityItem[]>([]);
  const [timelineApiData, setTimelineApiData] = useState<TimelinePoint[]>([]);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [lastUpdatedTime, setLastUpdatedTime] = useState<string>('--:--');

  // Active selected date & topic state
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const loadPostsFromFastApi = useCallback(async () => {
    setIsLoadingData(true);
    setApiError(null);
    try {
      const [overviewRes, timelineRes, entitiesRes, topicsRes, postsRes, combinedDistRes] = await Promise.allSettled([
        fetchDashboardOverviewFromApi({ platform: activeTab, timeFilter, date: selectedDate }),
        fetchSentimentTimelineFromApi({ platform: activeTab, timeFilter }),
        fetchEntitiesFromApi({ platform: activeTab, timeFilter, date: selectedDate, limit: 4 }),
        fetchTopicsFromApi({ platform: activeTab, timeFilter, date: selectedDate, limit: 4 }),
        fetchPostsFromApi({ platform: activeTab, timeFilter, limit: 50 }),
        fetchCombinedPlatformDistributionFromApi({ timeFilter })
      ]);

      let anySuccess = false;

      if (overviewRes.status === 'fulfilled' && overviewRes.value) {
        setOverviewApiData(overviewRes.value);
        anySuccess = true;
      }
      if (combinedDistRes.status === 'fulfilled' && combinedDistRes.value) {
        setCombinedPlatformDist(combinedDistRes.value);
        anySuccess = true;
      }
      if (timelineRes.status === 'fulfilled' && timelineRes.value.length > 0) {
        setTimelineApiData(timelineRes.value);
        anySuccess = true;
      }
      if (entitiesRes.status === 'fulfilled' && entitiesRes.value.length > 0) {
        setEntitiesApiData(entitiesRes.value);
        anySuccess = true;
      }
      if (topicsRes.status === 'fulfilled' && topicsRes.value.length > 0) {
        setTopicsApiData(topicsRes.value);
        anySuccess = true;
      }
      if (postsRes.status === 'fulfilled' && postsRes.value.length > 0) {
        setSocialDataRaw(postsRes.value);
        anySuccess = true;
      }

      if (!anySuccess) {
        setApiError(
          `Gagal memuat data dari Backend (${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'}). Pastikan server FastAPI menyala dan database terhubung.`
        );
      }

      const now = new Date();
      setLastUpdatedTime(
        `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      );
    } catch (err: any) {
      setApiError(err?.message || 'Gagal terhubung ke server FastAPI.');
    } finally {
      setIsLoadingData(false);
    }
  }, [timeFilter, activeTab, selectedDate]);

  useEffect(() => {
    loadPostsFromFastApi();
  }, [loadPostsFromFastApi, isRefreshing]);

  const handleTabChange = (tab: 'instagram' | 'x') => {
    setActiveTab(tab);
    if (setPlatformFilter) {
      setPlatformFilter(tab);
    }
  };

  // Handler perubahan filter waktu sesuai kontrak Backend:
  // '7_hari' / 'last7' -> days=7, time_filter='last7'
  // '30_hari' / 'last30' -> days=30, time_filter='last30'
  // 'sepanjang_waktu' / 'all' -> time_filter='all' (tanpa days)
  const handleTimeFilterChange = (selectedOption: string) => {
    let normalizedFilter = selectedOption;
    if (selectedOption === '7_hari') normalizedFilter = 'last7';
    else if (selectedOption === '14_hari') normalizedFilter = 'last14';
    else if (selectedOption === '30_hari') normalizedFilter = 'last30';
    else if (selectedOption === 'sepanjang_waktu') normalizedFilter = 'all';

    setSelectedDate(null);
    if (setTimeFilter) {
      setTimeFilter(normalizedFilter);
    }
  };

  // Subtitle dynamic response to timeFilter
  const getTimeSubtitle = (filter: string) => {
    switch (filter) {
      case 'last7': return 'Monitoring tren narasi media sosial — 7 hari terakhir';
      case 'last14': return 'Monitoring tren narasi media sosial — 14 hari terakhir';
      case 'last30': return 'Monitoring tren narasi media sosial — 30 hari terakhir';
      default: return 'Monitoring tren narasi media sosial — Sepanjang waktu';
    }
  };

  // Filter raw data by timeFilter first
  const timeFilteredRaw = useMemo(() => {
    let filtered = [...socialDataRaw];

    if (timeFilter !== 'all') {
      let maxDate = new Date(0);
      socialDataRaw.forEach(item => {
        const d = new Date(item.timestamp);
        if (d > maxDate) maxDate = d;
      });
      const cutoff = new Date(maxDate);
      if (timeFilter === 'last7') cutoff.setDate(cutoff.getDate() - 7);
      if (timeFilter === 'last14') cutoff.setDate(cutoff.getDate() - 14);
      if (timeFilter === 'last30') cutoff.setDate(cutoff.getDate() - 30);

      filtered = filtered.filter(item => item.timestamp && new Date(item.timestamp) >= cutoff);
    }

    return filtered;
  }, [socialDataRaw, timeFilter, isRefreshing]);

  // Filter socialData dynamically based on activeTab platform
  const socialData = useMemo(() => {
    return timeFilteredRaw.filter(item => {
      const p = item.platform ? item.platform.toLowerCase() : '';
      if (activeTab === 'x') {
        return p === 'x' || p === 'twitter';
      }
      return p === 'instagram' || p === 'ig';
    });
  }, [timeFilteredRaw, activeTab]);

  // Derived Statistics from PostgreSQL Database (combining dedicated API endpoints & posts data)
  const {
    totalPosts,
    positiveCount,
    negativeCount,
    neutralCount,
    positiveShare,
    negativeShare,
    neutralShare,
    dominantSentiment,
    topPositiveTopic,
    topNegativeTopic,
    topNeutralTopic,
    sentimentTrendData,
    topTopicsData,
    topEntitiesData,
    platformDistData,
    peakDateStr,
    totalEngagementSum
  } = useMemo(() => {
    let pos = 0, neg = 0, neu = 0;
    let totalEng = 0;

    const topicCounts: Record<string, number> = {};
    const posTopicCounts: Record<string, number> = {};
    const negTopicCounts: Record<string, number> = {};
    const neuTopicCounts: Record<string, number> = {};
    const dailyMap: Record<string, { date: string; positive: number; neutral: number; negative: number; timestamp: number; topics: Record<string, number> }> = {};

    socialData.forEach(item => {
      // Sentiments
      if (item.sentiment === 'positive') {
        pos++;
        if (item.topic) posTopicCounts[item.topic] = (posTopicCounts[item.topic] || 0) + 1;
      } else if (item.sentiment === 'negative') {
        neg++;
        if (item.topic) negTopicCounts[item.topic] = (negTopicCounts[item.topic] || 0) + 1;
      } else {
        neu++;
        if (item.topic) neuTopicCounts[item.topic] = (neuTopicCounts[item.topic] || 0) + 1;
      }

      // Engagement
      if (item.engagement) {
        totalEng += (item.engagement.likes || 0) + (item.engagement.shares || 0) + (item.engagement.comments || 0) + (item.engagement.views || 0);
      }

      // Topics
      if (item.topic) {
        topicCounts[item.topic] = (topicCounts[item.topic] || 0) + 1;
      }

      // Daily Trend grouping
      if (item.timestamp) {
        const d = new Date(item.timestamp);
        const dayKey = `${String(d.getDate()).padStart(2, '0')} ${d.toLocaleString('default', { month: 'short' })}`;

        if (!dailyMap[dayKey]) {
          dailyMap[dayKey] = { date: dayKey, positive: 0, neutral: 0, negative: 0, timestamp: d.getTime(), topics: {} };
        }

        if (item.sentiment === 'positive') dailyMap[dayKey].positive++;
        else if (item.sentiment === 'negative') dailyMap[dayKey].negative++;
        else dailyMap[dayKey].neutral++;

        if (item.topic) {
          dailyMap[dayKey].topics[item.topic] = (dailyMap[dayKey].topics[item.topic] || 0) + 1;
        }
      }
    });

    // PENTING: Prioritaskan data KPI resmi dari GET /api/dashboard/overview & GET /api/sentiment/distribution
    // Jangan biarkan sample 50 post dari /api/sentiment/posts menimpa nilai asli total_posts (10.944) atau neutral_share (61.6%)
    const finalPosCount = overviewApiData?.positiveCount || pos || 0;
    const finalNegCount = overviewApiData?.negativeCount || neg || 0;
    const finalNeuCount = overviewApiData?.neutralCount || neu || 0;
    const totalPosts = overviewApiData?.totalPosts || socialData.length || 0;

    const sumCounts = finalPosCount + finalNegCount + finalNeuCount;

    const positiveShare =
      overviewApiData?.positiveShare !== undefined && overviewApiData.positiveShare > 0
        ? Number(overviewApiData.positiveShare).toFixed(1)
        : sumCounts > 0
        ? ((finalPosCount / sumCounts) * 100).toFixed(1)
        : '0.0';
    const negativeShare =
      overviewApiData?.negativeShare !== undefined && overviewApiData.negativeShare > 0
        ? Number(overviewApiData.negativeShare).toFixed(1)
        : sumCounts > 0
        ? ((finalNegCount / sumCounts) * 100).toFixed(1)
        : '0.0';
    const neutralShare =
      overviewApiData?.neutralShare !== undefined && overviewApiData.neutralShare > 0
        ? Number(overviewApiData.neutralShare).toFixed(1)
        : sumCounts > 0
        ? ((finalNeuCount / sumCounts) * 100).toFixed(1)
        : '0.0';

    // Dominant Sentiment berdasarkan persentase riil dari database
    const posNum = parseFloat(positiveShare);
    const negNum = parseFloat(negativeShare);
    const neuNum = parseFloat(neutralShare);

    let dominantSentiment: 'positive' | 'negative' | 'neutral' = overviewApiData?.dominantSentiment || 'neutral';
    if (neuNum >= posNum && neuNum >= negNum && (neuNum > 0 || !overviewApiData?.dominantSentiment)) {
      dominantSentiment = 'neutral';
    } else if (posNum > neuNum && posNum > negNum) {
      dominantSentiment = 'positive';
    } else if (negNum > neuNum && negNum > posNum) {
      dominantSentiment = 'negative';
    }

    // Top Topics dari endpoint `/api/topics` atau `/api/dashboard/overview` (fallback ke agregasi posts)
    const sortedTopics = Object.entries(topicCounts).sort((a, b) => b[1] - a[1]);
    const postsDerivedTopics: TopicItem[] = sortedTopics.slice(0, 4).map(([topicName, count], idx) => {
      const baseCount = socialData.length || 1;
      const shareOfPosts = ((count / baseCount) * 100).toFixed(1);
      return {
        rank: idx + 1,
        title: topicName,
        postCount: count,
        posts: `${count.toLocaleString('id-ID')} postingan`,
        growth: `${shareOfPosts}% share`
      };
    });

    const topTopicsData: TopicItem[] =
      topicsApiData.length > 0
        ? topicsApiData.slice(0, 4)
        : overviewApiData?.topTopics && overviewApiData.topTopics.length > 0
        ? overviewApiData.topTopics.slice(0, 4)
        : postsDerivedTopics;

    const firstDbTopic = overviewApiData?.dominantTopic || (topTopicsData.length > 0 ? topTopicsData[0].title : 'Program Makan Bergizi Gratis (MBG)');

    // Top Positive / Negative / Neutral Topic dari database
    const sortedPosTopics = Object.entries(posTopicCounts).sort((a, b) => b[1] - a[1]);
    const topPositiveTopic =
      overviewApiData?.topPositiveTopic ||
      (sortedPosTopics.length > 0 ? sortedPosTopics[0][0] : firstDbTopic);

    const sortedNegTopics = Object.entries(negTopicCounts).sort((a, b) => b[1] - a[1]);
    const topNegativeTopic =
      overviewApiData?.topNegativeTopic ||
      (sortedNegTopics.length > 0 ? sortedNegTopics[0][0] : (topTopicsData[1]?.title ?? firstDbTopic));

    const sortedNeuTopics = Object.entries(neuTopicCounts).sort((a, b) => b[1] - a[1]);
    const topNeutralTopic =
      overviewApiData?.topNeutralTopic ||
      (sortedNeuTopics.length > 0 ? sortedNeuTopics[0][0] : firstDbTopic);
      overviewApiData?.topNeutralTopic ||
      (sortedNeuTopics.length > 0 ? sortedNeuTopics[0][0] : firstDbTopic);

    // Format Sentiment Trend Data: PRIORITASKAN `GET /api/sentiment/timeline`
    const postsDerivedTrend = Object.values(dailyMap)
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((dayItem: any) => {
        const sortedDayPos = Object.entries(dayItem.topics || {}).sort((a: any, b: any) => b[1] - a[1]);
        const dayPeakTopic = sortedDayPos.length > 0 ? sortedDayPos[0][0] : topPositiveTopic;
        return {
          ...dayItem,
          topPositiveTopic: dayPeakTopic
        };
      });

    const trendList: TimelinePoint[] =
      timelineApiData.length > 0
        ? timelineApiData.map(pt => ({
            ...pt,
            topPositiveTopic: pt.topPositiveTopic || topPositiveTopic
          }))
        : postsDerivedTrend;

    // Find Peak Date dari database
    let maxVal = -1;
    let peakDateStr = overviewApiData?.peakDateStr || '-';
    trendList.forEach(t => {
      const dayTotal = (t.positive || 0) + (t.neutral || 0) + (t.negative || 0);
      if (dayTotal > maxVal) {
        maxVal = dayTotal;
        peakDateStr = t.date;
      }
    });

    // Most Mentioned Entities: PRIORITASKAN `GET /api/entities?limit=4`
    const entityCounts: Record<string, { count: number; type: string }> = {};
    socialData.forEach(item => {
      if (item.entities && Array.isArray(item.entities)) {
        item.entities.forEach((ent: any) => {
          if (ent.name) {
            const eType = normalizeEntityType(ent.type);
            if (!entityCounts[ent.name]) entityCounts[ent.name] = { count: 0, type: eType };
            entityCounts[ent.name].count++;
          }
        });
      }
    });

    const sortedEntities = Object.entries(entityCounts).sort((a, b) => b[1].count - a[1].count);
    const postsDerivedEntities: EntityItem[] = sortedEntities.slice(0, 4).map(([entityName, data], idx) => ({
      rank: idx + 1,
      name: entityName,
      type: data.type,
      mentionCount: data.count,
      mentions: `${data.count.toLocaleString('id-ID')} sebutan`
    }));

    const topEntitiesData: EntityItem[] =
      entitiesApiData.length > 0
        ? entitiesApiData.slice(0, 4)
        : overviewApiData?.topEntities && overviewApiData.topEntities.length > 0
        ? overviewApiData.topEntities.slice(0, 4)
        : postsDerivedEntities;

    // Platform Distribution: GABUNGAN SELURUH PLATFORM (Instagram vs X)
    let platformDistData = {
      instagram: { percentage: 0, posts: 0 },
      x: { percentage: 0, posts: 0 }
    };

    if (combinedPlatformDist) {
      platformDistData = { ...combinedPlatformDist };
    } else if (overviewApiData?.platformDistribution && (overviewApiData.platformDistribution.instagram.posts > 0 || overviewApiData.platformDistribution.x.posts > 0)) {
      platformDistData = { ...overviewApiData.platformDistribution };
    } else if (timeFilteredRaw.length > 0) {
      let instaTotal = 0, xTotal = 0;
      timeFilteredRaw.forEach(item => {
        const p = item.platform?.toLowerCase();
        if (p === 'instagram' || p === 'ig') instaTotal++;
        else if (p === 'twitter' || p === 'x') xTotal++;
      });
      const totalDist = instaTotal + xTotal;
      const instaPerc = totalDist > 0 ? Math.round((instaTotal / totalDist) * 100) : 50;
      const xPerc = totalDist > 0 ? Math.max(0, 100 - instaPerc) : 50;
      platformDistData = {
        instagram: { percentage: instaPerc, posts: instaTotal },
        x: { percentage: xPerc, posts: xTotal }
      };
    } else {
      platformDistData = {
        instagram: { percentage: 50, posts: 0 },
        x: { percentage: 50, posts: 0 }
      };
    }

    // Pastikan jika ada totalPosts dan jumlah platform posts masih 0 atau sampel kecil, lakukan scaling
    const combinedSum = platformDistData.instagram.posts + platformDistData.x.posts;
    if (totalPosts > 0 && combinedSum <= 50) {
      const igPerc = platformDistData.instagram.percentage;
      const calculatedIg = Math.round((igPerc / 100) * totalPosts);
      const calculatedX = Math.max(0, totalPosts - calculatedIg);
      platformDistData = {
        instagram: { percentage: igPerc, posts: calculatedIg },
        x: { percentage: Math.max(0, 100 - igPerc), posts: calculatedX }
      };
    }

    return {
      totalPosts,
      positiveCount: finalPosCount,
      negativeCount: finalNegCount,
      neutralCount: finalNeuCount,
      positiveShare,
      negativeShare,
      neutralShare,
      dominantSentiment,
      topPositiveTopic,
      topNegativeTopic,
      topNeutralTopic,
      sentimentTrendData: trendList,
      topTopicsData,
      topEntitiesData,
      platformDistData,
      peakDateStr,
      totalEngagementSum: overviewApiData?.totalEngagement || totalEng || 0
    };
  }, [socialData, timeFilteredRaw, overviewApiData, topicsApiData, entitiesApiData, timelineApiData, combinedPlatformDist]);

  // Dynamic label for timeFilter dropdown
  const timeFilterLabel = useMemo(() => {
    switch (timeFilter) {
      case 'last7': return '7 hari terakhir';
      case 'last14': return '14 hari terakhir';
      case 'last30': return '30 hari terakhir';
      case 'all': return 'sepanjang waktu';
      default: return 'periode ini';
    }
  }, [timeFilter]);

  // Peak Topic payload for selectedDate
  const selectedDatePayload = useMemo(() => {
    if (!selectedDate) return null;
    return sentimentTrendData.find((item: any) => item.date === selectedDate) || null;
  }, [selectedDate, sentimentTrendData]);

  const selectedDateTopic = selectedDatePayload?.topPositiveTopic || null;

  // Active Social Data filtered by selectedDate
  const activeSocialData = useMemo(() => {
    if (!selectedDate) return socialData;
    const filtered = socialData.filter(item => {
      if (!item.timestamp) return false;
      const d = new Date(item.timestamp);
      const dayKey = `${String(d.getDate()).padStart(2, '0')} ${d.toLocaleString('default', { month: 'short' })}`;
      return dayKey === selectedDate;
    });
    return filtered.length > 0 ? filtered : socialData;
  }, [socialData, selectedDate]);

  // Responsive Platform Distribution for selectedDate (dari database)
  const activePlatformDistData = useMemo(() => {
    if (!selectedDate || timeFilteredRaw.length === 0) return platformDistData;
    let instaTotal = 0, xTotal = 0;
    timeFilteredRaw.forEach(item => {
      if (!item.timestamp) return;
      const d = new Date(item.timestamp);
      const dayKey = `${String(d.getDate()).padStart(2, '0')} ${d.toLocaleString('default', { month: 'short' })}`;
      if (dayKey !== selectedDate) return;
      const p = item.platform?.toLowerCase();
      if (p === 'instagram' || p === 'ig') instaTotal++;
      else if (p === 'twitter' || p === 'x') xTotal++;
    });
    const totalDist = instaTotal + xTotal;
    if (totalDist === 0) return platformDistData;
    const instaPerc = Math.round((instaTotal / totalDist) * 100);
    const xPerc = Math.max(0, 100 - instaPerc);

    const targetTrend = sentimentTrendData.find((t: any) => t.date === selectedDate);
    const dateTotal = targetTrend ? (targetTrend.positive + targetTrend.neutral + targetTrend.negative) : totalDist;
    const calculatedIgPosts = dateTotal > totalDist ? Math.round((instaPerc / 100) * dateTotal) : instaTotal;
    const calculatedXPosts = dateTotal > totalDist ? Math.max(0, dateTotal - calculatedIgPosts) : xTotal;

    return {
      instagram: { percentage: instaPerc, posts: calculatedIgPosts },
      x: { percentage: xPerc, posts: calculatedXPosts }
    };
  }, [selectedDate, timeFilteredRaw, platformDistData, sentimentTrendData]);

  // Responsive Top Topics for selectedDate (dari database)
  const activeTopTopicsData = useMemo(() => {
    if (!selectedDate || activeSocialData.length === 0) return topTopicsData;
    const topicCounts: Record<string, number> = {};
    activeSocialData.forEach(item => {
      if (item.topic) topicCounts[item.topic] = (topicCounts[item.topic] || 0) + 1;
    });
    const sorted = Object.entries(topicCounts).sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) return topTopicsData;
    const dayTotal = activeSocialData.length || 1;
    return sorted.slice(0, 4).map(([title, count], idx) => ({
      rank: idx + 1,
      title,
      postCount: count,
      posts: `${count.toLocaleString('id-ID')} postingan (${selectedDate})`,
      growth: title === selectedDateTopic ? '★ Peak Topic' : `${((count / dayTotal) * 100).toFixed(1)}% share`
    }));
  }, [selectedDate, activeSocialData, topTopicsData, selectedDateTopic]);

  // Responsive Most Mentioned Entities for selectedDate (dari database)
  const activeTopEntitiesData = useMemo(() => {
    if (!selectedDate || activeSocialData.length === 0) return topEntitiesData;
    const entityCounts: Record<string, { count: number; type: string }> = {};
    activeSocialData.forEach(item => {
      if (item.entities && Array.isArray(item.entities)) {
        item.entities.forEach((ent: any) => {
          if (ent.name) {
            const eType = normalizeEntityType(ent.type);
            if (!entityCounts[ent.name]) entityCounts[ent.name] = { count: 0, type: eType };
            entityCounts[ent.name].count++;
          }
        });
      }
    });
    const sorted = Object.entries(entityCounts).sort((a, b) => b[1].count - a[1].count);
    if (sorted.length === 0) return topEntitiesData;
    return sorted.slice(0, 4).map(([name, data], idx) => ({
      rank: idx + 1,
      name,
      type: data.type,
      mentionCount: data.count,
      mentions: `${data.count.toLocaleString('id-ID')} sebutan (${selectedDate})`
    }));
  }, [selectedDate, activeSocialData, topEntitiesData]);

  // Previous Period Statistics for accurate comparison
  const prevPeriodStats = useMemo(() => {
    let maxDate = new Date(0);
    socialDataRaw.forEach(item => {
      const d = new Date(item.timestamp);
      if (d > maxDate) maxDate = d;
    });

    let prevItems: any[] = [];
    const isPlatformMatch = (p?: string) => {
      if (!p) return false;
      const pl = p.toLowerCase();
      return activeTab === 'x' ? (pl === 'x' || pl === 'twitter') : (pl === 'instagram' || pl === 'ig');
    };

    if (timeFilter === 'last7') {
      const c1 = new Date(maxDate); c1.setDate(c1.getDate() - 7);
      const c2 = new Date(maxDate); c2.setDate(c2.getDate() - 14);
      prevItems = socialDataRaw.filter(d => isPlatformMatch(d.platform) && new Date(d.timestamp) >= c2 && new Date(d.timestamp) < c1);
    } else if (timeFilter === 'last14') {
      const c1 = new Date(maxDate); c1.setDate(c1.getDate() - 14);
      const c2 = new Date(maxDate); c2.setDate(c2.getDate() - 28);
      prevItems = socialDataRaw.filter(d => isPlatformMatch(d.platform) && new Date(d.timestamp) >= c2 && new Date(d.timestamp) < c1);
    } else if (timeFilter === 'last30') {
      const c1 = new Date(maxDate); c1.setDate(c1.getDate() - 30);
      const c2 = new Date(maxDate); c2.setDate(c2.getDate() - 60);
      prevItems = socialDataRaw.filter(d => isPlatformMatch(d.platform) && new Date(d.timestamp) >= c2 && new Date(d.timestamp) < c1);
    } else {
      let minDate = new Date(maxDate);
      socialDataRaw.forEach(d => { const dt = new Date(d.timestamp); if (dt < minDate) minDate = dt; });
      const mid = new Date((minDate.getTime() + maxDate.getTime()) / 2);
      prevItems = socialDataRaw.filter(d => isPlatformMatch(d.platform) && new Date(d.timestamp) < mid);
    }

    const prevTotal = prevItems.length || 1;
    let prevPos = 0, prevNeg = 0, prevNeu = 0;
    prevItems.forEach(d => {
      if (d.sentiment === 'positive') prevPos++;
      else if (d.sentiment === 'negative') prevNeg++;
      else prevNeu++;
    });

    return {
      posShare: (prevPos / prevTotal) * 100,
      negShare: (prevNeg / prevTotal) * 100,
      neuShare: (prevNeu / prevTotal) * 100
    };
  }, [socialDataRaw, timeFilter, activeTab, isRefreshing]);

  // Dynamic period label in English and Indonesian
  const periodLabelEn = useMemo(() => {
    if (selectedDate) return `on ${selectedDate}`;
    switch (timeFilter) {
      case 'last7': return 'this week';
      case 'last14': return 'in past 14 days';
      case 'last30': return 'in past 30 days';
      case 'all': return 'overall';
      default: return 'in this period';
    }
  }, [selectedDate, timeFilter]);

  // Dynamic Active Statistics for Callout Banner (sinkron dengan data riil GET /api/dashboard/overview)
  const activeDominantStats = useMemo(() => {
    // Jika user tidak mengklik tanggal tertentu di chart, gunakan langsung nilai riil dari Overview API
    if (!selectedDate) {
      const posShare = parseFloat(positiveShare) || 0;
      const negShare = parseFloat(negativeShare) || 0;
      const neuShare = parseFloat(neutralShare) || 0;

      const dominant = dominantSentiment;
      let dominantShare = neuShare;
      let dominantTopic = topNeutralTopic || topPositiveTopic || 'Program Makan Bergizi Gratis (MBG)';
      let prevShare = prevPeriodStats.neuShare;

      if (dominant === 'positive') {
        dominantShare = posShare;
        dominantTopic = topPositiveTopic || 'Program Makan Bergizi Gratis (MBG)';
        prevShare = prevPeriodStats.posShare;
      } else if (dominant === 'negative') {
        dominantShare = negShare;
        dominantTopic = topNegativeTopic || 'Program Makan Bergizi Gratis (MBG)';
        prevShare = prevPeriodStats.negShare;
      }

      const diff = prevShare > 0 ? dominantShare - prevShare : 0;
      const badgeText =
        prevShare > 0
          ? `${diff >= 0 ? '↑' : '↓'} ${Math.abs(diff).toFixed(1)}% vs. prev`
          : `${dominantShare.toFixed(1)}% share`;

      let badgeBg = '#e2e8f0';
      let badgeColor = '#334155';
      if (dominant === 'positive') {
        badgeBg = diff >= 0 ? '#dcfce7' : '#fee2e2';
        badgeColor = diff >= 0 ? '#15803d' : '#dc2626';
      } else if (dominant === 'negative') {
        badgeBg = diff >= 0 ? '#fee2e2' : '#dcfce7';
        badgeColor = diff >= 0 ? '#991b1b' : '#15803d';
      }

      return {
        dominant,
        dominantShare: dominantShare.toFixed(1),
        dominantTopic,
        diff,
        badgeText,
        badgeBg,
        badgeColor
      };
    }

    // Jika user memilih tanggal spesifik pada grafik timeline
    const dayPayload = sentimentTrendData.find((item: any) => item.date === selectedDate);
    if (dayPayload) {
      const pos = Number(dayPayload.positive || 0);
      const neg = Number(dayPayload.negative || 0);
      const neu = Number(dayPayload.neutral || 0);
      const total = pos + neg + neu || 1;

      const posShare = (pos / total) * 100;
      const negShare = (neg / total) * 100;
      const neuShare = (neu / total) * 100;

      let dominant: 'positive' | 'negative' | 'neutral' = 'neutral';
      if (pos > neu && pos > neg) dominant = 'positive';
      else if (neg > neu && neg > pos) dominant = 'negative';

      const dominantShare = dominant === 'positive' ? posShare : dominant === 'negative' ? negShare : neuShare;
      const overallShare =
        dominant === 'positive'
          ? parseFloat(positiveShare)
          : dominant === 'negative'
          ? parseFloat(negativeShare)
          : parseFloat(neutralShare);
      const diff = dominantShare - overallShare;

      return {
        dominant,
        dominantShare: dominantShare.toFixed(1),
        dominantTopic: dayPayload.topPositiveTopic || topPositiveTopic || 'Program Makan Bergizi Gratis (MBG)',
        diff,
        badgeText: `${diff >= 0 ? '↑' : '↓'} ${Math.abs(diff).toFixed(1)}% vs. avg`,
        badgeBg: dominant === 'positive' ? '#dcfce7' : dominant === 'negative' ? '#fee2e2' : '#e2e8f0',
        badgeColor: dominant === 'positive' ? '#15803d' : dominant === 'negative' ? '#991b1b' : '#334155'
      };
    }

    return {
      dominant: dominantSentiment,
      dominantShare: neutralShare,
      dominantTopic: topNeutralTopic || 'Program Makan Bergizi Gratis (MBG)',
      diff: 0,
      badgeText: `${neutralShare}% share`,
      badgeBg: '#e2e8f0',
      badgeColor: '#334155'
    };
  }, [
    selectedDate,
    dominantSentiment,
    positiveShare,
    negativeShare,
    neutralShare,
    topPositiveTopic,
    topNegativeTopic,
    topNeutralTopic,
    prevPeriodStats,
    sentimentTrendData
  ]);

  // Dynamic banner configuration sesuai instruksi Backend (poin #3)
  const bannerConfig = useMemo(() => {
    const { dominant, dominantShare, dominantTopic, badgeText, badgeBg, badgeColor } = activeDominantStats;
    const topicLabel = dominantTopic && dominantTopic !== '-' ? dominantTopic : 'Program Makan Bergizi Gratis (MBG)';

    if (dominant === 'negative') {
      return {
        bgContainer: '#fef2f2',
        borderContainer: '#fecaca',
        bgIcon: '#fee2e2',
        colorIcon: '#dc2626',
        title: selectedDate ? (
          <>Negative sentiment emerged as dominant on {selectedDate}</>
        ) : timeFilter === 'all' ? (
          <>
            <span style={{ color: '#dc2626' }}>Negative sentiment</span> emerged as <span style={{ color: '#dc2626' }}>dominant</span> overall
          </>
        ) : (
          <>Weekly Sentiment Overview — Negative Dominant</>
        ),
        desc:
          overviewApiData?.narrativeSummary ||
          (selectedDate
            ? `Percakapan negatif mendominasi pada ${selectedDate} dengan proporsi ${dominantShare}%, didorong oleh sorotan kritis terhadap ${topicLabel}.`
            : `Percakapan seputar ${topicLabel} didominasi sentimen negatif dengan proporsi ${dominantShare}%, didorong oleh sorotan kritis dan keluhan publik di media sosial.`),
        metricLabel: 'Negative share',
        metricValue: `${dominantShare}%`,
        badgeText,
        badgeBg,
        badgeColor,
        chartTitle: `Negative sentiment surged ${periodLabelEn}`,
        icon: (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline>
            <polyline points="17 18 23 18 23 12"></polyline>
          </svg>
        )
      };
    }

    if (dominant === 'neutral') {
      return {
        bgContainer: '#f8fafc',
        borderContainer: '#cbd5e1',
        bgIcon: '#e2e8f0',
        colorIcon: '#475569',
        title: selectedDate ? (
          <>Neutral sentiment remained dominant on {selectedDate}</>
        ) : timeFilter === 'all' ? (
          <>
            <span style={{ color: '#475569' }}>Neutral sentiment</span> remained <span style={{ color: '#475569' }}>dominant</span> overall
          </>
        ) : (
          <>Weekly Sentiment Overview</>
        ),
        desc:
          overviewApiData?.narrativeSummary ||
          (selectedDate
            ? `Percakapan seputar ${topicLabel} cenderung netral pada ${selectedDate} dengan proporsi ${dominantShare}%, didorong oleh diskusi informatif di media sosial.`
            : `Percakapan seputar ${topicLabel} cenderung netral dan stabil dengan proporsi ${dominantShare}%, didorong oleh diskusi informatif dan perkembangan terkini di media sosial.`),
        metricLabel: 'Neutral share',
        metricValue: `${dominantShare}%`,
        badgeText,
        badgeBg,
        badgeColor,
        chartTitle:
          timeFilter === 'all'
            ? 'Neutral sentiment remained dominant overall'
            : `Neutral sentiment remained steady ${periodLabelEn}`,
        icon: (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        )
      };
    }

    // Default 'positive'
    return {
      bgContainer: '#e6f7ee',
      borderContainer: '#bbf7d0',
      bgIcon: '#dcfce7',
      colorIcon: '#16a34a',
      title: selectedDate ? (
        <>Positive sentiment remained dominant on {selectedDate}</>
      ) : timeFilter === 'all' ? (
        <>
          <span style={{ color: '#16a34a' }}>Positive sentiment</span> remained <span style={{ color: '#16a34a' }}>dominant</span> overall
        </>
      ) : (
        <>Weekly Sentiment Overview</>
      ),
      desc:
        overviewApiData?.narrativeSummary ||
        (selectedDate
          ? `Percakapan positif mendominasi pada ${selectedDate} dengan proporsi ${dominantShare}%, didorong oleh respon positif terhadap ${topicLabel}.`
          : `Percakapan seputar ${topicLabel} didominasi sentimen positif dengan proporsi ${dominantShare}%, didorong oleh apresiasi dan dukungan publik di media sosial.`),
      metricLabel: 'Positive share',
      metricValue: `${dominantShare}%`,
      badgeText,
      badgeBg,
      badgeColor,
      chartTitle: `Positive sentiment dominated ${periodLabelEn}`,
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
          <polyline points="17 6 23 6 23 12"></polyline>
        </svg>
      )
    };
  }, [activeDominantStats, overviewApiData, periodLabelEn, selectedDate, timeFilter]);

  // Dynamic Sentiment & Topic Inspector untuk Hover Tooltip & Floating Badge
  const getDailySentimentInfo = (data: any) => {
    const fallbackTopic =
      activeDominantStats.dominantTopic ||
      overviewApiData?.dominantTopic ||
      'Program Makan Bergizi Gratis (MBG)';

    if (!data) {
      return {
        type: 'neutral',
        label: 'Sentimen Dominan: Netral',
        badgeBg: '#f1f5f9',
        badgeBorder: '#cbd5e1',
        textColor: '#334155',
        topic: fallbackTopic
      };
    }

    const pos = Number(data.positive || 0);
    const neu = Number(data.neutral || 0);
    const neg = Number(data.negative || 0);

    if (pos > neu && pos >= neg) {
      return {
        type: 'positive',
        label: 'Sentimen Dominan: Positif',
        badgeBg: '#dcfce7',
        badgeBorder: '#86efac',
        textColor: '#166534',
        topic: data.topPositiveTopic || topPositiveTopic || fallbackTopic
      };
    } else if (neg > neu && neg > pos) {
      return {
        type: 'negative',
        label: 'Sentimen Dominan: Negatif',
        badgeBg: '#fee2e2',
        badgeBorder: '#fca5a5',
        textColor: '#991b1b',
        topic: data.topNegativeTopic || topNegativeTopic || fallbackTopic
      };
    } else {
      return {
        type: 'neutral',
        label: 'Sentimen Dominan: Netral',
        badgeBg: '#f1f5f9',
        badgeBorder: '#cbd5e1',
        textColor: '#334155',
        topic: data.topNeutralTopic || data.dominant_topic || topNeutralTopic || fallbackTopic
      };
    }
  };

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '20px', opacity: isRefreshing ? 0.6 : 1, transition: 'opacity 0.2s', width: '100%', boxSizing: 'border-box' }}>

      {/* Sub-Header / Control Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '15px' }}>
        <div style={{ textAlign: 'left' }}>
          {/* Status Indicator & Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: isLoadingData ? '#f59e0b' : apiError ? '#ef4444' : '#10b981',
              display: 'inline-block'
            }}></span>
            <span style={{ fontSize: '13px', color: theme.textMuted, fontWeight: '600' }}>
              {isLoadingData
                ? 'Memuat data dari PostgreSQL (FastAPI)...'
                : apiError
                ? 'Koneksi FastAPI Terputus'
                : `PostgreSQL Live • Updated ${lastUpdatedTime}`}
            </span>
          </div>
          <div style={{ fontSize: '11px', fontWeight: '700', color: theme.textMuted, letterSpacing: '0.8px', marginBottom: '6px', textTransform: 'uppercase' }}>
            SOCIAL MEDIA ANALYSIS &gt; {activeTab.toUpperCase()}
          </div>
          <h1 style={{ color: theme.textMain, margin: '0 0 4px 0', fontSize: '26px', fontWeight: '800', letterSpacing: '-0.5px' }}>Narrative Overview</h1>
          <p style={{ color: theme.textMuted, margin: 0, fontSize: '14px' }}>
            {getTimeSubtitle(timeFilter)}
          </p>
        </div>

        {/* Top Dropdown Filters */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={loadPostsFromFastApi}
            disabled={isLoadingData}
            style={{
              padding: '10px 14px',
              borderRadius: '10px',
              backgroundColor: theme.bgCard,
              color: theme.textMain,
              border: `1px solid ${theme.border}`,
              fontSize: '13px',
              fontWeight: '700',
              cursor: isLoadingData ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
            title="Sinkronkan ulang dari PostgreSQL (FastAPI)"
          >
            ↻ {isLoadingData ? 'Memuat...' : 'Refresh Data'}
          </button>
          <div style={{ position: 'relative' }}>
            <select
              style={{
                padding: '10px 36px 10px 16px',
                borderRadius: '10px',
                backgroundColor: theme.bgCard,
                color: theme.textMain,
                border: `1px solid ${theme.border}`,
                outline: 'none',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                appearance: 'none'
              }}
              value={timeFilter}
              onChange={(e) => handleTimeFilterChange(e.target.value)}
            >
              <option value="last7">7 Hari Terakhir</option>
              <option value="last14">14 Hari Terakhir</option>
              <option value="last30">30 Hari Terakhir</option>
              <option value="all">Sepanjang Waktu</option>
            </select>
            <span style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: theme.textMuted, fontSize: '12px' }}>▼</span>
          </div>
        </div>
      </div>

      {/* API Error Notification Banner */}
      {apiError && (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#b91c1c',
          padding: '12px 16px',
          borderRadius: '12px',
          fontSize: '13px',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}>
          <span>⚠️ Gagal mengambil data dari FastAPI ({import.meta.env.VITE_API_BASE_URL}): {apiError}</span>
          <button
            type="button"
            onClick={loadPostsFromFastApi}
            style={{
              backgroundColor: '#dc2626',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* Platform Pills Tab Switcher */}
      <div style={{
        display: 'flex',
        backgroundColor: '#dbeafe',
        borderRadius: '14px',
        padding: '6px',
        gap: '6px',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <button
          onClick={() => handleTabChange('instagram')}
          style={{
            flex: 1,
            padding: '14px 20px',
            borderRadius: '10px',
            border: 'none',
            backgroundColor: activeTab === 'instagram' ? theme.bgCard : 'transparent',
            color: activeTab === 'instagram' ? '#003399' : theme.textMuted,
            fontWeight: '800',
            fontSize: '16px',
            cursor: 'pointer',
            boxShadow: activeTab === 'instagram' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
            transition: 'all 0.2s ease'
          }}
        >
          Instagram
        </button>
        <button
          onClick={() => handleTabChange('x')}
          style={{
            flex: 1,
            padding: '14px 20px',
            borderRadius: '10px',
            border: 'none',
            backgroundColor: activeTab === 'x' ? theme.bgCard : 'transparent',
            color: activeTab === 'x' ? '#003399' : theme.textMuted,
            fontWeight: '800',
            fontSize: '16px',
            cursor: 'pointer',
            boxShadow: activeTab === 'x' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
            transition: 'all 0.2s ease'
          }}
        >
          X
        </button>
      </div>

      {/* Dynamic Sentiment Callout Banner */}
      <div style={{
        backgroundColor: bannerConfig.bgContainer,
        borderRadius: '16px',
        border: `1px solid ${bannerConfig.borderContainer}`,
        padding: '20px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '20px',
        transition: 'all 0.3s ease'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: '1 1 500px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            backgroundColor: bannerConfig.bgIcon,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            {bannerConfig.icon}
          </div>
          <div style={{ textAlign: 'left' }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
              {bannerConfig.title}
            </h3>
            <p style={{ margin: 0, fontSize: '14px', color: '#475569' }}>
              {bannerConfig.desc}
            </p>
          </div>
        </div>

        {/* Right Badge Metric Box */}
        <div style={{
          backgroundColor: theme.bgCard,
          padding: '12px 20px',
          borderRadius: '12px',
          border: `1px solid ${theme.border}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          minWidth: '150px'
        }}>
          <span style={{ fontSize: '11px', color: theme.textMuted, fontWeight: '600' }}>{bannerConfig.metricLabel}</span>
          <span style={{ fontSize: '24px', fontWeight: '900', color: theme.textMain, margin: '2px 0' }}>{bannerConfig.metricValue}</span>
          <span style={{
            fontSize: '11px',
            fontWeight: '700',
            color: bannerConfig.badgeColor,
            backgroundColor: bannerConfig.badgeBg,
            padding: '2px 8px',
            borderRadius: '12px'
          }}>
            {bannerConfig.badgeText}
          </span>
        </div>
      </div>

      {/* Row 1: 4 Metric Cards */}
      <SummaryCards
        theme={theme}
        data={socialData}
        overviewStats={overviewApiData}
        topicsCount={topicsApiData.length}
        entitiesCount={entitiesApiData.length}
        type="overview"
        timeFilter={timeFilter}
      />

      {/* Row 2: Line Chart (2/3) on Left | Key Insight + Platform Distribution Stack (1/3) on Right */}
      <div style={{ display: 'flex', gap: '20px', alignItems: 'stretch', flexWrap: 'wrap' }}>

        {/* Left 2/3: Sentiment Trend Line Chart Card */}
        <article className="card-hover-effect" style={{
          flex: '2 1 540px',
          padding: '24px',
          backgroundColor: theme.bgCard,
          borderRadius: '16px',
          border: `1px solid ${theme.border}`,
          boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          textAlign: 'left'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <h3 style={{ color: theme.textMain, margin: 0, fontSize: '18px', fontWeight: '800' }}>{bannerConfig.chartTitle}</h3>
            {selectedDate && (
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#0284c7', backgroundColor: '#e0f2fe', padding: '2px 8px', borderRadius: '6px' }}>
                Tanggal Terpilih: {selectedDate}
              </span>
            )}
          </div>
          <p style={{ color: theme.textMuted, margin: '0 0 16px 0', fontSize: '13px' }}>
            Daily conversation tone across platforms (Klik titik tanggal untuk memfilter Knowledge Graph)
          </p>

          {/* Active Date Reset Filter Banner */}
          {selectedDate && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '10px',
              padding: '8px 14px',
              marginBottom: '16px',
              fontSize: '13px',
              color: '#166534'
            }}>
              <span>
                📅 Tanggal: <strong>{selectedDate}</strong> | Peak Topic: <strong>{selectedDateTopic || 'General'}</strong>
              </span>
              <button
                onClick={() => setSelectedDate(null)}
                style={{
                  background: '#dcfce7',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '12px',
                  fontWeight: '700',
                  color: '#15803d',
                  cursor: 'pointer'
                }}
              >
                ✕ Reset Tanggal
              </button>
            </div>
          )}

          <div style={{ height: 280, position: 'relative', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            {/* Callout Tag on Peak Point - ONLY shown on graph hover */}
            {hoveredTrendData && (() => {
              const daySent = getDailySentimentInfo(hoveredTrendData);
              return (
                <div style={{
                  position: 'absolute',
                  top: '10px',
                  right: '18%',
                  zIndex: 10,
                  backgroundColor: daySent.badgeBg,
                  border: `1px solid ${daySent.badgeBorder}`,
                  padding: '6px 12px',
                  borderRadius: '8px',
                  fontSize: '11px',
                  fontWeight: '700',
                  color: daySent.textColor,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  pointerEvents: 'none',
                  transition: 'all 0.15s ease'
                }}>
                  {daySent.label}: <br />
                  <strong style={{ fontSize: '13px', display: 'inline-block', marginTop: '2px' }}>
                    {daySent.topic}
                  </strong>
                </div>
              );
            })()}

            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={sentimentTrendData}
                margin={{ top: 20, right: 20, left: -20, bottom: 0 }}
                style={{ cursor: 'pointer' }}
                onClick={(state: any) => {
                  if (state && state.activeLabel) {
                    setSelectedDate(prev => prev === state.activeLabel ? null : state.activeLabel);
                  }
                }}
                onMouseMove={(state: any) => {
                  if (state && state.activePayload && state.activePayload.length) {
                    setHoveredTrendData(state.activePayload[0].payload);
                  }
                }}
                onMouseLeave={() => setHoveredTrendData(null)}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" stroke={theme.textMuted} tickLine={false} style={{ fontSize: '12px' }} />
                <YAxis stroke={theme.textMuted} tickLine={false} axisLine={false} style={{ fontSize: '12px' }} />
                <Tooltip
                  content={({ active, payload, label }: any) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      const daySent = getDailySentimentInfo(data);
                      return (
                        <div style={{
                          backgroundColor: theme.bgCard,
                          border: `1px solid ${theme.border}`,
                          borderRadius: '12px',
                          padding: '12px 14px',
                          boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                          textAlign: 'left'
                        }}>
                          <div style={{
                            backgroundColor: daySent.badgeBg,
                            border: `1px solid ${daySent.badgeBorder}`,
                            padding: '6px 10px',
                            borderRadius: '8px',
                            marginBottom: '10px',
                            fontSize: '11px',
                            fontWeight: '700',
                            color: daySent.textColor
                          }}>
                            <div>{daySent.label}:</div>
                            <div style={{ fontSize: '13px', fontWeight: '800', marginTop: '2px' }}>{daySent.topic}</div>
                          </div>
                          <div style={{ fontSize: '12px', fontWeight: '800', color: theme.textMain, marginBottom: '6px' }}>{label}</div>
                          {payload.map((entry: any, index: number) => (
                            <div key={`item-${index}`} style={{ fontSize: '12px', color: entry.color, fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: entry.color, display: 'inline-block' }}></span>
                              <span>{entry.name}: <strong>{entry.value}</strong></span>
                            </div>
                          ))}
                          <div style={{ fontSize: '11px', color: '#0284c7', marginTop: '8px', fontStyle: 'italic', fontWeight: '600' }}>
                            💡 Klik untuk memfilter Knowledge Graph
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line type="monotone" dataKey="positive" name="Positive" stroke="#10b981" strokeWidth={3} dot={{ r: 5, fill: '#10b981' }} activeDot={{ r: 7 }} />
                <Line type="monotone" dataKey="neutral" name="Neutral" stroke="#475569" strokeWidth={2} dot={{ r: 4, fill: '#475569' }} />
                <Line type="monotone" dataKey="negative" name="Negative" stroke="#ef4444" strokeWidth={2} dot={{ r: 4, fill: '#ef4444' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Custom Chart Legend */}
          <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', marginTop: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '600', color: theme.textMain }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10b981' }}></span> Positive
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '600', color: theme.textMain }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#475569' }}></span> Neutral
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '600', color: theme.textMain }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ef4444' }}></span> Negative
            </div>
          </div>
        </article>

        {/* Right 1/3 Column: Stacked Key Insight + Platform Distribution */}
        <div style={{ flex: '1 1 320px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Key Insight Card */}
          <article className="card-hover-effect" style={{
            padding: '24px',
            backgroundColor: theme.bgCard,
            borderRadius: '16px',
            border: `1px solid ${theme.border}`,
            boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            textAlign: 'left',
            flex: 1
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: '#e0f2fe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0284c7'
              }}>
                {/* Lightbulb Icon */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18h6"></path>
                  <path d="M10 22h4"></path>
                  <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1.55.59 2.94 1.5 4 .76.76 1.23 1.52 1.41 2.5"></path>
                </svg>
              </div>
              <div>
                <h3 style={{ color: theme.textMain, margin: 0, fontSize: '18px', fontWeight: '800' }}>Key Insight</h3>
                <span style={{ fontSize: '11px', color: theme.textMuted, fontWeight: '700' }}>Rentang: {timeFilterLabel}</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, justifyContent: 'center' }}>
              {overviewApiData?.keyInsights && overviewApiData.keyInsights.length > 0 ? (
                overviewApiData.keyInsights.slice(0, 3).map((ins, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: '#dcfce7',
                      color: '#16a34a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: '800',
                      fontSize: '14px',
                      flexShrink: 0
                    }}>{idx + 1}</div>
                    <div>
                      <h4 style={{ margin: '0 0 2px 0', fontSize: '14px', fontWeight: '800', color: theme.textMain }}>{ins.title}</h4>
                      <p style={{ margin: 0, fontSize: '12px', color: theme.textMuted, lineHeight: '1.4' }}>
                        {ins.description}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <>
                  {/* Insight 1 (Dinamis dari Database) */}
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: '#dcfce7',
                      color: '#16a34a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: '800',
                      fontSize: '14px',
                      flexShrink: 0
                    }}>1</div>
                    <div>
                      <h4 style={{ margin: '0 0 2px 0', fontSize: '14px', fontWeight: '800', color: theme.textMain }}>
                        Sentimen {dominantSentiment === 'negative' ? `negatif (${negativeShare}%)` : dominantSentiment === 'neutral' ? `netral (${neutralShare}%)` : `positif (${positiveShare}%)`} dominan
                      </h4>
                      <p style={{ margin: 0, fontSize: '12px', color: theme.textMuted, lineHeight: '1.4' }}>
                        {totalPosts > 0
                          ? <>Puncak tren pada <strong>{peakDateStr !== '-' ? peakDateStr : timeFilterLabel}</strong> dipicu oleh diskusi seputar <strong>{activeDominantStats.dominantTopic || topPositiveTopic || 'Program Makan Bergizi Gratis (MBG)'}</strong>.</>
                          : 'Menunggu data percakapan dari database.'}
                      </p>
                    </div>
                  </div>

                  {/* Insight 2 (Dinamis dari Database) */}
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: '#dcfce7',
                      color: '#16a34a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: '800',
                      fontSize: '14px',
                      flexShrink: 0
                    }}>2</div>
                    <div>
                      <h4 style={{ margin: '0 0 2px 0', fontSize: '14px', fontWeight: '800', color: theme.textMain }}>
                        {((activePlatformDistData.instagram.posts + activePlatformDistData.x.posts) || totalPosts).toLocaleString('id-ID')} Postingan Dianalisis
                      </h4>
                      <p style={{ margin: 0, fontSize: '12px', color: theme.textMuted, lineHeight: '1.4' }}>
                        Distribusi gabungan platform terdiri dari Instagram ({activePlatformDistData.instagram.percentage}% / {activePlatformDistData.instagram.posts.toLocaleString('id-ID')} posts) dan X ({activePlatformDistData.x.percentage}% / {activePlatformDistData.x.posts.toLocaleString('id-ID')} posts) pada {timeFilterLabel}.
                      </p>
                    </div>
                  </div>

                  {/* Insight 3 (Dinamis dari Database) */}
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: '#dcfce7',
                      color: '#16a34a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: '800',
                      fontSize: '14px',
                      flexShrink: 0
                    }}>3</div>
                    <div>
                      <h4 style={{ margin: '0 0 2px 0', fontSize: '14px', fontWeight: '800', color: theme.textMain }}>
                        Fokus isu negatif ({negativeCount.toLocaleString('id-ID')} posts)
                      </h4>
                      <p style={{ margin: 0, fontSize: '12px', color: theme.textMuted, lineHeight: '1.4' }}>
                        {negativeCount > 0
                          ? <>Percakapan negatif pada {timeFilterLabel} berkisar pada topik <strong>{topNegativeTopic}</strong>.</>
                          : `Tidak ditemukan lonjakan percakapan negatif pada ${timeFilterLabel}.`}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </article>

          {/* Platform Distribution Card */}
          <article className="card-hover-effect" style={{
            padding: '24px',
            backgroundColor: theme.bgCard,
            borderRadius: '16px',
            border: `1px solid ${theme.border}`,
            boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            textAlign: 'left',
            flex: 1
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: '#e0f2fe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0284c7'
              }}>
                {/* Pie/Donut Chart Icon */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path>
                  <path d="M22 12A10 10 0 0 0 12 2v10z"></path>
                </svg>
              </div>
              <div>
                <h3 style={{ color: theme.textMain, margin: 0, fontSize: '18px', fontWeight: '800' }}>Platform Distribution</h3>
                <p style={{ color: theme.textMuted, margin: '2px 0 0 0', fontSize: '12px' }}>
                  {selectedDate ? `Proporsi gabungan platform (${selectedDate})` : 'Proporsi gabungan seluruh platform (Instagram & X)'}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, justifyContent: 'center' }}>
              {/* Instagram Row */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff'
                    }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                      </svg>
                    </div>
                    <span style={{ fontSize: '15px', fontWeight: '800', color: theme.textMain }}>Instagram</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '14px', fontWeight: '800', color: theme.textMain }}>{activePlatformDistData.instagram.percentage}%</span>
                    <span style={{ fontSize: '12px', color: theme.textMuted, marginLeft: '8px' }}>~ {activePlatformDistData.instagram.posts.toLocaleString('id-ID')} posts</span>
                  </div>
                </div>
                <div style={{ height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${activePlatformDistData.instagram.percentage}%`, height: '100%', background: 'linear-gradient(90deg, #c084fc, #a855f7)', borderRadius: '4px' }}></div>
                </div>
              </div>

              {/* X / Twitter Row */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      backgroundColor: '#0f172a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff'
                    }}>
                      <span style={{ fontWeight: '900', fontSize: '14px' }}>X</span>
                    </div>
                    <span style={{ fontSize: '15px', fontWeight: '800', color: theme.textMain }}>X</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '14px', fontWeight: '800', color: theme.textMain }}>{activePlatformDistData.x.percentage}%</span>
                    <span style={{ fontSize: '12px', color: theme.textMuted, marginLeft: '8px' }}>~ {activePlatformDistData.x.posts.toLocaleString('id-ID')} posts</span>
                  </div>
                </div>
                <div style={{ height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${activePlatformDistData.x.percentage}%`, height: '100%', backgroundColor: '#475569', borderRadius: '4px' }}></div>
                </div>
              </div>
            </div>
          </article>

        </div>

      </div>

      {/* Row 3: Bottom Section - Knowledge Graph (2/3) on Left | Top Topics & Most Mentioned Entities (1/3) on Right */}
      <div style={{ display: 'flex', gap: '20px', alignItems: 'stretch', flexWrap: 'wrap' }}>

        {/* Left 2/3: Knowledge Graph Card (Directly below Line Chart) */}
        <div style={{ flex: '2 1 540px', display: 'flex', flexDirection: 'column' }}>
          <KnowledgeGraph
            theme={theme}
            isDark={isDark}
            timeFilter={timeFilter}
            platformFilter={activeTab}
            isRefreshing={isRefreshing}
            embedded={true}
            selectedTopic={selectedDateTopic}
            postsData={socialDataRaw}
          />
        </div>

        {/* Right 1/3 Column: Stacked Top Topics + Most Mentioned Entities */}
        <div style={{ flex: '1 1 320px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Top Topics Driving Conversation Card */}
          <article className="card-hover-effect" style={{
            padding: '24px',
            backgroundColor: theme.bgCard,
            borderRadius: '16px',
            border: `1px solid ${theme.border}`,
            boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            textAlign: 'left',
            flex: 1
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: '#e0f2fe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0284c7'
              }}>
                {/* Hash Icon */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="4" y1="9" x2="20" y2="9"></line>
                  <line x1="4" y1="15" x2="20" y2="15"></line>
                  <line x1="10" y1="3" x2="8" y2="21"></line>
                  <line x1="16" y1="3" x2="14" y2="21"></line>
                </svg>
              </div>
              <div>
                <h3 style={{ color: theme.textMain, margin: 0, fontSize: '18px', fontWeight: '800' }}>Top Topics Driving Conversation</h3>
                <p style={{ color: theme.textMuted, margin: '2px 0 0 0', fontSize: '12px' }}>
                  {selectedDate ? `Topik teratas pada ${selectedDate}` : 'Based on total post and growth rate'}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, justifyContent: 'center' }}>
              {activeTopTopicsData.length === 0 ? (
                <div style={{ padding: '24px 12px', textAlign: 'center', color: theme.textMuted, fontSize: '13px' }}>
                  {isLoadingData ? 'Memuat topik dari database...' : 'Belum ada data topik dari database.'}
                </div>
              ) : (
                activeTopTopicsData.map((topic) => (
                  <div key={topic.rank} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 14px',
                    backgroundColor: topic.title === selectedDateTopic ? '#f0fdf4' : (isDark ? '#1e293b' : '#f8fafc'),
                    borderRadius: '10px',
                    border: topic.title === selectedDateTopic ? '1px solid #86efac' : `1px solid ${theme.border}`
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '800', color: theme.textMuted, width: '20px' }}>#{topic.rank}</span>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: theme.textMain }}>{topic.title}</h4>
                        <span style={{ fontSize: '11px', color: theme.textMuted }}>{topic.posts}</span>
                      </div>
                    </div>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      color: topic.title === selectedDateTopic ? '#15803d' : '#16a34a',
                      backgroundColor: topic.title === selectedDateTopic ? '#bbf7d0' : '#dcfce7',
                      padding: '3px 8px',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      ↗ {topic.growth}
                    </span>
                  </div>
                ))
              )}
            </div>
          </article>

          {/* Most Mentioned Entities Card */}
          <article className="card-hover-effect" style={{
            padding: '24px',
            backgroundColor: theme.bgCard,
            borderRadius: '16px',
            border: `1px solid ${theme.border}`,
            boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            textAlign: 'left',
            flex: 1
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: '#f3e8ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#7c3aed'
              }}>
                {/* Tag / Entity Icon */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                  <line x1="7" y1="7" x2="7.01" y2="7"></line>
                </svg>
              </div>
              <div>
                <h3 style={{ color: theme.textMain, margin: 0, fontSize: '18px', fontWeight: '800' }}>Most Mentioned Entities</h3>
                <p style={{ color: theme.textMuted, margin: '2px 0 0 0', fontSize: '12px' }}>
                  {selectedDate ? `Entitas terpopuler pada ${selectedDate}` : 'Entitas teratas berdasarkan frekuensi sebutan'}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, justifyContent: 'center' }}>
              {activeTopEntitiesData.length === 0 ? (
                <div style={{ padding: '24px 12px', textAlign: 'center', color: theme.textMuted, fontSize: '13px' }}>
                  {isLoadingData ? 'Memuat entitas dari database...' : 'Belum ada data entitas dari database.'}
                </div>
              ) : (
                activeTopEntitiesData.map((entity) => {
                  const typeBadge = getEntityTypeBadge(entity.type);
                  return (
                    <div key={entity.rank} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                      borderRadius: '10px',
                      border: `1px solid ${theme.border}`
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '800', color: theme.textMuted, width: '20px' }}>#{entity.rank}</span>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: theme.textMain }}>{entity.name}</h4>
                          <span style={{ fontSize: '11px', color: theme.textMuted }}>{entity.mentions}</span>
                        </div>
                      </div>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        color: typeBadge.color,
                        backgroundColor: typeBadge.bg,
                        border: `1px solid ${typeBadge.border}`,
                        padding: '3px 9px',
                        borderRadius: '12px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        {entity.type}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </article>

        </div>

      </div>

    </section>
  );
}

export default Overview;
