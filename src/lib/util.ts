'use client'

/**
 * util.ts
 *
 * Browser-compatible utility functions ported from _vue_src/util.js.
 * Uses Uint8Array instead of Node.js Buffer throughout.
 */

// ---------------------------------------------------------------------------
// TreeNode
// ---------------------------------------------------------------------------

export interface TreeNode {
  /** Display name for this node (last segment, or full key for leaf) */
  name: string
  /** Unique key for virtualizer — "F{fullPath}" for folders, key string for leaves */
  key: string
  /** Raw bytes of the name segment */
  nameBuffer: Uint8Array
  /** Only present on leaf nodes — the full Redis key as bytes */
  fullKey?: Uint8Array
  children?: TreeNode[]
  /** Number of leaf keys under this node (or 1 for leaf) */
  keyCount: number
  isLeaf: boolean
  /** Redis type (string/hash/list/set/zset/stream) — only on leaf nodes, populated lazily */
  keyType?: string
}

export interface FlatTreeNode {
  node: TreeNode
  depth: number
  isExpanded: boolean
}

/**
 * Flatten a tree into a linear array for virtual scrolling.
 * Only includes nodes that should be visible (expanded folders + their children).
 */
export function flattenTree(
  nodes: TreeNode[],
  expandedKeys: Set<string>,
  depth = 0,
): FlatTreeNode[] {
  const result: FlatTreeNode[] = []
  for (const node of nodes) {
    const isExpanded = !node.isLeaf && expandedKeys.has(node.key)
    result.push({ node, depth, isExpanded })
    if (isExpanded && node.children) {
      result.push(...flattenTree(node.children, expandedKeys, depth + 1))
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// Buffer / string helpers
// ---------------------------------------------------------------------------

const TEXT_DECODER = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8', { fatal: false }) : null

/**
 * Returns true if all bytes in buf are valid printable ASCII (32–126),
 * i.e. no escaping needed when displayed as a string.
 */
export function isValidUTF8(buf: Uint8Array): boolean {
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] < 32 || buf[i] > 126) return false
  }
  return true
}

/**
 * Decode a Uint8Array to a string. Printable ASCII bytes are kept as-is;
 * non-printable / non-ASCII bytes are encoded as \xNN hex.
 */
export function bufToString(buf: Uint8Array): string {
  if (!buf || buf.length === 0) return ''

  // Fast path: all printable ASCII
  if (isValidUTF8(buf)) {
    // Use TextDecoder for correct multi-byte handling
    return TEXT_DECODER ? TEXT_DECODER.decode(buf) : String.fromCharCode(...buf)
  }

  // Slow path: escape non-printable bytes
  let result = ''
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i]
    if (b >= 32 && b <= 126) {
      result += String.fromCharCode(b)
    } else {
      result += `\\x${b.toString(16).padStart(2, '0')}`
    }
  }
  return result
}

/**
 * Compare two Uint8Arrays for equality.
 */
export function uint8ArrayEquals(a: Uint8Array, b: Uint8Array): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

/**
 * Human-readable byte size (e.g. "1.23 MB").
 */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const clamped = Math.min(i, units.length - 1)
  return `${(bytes / Math.pow(1024, clamped)).toFixed(2)} ${units[clamped]}`
}

/**
 * Truncate a string and append "..." if it exceeds max length.
 */
export function truncateLabel(str: string, max: number): string {
  if (str.length <= max) return str
  return `${str.slice(0, max)}...`
}

// ---------------------------------------------------------------------------
// Tree building
// ---------------------------------------------------------------------------

interface RawTreeNode {
  keyNode?: boolean
  nameBuffer?: Uint8Array
  [key: string]: RawTreeNode | boolean | Uint8Array | undefined
}

function buildRawTree(keys: Uint8Array[], separator: string): RawTreeNode {
  const tree: RawTreeNode = {}

  for (const key of keys) {
    const keyStr = bufToString(key)
    const parts = keyStr.split(separator)
    const lastIndex = parts.length - 1
    let currentNode = tree

    parts.forEach((part, index) => {
      if (index === lastIndex) {
        // Leaf node — suffix with backtick marker to avoid collision with folder names
        const leafKey = `${keyStr}\`k\``
        currentNode[leafKey] = { keyNode: true, nameBuffer: key }
      } else {
        if (currentNode[part] === undefined) {
          currentNode[part] = {}
        }
        currentNode = currentNode[part] as RawTreeNode
      }
    })
  }

  return tree
}

interface OpenStatus {
  has: (key: string) => boolean
}

function formatTreeData(
  tree: RawTreeNode,
  previousKey: string,
  openStatus: OpenStatus,
  separator: string,
): TreeNode[] {
  return Object.keys(tree).map((key) => {
    const node = tree[key] as RawTreeNode

    // Leaf (key) node
    if (node.keyNode) {
      const displayName = key.replace(/`k`$/, '')
      return {
        name: displayName,
        key: displayName,
        nameBuffer: node.nameBuffer as Uint8Array,
        fullKey: node.nameBuffer as Uint8Array,
        keyCount: 1,
        isLeaf: true,
      }
    }

    // Folder node
    const tillNowKeyName = previousKey + key + separator
    const folderKey = `F${tillNowKeyName}`
    const children = formatTreeData(node, tillNowKeyName, openStatus, separator)
    const keyCount = children.reduce((acc, child) => acc + child.keyCount, 0)

    // Sort children if this folder is open: folders first then keys, each alpha
    const isOpen = openStatus.has(folderKey)
    if (isOpen) {
      sortNodes(children)
    }

    const nameBytes = new TextEncoder().encode(key)

    return {
      name: key || '[Empty]',
      key: folderKey,
      nameBuffer: nameBytes,
      children,
      keyCount,
      isLeaf: false,
    }
  })
}

function sortNodes(nodes: TreeNode[]) {
  nodes.sort((a, b) => {
    // Both leaves
    if (a.isLeaf && b.isLeaf) return a.name > b.name ? 1 : -1
    // Both folders
    if (!a.isLeaf && !b.isLeaf) return a.name > b.name ? 1 : -1
    // a is folder → comes first
    if (!a.isLeaf) return -1
    return 1
  })
}

/**
 * Build a hierarchical tree from an array of Redis key buffers.
 *
 * @param keys       - Array of Uint8Array key bytes
 * @param separator  - Key separator (default ":")
 * @param openStatus - Set-like object of currently expanded folder keys
 */
export function keysToTree(
  keys: Uint8Array[],
  separator = ':',
  openStatus: OpenStatus = { has: () => false },
): TreeNode[] {
  const raw = buildRawTree(keys, separator)
  const nodes = formatTreeData(raw, '', openStatus, separator)
  // Sort outermost layer
  sortNodes(nodes)
  return nodes
}

// ---------------------------------------------------------------------------
// Clipboard
// ---------------------------------------------------------------------------

export function copyToClipboard(text: string): void {
  if (navigator?.clipboard) {
    navigator.clipboard.writeText(text).catch(() => {})
    return
  }
  // Fallback
  const el = document.createElement('textarea')
  el.value = text
  el.style.position = 'fixed'
  el.style.opacity = '0'
  document.body.appendChild(el)
  el.select()
  document.execCommand('copy')
  document.body.removeChild(el)
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

export function humanFileSize(size = 0): string {
  return formatBytes(size)
}

export function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  wait: number,
  immediate = false,
): T & { cancel: () => void } {
  let timeout: ReturnType<typeof setTimeout> | null = null

  const debounced = function (this: unknown, ...args: unknown[]) {
    const later = () => {
      timeout = null
      if (!immediate) func.apply(this, args)
    }
    const callNow = immediate && !timeout
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(later, wait)
    if (callNow) func.apply(this, args)
  } as T & { cancel: () => void }

  debounced.cancel = () => {
    if (timeout) clearTimeout(timeout)
    timeout = null
  }

  return debounced
}
