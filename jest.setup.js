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

// Mock expo-crypto — deterministic SHA-256 stub for tests
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  CryptoEncoding: { HEX: 'hex', BASE64: 'base64' },
  digestStringAsync: jest.fn(async (_algo, data) => {
    // Minimal FNV-1a-ish stub: produce a stable 64-char hex string from input.
    // Not a real SHA-256 — just a deterministic marker for assertions.
    let h1 = 0x811c9dc5;
    let h2 = 0xdeadbeef;
    for (let i = 0; i < data.length; i++) {
      h1 ^= data.charCodeAt(i);
      h1 = Math.imul(h1, 0x01000193) >>> 0;
      h2 = ((h2 << 5) + h2 + data.charCodeAt(i)) >>> 0;
    }
    const hex = (n, len) => n.toString(16).padStart(len, '0');
    return (hex(h1, 8) + hex(h2, 8)).repeat(4);
  }),
}));

// Mock expo-constants — return empty extra; tests that need a specific
// API_BASE_URL should override via jest.mock('../../constants', ...)
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: { extra: {} },
  },
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
