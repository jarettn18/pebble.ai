module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // react-native-worklets/plugin is the Reanimated v4 worklets plugin and MUST be last.
    plugins: ["react-native-worklets/plugin"],
  };
};
