function readPackage(pkg) {
  // Allow esbuild to run its install script
  return pkg
}

module.exports = {
  hooks: {
    readPackage
  }
}
