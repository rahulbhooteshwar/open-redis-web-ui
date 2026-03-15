<template>
  <JsonEditor ref='editor' :content='newContent' :readOnly='false' class='protobuf-viewer'>
    <div class="viewer-protobuf-header">
      <!-- type selector -->
      <el-select v-model="selectedType" filterable placeholder="Select Type" size="mini" class="type-selector">
        <el-option
          v-for="t of types"
          :key="t"
          :label="t"
          :value="t">
        </el-option>
      </el-select>
      <!-- select proto file -->
      <el-button class="select-proto-btn" type='primary' size="mini" icon="el-icon-upload2" @click="selectProto">Select Proto Files</el-button>
    </div>
    <!-- selected files -->
    <!-- <el-tag v-for="p of proto" :key="p" class="selected-proto-file-tag">{{ p }}</el-tag> -->
    <hr>
  </JsonEditor>
</template>

<script type="text/javascript">
import JsonEditor from '@/components/JsonEditor';
import { getData } from 'rawproto';
// import * as protobuf from 'protobufjs';
import protobuf from 'protobufjs/minimal';

export default {
  data() {
    return {
      proto: [],
      protoRoot: null,
      types: ['Rawproto'],
      selectedType: 'Rawproto',
    };
  },
  components: { JsonEditor },
  props: ['content'],
  computed: {
    newContent() {
      try {
        if (this.selectedType === 'Rawproto') {
          return getData(this.content);
        }
        const type = this.protoRoot.lookupType(this.selectedType);
        const message = type.decode(this.content);
        return message.toJSON();
      } catch (e) {
        return 'Protobuf Decode Failed!';
      }
    },
  },
  methods: {
    traverseTypes(current) {
      if (current instanceof protobuf.Type) {
        this.types.push(current.fullName);
      }
      if (current.nestedArray) {
        current.nestedArray.forEach((nested) => {
          this.traverseTypes(nested);
        });
      }
    },
    selectProto() {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.accept = '.proto';
      input.style.display = 'none';
      document.body.appendChild(input);

      input.onchange = (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) {
          document.body.removeChild(input);
          return;
        }
        const urls = files.map(f => URL.createObjectURL(f));
        this.proto = urls;
        this.types = ['Rawproto'];
        this.selectedType = 'Rawproto';

        Promise.all(files.map(f => {
          const reader = new FileReader();
          return new Promise((resolve, reject) => {
            reader.onload = () => resolve({ name: f.name, content: reader.result });
            reader.onerror = reject;
            reader.readAsText(f);
          });
        })).then(contents => {
          const root = new protobuf.Root();
          for (const item of contents) {
            protobuf.parse(item.content, root, { keepCase: true });
          }
          this.protoRoot = root;
          this.traverseTypes(root);
          if (this.types.length > 0) {
            this.selectedType = this.types[1];
          }
        }).catch((e) => {
          this.$message.error(e.message);
        });
        document.body.removeChild(input);
      };
      input.click();
    },
    getContent() {
      if (!this.protoRoot) {
        this.$message.error('Select a correct .proto file');
        return false;
      }

      if (!this.selectedType || this.selectedType === 'Rawproto') {
        this.$message.error('Select a correct Type to encode');
        return false;
      }

      let content = this.$refs.editor.getRawContent();
      const type = this.protoRoot.lookupType(this.selectedType);

      try {
        content = JSON.parse(content);
        const err = type.verify(content);

        if (err) {
          this.$message.error(`Proto Verify Failed: ${err}`);
          return false;
        }

        const message = type.create(content);
        return type.encode(message).finish();
      } catch (e) {
        this.$message.error(this.$t('message.json_format_failed'));
        return false;
      }
    },
    copyContent() {
      return JSON.stringify(this.newContent);
    },
  },
};
</script>

<style type="text/css">
  .viewer-protobuf-header {
    display: flex;
    margin-top: 8px;
  }
  .viewer-protobuf-header .type-selector {
    flex: 1;
    margin-right: 10px;
  }
  .viewer-protobuf-header .select-proto-btn {
    margin-top: 2px;
    height: 27px;
  }
  .selected-proto-file-tag {
    margin-right: 4px;
  }

  /*text viewer box*/
  .key-content-string .text-formated-container.protobuf-viewer .monaco-editor-con {
    height: calc(100vh - 331px);
  }
</style>
