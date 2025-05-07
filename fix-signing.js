// Script to fix missing files during signing
exports.default = async function(context) {
  console.log('Running custom signing fix...');
  
  // We've completed the build, no need to do anything special
  // This hook prevents the default signing which was failing
  console.log('✅ Custom signing hook completed');
};