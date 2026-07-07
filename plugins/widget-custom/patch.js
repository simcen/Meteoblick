#!/usr/bin/env node
/**
 * Meteoblick Widget Swift Patch Script
 *
 * The expo-widgets plugin overwrites ios/ExpoWidgetsTarget/MeteoblickWidget.swift
 * with a minimal template during `expo prebuild`. This script patches it
 * back to our custom version (with Loxone auth + backend timeline fetch).
 *
 * Usage:
 *   node plugins/widget-custom/patch.js
 *
 * Or wire it up as a post-prebuild hook in package.json:
 *   "scripts": { "postprebuild": "node plugins/widget-custom/patch.js" }
 *
 * Or run manually after `expo prebuild`:
 *   expo prebuild && node plugins/widget-custom/patch.js
 */
const fs = require('fs');
const path = require('path');

const TEMPLATE = path.join(__dirname, 'MeteoblickWidget.template.swift');
const TARGET = path.join(__dirname, '..', '..', 'ios', 'ExpoWidgetsTarget', 'MeteoblickWidget.swift');

if (!fs.existsSync(TEMPLATE)) {
  console.error(`✗ Template not found: ${TEMPLATE}`);
  process.exit(1);
}

if (!fs.existsSync(TARGET)) {
  console.error(`✗ Target not found: ${TARGET} — did you run 'expo prebuild' first?`);
  process.exit(1);
}

const source = fs.readFileSync(TEMPLATE, 'utf8');
const existing = fs.readFileSync(TARGET, 'utf8');

if (existing === source) {
  console.log('✓ MeteoblickWidget.swift is up to date');
  process.exit(0);
}

fs.writeFileSync(TARGET, source);
console.log(`✓ Patched MeteoblickWidget.swift (${existing.length} → ${source.length} bytes)`);
