<template>
  <div class="aside-outer-container">
    <!-- dialogs (no visual output) -->
    <NewConnectionDialog
      @editConnectionFinished="editConnectionFinished"
      ref="newConnectionDialog"
    >
    </NewConnectionDialog>
    <Setting ref="settingDialog"></Setting>
    <CommandLog ref="commandLogDialog"></CommandLog>
    <HotKeys ref="hotKeysDialog"></HotKeys>
    <CustomFormatter></CustomFormatter>

    <!-- app header -->
    <div class="aside-app-header">
      <img
        src="@/assets/open-redis-web-ui.png"
        class="aside-app-logo"
        alt="logo"
      />
      <span class="aside-app-title">Open Redis Web UI</span>
    </div>

    <!-- connection list (scrollable) -->
    <Connections ref="connections"></Connections>

    <!-- bottom bar (fixed, outside scroll) -->
    <div class="aside-bottom-bar">
      <div class="aside-bottom-actions">
        <el-button
          class="aside-new-conn-btn"
          type="primary"
          icon="el-icon-circle-plus"
          @click="addNewConnection"
          :title="$t('message.new_connection') + ' Ctrl+n'"
          plain
          >{{ $t("message.new_connection") }}</el-button
        >
        <el-button
          class="aside-setting-btn"
          type="primary"
          icon="el-icon-time"
          @click="$refs.commandLogDialog.show()"
          :title="$t('message.command_log') + ' Ctrl+g'"
          plain
        ></el-button>
        <el-button
          class="aside-setting-btn"
          type="primary"
          icon="el-icon-setting"
          @click="$refs.settingDialog.show()"
          :title="$t('message.settings') + ' Ctrl+,'"
          plain
        ></el-button>
      </div>
      <div class="aside-footer-credit">
        Re-engineered by
        <a
          href="https://github.com/rahulbhooteshwar"
          target="_blank"
          rel="noopener"
          >RB</a
        >
        with ❤️ &amp;
        <img
          src="@/assets/claude-color.png"
          class="aside-claude-icon"
          alt="Claude"
        />
      </div>
    </div>
  </div>
</template>

<script type="text/javascript">
import Setting from "@/components/Setting";
import Connections from "@/components/Connections";
import NewConnectionDialog from "@/components/NewConnectionDialog";
import CommandLog from "@/components/CommandLog";
import HotKeys from "@/components/HotKeys";
import CustomFormatter from "@/components/CustomFormatter";

export default {
  data() {
    return {};
  },
  components: {
    Connections,
    NewConnectionDialog,
    Setting,
    CommandLog,
    HotKeys,
    CustomFormatter,
  },
  methods: {
    editConnectionFinished() {
      this.$refs.connections.initConnections();
    },
    addNewConnection() {
      this.$refs.newConnectionDialog.show();
    },
    initShortcut() {
      // new connection
      this.$shortcut.bind("ctrl+n, ⌘+n", () => {
        this.$refs.newConnectionDialog.show();
        return false;
      });
      // settings
      this.$shortcut.bind("ctrl+,", () => {
        this.$refs.settingDialog.show();
        return false;
      });
      this.$shortcut.bind("⌘+,", () => {
        this.$refs.settingDialog.show();
        return false;
      });
      // logs
      this.$shortcut.bind("ctrl+g, ⌘+g", () => {
        this.$refs.commandLogDialog.show();
        return false;
      });
    },
  },
  mounted() {
    this.initShortcut();
  },
};
</script>

<style type="text/css">
.aside-outer-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* app header */
.aside-app-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px 8px;
  border-bottom: 1px solid #dcdfe6;
  flex-shrink: 0;
}
.dark-mode .aside-app-header {
  border-bottom-color: #3a4a55;
}
.aside-app-logo {
  width: 34px;
  height: 34px;
  object-fit: contain;
  flex-shrink: 0;
}
.aside-app-title {
  font-size: 16px;
  font-weight: 700;
  color: #303133;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dark-mode .aside-app-title {
  color: #c0c4cc;
}

/* let Connections fill remaining space and scroll internally */
.aside-outer-container > .connections-wrap {
  flex: 1;
  min-height: 0;
}

/* bottom bar — always visible, never scrolls away */
.aside-bottom-bar {
  flex-shrink: 0;
  border-top: 1px solid #dcdfe6;
  padding: 8px 8px 6px;
}
.dark-mode .aside-bottom-bar {
  border-top-color: #3a4a55;
}

.aside-bottom-actions {
  display: flex;
  gap: 6px;
  margin-bottom: 6px;
}
.aside-bottom-actions .aside-new-conn-btn {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.aside-bottom-actions .aside-setting-btn {
  flex-shrink: 0;
  width: 40px;
  padding: 7px 0;
}

.aside-footer-credit {
  text-align: center;
  font-size: 11px;
  color: #909399;
  line-height: 1.4;
}
.aside-footer-credit a {
  color: #409eff;
  text-decoration: none;
}
.aside-footer-credit a:hover {
  text-decoration: underline;
}
.aside-claude-icon {
  width: 14px;
  height: 14px;
  vertical-align: middle;
  position: relative;
  top: -1px;
}
.dark-mode .aside-footer-credit {
  color: #5a6e78;
}
.dark-mode .aside-footer-credit a {
  color: #52a6fd;
}
</style>
