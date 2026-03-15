import keymaster from 'keymaster';

// enable shortcut in input, textarea, select
keymaster.filter = e => true;

// prevent ctrl+r
keymaster('ctrl+r, ⌘+r', e => false);

// minimize window — no-op in browser; window cannot be minimized by JS
keymaster('ctrl+h, ctrl+m, ⌘+m', (e) => false);

// hide window on mac — no-op in browser
keymaster('ctrl+enter, ⌘+enter', (e) => false);

export default {
  bind: (...args) => keymaster(...args),
  ...keymaster,
};
