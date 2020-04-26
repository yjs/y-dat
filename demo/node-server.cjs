
const Y = require('yjs')
// @ts-ignore
const { DatProvider } = require('../dist/y-dat.cjs')
// @ts-ignore
const env = require('lib0/dist/environment.cjs')

const ydoc = new Y.Doc()
// Create new Archive if no key is specified.
// • In node, specify the "key" parameter: `node index.js --key 7b0d584fcdaf1de2e8c473393a31f52327793931e03b330f7393025146dc02fb`
const givenDatKey = env.getParam('--key', null)

const provider = new DatProvider(givenDatKey, ydoc)

const ytext = ydoc.getText('quill')

ytext.observe(() => {
  console.log(`ytext updated: "${ytext.toString()}"`)
})

provider.on('loaded', () => {
  console.log('Loaded document from dat-storage!')
})

provider.on('synced', () => {
  console.log('Synced document with all available peers!')
})

const skey = provider.feed.key.toString('hex')
console.log(`Collaborating on ${skey} ${givenDatKey === null ? '(generated)' : '(from parameter)'}`)

// Write some content after joining
ytext.insert(0, 'Hello World!\n')
