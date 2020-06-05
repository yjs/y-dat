import * as encoding from 'lib0/encoding.js'
import * as decoding from 'lib0/decoding.js'
import { Observable } from 'lib0/observable.js'
import * as logging from 'lib0/logging.js'
import * as promise from 'lib0/promise.js'
import * as Y from 'yjs' // eslint-disable-line
import * as syncProtocol from 'y-protocols/sync.js'
import * as awarenessProtocol from 'y-protocols/awareness.js'
import ram from 'random-access-memory'
import SDK from 'dat-sdk'
import { Buffer } from 'buffer'
import datStorage from 'universal-dat-storage'

const universalStorage = datStorage({})

const log = logging.createModuleLogger('y-dat')

const messageSync = 0
const messageQueryAwareness = 3
const messageAwareness = 1
// const messageBcPeerId = 4

let sdk = null

const getHypercoreConstructor = () => {
  if (sdk === null) {
    sdk = SDK()
  }
  return sdk.Hypercore
}

/**
 * @param {DatProvider} provider
 */
const checkIsSynced = provider => {
  if (!provider.isSynced && provider.syncedPeers.size >= provider.feed.peers.length) {
    provider.isSynced = true
    provider.emit('synced', [{ provider }])
    log('synced ', logging.BOLD, provider.feed.key.toString('hex'), logging.UNBOLD, ' with all peers')
  }
}

export class DatStorage {
  /**
   * @param {any} storage
   * @param {any} key
   * @param {boolean} persist
   */
  constructor (storage, key, persist) {
    this.storage = storage
    this.key = key
    this.createFile = storage.getKeyStoreage(key)
    this.persist = persist
    /**
     * @type {Array<Uint8Array>}
     */
    this.pending = []
    this.activeWrite = false
  }
}

/**
 * @param {DatStorage} s
 * @return {Promise<{store:any,size:number}>}
 */
const getStore = s => promise.create((resolve, reject) => {
  const store = s.createFile('y-dat')
  store.open(err => {
    if (err) {
      reject(err)
    }
    store.stat((err, stat) => {
      if (err) {
        reject(err)
      } else {
        if (s.persist && !store.writable) {
          s.persist = false
        }
        resolve({ store, size: stat.size })
      }
    })
  })
})

/**
 * @param {DatStorage} s
 */
const _writeData = s => {
  if (s.persist && !s.activeWrite && s.pending.length > 0) {
    getStore(s).then(({ store, size }) => {
      const encoder = encoding.createEncoder()
      for (let i = 0; i < s.pending.length; i++) {
        encoding.writeVarUint8Array(encoder, s.pending[i])
      }
      s.pending = []
      store.write(size, Buffer.from(encoding.toUint8Array(encoder)), err => {
        if (err) {
          log('Unexpected Write-Error could destroy document integrity: ' + err)
        }
        store.close()
        s.activeWrite = false
        _writeData(s) // try to write more pending data
      })
    })
  }
}

/**
 * @param {DatStorage} s
 * @param {Uint8Array} data
 */
const appendData = (s, data) => {
  if (s.persist) {
    s.pending.push(data)
    _writeData(s)
  }
}

/**
 * @param {DatStorage} s
 * @return {Promise<Array<Uint8Array>>}
 */
const readAll = s => getStore(s).then(({ store, size }) => promise.create((resolve, reject) => {
  if (!store.readable || size === 0) return resolve([])
  store.read(0, size, (err, data) => {
    if (err) {
      log('Was not able to read initial data from dat storage. Error: ' + err)
      reject(err)
    } else {
      const dec = decoding.createDecoder(data)
      const res = []
      while (decoding.hasContent(dec)) {
        res.push(decoding.readVarUint8Array(dec))
      }
      resolve(res)
    }
  })
}))

export class DatProvider extends Observable {
  /**
   * @param {Uint8Array|string|null} key
   * @param {Y.Doc} doc
   * @param {object} [opts]
   * @param {awarenessProtocol.Awareness} [opts.awareness]
   * @param {any} [opts.Hypercore] Hypercore constructor, created by the dat-sdk
   * @param {object} [opts.hypercoreOpts] Custom hypercore options - https://github.com/mafintosh/hypercore#api
   * @param {any} [opts.storage] Dat storage provider
   * @param {boolean} [opts.persist] Whether to persist the data
   */
  constructor (key, doc, { awareness = new awarenessProtocol.Awareness(doc), Hypercore = getHypercoreConstructor(), hypercoreOpts = {}, storage = universalStorage, persist = true } = {}) {
    super()
    const feed = Hypercore(key, {
      valueEncoding: 'binary',
      extensions: ['y-dat'],
      sparse: true,
      persist: false,
      ...hypercoreOpts,
      storage: ram
    })
    this.ram = ram
    this.feed = feed
    this.key = feed.key
    this.storage = storage
    this.dstore = new DatStorage(storage, feed.key, persist)
    this.doc = doc
    this.awareness = awareness
    this.syncedPeers = new Set()
    this.isSynced = false
    readAll(this.dstore).then(updates => {
      Y.transact(doc, () => {
        for (let i = 0; i < updates.length; i++) {
          Y.applyUpdate(doc, updates[i])
        }
      }, this.dstore, false)
      this.emit('loaded', [{ provider: this, doc }])
    })
    this._docUpdateHandler = (update, origin) => {
      if (origin !== this) {
        const encoder = encoding.createEncoder()
        encoding.writeVarUint(encoder, messageSync)
        syncProtocol.writeUpdate(encoder, update)
        const updateMessage = Buffer.from(encoding.toUint8Array(encoder))
        feed.extension('y-dat', updateMessage)
      }
      if (origin !== this.dstore) {
        appendData(this.dstore, update)
      }
    }
    doc.on('update', this._docUpdateHandler)
    this._extensionHandler = (name, message, peer) => {
      if (name !== 'y-dat') {
        return
      }
      const decoder = decoding.createDecoder(message)
      const encoder = encoding.createEncoder()
      const messageType = decoding.readVarUint(decoder)
      let sendReply = false
      switch (messageType) {
        case messageSync: {
          encoding.writeVarUint(encoder, messageSync)
          const syncMessageType = syncProtocol.readSyncMessage(decoder, encoder, doc, this)
          if (syncMessageType === syncProtocol.messageYjsSyncStep2) {
            this.syncedPeers.add(peer)
            checkIsSynced(this)
          }
          if (syncMessageType === syncProtocol.messageYjsSyncStep1) {
            sendReply = true
          }
          break
        }
        case messageQueryAwareness:
          encoding.writeVarUint(encoder, messageAwareness)
          encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(awareness, Array.from(awareness.getStates().keys())))
          sendReply = true
          break
        case messageAwareness:
          awarenessProtocol.applyAwarenessUpdate(awareness, decoding.readVarUint8Array(decoder), this)
          break
        default:
          console.error('Unable to compute message')
          return encoder
      }
      if (sendReply) {
        peer.extension('y-dat', Buffer.from(encoding.toUint8Array(encoder)))
      }
    }
    feed.on('extension', this._extensionHandler)
    this._awarenessChangeHandler = ({ added, updated, removed }) => {
      const changedClients = added.concat(updated).concat(removed)
      const encoderAwareness = encoding.createEncoder()
      encoding.writeVarUint(encoderAwareness, messageAwareness)
      encoding.writeVarUint8Array(encoderAwareness, awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients))
      feed.extension('y-dat', Buffer.from(encoding.toUint8Array(encoderAwareness)))
    }
    awareness.on('update', this._awarenessChangeHandler)
    this._syncPeerHandler = peer => {
      const encoder = encoding.createEncoder()
      encoding.writeVarUint(encoder, messageSync)
      syncProtocol.writeSyncStep1(encoder, doc)
      peer.extension('y-dat', Buffer.from(encoding.toUint8Array(encoder)))
      const awarenessStates = awareness.getStates()
      if (awarenessStates.size > 0) {
        const encoder = encoding.createEncoder()
        encoding.writeVarUint(encoder, messageAwareness)
        encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(awareness, Array.from(awarenessStates.keys())))
        peer.extension('y-dat', Buffer.from(encoding.toUint8Array(encoder)))
      }
    }
    // @ts-ignore
    feed.on('peer-add', this._syncPeerHandler)
    feed.peers.forEach(this._syncPeerHandler)
    this._removePeerHandler = peer => {
      this.syncedPeers.delete(peer)
    }
    // @ts-ignore
    feed.on('peer-remove', this._removePeerHandler)
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        awarenessProtocol.removeAwarenessStates(this.awareness, [doc.clientID], 'window unload')
      })
    }
  }

  destroy () {
    this._destroyed = true
    this.syncedPeers = null
    this.doc.off('update', this._docUpdateHandler)
    this.awareness.off('update', this._awarenessChangeHandler)
    // @ts-ignore
    this.feed.off('peer-add', this._syncPeerHandler)
    // @ts-ignore
    this.feed.off('peer-remove', this._removePeerHandler)
    this.feed.off('extension', this._extensionHandler)
  }
}
