console.log("--- CRACO CONFIG LOADED ---");
const path = require('path');

module.exports = {
  webpack: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared')
    },
    configure: (webpackConfig, { env, paths }) => {
    
      const moduleScopePlugin = webpackConfig.resolve.plugins.find(
        plugin => plugin.constructor.name === 'ModuleScopePlugin'
      );

      if (moduleScopePlugin) {
        const sharedPath = path.resolve(__dirname, '../shared');
        moduleScopePlugin.appSrcs.push(sharedPath);
      } else {
        console.warn("Craco: Could not find ModuleScopePlugin to modify.");
      }

      
      const sharedPathForBabel = path.resolve(__dirname, '../shared');
      webpackConfig.module.rules.forEach(rule => {
        if (rule.oneOf) {
          rule.oneOf.forEach(oneOfRule => {
            if (oneOfRule.loader && oneOfRule.loader.includes('babel-loader')) {
              if (oneOfRule.include) { 
                if (Array.isArray(oneOfRule.include)) {
                  oneOfRule.include.push(sharedPathForBabel);
                } else {
                  oneOfRule.include = [oneOfRule.include, sharedPathForBabel];
                }
              } else {
                oneOfRule.include = [paths.appSrc, sharedPathForBabel];
              }
            }
          });
        }
      });

      return webpackConfig;
    }
  }
};