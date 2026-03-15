'use strict';

// Axios is already in deps for REST API calls
import axios from 'axios';

const API_BASE = process.env.NODE_ENV === 'development'
  ? 'http://localhost:9988'
  : window.location.origin;

/**
 * Drop-in replacement for Electron's ipcRenderer.invoke
 * Makes HTTP GET/POST to server routes matching the IPC channel map.
 */
export const ipcInvoke = async (channel, ...args) => {
  const [head, ...tail] = args;
  switch (channel) {
    case 'getMainArgs':
      return (await fetch(`${API_BASE}/api/system/main-args`).then(r => r.json())).argv;
    case 'getTempPath':
      return (await fetch(`${API_BASE}/api/system/temp-path`).then(r => r.json())).path;
    default:
      throw new Error(`Unknown invoke channel: ${channel}`);
  }
};

/**
 * Drop-in replacement for ipcRenderer.send (fire-and-forget notifications)
 * POST body with the channel and args.
 */
export const ipcSend = (channel, arg) => {
  // For simple window-control that browser cannot perform, we silently return
  if (['minimizeWindow', 'toggleMaximize'].includes(channel)) return;

  if (channel === 'update-check') {
    // No-op for web — Electron auto-updater removed
    return;
  }

  if (channel === 'get-all-fonts') {
    fetch(`${API_BASE}/api/system/fonts`)
      .then(r => r.json())
      .then(fonts => window.dispatch('send-all-fonts', fonts))
      .catch(() => { /* ignore */ });
  }
};


/**
 * Drop-in replacement for ipcRenderer.on(eventChannel, listener)
 */
export const ipcOn = (channel, handler) => {
  // Maps IPC channels to browser window events
  const map = {
    'closingWindow':     'beforeunload',
    'update-available':   undefined,  // auto-updater removed
    'update-not-available': undefined,
    'update-error':       undefined,
    'download-progress':  undefined,
    'update-downloaded':  undefined,
    'send-all-fonts':     undefined,
  };

  const event = map[channel];
  if (event) {
    window.addEventListener(event, (ev) => handler(ev, ev.detail));
  }
  // If event not supported, silently ignore
};

/**
 * Helper to fire custom events that simulate IPC main-way messages to Vue components
 */
export const dispatchEvent = (channel, data) => {
  const evName = `ipc-${channel}`;
  window.dispatchEvent(new CustomEvent(evName, { detail: data }));
};

/**
 * Async awaiter for any ipcInvoke result; useful for boot-time data
 */
export const preloadMainArgs = async () => {
  try {
    const res = await axios.get(`${API_BASE}/api/system/main-args`);
    return res.data;
  } catch (e) {
    return { argv: [] };
  }
};

/**
 * Shorthand clipboard helper backed by navigator.clipboard API
 */
export const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(String(text || ''));
  } catch (e) {
    // fallback to document execCommand for old browsers
    const el = document.createElement('textarea');
    el.value = String(text||'');
    document.body.appendChild(el);
    el.focus();
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  }
};

/**
 * System fonts list wrapper for Linux/Mac/Win
 */
export const getSystemFonts = async () => {
  try {
    const res = await axios.get(`${API_BASE}/api/system/fonts`);
    return res.data;
  } catch (e) { return []; }
};

export default {
  invoke: (ch, ...a) => ipcInvoke(ch, ...a),
  send: (ch, a) => ipcSend(ch, a),
  on: (ch, h) => ipcOn(ch, h),
  copyToClipboard,
  getSystemFonts,
  preloadMainArgs,
  dispatchEvent,
};