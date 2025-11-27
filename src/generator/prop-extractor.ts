/**
 * Dynamic Props Extractor
 * Transforms hardcoded values in generated components into parameterized props
 * Week 2: Core feature for making components reusable
 */

import type { IRNode } from '../types/ir.js';

export interface PropDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'string[]';
  defaultValue?: string | number | boolean;
  optional: boolean;
  description?: string;
}

export interface ExtractedProps {
  props: PropDefinition[];
  interfaceName: string;
  interfaceCode: string;
  updatedCode: string;
  imports: string[];
}

export class PropExtractor {
  /**
   * Extract props from a generated component
   */
  extractFromCode(
    code: string,
    componentName: string,
    irNode?: IRNode
  ): ExtractedProps {
    const props: PropDefinition[] = [];
    let updatedCode = code;

    // 1. Extract text content
    const textProps = this.extractTextContent(code);
    props.push(...textProps);

    // 2. Extract image URLs
    const imageProps = this.extractImageUrls(code);
    props.push(...imageProps);

    // 3. Extract color values (from className)
    const colorProps = this.extractColors(code);
    props.push(...colorProps);

    // 4. Deduplicate props (same name)
    const uniqueProps = this.deduplicateProps(props);

    // 5. Generate TypeScript interface
    const interfaceName = `${componentName}Props`;
    const interfaceCode = this.generateInterface(interfaceName, uniqueProps);

    // 6. Replace hardcoded values with prop references
    updatedCode = this.replaceWithProps(code, uniqueProps);

    // 7. Add props parameter to component
    updatedCode = this.addPropsParameter(updatedCode, componentName, interfaceName);

    return {
      props: uniqueProps,
      interfaceName,
      interfaceCode,
      updatedCode,
      imports: [],
    };
  }

  /**
   * Extract text content from JSX
   */
  private extractTextContent(code: string): PropDefinition[] {
    const props: PropDefinition[] = [];

    // Match text between JSX tags: >text<
    const textMatches = code.matchAll(/>([^<>{}\n]+)</g);

    for (const match of textMatches) {
      const text = match[1]?.trim();

      // Skip empty strings, whitespace, or very short text
      if (!text || text.length < 2) continue;

      // Skip if it looks like a prop reference already
      if (text.includes('{') || text.includes('}')) continue;

      // Skip HTML entities
      if (text.includes('&')) continue;

      // Generate prop name from text
      const propName = this.generatePropName(text, 'text');

      props.push({
        name: propName,
        type: 'string',
        defaultValue: text,
        optional: false,
        description: `Text content: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`,
      });
    }

    return props;
  }

  /**
   * Extract image URLs from src attributes
   */
  private extractImageUrls(code: string): PropDefinition[] {
    const props: PropDefinition[] = [];

    // Match src="..." or src='...'
    const srcMatches = code.matchAll(/src=["']([^"']+)["']/g);

    let imageIndex = 0;
    for (const match of srcMatches) {
      const url = match[1];

      // Skip if no URL or data URLs (inline images)
      if (!url || url.startsWith('data:')) continue;

      const propName = `imageUrl${imageIndex > 0 ? imageIndex + 1 : ''}`;
      imageIndex++;

      props.push({
        name: propName,
        type: 'string',
        defaultValue: url,
        optional: true,
        description: 'Image URL',
      });
    }

    return props;
  }

  /**
   * Extract color values from Tailwind classes
   */
  private extractColors(code: string): PropDefinition[] {
    const props: PropDefinition[] = [];

    // Match custom colors like bg-[#050706] or text-[rgba(...)]
    const customColorMatches = code.matchAll(/(?:bg|text|border)-\[(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))\]/g);

    const seenColors = new Set<string>();
    let colorIndex = 0;

    for (const match of customColorMatches) {
      const color = match[1];

      // Skip if no color or if we've seen this color before
      if (!color || seenColors.has(color)) continue;
      seenColors.add(color);

      const propName = `color${colorIndex > 0 ? colorIndex + 1 : ''}`;
      colorIndex++;

      props.push({
        name: propName,
        type: 'string',
        defaultValue: color,
        optional: true,
        description: `Color value: ${color}`,
      });
    }

    return props;
  }

  /**
   * Generate TypeScript interface from props
   */
  private generateInterface(interfaceName: string, props: PropDefinition[]): string {
    if (props.length === 0) {
      return `interface ${interfaceName} {}\n`;
    }

    const propLines = props.map((prop) => {
      const optional = prop.optional ? '?' : '';
      const defaultComment = prop.defaultValue !== undefined
        ? ` // Default: ${JSON.stringify(prop.defaultValue)}`
        : '';

      return `  ${prop.name}${optional}: ${prop.type};${defaultComment}`;
    });

    return `interface ${interfaceName} {\n${propLines.join('\n')}\n}\n`;
  }

  /**
   * Replace hardcoded values with prop references
   */
  private replaceWithProps(code: string, props: PropDefinition[]): string {
    let updatedCode = code;

    for (const prop of props) {
      if (prop.defaultValue === undefined) continue;

      const value = prop.defaultValue;
      const propRef = `{props.${prop.name}}`;

      if (prop.type === 'string') {
        const stringValue = value as string;

        // Escape special regex characters
        const escapedValue = stringValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        // Handle colors in className attributes: className="bg-[#eff1ee]" → className={`bg-[${props.color}]`}
        if (prop.name.startsWith('color')) {
          // Match className="..." containing the color
          const classNameRegex = new RegExp(
            `className="([^"]*)((?:bg|text|border)-\\[)${escapedValue}(\\])([^"]*)"`,
            'g'
          );
          updatedCode = updatedCode.replace(
            classNameRegex,
            (match, before, prefix, _, after) => {
              return `className={\`${before}${prefix}\${props.${prop.name}]}${after}\`}`;
            }
          );
        }
        // Replace text content: >text< → >{props.text}<
        else {
          const textRegex = new RegExp(`>\\s*${escapedValue}\\s*<`, 'g');
          updatedCode = updatedCode.replace(textRegex, `>${propRef}<`);

          // Replace in attributes: src="url" → src={props.imageUrl}
          if (prop.name.includes('image')) {
            const attrRegex = new RegExp(`src=["']${escapedValue}["']`, 'g');
            updatedCode = updatedCode.replace(attrRegex, `src=${propRef}`);
          }
        }
      }
    }

    return updatedCode;
  }

  /**
   * Add props parameter to component function
   */
  private addPropsParameter(
    code: string,
    componentName: string,
    interfaceName: string
  ): string {
    // Match ANY component: const AnyName: React.FC = () => {
    // This handles cases where component name differs from filename
    const fcPattern = /(const\s+\w+:\s*React\.FC)\s*=\s*\(\)\s*=>/g;

    // Replace with: const AnyName: React.FC<Props> = (props) => {
    const updatedCode = code.replace(
      fcPattern,
      `$1<${interfaceName}> = (props)`
    );

    return updatedCode;
  }

  /**
   * Generate a prop name from text content
   */
  private generatePropName(text: string, prefix: string = ''): string {
    // Take first few words
    const words = text
      .split(/\s+/)
      .slice(0, 3)
      .map((word) => word.replace(/[^a-zA-Z0-9]/g, ''))
      .filter((word) => word.length > 0);

    if (words.length === 0) {
      return prefix || 'text';
    }

    // Convert to camelCase
    const propName = words
      .map((word, index) => {
        if (index === 0) {
          return word.toLowerCase();
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join('');

    return prefix ? `${prefix}${propName.charAt(0).toUpperCase()}${propName.slice(1)}` : propName;
  }

  /**
   * Deduplicate props with the same name
   */
  private deduplicateProps(props: PropDefinition[]): PropDefinition[] {
    const seen = new Map<string, PropDefinition>();

    for (const prop of props) {
      if (!seen.has(prop.name)) {
        seen.set(prop.name, prop);
      }
    }

    return Array.from(seen.values());
  }

  /**
   * Extract props from IR node (alternative approach using semantic data)
   */
  extractFromIRNode(node: IRNode, componentName: string): ExtractedProps {
    const props: PropDefinition[] = [];

    // Extract text from node
    if (node.textContent) {
      props.push({
        name: this.generatePropName(node.textContent),
        type: 'string',
        defaultValue: node.textContent,
        optional: false,
        description: `Text content from Figma`,
      });
    }

    // Extract fills (colors)
    if (node.styles?.fills && node.styles.fills.length > 0) {
      const fill = node.styles.fills[0];
      if (fill.type === 'SOLID' && fill.color) {
        const { r, g, b, a = 1 } = fill.color;
        const rgba = `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a})`;

        props.push({
          name: 'backgroundColor',
          type: 'string',
          defaultValue: rgba,
          optional: true,
          description: 'Background color from Figma',
        });
      }
    }

    const interfaceName = `${componentName}Props`;
    const interfaceCode = this.generateInterface(interfaceName, props);

    return {
      props,
      interfaceName,
      interfaceCode,
      updatedCode: '', // Not applicable for IR-based extraction
      imports: [],
    };
  }
}
