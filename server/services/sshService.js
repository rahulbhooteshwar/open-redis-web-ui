'use strict';

const { createTunnel } = require('tunnel-ssh');

const sshService = {
  getSSHOptions(options, host, port) {
    const tunnelOptions = { autoClose: false };
    const serverOptions = {};
    const sshOptions = {
      host: options.host,
      port: options.port,
      username: options.username,
      password: options.password,
      privateKey: this.resolvePrivateKey(options.privatekey),
      passphrase: options.passphrase ? options.passphrase : undefined,
      readyTimeout: (options.timeout > 0) ? (options.timeout * 1000) : 30000,
      keepaliveInterval: 10000,
    };
    const forwardOptions = {
      dstAddr: host,
      dstPort: port,
    };

    return { tunnelOptions, serverOptions, sshOptions, forwardOptions };
  },

  getFileContent(file) {
    if (!file) return undefined;
    return file;
  },

  resolvePrivateKey(value) {
    if (!value) return undefined;
    return Buffer.from(value.trim());
  },

  getClusterNodes(nodes, type = 'master') {
    const result = [];
    nodes = nodes.split('\n');

    for (let node of nodes) {
      if (!node) continue;
      node = node.trim().split(' ');
      if (node[2].includes(type)) {
        const dsn = node[1].split('@')[0];
        const lastIndex = dsn.lastIndexOf(':');
        const host = dsn.substr(0, lastIndex);
        const port = dsn.substr(lastIndex + 1);
        result.push({ host, port });
      }
    }

    return result;
  },

  createClusterSSHTunnels(sshConfig, nodes) {
    const sshTunnelStack = [];

    for (const node of nodes) {
      const sshConfigCopy = JSON.parse(JSON.stringify(sshConfig));

      if (sshConfigCopy.sshOptions.privateKey) {
        sshConfigCopy.sshOptions.privateKey = Buffer.from(sshConfigCopy.sshOptions.privateKey);
      }

      sshConfigCopy.forwardOptions.dstHost = node.host;
      sshConfigCopy.forwardOptions.dstPort = node.port;

      const promise = new Promise((resolve, reject) => {
        createTunnel(...Object.values(sshConfigCopy)).then(([server]) => {
          const addr = server.address();
          resolve({
            localHost: addr.address,
            localPort: addr.port,
            dstHost: node.host,
            dstPort: node.port,
          });
        }).catch(reject);
      });

      sshTunnelStack.push(promise);
    }

    return Promise.all(sshTunnelStack);
  },

  initNatMap(tunnels) {
    const natMap = {};
    for (const line of tunnels) {
      natMap[`${line.dstHost}:${line.dstPort}`] = { host: line.localHost, port: line.localPort };
    }
    return natMap;
  },

  createSSHConnection(sshOptions, host, port, auth, config, redisService) {
    const sshOptionsDict = this.getSSHOptions(sshOptions, host, port);
    const configRaw = JSON.parse(JSON.stringify(config));
    const sshConfigRaw = JSON.parse(JSON.stringify(sshOptionsDict));

    return new Promise((resolve, reject) => {
      createTunnel(...Object.values(sshOptionsDict)).then(([server]) => {
        const listenAddress = server.address();

        if (configRaw.sentinelOptions) {
          const client = redisService.createConnection(listenAddress.address, listenAddress.port, auth, configRaw, false, true, true);

          client.on('ready', () => {
            client.call('sentinel', 'get-master-addr-by-name', configRaw.sentinelOptions.masterName).then((reply) => {
              if (!reply) return reject(new Error(`Master name "${configRaw.sentinelOptions.masterName}" not exists!`));

              this.createClusterSSHTunnels(sshConfigRaw, [{ host: reply[0], port: reply[1] }]).then((tunnels) => {
                const sentinelClient = redisService.createConnection(
                  tunnels[0].localHost, tunnels[0].localPort, configRaw.sentinelOptions.nodePassword, configRaw, false, true,
                );
                resolve(sentinelClient);
              });
            }).catch(reject);
          });

          client.on('error', reject);
        } else if (configRaw.cluster) {
          const client = redisService.createConnection(listenAddress.address, listenAddress.port, auth, configRaw, false, true);

          client.on('ready', () => {
            client.call('cluster', 'nodes').then((reply) => {
              const nodes = this.getClusterNodes(reply);

              this.createClusterSSHTunnels(sshConfigRaw, nodes).then((tunnels) => {
                configRaw.natMap = this.initNatMap(tunnels);
                const clusterClient = redisService.createConnection(tunnels[0].localHost, tunnels[0].localPort, auth, configRaw, false);
                resolve(clusterClient);
              });
            }).catch(reject);
          });

          client.on('error', reject);
        } else {
          const client = redisService.createConnection(listenAddress.address, listenAddress.port, auth, configRaw, false);
          client.once('ready', () => resolve(client));
          client.once('error', (err) => { client.disconnect(); reject(err); });
        }
      }).catch(reject);
    });
  },
};

module.exports = sshService;
