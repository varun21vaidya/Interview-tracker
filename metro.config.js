const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite on web loads a .wasm module; Metro must treat it as an asset.
config.resolver.assetExts.push('wasm');

// wa-sqlite uses SharedArrayBuffer, which needs cross-origin isolation in the dev server.
config.server.enhanceMiddleware = middleware => (req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  middleware(req, res, next);
};

module.exports = config;
