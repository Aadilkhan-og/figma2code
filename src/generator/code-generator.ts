/**
 * React + TypeScript + TailwindCSS Code Generator
 * Generates deployable code from IR using OpenAI
 */

import OpenAI from 'openai';
import type { IRDocument, IRNode } from '../types/ir.js';
import type { GeneratedFile, GeneratedCodeBundle, AgentConfig } from '../types/agent.js';
import { TailwindGenerator } from './tailwind.js';
import { PropExtractor } from './prop-extractor.js';
import { IconMapper } from './icon-mapper.js';

export interface CodeGeneratorOptions {
  useOpenAI?: boolean;
  generateComponents?: boolean;
  generatePages?: boolean;
  componentLibrary?: 'custom' | 'shadcn' | 'radix';
  extractProps?: boolean; // Week 2: Enable prop extraction
}

export class CodeGenerator {
  private openai: OpenAI | null = null;
  private config: AgentConfig;
  private tailwind: TailwindGenerator;
  private propExtractor: PropExtractor;
  private iconMapper: IconMapper;
  private options: CodeGeneratorOptions;

  constructor(config: AgentConfig, options?: CodeGeneratorOptions) {
    this.config = config;
    this.options = options || { useOpenAI: true, generateComponents: true, generatePages: true, extractProps: true };
    this.tailwind = new TailwindGenerator();
    this.propExtractor = new PropExtractor();
    this.iconMapper = new IconMapper();

    if (this.options.useOpenAI && config.openaiApiKey) {
      this.openai = new OpenAI({ apiKey: config.openaiApiKey });
    }
  }

  /**
   * Generate complete code bundle from IR
   */
  async generate(ir: IRDocument): Promise<GeneratedCodeBundle> {
    const files: GeneratedFile[] = [];

    // Generate base UI components if using custom library
    if (this.options.generateComponents) {
      files.push(...this.generateBaseComponents());
    }

    // Generate main page/component from IR
    const mainComponent = await this.generateFromIR(ir);
    files.push(mainComponent);

    // Generate config files
    files.push(...this.generateConfigFiles());

    // Generate types
    files.push(this.generateTypes());

    return {
      files,
      entryPoint: mainComponent.path,
      dependencies: this.getDependencies(),
    };
  }

  /**
   * Generate component from IR using OpenAI or fallback
   */
  async generateFromIR(ir: IRDocument): Promise<GeneratedFile> {
    // Week 2: Map all icons in the IR tree to lucide-react icons
    this.iconMapper.mapIconsInTree(ir.root);

    let file: GeneratedFile;

    if (this.openai && this.options.useOpenAI) {
      file = await this.generateWithOpenAI(ir);
    } else {
      file = this.generateWithFallback(ir);
    }

    // Week 2: Apply prop extraction if enabled
    if (this.options.extractProps) {
      file = this.applyPropExtraction(file);
    }

    return file;
  }

  /**
   * Apply prop extraction to generated component
   * Week 2 feature: Transform hardcoded values into props
   */
  private applyPropExtraction(file: GeneratedFile): GeneratedFile {
    try {
      // Extract component name from file path
      const componentName = file.path
        .split('/')
        .pop()
        ?.replace(/\.tsx?$/, '') || 'Component';

      // Extract props from code
      const extracted = this.propExtractor.extractFromCode(
        file.content,
        componentName
      );

      // Build final content with interface + component
      const finalContent = `import React from 'react';\nimport { Button, Icon, Navbar, Card, Input } from '@/components/ui';\n\n${extracted.interfaceCode}\n${extracted.updatedCode}`;

      return {
        ...file,
        content: finalContent,
      };
    } catch (error) {
      // If prop extraction fails, return original file
      console.warn('Prop extraction failed:', error);
      return file;
    }
  }

  /**
   * Generate code using OpenAI
   */
  private async generateWithOpenAI(ir: IRDocument): Promise<GeneratedFile> {
    const prompt = this.buildPrompt(ir);

    const response = await this.openai!.chat.completions.create({
      model: this.config.openaiModel || 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: `You are an expert React + TypeScript + TailwindCSS developer. Generate clean, production-ready code from the provided UI intermediate representation (IR).

Rules:
1. Use functional components with TypeScript
2. Use TailwindCSS for all styling - no inline styles or CSS files
3. Make components responsive using Tailwind breakpoints
4. Use semantic HTML elements where appropriate
5. Include proper TypeScript types
6. Export components as default exports
7. Use the provided component library imports when available
8. Make the code match the design as closely as possible
9. Return ONLY the code, no explanations

Component imports available:
- Button, IconButton from '@/components/ui/Button'
- Input, Textarea from '@/components/ui/Input'
- Card from '@/components/ui/Card'
- Avatar, Badge, Tag from '@/components/ui/Display'
- Modal, Drawer from '@/components/ui/Modal'
- Icon from '@/components/ui/Icon'
- Navbar from '@/components/ui/Navbar'

IMPORTANT: Use exact import paths shown above. Do NOT create nested folder structures like '@/components/ui/icon/Icon'.`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content || '';

    // Extract code from markdown code blocks if present
    const codeMatch = content.match(/```(?:tsx?|jsx?|typescript|javascript)?\n([\s\S]*?)```/);
    const code = codeMatch ? codeMatch[1]! : content;

    return {
      path: 'src/pages/GeneratedPage.tsx',
      content: code.trim(),
      type: 'page',
    };
  }

  /**
   * Generate code using fallback template-based approach
   */
  private generateWithFallback(ir: IRDocument): GeneratedFile {
    const componentName = this.sanitizeName(ir.figmaFileName) || 'GeneratedPage';
    const code = this.generateComponentCode(ir.root, componentName);

    return {
      path: `src/pages/${componentName}.tsx`,
      content: code,
      type: 'page',
    };
  }

  /**
   * Build prompt for OpenAI
   */
  private buildPrompt(ir: IRDocument): string {
    const irSummary = this.summarizeIR(ir.root);

    return `Generate a React component based on this UI design:

File: ${ir.figmaFileName}
Canvas size: ${ir.canvas.width}x${ir.canvas.height}
Background: ${ir.canvas.backgroundColor || 'white'}

Component Tree:
${JSON.stringify(irSummary, null, 2)}

Design Tokens:
${JSON.stringify(ir.designTokens, null, 2)}

Generate a complete React + TypeScript component with TailwindCSS that matches this design.
The component should be responsive and production-ready.`;
  }

  /**
   * Summarize IR for prompt (reduce token count)
   */
  private summarizeIR(node: IRNode, depth = 0): object {
    return {
      name: node.name,
      type: node.componentType,
      component: node.mappedComponent,
      classes: this.tailwind.generateClasses(node).join(' '),
      text: node.textContent,
      children: node.children?.map(c => this.summarizeIR(c, depth + 1)),
    };
  }

  /**
   * Generate component code using templates
   */
  private generateComponentCode(node: IRNode, componentName: string): string {
    const imports = this.collectImports(node);
    const jsx = this.generateJSX(node, 0);

    return `import React from 'react';
${imports}

interface ${componentName}Props {
  className?: string;
}

export default function ${componentName}({ className }: ${componentName}Props) {
  return (
    <div className={\`\${className || ''}\`}>
      ${jsx}
    </div>
  );
}
`;
  }

  /**
   * Generate JSX from IR node
   */
  private generateJSX(node: IRNode, indent: number): string {
    const spaces = '  '.repeat(indent);
    const classes = this.tailwind.generateClasses(node).join(' ');
    const tag = this.getTag(node);

    // Handle text nodes
    if (node.type === 'text' && node.textContent) {
      if (tag === 'span' || tag === 'p') {
        return `${spaces}<${tag} className="${classes}">${this.escapeText(node.textContent)}</${tag}>`;
      }
      return `${spaces}<${tag} className="${classes}">${this.escapeText(node.textContent)}</${tag}>`;
    }

    // Handle image nodes
    if (node.componentType === 'IMAGE' || node.type === 'image') {
      return `${spaces}<img src="${node.imageUrl || '/placeholder.png'}" alt="${node.name}" className="${classes}" />`;
    }

    // Week 2: Handle icon nodes with lucide-react
    if (node.componentType === 'ICON' && node.iconName) {
      return `${spaces}<${node.iconName} className="${classes}" />`;
    }

    // Handle self-closing components
    if (this.isSelfClosing(node)) {
      return `${spaces}<${tag} className="${classes}" />`;
    }

    // Handle nodes with children
    if (node.children && node.children.length > 0) {
      const childrenJSX = node.children
        .map(child => this.generateJSX(child, indent + 1))
        .join('\n');
      return `${spaces}<${tag} className="${classes}">
${childrenJSX}
${spaces}</${tag}>`;
    }

    // Empty container
    return `${spaces}<${tag} className="${classes}" />`;
  }

  /**
   * Get HTML/React tag for node
   */
  private getTag(node: IRNode): string {
    const tagMap: Partial<Record<string, string>> = {
      NAVBAR: 'nav',
      SIDEBAR: 'aside',
      HEADER: 'header',
      FOOTER: 'footer',
      SECTION: 'section',
      HEADING: node.styles.typography?.fontSize && node.styles.typography.fontSize >= 24 ? 'h1' : 'h2',
      PARAGRAPH: 'p',
      TEXT: 'span',
      LABEL: 'label',
      IMAGE: 'img',
      LIST: 'ul',
      LIST_ITEM: 'li',
      DIVIDER: 'hr',
      BUTTON: 'button',
      LINK: 'a',
      INPUT: 'input',
      TEXTAREA: 'textarea',
    };

    if (node.mappedComponent) {
      // Check if it's a custom component
      if (node.mappedComponent.charAt(0) === node.mappedComponent.charAt(0).toUpperCase()) {
        return node.mappedComponent;
      }
    }

    return tagMap[node.componentType] || 'div';
  }

  /**
   * Check if node should be self-closing
   */
  private isSelfClosing(node: IRNode): boolean {
    const selfClosing = ['INPUT', 'IMAGE', 'DIVIDER', 'ICON', 'AVATAR', 'SPINNER', 'SKELETON'];
    return selfClosing.includes(node.componentType) || (node.type === 'image');
  }

  /**
   * Collect import statements needed
   */
  private collectImports(node: IRNode): string {
    const imports = new Set<string>();
    const customComponents = new Set<string>();
    const lucideIcons = new Set<string>();

    const traverse = (n: IRNode) => {
      if (n.mappedComponent) {
        const comp = n.mappedComponent;
        if (comp.charAt(0) === comp.charAt(0).toUpperCase() && !['React'].includes(comp)) {
          customComponents.add(comp);
        }
      }
      // Week 2: Collect lucide-react icons
      if (n.componentType === 'ICON' && n.iconName) {
        lucideIcons.add(n.iconName);
      }
      n.children?.forEach(traverse);
    };

    traverse(node);

    // Group imports by module
    const buttonComponents = ['Button', 'IconButton'];
    const inputComponents = ['Input', 'Textarea', 'Select', 'Checkbox', 'Radio', 'Switch', 'Slider'];
    const displayComponents = ['Avatar', 'Badge', 'Tag', 'Progress', 'Spinner', 'Skeleton'];
    const cardComponents = ['Card'];
    const modalComponents = ['Modal', 'Drawer'];

    const importLines: string[] = [];

    const buttonImports = [...customComponents].filter(c => buttonComponents.includes(c));
    if (buttonImports.length) {
      importLines.push(`import { ${buttonImports.join(', ')} } from '@/components/ui/Button';`);
    }

    const inputImports = [...customComponents].filter(c => inputComponents.includes(c));
    if (inputImports.length) {
      importLines.push(`import { ${inputImports.join(', ')} } from '@/components/ui/Input';`);
    }

    const displayImports = [...customComponents].filter(c => displayComponents.includes(c));
    if (displayImports.length) {
      importLines.push(`import { ${displayImports.join(', ')} } from '@/components/ui/Display';`);
    }

    const cardImports = [...customComponents].filter(c => cardComponents.includes(c));
    if (cardImports.length) {
      importLines.push(`import { ${cardImports.join(', ')} } from '@/components/ui/Card';`);
    }

    const modalImports = [...customComponents].filter(c => modalComponents.includes(c));
    if (modalImports.length) {
      importLines.push(`import { ${modalImports.join(', ')} } from '@/components/ui/Modal';`);
    }

    // Handle Icon and Navbar as default exports
    if (customComponents.has('Icon')) {
      importLines.push(`import Icon from '@/components/ui/Icon';`);
    }

    if (customComponents.has('Navbar')) {
      importLines.push(`import Navbar from '@/components/ui/Navbar';`);
    }

    // Week 2: Add lucide-react icon imports
    if (lucideIcons.size > 0) {
      const iconList = Array.from(lucideIcons).sort().join(', ');
      importLines.push(`import { ${iconList} } from 'lucide-react';`);
    }

    return importLines.join('\n');
  }

  /**
   * Generate base UI components
   */
  private generateBaseComponents(): GeneratedFile[] {
    return [
      {
        path: 'src/components/ui/Button.tsx',
        content: `import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export function Button({ variant = 'primary', size = 'md', className = '', children, ...props }: ButtonProps) {
  const baseClasses = 'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-600',
    secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 focus-visible:ring-gray-500',
    outline: 'border border-gray-300 bg-transparent hover:bg-gray-100 focus-visible:ring-gray-500',
    ghost: 'hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-gray-500',
    destructive: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600',
  };

  const sizes = {
    sm: 'h-8 px-3 text-sm',
    md: 'h-10 px-4 text-sm',
    lg: 'h-12 px-6 text-base',
  };

  return (
    <button className={\`\${baseClasses} \${variants[variant]} \${sizes[size]} \${className}\`} {...props}>
      {children}
    </button>
  );
}

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export function IconButton({ variant = 'ghost', size = 'md', className = '', children, ...props }: IconButtonProps) {
  const baseClasses = 'inline-flex items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200',
    ghost: 'hover:bg-gray-100',
  };

  const sizes = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
  };

  return (
    <button className={\`\${baseClasses} \${variants[variant]} \${sizes[size]} \${className}\`} {...props}>
      {children}
    </button>
  );
}
`,
        type: 'component',
      },
      {
        path: 'src/components/ui/Input.tsx',
        content: `import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
      <input
        className={\`h-10 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 \${error ? 'border-red-500' : ''} \${className}\`}
        {...props}
      />
      {error && <span className="text-sm text-red-500">{error}</span>}
    </div>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className = '', ...props }: TextareaProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
      <textarea
        className={\`min-h-[80px] rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 \${error ? 'border-red-500' : ''} \${className}\`}
        {...props}
      />
      {error && <span className="text-sm text-red-500">{error}</span>}
    </div>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, options, className = '', ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
      <select
        className={\`h-10 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent \${className}\`}
        {...props}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
}

export function Checkbox({ label, className = '', ...props }: CheckboxProps) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" className={\`h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 \${className}\`} {...props} />
      {label && <span className="text-sm text-gray-700">{label}</span>}
    </label>
  );
}

interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
}

export function Radio({ label, className = '', ...props }: RadioProps) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="radio" className={\`h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500 \${className}\`} {...props} />
      {label && <span className="text-sm text-gray-700">{label}</span>}
    </label>
  );
}

interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
}

export function Switch({ label, className = '', checked, ...props }: SwitchProps) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <div className="relative">
        <input type="checkbox" className="sr-only peer" checked={checked} {...props} />
        <div className={\`w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-blue-600 peer-focus:ring-2 peer-focus:ring-blue-500 peer-focus:ring-offset-2 transition-colors \${className}\`}></div>
        <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform"></div>
      </div>
      {label && <span className="text-sm text-gray-700">{label}</span>}
    </label>
  );
}

interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
}

export function Slider({ label, className = '', ...props }: SliderProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
      <input type="range" className={\`w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600 \${className}\`} {...props} />
    </div>
  );
}
`,
        type: 'component',
      },
      {
        path: 'src/components/ui/Card.tsx',
        content: `import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={\`rounded-lg border border-gray-200 bg-white shadow-sm \${className}\`}>
      {children}
    </div>
  );
}

interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function CardHeader({ children, className = '' }: CardHeaderProps) {
  return (
    <div className={\`flex flex-col space-y-1.5 p-6 \${className}\`}>
      {children}
    </div>
  );
}

interface CardTitleProps {
  children: React.ReactNode;
  className?: string;
}

export function CardTitle({ children, className = '' }: CardTitleProps) {
  return (
    <h3 className={\`text-lg font-semibold leading-none tracking-tight \${className}\`}>
      {children}
    </h3>
  );
}

interface CardDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

export function CardDescription({ children, className = '' }: CardDescriptionProps) {
  return (
    <p className={\`text-sm text-gray-500 \${className}\`}>
      {children}
    </p>
  );
}

interface CardContentProps {
  children: React.ReactNode;
  className?: string;
}

export function CardContent({ children, className = '' }: CardContentProps) {
  return (
    <div className={\`p-6 pt-0 \${className}\`}>
      {children}
    </div>
  );
}

interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function CardFooter({ children, className = '' }: CardFooterProps) {
  return (
    <div className={\`flex items-center p-6 pt-0 \${className}\`}>
      {children}
    </div>
  );
}
`,
        type: 'component',
      },
      {
        path: 'src/components/ui/Display.tsx',
        content: `import React from 'react';

interface AvatarProps {
  src?: string;
  alt?: string;
  fallback?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Avatar({ src, alt = '', fallback, size = 'md', className = '' }: AvatarProps) {
  const sizes = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base',
  };

  return (
    <div className={\`relative inline-flex items-center justify-center rounded-full bg-gray-100 overflow-hidden \${sizes[size]} \${className}\`}>
      {src ? (
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <span className="font-medium text-gray-600">{fallback || alt?.charAt(0)?.toUpperCase()}</span>
      )}
    </div>
  );
}

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  className?: string;
}

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  const variants = {
    default: 'bg-gray-100 text-gray-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    error: 'bg-red-100 text-red-800',
    info: 'bg-blue-100 text-blue-800',
  };

  return (
    <span className={\`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium \${variants[variant]} \${className}\`}>
      {children}
    </span>
  );
}

interface TagProps {
  children: React.ReactNode;
  onRemove?: () => void;
  className?: string;
}

export function Tag({ children, onRemove, className = '' }: TagProps) {
  return (
    <span className={\`inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-sm text-gray-700 \${className}\`}>
      {children}
      {onRemove && (
        <button onClick={onRemove} className="hover:text-gray-900">
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </span>
  );
}

interface ProgressProps {
  value: number;
  max?: number;
  className?: string;
}

export function Progress({ value, max = 100, className = '' }: ProgressProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className={\`h-2 w-full rounded-full bg-gray-200 overflow-hidden \${className}\`}>
      <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: \`\${percentage}%\` }} />
    </div>
  );
}

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  const sizes = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  return (
    <svg className={\`animate-spin text-blue-600 \${sizes[size]} \${className}\`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
}

export function Skeleton({ className = '', variant = 'rectangular' }: SkeletonProps) {
  const variants = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-md',
  };

  return (
    <div className={\`animate-pulse bg-gray-200 \${variants[variant]} \${className}\`} />
  );
}
`,
        type: 'component',
      },
      {
        path: 'src/components/ui/Modal.tsx',
        content: `import React, { useEffect, useCallback } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

export function Modal({ open, onClose, children, className = '' }: ModalProps) {
  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [open, handleEscape]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className={\`relative z-10 w-full max-w-lg rounded-lg bg-white p-6 shadow-xl \${className}\`}>
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-gray-600">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        {children}
      </div>
    </div>
  );
}

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  position?: 'left' | 'right';
  className?: string;
}

export function Drawer({ open, onClose, children, position = 'right', className = '' }: DrawerProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [open]);

  const positionClasses = {
    left: 'left-0',
    right: 'right-0',
  };

  const translateClasses = {
    left: open ? 'translate-x-0' : '-translate-x-full',
    right: open ? 'translate-x-0' : 'translate-x-full',
  };

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />}
      <div className={\`fixed top-0 z-50 h-full w-80 bg-white shadow-xl transition-transform duration-300 \${positionClasses[position]} \${translateClasses[position]} \${className}\`}>
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-gray-600">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="p-6">
          {children}
        </div>
      </div>
    </>
  );
}
`,
        type: 'component',
      },
      {
        path: 'src/components/ui/index.ts',
        content: `export * from './Button.js';
export * from './Input.js';
export * from './Card.js';
export * from './Display.js';
export * from './Modal.js';
export { default as Icon } from './Icon.js';
export { default as Navbar } from './Navbar.js';
`,
        type: 'component',
      },
      {
        path: 'src/components/ui/Icon.tsx',
        content: `import React from 'react';

interface IconProps {
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  onClick?: () => void;
}

/**
 * Generic Icon component - placeholder for icons detected in Figma
 * Replace with your preferred icon library (lucide-react, heroicons, etc.)
 */
export default function Icon({ size = 'md', className = '', onClick }: IconProps) {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12',
  };

  return (
    <span
      className={\`inline-flex items-center justify-center \${sizes[size]} \${className}\`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      {/* Placeholder - replace with actual icon implementation */}
      <svg
        className="w-full h-full"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="2" />
      </svg>
    </span>
  );
}
`,
        type: 'component',
      },
      {
        path: 'src/components/ui/Navbar.tsx',
        content: `import React from 'react';

interface NavbarProps {
  children?: React.ReactNode;
  className?: string;
  fixed?: boolean;
  transparent?: boolean;
}

/**
 * Navbar component for navigation headers
 */
export default function Navbar({ children, className = '', fixed = false, transparent = false }: NavbarProps) {
  const baseClasses = 'w-full';
  const positionClasses = fixed ? 'fixed top-0 left-0 right-0 z-50' : 'relative';
  const bgClasses = transparent ? 'bg-transparent' : 'bg-white';

  return (
    <nav className={\`\${baseClasses} \${positionClasses} \${bgClasses} \${className}\`}>
      {children}
    </nav>
  );
}

interface NavbarBrandProps {
  children?: React.ReactNode;
  className?: string;
  href?: string;
}

export function NavbarBrand({ children, className = '', href = '/' }: NavbarBrandProps) {
  return (
    <a href={href} className={\`flex items-center gap-2 font-semibold text-lg \${className}\`}>
      {children}
    </a>
  );
}

interface NavbarLinksProps {
  children?: React.ReactNode;
  className?: string;
}

export function NavbarLinks({ children, className = '' }: NavbarLinksProps) {
  return (
    <div className={\`flex items-center gap-6 \${className}\`}>
      {children}
    </div>
  );
}

interface NavbarLinkProps {
  children?: React.ReactNode;
  className?: string;
  href?: string;
  active?: boolean;
}

export function NavbarLink({ children, className = '', href = '#', active = false }: NavbarLinkProps) {
  const activeClasses = active ? 'text-blue-600 font-medium' : 'text-gray-600 hover:text-gray-900';
  return (
    <a href={href} className={\`text-sm transition-colors \${activeClasses} \${className}\`}>
      {children}
    </a>
  );
}

interface NavbarActionsProps {
  children?: React.ReactNode;
  className?: string;
}

export function NavbarActions({ children, className = '' }: NavbarActionsProps) {
  return (
    <div className={\`flex items-center gap-4 \${className}\`}>
      {children}
    </div>
  );
}
`,
        type: 'component',
      },
    ];
  }

  /**
   * Generate config files
   */
  private generateConfigFiles(): GeneratedFile[] {
    return [
      {
        path: 'tailwind.config.js',
        content: `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
`,
        type: 'config',
      },
      {
        path: 'postcss.config.js',
        content: `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
`,
        type: 'config',
      },
      {
        path: 'src/index.css',
        content: `@tailwind base;
@tailwind components;
@tailwind utilities;
`,
        type: 'style',
      },
    ];
  }

  /**
   * Generate TypeScript types
   */
  private generateTypes(): GeneratedFile {
    return {
      path: 'src/types/index.ts',
      content: `// Generated types for the UI components

export interface ComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}
`,
      type: 'type',
    };
  }

  /**
   * Get dependencies for package.json
   */
  private getDependencies(): Record<string, string> {
    return {
      react: '^18.2.0',
      'react-dom': '^18.2.0',
      tailwindcss: '^3.4.0',
      autoprefixer: '^10.4.16',
      postcss: '^8.4.32',
      'lucide-react': '^0.300.0', // Week 2: Icon library
    };
  }

  /**
   * Sanitize name for use as component name
   */
  private sanitizeName(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9]/g, '')
      .replace(/^[0-9]/, 'C')
      || 'GeneratedComponent';
  }

  /**
   * Escape text for JSX
   */
  private escapeText(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/{/g, '&#123;')
      .replace(/}/g, '&#125;');
  }
}
