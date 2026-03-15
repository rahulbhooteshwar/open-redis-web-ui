<template>
  <JsonEditor ref='editor' :content='newContent' :readOnly='false'></JsonEditor>
</template>

<script type="text/javascript">
import JsonEditor from '@/components/JsonEditor';
import JSONbigFactory from '@qii404/json-bigint';
import zlib from 'zlib';
const JSONbig = JSONbigFactory({ useNativeBigInt: false });

export default {
  components: { JsonEditor },
  props: ['content'],
  computed: {
    newContent() {
      const { formatStr } = this;

      if (typeof formatStr === 'string') {
        if (this.$util.isJson(formatStr)) {
          return JSONbig.parse(formatStr);
        }

        return formatStr;
      }

      return 'Zlib Deflate Parse Failed!';
    },
    formatStr() {
      return this.$util.zippedToString(this.content, 'deflate');
    },
  },
  methods: {
    getContent() {
      const content = this.$refs.editor.getRawContent(true);
      return zlib.deflateSync(content);
    },
    copyContent() {
      return this.formatStr;
    },
  },
};
</script>
