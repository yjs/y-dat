/* eslint-env browser */

import * as Y from 'yjs'
// @ts-ignore
import { DatProvider } from 'y-dat'
import { QuillBinding } from 'y-quill'
import Quill from 'quill'
import QuillCursors from 'quill-cursors'
import * as env from 'lib0/environment.js'

const ydoc = new Y.Doc()
// Create new Archive if no key is specified.
// This script runs in node and in the browser:
// • In node, specify the "key" parameter: `node index.js --key 7b0d584fcdaf1de2e8c473393a31f52327793931e03b330f7393025146dc02fb`
// • In the browser, specify the parameter in the url as the location.hash: "localhost:8080#7b0d584fcdaf1de2e8c473393a31f52327793931e03b330f7393025146dc02fb"
const givenDatKey = /** @type {any} */ (env.isBrowser ? (location.hash.length > 1 ? location.hash.slice(1) : null) : env.getParam('--key', null))

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

if (env.isBrowser) {
  Quill.register('modules/cursors', QuillCursors)
  location.hash = '#' + skey

  const editorContainer = document.createElement('div')
  editorContainer.setAttribute('id', 'editor')
  document.body.insertBefore(editorContainer, null)

  var editor = new Quill(editorContainer, {
    modules: {
      cursors: true,
      toolbar: [
        [{ header: [1, 2, false] }],
        ['bold', 'italic', 'underline'],
        ['image', 'code-block']
      ],
      history: {
        userOnly: true
      }
    },
    placeholder: 'Start collaborating...',
    theme: 'snow' // or 'bubble'
  })

  const binding = new QuillBinding(ytext, editor, provider.awareness)
  // @ts-ignore
  window.example = { provider, ydoc, ytext, givenDatKey, binding }
}
