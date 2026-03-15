<template>
  <el-input
    :value='bookmark || file'
    clearable
    @clear='clearFile'
    @focus='focus'
    :placeholder='placeholder'>
    <template slot="append">
      <el-button @click='showFileSelector'>...</el-button>
    </template>
  </el-input>
</template>

<script type="text/javascript">

export default {
  props: {
    file: { default: '' },
    bookmark: { default: '' },
    placeholder: { default: 'Select File' },
  },
  methods: {
    clearFile() {
      this.$emit('update:file', '');
      this.$emit('update:bookmark', '');
    },
    focus(e) {
      // edit is forbidden, input blur
      e.target.blur();
    },
    showFileSelector() {
      // Create hidden file input and click via hack to serve Electron dialog's purpose
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
            this.$emit('update:file', ev.target.result);
            this.$emit('update:bookmark', file.name);
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
