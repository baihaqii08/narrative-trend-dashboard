import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import SummaryCards from './SummaryCards';
import KnowledgeGraph from './KnowledgeGraph';
import {
  DashboardOverviewData,
  EntityItem,
  fetchCombinedPlatformDistributionFromApi,
  fetchDashboardOverviewFromApi,
  fetchEntitiesFromApi,
  fetchPostsFromApi,
  fetchSentimentTimelineFromApi,
  fetchTopicsFromApi,
  normalizeEntityType,
  PlatformDistribution,
  SocialPost,
  TimelinePoint,
  TopicItem,
} from '../../services/api';

const DEFAULT_FALLBACK_TOPIC = 'Program Makan Bergizi Gratis (MBG)';
const PERCENTAGE_MULTIPLIER = 100;
const TOP_ITEMS_LIMIT = 4;
const POST_SAMPLE_LIMIT = 50;

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

function Overview({
  theme,
  isDark,
  timeFilter = 'all',
  setTimeFilter,
  setPlatformFilter,
  isRefreshing,
}: DashboardProps) {
  const [activeTab, setActiveTab] = useState<'instagram' | 'x'>('instagram');
  const [hoveredTrendData, setHoveredTrendData] = useState<any>(null);

  const [socialDataRaw, setSocialDataRaw] = useState<SocialPost[]>([]);
  const [overviewApiData, setOverviewApiData] = useState<DashboardOverviewData | null>(null);
  const [combinedPlatformDist, setCombinedPlatformDist] = useState<PlatformDistribution | null>(null);
  const [topicsApiData, setTopicsApiData] = useState<TopicItem[]>([]);
  const [entitiesApiData, setEntitiesApiData] = useState<EntityItem[]>([]);
  const [timelineApiData, setTimelineApiData] = useState<TimelinePoint[]>([]);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [lastUpdatedTime, setLastUpdatedTime] = useState<string>('--:--');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const loadPostsFromFastApi = useCallback(async () => {
    setIsLoadingData(true);
    setApiError(null);
    try {
      const [
        overviewResult,
        timelineResult,
        entitiesResult,
        topicsResult,
        postsResult,
        combinedDistResult,
      ] = await Promise.allSettled([
        fetchDashboardOverviewFromApi({ platform: activeTab, timeFilter, date: selectedDate }),
        fetchSentimentTimelineFromApi({ platform: activeTab, timeFilter }),
        fetchEntitiesFromApi({ platform: activeTab, timeFilter, date: selectedDate, limit: TOP_ITEMS_LIMIT }),
        fetchTopicsFromApi({ platform: activeTab, timeFilter, date: selectedDate, limit: TOP_ITEMS_LIMIT }),
        fetchPostsFromApi({ platform: activeTab, timeFilter, limit: POST_SAMPLE_LIMIT }),
        fetchCombinedPlatformDistributionFromApi({ timeFilter }),
      ]);

      let hasAtLeastOneSuccess = false;

      if (overviewResult.status === 'fulfilled' && overviewResult.value) {
        setOverviewApiData(overviewResult.value);
        hasAtLeastOneSuccess = true;
      }
      if (combinedDistResult.status === 'fulfilled' && combinedDistResult.value) {
        setCombinedPlatformDist(combinedDistResult.value);
        hasAtLeastOneSuccess = true;
      }
      if (timelineResult.status === 'fulfilled' && timelineResult.value.length > 0) {
        setTimelineApiData(timelineResult.value);
        hasAtLeastOneSuccess = true;
      }
      if (entitiesResult.status === 'fulfilled' && entitiesResult.value.length > 0) {
        setEntitiesApiData(entitiesResult.value);
        hasAtLeastOneSuccess = true;
      }
      if (topicsResult.status === 'fulfilled' && topicsResult.value.length > 0) {
        setTopicsApiData(topicsResult.value);
        hasAtLeastOneSuccess = true;
      }
      if (postsResult.status === 'fulfilled' && postsResult.value.length > 0) {
        setSocialDataRaw(postsResult.value);
        hasAtLeastOneSuccess = true;
      }

      if (!hasAtLeastOneSuccess) {
        setApiError(
          `Gagal memuat data dari Backend (${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'}). Pastikan server FastAPI menyala dan database terhubung.`
        );
      }

      const currentTime = new Date();
      setLastUpdatedTime(
        `${String(currentTime.getHours()).padStart(2, '0')}:${String(currentTime.getMinutes()).padStart(2, '0')}`
      );
    } catch (error: any) {
      setApiError(error?.message || 'Gagal terhubung ke server FastAPI.');
    } finally {
      setIsLoadingData(false);
    }
  }, [timeFilter, activeTab, selectedDate]);

  useEffect(() => {
    loadPostsFromFastApi();
  }, [loadPostsFromFastApi, isRefreshing]);

  const handleTabChange = (selectedTab: 'instagram' | 'x') => {
    setActiveTab(selectedTab);
    if (setPlatformFilter) {
      setPlatformFilter(selectedTab);
    }
  };

  const handleTimeFilterChange = (selectedOption: string) => {
    const normalizedFilter = normalizeTimeFilterOption(selectedOption);
    setSelectedDate(null);
    if (setTimeFilter) {
      setTimeFilter(normalizedFilter);
    }
  };

  const timeFilteredRaw = useMemo(
    () => filterPostsByTimeWindow(socialDataRaw, timeFilter),
    [socialDataRaw, timeFilter, isRefreshing]
  );

  const socialData = useMemo(
    () => timeFilteredRaw.filter((postItem) => matchesActivePlatformTab(postItem.platform, activeTab)),
    [timeFilteredRaw, activeTab]
  );

  const {
    totalPosts,
    negativeCount,
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
  } = useMemo(
    () =>
      deriveOverviewAnalytics({
        socialData,
        timeFilteredRaw,
        overviewApiData,
        topicsApiData,
        entitiesApiData,
        timelineApiData,
        combinedPlatformDist,
      }),
    [
      socialData,
      timeFilteredRaw,
      overviewApiData,
      topicsApiData,
      entitiesApiData,
      timelineApiData,
      combinedPlatformDist,
    ]
  );

  const timeFilterLabel = useMemo(() => resolveTimeFilterIndonesianLabel(timeFilter), [timeFilter]);
  const periodLabelEn = useMemo(
    () => resolvePeriodEnglishLabel(selectedDate, timeFilter),
    [selectedDate, timeFilter]
  );

  const selectedDatePayload = useMemo(() => {
    if (!selectedDate) {
      return null;
    }
    return sentimentTrendData.find((point: any) => point.date === selectedDate) || null;
  }, [selectedDate, sentimentTrendData]);

  const selectedDateTopic = selectedDatePayload?.topPositiveTopic || null;

  const activeSocialData = useMemo(
    () => filterPostsForSelectedDate(socialData, selectedDate),
    [socialData, selectedDate]
  );

  const activePlatformDistData = useMemo(
    () =>
      computeDateSpecificPlatformDistribution({
        selectedDate,
        timeFilteredRaw,
        platformDistData,
        sentimentTrendData,
      }),
    [selectedDate, timeFilteredRaw, platformDistData, sentimentTrendData]
  );

  const activeTopTopicsData = useMemo(
    () =>
      computeDateSpecificTopTopics({
        selectedDate,
        activeSocialData,
        topTopicsData,
        selectedDateTopic,
      }),
    [selectedDate, activeSocialData, topTopicsData, selectedDateTopic]
  );

  const activeTopEntitiesData = useMemo(
    () =>
      computeDateSpecificTopEntities({
        selectedDate,
        activeSocialData,
        topEntitiesData,
      }),
    [selectedDate, activeSocialData, topEntitiesData]
  );

  const prevPeriodStats = useMemo(
    () => computePreviousPeriodSentimentShares(socialDataRaw, timeFilter, activeTab),
    [socialDataRaw, timeFilter, activeTab, isRefreshing]
  );

  const activeDominantStats = useMemo(
    () =>
      computeActiveDominantStatistics({
        selectedDate,
        dominantSentiment,
        positiveShare,
        negativeShare,
        neutralShare,
        topPositiveTopic,
        topNegativeTopic,
        topNeutralTopic,
        prevPeriodStats,
        sentimentTrendData,
      }),
    [
      selectedDate,
      dominantSentiment,
      positiveShare,
      negativeShare,
      neutralShare,
      topPositiveTopic,
      topNegativeTopic,
      topNeutralTopic,
      prevPeriodStats,
      sentimentTrendData,
    ]
  );

  const bannerConfig = useMemo(
    () =>
      buildSentimentCalloutBannerConfig({
        activeDominantStats,
        overviewApiData,
        periodLabelEn,
        selectedDate,
        timeFilter,
      }),
    [activeDominantStats, overviewApiData, periodLabelEn, selectedDate, timeFilter]
  );

  const resolveDailySentimentTooltip = useCallback(
    (dayData: any) =>
      buildDailySentimentInspectorInfo({
        dayData,
        fallbackTopic:
          activeDominantStats.dominantTopic ||
          overviewApiData?.dominantTopic ||
          DEFAULT_FALLBACK_TOPIC,
        topPositiveTopic,
        topNegativeTopic,
        topNeutralTopic,
      }),
    [
      activeDominantStats.dominantTopic,
      overviewApiData?.dominantTopic,
      topPositiveTopic,
      topNegativeTopic,
      topNeutralTopic,
    ]
  );

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '20px', opacity: isRefreshing ? 0.6 : 1, transition: 'opacity 0.2s', width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '15px' }}>
        <div style={{ textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: isLoadingData ? '#f59e0b' : apiError ? '#ef4444' : '#10b981',
              display: 'inline-block',
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
          <h1 style={{ color: theme.textMain, margin: '0 0 4px 0', fontSize: '26px', fontWeight: '800', letterSpacing: '-0.5px' }}>
            Narrative Overview
          </h1>
          <p style={{ color: theme.textMuted, margin: 0, fontSize: '14px' }}>
            {getTimeSubtitle(timeFilter)}
          </p>
        </div>

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
              gap: '6px',
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
                appearance: 'none',
              }}
              value={timeFilter}
              onChange={(event) => handleTimeFilterChange(event.target.value)}
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
          gap: '12px',
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
              cursor: 'pointer',
            }}
          >
            Coba Lagi
          </button>
        </div>
      )}

      <div style={{
        display: 'flex',
        backgroundColor: '#dbeafe',
        borderRadius: '14px',
        padding: '6px',
        gap: '6px',
        width: '100%',
        boxSizing: 'border-box',
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
            transition: 'all 0.2s ease',
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
            transition: 'all 0.2s ease',
          }}
        >
          X
        </button>
      </div>

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
        transition: 'all 0.3s ease',
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
            flexShrink: 0,
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

        <div style={{
          backgroundColor: theme.bgCard,
          padding: '12px 20px',
          borderRadius: '12px',
          border: `1px solid ${theme.border}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          minWidth: '150px',
        }}>
          <span style={{ fontSize: '11px', color: theme.textMuted, fontWeight: '600' }}>{bannerConfig.metricLabel}</span>
          <span style={{ fontSize: '24px', fontWeight: '900', color: theme.textMain, margin: '2px 0' }}>{bannerConfig.metricValue}</span>
          <span style={{
            fontSize: '11px',
            fontWeight: '700',
            color: bannerConfig.badgeColor,
            backgroundColor: bannerConfig.badgeBg,
            padding: '2px 8px',
            borderRadius: '12px',
          }}>
            {bannerConfig.badgeText}
          </span>
        </div>
      </div>

      <SummaryCards
        theme={theme}
        data={socialData}
        overviewStats={overviewApiData}
        topicsCount={topicsApiData.length}
        entitiesCount={entitiesApiData.length}
        type="overview"
        timeFilter={timeFilter}
      />

      <div style={{ display: 'flex', gap: '20px', alignItems: 'stretch', flexWrap: 'wrap' }}>
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
          textAlign: 'left',
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
              color: '#166534',
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
                  cursor: 'pointer',
                }}
              >
                ✕ Reset Tanggal
              </button>
            </div>
          )}

          <div style={{ height: 280, position: 'relative', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            {hoveredTrendData && (() => {
              const daySentimentInfo = resolveDailySentimentTooltip(hoveredTrendData);
              return (
                <div style={{
                  position: 'absolute',
                  top: '10px',
                  right: '18%',
                  zIndex: 10,
                  backgroundColor: daySentimentInfo.badgeBg,
                  border: `1px solid ${daySentimentInfo.badgeBorder}`,
                  padding: '6px 12px',
                  borderRadius: '8px',
                  fontSize: '11px',
                  fontWeight: '700',
                  color: daySentimentInfo.textColor,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  pointerEvents: 'none',
                  transition: 'all 0.15s ease',
                }}>
                  {daySentimentInfo.label}: <br />
                  <strong style={{ fontSize: '13px', display: 'inline-block', marginTop: '2px' }}>
                    {daySentimentInfo.topic}
                  </strong>
                </div>
              );
            })()}

            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={sentimentTrendData}
                margin={{ top: 20, right: 20, left: -20, bottom: 0 }}
                style={{ cursor: 'pointer' }}
                onClick={(chartState: any) => {
                  if (chartState && chartState.activeLabel) {
                    setSelectedDate((previousDate) =>
                      previousDate === chartState.activeLabel ? null : chartState.activeLabel
                    );
                  }
                }}
                onMouseMove={(chartState: any) => {
                  if (chartState && chartState.activePayload && chartState.activePayload.length) {
                    setHoveredTrendData(chartState.activePayload[0].payload);
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
                      const pointPayload = payload[0].payload;
                      const daySentimentInfo = resolveDailySentimentTooltip(pointPayload);
                      return (
                        <div style={{
                          backgroundColor: theme.bgCard,
                          border: `1px solid ${theme.border}`,
                          borderRadius: '12px',
                          padding: '12px 14px',
                          boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                          textAlign: 'left',
                        }}>
                          <div style={{
                            backgroundColor: daySentimentInfo.badgeBg,
                            border: `1px solid ${daySentimentInfo.badgeBorder}`,
                            padding: '6px 10px',
                            borderRadius: '8px',
                            marginBottom: '10px',
                            fontSize: '11px',
                            fontWeight: '700',
                            color: daySentimentInfo.textColor,
                          }}>
                            <div>{daySentimentInfo.label}:</div>
                            <div style={{ fontSize: '13px', fontWeight: '800', marginTop: '2px' }}>{daySentimentInfo.topic}</div>
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

        <div style={{ flex: '1 1 320px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <article className="card-hover-effect" style={{
            padding: '24px',
            backgroundColor: theme.bgCard,
            borderRadius: '16px',
            border: `1px solid ${theme.border}`,
            boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            textAlign: 'left',
            flex: 1,
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
                color: '#0284c7',
              }}>
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
                overviewApiData.keyInsights.slice(0, 3).map((insightItem, index) => (
                  <div key={index} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                    <div style={insightNumberBadgeStyle}>{index + 1}</div>
                    <div>
                      <h4 style={{ margin: '0 0 2px 0', fontSize: '14px', fontWeight: '800', color: theme.textMain }}>{insightItem.title}</h4>
                      <p style={{ margin: 0, fontSize: '12px', color: theme.textMuted, lineHeight: '1.4' }}>
                        {insightItem.description}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <>
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                    <div style={insightNumberBadgeStyle}>1</div>
                    <div>
                      <h4 style={{ margin: '0 0 2px 0', fontSize: '14px', fontWeight: '800', color: theme.textMain }}>
                        Sentimen {dominantSentiment === 'negative' ? `negatif (${negativeShare}%)` : dominantSentiment === 'neutral' ? `netral (${neutralShare}%)` : `positif (${positiveShare}%)`} dominan
                      </h4>
                      <p style={{ margin: 0, fontSize: '12px', color: theme.textMuted, lineHeight: '1.4' }}>
                        {totalPosts > 0
                          ? <>Puncak tren pada <strong>{peakDateStr !== '-' ? peakDateStr : timeFilterLabel}</strong> dipicu oleh diskusi seputar <strong>{activeDominantStats.dominantTopic || topPositiveTopic || DEFAULT_FALLBACK_TOPIC}</strong>.</>
                          : 'Menunggu data percakapan dari database.'}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                    <div style={insightNumberBadgeStyle}>2</div>
                    <div>
                      <h4 style={{ margin: '0 0 2px 0', fontSize: '14px', fontWeight: '800', color: theme.textMain }}>
                        {((activePlatformDistData.instagram.posts + activePlatformDistData.x.posts) || totalPosts).toLocaleString('id-ID')} Postingan Dianalisis
                      </h4>
                      <p style={{ margin: 0, fontSize: '12px', color: theme.textMuted, lineHeight: '1.4' }}>
                        Distribusi gabungan platform terdiri dari Instagram ({activePlatformDistData.instagram.percentage}% / {activePlatformDistData.instagram.posts.toLocaleString('id-ID')} posts) dan X ({activePlatformDistData.x.percentage}% / {activePlatformDistData.x.posts.toLocaleString('id-ID')} posts) pada {timeFilterLabel}.
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                    <div style={insightNumberBadgeStyle}>3</div>
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

          <article className="card-hover-effect" style={{
            padding: '24px',
            backgroundColor: theme.bgCard,
            borderRadius: '16px',
            border: `1px solid ${theme.border}`,
            boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            textAlign: 'left',
            flex: 1,
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
                color: '#0284c7',
              }}>
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
                      color: '#ffffff',
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
                      color: '#ffffff',
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

      <div style={{ display: 'flex', gap: '20px', alignItems: 'stretch', flexWrap: 'wrap' }}>
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

        <div style={{ flex: '1 1 320px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <article className="card-hover-effect" style={{
            padding: '24px',
            backgroundColor: theme.bgCard,
            borderRadius: '16px',
            border: `1px solid ${theme.border}`,
            boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            textAlign: 'left',
            flex: 1,
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
                color: '#0284c7',
              }}>
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
                activeTopTopicsData.map((topicItem) => (
                  <div key={topicItem.rank} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 14px',
                    backgroundColor: topicItem.title === selectedDateTopic ? '#f0fdf4' : (isDark ? '#1e293b' : '#f8fafc'),
                    borderRadius: '10px',
                    border: topicItem.title === selectedDateTopic ? '1px solid #86efac' : `1px solid ${theme.border}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '800', color: theme.textMuted, width: '20px' }}>#{topicItem.rank}</span>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: theme.textMain }}>{topicItem.title}</h4>
                        <span style={{ fontSize: '11px', color: theme.textMuted }}>{topicItem.posts}</span>
                      </div>
                    </div>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      color: topicItem.title === selectedDateTopic ? '#15803d' : '#16a34a',
                      backgroundColor: topicItem.title === selectedDateTopic ? '#bbf7d0' : '#dcfce7',
                      padding: '3px 8px',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}>
                      ↗ {topicItem.growth}
                    </span>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="card-hover-effect" style={{
            padding: '24px',
            backgroundColor: theme.bgCard,
            borderRadius: '16px',
            border: `1px solid ${theme.border}`,
            boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            textAlign: 'left',
            flex: 1,
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
                color: '#7c3aed',
              }}>
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
                activeTopEntitiesData.map((entityItem) => {
                  const typeBadge = getEntityTypeBadge(entityItem.type);
                  return (
                    <div key={entityItem.rank} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                      borderRadius: '10px',
                      border: `1px solid ${theme.border}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '800', color: theme.textMuted, width: '20px' }}>#{entityItem.rank}</span>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: theme.textMain }}>{entityItem.name}</h4>
                          <span style={{ fontSize: '11px', color: theme.textMuted }}>{entityItem.mentions}</span>
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
                        gap: '4px',
                      }}>
                        {entityItem.type}
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

function getEntityTypeBadge(entityType: string) {
  const normalizedType = normalizeEntityType(entityType).toLowerCase();
  switch (normalizedType) {
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
}

function normalizeTimeFilterOption(selectedOption: string): string {
  if (selectedOption === '7_hari') {
    return 'last7';
  }
  if (selectedOption === '14_hari') {
    return 'last14';
  }
  if (selectedOption === '30_hari') {
    return 'last30';
  }
  if (selectedOption === 'sepanjang_waktu') {
    return 'all';
  }
  return selectedOption;
}

function getTimeSubtitle(timeFilter: string): string {
  switch (timeFilter) {
    case 'last7':
      return 'Monitoring tren narasi media sosial — 7 hari terakhir';
    case 'last14':
      return 'Monitoring tren narasi media sosial — 14 hari terakhir';
    case 'last30':
      return 'Monitoring tren narasi media sosial — 30 hari terakhir';
    default:
      return 'Monitoring tren narasi media sosial — Sepanjang waktu';
  }
}

function resolveTimeFilterIndonesianLabel(timeFilter: string): string {
  switch (timeFilter) {
    case 'last7':
      return '7 hari terakhir';
    case 'last14':
      return '14 hari terakhir';
    case 'last30':
      return '30 hari terakhir';
    case 'all':
      return 'sepanjang waktu';
    default:
      return 'periode ini';
  }
}

function resolvePeriodEnglishLabel(selectedDate: string | null, timeFilter: string): string {
  if (selectedDate) {
    return `on ${selectedDate}`;
  }
  switch (timeFilter) {
    case 'last7':
      return 'this week';
    case 'last14':
      return 'in past 14 days';
    case 'last30':
      return 'in past 30 days';
    case 'all':
      return 'overall';
    default:
      return 'in this period';
  }
}

function matchesActivePlatformTab(platform: string | undefined, activeTab: 'instagram' | 'x'): boolean {
  const normalizedPlatform = platform ? platform.toLowerCase() : '';
  if (activeTab === 'x') {
    return normalizedPlatform === 'x' || normalizedPlatform === 'twitter';
  }
  return normalizedPlatform === 'instagram' || normalizedPlatform === 'ig';
}

function formatDayShortKey(dateValue: Date): string {
  return `${String(dateValue.getDate()).padStart(2, '0')} ${dateValue.toLocaleString('default', { month: 'short' })}`;
}

function filterPostsByTimeWindow(posts: SocialPost[], timeFilter: string): SocialPost[] {
  if (timeFilter === 'all') {
    return [...posts];
  }

  let latestDate = new Date(0);
  posts.forEach((postItem) => {
    const postDate = new Date(postItem.timestamp);
    if (postDate > latestDate) {
      latestDate = postDate;
    }
  });

  const cutoffDate = new Date(latestDate);
  if (timeFilter === 'last7') {
    cutoffDate.setDate(cutoffDate.getDate() - 7);
  } else if (timeFilter === 'last14') {
    cutoffDate.setDate(cutoffDate.getDate() - 14);
  } else if (timeFilter === 'last30') {
    cutoffDate.setDate(cutoffDate.getDate() - 30);
  }

  return posts.filter(
    (postItem) => Boolean(postItem.timestamp) && new Date(postItem.timestamp) >= cutoffDate
  );
}

function filterPostsForSelectedDate(
  socialData: SocialPost[],
  selectedDate: string | null
): SocialPost[] {
  if (!selectedDate) {
    return socialData;
  }
  const dateFilteredPosts = socialData.filter((postItem) => {
    if (!postItem.timestamp) {
      return false;
    }
    const postDate = new Date(postItem.timestamp);
    return formatDayShortKey(postDate) === selectedDate;
  });
  return dateFilteredPosts.length > 0 ? dateFilteredPosts : socialData;
}

function deriveOverviewAnalytics({
  socialData,
  timeFilteredRaw,
  overviewApiData,
  topicsApiData,
  entitiesApiData,
  timelineApiData,
  combinedPlatformDist,
}: {
  socialData: SocialPost[];
  timeFilteredRaw: SocialPost[];
  overviewApiData: DashboardOverviewData | null;
  topicsApiData: TopicItem[];
  entitiesApiData: EntityItem[];
  timelineApiData: TimelinePoint[];
  combinedPlatformDist: PlatformDistribution | null;
}) {
  let localPositiveCount = 0;
  let localNegativeCount = 0;
  let localNeutralCount = 0;
  let localEngagementSum = 0;

  const topicCounts: Record<string, number> = {};
  const positiveTopicCounts: Record<string, number> = {};
  const negativeTopicCounts: Record<string, number> = {};
  const neutralTopicCounts: Record<string, number> = {};
  const dailyTrendMap: Record<
    string,
    {
      date: string;
      positive: number;
      neutral: number;
      negative: number;
      timestamp: number;
      topics: Record<string, number>;
    }
  > = {};

  socialData.forEach((postItem) => {
    if (postItem.sentiment === 'positive') {
      localPositiveCount++;
      if (postItem.topic) {
        positiveTopicCounts[postItem.topic] = (positiveTopicCounts[postItem.topic] || 0) + 1;
      }
    } else if (postItem.sentiment === 'negative') {
      localNegativeCount++;
      if (postItem.topic) {
        negativeTopicCounts[postItem.topic] = (negativeTopicCounts[postItem.topic] || 0) + 1;
      }
    } else {
      localNeutralCount++;
      if (postItem.topic) {
        neutralTopicCounts[postItem.topic] = (neutralTopicCounts[postItem.topic] || 0) + 1;
      }
    }

    if (postItem.engagement) {
      localEngagementSum +=
        (postItem.engagement.likes || 0) +
        (postItem.engagement.shares || 0) +
        (postItem.engagement.comments || 0) +
        (postItem.engagement.views || 0);
    }

    if (postItem.topic) {
      topicCounts[postItem.topic] = (topicCounts[postItem.topic] || 0) + 1;
    }

    if (postItem.timestamp) {
      const postDate = new Date(postItem.timestamp);
      const dayKey = formatDayShortKey(postDate);

      if (!dailyTrendMap[dayKey]) {
        dailyTrendMap[dayKey] = {
          date: dayKey,
          positive: 0,
          neutral: 0,
          negative: 0,
          timestamp: postDate.getTime(),
          topics: {},
        };
      }

      if (postItem.sentiment === 'positive') {
        dailyTrendMap[dayKey].positive++;
      } else if (postItem.sentiment === 'negative') {
        dailyTrendMap[dayKey].negative++;
      } else {
        dailyTrendMap[dayKey].neutral++;
      }

      if (postItem.topic) {
        dailyTrendMap[dayKey].topics[postItem.topic] =
          (dailyTrendMap[dayKey].topics[postItem.topic] || 0) + 1;
      }
    }
  });

  const finalPositiveCount = overviewApiData?.positiveCount || localPositiveCount || 0;
  const finalNegativeCount = overviewApiData?.negativeCount || localNegativeCount || 0;
  const finalNeutralCount = overviewApiData?.neutralCount || localNeutralCount || 0;
  const totalPosts = overviewApiData?.totalPosts || socialData.length || 0;
  const totalSentimentSum = finalPositiveCount + finalNegativeCount + finalNeutralCount;

  const positiveShare =
    overviewApiData?.positiveShare !== undefined && overviewApiData.positiveShare > 0
      ? Number(overviewApiData.positiveShare).toFixed(1)
      : totalSentimentSum > 0
        ? ((finalPositiveCount / totalSentimentSum) * PERCENTAGE_MULTIPLIER).toFixed(1)
        : '0.0';
  const negativeShare =
    overviewApiData?.negativeShare !== undefined && overviewApiData.negativeShare > 0
      ? Number(overviewApiData.negativeShare).toFixed(1)
      : totalSentimentSum > 0
        ? ((finalNegativeCount / totalSentimentSum) * PERCENTAGE_MULTIPLIER).toFixed(1)
        : '0.0';
  const neutralShare =
    overviewApiData?.neutralShare !== undefined && overviewApiData.neutralShare > 0
      ? Number(overviewApiData.neutralShare).toFixed(1)
      : totalSentimentSum > 0
        ? ((finalNeutralCount / totalSentimentSum) * PERCENTAGE_MULTIPLIER).toFixed(1)
        : '0.0';

  const positivePercentage = parseFloat(positiveShare);
  const negativePercentage = parseFloat(negativeShare);
  const neutralPercentage = parseFloat(neutralShare);

  let dominantSentiment: 'positive' | 'negative' | 'neutral' =
    overviewApiData?.dominantSentiment || 'neutral';
  if (
    neutralPercentage >= positivePercentage &&
    neutralPercentage >= negativePercentage &&
    (neutralPercentage > 0 || !overviewApiData?.dominantSentiment)
  ) {
    dominantSentiment = 'neutral';
  } else if (positivePercentage > neutralPercentage && positivePercentage > negativePercentage) {
    dominantSentiment = 'positive';
  } else if (negativePercentage > neutralPercentage && negativePercentage > positivePercentage) {
    dominantSentiment = 'negative';
  }

  const sortedTopics = Object.entries(topicCounts).sort((first, second) => second[1] - first[1]);
  const postsDerivedTopics: TopicItem[] = sortedTopics
    .slice(0, TOP_ITEMS_LIMIT)
    .map(([topicName, postCount], index) => {
      const baseCount = socialData.length || 1;
      const shareOfPosts = ((postCount / baseCount) * PERCENTAGE_MULTIPLIER).toFixed(1);
      return {
        rank: index + 1,
        title: topicName,
        postCount,
        posts: `${postCount.toLocaleString('id-ID')} postingan`,
        growth: `${shareOfPosts}% share`,
      };
    });

  const topTopicsData: TopicItem[] =
    topicsApiData.length > 0
      ? topicsApiData.slice(0, TOP_ITEMS_LIMIT)
      : overviewApiData?.topTopics && overviewApiData.topTopics.length > 0
        ? overviewApiData.topTopics.slice(0, TOP_ITEMS_LIMIT)
        : postsDerivedTopics;

  const primaryDatabaseTopic =
    overviewApiData?.dominantTopic ||
    (topTopicsData.length > 0 ? topTopicsData[0].title : DEFAULT_FALLBACK_TOPIC);

  const sortedPositiveTopics = Object.entries(positiveTopicCounts).sort((first, second) => second[1] - first[1]);
  const topPositiveTopic =
    overviewApiData?.topPositiveTopic ||
    (sortedPositiveTopics.length > 0 ? sortedPositiveTopics[0][0] : primaryDatabaseTopic);

  const sortedNegativeTopics = Object.entries(negativeTopicCounts).sort((first, second) => second[1] - first[1]);
  const topNegativeTopic =
    overviewApiData?.topNegativeTopic ||
    (sortedNegativeTopics.length > 0
      ? sortedNegativeTopics[0][0]
      : topTopicsData[1]?.title ?? primaryDatabaseTopic);

  const sortedNeutralTopics = Object.entries(neutralTopicCounts).sort((first, second) => second[1] - first[1]);
  const topNeutralTopic =
    overviewApiData?.topNeutralTopic ||
    (sortedNeutralTopics.length > 0 ? sortedNeutralTopics[0][0] : primaryDatabaseTopic);

  const postsDerivedTrend = Object.values(dailyTrendMap)
    .sort((first, second) => first.timestamp - second.timestamp)
    .map((dayItem: any) => {
      const sortedDayTopics = Object.entries(dayItem.topics || {}).sort(
        (first: any, second: any) => second[1] - first[1]
      );
      const dayPeakTopic =
        sortedDayTopics.length > 0 ? sortedDayTopics[0][0] : topPositiveTopic;
      return {
        ...dayItem,
        topPositiveTopic: dayPeakTopic,
      };
    });

  const sentimentTrendData: TimelinePoint[] =
    timelineApiData.length > 0
      ? timelineApiData.map((point) => ({
          ...point,
          topPositiveTopic: point.topPositiveTopic || topPositiveTopic,
        }))
      : postsDerivedTrend;

  let maxDailyVolume = -1;
  let peakDateStr = overviewApiData?.peakDateStr || '-';
  sentimentTrendData.forEach((trendPoint) => {
    const dailyTotal =
      (trendPoint.positive || 0) + (trendPoint.neutral || 0) + (trendPoint.negative || 0);
    if (dailyTotal > maxDailyVolume) {
      maxDailyVolume = dailyTotal;
      peakDateStr = trendPoint.date;
    }
  });

  const entityCounts: Record<string, { count: number; type: string }> = {};
  socialData.forEach((postItem) => {
    if (Array.isArray(postItem.entities)) {
      postItem.entities.forEach((entityEntry: any) => {
        if (entityEntry.name) {
          const normalizedEntityType = normalizeEntityType(entityEntry.type);
          if (!entityCounts[entityEntry.name]) {
            entityCounts[entityEntry.name] = { count: 0, type: normalizedEntityType };
          }
          entityCounts[entityEntry.name].count++;
        }
      });
    }
  });

  const sortedEntities = Object.entries(entityCounts).sort(
    (first, second) => second[1].count - first[1].count
  );
  const postsDerivedEntities: EntityItem[] = sortedEntities
    .slice(0, TOP_ITEMS_LIMIT)
    .map(([entityName, entityData], index) => ({
      rank: index + 1,
      name: entityName,
      type: entityData.type,
      mentionCount: entityData.count,
      mentions: `${entityData.count.toLocaleString('id-ID')} sebutan`,
    }));

  const topEntitiesData: EntityItem[] =
    entitiesApiData.length > 0
      ? entitiesApiData.slice(0, TOP_ITEMS_LIMIT)
      : overviewApiData?.topEntities && overviewApiData.topEntities.length > 0
        ? overviewApiData.topEntities.slice(0, TOP_ITEMS_LIMIT)
        : postsDerivedEntities;

  const platformDistData = resolveOverallPlatformDistribution({
    combinedPlatformDist,
    overviewApiData,
    timeFilteredRaw,
    totalPosts,
  });

  return {
    totalPosts,
    positiveCount: finalPositiveCount,
    negativeCount: finalNegativeCount,
    neutralCount: finalNeutralCount,
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
    totalEngagementSum: overviewApiData?.totalEngagement || localEngagementSum || 0,
  };
}

function resolveOverallPlatformDistribution({
  combinedPlatformDist,
  overviewApiData,
  timeFilteredRaw,
  totalPosts,
}: {
  combinedPlatformDist: PlatformDistribution | null;
  overviewApiData: DashboardOverviewData | null;
  timeFilteredRaw: SocialPost[];
  totalPosts: number;
}): PlatformDistribution {
  let platformDistData: PlatformDistribution = {
    instagram: { percentage: 0, posts: 0 },
    x: { percentage: 0, posts: 0 },
  };

  if (combinedPlatformDist) {
    platformDistData = { ...combinedPlatformDist };
  } else if (
    overviewApiData?.platformDistribution &&
    (overviewApiData.platformDistribution.instagram.posts > 0 ||
      overviewApiData.platformDistribution.x.posts > 0)
  ) {
    platformDistData = { ...overviewApiData.platformDistribution };
  } else if (timeFilteredRaw.length > 0) {
    let instagramTotal = 0;
    let xTotal = 0;
    timeFilteredRaw.forEach((postItem) => {
      const normalizedPlatform = postItem.platform?.toLowerCase();
      if (normalizedPlatform === 'instagram' || normalizedPlatform === 'ig') {
        instagramTotal++;
      } else if (normalizedPlatform === 'twitter' || normalizedPlatform === 'x') {
        xTotal++;
      }
    });
    const combinedTotal = instagramTotal + xTotal;
    const instagramPercentage =
      combinedTotal > 0
        ? Math.round((instagramTotal / combinedTotal) * PERCENTAGE_MULTIPLIER)
        : 50;
    const xPercentage =
      combinedTotal > 0
        ? Math.max(0, PERCENTAGE_MULTIPLIER - instagramPercentage)
        : 50;
    platformDistData = {
      instagram: { percentage: instagramPercentage, posts: instagramTotal },
      x: { percentage: xPercentage, posts: xTotal },
    };
  } else {
    platformDistData = {
      instagram: { percentage: 50, posts: 0 },
      x: { percentage: 50, posts: 0 },
    };
  }

  const combinedSampleSum =
    platformDistData.instagram.posts + platformDistData.x.posts;
  if (totalPosts > 0 && combinedSampleSum <= POST_SAMPLE_LIMIT) {
    const instagramPercentage = platformDistData.instagram.percentage;
    const scaledInstagramPosts = Math.round(
      (instagramPercentage / PERCENTAGE_MULTIPLIER) * totalPosts
    );
    const scaledXPosts = Math.max(0, totalPosts - scaledInstagramPosts);
    platformDistData = {
      instagram: { percentage: instagramPercentage, posts: scaledInstagramPosts },
      x: {
        percentage: Math.max(0, PERCENTAGE_MULTIPLIER - instagramPercentage),
        posts: scaledXPosts,
      },
    };
  }

  return platformDistData;
}

function computeDateSpecificPlatformDistribution({
  selectedDate,
  timeFilteredRaw,
  platformDistData,
  sentimentTrendData,
}: {
  selectedDate: string | null;
  timeFilteredRaw: SocialPost[];
  platformDistData: PlatformDistribution;
  sentimentTrendData: TimelinePoint[];
}): PlatformDistribution {
  if (!selectedDate || timeFilteredRaw.length === 0) {
    return platformDistData;
  }

  let instagramCount = 0;
  let xCount = 0;
  timeFilteredRaw.forEach((postItem) => {
    if (!postItem.timestamp) {
      return;
    }
    const postDate = new Date(postItem.timestamp);
    if (formatDayShortKey(postDate) !== selectedDate) {
      return;
    }
    const normalizedPlatform = postItem.platform?.toLowerCase();
    if (normalizedPlatform === 'instagram' || normalizedPlatform === 'ig') {
      instagramCount++;
    } else if (normalizedPlatform === 'twitter' || normalizedPlatform === 'x') {
      xCount++;
    }
  });

  const totalDatePosts = instagramCount + xCount;
  if (totalDatePosts === 0) {
    return platformDistData;
  }

  const instagramPercentage = Math.round((instagramCount / totalDatePosts) * PERCENTAGE_MULTIPLIER);
  const xPercentage = Math.max(0, PERCENTAGE_MULTIPLIER - instagramPercentage);

  const matchingTrendPoint = sentimentTrendData.find((point: any) => point.date === selectedDate);
  const trendPointTotal = matchingTrendPoint
    ? matchingTrendPoint.positive + matchingTrendPoint.neutral + matchingTrendPoint.negative
    : totalDatePosts;

  const calculatedInstagramPosts =
    trendPointTotal > totalDatePosts
      ? Math.round((instagramPercentage / PERCENTAGE_MULTIPLIER) * trendPointTotal)
      : instagramCount;
  const calculatedXPosts =
    trendPointTotal > totalDatePosts
      ? Math.max(0, trendPointTotal - calculatedInstagramPosts)
      : xCount;

  return {
    instagram: { percentage: instagramPercentage, posts: calculatedInstagramPosts },
    x: { percentage: xPercentage, posts: calculatedXPosts },
  };
}

function computeDateSpecificTopTopics({
  selectedDate,
  activeSocialData,
  topTopicsData,
  selectedDateTopic,
}: {
  selectedDate: string | null;
  activeSocialData: SocialPost[];
  topTopicsData: TopicItem[];
  selectedDateTopic: string | null;
}): TopicItem[] {
  if (!selectedDate || activeSocialData.length === 0) {
    return topTopicsData;
  }

  const topicCounts: Record<string, number> = {};
  activeSocialData.forEach((postItem) => {
    if (postItem.topic) {
      topicCounts[postItem.topic] = (topicCounts[postItem.topic] || 0) + 1;
    }
  });

  const sortedTopics = Object.entries(topicCounts).sort((first, second) => second[1] - first[1]);
  if (sortedTopics.length === 0) {
    return topTopicsData;
  }

  const dayTotal = activeSocialData.length || 1;
  return sortedTopics.slice(0, TOP_ITEMS_LIMIT).map(([title, postCount], index) => ({
    rank: index + 1,
    title,
    postCount,
    posts: `${postCount.toLocaleString('id-ID')} postingan (${selectedDate})`,
    growth:
      title === selectedDateTopic
        ? '★ Peak Topic'
        : `${((postCount / dayTotal) * PERCENTAGE_MULTIPLIER).toFixed(1)}% share`,
  }));
}

function computeDateSpecificTopEntities({
  selectedDate,
  activeSocialData,
  topEntitiesData,
}: {
  selectedDate: string | null;
  activeSocialData: SocialPost[];
  topEntitiesData: EntityItem[];
}): EntityItem[] {
  if (!selectedDate || activeSocialData.length === 0) {
    return topEntitiesData;
  }

  const entityCounts: Record<string, { count: number; type: string }> = {};
  activeSocialData.forEach((postItem) => {
    if (Array.isArray(postItem.entities)) {
      postItem.entities.forEach((entityEntry: any) => {
        if (entityEntry.name) {
          const normalizedType = normalizeEntityType(entityEntry.type);
          if (!entityCounts[entityEntry.name]) {
            entityCounts[entityEntry.name] = { count: 0, type: normalizedType };
          }
          entityCounts[entityEntry.name].count++;
        }
      });
    }
  });

  const sortedEntities = Object.entries(entityCounts).sort(
    (first, second) => second[1].count - first[1].count
  );
  if (sortedEntities.length === 0) {
    return topEntitiesData;
  }

  return sortedEntities.slice(0, TOP_ITEMS_LIMIT).map(([name, entityData], index) => ({
    rank: index + 1,
    name,
    type: entityData.type,
    mentionCount: entityData.count,
    mentions: `${entityData.count.toLocaleString('id-ID')} sebutan (${selectedDate})`,
  }));
}

function computePreviousPeriodSentimentShares(
  socialDataRaw: SocialPost[],
  timeFilter: string,
  activeTab: 'instagram' | 'x'
) {
  let latestDate = new Date(0);
  socialDataRaw.forEach((postItem) => {
    const postDate = new Date(postItem.timestamp);
    if (postDate > latestDate) {
      latestDate = postDate;
    }
  });

  let previousPeriodPosts: SocialPost[] = [];

  if (timeFilter === 'last7' || timeFilter === 'last14' || timeFilter === 'last30') {
    const windowDays = timeFilter === 'last7' ? 7 : timeFilter === 'last14' ? 14 : 30;
    const currentPeriodStart = new Date(latestDate);
    currentPeriodStart.setDate(currentPeriodStart.getDate() - windowDays);
    const previousPeriodStart = new Date(latestDate);
    previousPeriodStart.setDate(previousPeriodStart.getDate() - windowDays * 2);

    previousPeriodPosts = socialDataRaw.filter(
      (postItem) =>
        matchesActivePlatformTab(postItem.platform, activeTab) &&
        new Date(postItem.timestamp) >= previousPeriodStart &&
        new Date(postItem.timestamp) < currentPeriodStart
    );
  } else {
    let earliestDate = new Date(latestDate);
    socialDataRaw.forEach((postItem) => {
      const postDate = new Date(postItem.timestamp);
      if (postDate < earliestDate) {
        earliestDate = postDate;
      }
    });
    const midpointDate = new Date((earliestDate.getTime() + latestDate.getTime()) / 2);
    previousPeriodPosts = socialDataRaw.filter(
      (postItem) =>
        matchesActivePlatformTab(postItem.platform, activeTab) &&
        new Date(postItem.timestamp) < midpointDate
    );
  }

  const previousTotal = previousPeriodPosts.length || 1;
  let previousPositive = 0;
  let previousNegative = 0;
  let previousNeutral = 0;

  previousPeriodPosts.forEach((postItem) => {
    if (postItem.sentiment === 'positive') {
      previousPositive++;
    } else if (postItem.sentiment === 'negative') {
      previousNegative++;
    } else {
      previousNeutral++;
    }
  });

  return {
    posShare: (previousPositive / previousTotal) * PERCENTAGE_MULTIPLIER,
    negShare: (previousNegative / previousTotal) * PERCENTAGE_MULTIPLIER,
    neuShare: (previousNeutral / previousTotal) * PERCENTAGE_MULTIPLIER,
  };
}

function computeActiveDominantStatistics({
  selectedDate,
  dominantSentiment,
  positiveShare,
  negativeShare,
  neutralShare,
  topPositiveTopic,
  topNegativeTopic,
  topNeutralTopic,
  prevPeriodStats,
  sentimentTrendData,
}: {
  selectedDate: string | null;
  dominantSentiment: 'positive' | 'negative' | 'neutral';
  positiveShare: string;
  negativeShare: string;
  neutralShare: string;
  topPositiveTopic: string;
  topNegativeTopic: string;
  topNeutralTopic: string;
  prevPeriodStats: { posShare: number; negShare: number; neuShare: number };
  sentimentTrendData: TimelinePoint[];
}) {
  if (!selectedDate) {
    const posShareValue = parseFloat(positiveShare) || 0;
    const negShareValue = parseFloat(negativeShare) || 0;
    const neuShareValue = parseFloat(neutralShare) || 0;

    let dominantShare = neuShareValue;
    let dominantTopic = topNeutralTopic || topPositiveTopic || DEFAULT_FALLBACK_TOPIC;
    let previousShare = prevPeriodStats.neuShare;

    if (dominantSentiment === 'positive') {
      dominantShare = posShareValue;
      dominantTopic = topPositiveTopic || DEFAULT_FALLBACK_TOPIC;
      previousShare = prevPeriodStats.posShare;
    } else if (dominantSentiment === 'negative') {
      dominantShare = negShareValue;
      dominantTopic = topNegativeTopic || DEFAULT_FALLBACK_TOPIC;
      previousShare = prevPeriodStats.negShare;
    }

    const shareDifference = previousShare > 0 ? dominantShare - previousShare : 0;
    const badgeText =
      previousShare > 0
        ? `${shareDifference >= 0 ? '↑' : '↓'} ${Math.abs(shareDifference).toFixed(1)}% vs. prev`
        : `${dominantShare.toFixed(1)}% share`;

    let badgeBg = '#e2e8f0';
    let badgeColor = '#334155';
    if (dominantSentiment === 'positive') {
      badgeBg = shareDifference >= 0 ? '#dcfce7' : '#fee2e2';
      badgeColor = shareDifference >= 0 ? '#15803d' : '#dc2626';
    } else if (dominantSentiment === 'negative') {
      badgeBg = shareDifference >= 0 ? '#fee2e2' : '#dcfce7';
      badgeColor = shareDifference >= 0 ? '#991b1b' : '#15803d';
    }

    return {
      dominant: dominantSentiment,
      dominantShare: dominantShare.toFixed(1),
      dominantTopic,
      diff: shareDifference,
      badgeText,
      badgeBg,
      badgeColor,
    };
  }

  const dayPayload = sentimentTrendData.find((point: any) => point.date === selectedDate);
  if (dayPayload) {
    const positiveCount = Number(dayPayload.positive || 0);
    const negativeCount = Number(dayPayload.negative || 0);
    const neutralCount = Number(dayPayload.neutral || 0);
    const dayTotal = positiveCount + negativeCount + neutralCount || 1;

    const dayPositiveShare = (positiveCount / dayTotal) * PERCENTAGE_MULTIPLIER;
    const dayNegativeShare = (negativeCount / dayTotal) * PERCENTAGE_MULTIPLIER;
    const dayNeutralShare = (neutralCount / dayTotal) * PERCENTAGE_MULTIPLIER;

    let dayDominant: 'positive' | 'negative' | 'neutral' = 'neutral';
    if (positiveCount > neutralCount && positiveCount > negativeCount) {
      dayDominant = 'positive';
    } else if (negativeCount > neutralCount && negativeCount > positiveCount) {
      dayDominant = 'negative';
    }

    const dominantShare =
      dayDominant === 'positive'
        ? dayPositiveShare
        : dayDominant === 'negative'
          ? dayNegativeShare
          : dayNeutralShare;
    const overallShare =
      dayDominant === 'positive'
        ? parseFloat(positiveShare)
        : dayDominant === 'negative'
          ? parseFloat(negativeShare)
          : parseFloat(neutralShare);
    const shareDifference = dominantShare - overallShare;

    return {
      dominant: dayDominant,
      dominantShare: dominantShare.toFixed(1),
      dominantTopic: dayPayload.topPositiveTopic || topPositiveTopic || DEFAULT_FALLBACK_TOPIC,
      diff: shareDifference,
      badgeText: `${shareDifference >= 0 ? '↑' : '↓'} ${Math.abs(shareDifference).toFixed(1)}% vs. avg`,
      badgeBg:
        dayDominant === 'positive'
          ? '#dcfce7'
          : dayDominant === 'negative'
            ? '#fee2e2'
            : '#e2e8f0',
      badgeColor:
        dayDominant === 'positive'
          ? '#15803d'
          : dayDominant === 'negative'
            ? '#991b1b'
            : '#334155',
    };
  }

  return {
    dominant: dominantSentiment,
    dominantShare: neutralShare,
    dominantTopic: topNeutralTopic || DEFAULT_FALLBACK_TOPIC,
    diff: 0,
    badgeText: `${neutralShare}% share`,
    badgeBg: '#e2e8f0',
    badgeColor: '#334155',
  };
}

function buildSentimentCalloutBannerConfig({
  activeDominantStats,
  overviewApiData,
  periodLabelEn,
  selectedDate,
  timeFilter,
}: {
  activeDominantStats: {
    dominant: 'positive' | 'negative' | 'neutral';
    dominantShare: string;
    dominantTopic: string;
    badgeText: string;
    badgeBg: string;
    badgeColor: string;
  };
  overviewApiData: DashboardOverviewData | null;
  periodLabelEn: string;
  selectedDate: string | null;
  timeFilter: string;
}) {
  const { dominant, dominantShare, dominantTopic, badgeText, badgeBg, badgeColor } =
    activeDominantStats;
  const topicLabel =
    dominantTopic && dominantTopic !== '-' ? dominantTopic : DEFAULT_FALLBACK_TOPIC;

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
      ),
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
      ),
    };
  }

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
    ),
  };
}

function buildDailySentimentInspectorInfo({
  dayData,
  fallbackTopic,
  topPositiveTopic,
  topNegativeTopic,
  topNeutralTopic,
}: {
  dayData: any;
  fallbackTopic: string;
  topPositiveTopic: string;
  topNegativeTopic: string;
  topNeutralTopic: string;
}) {
  if (!dayData) {
    return {
      type: 'neutral',
      label: 'Sentimen Dominan: Netral',
      badgeBg: '#f1f5f9',
      badgeBorder: '#cbd5e1',
      textColor: '#334155',
      topic: fallbackTopic,
    };
  }

  const positiveCount = Number(dayData.positive || 0);
  const neutralCount = Number(dayData.neutral || 0);
  const negativeCount = Number(dayData.negative || 0);

  if (positiveCount > neutralCount && positiveCount >= negativeCount) {
    return {
      type: 'positive',
      label: 'Sentimen Dominan: Positif',
      badgeBg: '#dcfce7',
      badgeBorder: '#86efac',
      textColor: '#166534',
      topic: dayData.topPositiveTopic || topPositiveTopic || fallbackTopic,
    };
  }

  if (negativeCount > neutralCount && negativeCount > positiveCount) {
    return {
      type: 'negative',
      label: 'Sentimen Dominan: Negatif',
      badgeBg: '#fee2e2',
      badgeBorder: '#fca5a5',
      textColor: '#991b1b',
      topic: dayData.topNegativeTopic || topNegativeTopic || fallbackTopic,
    };
  }

  return {
    type: 'neutral',
    label: 'Sentimen Dominan: Netral',
    badgeBg: '#f1f5f9',
    badgeBorder: '#cbd5e1',
    textColor: '#334155',
    topic: dayData.topNeutralTopic || dayData.dominant_topic || topNeutralTopic || fallbackTopic,
  };
}

const insightNumberBadgeStyle: React.CSSProperties = {
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
  flexShrink: 0,
};

export default Overview;
