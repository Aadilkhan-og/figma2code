/**
 * Test PropExtractor on existing generated code
 * Usage: npx tsx test-propextractor.ts <jobId>
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { PropExtractor } from './src/generator/prop-extractor.js';

const jobId = process.argv[2] || 'J_5mFz-IsH5e';
const outputDir = join('jobs', jobId, 'output');
const pagePath = join(outputDir, 'src', 'pages', 'GeneratedPage.tsx');

console.log('🧪 Testing PropExtractor on existing code...');
console.log(`📁 Job: ${jobId}`);
console.log(`📄 File: ${pagePath}\n`);

try {
  // Read the generated code
  const originalCode = readFileSync(pagePath, 'utf-8');
  console.log('✅ Read original code');

  // Extract props using NEW PropExtractor
  const extractor = new PropExtractor();
  const result = extractor.extractFromCode(originalCode, 'GeneratedPage');

  console.log('\n📊 Extraction Results:');
  console.log(`   Props found: ${result.props.length}`);
  result.props.forEach(prop => {
    console.log(`   - ${prop.name}: ${prop.type} = ${JSON.stringify(prop.defaultValue)}`);
  });

  // Build final code with interface
  const finalCode = `${result.interfaceCode}\n${result.updatedCode}`;

  // Write back to file
  writeFileSync(pagePath, finalCode, 'utf-8');
  console.log('\n✅ Updated code written back to file');

  console.log('\n🔍 Check the differences:');
  console.log('   1. Props parameter added to component');
  console.log('   2. Hardcoded values replaced with {props.propName}');
  console.log('   3. Colors use template literals: className={`bg-[${props.color}]`}');

  console.log('\n🏗️  Now run the build:');
  console.log(`   cd jobs/${jobId}/output`);
  console.log('   npm run build');

} catch (error) {
  console.error('❌ Error:', error instanceof Error ? error.message : error);
  process.exit(1);
}
