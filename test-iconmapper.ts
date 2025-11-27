/**
 * Test script for IconMapper
 *
 * This tests that icon nodes are properly mapped to lucide-react icons
 */

import { IconMapper } from './src/generator/icon-mapper.js';
import type { IRNode } from './src/types/ir.js';

// Create mock icon nodes
const mockIconNodes: IRNode[] = [
  {
    id: 'icon-1',
    name: 'home-icon',
    type: 'component',
    componentType: 'ICON',
    boundingBox: { x: 0, y: 0, width: 24, height: 24, rotation: 0 },
    styles: {},
  },
  {
    id: 'icon-2',
    name: 'icon/search',
    type: 'component',
    componentType: 'ICON',
    boundingBox: { x: 0, y: 0, width: 24, height: 24, rotation: 0 },
    styles: {},
  },
  {
    id: 'icon-3',
    name: 'menu',
    type: 'component',
    componentType: 'ICON',
    boundingBox: { x: 0, y: 0, width: 24, height: 24, rotation: 0 },
    styles: {},
  },
  {
    id: 'icon-4',
    name: 'user-profile',
    type: 'component',
    componentType: 'ICON',
    boundingBox: { x: 0, y: 0, width: 24, height: 24, rotation: 0 },
    styles: {},
  },
  {
    id: 'icon-5',
    name: 'trash',
    type: 'component',
    componentType: 'ICON',
    boundingBox: { x: 0, y: 0, width: 24, height: 24, rotation: 0 },
    styles: {},
  },
];

console.log('🧪 Testing IconMapper\n');

const mapper = new IconMapper();

mockIconNodes.forEach((node) => {
  const mappedIcon = mapper.mapIcon(node);
  console.log(`✓ "${node.name}" → ${mappedIcon}`);

  // Update the node to simulate what happens in the generator
  if (mappedIcon) {
    node.iconName = mappedIcon;
  }
});

console.log('\n✅ IconMapper test complete!\n');

// Test tree mapping
console.log('🧪 Testing tree mapping\n');

const mockTree: IRNode = {
  id: 'root',
  name: 'Root',
  type: 'container',
  componentType: 'CONTAINER',
  boundingBox: { x: 0, y: 0, width: 100, height: 100, rotation: 0 },
  styles: {},
  children: mockIconNodes,
};

mapper.mapIconsInTree(mockTree);

console.log('Tree after mapping:');
mockTree.children?.forEach((node) => {
  if (node.componentType === 'ICON') {
    console.log(`  ${node.name}: iconName = ${node.iconName}`);
  }
});

console.log('\n✅ Tree mapping test complete!');
