#!/usr/bin/env node
/**
 * Meteoblick Patch Script
 *
 * Restores files that `expo prebuild` overwrites (or removes) but
 * that live in `ios/` (which is gitignored, so the repo can't store
 * them). Runs as a `postprebuild` hook in package.json.
 *
 * Restored files:
 *   - ios/ExpoWidgetsTarget/MeteoblickWidget.swift
 *       → plugins/widget-custom/MeteoblickWidget.template.swift
 *   - ios/ExportOptions.plist
 *       → plugins/widget-custom/ExportOptions.plist
 *
 * Usage:
 *   node plugins/widget-custom/patch.js
 *   pnpm postprebuild   (or run `expo prebuild` which fires postprebuild)
 */
const fs = require('fs');
const path = require('path');

const FILES = [
  {
    template: 'MeteoblickWidget.template.swift',
    target: 'ExpoWidgetsTarget/MeteoblickWidget.swift',
  },
  {
    template: 'ExportOptions.plist',
    target: 'ExportOptions.plist',
  },
];

const IOS_DIR = path.join(__dirname, '..', '..', 'ios');

for (const { template, target } of FILES) {
  const templatePath = path.join(__dirname, template);
  const targetPath = path.join(IOS_DIR, target);

  if (!fs.existsSync(templatePath)) {
    console.error(`✗ Template not found: ${templatePath}`);
    process.exit(1);
  }
  if (!fs.existsSync(targetPath)) {
    console.error(`✗ Target not found: ${targetPath} — did you run 'expo prebuild' first?`);
    process.exit(1);
  }

  const source = fs.readFileSync(templatePath, 'utf8');
  const existing = fs.readFileSync(targetPath, 'utf8');

  if (existing === source) {
    console.log(`✓ ${target} is up to date`);
    continue;
  }

  fs.writeFileSync(targetPath, source);
  console.log(
    `✓ Patched ${target} (${existing.length} → ${source.length} bytes)`,
  );
}
