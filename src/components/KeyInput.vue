<template>
  <div class="key-input">
    <!-- Collapsed summary row (when content is loaded and not expanded) -->
    <div v-if="content && !expanded" class="key-input-summary">
      <span class="key-input-label" @click="expanded = true" title="Click to view/edit">
        &#9679; {{ displayName }}
      </span>
      <span class="key-input-actions">
        <el-button type="text" size="mini" @click="expanded = true">Edit</el-button>
        <el-button type="text" size="mini" @click="clearKey">Clear</el-button>
        <el-button size="mini" @click="showFileSelector">Load from file</el-button>
      </span>
    </div>

    <!-- Expanded textarea (editing/pasting) -->
    <div v-if="!content || expanded" class="key-input-expanded">
      <el-input
        type="textarea"
        :rows="6"
        :value="content"
        :placeholder="placeholder"
        @input="onTextareaInput"
        class="key-input-textarea">
      </el-input>
      <div class="key-input-actions key-input-actions-below">
        <el-button v-if="content" type="text" size="mini" @click="expanded = false">Collapse</el-button>
        <el-button v-if="content" type="text" size="mini" @click="clearKey">Clear</el-button>
        <el-button size="mini" @click="showFileSelector">Load from file</el-button>
      </div>
    </div>
  </div>
</template>

<script type="text/javascript">
export default {
  props: {
    content: { default: '' },
    filename: { default: '' },
    placeholder: { default: '-----BEGIN ... PRIVATE KEY-----\n...\n-----END ... PRIVATE KEY-----\n\nPaste PEM content here or use "Load from file"' },
  },
  data() {
    return {
      expanded: false,
    };
  },
  computed: {
    displayName() {
      if (this.filename) return this.filename;
      // Show truncated first line of PEM
      const firstLine = (this.content || '').trim().split('\n')[0];
      return firstLine ? 'key pasted' : '';
    },
  },
  methods: {
    onTextareaInput(val) {
      this.$emit('update:content', val);
      // Clear filename if user manually edited
      if (this.filename) {
        this.$emit('update:filename', '');
      }
    },
    clearKey() {
      this.$emit('update:content', '');
      this.$emit('update:filename', '');
      this.expanded = false;
    },
    showFileSelector() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '*';
      input.hidden = true;
      input.multiple = false;
      document.body.appendChild(input);

      input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            let text = ev.target.result;
            // Ensure trailing newline (PEM requires it)
            if (text && !text.endsWith('\n')) text += '\n';
            this.$emit('update:content', text);
            this.$emit('update:filename', file.name);
            this.expanded = false;
          };
          reader.readAsText(file);
        }
        document.body.removeChild(input);
      };
      input.click();
    },
  },
};
</script>

<style scoped>
.key-input {
  width: 100%;
}

.key-input-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  padding: 0 10px;
  height: 36px;
  box-sizing: border-box;
}

.dark-mode .key-input-summary {
  border-color: #4c5b67;
}

.key-input-label {
  cursor: pointer;
  color: #606266;
  font-size: 13px;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dark-mode .key-input-label {
  color: #adb5bd;
}

.key-input-label:hover {
  color: #409eff;
}

.key-input-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.key-input-actions-below {
  margin-top: 6px;
  justify-content: flex-end;
}

.key-input-textarea {
  width: 100%;
  font-family: monospace;
  font-size: 12px;
}
</style>
