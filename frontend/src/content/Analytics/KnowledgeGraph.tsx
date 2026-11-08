// @ts-nocheck
import React, { useState, useMemo, useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';
import {
  buildMbgFallbackGraph,
  fetchKnowledgeGraphFromApi,
  fetchPostsFromApi,
  normalizeEntityType,
  SocialPost
} from '../../services/api';

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
  const [edgeFilter, setEdgeFilter] = useState<'All' | 'CO_OCCURS_WITH' | 'BELONGS_TO_TOPIC'>('All');
  const [minFreq, setMinFreq] = useState('0');
  const [showEdgeLabels, setShowEdgeLabels] = useState(false);

  // Selected / Hovered Node or Edge Inspector
  const [inspectedItem, setInspectedItem] = useState<any | null>(null);

  // State data dari FastAPI / Neo4j (diinisialisasi langsung dengan dataset MBG resmi)
  const [socialDataRaw, setSocialDataRaw] = useState<SocialPost[]>(postsData || []);
  const [apiGraphElements, setApiGraphElements] = useState<{ nodes: any[]; edges: any[] } | null>(() =>
    buildMbgFallbackGraph()
  );

  useEffect(() => {
    if (Array.isArray(postsData)) {
      setSocialDataRaw(postsData);
    }
  }, [postsData]);

  useEffect(() => {
    let isMounted = true;

    // Ambil seluruh graph dari `/api/graph/data` dan lakukan pemfilteran interaktif di sisi klien agar relasi antar-node tetap utuh
    fetchKnowledgeGraphFromApi({
      platform: platformFilter,
      timeFilter,
      minFreq: 0
    })
      .then((res) => {
        if (isMounted && res && res.nodes.length > 0) {
          setApiGraphElements(res);
        }
      })
      .catch(() => {
        if (isMounted) {
          setApiGraphElements(buildMbgFallbackGraph());
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
  }, [timeFilter, platformFilter, isRefreshing, postsData]);

  const { graphData, statsSummary } = useMemo(() => {
    const baseGraph =
      apiGraphElements && apiGraphElements.nodes.length > 0
        ? apiGraphElements
        : buildMbgFallbackGraph();

    let allNodes = [...baseGraph.nodes];
    let allEdges = [...baseGraph.edges];

    // 1. Filter berdasarkan frekuensi mention_count
    const freqThreshold = parseInt(minFreq, 10);
    if (!isNaN(freqThreshold) && freqThreshold > 0) {
      allNodes = allNodes.filter((n: any) => {
        if (n.data?.type === 'topic') return true;
        return Number(n.data?.weight || 0) >= freqThreshold;
      });
    }

    // 2. Filter berdasarkan kategori tipe entitas (tetap sertakan tetangga CO_OCCURS_WITH & Topic agar relasi node terlihat)
    if (entityType !== 'All') {
      const targetType = entityType.toLowerCase();
      if (targetType === 'topic') {
        // Jika memilih Topic, tampilkan semua topic beserta entitas yang memiliki BELONGS_TO_TOPIC
        const topicIds = new Set(
          allNodes.filter((n: any) => n.data?.type === 'topic').map((n: any) => String(n.data.id))
        );
        const connectedEntityIds = new Set<string>();
        allEdges.forEach((e: any) => {
          if (e.data?.type === 'BELONGS_TO_TOPIC') {
            if (topicIds.has(String(e.data.target))) connectedEntityIds.add(String(e.data.source));
            if (topicIds.has(String(e.data.source))) connectedEntityIds.add(String(e.data.target));
          }
        });
        allNodes = allNodes.filter(
          (n: any) => topicIds.has(String(n.data.id)) || connectedEntityIds.has(String(n.data.id))
        );
      } else {
        const primaryIds = new Set(
          allNodes
            .filter((n: any) => String(n.data?.type || '').toLowerCase() === targetType)
            .map((n: any) => String(n.data.id))
        );
        const neighborIds = new Set<string>();
        allEdges.forEach((e: any) => {
          const s = String(e.data.source);
          const t = String(e.data.target);
          if (primaryIds.has(s)) neighborIds.add(t);
          if (primaryIds.has(t)) neighborIds.add(s);
        });
        allNodes = allNodes.filter(
          (n: any) => primaryIds.has(String(n.data.id)) || neighborIds.has(String(n.data.id))
        );
      }
    }

    // 3. Filter berdasarkan topik terpilih jika ada
    if (selectedTopic) {
      const cleanSelTopic = selectedTopic.toLowerCase();
      const connectedIds = new Set<string>();

      allNodes.forEach((n: any) => {
        const label = String(n.data?.label || '').toLowerCase();
        if (n.data?.type === 'topic' && label.includes(cleanSelTopic)) {
          connectedIds.add(String(n.data.id));
        }
      });

      // Tambahkan entitas yang BELONGS_TO_TOPIC ke topik ini
      allEdges.forEach((e: any) => {
        if (connectedIds.has(String(e.data.target))) {
          connectedIds.add(String(e.data.source));
        }
        if (connectedIds.has(String(e.data.source))) {
          connectedIds.add(String(e.data.target));
        }
      });

      // Tambahkan juga tetangga CO_OCCURS_WITH dari entitas-entitas di topik tersebut
      allEdges.forEach((e: any) => {
        if (e.data?.type === 'CO_OCCURS_WITH') {
          if (connectedIds.has(String(e.data.source))) connectedIds.add(String(e.data.target));
          if (connectedIds.has(String(e.data.target))) connectedIds.add(String(e.data.source));
        }
      });

      if (connectedIds.size > 0) {
        allNodes = allNodes.filter((n: any) => connectedIds.has(String(n.data.id)));
      }
    }

    // 4. Filter berdasarkan tipe edge (All, CO_OCCURS_WITH, BELONGS_TO_TOPIC)
    const validNodeIds = new Set(allNodes.map((n: any) => String(n.data.id)));
    let filteredEdges = allEdges.filter(
      (e: any) => validNodeIds.has(String(e.data.source)) && validNodeIds.has(String(e.data.target))
    );

    if (edgeFilter !== 'All') {
      filteredEdges = filteredEdges.filter((e: any) => e.data?.type === edgeFilter);
      // Jika hanya menampilkan CO_OCCURS_WITH, sembunyikan node topic agar fokus pada relasi antar-entitas
      if (edgeFilter === 'CO_OCCURS_WITH') {
        const coNodeIds = new Set<string>();
        filteredEdges.forEach((e: any) => {
          coNodeIds.add(String(e.data.source));
          coNodeIds.add(String(e.data.target));
        });
        allNodes = allNodes.filter(
          (n: any) => n.data?.type !== 'topic' && (coNodeIds.size === 0 || coNodeIds.has(String(n.data.id)))
        );
      }
    }

    const btCount = filteredEdges.filter((e: any) => e.data?.type === 'BELONGS_TO_TOPIC').length;
    const coCount = filteredEdges.filter((e: any) => e.data?.type === 'CO_OCCURS_WITH').length;

    return {
      graphData: { nodes: allNodes, edges: filteredEdges },
      statsSummary: {
        nodesCount: allNodes.length,
        edgesCount: filteredEdges.length,
        btCount,
        coCount
      }
    };
  }, [apiGraphElements, socialDataRaw, entityType, edgeFilter, minFreq, selectedTopic]);

  useEffect(() => {
    let resizeObserver: ResizeObserver | null = null;

    if (containerRef.current) {
      const cy = cytoscape({
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
              'font-size': embedded ? '10px' : '11px',
              'text-background-color': isDark ? '#0f172a' : '#ffffff',
              'text-background-opacity': 0.75,
              'text-background-padding': '2px',
              'text-background-shape': 'roundrectangle',
              'background-color': (ele) => {
                const t = String(ele.data('type') || '').toLowerCase();
                return ENTITY_COLORS[t] || '#8b5cf6';
              },
              'width': (ele) => {
                const t = String(ele.data('type') || '').toLowerCase();
                if (t === 'topic') return embedded ? 36 : 46;
                const w = Number(ele.data('weight') || 1);
                return Math.max(
                  embedded ? 18 : 22,
                  Math.min(embedded ? 40 : 54, 16 + Math.log(Math.max(1, w)) * (embedded ? 4 : 5.5))
                );
              },
              'height': (ele) => {
                const t = String(ele.data('type') || '').toLowerCase();
                if (t === 'topic') return embedded ? 36 : 46;
                const w = Number(ele.data('weight') || 1);
                return Math.max(
                  embedded ? 18 : 22,
                  Math.min(embedded ? 40 : 54, 16 + Math.log(Math.max(1, w)) * (embedded ? 4 : 5.5))
                );
              },
              'border-width': (ele) => (ele.data('type') === 'topic' ? 3 : 2),
              'border-color': (ele) => (ele.data('type') === 'topic' ? '#ffedd5' : '#ffffff')
            }
          },
          {
            // Tipe Edge 1: BELONGS_TO_TOPIC (:Entity)-[:BELONGS_TO_TOPIC]->(:Topic)
            selector: 'edge[type = "BELONGS_TO_TOPIC"]',
            style: {
              'width': 1.5,
              'line-style': 'dashed',
              'line-dash-pattern': [6, 4],
              'line-color': isDark ? '#64748b' : '#94a3b8',
              'target-arrow-shape': 'triangle',
              'target-arrow-color': isDark ? '#64748b' : '#94a3b8',
              'arrow-scale': 0.8,
              'curve-style': 'bezier',
              'opacity': 0.65,
              'label': showEdgeLabels ? 'BELONGS_TO_TOPIC' : '',
              'font-size': '8px',
              'color': isDark ? '#cbd5e1' : '#475569',
              'text-rotation': 'autorotate',
              'text-background-color': isDark ? '#0f172a' : '#ffffff',
              'text-background-opacity': 0.8,
              'text-background-padding': '1px'
            }
          },
          {
            // Tipe Edge 2: CO_OCCURS_WITH (:Entity)-[:CO_OCCURS_WITH]-(:Entity)
            selector: 'edge[type = "CO_OCCURS_WITH"]',
            style: {
              'width': (ele) => {
                const npmi = Number(ele.data('npmi') ?? ele.data('weight') ?? 0.5);
                return Math.max(2, Math.min(embedded ? 4.5 : 6, npmi * 5));
              },
              'line-style': 'solid',
              'line-color': isDark ? '#38bdf8' : '#0284c7',
              'curve-style': 'bezier',
              'opacity': 0.85,
              'label': (ele) => (showEdgeLabels ? ele.data('label') || 'CO_OCCURS_WITH' : ''),
              'font-size': '9px',
              'font-weight': 'bold',
              'color': isDark ? '#38bdf8' : '#0369a1',
              'text-rotation': 'autorotate',
              'text-background-color': isDark ? '#0f172a' : '#ffffff',
              'text-background-opacity': 0.85,
              'text-background-padding': '2px'
            }
          },
          {
            // Highlight saat node/edge diklik atau di-hover
            selector: 'node.highlighted',
            style: {
              'border-width': 4,
              'border-color': '#facc15',
              'z-index': 999
            }
          },
          {
            selector: 'edge.highlighted',
            style: {
              'width': 3.5,
              'opacity': 1,
              'line-color': (ele) =>
                ele.data('type') === 'BELONGS_TO_TOPIC' ? '#f97316' : '#2563eb',
              'target-arrow-color': '#f97316',
              'label': (ele) =>
                ele.data('type') === 'BELONGS_TO_TOPIC'
                  ? 'BELONGS_TO_TOPIC'
                  : `CO_OCCURS_WITH (${ele.data('label') || ''})`,
              'font-size': '9px',
              'font-weight': 'bold',
              'color': isDark ? '#f8fafc' : '#0f172a',
              'text-background-color': isDark ? '#1e293b' : '#fef9c3',
              'text-background-opacity': 0.95,
              'text-background-padding': '2px',
              'z-index': 999
            }
          },
          {
            selector: '.dimmed',
            style: {
              'opacity': 0.2
            }
          }
        ],
        layout: {
          name: 'cose',
          padding: embedded ? 20 : 30,
          nodeRepulsion: embedded ? 3200 : 4800,
          idealEdgeLength: embedded ? 75 : 105,
          animate: false
        }
      });

      cyRef.current = cy;

      // Interaksi Klik / Hover Node untuk menampilkan seluruh relasi BELONGS_TO_TOPIC & CO_OCCURS_WITH
      const inspectNode = (node: any) => {
        cy.elements().removeClass('highlighted dimmed');
        const neighborhood = node.closedNeighborhood();
        cy.elements().not(neighborhood).addClass('dimmed');
        node.addClass('highlighted');
        node.connectedEdges().addClass('highlighted');
        node.neighborhood('node').addClass('highlighted');

        const d = node.data();
        const connectedEdges = node.connectedEdges().map((e: any) => e.data());
        const belongsTo = connectedEdges
          .filter((e: any) => e.type === 'BELONGS_TO_TOPIC')
          .map((e: any) => (d.type === 'topic' ? e.sourceName : e.targetName));
        const coOccurs = connectedEdges
          .filter((e: any) => e.type === 'CO_OCCURS_WITH')
          .map((e: any) => ({
            partner: e.source === d.id ? e.targetName : e.sourceName,
            npmi: e.npmi ?? e.weight,
            cooccur: e.cooccur ?? 3,
            pmi: e.pmi ?? 0
          }))
          .sort((a: any, b: any) => (b.npmi || 0) - (a.npmi || 0));

        setInspectedItem({
          kind: 'node',
          id: d.id,
          label: d.label,
          type: d.type,
          weight: d.weight,
          belongsTo,
          coOccurs
        });
      };

      const inspectEdge = (edge: any) => {
        cy.elements().removeClass('highlighted dimmed');
        cy.elements().not(edge).not(edge.connectedNodes()).addClass('dimmed');
        edge.addClass('highlighted');
        edge.connectedNodes().addClass('highlighted');

        const d = edge.data();
        setInspectedItem({
          kind: 'edge',
          id: d.id,
          type: d.type,
          sourceName: d.sourceName || String(d.source).replace(/^(entity_|topic_)/, ''),
          targetName: d.targetName || String(d.target).replace(/^(entity_|topic_)/, ''),
          npmi: d.npmi ?? d.weight,
          cooccur: d.cooccur,
          pmi: d.pmi
        });
      };

      cy.on('tap', 'node', (evt: any) => inspectNode(evt.target));
      cy.on('tap', 'edge', (evt: any) => inspectEdge(evt.target));
      cy.on('tap', (evt: any) => {
        if (evt.target === cy) {
          cy.elements().removeClass('highlighted dimmed');
          setInspectedItem(null);
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
  }, [graphData, theme, isDark, embedded, showEdgeLabels]);

  const cardStyle = {
    backgroundColor: theme.bgCard,
    borderRadius: '16px',
    border: `1px solid ${theme.border}`,
    padding: '24px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
    display: 'flex',
    flexDirection: 'column' as const,
    height: embedded ? '100%' : 'auto',
    minHeight: embedded ? '500px' : '680px',
    boxSizing: 'border-box' as const,
    textAlign: 'left' as const
  };

  const filterStyle = {
    padding: '6px 10px',
    borderRadius: '8px',
    border: `1px solid ${theme.border}`,
    backgroundColor: theme.inputBg || '#f8fafc',
    color: theme.textMain,
    fontSize: '11px',
    fontWeight: '600',
    outline: 'none',
    cursor: 'pointer'
  };

  return (
    <article className="card-hover-effect" style={cardStyle}>
      {/* Header & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
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
            <p style={{ color: theme.textMuted, margin: '2px 0 0 0', fontSize: '11px' }}>
              {selectedTopic
                ? `Jaringan entitas terhubung: ${selectedTopic}`
                : `${statsSummary.nodesCount} Nodes | ${statsSummary.btCount} BELONGS_TO_TOPIC | ${statsSummary.coCount} CO_OCCURS_WITH`}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {selectedTopic && (
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#15803d', backgroundColor: '#dcfce7', padding: '4px 10px', borderRadius: '8px' }}>
              Fokus: {selectedTopic}
            </span>
          )}

          {/* Filter Tipe Edge (2 Tipe Relasi) */}
          <select
            style={filterStyle}
            value={edgeFilter}
            onChange={(e) => setEdgeFilter(e.target.value as any)}
            title="Filter Tipe Relasi (Edge)"
          >
            <option value="All">Relasi: Semua (2 Tipe Edge)</option>
            <option value="CO_OCCURS_WITH">CO_OCCURS_WITH (Antar-Entity)</option>
            <option value="BELONGS_TO_TOPIC">BELONGS_TO_TOPIC (Entity → Topic)</option>
          </select>

          {/* Filter Kategori Entitas */}
          <select
            style={filterStyle}
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            title="Filter Kategori Node"
          >
            {ENTITY_CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.label}
              </option>
            ))}
          </select>

          {/* Filter Minimum Mention */}
          <select
            style={filterStyle}
            value={minFreq}
            onChange={(e) => setMinFreq(e.target.value)}
            title="Filter Minimum Mention Count"
          >
            <option value="0">Min Mention: Semua (≥ 3)</option>
            <option value="5">Min Mention: ≥ 5</option>
            <option value="10">Min Mention: ≥ 10</option>
            <option value="25">Min Mention: ≥ 25</option>
            <option value="50">Min Mention: ≥ 50</option>
          </select>

          {/* Toggle Label Edge */}
          <button
            type="button"
            onClick={() => setShowEdgeLabels((prev) => !prev)}
            style={{
              ...filterStyle,
              backgroundColor: showEdgeLabels ? '#dbeafe' : theme.inputBg || '#f8fafc',
              color: showEdgeLabels ? '#1d4ed8' : theme.textMain,
              borderColor: showEdgeLabels ? '#93c5fd' : theme.border
            }}
          >
            {showEdgeLabels ? '🏷️ Label Edge: ON' : '🏷️ Label Edge: OFF'}
          </button>
        </div>
      </div>

      {/* Graph Canvas + Interactive Relationship Inspector */}
      <div style={{
        flex: 1,
        position: 'relative',
        width: '100%',
        minHeight: embedded ? '310px' : '480px',
        borderRadius: '10px',
        overflow: 'hidden',
        backgroundColor: isDark ? '#0f172a' : '#f8fafc',
        border: `1px solid ${theme.border}`
      }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }} />

        {/* Hint Petunjuk Klik */}
        {!inspectedItem && (
          <div style={{
            position: 'absolute',
            top: '10px',
            left: '10px',
            backgroundColor: isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.9)',
            border: `1px solid ${theme.border}`,
            borderRadius: '8px',
            padding: '5px 10px',
            fontSize: '11px',
            color: theme.textMuted,
            pointerEvents: 'none',
            boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
          }}>
            💡 Klik <strong>Node</strong> atau <strong>Garis Edge</strong> untuk melihat detail relasi <code>BELONGS_TO_TOPIC</code> &amp; <code>CO_OCCURS_WITH</code>
          </div>
        )}

        {/* Inspector Panel untuk Node / Edge yang Diklik */}
        {inspectedItem && (
          <div style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            width: '290px',
            maxHeight: 'calc(100% - 20px)',
            overflowY: 'auto',
            backgroundColor: isDark ? 'rgba(15, 23, 42, 0.96)' : 'rgba(255, 255, 255, 0.97)',
            border: `1px solid ${theme.border}`,
            borderRadius: '12px',
            padding: '12px 14px',
            fontSize: '11px',
            color: theme.textMain,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            zIndex: 20
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
              <div>
                <span style={{
                  display: 'inline-block',
                  padding: '2px 7px',
                  borderRadius: '6px',
                  fontSize: '10px',
                  fontWeight: '700',
                  color: '#ffffff',
                  backgroundColor:
                    inspectedItem.kind === 'node'
                      ? ENTITY_COLORS[inspectedItem.type] || '#64748b'
                      : inspectedItem.type === 'CO_OCCURS_WITH'
                      ? '#0284c7'
                      : '#64748b',
                  marginBottom: '4px',
                  textTransform: 'uppercase'
                }}>
                  {inspectedItem.kind === 'node' ? inspectedItem.type : inspectedItem.type}
                </span>
                <div style={{ fontWeight: '800', fontSize: '13px', color: theme.textMain }}>
                  {inspectedItem.kind === 'node'
                    ? inspectedItem.label
                    : `${inspectedItem.sourceName} ↔ ${inspectedItem.targetName}`}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (cyRef.current) cyRef.current.elements().removeClass('highlighted dimmed');
                  setInspectedItem(null);
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: theme.textMuted,
                  cursor: 'pointer',
                  fontWeight: '800',
                  fontSize: '13px',
                  padding: '0 4px'
                }}
              >
                ✕
              </button>
            </div>

            {inspectedItem.kind === 'node' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {inspectedItem.type !== 'topic' && (
                  <div style={{ color: theme.textMuted }}>
                    Frekuensi Sebutan: <strong style={{ color: theme.textMain }}>{inspectedItem.weight} mentions</strong>
                  </div>
                )}

                {/* Relasi BELONGS_TO_TOPIC */}
                <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: '6px' }}>
                  <div style={{ fontWeight: '700', color: '#f97316', marginBottom: '4px' }}>
                    1. Relasi BELONGS_TO_TOPIC ({inspectedItem.belongsTo.length}):
                  </div>
                  {inspectedItem.belongsTo.length === 0 ? (
                    <div style={{ color: theme.textMuted, fontStyle: 'italic' }}>Tidak ada relasi topik</div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {inspectedItem.belongsTo.map((tName: string, i: number) => (
                        <span
                          key={i}
                          style={{
                            backgroundColor: isDark ? '#1e293b' : '#fff7ed',
                            color: '#ea580c',
                            border: '1px solid #fed7aa',
                            borderRadius: '6px',
                            padding: '2px 6px',
                            fontSize: '10px',
                            fontWeight: '600'
                          }}
                        >
                          {tName}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Relasi CO_OCCURS_WITH */}
                {inspectedItem.type !== 'topic' && (
                  <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: '6px' }}>
                    <div style={{ fontWeight: '700', color: '#0284c7', marginBottom: '4px' }}>
                      2. Relasi CO_OCCURS_WITH ({inspectedItem.coOccurs.length} entitas):
                    </div>
                    {inspectedItem.coOccurs.length === 0 ? (
                      <div style={{ color: theme.textMuted, fontStyle: 'italic' }}>
                        Tidak ada ko-okurensi (NPMI ≥ 0.4) dengan entitas lain
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '140px', overflowY: 'auto' }}>
                        {inspectedItem.coOccurs.map((co: any, i: number) => (
                          <div
                            key={i}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              backgroundColor: isDark ? '#1e293b' : '#f0f9ff',
                              border: '1px solid #bae6fd',
                              borderRadius: '6px',
                              padding: '3px 7px',
                              fontSize: '10px'
                            }}
                          >
                            <strong style={{ color: isDark ? '#e2e8f0' : '#0369a1' }}>{co.partner}</strong>
                            <span style={{ color: theme.textMuted }}>
                              NPMI: <strong>{Number(co.npmi || 0).toFixed(2)}</strong> | Co-occur: <strong>{co.cooccur}x</strong>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: `1px solid ${theme.border}`, paddingTop: '6px' }}>
                {inspectedItem.type === 'CO_OCCURS_WITH' ? (
                  <>
                    <div>
                      Relasi: <strong>(:Entity)-[:CO_OCCURS_WITH]-(:Entity)</strong>
                    </div>
                    <div>
                      Skor Weight (NPMI): <strong>{Number(inspectedItem.npmi || 0).toFixed(4)}</strong>
                    </div>
                    <div>
                      Frekuensi Kemunculan Bersama (cooccur): <strong>{inspectedItem.cooccur || 3} kali</strong>
                    </div>
                    <div>
                      Skor PMI: <strong>{Number(inspectedItem.pmi || 0).toFixed(4)}</strong>
                    </div>
                  </>
                ) : (
                  <div>
                    Relasi: <strong>(:Entity)-[:BELONGS_TO_TOPIC]-&gt;(:Topic)</strong>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Legend 2 Tipe Edge (Relasi) */}
      <div style={{
        display: 'flex',
        gap: '18px',
        marginTop: '12px',
        padding: '8px 12px',
        borderRadius: '8px',
        backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
        justifyContent: 'center',
        flexWrap: 'wrap',
        border: `1px solid ${theme.border}`
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: '700', color: theme.textMain }}>
          <span style={{
            width: '28px',
            height: '0px',
            borderTop: '3px solid #0284c7',
            display: 'inline-block'
          }}></span>
          <span>
            <code>CO_OCCURS_WITH</code> (Antar-Entity, NPMI ≥ 0.4, Co-occur ≥ 3): <strong>{statsSummary.coCount} edge</strong>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: '700', color: theme.textMain }}>
          <span style={{
            width: '28px',
            height: '0px',
            borderTop: '2px dashed #64748b',
            display: 'inline-block'
          }}></span>
          <span>
            <code>BELONGS_TO_TOPIC</code> (Entity → Topic): <strong>{statsSummary.btCount} edge</strong>
          </span>
        </div>
      </div>

      {/* Legend Lengkap 8 Kategori MBG + Topic */}
      <div style={{ display: 'flex', gap: '12px', marginTop: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
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
