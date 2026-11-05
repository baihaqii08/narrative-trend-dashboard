// @ts-nocheck
import React, { useState, useMemo, useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';
import { fetchKnowledgeGraphFromApi, fetchPostsFromApi, normalizeEntityType, SocialPost } from '../../services/api';

export const ENTITY_COLORS: Record<string, string> = {
  topic: '#f97316',        // Orange (Topic MBG)
  person: '#8b5cf6',       // Ungu (PER - 19 entitas)
  organization: '#3b82f6', // Biru (ORG - 12 entitas)
  geopolitical: '#06b6d4', // Cyan (GPE - 26 entitas)
  location: '#10b981',     // Hijau Emerald (LOC - 5 entitas)
  product: '#eab308',      // Kuning Amber (PRD - 23 entitas)
  event: '#ec4899',        // Pink (EVT - 10 entitas)
  norm: '#ef4444',         // Merah (NOR - 33 entitas)
  facility: '#14b8a6'      // Teal (FAC - 0 entitas saat ini)
};

export const ENTITY_CATEGORIES = [
  { id: 'All', label: 'Semua Kategori' },
  { id: 'person', label: 'Person (Tokoh)' },
  { id: 'organization', label: 'Organization (Lembaga)' },
  { id: 'geopolitical', label: 'Geopolitical (Wilayah/Negara)' },
  { id: 'location', label: 'Location (Lokasi)' },
  { id: 'product', label: 'Product (Pangan & Program)' },
  { id: 'event', label: 'Event (Kegiatan)' },
  { id: 'norm', label: 'Norm (Aturan & Afiliasi)' },
  { id: 'facility', label: 'Facility (Fasilitas)' },
  { id: 'topic', label: 'Topic (Topik Utama)' }
];

interface KnowledgeGraphProps {
  theme: any;
  isDark?: boolean;
  timeFilter?: string;
  platformFilter?: string;
  isRefreshing?: boolean;
  embedded?: boolean;
  selectedTopic?: string | null;
  postsData?: SocialPost[];
}

function KnowledgeGraph({
  theme,
  isDark,
  timeFilter = 'all',
  platformFilter = 'all',
  isRefreshing,
  embedded = false,
  selectedTopic = null,
  postsData
}: KnowledgeGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<any>(null);

  // Filters
  const [entityType, setEntityType] = useState('All');
  const [minFreq, setMinFreq] = useState('10');

  // State data dari FastAPI
  const [socialDataRaw, setSocialDataRaw] = useState<SocialPost[]>(postsData || []);
  const [apiGraphElements, setApiGraphElements] = useState<{ nodes: any[]; edges: any[] } | null>(null);

  useEffect(() => {
    if (Array.isArray(postsData)) {
      setSocialDataRaw(postsData);
    }
  }, [postsData]);

  useEffect(() => {
    let isMounted = true;

    // Coba ambil graph langsung dari endpoint `/api/graph/data`
    fetchKnowledgeGraphFromApi({
      platform: platformFilter,
      timeFilter,
      entityType: entityType !== 'All' ? entityType : undefined,
      minFreq,
      topic: selectedTopic
    })
      .then((res) => {
        if (isMounted && res && res.nodes.length > 0) {
          setApiGraphElements(res);
        } else if (isMounted) {
          setApiGraphElements(null);
        }
      })
      .catch(() => {
        if (isMounted) {
          setApiGraphElements(null);
        }
      });

    if (!postsData) {
      fetchPostsFromApi({ platform: platformFilter, timeFilter })
        .then((posts) => {
          if (isMounted) setSocialDataRaw(posts);
        })
        .catch(() => {});
    }

    return () => {
      isMounted = false;
    };
  }, [timeFilter, platformFilter, entityType, minFreq, selectedTopic, isRefreshing, postsData]);

  const graphData = useMemo(() => {
    // 1. Jika data dari Neo4j / FastAPI tersedia
    if (apiGraphElements && apiGraphElements.nodes.length > 0) {
      let filteredNodes = [...apiGraphElements.nodes];
      let filteredEdges = [...apiGraphElements.edges];

      // Filter kategori tipe entitas
      if (entityType !== 'All') {
        const targetType = entityType.toLowerCase();
        filteredNodes = filteredNodes.filter((n: any) => {
          const t = String(n.data?.type || '').toLowerCase();
          return t === targetType || (targetType !== 'topic' && t === 'topic');
        });
      }

      // Filter frekuensi kemunculan (mention_count / weight)
      const freqThreshold = parseInt(minFreq, 10);
      if (!isNaN(freqThreshold) && freqThreshold > 0) {
        filteredNodes = filteredNodes.filter((n: any) => {
          if (n.data?.type === 'topic') return true;
          return Number(n.data?.weight || 0) >= freqThreshold;
        });
      }

      // Filter topik terpilih jika ada
      if (selectedTopic) {
        const cleanSelTopic = selectedTopic.toLowerCase();
        const connectedIds = new Set<string>();

        // Cari topic node
        filteredNodes.forEach((n: any) => {
          const label = String(n.data?.label || '').toLowerCase();
          if (n.data?.type === 'topic' && label.includes(cleanSelTopic)) {
            connectedIds.add(String(n.data.id));
          }
        });

        // Temukan semua edge yang terhubung ke topic node tersebut
        filteredEdges.forEach((e: any) => {
          if (connectedIds.has(String(e.data.target))) {
            connectedIds.add(String(e.data.source));
          }
          if (connectedIds.has(String(e.data.source))) {
            connectedIds.add(String(e.data.target));
          }
        });

        if (connectedIds.size > 0) {
          filteredNodes = filteredNodes.filter((n: any) => connectedIds.has(String(n.data.id)));
        }
      }

      // Pastikan edge hanya menghubungkan node yang valid
      const validNodeIds = new Set(filteredNodes.map((n: any) => String(n.data.id)));
      filteredEdges = filteredEdges.filter(
        (e: any) => validNodeIds.has(String(e.data.source)) && validNodeIds.has(String(e.data.target))
      );

      return { nodes: filteredNodes, edges: filteredEdges };
    }

    // 2. Fallback: Ekstraksi dari raw posts jika API graph belum terisi
    let data = [...socialDataRaw];

    if (platformFilter && platformFilter !== 'all') {
      data = data.filter(item => item.platform && item.platform.toLowerCase() === platformFilter.toLowerCase());
    }

    const entityCounts: Record<string, { count: number; type: string }> = {};
    const topicCounts: Record<string, number> = {};
    const topicEntities: Record<string, Record<string, number>> = {};

    data.forEach(item => {
      if (!item.topic) return;
      topicCounts[item.topic] = (topicCounts[item.topic] || 0) + 1;
      if (!topicEntities[item.topic]) topicEntities[item.topic] = {};

      const processedEntities = new Set<string>();

      if (item.entities && Array.isArray(item.entities)) {
        item.entities.forEach((ent: any) => {
          if (!ent.name) return;
          const eName = ent.name;
          const eType = normalizeEntityType(ent.type);
          processedEntities.add(eName);
          if (!entityCounts[eName]) entityCounts[eName] = { count: 0, type: eType };
          entityCounts[eName].count++;
          topicEntities[item.topic][eName] = (topicEntities[item.topic][eName] || 0) + 1;
        });
      }

      const hashtags = item.content ? (item.content.match(/#[\w]+/g) || []) : [];
      hashtags.forEach(tag => {
        const entity = tag.substring(1);
        if (entity === item.topic.replace(/[^\w]/g, '')) return;
        if (processedEntities.has(entity)) return;

        processedEntities.add(entity);
        const eType = 'norm';
        if (!entityCounts[entity]) entityCounts[entity] = { count: 0, type: eType };
        entityCounts[entity].count++;
        topicEntities[item.topic][entity] = (topicEntities[item.topic][entity] || 0) + 1;
      });
    });

    const freqThreshold = parseInt(minFreq, 10);
    const actualThreshold = embedded ? 1 : (freqThreshold === 10 ? 1 : freqThreshold === 50 ? 3 : 5);

    const allTopics = Object.entries(topicCounts)
      .filter(([_, count]) => count >= actualThreshold)
      .map(([topic, count]) => ({
        data: { id: `topic_${topic}`, label: topic, type: 'topic', weight: count }
      }));

    const allEntities = Object.entries(entityCounts)
      .filter(([_, obj]) => (entityType === 'All' || entityType.toLowerCase() === obj.type.toLowerCase()) && obj.count >= actualThreshold)
      .map(([entity, obj]) => ({
        data: { id: `entity_${entity}`, label: entity, type: obj.type, weight: obj.count }
      }));

    let finalNodes = embedded ? [...allTopics.slice(0, 6), ...allEntities.slice(0, 18)] : [...allTopics, ...allEntities];

    if (selectedTopic) {
      const topicId = `topic_${selectedTopic}`;
      const connectedIds = new Set<string>();
      connectedIds.add(topicId);

      Object.entries(topicEntities).forEach(([topic, entities]) => {
        if (topic === selectedTopic) {
          Object.keys(entities).forEach(eName => connectedIds.add(`entity_${eName}`));
        }
      });

      const filtered = finalNodes.filter(n => connectedIds.has(n.data.id));
      if (filtered.length > 0) {
        finalNodes = filtered;
      }
    }

    const validNodeIds = new Set(finalNodes.map(n => n.data.id));
    const edges: any[] = [];

    Object.entries(topicEntities).forEach(([topic, entities]) => {
      Object.entries(entities).forEach(([entity, count]) => {
        const sourceId = `topic_${topic}`;
        const targetId = `entity_${entity}`;
        if (validNodeIds.has(sourceId) && validNodeIds.has(targetId)) {
          edges.push({
            data: {
              id: `edge_${topic}_${entity}`,
              source: sourceId,
              target: targetId,
              type: 'BELONGS_TO_TOPIC',
              style: 'dashed',
              weight: count
            }
          });
        }
      });
    });

    return { nodes: finalNodes, edges };
  }, [apiGraphElements, socialDataRaw, platformFilter, entityType, minFreq, embedded, selectedTopic]);

  useEffect(() => {
    let resizeObserver: ResizeObserver | null = null;

    if (containerRef.current) {
      cyRef.current = cytoscape({
        container: containerRef.current,
        elements: graphData,
        style: [
          {
            selector: 'node',
            style: {
              'label': 'data(label)',
              'text-valign': 'bottom',
              'text-margin-y': 4,
              'color': theme.textMain,
              'font-weight': 'bold',
              'font-size': embedded ? '11px' : '12px',
              'background-color': (ele) => {
                const t = String(ele.data('type') || '').toLowerCase();
                return ENTITY_COLORS[t] || '#8b5cf6';
              },
              'width': (ele) => {
                const t = String(ele.data('type') || '').toLowerCase();
                if (t === 'topic') return embedded ? 34 : 44;
                const w = Number(ele.data('weight') || 1);
                return Math.max(embedded ? 18 : 24, Math.min(embedded ? 40 : 56, 16 + Math.log(Math.max(1, w)) * (embedded ? 4 : 6)));
              },
              'height': (ele) => {
                const t = String(ele.data('type') || '').toLowerCase();
                if (t === 'topic') return embedded ? 34 : 44;
                const w = Number(ele.data('weight') || 1);
                return Math.max(embedded ? 18 : 24, Math.min(embedded ? 40 : 56, 16 + Math.log(Math.max(1, w)) * (embedded ? 4 : 6)));
              },
              'border-width': (ele) => (ele.data('type') === 'topic' ? 3 : 2),
              'border-color': (ele) => (ele.data('type') === 'topic' ? '#ffedd5' : '#ffffff')
            }
          },
          {
            selector: 'edge',
            style: {
              'width': (ele) => {
                const isDashed = ele.data('style') === 'dashed' || ele.data('type') === 'BELONGS_TO_TOPIC';
                if (isDashed) return 1.5;
                const w = Number(ele.data('weight') || 1);
                return Math.max(1.5, Math.min(embedded ? 3.5 : 5, w * 2.5));
              },
              'line-style': (ele) => {
                const isDashed = ele.data('style') === 'dashed' || ele.data('type') === 'BELONGS_TO_TOPIC';
                return isDashed ? 'dashed' : 'solid';
              },
              'line-color': (ele) => {
                const isDashed = ele.data('style') === 'dashed' || ele.data('type') === 'BELONGS_TO_TOPIC';
                if (isDashed) return isDark ? '#64748b' : '#94a3b8';
                return isDark ? '#475569' : '#cbd5e1';
              },
              'curve-style': 'bezier',
              'opacity': 0.75
            }
          }
        ],
        layout: {
          name: 'cose',
          padding: embedded ? 20 : 30,
          nodeRepulsion: embedded ? 2800 : 4500,
          idealEdgeLength: embedded ? 70 : 100,
          animate: false
        }
      });

      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
          if (cyRef.current) {
            cyRef.current.resize();
            cyRef.current.fit(20);
          }
        });
        resizeObserver.observe(containerRef.current);
      }
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (cyRef.current) {
        cyRef.current.destroy();
      }
    };
  }, [graphData, theme, isDark, embedded]);

  const cardStyle = {
    backgroundColor: theme.bgCard,
    borderRadius: '16px',
    border: `1px solid ${theme.border}`,
    padding: '24px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
    display: 'flex',
    flexDirection: 'column' as const,
    height: embedded ? '100%' : 'auto',
    minHeight: embedded ? '460px' : '650px',
    boxSizing: 'border-box' as const,
    textAlign: 'left' as const
  };

  const filterStyle = {
    padding: '6px 12px',
    borderRadius: '8px',
    border: `1px solid ${theme.border}`,
    backgroundColor: theme.inputBg || '#f8fafc',
    color: theme.textMain,
    fontSize: '12px',
    fontWeight: '600',
    outline: 'none',
    cursor: 'pointer',
  };

  return (
    <article className="card-hover-effect" style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3"></circle>
              <circle cx="6" cy="12" r="3"></circle>
              <circle cx="18" cy="19" r="3"></circle>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
            </svg>
          </div>
          <div>
            <h3 style={{ color: theme.textMain, margin: 0, fontSize: '18px', fontWeight: '800' }}>Knowledge Graph</h3>
            <p style={{ color: theme.textMuted, margin: '2px 0 0 0', fontSize: '12px' }}>
              {selectedTopic ? `Jaringan entitas terhubung: ${selectedTopic}` : 'Visualisasi relasi entitas MBG & Topik'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {selectedTopic && (
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#15803d', backgroundColor: '#dcfce7', padding: '4px 10px', borderRadius: '8px' }}>
              Fokus: {selectedTopic}
            </span>
          )}
          <select
            style={filterStyle}
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
          >
            {ENTITY_CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.label}
              </option>
            ))}
          </select>

          <select
            style={filterStyle}
            value={minFreq}
            onChange={(e) => setMinFreq(e.target.value)}
          >
            <option value="0">Min Mention: Semua</option>
            <option value="5">Min Mention: ≥ 5</option>
            <option value="10">Min Mention: ≥ 10</option>
            <option value="25">Min Mention: ≥ 25</option>
            <option value="50">Min Mention: ≥ 50</option>
          </select>
        </div>
      </div>

      {/* Mini Graph Canvas */}
      <div style={{
        flex: 1,
        position: 'relative',
        width: '100%',
        minHeight: embedded ? '280px' : '480px',
        borderRadius: '10px',
        overflow: 'hidden',
        backgroundColor: isDark ? '#0f172a' : '#f8fafc',
        border: `1px solid ${theme.border}`
      }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }} />
      </div>

      {/* Legend Lengkap 8 Kategori MBG + Topic */}
      <div style={{ display: 'flex', gap: '12px', marginTop: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: '600', color: theme.textMuted }}>
          <span style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: ENTITY_COLORS.topic }}></span> Topic (9)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: '600', color: theme.textMuted }}>
          <span style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: ENTITY_COLORS.person }}></span> Person (19)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: '600', color: theme.textMuted }}>
          <span style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: ENTITY_COLORS.organization }}></span> Organization (12)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: '600', color: theme.textMuted }}>
          <span style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: ENTITY_COLORS.geopolitical }}></span> Geopolitical (26)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: '600', color: theme.textMuted }}>
          <span style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: ENTITY_COLORS.location }}></span> Location (5)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: '600', color: theme.textMuted }}>
          <span style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: ENTITY_COLORS.product }}></span> Product (23)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: '600', color: theme.textMuted }}>
          <span style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: ENTITY_COLORS.event }}></span> Event (10)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: '600', color: theme.textMuted }}>
          <span style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: ENTITY_COLORS.norm }}></span> Norm (33)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: '600', color: theme.textMuted }}>
          <span style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: ENTITY_COLORS.facility }}></span> Facility (0)
        </div>
      </div>
    </article>
  );
}

export default KnowledgeGraph;
