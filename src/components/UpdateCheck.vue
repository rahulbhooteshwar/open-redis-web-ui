<template>
</template>

<script type="text/javascript">

export default {
  data() {
    return {
      manual: false,
      updateChecking: false,
      downloadProcessShow: false,
    };
  },
  created() {
    this.$bus.$on('update-check', (manual = false) => {
      this.manual = manual;

      // update checking running...
      if (this.updateChecking) {
        return;
      }

      // In web build, auto-updating is disabled
      setTimeout(() => {
        this.resetDownloadProcess();
        this.manual
          ? this.$notify.success({ title: this.$t('message.update_not_available') })
          : this.resetDownloadProcess();
      }, 500);
    });
  },
  methods: {
    bindRendererListener() {
      // Auto-updater removed in web build, do nothing
    },
    setProgressBar(percent) {
      this.downloadProcessShow
      && this.$refs.downloadProgressBar
      && this.$set(this.$refs.downloadProgressBar, 'percentage', percent);
    },
    resetDownloadProcess() {
      this.updateChecking = false;
      this.downloadProcessShow = false;
    },
  },
  mounted() {
    this.bindRendererListener();
  },
};
</script>

<style type="text/css">
  .download-progress-container .el-progress {
    width: 280px;
  }
</style>
