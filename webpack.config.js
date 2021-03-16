const path = require("path");
const webpack = require("webpack");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");

const DEV_MODE = process.env["DEV_MODE"] === "1";
if (DEV_MODE) {
  console.info("Building in development mode");
} else {
  console.info("Building in production mode");
}
const DEV_MODE_REPLACEMENT_STR = "__DEV_MODE__";
const BUNDLE_OUTDIR = "./dist";
const SRC_ROOT = "./src";
const BUNDLE_DEV_SERVER_CONTENTBASE = "./dist-dev-server";

module.exports = {
  mode: DEV_MODE ? "development" : "production",
  entry: `${SRC_ROOT}/index.ts`,
  output: {
    path: path.resolve(__dirname, BUNDLE_OUTDIR),
    filename: "[name].js",
  },
  plugins: [
    new webpack.DefinePlugin({
      [DEV_MODE_REPLACEMENT_STR]: DEV_MODE,
    }),
    new CleanWebpackPlugin({ cleanStaleWebpackAssets: false }),
    new HtmlWebpackPlugin({ title: "Web Framework", template: `${SRC_ROOT}/index.html` }),
  ],
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: {
          loader: "ts-loader",
        },
      },
    ],
  },
  resolve: {
    extensions: [".ts", ".js"],
    modules: [path.resolve(__dirname, "src"), "node_modules"],
    alias: {
      "~": SRC_ROOT,
    },
  },
  /* devtool: (() => {
   *   return !DEV_MODE
   *     ? "" // 'hidden-source-map'
   *     : "source-map";
   * })(), */
  devServer: {
    contentBase: BUNDLE_DEV_SERVER_CONTENTBASE,
    publicPath: "",
    port: 4000,
    overlay: {
      warnings: true,
      errors: true,
    },
  },
  optimization: {
    moduleIds: "deterministic",
  },
};
