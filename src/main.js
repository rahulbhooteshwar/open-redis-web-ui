import { Buffer } from 'buffer';
window.Buffer = Buffer;

import Vue from 'vue';
import ElementUI from 'element-ui';
import 'font-awesome/css/font-awesome.css';
import App from './App';
import i18n from './i18n/i18n';
import bus from './bus';
import util from './util';
import storage from './storage';
import shortcut from './shortcut';

// vxe-table
// import VxeUITable from 'vxe-table';
import 'vxe-table/lib/style.css';
// Vue.use(VxeUITable);

Vue.prototype.$bus = bus;
Vue.prototype.$util = util;
Vue.prototype.$storage = storage;
Vue.prototype.$shortcut = shortcut;

Vue.use(ElementUI, { size: 'small' });
Vue.config.productionTip = false;

/* eslint-disable no-new */
const vue = new Vue({
  el: '#app',
  i18n,
  components: { App },
  template: '<App/>',
});

// Browser: hook into onerror if needed
window.addEventListener('error', (ev) => {
  // ResizeObserver fires this benign notification when it can't deliver all
  // callbacks in a single animation frame.  It is not a real error — ignore it.
  if (ev.message && ev.message.includes('ResizeObserver loop')) {
    ev.stopImmediatePropagation();
    return;
  }

  vue.$message.error({
    message: `Javascript Error: ${ev.message}`,
    duration: 5000,
  });
  vue.$bus.$emit('closeConnection');
});

export default vue;
