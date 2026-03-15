// All Redis & SSH logic now handled in server/services.
// This file is kept as stub so imports don't break.

import { writeCMD } from '@/commands.js';

export default {
  createConnection(){ throw new Error('Redis client moved to server'); },
  createSSHConnection(){ throw new Error('SSH tunnel moved to server'); },
  getRedisOptions(){ throw new Error('Redis client moved to server'); },
  getSentinelOptions(){ throw new Error('Redis client moved to server'); },
  getClusterOptions(){ throw new Error('Redis client moved to server'); },
  getClusterNodes(){ throw new Error('Redis client moved to server'); },
  createClusterSSHTunnels(){ throw new Error('SSH tunnel moved to server'); },
  initNatMap(){ throw new Error('NAT map moved to server'); },
  getTLSOptions(){ throw new Error('TLS moved to server'); },
  getSSHOptions(){ throw new Error('SSH moved to server'); },
  getFileContent(file) { return file; },  // just passthrough filename
  retryStragety: () => Math.min(3*200,1000),
};

// Stub log transform export
export const logTransform = (res) => res;  // no-op