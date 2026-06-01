const { createProxyMiddleware } = require("http-proxy-middleware");

/**
 * Dev proxy: admin UI on :3002 → same Rails API & cookies as storefront.
 */
module.exports = function (app) {
  const rails = createProxyMiddleware({
    target: "http://127.0.0.1:3000",
    changeOrigin: true,
    cookieDomainRewrite: "localhost",
    ws: true,
  });

  app.use("/api", rails);
  app.use("/rails", rails);
  app.use("/health", rails);
};
