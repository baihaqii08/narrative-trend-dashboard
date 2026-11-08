import React, { useEffect, useMemo, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import {
  buildMbgFallbackGraph,
  fetchKnowledgeGraphFromApi,
  fetchPostsFromApi,
  SocialPost,
} from '../../services/api';

export const ENTITY_COLORS: Record<string, string> = {
  topic: '#f97316',
  person: '#8b5cf6',
  organization: '#3b82f6',
  geopolitical: '#06b6d4',
  location: '#10b981',
  product: '#eab308',
  event: '#ec4899',
  norm: '#ef4444',
  facility: '#14b8a6',
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
  { id: 'topic', label: 'Topic (Topik Utama)' },
];

const ENTITY_LEGEND_ITEMS = [
  { key: 'topic', label: 'Topic (9)' },
  { key: 'person', label: 'Person (19)' },
  { key: 'organization', label: 'Organization (12)' },
  { key: 'geopolitical', label: 'Geopolitical (26)' },
  { key: 'location', label: 'Location (5)' },
  { key: 'product', label: 'Product (23)' },
  { key: 'event', label: 'Event (10)' },
  { key: 'norm', label: 'Norm (33)' },
  { key: 'facility', label: 'Facility (0)' },
];

export interface KnowledgeGraphProps {
  theme: any;
  isDark?: boolean;
  timeFilter?: string;
  platformFilter?: string;
  isRefreshing?: boolean;
  embedded?: boolean;
  selectedTopic?: string | null;
  postsData?: SocialPost[];
}

interface CytoscapeGraphElements {
  nodes: any[];
  edges: any[];
}

interface GraphStatsSummary {
  nodesCount: number;
  edgesCount: number;
  belongsToEdgeCount: number;
  coOccursEdgeCount: number;
}

function KnowledgeGraph({
  theme,
  isDark,
  timeFilter = 'all',
  platformFilter = 'all',
  isRefreshing,
  embedded = false,
  selectedTopic = null,
  postsData,
}: KnowledgeGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cytoscapeInstanceRef = useRef<any>(null);

  const [entityTypeFilter, setEntityTypeFilter] = useState('All');
  const [edgeTypeFilter, setEdgeTypeFilter] = useState<'All' | 'CO_OCCURS_WITH' | 'BELONGS_TO_TOPIC'>('All');
  const [minFrequencyFilter, setMinFrequencyFilter] = useState('0');
  const [showEdgeLabels, setShowEdgeLabels] = useState(false);
  const [inspectedItem, setInspectedItem] = useState<any | null>(null);

  const [socialDataRaw, setSocialDataRaw] = useState<SocialPost[]>(postsData || []);
  const [apiGraphElements, setApiGraphElements] = useState<CytoscapeGraphElements | null>(() =>
    buildMbgFallbackGraph()
  );

  useEffect(() => {
    if (Array.isArray(postsData)) {
      setSocialDataRaw(postsData);
    }
  }, [postsData]);

  useEffect(() => {
    let isMounted = true;

    fetchKnowledgeGraphFromApi({
      platform: platformFilter,
      timeFilter,
      minFreq: 0,
    })
      .then((graphResult) => {
        if (isMounted && graphResult && graphResult.nodes.length > 0) {
          setApiGraphElements(graphResult);
        }
      })
      .catch(() => {
        if (isMounted) {
          setApiGraphElements(buildMbgFallbackGraph());
        }
      });

    if (!postsData) {
      fetchPostsFromApi({ platform: platformFilter, timeFilter })
        .then((fetchedPosts) => {
          if (isMounted) {
            setSocialDataRaw(fetchedPosts);
          }
        })
        .catch(() => {
          // Ignore background post fetch errors when rendering graph
        });
    }

    return () => {
      isMounted = false;
    };
  }, [timeFilter, platformFilter, isRefreshing, postsData]);

  const { graphData, statsSummary } = useMemo(
    () =>
      filterCytoscapeGraph({
        apiGraphElements,
        minFrequencyFilter,
        entityTypeFilter,
        selectedTopic,
        edgeTypeFilter,
      }),
    [apiGraphElements, socialDataRaw, entityTypeFilter, edgeTypeFilter, minFrequencyFilter, selectedTopic]
  );

  useEffect(() => {
    let resizeObserver: ResizeObserver | null = null;

    if (containerRef.current) {
      const cy = cytoscape({
        container: containerRef.current,
        elements: graphData,
        style: buildCytoscapeStylesheet({ theme, isDark, embedded, showEdgeLabels }),
        layout: {
          name: 'cose',
          padding: embedded ? 20 : 30,
          nodeRepulsion: embedded ? 3200 : 4800,
          idealEdgeLength: embedded ? 75 : 105,
          animate: false,
        } as any,
      });

      cytoscapeInstanceRef.current = cy;

      cy.on('tap', 'node', (event: any) => {
        const tappedNode = event.target;
        highlightNodeNeighborhood(cy, tappedNode);
        setInspectedItem(extractTappedNodeInspection(tappedNode));
      });

      cy.on('tap', 'edge', (event: any) => {
        const tappedEdge = event.target;
        highlightEdgeEndpoints(cy, tappedEdge);
        setInspectedItem(extractTappedEdgeInspection(tappedEdge));
      });

      cy.on('tap', (event: any) => {
        if (event.target === cy) {
          cy.elements().removeClass('highlighted dimmed');
          setInspectedItem(null);
        }
      });

      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
          if (cytoscapeInstanceRef.current) {
            cytoscapeInstanceRef.current.resize();
            cytoscapeInstanceRef.current.fit(20);
          }
        });
        resizeObserver.observe(containerRef.current);
      }
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (cytoscapeInstanceRef.current) {
        cytoscapeInstanceRef.current.destroy();
      }
    };
  }, [graphData, theme, isDark, embedded, showEdgeLabels]);

  const cardStyle: React.CSSProperties = {
    backgroundColor: theme.bgCard,
    borderRadius: '16px',
    border: `1px solid ${theme.border}`,
    padding: '24px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
    display: 'flex',
    flexDirection: 'column',
    height: embedded ? '100%' : 'auto',
    minHeight: embedded ? '500px' : '680px',
    boxSizing: 'border-box',
    textAlign: 'left',
  };

  const filterControlStyle: React.CSSProperties = {
    padding: '6px 10px',
    borderRadius: '8px',
    border: `1px solid ${theme.border}`,
    backgroundColor: theme.inputBg || '#f8fafc',
    color: theme.textMain,
    fontSize: '11px',
    fontWeight: '600',
    outline: 'none',
    cursor: 'pointer',
  };

  return (
    <article className="card-hover-effect" style={cardStyle}>
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
            color: '#0284c7',
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
                : `${statsSummary.nodesCount} Nodes | ${statsSummary.belongsToEdgeCount} BELONGS_TO_TOPIC | ${statsSummary.coOccursEdgeCount} CO_OCCURS_WITH`}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {selectedTopic && (
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#15803d', backgroundColor: '#dcfce7', padding: '4px 10px', borderRadius: '8px' }}>
              Fokus: {selectedTopic}
            </span>
          )}

          <select
            style={filterControlStyle}
            value={edgeTypeFilter}
            onChange={(event) => setEdgeTypeFilter(event.target.value as any)}
            title="Filter Tipe Relasi (Edge)"
          >
            <option value="All">Relasi: Semua (2 Tipe Edge)</option>
            <option value="CO_OCCURS_WITH">CO_OCCURS_WITH (Antar-Entity)</option>
            <option value="BELONGS_TO_TOPIC">BELONGS_TO_TOPIC (Entity → Topic)</option>
          </select>

          <select
            style={filterControlStyle}
            value={entityTypeFilter}
            onChange={(event) => setEntityTypeFilter(event.target.value)}
            title="Filter Kategori Node"
          >
            {ENTITY_CATEGORIES.map((categoryOption) => (
              <option key={categoryOption.id} value={categoryOption.id}>
                {categoryOption.label}
              </option>
            ))}
          </select>

          <select
            style={filterControlStyle}
            value={minFrequencyFilter}
            onChange={(event) => setMinFrequencyFilter(event.target.value)}
            title="Filter Minimum Mention Count"
          >
            <option value="0">Min Mention: Semua (≥ 3)</option>
            <option value="5">Min Mention: ≥ 5</option>
            <option value="10">Min Mention: ≥ 10</option>
            <option value="25">Min Mention: ≥ 25</option>
            <option value="50">Min Mention: ≥ 50</option>
          </select>

          <button
            type="button"
            onClick={() => setShowEdgeLabels((previous) => !previous)}
            style={{
              ...filterControlStyle,
              backgroundColor: showEdgeLabels ? '#dbeafe' : theme.inputBg || '#f8fafc',
              color: showEdgeLabels ? '#1d4ed8' : theme.textMain,
              borderColor: showEdgeLabels ? '#93c5fd' : theme.border,
            }}
          >
            {showEdgeLabels ? '🏷️ Label Edge: ON' : '🏷️ Label Edge: OFF'}
          </button>
        </div>
      </div>

      <div style={{
        flex: 1,
        position: 'relative',
        width: '100%',
        minHeight: embedded ? '310px' : '480px',
        borderRadius: '10px',
        overflow: 'hidden',
        backgroundColor: isDark ? '#0f172a' : '#f8fafc',
        border: `1px solid ${theme.border}`,
      }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }} />

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
            boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
          }}>
            💡 Klik <strong>Node</strong> atau <strong>Garis Edge</strong> untuk melihat detail relasi <code>BELONGS_TO_TOPIC</code> &amp; <code>CO_OCCURS_WITH</code>
          </div>
        )}

        {inspectedItem && (
          <GraphInspectorPanel
            inspectedItem={inspectedItem}
            theme={theme}
            isDark={isDark}
            onClose={() => {
              if (cytoscapeInstanceRef.current) {
                cytoscapeInstanceRef.current.elements().removeClass('highlighted dimmed');
              }
              setInspectedItem(null);
            }}
          />
        )}
      </div>

      <div style={{
        display: 'flex',
        gap: '18px',
        marginTop: '12px',
        padding: '8px 12px',
        borderRadius: '8px',
        backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
        justifyContent: 'center',
        flexWrap: 'wrap',
        border: `1px solid ${theme.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: '700', color: theme.textMain }}>
          <span style={{ width: '28px', height: '0px', borderTop: '3px solid #0284c7', display: 'inline-block' }}></span>
          <span>
            <code>CO_OCCURS_WITH</code> (Antar-Entity, NPMI ≥ 0.4, Co-occur ≥ 3): <strong>{statsSummary.coOccursEdgeCount} edge</strong>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: '700', color: theme.textMain }}>
          <span style={{ width: '28px', height: '0px', borderTop: '2px dashed #64748b', display: 'inline-block' }}></span>
          <span>
            <code>BELONGS_TO_TOPIC</code> (Entity → Topic): <strong>{statsSummary.belongsToEdgeCount} edge</strong>
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginTop: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
        {ENTITY_LEGEND_ITEMS.map((legendItem) => (
          <div
            key={legendItem.key}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: '600', color: theme.textMuted }}
          >
            <span
              style={{
                width: '9px',
                height: '9px',
                borderRadius: '50%',
                backgroundColor: ENTITY_COLORS[legendItem.key],
              }}
            />
            {legendItem.label}
          </div>
        ))}
      </div>
    </article>
  );
}

function GraphInspectorPanel({
  inspectedItem,
  theme,
  isDark,
  onClose,
}: {
  inspectedItem: any;
  theme: any;
  isDark?: boolean;
  onClose: () => void;
}) {
  const badgeColor =
    inspectedItem.kind === 'node'
      ? ENTITY_COLORS[inspectedItem.type] || '#64748b'
      : inspectedItem.type === 'CO_OCCURS_WITH'
        ? '#0284c7'
        : '#64748b';

  return (
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
      zIndex: 20,
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
            backgroundColor: badgeColor,
            marginBottom: '4px',
            textTransform: 'uppercase',
          }}>
            {inspectedItem.type}
          </span>
          <div style={{ fontWeight: '800', fontSize: '13px', color: theme.textMain }}>
            {inspectedItem.kind === 'node'
              ? inspectedItem.label
              : `${inspectedItem.sourceName} ↔ ${inspectedItem.targetName}`}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            border: 'none',
            background: 'transparent',
            color: theme.textMuted,
            cursor: 'pointer',
            fontWeight: '800',
            fontSize: '13px',
            padding: '0 4px',
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

          <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: '6px' }}>
            <div style={{ fontWeight: '700', color: '#f97316', marginBottom: '4px' }}>
              1. Relasi BELONGS_TO_TOPIC ({inspectedItem.belongsTo.length}):
            </div>
            {inspectedItem.belongsTo.length === 0 ? (
              <div style={{ color: theme.textMuted, fontStyle: 'italic' }}>Tidak ada relasi topik</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {inspectedItem.belongsTo.map((topicName: string, index: number) => (
                  <span
                    key={index}
                    style={{
                      backgroundColor: isDark ? '#1e293b' : '#fff7ed',
                      color: '#ea580c',
                      border: '1px solid #fed7aa',
                      borderRadius: '6px',
                      padding: '2px 6px',
                      fontSize: '10px',
                      fontWeight: '600',
                    }}
                  >
                    {topicName}
                  </span>
                ))}
              </div>
            )}
          </div>

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
                  {inspectedItem.coOccurs.map((coOccurrenceItem: any, index: number) => (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        backgroundColor: isDark ? '#1e293b' : '#f0f9ff',
                        border: '1px solid #bae6fd',
                        borderRadius: '6px',
                        padding: '3px 7px',
                        fontSize: '10px',
                      }}
                    >
                      <strong style={{ color: isDark ? '#e2e8f0' : '#0369a1' }}>
                        {coOccurrenceItem.partner}
                      </strong>
                      <span style={{ color: theme.textMuted }}>
                        NPMI: <strong>{Number(coOccurrenceItem.npmi || 0).toFixed(2)}</strong> | Co-occur: <strong>{coOccurrenceItem.cooccur}x</strong>
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
  );
}

function filterCytoscapeGraph({
  apiGraphElements,
  minFrequencyFilter,
  entityTypeFilter,
  selectedTopic,
  edgeTypeFilter,
}: {
  apiGraphElements: CytoscapeGraphElements | null;
  minFrequencyFilter: string;
  entityTypeFilter: string;
  selectedTopic: string | null;
  edgeTypeFilter: 'All' | 'CO_OCCURS_WITH' | 'BELONGS_TO_TOPIC';
}): {
  graphData: CytoscapeGraphElements;
  statsSummary: GraphStatsSummary;
} {
  const baseGraph =
    apiGraphElements && apiGraphElements.nodes.length > 0
      ? apiGraphElements
      : buildMbgFallbackGraph();

  let candidateNodes = [...baseGraph.nodes];
  const allEdges = [...baseGraph.edges];

  const frequencyThreshold = parseInt(minFrequencyFilter, 10);
  if (!isNaN(frequencyThreshold) && frequencyThreshold > 0) {
    candidateNodes = candidateNodes.filter((nodeElement: any) => {
      if (nodeElement.data?.type === 'topic') {
        return true;
      }
      return Number(nodeElement.data?.weight || 0) >= frequencyThreshold;
    });
  }

  if (entityTypeFilter !== 'All') {
    candidateNodes = filterNodesByEntityCategory(
      candidateNodes,
      allEdges,
      entityTypeFilter.toLowerCase()
    );
  }

  if (selectedTopic) {
    candidateNodes = filterNodesByTopicName(
      candidateNodes,
      allEdges,
      selectedTopic.toLowerCase()
    );
  }

  const validNodeIds = new Set(candidateNodes.map((nodeElement: any) => String(nodeElement.data.id)));
  let filteredEdges = allEdges.filter(
    (edgeElement: any) =>
      validNodeIds.has(String(edgeElement.data.source)) &&
      validNodeIds.has(String(edgeElement.data.target))
  );

  if (edgeTypeFilter !== 'All') {
    filteredEdges = filteredEdges.filter((edgeElement: any) => edgeElement.data?.type === edgeTypeFilter);
    if (edgeTypeFilter === 'CO_OCCURS_WITH') {
      const coOccursNodeIds = new Set<string>();
      filteredEdges.forEach((edgeElement: any) => {
        coOccursNodeIds.add(String(edgeElement.data.source));
        coOccursNodeIds.add(String(edgeElement.data.target));
      });
      candidateNodes = candidateNodes.filter(
        (nodeElement: any) =>
          nodeElement.data?.type !== 'topic' &&
          (coOccursNodeIds.size === 0 || coOccursNodeIds.has(String(nodeElement.data.id)))
      );
    }
  }

  const belongsToEdgeCount = filteredEdges.filter(
    (edgeElement: any) => edgeElement.data?.type === 'BELONGS_TO_TOPIC'
  ).length;
  const coOccursEdgeCount = filteredEdges.filter(
    (edgeElement: any) => edgeElement.data?.type === 'CO_OCCURS_WITH'
  ).length;

  return {
    graphData: { nodes: candidateNodes, edges: filteredEdges },
    statsSummary: {
      nodesCount: candidateNodes.length,
      edgesCount: filteredEdges.length,
      belongsToEdgeCount,
      coOccursEdgeCount,
    },
  };
}

function filterNodesByEntityCategory(
  nodes: any[],
  edges: any[],
  targetCategory: string
): any[] {
  if (targetCategory === 'topic') {
    const topicNodeIds = new Set(
      nodes
        .filter((nodeElement: any) => nodeElement.data?.type === 'topic')
        .map((nodeElement: any) => String(nodeElement.data.id))
    );
    const connectedEntityIds = new Set<string>();

    edges.forEach((edgeElement: any) => {
      if (edgeElement.data?.type === 'BELONGS_TO_TOPIC') {
        const sourceId = String(edgeElement.data.source);
        const targetId = String(edgeElement.data.target);
        if (topicNodeIds.has(targetId)) {
          connectedEntityIds.add(sourceId);
        }
        if (topicNodeIds.has(sourceId)) {
          connectedEntityIds.add(targetId);
        }
      }
    });

    return nodes.filter(
      (nodeElement: any) =>
        topicNodeIds.has(String(nodeElement.data.id)) ||
        connectedEntityIds.has(String(nodeElement.data.id))
    );
  }

  const primaryEntityIds = new Set(
    nodes
      .filter((nodeElement: any) => String(nodeElement.data?.type || '').toLowerCase() === targetCategory)
      .map((nodeElement: any) => String(nodeElement.data.id))
  );
  const neighborNodeIds = new Set<string>();

  edges.forEach((edgeElement: any) => {
    const sourceId = String(edgeElement.data.source);
    const targetId = String(edgeElement.data.target);
    if (primaryEntityIds.has(sourceId)) {
      neighborNodeIds.add(targetId);
    }
    if (primaryEntityIds.has(targetId)) {
      neighborNodeIds.add(sourceId);
    }
  });

  return nodes.filter(
    (nodeElement: any) =>
      primaryEntityIds.has(String(nodeElement.data.id)) ||
      neighborNodeIds.has(String(nodeElement.data.id))
  );
}

function filterNodesByTopicName(
  nodes: any[],
  edges: any[],
  normalizedSelectedTopic: string
): any[] {
  const connectedIds = new Set<string>();

  nodes.forEach((nodeElement: any) => {
    const nodeLabel = String(nodeElement.data?.label || '').toLowerCase();
    if (nodeElement.data?.type === 'topic' && nodeLabel.includes(normalizedSelectedTopic)) {
      connectedIds.add(String(nodeElement.data.id));
    }
  });

  edges.forEach((edgeElement: any) => {
    const sourceId = String(edgeElement.data.source);
    const targetId = String(edgeElement.data.target);
    if (connectedIds.has(targetId)) {
      connectedIds.add(sourceId);
    }
    if (connectedIds.has(sourceId)) {
      connectedIds.add(targetId);
    }
  });

  edges.forEach((edgeElement: any) => {
    if (edgeElement.data?.type === 'CO_OCCURS_WITH') {
      const sourceId = String(edgeElement.data.source);
      const targetId = String(edgeElement.data.target);
      if (connectedIds.has(sourceId)) {
        connectedIds.add(targetId);
      }
      if (connectedIds.has(targetId)) {
        connectedIds.add(sourceId);
      }
    }
  });

  if (connectedIds.size === 0) {
    return nodes;
  }

  return nodes.filter((nodeElement: any) => connectedIds.has(String(nodeElement.data.id)));
}

function buildCytoscapeStylesheet({
  theme,
  isDark,
  embedded,
  showEdgeLabels,
}: {
  theme: any;
  isDark?: boolean;
  embedded: boolean;
  showEdgeLabels: boolean;
}): any[] {
  return [
    {
      selector: 'node',
      style: {
        label: 'data(label)',
        'text-valign': 'bottom',
        'text-margin-y': 4,
        color: theme.textMain,
        'font-weight': 'bold',
        'font-size': embedded ? '10px' : '11px',
        'text-background-color': isDark ? '#0f172a' : '#ffffff',
        'text-background-opacity': 0.75,
        'text-background-padding': '2px',
        'text-background-shape': 'roundrectangle',
        'background-color': (cytoscapeElement: any) => {
          const elementType = String(cytoscapeElement.data('type') || '').toLowerCase();
          return ENTITY_COLORS[elementType] || '#8b5cf6';
        },
        width: (cytoscapeElement: any) => calculateNodeDimension(cytoscapeElement, embedded),
        height: (cytoscapeElement: any) => calculateNodeDimension(cytoscapeElement, embedded),
        'border-width': (cytoscapeElement: any) =>
          cytoscapeElement.data('type') === 'topic' ? 3 : 2,
        'border-color': (cytoscapeElement: any) =>
          cytoscapeElement.data('type') === 'topic' ? '#ffedd5' : '#ffffff',
      },
    },
    {
      selector: 'edge[type = "BELONGS_TO_TOPIC"]',
      style: {
        width: 1.5,
        'line-style': 'dashed',
        'line-dash-pattern': [6, 4],
        'line-color': isDark ? '#64748b' : '#94a3b8',
        'target-arrow-shape': 'triangle',
        'target-arrow-color': isDark ? '#64748b' : '#94a3b8',
        'arrow-scale': 0.8,
        'curve-style': 'bezier',
        opacity: 0.65,
        label: showEdgeLabels ? 'BELONGS_TO_TOPIC' : '',
        'font-size': '8px',
        color: isDark ? '#cbd5e1' : '#475569',
        'text-rotation': 'autorotate',
        'text-background-color': isDark ? '#0f172a' : '#ffffff',
        'text-background-opacity': 0.8,
        'text-background-padding': '1px',
      },
    },
    {
      selector: 'edge[type = "CO_OCCURS_WITH"]',
      style: {
        width: (cytoscapeElement: any) => {
          const npmiScore = Number(
            cytoscapeElement.data('npmi') ?? cytoscapeElement.data('weight') ?? 0.5
          );
          return Math.max(2, Math.min(embedded ? 4.5 : 6, npmiScore * 5));
        },
        'line-style': 'solid',
        'line-color': isDark ? '#38bdf8' : '#0284c7',
        'curve-style': 'bezier',
        opacity: 0.85,
        label: (cytoscapeElement: any) =>
          showEdgeLabels ? cytoscapeElement.data('label') || 'CO_OCCURS_WITH' : '',
        'font-size': '9px',
        'font-weight': 'bold',
        color: isDark ? '#38bdf8' : '#0369a1',
        'text-rotation': 'autorotate',
        'text-background-color': isDark ? '#0f172a' : '#ffffff',
        'text-background-opacity': 0.85,
        'text-background-padding': '2px',
      },
    },
    {
      selector: 'node.highlighted',
      style: {
        'border-width': 4,
        'border-color': '#facc15',
        'z-index': 999,
      },
    },
    {
      selector: 'edge.highlighted',
      style: {
        width: 3.5,
        opacity: 1,
        'line-color': (cytoscapeElement: any) =>
          cytoscapeElement.data('type') === 'BELONGS_TO_TOPIC' ? '#f97316' : '#2563eb',
        'target-arrow-color': '#f97316',
        label: (cytoscapeElement: any) =>
          cytoscapeElement.data('type') === 'BELONGS_TO_TOPIC'
            ? 'BELONGS_TO_TOPIC'
            : `CO_OCCURS_WITH (${cytoscapeElement.data('label') || ''})`,
        'font-size': '9px',
        'font-weight': 'bold',
        color: isDark ? '#f8fafc' : '#0f172a',
        'text-background-color': isDark ? '#1e293b' : '#fef9c3',
        'text-background-opacity': 0.95,
        'text-background-padding': '2px',
        'z-index': 999,
      },
    },
    {
      selector: '.dimmed',
      style: {
        opacity: 0.2,
      },
    },
  ];
}

function calculateNodeDimension(cytoscapeElement: any, embedded: boolean): number {
  const elementType = String(cytoscapeElement.data('type') || '').toLowerCase();
  if (elementType === 'topic') {
    return embedded ? 36 : 46;
  }
  const weightValue = Number(cytoscapeElement.data('weight') || 1);
  return Math.max(
    embedded ? 18 : 22,
    Math.min(
      embedded ? 40 : 54,
      16 + Math.log(Math.max(1, weightValue)) * (embedded ? 4 : 5.5)
    )
  );
}

function highlightNodeNeighborhood(cy: any, tappedNode: any): void {
  cy.elements().removeClass('highlighted dimmed');
  const neighborhood = tappedNode.closedNeighborhood();
  cy.elements().not(neighborhood).addClass('dimmed');
  tappedNode.addClass('highlighted');
  tappedNode.connectedEdges().addClass('highlighted');
  tappedNode.neighborhood('node').addClass('highlighted');
}

function highlightEdgeEndpoints(cy: any, tappedEdge: any): void {
  cy.elements().removeClass('highlighted dimmed');
  cy.elements().not(tappedEdge).not(tappedEdge.connectedNodes()).addClass('dimmed');
  tappedEdge.addClass('highlighted');
  tappedEdge.connectedNodes().addClass('highlighted');
}

function extractTappedNodeInspection(tappedNode: any) {
  const nodeData = tappedNode.data();
  const connectedEdgesData = tappedNode
    .connectedEdges()
    .map((edgeElement: any) => edgeElement.data());

  const belongsTo = connectedEdgesData
    .filter((edgeData: any) => edgeData.type === 'BELONGS_TO_TOPIC')
    .map((edgeData: any) =>
      nodeData.type === 'topic' ? edgeData.sourceName : edgeData.targetName
    );

  const coOccurs = connectedEdgesData
    .filter((edgeData: any) => edgeData.type === 'CO_OCCURS_WITH')
    .map((edgeData: any) => ({
      partner: edgeData.source === nodeData.id ? edgeData.targetName : edgeData.sourceName,
      npmi: edgeData.npmi ?? edgeData.weight,
      cooccur: edgeData.cooccur ?? 3,
      pmi: edgeData.pmi ?? 0,
    }))
    .sort((first: any, second: any) => (second.npmi || 0) - (first.npmi || 0));

  return {
    kind: 'node',
    id: nodeData.id,
    label: nodeData.label,
    type: nodeData.type,
    weight: nodeData.weight,
    belongsTo,
    coOccurs,
  };
}

function extractTappedEdgeInspection(tappedEdge: any) {
  const edgeData = tappedEdge.data();
  return {
    kind: 'edge',
    id: edgeData.id,
    type: edgeData.type,
    sourceName: edgeData.sourceName || String(edgeData.source).replace(/^(entity_|topic_)/, ''),
    targetName: edgeData.targetName || String(edgeData.target).replace(/^(entity_|topic_)/, ''),
    npmi: edgeData.npmi ?? edgeData.weight,
    cooccur: edgeData.cooccur,
    pmi: edgeData.pmi,
  };
}

export default KnowledgeGraph;
