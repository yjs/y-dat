const path = require('path')

module.exports = [{
  mode: 'development',
  devtool: 'source-map',
  entry: {
    demo: './demo/index.js'
  },
  target: 'web',
  output: {
    globalObject: 'self',
    path: path.resolve(__dirname, './dist/'),
    filename: '[name].js',
    publicPath: '/dist/'
  },
  resolve: {
    alias: {
      fs: 'graceful-fs',
      'y-dat': '../src/y-dat.js'
    }
  },
  devServer: {
    contentBase: path.join(__dirname),
    compress: true,
    publicPath: '/dist/'
  }
}]
