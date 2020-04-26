import ignoreImport from 'rollup-plugin-ignore-import'

// If truthy, it expects all y-* dependencies in the upper directory.
// This is only necessary if you want to test and make changes to several repositories.
const localImports = process.env.LOCALIMPORTS

if (localImports) {
  console.info('Using local imports')
}

const external = id => /^(lib0|yjs|y-protocols|simple-peer|random-access-memory|dat-sdk|universal-dat-storage|buffer)/.test(id)

export default [
  {
    input: './demo/index.js',
    external: id => true,
    output: [{
      name: 'test',
      file: 'dist/demo.cjs',
      format: 'cjs',
      sourcemap: true,
      paths: path => {
        if (/^lib0\//.test(path)) {
          return `lib0/dist${path.slice(4, -3)}.cjs`
        } else if (/^y-protocols\//.test(path)) {
          return `y-protocols/dist${path.slice(11, -3)}.cjs`
        } else if (/^y-dat/.test(path)) {
          return './y-dat.cjs'
        }
        return path
      }
    }],
    plugins: [
      ignoreImport({
        // Ignore all .scss and .css file imports while building the bundle
        extensions: ['quill', 'quill-cursors'],
        // Optional: replace body for ignored files. Default value is "export default undefined;"
        body: 'export default undefined;'
      })
    ]
  }, {
    input: './src/y-dat.js',
    external,
    output: [{
      name: 'y-dat',
      file: 'dist/y-dat.cjs',
      format: 'cjs',
      sourcemap: true,
      paths: path => {
        if (/^lib0\//.test(path)) {
          return `lib0/dist${path.slice(4, -3)}.cjs`
        } else if (/^y-protocols\//.test(path)) {
          return `y-protocols/dist${path.slice(11, -3)}.cjs`
        }
        return path
      }
    }]
  }
]
