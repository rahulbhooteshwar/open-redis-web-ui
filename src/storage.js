import axios from 'axios';
import utils from './util';

const { randomString } = utils;

export default {
  // ── Settings (UI prefs — stay in localStorage) ───────────────────────────

  getSetting(key) {
    let settings = localStorage.getItem('settings');
    settings = settings ? JSON.parse(settings) : {};
    return key ? settings[key] : settings;
  },
  saveSettings(settings) {
    return localStorage.setItem('settings', JSON.stringify(settings));
  },
  getFontFamily() {
    let fontFamily = this.getSetting('fontFamily');
    if (!fontFamily || !fontFamily.length || fontFamily.toString() === 'Default Initial') {
      fontFamily = ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Helvetica',
        'Arial', 'sans-serif', 'Microsoft YaHei', 'Apple Color Emoji', 'Segoe UI Emoji'];
    }
    return fontFamily.map(line => `"${line}"`).join(',');
  },
  getCustomFormatter(name = '') {
    let formatters = localStorage.getItem('customFormatters');
    formatters = formatters ? JSON.parse(formatters) : [];
    if (!name) return formatters;
    return formatters.find(line => line.name === name);
  },
  saveCustomFormatters(formatters = []) {
    return localStorage.setItem('customFormatters', JSON.stringify(formatters));
  },

  // ── Connections (server-side) ─────────────────────────────────────────────

  async getConnections(returnList = false) {
    const { data } = await axios.get('/api/connections');
    // guard against non-array responses (proxy HTML fallback, server error object, etc.)
    const list = Array.isArray(data) ? data : [];
    if (returnList) return list;
    return Object.fromEntries(list.map(c => [c.key, c]));
  },

  async addConnection(connection) {
    return this.editConnectionByKey(connection, '');
  },

  async editConnectionByKey(connection, oldKey = '') {
    oldKey = connection.key || oldKey;

    // Resolve connection name (deduplicate against existing list)
    const existing = await this.getConnections(true);
    this._updateConnectionName(connection, existing);

    if (oldKey) {
      // update existing
      const { data } = await axios.put(`/api/connections/${oldKey}`, connection);
      return data;
    } else {
      // new connection
      const { data } = await axios.post('/api/connections', connection);
      return data;
    }
  },

  async editConnectionItem(connection, items = {}) {
    const key = this.getConnectionKey(connection);
    if (!key) return;
    Object.assign(connection, items);
    await axios.put(`/api/connections/${key}`, connection);
  },

  async deleteConnection(connection) {
    const key = this.getConnectionKey(connection);
    if (!key) return;
    await axios.delete(`/api/connections/${key}`);
  },

  async reOrderAndStore(connections = []) {
    const { data } = await axios.post('/api/connections/reorder', connections);
    return data;
  },

  // ── Helpers ───────────────────────────────────────────────────────────────

  getConnectionKey(connection, forceUnique = false) {
    if (!connection || Object.keys(connection).length === 0) return '';
    if (connection.key) return connection.key;
    if (forceUnique) return `${new Date().getTime()}_${randomString(5)}`;
    return connection.host + connection.port + connection.name;
  },

  getConnectionName(connection) {
    return connection.name || `${connection.host}@${connection.port}`;
  },

  _updateConnectionName(connection, existingList = []) {
    let name = this.getConnectionName(connection);
    const duplicate = existingList.some(c =>
      c.key !== connection.key && this.getConnectionName(c) === name
    );
    if (duplicate) name += ` (${randomString(3)})`;
    connection.name = name;
  },

  sortConnections(connections) {
    connections.sort((a, b) => {
      if (!isNaN(a.order) && !isNaN(b.order)) return parseInt(a.order) - parseInt(b.order);
      if (a.key && b.key) return a.key < b.key ? -1 : 1;
      return a.key ? 1 : (b.key ? -1 : 0);
    });
  },

  // Per-connection UI state keys (CLI history, last DB, etc.) — stay in localStorage
  getStorageKeyMap(type) {
    const typeMap = {
      cli_tip: 'cliTips',
      last_db: 'lastSelectedDb',
      custom_db: 'customDbName',
      search_tip: 'searchTips',
    };
    return type ? typeMap[type] : typeMap;
  },
  initStorageKey(prefix, connectionName) {
    return `${prefix}_${connectionName}`;
  },
  getStorageKeyByName(type = 'cli_tip', connectionName = '') {
    return this.initStorageKey(this.getStorageKeyMap(type), connectionName);
  },
  hookAfterDelConnection(connection) {
    const connectionName = this.getConnectionName(connection);
    Object.keys(this.getStorageKeyMap()).forEach(type => {
      localStorage.removeItem(this.getStorageKeyByName(type, connectionName));
    });
  },
};
