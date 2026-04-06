declare module 'rawproto' {
  function parse(buffer: Uint8Array | Buffer): unknown
  export default { parse }
  export { parse }
}
