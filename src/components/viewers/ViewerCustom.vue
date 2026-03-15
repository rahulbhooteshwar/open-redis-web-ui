<template>
  <JsonEditor ref='editor' :content='newContent' class='viewer-custom-editor'>
    <p :title="fullCommand" class="command-preview">
      <el-button size="mini" class="viewer-custom-copy-raw"
        :title='$t("message.copy")' icon="el-icon-document" type="text"
        @click="$util.copyToClipboard(fullCommand)">
      </el-button>
      {{ previewCommand }}
    </p>
  </JsonEditor>
</template>

<script type="text/javascript">
import axios from 'axios';
import storage from '@/storage';
import JsonEditor from '@/components/JsonEditor';

export default {
  data() {
    return {
      execResult: '',
      fullCommand: '',
      previewCommand: '',
      previewContentMax: 50,
      writeHexFileSize: 8000,
    };
  },
  components: { JsonEditor },
  props: ['content', 'name', 'dataMap', 'redisKey'],
  computed: {
    newContent() {
      if (this.$util.isJson(this.execResult)) {
        return JSON.parse(this.execResult);
      }

      return this.execResult;
    },
  },
  watch: {
    content() {
      this.execCommand();
    },
  },
  methods: {
    getCommand() {
      const formatter = storage.getCustomFormatter(this.name);

      if (!formatter) {
        return false;
      }

      const { command } = formatter;
      const { params } = formatter;
      const paramsReplaced = this.replaceTemplate(params);

      return `"${command}" ${paramsReplaced}`;
    },
    replaceTemplate(params) {
      if (!params) {
        return '';
      }

      const dataMap = this.dataMap ? this.dataMap : {};
      const mapObj = {
        '{KEY}': this.redisKey,
        // "{VALUE}": this.content,
        '{FIELD}': dataMap.key,
        '{SCORE}': dataMap.score,
        '{MEMBER}': dataMap.member,
      };

      const re = new RegExp(Object.keys(mapObj).join('|'), 'gi');
      return params.replace(re, matched => mapObj[matched]);
    },
    execCommand() {
      if (!this.content || !this.content.length) {
        return this.execResult = '';
      }

      const command = this.getCommand();
      const hexStr = this.content.toString('hex');

      if (!command) {
        return this.execResult = 'Command Error, Check Config!';
      }

      this.fullCommand = command.replace(
        '{VALUE}',
        this.content,
      );

      // in case of long content in template
      this.previewCommand = command.replace(
        '{VALUE}',
        this.$util.cutString(this.content.toString(), this.previewContentMax),
      );

      // if content is too long, write to file simultaneously
      // hex str is about 2 times of real size
      if (hexStr.length > this.writeHexFileSize) {
        // Replace {HEX} placeholder with file path note
        this.fullCommand = this.fullCommand
          .replace('{HEX}', '<Content Too Long, Use {HEX_FILE} Instead!>')
          .replace('{HEX_FILE}', 'tmp_hex_file.txt');
        this.previewCommand = this.previewCommand
          .replace('{HEX}', '<Content Too Long, Use {HEX_FILE} Instead!>')
          .replace('{HEX_FILE}', 'tmp_hex_file.txt');

        // Send to server formatter endpoint
        this.exec(hexStr, true);
      }
      // common content just exec
      else {
        this.fullCommand = this.fullCommand
          .replace('{HEX}', hexStr)
          .replace('{HEX_FILE}', '<Use {HEX} Instead!>');

        this.previewCommand = this.previewCommand
          .replace(
            '{HEX}',
            this.$util.cutString(hexStr, this.previewContentMax),
          )
          .replace('{HEX_FILE}', '<Use {HEX} Instead!>');

        this.exec();
      }
    },
    exec(content = this.content.toString(), viaServer = false) {
      const payload = { command: this.fullCommand, content };
      axios.post('/api/formatter/exec', payload)
        .then(res => (this.execResult = res.data.output))
        .catch(err => (this.execResult = (err.response && err.response.data && err.response.data.message) || err.message));
    },
  },
  mounted() {
    this.execCommand();
  },
};
</script>

<style type="text/css">
.text-formated-container .command-preview {
  color: #9798a7;
  word-break: break-all;
  height: 40px;
  overflow-y: auto;
  line-height: 20px;
  margin-bottom: 2px;
}
/*copy raw command btn*/
.text-formated-container .command-preview .viewer-custom-copy-raw {
  padding: 0;
}

/*make monaco less height in custom viewer*/
.key-content-string .text-formated-container.viewer-custom-editor .monaco-editor-con {
  height: calc(100vh - 331px);
/*  min-height: 50px;*/
}
</style>
