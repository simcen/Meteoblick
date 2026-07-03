// Jest setup file

// Define global __DEV__
global.__DEV__ = true;

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock react-native-shared-group-preferences
jest.mock('react-native-shared-group-preferences', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

// Mock expo-widgets
jest.mock('expo-widgets', () => ({
  createWidget: jest.fn((name, component) => ({
    updateSnapshot: jest.fn(),
    reload: jest.fn(),
  })),
}));

// Silence console logs in tests (optional)
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
