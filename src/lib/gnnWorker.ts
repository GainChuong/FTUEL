/**
 * GNN Web Worker — Runs GNN computation off the main thread
 * 
 * Receives: { type: 'RUN_GNN', nodes, links, metrics }
 * Returns:  { type: 'GNN_RESULT', embeddings, gnnScores, competitionScores, predictions, elapsed }
 */

import {
  runGNN,
  normalizeFeatures,
  buildAdjacencyList,
  cosineSimilarity,
  detectCannibalization,
  type GNNResult
} from './gnnEngine';

// Serialization helpers: Float32Array cannot be sent directly via postMessage
// Convert Map<string, Float32Array> to plain object for transfer
function serializeEmbeddings(embeddings: Map<string, Float32Array>): Record<string, number[]> {
  const result: Record<string, number[]> = {};
  for (const [key, val] of embeddings) {
    result[key] = Array.from(val);
  }
  return result;
}

function serializeMapOfArrays(map: Map<string, any[]>): Record<string, any[]> {
  const result: Record<string, any[]> = {};
  for (const [key, val] of map) {
    result[key] = val;
  }
  return result;
}

function serializeMapOfNumbers(map: Map<string, number>): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [key, val] of map) {
    result[key] = val;
  }
  return result;
}

self.onmessage = (event: MessageEvent) => {
  const { type, nodes, links, metrics } = event.data;

  if (type === 'RUN_GNN') {
    try {
      const t0 = performance.now();
      const result = runGNN(nodes, links, metrics);
      const elapsed = performance.now() - t0;

      self.postMessage({
        type: 'GNN_RESULT',
        embeddings: serializeEmbeddings(result.embeddings),
        gnnScores: serializeMapOfNumbers(result.gnnScores),
        competitionScores: serializeMapOfArrays(result.competitionScores),
        predictions: serializeMapOfNumbers(result.predictions),
        elapsed
      });
    } catch (err: any) {
      self.postMessage({
        type: 'GNN_ERROR',
        error: err.message || 'Unknown GNN error'
      });
    }
  }
};
