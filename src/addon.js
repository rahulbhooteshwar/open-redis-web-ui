import getopts from 'getopts';
import bus from './bus';
import storage from './storage';
import { ipcInvoke } from '@/utils/ipcBridge';

export default {
  setup() {
    // reload settings when init
    this.reloadSettings();
    // init args start from cli
    this.bindCliArgs();
    // bing href click
    this.openHrefInBrowser();
  },
  reloadSettings() {
    this.initFont();
    this.initZoom();
  },
  initFont() {
    const fontFamily = storage.getFontFamily();
    document.body.style.fontFamily = fontFamily;
    // tell monaco editor
    bus.$emit('fontInited', fontFamily);
  },
  initZoom() {
    let zoomFactor = storage.getSetting('zoomFactor');
    zoomFactor = zoomFactor || 1.0;
    document.documentElement.style.setProperty('zoom', zoomFactor);
    document.body.style.zoom = zoomFactor;
  },
  openHrefInBrowser() {
    document.addEventListener('click', (event) => {
      const ele = event.target;

      if (ele && (ele.nodeName.toLowerCase() === 'a') && ele.href.startsWith('http')) {
        event.preventDefault();
        window.open(ele.href, '_blank', 'noopener');
      }
    });
  },
  bindCliArgs() {
    // Wrap in self-invoked async for webpack4
    (async()=>{
      const argv = await ipcInvoke('getMainArgs');
      if (!argv || !argv.length) {
        return;
      }
      const mainArgs = getopts(argv);

      if (!mainArgs.host) {
        return;
      }

      // common args
      const connection = {
        host: mainArgs.host,
        port: mainArgs.port ? mainArgs.port : 6379,
        auth: mainArgs.auth,
        username: mainArgs.username,
        name: mainArgs.name,
        separator: mainArgs.separator,
        connectionReadOnly: mainArgs.readonly,
      };

      // cluster args
      if (mainArgs.cluster) {
        connection.cluster = true;
      }

      // ssh args
      if (mainArgs['ssh-host'] && mainArgs['ssh-username']) {
        const sshOptions = {
          host: mainArgs['ssh-host'],
          port: mainArgs['ssh-port'] ? mainArgs['ssh-port'] : 22,
          username: mainArgs['ssh-username'],
          password: mainArgs['ssh-password'],
          privatekey: mainArgs['ssh-private-key'],
          passphrase: mainArgs['ssh-passphrase'],
          timeout: mainArgs['ssh-timeout'],
        };

        connection.sshOptions = sshOptions;
      }

      // sentinel args
      if (mainArgs['sentinel-master-name']) {
        const sentinelOptions = {
          masterName: mainArgs['sentinel-master-name'],
          nodePassword: mainArgs['sentinel-node-password'],
        };

        connection.sentinelOptions = sentinelOptions;
      }

      // ssl args
      if (mainArgs.ssl) {
        const sslOptions = {
          key: mainArgs['ssl-key'],
          ca: mainArgs['ssl-ca'],
          cert: mainArgs['ssl-cert'],
        };

        connection.sslOptions = sslOptions;
      }

      // add to storage
      storage.addConnection(connection);
      bus.$emit('refreshConnections');

      // open connection after added
      setTimeout(() => {
        bus.$emit('openConnection', connection.name);
        // tmp connection, delete it after opened
        if (!mainArgs.save) {
          storage.deleteConnection(connection);
        }
      }, 300);
    })();
  }
};