<template>
  <!-- setting dialog -->
  <el-dialog :title="$t('message.settings')" :visible.sync="visible" custom-class="setting-main-dialog">
    <el-form label-position="top" size="mini">

      <el-card :header="$t('message.ui_settings')" class="setting-card">
        <el-row :gutter="10" justify="space-between" type="flex" class="setting-row">
          <el-col :sm="12" :lg="5">
            <!-- theme select-->
            <el-form-item :label="$t('message.theme_select')">
              <el-select v-model='themeMode' @change="changeTheme">
                <el-option
                  v-for="(label, theme) in themeList"
                  :key="theme"
                  :value="theme"
                  :label="label">
                </el-option>
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :sm="12" :lg="7">
            <!-- language select -->
            <el-form-item :label="$t('message.select_lang')">
              <LanguageSelector></LanguageSelector>
            </el-form-item>
          </el-col>
          <el-col :sm="12" :lg="5">
            <!-- zoom page -->
            <el-form-item :label="$t('message.page_zoom')">
              <el-input-number
                size="mini"
                placeholder='1.0'
                :min=0.5
                :max=2.0
                :step=0.1
                :precision=1
                @change='changeZoom'
                v-model='form.zoomFactor'>
              </el-input-number>
            </el-form-item>
          </el-col>
          <el-col :sm="12" :lg="7">
            <!-- font-family -->
            <el-form-item :label="$t('message.font_family')">
              <span slot="label">
                {{ $t('message.font_family') }}
                <el-popover
                  placement="top-start"
                  :title="$t('message.font_faq_title')"
                  trigger="hover">
                  <i slot="reference" class="el-icon-question"></i>
                  <p v-html="$t('message.font_faq')"></p>
                </el-popover>
                <i v-if="loadingFonts" class="el-icon-loading"></i>
              </span>
              <!-- font-family select -->
              <el-select v-model="form.fontFamily" @visible-change="getAllFonts" allow-create default-first-option
                         filterable multiple class="setting-font-select">
                <el-option
                  v-for="(font, index) in allFonts"
                  :key="index"
                  :label="font"
                  :value="font">
                  <!-- for better performance, do not display font-family -->
                  <!-- :style="{'font-family': font}"> -->
                </el-option>
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
      </el-card>

      <el-card :header="$t('message.common_settings')" class="setting-card">
        <el-row :gutter="20" justify="space-between" type="flex" class="setting-row">
          <el-col :sm="12" :lg="12">
            <!-- keys per loading -->
            <el-form-item>
              <el-input-number
                size="mini"
                placeholder='500'
                :min=10
                :max=20000
                :step=50
                v-model='form.keysPageSize'>
              </el-input-number>&nbsp;
              <!-- load all switch -->
              <!-- <el-switch v-model='form.showLoadAllKeys'></el-switch>
              {{ $t('message.show_load_all_keys') }} -->

              <span slot="label">
                {{ $t('message.keys_per_loading') }}
                <el-popover
                  :content="$t('message.keys_per_loading_tip')"
                  placement="top-start"
                  trigger="hover">
                  <i slot="reference" class="el-icon-question"></i>
                </el-popover>
              </span>
            </el-form-item>
          </el-col>
          <el-col :sm="12" :lg="12">
            <!-- export connections -->
            <el-form-item :label="$t('message.config_connections')">
              <el-button icon="el-icon-upload2" @click="exportConnection">{{ $t('message.export') }}</el-button>
              <el-button icon="el-icon-download" @click="showImportDialog">{{ $t('message.import') }}</el-button>
            </el-form-item>
          </el-col>
        </el-row>
      </el-card>

      <el-card class="setting-card">
        <div slot="header">
          {{$t('message.pre_version')}}
          <el-tag type="info">{{ appVersion }}</el-tag>
        </div>
        <div class="current-version">
          <a href="###" @click.stop.prevent="showHotkeys">{{ $t('message.hotkey') }}</a>
          <a href="###" @click.stop.prevent="clearCache">{{ $t('message.clear_cache') }}</a>
          <a href="###" @click.stop.prevent="checkUpdate">{{ $t('message.check_update') }}</a>
          <a href="https://github.com/qishibo/AnotherRedisDesktopManager/releases">{{ $t('message.manual_update') }}</a>
          <a href="https://github.com/qishibo/AnotherRedisDesktopManager/">{{ $t('message.project_home') }}</a>
        </div>
      </el-card>
    </el-form>

    <!-- import file dialog -->
    <el-dialog
      width="400px"
      :title="$t('message.select_import_file')"
      :visible.sync="importConnectionVisible"
      append-to-body>

      <el-upload
        ref="configUpload"
        :auto-upload="false"
        :multiple="false"
        action=""
        :limit="1"
        :on-change="loadConnectionFile"
        drag>
        <i class="el-icon-upload"></i>
        <div class="el-upload__text">{{ $t('message.put_file_here') }}</div>
      </el-upload>

      <div slot="footer" class="dialog-footer">
        <el-button @click="importConnnection">{{ $t('el.messagebox.confirm') }}</el-button>
      </div>
    </el-dialog>

    <div slot="footer" class="dialog-footer">
      <el-button @click="visible = false">{{ $t('el.messagebox.cancel') }}</el-button>
      <el-button type="primary" @click="saveSettings">{{ $t('el.messagebox.confirm') }}</el-button>
    </div>

  </el-dialog>
</template>

<script type="text/javascript">
import axios from 'axios';
import storage from '@/storage.js';
import { copyToClipboard } from '@/utils/ipcBridge';
import LanguageSelector from '@/components/LanguageSelector';

export default {
  data() {
    return {
      visible: false,
      form: {
        fontFamily: '',
        zoomFactor: 1.0,
        keysPageSize: 500,
        showLoadAllKeys: false,
      },
      importConnectionVisible: false,
      connectionFileContent: '',
      appVersion: (new URL(window.location.href)).searchParams.get('version'),
      // electronVersion: process.versions.electron,
      allFonts: [],
      loadingFonts: false,
      themeMode: 'system',
    };
  },
  components: { LanguageSelector },
  computed: {
    // themeList in computed to activate i18n
    themeList() {
      return {
        system: this.$t('message.theme_system'),
        light: this.$t('message.theme_light'),
        dark: this.$t('message.theme_dark')
      };
    },
  },
  methods: {
    show() {
      this.visible = true;
    },
    restoreSettings() {
      const settings = storage.getSetting();
      this.form = { ...this.form, ...settings };

      // theme
      let theme = localStorage.theme;
      if (!Object.keys(this.themeList).includes(theme)) {
        theme = 'system';
      }

      this.themeMode = theme;
    },
    saveSettings() {
      storage.saveSettings(this.form);

      this.visible = false;
      this.$bus.$emit('reloadSettings', Object.assign({}, this.form));
    },
    changeTheme() {
      localStorage.theme = this.themeMode;
      globalChangeTheme(this.themeMode);
    },
    changeZoom() {
      let { zoomFactor } = this.form;
      zoomFactor = zoomFactor || 1.0;
      document.documentElement.style.setProperty('zoom', zoomFactor);
      document.body.style.zoom = zoomFactor;
    },
    showImportDialog() {
      this.importConnectionVisible = true;
    },
    loadConnectionFile(file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        this.connectionFileContent = event.target.result;
      };
      reader.readAsText(file.raw);
    },
    async importConnnection() {
      this.importConnectionVisible = false;
      let config = this.$util.base64Decode(this.connectionFileContent);

      if (!config) {
        return;
      }

      config = JSON.parse(config);

      // Migration: legacy Electron connections stored file paths in key fields.
      // Strip any absolute paths so the user re-enters the key content.
      const isAbsolutePath = (v) => typeof v === 'string' && (v.startsWith('/') || /^[A-Za-z]:\\/.test(v));
      const legacyNames = [];
      for (const conn of config) {
        if (conn.sshOptions && isAbsolutePath(conn.sshOptions.privatekey)) {
          conn.sshOptions.privatekey = '';
          conn.sshOptions.privatekeybookmark = '';
          legacyNames.push(conn.name || conn.host);
        }
        if (conn.sslOptions) {
          for (const field of ['key', 'cert', 'ca']) {
            if (isAbsolutePath(conn.sslOptions[field])) {
              conn.sslOptions[field] = '';
              conn.sslOptions[`${field}bookmark`] = '';
              if (!legacyNames.includes(conn.name || conn.host)) {
                legacyNames.push(conn.name || conn.host);
              }
            }
          }
        }
      }
      if (legacyNames.length > 0) {
        this.$message.warning({
          message: `Legacy key file paths were cleared for: ${legacyNames.join(', ')}. Please re-enter the key content in each connection.`,
          duration: 6000,
        });
      }

      // delete all existing connections first
      const existing = await storage.getConnections(true);
      await Promise.all(existing.map(c => storage.deleteConnection(c)));

      // close all connections
      this.$bus.$emit('closeConnection');

      // add imported connections sequentially (strip key so server assigns a new one)
      for (const line of config) {
        const { key, ...conn } = line;
        await storage.addConnection(conn);
      }

      this.$bus.$emit('refreshConnections');

      this.$message.success({
        message: this.$t('message.import_success'),
        duration: 1000,
      });
    },
    exportConnection() {
      storage.getConnections(true).then(cons => {
        const b64 = this.$util.base64Encode(JSON.stringify(cons));
        this.$util.createAndDownloadFile('connections.ano', b64);
        this.visible = false;
      });
    },
    checkUpdate() {
      this.$message.info({
        message: `${this.$t('message.update_checking')}`,
        duration: 1500,
      });

      this.$bus.$emit('update-check', true);
    },
    bindGetAllFonts() {
      // Font listing removed in web mode (requires native font-list package)
      this.allFonts = ['System', 'Arial', 'Monospace'];
    },
    async getAllFonts() {
      if (this.allFonts.length === 0) {
        this.loadingFonts = true;
        try {
          const { data } = await axios.get('/api/system/fonts');
          fonts.unshift('Default Initial');
          this.allFonts = [...new Set(fonts)];
        } catch (e) {
          // Fallback to basic fonts
          this.allFonts = ['System', 'Arial', 'Monospace'];
        }
        this.loadingFonts = false;
      }
    },
    clearCache() {
      this.$confirm(this.$t('message.clear_cache_tip')).then(() => {
        localStorage.clear();
        this.$message.success(this.$t('message.delete_success'));
        window.location.reload();
      }).catch((e) => {
      });
    },
    showHotkeys() {
      this.$parent.$refs.hotKeysDialog.show();
    },
  },
  mounted() {
    this.restoreSettings();
    this.bindGetAllFonts();
  },
};
</script>

<style type="text/css">
.setting-main-dialog {
  width: 80%;
  max-width: 900px;
  margin-top: 7vh !important;
}

.dark-mode .el-upload-dragger {
  background: inherit;
}

.setting-main-dialog .current-version a {
  color: grey;
  font-size: 95%;
}

.setting-main-dialog .setting-card {
  margin-bottom: 8px;
}
.setting-main-dialog .setting-card .el-card__header {
  font-size: 105%;
  font-weight: bold;
}

.setting-main-dialog .setting-card .setting-row {
  flex-wrap: wrap;
}

/* add height: fix el-select jitter when multiple*/
.setting-main-dialog .setting-card .setting-row .setting-font-select .el-select__tags .el-tag {
  height: 21px;
  max-width: 98%;
}

/*label style inside el-select multiple*/
.setting-main-dialog .setting-card .setting-row .setting-font-select .el-select__tags .el-tag .el-select__tags-text {
  display: inline-block;
  max-width: 90%;
  overflow: hidden;
  text-overflow: ellipsis;
}
/*fix close icon vertical align*/
.setting-main-dialog .setting-card .setting-row .setting-font-select .el-select__tags .el-tag .el-tag__close {
  vertical-align: super;
}
</style>
