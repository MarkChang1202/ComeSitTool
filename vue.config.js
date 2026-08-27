// place it with same level of package.json
// vue.config.js 設定指南 : https://cli.vuejs.org/zh/config/#%E5%85%A8%E5%B1%80-cli-%E9%85%8D%E7%BD%AE
module.exports = {
  // publicPath 為 project-name，根目錄地址為上傳的網域
  publicPath: process.env.VERCEL ? "/" : "/ComeSitTool/",

  // 全局SCSS設定
  css: {
    loaderOptions: {
      scss: {
        // 全局引入RWD工具類
        prependData: `@import "@/assets/styles/rwd.scss";`,
      },
    },
  },

  devServer: {
    proxy: {
      "/ttlock-api": {
        target: "https://euapi.ttlock.com",
        changeOrigin: true,
        pathRewrite: { "^/ttlock-api": "" },
      },
    },
  },
};
