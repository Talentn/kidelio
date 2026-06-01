const { createProxyMiddleware } = require("http-proxy-middleware");

/**
 * Dev proxy: browser talks only to localhost:3001 (web).
 * All API, session cookies, and product images go through Rails on :3000.
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
