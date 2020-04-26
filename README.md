# Dat connector for [Yjs](https://github.com/yjs/yjs)

> Propagates document updates using the Dat protocol. WIP - not all details have been worked out yet.

* Uses hypercore data channels to exchange document updates and awareness information
* Supports multiple users manipulating same date
* Access is granted if the client knows about the public key ("dat key")
* Currently, does *not* sign document updates using the private key.
* Supports dat-storage to persist data
* Works in node and the browser (uses [dat-sdk](https://github.com/datproject/sdk) internally)

## Approach

The initial idea was to implement [Dat Multiwriter](https://www.datprotocol.com/deps/0008-multiwriter/). Internally, Yjs already maintains data in several append-only logs. But compared to Dat Hypercores, Yjs does optimizations on the append-only logs and even supports truncating the logs if "garbage collection" is enabled. Since history doesn't work anymore in a Dat Multiwriter (without keeping track of even more information), y-dat implements a custom storage and syncing mechanism. History management can still be implemented using [Yjs state vectors](https://github.com/yjs/yjs#State-Vector). y-dat does not use the Hypercore concept, but it uses many other concepts from the Dat ecosystem, including swarms, the noise protocol, dat storage, and will support signing of data in the future.

Yjs awareness information and document updates are shared using Hypercores data-channel functionality (a method to communicate to available peers). Connected peers perform a [two-way handshake](https://github.com/yjs/yjs#example-sync-two-clients-by-computing-the-differences) in order to sync and propagate all document updates to all connected peers. This is the same approach that is implemented by [y-webrtc](https://github.com/yjs/y-webrtc), but using technologies from the Dat ecosystem. The document updates can be persisted using Dat storage providers.

This allows multiple users to manipulate the same data if they have the same public key. In the future, we also want to sign document updates using the private key.

## Setup

### Install

```sh
npm i y-dat
```

### Client code

```js
import * as Y from 'yjs'
// @ts-ignore
import { DatProvider } from 'y-dat'

const ydoc = new Y.Doc()
const givenDatKey = null // '7b0d584fcdaf1de2e8c473393a31f52327793931e03b330f7393025146dc02fb'

const provider = new DatProvider(givenDatKey, ydoc)

const yarray = ydoc.getArray('my-shared-array')

provider.on('loaded', () => {
  console.log('Loaded document from dat-storage!')
})

provider.on('synced', () => {
  console.log('Synced document with all available peers!')
})
```

Alternatively use an existing Hypercore constructor:

```js
import SDK from 'dat-sdk'

const { Hypercore } = SDK()

const provider = new DatProvider(givenDatKey, ydoc, { Hypercore })
```

### Demos

You can find a working demos in `y-dat/demo/`. Clone this repository and run `npm install && npm start`.

The demo also works in nodejs. Run `node y-dat/demo/node-server.cjs --key 7b0d584fcdaf1de2e8c473393a31f52327793931e03b330f7393025146dc02fb` to listen to updates for a given key. Run `node y-dat/demo/node-server.cjs` to generate a new key.

## API

```js
new DatProvider(roomName, ydoc[, opts])
```

The following default values of `opts` can be overwritten:

```js
{
  // Specify an existing Awareness instance - see https://github.com/yjs/y-protocols
  awareness: new awarenessProtocol.Awareness(doc),
  // Hypercore constructor, created by dat-sdk
  Hypercore: SDK().Hypercore
  // Custom hypercore options. See https://github.com/mafintosh/hypercore#api
  hypercoreOpts: {},
  // Dat storage provider
  storage: require('random-access-memory'),
  // whether to persist data in the storage provider
  persist: true
}
```

## Logging

`y-dat` uses the `lib0/logging.js` logging library. By default this library disables logging. You can enable it by specifying the `log` environment / localStorage variable:

```js
// enable logging for all modules
localStorage.log = 'true'
// enable logging only for y-dat
localStorage.log = 'y-dat'
// by specifying a regex variables
localStorage.log = '^y.*'
```

```sh
# enable y-dat logging in nodejs
LOG='y-dat' node index.js
```

## License
y-dat is licensed under the [MIT License](./LICENSE).

<kevin.jahns@pm.me>
