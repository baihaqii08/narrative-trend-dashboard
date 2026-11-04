// @ts-nocheck
import React, { useState, useMemo, useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';
import { Link } from 'react-router-dom';
import { fetchKnowledgeGraphFromApi, fetchPostsFromApi, normalizeEntityType, SocialPost } from '../../services/api';

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

function KnowledgeGraph({ theme, isDark, timeFilter = 'all', platformFilter = 'all', isRefreshing, embedded = false, selectedTopic = null, postsData }: KnowledgeGraphProps) {
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

    // Coba ambil graph langsung dari endpoint `/api/graph/data` sesuai PRD
    fetchKnowledgeGraphFromApi({
      platform: platformFilter,
      timeFilter,
      entityType,
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

    // Jika komponen dibuka mandiri (tanpa `postsData` dari Overview), ambil posts dari `/api/posts`
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
    if (apiGraphElements && apiGraphElements.nodes.length > 0) {
      return apiGraphElements;
    }

    let data = [...socialDataRaw];

    if (timeFilter && timeFilter !== 'all') {
      let maxDate = new Date(0);
      data.forEach(item => {
        const d = new Date(item.timestamp);
        if (d > maxDate) maxDate = d;
      });
      const cutoff = new Date(maxDate);
      if (timeFilter === 'last7') cutoff.setDate(cutoff.getDate() - 7);
      if (timeFilter === 'last14') cutoff.setDate(cutoff.getDate() - 14);
      if (timeFilter === 'last30') cutoff.setDate(cutoff.getDate() - 30);
      data = data.filter(item => item.timestamp && new Date(item.timestamp) >= cutoff);
    }

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

      // 1. Process item.entities array if exists
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

      // 2. Process hashtags from content
      const hashtags = item.content ? (item.content.match(/#[\w]+/g) || []) : [];
      hashtags.forEach(tag => {
        const entity = tag.substring(1);
        if (entity === item.topic.replace(/[^\w]/g, '')) return; // Skip duplicate of topic name
        if (processedEntities.has(entity)) return;

        processedEntities.add(entity);
        const eType = 'Topic';
        if (!entityCounts[entity]) entityCounts[entity] = { count: 0, type: eType };
        entityCounts[entity].count++;
        topicEntities[item.topic][entity] = (topicEntities[item.topic][entity] || 0) + 1;
      });
    });

    const freqThreshold = parseInt(minFreq, 10);
    const actualThreshold = embedded ? 1 : (freqThreshold === 10 ? 1 : freqThreshold === 50 ? 3 : 5);

    let finalNodes: any[] = [];

    if (embedded) {
      // Balanced node selection for mini Knowledge Graph card
      const selectedTopics = Object.entries(topicCounts)
        .filter(([_, count]) => count >= actualThreshold)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([topic, count]) => ({ data: { id: `topic_${topic}`, label: topic, type: 'topic', weight: count } }));

      const selectedOrgs = Object.entries(entityCounts)
        .filter(([_, obj]) => obj.type === 'Organization' && obj.count >= actualThreshold && (entityType === 'All' || entityType === 'Organization'))
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5)
        .map(([entity, obj]) => ({ data: { id: `entity_${entity}`, label: entity, type: obj.type, weight: obj.count } }));

      const selectedLocs = Object.entries(entityCounts)
        .filter(([_, obj]) => obj.type === 'Location' && obj.count >= actualThreshold && (entityType === 'All' || entityType === 'Location'))
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 4)
        .map(([entity, obj]) => ({ data: { id: `entity_${entity}`, label: entity, type: obj.type, weight: obj.count } }));

      const selectedPersons = Object.entries(entityCounts)
        .filter(([_, obj]) => obj.type === 'Person' && obj.count >= actualThreshold && (entityType === 'All' || entityType === 'Person'))
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 4)
        .map(([entity, obj]) => ({ data: { id: `entity_${entity}`, label: entity, type: obj.type, weight: obj.count } }));

      const selectedSubTopics = Object.entries(entityCounts)
        .filter(([_, obj]) => obj.type === 'Topic' && obj.count >= actualThreshold && (entityType === 'All' || entityType === 'Topic'))
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 3)
        .map(([entity, obj]) => ({ data: { id: `entity_${entity}`, label: entity, type: obj.type, weight: obj.count } }));

      finalNodes = [...selectedTopics, ...selectedOrgs, ...selectedLocs, ...selectedPersons, ...selectedSubTopics];
    } else {
      // Full graph mode
      const allTopics = Object.entries(topicCounts)
        .filter(([_, count]) => count >= actualThreshold)
        .map(([topic, count]) => ({ data: { id: `topic_${topic}`, label: topic, type: 'topic', weight: count } }));

      const allEntities = Object.entries(entityCounts)
        .filter(([_, obj]) => (entityType === 'All' || entityType === obj.type) && obj.count >= actualThreshold)
        .map(([entity, obj]) => ({ data: { id: `entity_${entity}`, label: entity, type: obj.type, weight: obj.count } }));

      finalNodes = [...allTopics, ...allEntities];
    }

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

    // Build edges connecting selected nodes
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
              weight: count
            }
          });
        }
      });
    });

    return { nodes: finalNodes, edges };
  }, [apiGraphElements, socialDataRaw, timeFilter, platformFilter, entityType, minFreq, isRefreshing, embedded, selectedTopic]);

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
                const t = ele.data('type');
                if (t === 'topic') return '#f97316';
                if (t === 'Organization') return '#3b82f6';
                if (t === 'Location') return '#10b981';
                return '#8b5cf6';
              },
              'width': (ele) => Math.max(embedded ? 20 : 28, Math.min(embedded ? 46 : 70, ele.data('weight') * (embedded ? 2.8 : 4))),
              'height': (ele) => Math.max(embedded ? 20 : 28, Math.min(embedded ? 46 : 70, ele.data('weight') * (embedded ? 2.8 : 4))),
              'border-width': 2,
              'border-color': '#ffffff'
            }
          },
          {
            selector: 'edge',
            style: {
              'width': (ele) => Math.max(1, Math.min(embedded ? 3 : 5, ele.data('weight'))),
              'line-color': isDark ? '#475569' : '#cbd5e1',
              'curve-style': 'bezier',
              'opacity': 0.7
            }
          }
        ],
        layout: {
          name: 'cose',
          padding: embedded ? 20 : 30,
          nodeRepulsion: embedded ? 2800 : 4000,
          idealEdgeLength: embedded ? 65 : 90,
          animate: false
        }
      });

      // Automatically resize Cytoscape when container dimensions change
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

  if (embedded) {
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
              {/* Network Graph Icon */}
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
                {selectedTopic ? `Jaringan entitas terhubung: ${selectedTopic}` : 'Visualisasi jaringan entitas & topik'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
              <option value="All">All Entities</option>
              <option value="Organization">Organization</option>
              <option value="Location">Location</option>
              <option value="Topic">Topic</option>
              <option value="Person">Person</option>
            </select>
          </div>
        </div>

        {/* Mini Graph Canvas */}
        <div style={{
          flex: 1,
          position: 'relative',
          width: '100%',
          minHeight: '280px',
          borderRadius: '10px',
          overflow: 'hidden',
          backgroundColor: isDark ? '#0f172a' : '#f8fafc',
          border: `1px solid ${theme.border}`
        }}>
          <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }} />
        </div>

        {/* Mini Legend */}
        <div style={{ display: 'flex', gap: '16px', marginTop: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '600', color: theme.textMuted }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#f97316' }}></span> Topic
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '600', color: theme.textMuted }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#3b82f6' }}></span> Organization
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '600', color: theme.textMuted }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10b981' }}></span> Location
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '600', color: theme.textMuted }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#8b5cf6' }}></span> Person
          </div>
        </div>
      </article>
    );
  }

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '20px', opacity: isRefreshing ? 0.6 : 1, transition: 'opacity 0.2s' }}>
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <h2 style={{ color: theme.textMain, margin: 0, fontWeight: '700' }}>Knowledge Graph</h2>
            <p style={{ color: theme.textMuted, margin: '4px 0 0 0', fontSize: '14px' }}>Visualisasi jaringan entitas dan relasi tren narasi</p>
          </div>

          <div style={{ display: 'flex', gap: '10px', zIndex: 10 }}>
            <select style={filterStyle} value={entityType} onChange={(e) => setEntityType(e.target.value)}>
              <option value="All">All Entity Types</option>
              <option value="Organization">Organization</option>
              <option value="Location">Location</option>
              <option value="Topic">Topic</option>
            </select>

            <select style={filterStyle} value={minFreq} onChange={(e) => setMinFreq(e.target.value)}>
              <option value="10">Min Frequency: 10</option>
              <option value="50">Min Frequency: 50</option>
              <option value="100">Min Frequency: 100</option>
            </select>
          </div>
        </div>

        <div style={{ flex: 1, position: 'relative', minHeight: '520px' }}>
          <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }} />
        </div>
      </div>
    </section>
  );
}

export default KnowledgeGraph;


