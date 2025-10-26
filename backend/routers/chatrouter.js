import express from 'express';
import { clusterData } from '../data/clustersData.js';
import { 
  parseIntent, 
  extractClusterName, 
  extractCMRId,
  extractEntities  // Also export the comprehensive extractor
} from '../services/intent.js';  // Changed from intent.js to intentParser.js
import { reasonWithAI } from '../services/reasoning.js';

const chatRouter = express.Router();

chatRouter.post('/', async (req, res) => {
  try {
    const { query, conversationHistory = [] } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔹 User Query: "${query}"`);
    console.log(`${'='.repeat(60)}`);

    // Step 1: Parse intent
    const intent = parseIntent(query);
    console.log(`🎯 Detected Intent: ${intent}`);

    // Step 2: Extract entities using the comprehensive extractor
    const entities = extractEntities(query);
    console.log(`📦 Extracted Entities:`, entities);

    // Step 3: Get relevant cluster data
    const clusterInfo = getRelevantCluster(entities, intent);
    if (clusterInfo) {
      console.log(`🖥️  Cluster Found: ${clusterInfo.cluster}`);
    }

    // Step 4: Get CMR info if deployment readiness query
    let cmrInfo = null;
    if (intent === 'deployment_readiness' && entities.cmrId && clusterInfo) {
      cmrInfo = clusterInfo.cmrs.find(
        cmr => cmr.id.toUpperCase() === entities.cmrId.toUpperCase()
      );
      if (cmrInfo) {
        console.log(`📋 CMR Found: ${cmrInfo.id}`);
      }
    }

    // Step 5: Call AI reasoning
    console.log(`🤖 Calling AI for reasoning...`);
    const aiOutput = await reasonWithAI(query, intent, clusterInfo, cmrInfo, entities);

    // Step 6: Build final response
    const finalResponse = {
      intent,
      entities,
      response: {
        summary: aiOutput.summary,
        ready: aiOutput.ready,
        risks: aiOutput.risks,
        confidence: aiOutput.confidence,
        recommendations: aiOutput.recommendations || [],
        details: buildDetailsObject(clusterInfo, cmrInfo, entities)
      },
      timestamp: new Date().toISOString()
    };

    console.log(`✅ Response Generated Successfully`);
    console.log(`${'='.repeat(60)}\n`);

    res.json(finalResponse);

  } catch (err) {
    console.error('❌ Chatrouter error:', err);
    res.status(500).json({ 
      error: 'Internal server error',
      message: err.message 
    });
  }
});

// Helper function to get relevant cluster
function getRelevantCluster(entities, intent) {
  // Try to find by cluster name first
  if (entities.clusterName) {
    const cluster = clusterData.find(
      c => c.cluster.toUpperCase() === entities.clusterName
    );
    if (cluster) return cluster;
  }

  // For deployment readiness, try to find by CMR ID
  if (intent === 'deployment_readiness' && entities.cmrId) {
    const cluster = clusterData.find(c =>
      c.cmrs.some(cmr => cmr.id.toUpperCase() === entities.cmrId.toUpperCase())
    );
    if (cluster) return cluster;
  }

  return null;
}

// Helper function to build details object
function buildDetailsObject(clusterInfo, cmrInfo, entities) {
  if (!clusterInfo) return null;

  const details = {
    cluster: {
      name: clusterInfo.cluster,
      status: clusterInfo.status,
      region: clusterInfo.region
    }
  };

  if (cmrInfo) {
    details.cmr = {
      id: cmrInfo.id,
      status: cmrInfo.status,
      linkedIncidents: cmrInfo.linkedIncidents || [],
      linkedPTs: cmrInfo.linkedPTs || []
    };
  }

  return details;
}

// Get all clusters endpoint
chatRouter.get('/clusters', (req, res) => {
  try {
    const summary = clusterData.map(cluster => ({
      cluster: cluster.cluster,
      status: cluster.status,
      region: cluster.region,
      totalIncidents: cluster.incidents.length,
      openIncidents: cluster.incidents.filter(i => i.status === 'open').length,
      totalCMRs: cluster.cmrs.length,
      pendingCMRs: cluster.cmrs.filter(c => c.status === 'pending').length
    }));

    res.json({
      clusters: summary,
      total: clusterData.length,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('❌ Clusters endpoint error:', err);
    res.status(500).json({ error: 'Failed to fetch clusters' });
  }
});

// Get specific cluster details
chatRouter.get('/clusters/:clusterName', (req, res) => {
  try {
    const { clusterName } = req.params;
    const cluster = clusterData.find(
      c => c.cluster.toLowerCase() === clusterName.toLowerCase()
    );

    if (!cluster) {
      return res.status(404).json({ error: 'Cluster not found' });
    }

    res.json({
      cluster,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('❌ Cluster details error:', err);
    res.status(500).json({ error: 'Failed to fetch cluster details' });
  }
});

export default chatRouter;
