// frontend/src/components/DocumentEditor/DocumentEditor.tsx
import { useState, useEffect, forwardRef } from 'react';
import styled from 'styled-components';
import { 
  FiPlus, 
  FiX, 
  FiList,
  FiHash,
  FiType,
  FiBold
} from 'react-icons/fi';

// Types
interface DocumentNode {
  id: string;
  type: 'section' | 'subsection' | 'paragraph' | 'bulletList';
  content: string;
  number?: string;
  children?: DocumentNode[];
  items?: string[];
  level?: number;
}

interface DocumentStructure {
  title: string;
  city: string;
  date: Date;
  nodes: DocumentNode[];
}

interface PageContent {
  nodes: DocumentNode[];
  pageNumber: number;
}

// Constants
const PAGE_CONTENT_HEIGHT_MM = 250;
const FIRST_PAGE_CONTENT_HEIGHT_MM = 220;

// Styled Components
const ContractWrapper = styled.div`
  @media print {
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    
    @page {
      size: 210mm 297mm;
      margin: 0;
    }
    
    .edit-controls {
      display: none !important;
    }
    
    .no-print {
      display: none !important;
    }
  }
`;

const ContractContainer = styled.div`
  width: 210mm;
  margin: 0 auto;
  background: #f2eee8;
  font-family: 'SF Pro Text', -apple-system, BlinkMacSystemFont, sans-serif;
  position: relative;
  color: #1b273b;
  
  @media print {
    margin: 0;
    background: #f2eee8;
    width: 210mm;
  }
`;

const Page = styled.div`
  width: 210mm;
  min-height: 297mm;
  height: 297mm;
  background: #f9f6f3;
  box-shadow: 0 0 10px rgba(0,0,0,0.1);
  margin-bottom: 10mm;
  position: relative;
  page-break-after: always;
  page-break-inside: avoid;
  box-sizing: border-box;
  padding: 10mm;
  display: flex;
  flex-direction: column;
  
  &:last-child {
    page-break-after: auto;
  }
  
  @media screen {
    height: auto;
    min-height: 297mm;
  }
  
  @media print {
    margin: 0;
    box-shadow: none;
    page-break-after: always;
    width: 210mm;
    height: 297mm;
    max-height: 297mm;
    overflow: hidden;
    padding: 5mm 10mm 10mm 10mm;
    background: #ffffff;
    
    &:last-child {
      page-break-after: avoid;
    }
  }
`;

const PageInner = styled.div<{ isFirstPage?: boolean }>`
  position: relative;
  width: 190mm;
  flex: 1;
  background: #f9f6f3;
  border: 1px solid #1b273b;
  padding: ${props => props.isFirstPage ? '15mm 15mm 10mm 15mm' : '10mm 15mm'};
  overflow: visible;
  
  @media print {
    background: #ffffff;
    border: 1px solid #1b273b;
    padding: ${props => props.isFirstPage ? '15mm 15mm 10mm 15mm' : '10mm 15mm'};
  }
`;

const Header = styled.div`
  margin-bottom: 10mm;
  text-align: center;
  position: relative;
  z-index: 10;
  page-break-inside: avoid;
  
  @media print {
    page-break-after: avoid;
  }
`;

const LogoWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  margin-bottom: 5mm;
`;

const DecorativeLine = styled.div`
  height: 1px;
  background: linear-gradient(90deg, transparent 0%, #1b273b 50%, transparent 100%);
  flex: 1;
  
  &.left {
    margin-right: 10mm;
  }
  
  &.right {
    margin-left: 10mm;
  }
`;

const Title = styled.h1<{ isEditing: boolean }>`
  font-size: 8mm;
  font-weight: 900;
  text-align: center;
  margin: -10mm 0 -2mm 0;
  letter-spacing: 0.5mm;
  color: #1b273b;
  page-break-after: avoid;
  z-index: 999;
  cursor: ${props => props.isEditing ? 'text' : 'default'};
`;

const LogoContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  z-index: 2;
  background: #f9f6f3;
  padding: 0 5mm;
  height: 10mm;
  
  @media print {
    background: #ffffff;
  }
  
  img {
    height: 35mm;
    width: auto;
    filter: brightness(0) saturate(100%) invert(11%) sepia(12%) saturate(1131%) hue-rotate(185deg) brightness(94%) contrast(91%);
  }
`;

const DateLocation = styled.div`
  display: flex;
  justify-content: space-between;
  margin: 5mm 0;
  font-size: 4mm;
  font-weight: 300;
  width: 160mm;
  page-break-inside: avoid;
`;

const PageContent = styled.div`
  position: relative;
  z-index: 4;
  width: 160mm;
  flex: 1;
  display: flex;
  flex-direction: column;
`;

const PageContentWithLimit = styled(PageContent)`
  max-height: 257mm;
  overflow: hidden;
  
  @media print {
    max-height: 267mm;
  }
`;

const PageFooter = styled.div`
  position: absolute;
  bottom: 10mm;
  left: 15mm;
  right: 15mm;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  z-index: 10;
`;

const PageFooterLeft = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1mm;
`;

const AgreementNumber = styled.div`
  font-size: 3mm;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
`;

const AgreementUUID = styled.div`
  font-size: 2.5mm;
  font-weight: 300;
  color: #999;
  font-family: 'Courier New', monospace;
`;

const PageNumber = styled.div`
  font-size: 3.5mm;
  font-weight: 300;
  color: #666;
`;

const PageQRCode = styled.div`
  position: absolute;
  bottom: 16mm;
  right: 15mm;
  opacity: 0.4;
  z-index: 5;
  
  img {
    width: 18mm;
    height: 18mm;
  }
  
  @media print {
    opacity: 0.4 !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
`;

const NodeContainer = styled.div<{ level: number; isEditing: boolean }>`
  margin: ${props => props.level === 0 ? '5mm 0' : '3mm 0'};
  margin-left: ${props => props.level > 1 ? `${(props.level - 1) * 10}mm` : '0'};
  position: relative;
  page-break-inside: avoid;
  
  ${props => props.isEditing && `
    &:hover {
      background: rgba(74, 158, 255, 0.05);
      border-radius: 2mm;
      padding-right: 60px;
    }
  `}
`;

const SectionHeader = styled.div<{ isEditing?: boolean }>`
  background: #5d666e;
  color: white;
  padding: 1.5mm 4mm;
  font-size: 4.5mm;
  font-weight: 700;
  margin: -1mm 0 -4mm 0;
  letter-spacing: 0.2mm;
  position: relative;
  z-index: 10;
  page-break-after: avoid;
  page-break-inside: avoid;
  width: 160mm;
  cursor: ${props => props.isEditing ? 'text' : 'default'};
  
  @media print {
    background: #5d666e !important;
    color: white !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
`;

const SubSection = styled.div<{ isEditing?: boolean; level: number }>`
  margin: -4mm 0;
  font-weight: 300;
  line-height: 1.5;
  page-break-inside: avoid;
  font-size: ${props => props.level > 1 ? '3.6mm' : '3.8mm'};
  width: 160mm;
  cursor: ${props => props.isEditing ? 'text' : 'default'};
  position: relative;
`;

const Paragraph = styled.p<{ isEditing?: boolean }>`
  margin: -5mm 0;
  font-weight: 300;
  line-height: 1.6;
  page-break-inside: avoid;
  font-size: 3.8mm;
  cursor: ${props => props.isEditing ? 'text' : 'default'};
  orphans: 3;
  widows: 3;
`;

const BulletList = styled.ul`
  margin: -5mm 0 -3mm 0mm;
  padding-left: 6mm;
  page-break-inside: avoid;
  width: 148mm;
  
  li {
    margin: 1mm 0;
    font-weight: 300;
    line-height: 1.6;
    page-break-inside: avoid;
    font-size: 3.8mm;
    position: relative;
    orphans: 2;
    widows: 2;
  }
`;

const NumberSpan = styled.span`
  font-weight: 700;
  margin-right: 1mm;
`;

const EditControls = styled.div`
  position: absolute;
  right: 5px;
  top: 5px;
  display: flex;
  gap: 5px;
  opacity: 0;
  transition: opacity 0.2s ease;
  z-index: 1000;
  
  ${NodeContainer}:hover & {
    opacity: 1;
  }
  
  @media print {
    display: none !important;
  }
`;

const EditButton = styled.button<{ variant: 'add' | 'remove' }>`
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  transition: all 0.2s ease;
  
  background: ${props => props.variant === 'add' ? '#4CAF50' : '#F44336'};
  
  &:hover {
    transform: scale(1.1);
  }
`;

const SignatureSection = styled.div`
  margin-top: 20mm;
  page-break-inside: avoid;
  page-break-before: auto;
`;

const SignatureTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  margin-top: 1mm;
  
  th, td {
    border: 1px solid #1b273b;
    padding: 3mm;
    text-align: left;
    font-size: 3.8mm;
  }
  
  th {
    background: #f0f0f0;
    font-weight: 600;
  }
  
  @media print {
    th {
      background: #f0f0f0 !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  }
`;

const SignatureImage = styled.img`
  max-height: 20mm;
  max-width: 50mm;
  object-fit: contain;
`;

const DocumentsSection = styled.div`
  margin-top: 5mm;
  page-break-before: auto;
`;

const DocumentBlock = styled.div`
  margin-bottom: 8mm;
  page-break-inside: avoid;
`;

const DocumentLabel = styled.div`
  font-size: 4mm;
  font-weight: 600;
  margin-bottom: 3mm;
  margin-top: 5mm;
  color: #1b273b;
  position: relative;
  z-index: 5;
`;

const DocumentGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 5mm;
`;

const DocumentImage = styled.img`
  width: 100%;
  max-width: 85mm;
  height: auto;
  border: 1px solid #1b273b;
  object-fit: contain;
  background: white;
`;

const Watermark = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  opacity: 0.03;
  pointer-events: none;
  z-index: 0;
  
  img {
    width: 80mm;
    height: auto;
  }
`;

const ContextMenu = styled.div<{ x: number; y: number }>`
  position: fixed;
  left: ${props => props.x}px;
  top: ${props => props.y}px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  z-index: 9999;
  padding: 4px 0;
  
  @media print {
    display: none !important;
  }
`;

const ContextMenuButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 16px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 14px;
  
  &:hover {
    background: #f0f0f0;
  }
`;

const BulletItemEditable = styled.div<{ isEditing: boolean }>`
  display: inline-block;
  width: 100%;
  cursor: ${props => props.isEditing ? 'text' : 'default'};
  min-height: 5mm;
  
  &:focus {
    outline: 1px dashed #4CAF50;
    outline-offset: 1mm;
  }
`;

const BulletControls = styled.div`
  position: absolute;
  right: -40px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  gap: 3px;
  opacity: 0;
  transition: opacity 0.2s ease;
  
  li:hover & {
    opacity: 1;
  }
  
  @media print {
    display: none !important;
  }
`;

const BulletButton = styled.button<{ variant: 'add' | 'remove' }>`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  transition: all 0.2s ease;
  
  background: ${props => props.variant === 'add' ? '#4CAF50' : '#F44336'};
  
  &:hover {
    transform: scale(1.1);
  }
`;

// Helper function to estimate node height
const estimateNodeHeight = (node: DocumentNode): number => {
  switch (node.type) {
    case 'section':
      return 15;
    case 'subsection':
      return 8 + (Math.ceil(node.content.length / 80) * 5);
    case 'paragraph':
      return 5 + (Math.ceil(node.content.length / 100) * 5);
    case 'bulletList':
      return 5 + ((node.items?.length || 0) * 6);
    default:
      return 10;
  }
};

// Function to calculate full section height with all children
const calculateFullSectionHeight = (node: DocumentNode): number => {
  let totalHeight = estimateNodeHeight(node);
  
  if (node.children && node.children.length > 0) {
    node.children.forEach(child => {
      totalHeight += estimateNodeHeight(child);
    });
  }
  
  return totalHeight;
};

interface DocumentEditorProps {
  agreement?: any;
  template?: any;
  isEditing: boolean;
  onContentChange?: (content: string, structure?: string) => void;
  logoUrl?: string;
}

const DocumentEditor = forwardRef<HTMLDivElement, DocumentEditorProps>(
  ({ agreement, template, isEditing, onContentChange, logoUrl }, ref) => {
    const [structure, setStructure] = useState<DocumentStructure>({
      title: '',
      city: '',
      date: new Date(),
      nodes: []
    });
    const [editingNode, setEditingNode] = useState<string | null>(null);
    const [showAddMenu, setShowAddMenu] = useState<string | null>(null);
    const [pages, setPages] = useState<PageContent[]>([]);
    
    const [contextMenu, setContextMenu] = useState<{ 
      show: boolean; 
      x: number; 
      y: number; 
      selectedText: string;
      nodeId?: string;
    }>({
      show: false,
      x: 0,
      y: 0,
      selectedText: '',
      nodeId: undefined
    });

    // ФУНКЦИЯ ПЕРЕНУМЕРАЦИИ
    const renumberNodes = (nodes: DocumentNode[]): DocumentNode[] => {
      let sectionCounter = 1;
      
      return nodes.map(node => {
        if (node.type === 'section') {
          const numberedNode = { ...node, number: sectionCounter.toString() };
          sectionCounter++;
          
          if (node.children) {
            let subsectionCounter = 1;
            numberedNode.children = node.children.map(child => {
              if (child.type === 'subsection') {
                return { ...child, number: `${numberedNode.number}.${subsectionCounter++}` };
              }
              return child;
            });
          }
          
          return numberedNode;
        }
        return node;
      });
    };

    useEffect(() => {
      if (agreement || template) {
        const data = agreement || template;
        initializeStructure(data);
      }
    }, [agreement?.id, template?.id]);

    useEffect(() => {
      if (onContentChange && isEditing) {
        const html = generateHTMLFromStructure();
        const structureJson = JSON.stringify(structure);
        onContentChange(html, structureJson);
      }
    }, [structure, isEditing]);

    useEffect(() => {
      if (!isEditing) {
        splitContentIntoPages();
      }
    }, [structure, isEditing]);

    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (showAddMenu && !(e.target as HTMLElement).closest('.add-node-menu') && !(e.target as HTMLElement).closest('.add-button')) {
          setShowAddMenu(null);
        }
        if (contextMenu.show && !(e.target as HTMLElement).closest('.context-menu')) {
          setContextMenu({ show: false, x: 0, y: 0, selectedText: '', nodeId: undefined });
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showAddMenu, contextMenu.show]);

    // Обработчик выделения текста
    useEffect(() => {
      if (!isEditing) return;

      const handleTextSelection = (e: MouseEvent) => {
        const selection = window.getSelection();
        if (selection && selection.toString().length > 0) {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          
          // Находим nodeId элемента
          let target = e.target as HTMLElement;
          let nodeId: string | undefined;
          
          while (target && !nodeId) {
            nodeId = target.getAttribute('data-node-id') || undefined;
            target = target.parentElement as HTMLElement;
          }
          
          setContextMenu({
            show: true,
            x: rect.left + (rect.width / 2),
            y: rect.bottom + window.scrollY + 5,
            selectedText: selection.toString(),
            nodeId
          });
        }
      };

      document.addEventListener('mouseup', handleTextSelection);
      return () => document.removeEventListener('mouseup', handleTextSelection);
    }, [isEditing]);

    // IMPROVED PAGINATION LOGIC
    const splitContentIntoPages = () => {
      const pagesContent: PageContent[] = [];
      let currentPage: PageContent = { nodes: [], pageNumber: 1 };
      let currentPageHeight = 0;

      const addNodeToPages = (node: DocumentNode) => {
        const pageLimit = currentPage.pageNumber === 1 ? FIRST_PAGE_CONTENT_HEIGHT_MM : PAGE_CONTENT_HEIGHT_MM;

        // If this is a section with children - check if it fits completely
        if (node.type === 'section' && node.children && node.children.length > 0) {
          const fullSectionHeight = calculateFullSectionHeight(node);
          
          // If section doesn't fit completely on current page
          if (currentPageHeight + fullSectionHeight > pageLimit) {
            // And if current page already has content
            if (currentPage.nodes.length > 0) {
              // Move entire section to new page
              pagesContent.push(currentPage);
              currentPage = { nodes: [], pageNumber: pagesContent.length + 1 };
              currentPageHeight = 0;
            }
          }
          
          // Add section header
          currentPage.nodes.push({ ...node, children: [] });
          currentPageHeight += estimateNodeHeight({ ...node, children: [] });
          
          // Add all children
          node.children.forEach(child => {
            currentPage.nodes.push(child);
            currentPageHeight += estimateNodeHeight(child);
          });
        } else {
          // For regular elements use standard logic
          const nodeHeight = estimateNodeHeight(node);
          
          if (currentPageHeight + nodeHeight > pageLimit) {
            pagesContent.push(currentPage);
            currentPage = { nodes: [], pageNumber: pagesContent.length + 1 };
            currentPageHeight = 0;
          }
          
          currentPage.nodes.push(node);
          currentPageHeight += nodeHeight;
        }
      };

      structure.nodes.forEach(node => {
        addNodeToPages(node);
      });

      if (currentPage.nodes.length > 0) {
        pagesContent.push(currentPage);
      }

      setPages(pagesContent);
    };

    const initializeStructure = (data: any) => {
      let nodes: DocumentNode[] = [];
      
      if (data.structure) {
        try {
          const savedStructure = typeof data.structure === 'string' 
            ? JSON.parse(data.structure) 
            : data.structure;
          
          if (savedStructure.nodes) {
            nodes = renumberNodes(savedStructure.nodes);
          }
        } catch (error) {
          console.error('Error parsing structure:', error);
        }
      }

      if (nodes.length === 0) {
        nodes = [
          {
            id: '1',
            type: 'section',
            content: 'GENERAL PROVISIONS',
            number: '1',
            children: [
              {
                id: '1-1',
                type: 'subsection',
                content: 'This agreement outlines the terms and conditions...',
                number: '1.1',
                level: 1
              }
            ]
          }
        ];
      }

      setStructure({
        title: data.type ? getAgreementTitle(data.type) : 'AGREEMENT',
        city: data.city || 'Phuket',
        date: new Date(),
        nodes: nodes
      });
    };

    const getAgreementTitle = (type: string): string => {
      const titles: { [key: string]: string } = {
        rent: 'LEASE AGREEMENT',
        sale: 'SALE AGREEMENT',
        bilateral: 'LEASE AGREEMENT',
        trilateral: 'LEASE AGREEMENT',
        agency: 'AGENCY AGREEMENT',
        transfer_act: 'TRANSFER ACT'
      };
      return titles[type] || 'AGREEMENT';
    };

    const generateHTMLFromStructure = (): string => {
      let html = `<h1>${structure.title}</h1>`;
      html += `<p>Date: ${structure.date.toLocaleDateString()}</p>`;
      html += `<p>City: ${structure.city}</p>`;

      const nodeToHtml = (node: DocumentNode): string => {
        let nodeHtml = '';
        
        switch (node.type) {
          case 'section':
            nodeHtml += `<h2>${node.content}</h2>`;
            break;
          case 'subsection':
            nodeHtml += `<h3>${node.number}. ${node.content}</h3>`;
            break;
          case 'paragraph':
            nodeHtml += `<p>${node.content}</p>`;
            break;
          case 'bulletList':
            if (node.items && node.items.length > 0) {
              nodeHtml += '<ul>';
              node.items.forEach(item => {
                nodeHtml += `<li>${item}</li>`;
              });
              nodeHtml += '</ul>';
            }
            break;
        }

        if (node.children) {
          node.children.forEach(child => {
            nodeHtml += nodeToHtml(child);
          });
        }

        return nodeHtml;
      };

      structure.nodes.forEach(node => {
        html += nodeToHtml(node);
      });

      return html;
    };

    const generateNodeNumber = (parentNode: DocumentNode | null, type: string, parentNumber?: string): string => {
      if (type === 'section') {
        const sectionCount = structure.nodes.filter(n => n.type === 'section').length;
        return String(sectionCount + 1);
      }
      
      if (parentNode && parentNumber) {
        const childCount = (parentNode.children || []).filter(n => n.type === 'subsection').length;
        return `${parentNumber}.${childCount + 1}`;
      }
      
      return '';
    };

    const findParentNode = (nodes: DocumentNode[], childId: string): DocumentNode | null => {
      for (const node of nodes) {
        if (node.children) {
          if (node.children.some(child => child.id === childId)) {
            return node;
          }
          const found = findParentNode(node.children, childId);
          if (found) return found;
        }
      }
      return null;
    };

    const addNode = (afterId: string | null, type: 'section' | 'subsection' | 'paragraph' | 'bulletList') => {
      const newNode: DocumentNode = {
        id: Date.now().toString(),
        type,
        content: type === 'section' ? 'NEW SECTION' : 
                 type === 'paragraph' ? 'New paragraph' : 
                 type === 'bulletList' ? '' : 'New content',
        items: type === 'bulletList' ? ['New item'] : undefined,
        children: type === 'section' ? [] : undefined,
        level: 0
      };

      if (afterId === null && type === 'section') {
        newNode.number = generateNodeNumber(null, 'section');
        const newNodes = [...structure.nodes, newNode];
        setStructure({
          ...structure,
          nodes: renumberNodes(newNodes)
        });
      } else if (afterId) {
        const addToNode = (nodes: DocumentNode[]): DocumentNode[] => {
          return nodes.map(node => {
            if (node.id === afterId) {
              if (type === 'subsection' && node.type === 'section') {
                const newSubNode = {
                  ...newNode,
                  number: generateNodeNumber(node, 'subsection', node.number),
                  level: 1
                };
                return {
                  ...node,
                  children: [...(node.children || []), newSubNode]
                };
              } else {
                return node;
              }
            } else if (node.children) {
              return { ...node, children: addToNode(node.children) };
            }
            return node;
          });
        };

        if (type === 'paragraph' || type === 'bulletList') {
          const parentNode = findParentNode(structure.nodes, afterId);
          
          if (parentNode) {
            const addToParent = (nodes: DocumentNode[]): DocumentNode[] => {
              return nodes.map(node => {
                if (node.id === parentNode.id && node.children) {
                  const index = node.children.findIndex(c => c.id === afterId);
                  if (index !== -1) {
                    const newChildren = [...node.children];
                    newChildren.splice(index + 1, 0, newNode);
                    return { ...node, children: newChildren };
                  }
                }
                if (node.children) {
                  return { ...node, children: addToParent(node.children) };
                }
                return node;
              });
            };
            
            setStructure({
              ...structure,
              nodes: renumberNodes(addToParent(structure.nodes))
            });
          }
        } else {
          setStructure({
            ...structure,
            nodes: renumberNodes(addToNode(structure.nodes))
          });
        }
      }
      
      setShowAddMenu(null);
    };

    const removeNode = (nodeId: string) => {
      const removeFromNodes = (nodes: DocumentNode[]): DocumentNode[] => {
        return nodes.filter(node => {
          if (node.id === nodeId) {
            return false;
          }
          if (node.children) {
            node.children = removeFromNodes(node.children);
          }
          return true;
        });
      };

      setStructure({
        ...structure,
        nodes: renumberNodes(removeFromNodes(structure.nodes))
      });
    };

    const updateNode = (nodeId: string, newContent: string) => {
      const updateInNodes = (nodes: DocumentNode[]): DocumentNode[] => {
        return nodes.map(node => {
          if (node.id === nodeId) {
            return { ...node, content: newContent };
          }
          if (node.children) {
            return { ...node, children: updateInNodes(node.children) };
          }
          return node;
        });
      };

      setStructure({
        ...structure,
        nodes: updateInNodes(structure.nodes)
      });
    };

    const updateBulletItem = (nodeId: string, itemIndex: number, newContent: string) => {
      const updateInNodes = (nodes: DocumentNode[]): DocumentNode[] => {
        return nodes.map(node => {
          if (node.id === nodeId && node.items) {
            const newItems = [...node.items];
            newItems[itemIndex] = newContent;
            return { ...node, items: newItems };
          }
          if (node.children) {
            return { ...node, children: updateInNodes(node.children) };
          }
          return node;
        });
      };

      setStructure({
        ...structure,
        nodes: updateInNodes(structure.nodes)
      });
    };

    const addBulletItem = (nodeId: string, afterIndex: number) => {
      const updateInNodes = (nodes: DocumentNode[]): DocumentNode[] => {
        return nodes.map(node => {
          if (node.id === nodeId && node.items) {
            const newItems = [...node.items];
            newItems.splice(afterIndex + 1, 0, 'New item');
            return { ...node, items: newItems };
          }
          if (node.children) {
            return { ...node, children: updateInNodes(node.children) };
          }
          return node;
        });
      };

      setStructure({
        ...structure,
        nodes: updateInNodes(structure.nodes)
      });
    };

    const removeBulletItem = (nodeId: string, itemIndex: number) => {
      const updateInNodes = (nodes: DocumentNode[]): DocumentNode[] => {
        return nodes.map(node => {
          if (node.id === nodeId && node.items) {
            const newItems = [...node.items];
            newItems.splice(itemIndex, 1);
            return { ...node, items: newItems };
          }
          if (node.children) {
            return { ...node, children: updateInNodes(node.children) };
          }
          return node;
        });
      };

      setStructure({
        ...structure,
        nodes: updateInNodes(structure.nodes)
      });
    };

    // Функция для применения жирного шрифта к выделенному тексту
    const toggleBold = () => {
      if (!contextMenu.nodeId) return;

      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      const range = selection.getRangeAt(0);
      const selectedText = range.toString();
      
      if (!selectedText) return;

      // Получаем содержимое контейнера
      const container = range.commonAncestorContainer;
      const parentElement = container.nodeType === Node.TEXT_NODE 
        ? container.parentElement 
        : container as HTMLElement;

      if (!parentElement) return;

      // Получаем HTML контейнера
      let containerHtml = parentElement.innerHTML;
      
      // Проверяем, обернут ли выделенный текст в <strong>
      const isAlreadyBold = parentElement.querySelector('strong')?.textContent === selectedText;
      
      let newHtml: string;
      if (isAlreadyBold) {
        // Убираем жирность
        newHtml = containerHtml.replace(new RegExp(`<strong>${selectedText}</strong>`, 'g'), selectedText);
      } else {
        // Добавляем жирность
        newHtml = containerHtml.replace(selectedText, `<strong>${selectedText}</strong>`);
      }

      // Обновляем HTML
      parentElement.innerHTML = newHtml;

      // Обновляем node в structure
      updateNode(contextMenu.nodeId, parentElement.textContent || '');

      // Закрываем контекстное меню
      setContextMenu({ show: false, x: 0, y: 0, selectedText: '', nodeId: undefined });
      
      // Снимаем выделение
      selection.removeAllRanges();
    };

    const renderNode = (node: DocumentNode, level: number = 0) => (
      <NodeContainer key={node.id} level={level} isEditing={isEditing}>
        {node.type === 'section' && (
          <SectionHeader isEditing={isEditing} data-node-id={node.id}>
            {editingNode === node.id ? (
              <input
                type="text"
                value={node.content}
                onChange={(e) => updateNode(node.id, e.target.value)}
                onBlur={() => setEditingNode(null)}
                onKeyDown={(e) => e.key === 'Enter' && setEditingNode(null)}
                style={{ background: 'transparent', border: 'none', color: 'inherit', width: '100%', outline: 'none' }}
                autoFocus
              />
            ) : (
              <span 
                onClick={() => isEditing && setEditingNode(node.id)}
                dangerouslySetInnerHTML={{ __html: node.content }}
              />
            )}
          </SectionHeader>
        )}

        {node.type === 'subsection' && (
          <SubSection isEditing={isEditing} level={level} data-node-id={node.id}>
            <div>
              <NumberSpan>{node.number}.</NumberSpan>
              {editingNode === node.id ? (
                <input
                  type="text"
                  value={node.content}
                  onChange={(e) => updateNode(node.id, e.target.value)}
                  onBlur={() => setEditingNode(null)}
                  onKeyDown={(e) => e.key === 'Enter' && setEditingNode(null)}
                  style={{ background: 'transparent', border: 'none', width: '90%', outline: 'none' }}
                  autoFocus
                />
              ) : (
                <span 
                  onClick={() => isEditing && setEditingNode(node.id)}
                  dangerouslySetInnerHTML={{ __html: node.content }}
                />
              )}
            </div>
          </SubSection>
        )}

        {node.type === 'paragraph' && (
          <Paragraph isEditing={isEditing} data-node-id={node.id}>
            {editingNode === node.id ? (
              <textarea
                value={node.content}
                onChange={(e) => updateNode(node.id, e.target.value)}
                onBlur={() => setEditingNode(null)}
                style={{ background: 'transparent', border: 'none', width: '100%', minHeight: '50px', outline: 'none', resize: 'vertical' }}
                autoFocus
              />
            ) : (
              <span 
                onClick={() => isEditing && setEditingNode(node.id)}
                dangerouslySetInnerHTML={{ __html: node.content }}
              />
            )}
          </Paragraph>
        )}

        {node.type === 'bulletList' && node.items && (
          <BulletList>
            {node.items.map((item, index) => (
              <li key={index} style={{ position: 'relative' }}>
                {editingNode === `${node.id}-item-${index}` ? (
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => updateBulletItem(node.id, index, e.target.value)}
                    onBlur={() => setEditingNode(null)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setEditingNode(null);
                        addBulletItem(node.id, index);
                      }
                    }}
                    style={{ background: 'transparent', border: 'none', width: '100%', outline: 'none' }}
                    autoFocus
                  />
                ) : (
                  <BulletItemEditable
                    isEditing={isEditing}
                    onClick={() => isEditing && setEditingNode(`${node.id}-item-${index}`)}
                    data-node-id={node.id}
                    dangerouslySetInnerHTML={{ __html: item }}
                  />
                )}
                {isEditing && (
                  <BulletControls>
                    <BulletButton
                      variant="add"
                      onClick={() => addBulletItem(node.id, index)}
                      title="Add item"
                    >
                      <FiPlus size={8} />
                    </BulletButton>
                    {node.items && node.items.length > 1 && (
                      <BulletButton
                        variant="remove"
                        onClick={() => removeBulletItem(node.id, index)}
                        title="Remove item"
                      >
                        <FiX size={8} />
                      </BulletButton>
                    )}
                  </BulletControls>
                )}
              </li>
            ))}
          </BulletList>
        )}

        {isEditing && (
          <EditControls>
            <EditButton
              variant="add"
              onClick={() => setShowAddMenu(showAddMenu === node.id ? null : node.id)}
              title="Add element"
              className="add-button"
            >
              <FiPlus size={14} />
            </EditButton>
            <EditButton
              variant="remove"
              onClick={() => removeNode(node.id)}
              title="Remove"
            >
              <FiX size={14} />
            </EditButton>
            
            {showAddMenu === node.id && (
              <div 
                className="add-node-menu"
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '5px',
                  background: 'white',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  padding: '8px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  zIndex: 2000,
                  minWidth: '150px'
                }}
              >
                {node.type === 'section' && (
                  <button onClick={() => addNode(node.id, 'subsection')} style={{ display: 'block', width: '100%', padding: '6px 12px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}>
                    <FiHash size={16} style={{ marginRight: '8px' }} />
                    Add Subsection
                  </button>
                )}
                <button onClick={() => addNode(node.id, 'paragraph')} style={{ display: 'block', width: '100%', padding: '6px 12px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}>
                  <FiType size={16} style={{ marginRight: '8px' }} />
                  Add Paragraph
                </button>
                <button onClick={() => addNode(node.id, 'bulletList')} style={{ display: 'block', width: '100%', padding: '6px 12px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}>
                  <FiList size={16} style={{ marginRight: '8px' }} />
                  Add Bullet List
                </button>
              </div>
            )}
          </EditControls>
        )}

        {node.children && node.children.map(child => renderNode(child, level + 1))}
      </NodeContainer>
    );

    const renderNodeForPrint = (node: DocumentNode, level: number = 0) => (
      <NodeContainer key={node.id} level={level} isEditing={false}>
        {node.type === 'section' && (
          <SectionHeader isEditing={false}>
            <span dangerouslySetInnerHTML={{ __html: node.content }} />
          </SectionHeader>
        )}

        {node.type === 'subsection' && (
          <SubSection isEditing={false} level={level}>
            <div>
              <NumberSpan>{node.number}.</NumberSpan>
              <span dangerouslySetInnerHTML={{ __html: node.content }} />
            </div>
          </SubSection>
        )}

        {node.type === 'paragraph' && (
          <Paragraph isEditing={false}>
            <span dangerouslySetInnerHTML={{ __html: node.content }} />
          </Paragraph>
        )}

        {node.type === 'bulletList' && node.items && (
          <BulletList>
            {node.items.map((item, index) => (
              <li key={index}>
                <span dangerouslySetInnerHTML={{ __html: item }} />
              </li>
            ))}
          </BulletList>
        )}

        {node.children && node.children.map(child => renderNodeForPrint(child, level + 1))}
      </NodeContainer>
    );

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
  };

  const formatRole = (role?: string): string => {
    if (!role) return 'Unknown';

    const roleTranslations: { [key: string]: string } = {
      'tenant': 'Tenant',
      'lessor': 'Lessor',
      'landlord': 'Landlord',
      'representative': 'Representative',
      'principal': 'Principal',
      'agent': 'Agent',
      'buyer': 'Buyer',
      'seller': 'Seller',
      'witness': 'Witness',
      'company': 'Company'
    };

    return roleTranslations[role.toLowerCase()] || role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
  };

    const totalPages = isEditing ? 1 : pages.length + (agreement?.signatures?.length > 0 ? 1 : 0);

    // Editing mode - single page
    if (isEditing) {
      return (
        <ContractWrapper ref={ref}>
          <ContractContainer>
            <Page>
              <PageInner isFirstPage>
                {logoUrl && (
                  <Watermark>
                    <img src={logoUrl} alt="Logo" />
                  </Watermark>
                )}
                <PageContent>
                  <Header>
                    <LogoWrapper>
                      <DecorativeLine className="left" />
                      <LogoContainer>
                        {logoUrl && <img src={logoUrl} alt="Logo" />}
                      </LogoContainer>
                      <DecorativeLine className="right" />
                    </LogoWrapper>
                  </Header>
                  
                  <Title isEditing={true}>
                    {editingNode === 'title' ? (
                      <input
                        type="text"
                        value={structure.title}
                        onChange={(e) => setStructure({ ...structure, title: e.target.value })}
                        onBlur={() => setEditingNode(null)}
                        onKeyDown={(e) => e.key === 'Enter' && setEditingNode(null)}
                        style={{ background: 'transparent', border: 'none', width: '100%', textAlign: 'center', outline: 'none' }}
                        autoFocus
                      />
                    ) : (
                      <span onClick={() => setEditingNode('title')}>
                        {structure.title}
                      </span>
                    )}
                  </Title>
                  
                  <DateLocation>
                    <span>
                      City: {editingNode === 'city' ? (
                        <input
                          type="text"
                          value={structure.city}
                          onChange={(e) => setStructure({ ...structure, city: e.target.value })}
                          onBlur={() => setEditingNode(null)}
                          onKeyDown={(e) => e.key === 'Enter' && setEditingNode(null)}
                          style={{ background: 'transparent', border: 'none', width: '100px', outline: 'none' }}
                          autoFocus
                        />
                      ) : (
                        <span 
                          onClick={() => setEditingNode('city')}
                          style={{ cursor: 'text' }}
                        >
                          {structure.city}
                        </span>
                      )}
                    </span>
                    <span>{formatDate(structure.date)}</span>
                  </DateLocation>
                  
                  {structure.nodes.map(node => renderNode(node))}
                  
                  {isEditing && (
                    <div style={{ textAlign: 'center', marginTop: '10mm' }}>
                      <EditButton
                        variant="add"
                        onClick={() => addNode(null, 'section')}
                        style={{ width: '40px', height: '40px' }}
                        title="Add new section"
                      >
                        <FiPlus size={20} />
                      </EditButton>
                    </div>
                  )}
                </PageContent>
              </PageInner>
            </Page>
          </ContractContainer>
          
          {contextMenu.show && (
            <ContextMenu x={contextMenu.x} y={contextMenu.y} className="context-menu">
              <ContextMenuButton onClick={toggleBold}>
                <FiBold size={16} />
                Жирный
              </ContextMenuButton>
            </ContextMenu>
          )}
        </ContractWrapper>
      );
    }

    // Print/View mode - multiple pages
    return (
      <ContractWrapper ref={ref}>
        <ContractContainer>
          <Page>
            <PageInner isFirstPage>
              {logoUrl && (
                <Watermark>
                  <img src={logoUrl} alt="Logo" />
                </Watermark>
              )}
              <PageContent>
                <Header>
                  <LogoWrapper>
                    <DecorativeLine className="left" />
                    <LogoContainer>
                      {logoUrl && <img src={logoUrl} alt="Logo" />}
                    </LogoContainer>
                    <DecorativeLine className="right" />
                  </LogoWrapper>
                </Header>
                
                <Title isEditing={false}>
                  {structure.title}
                </Title>
                
                <DateLocation>
                  <span>City: {structure.city}</span>
                  <span>{formatDate(structure.date)}</span>
                </DateLocation>
                
            {pages[0]?.nodes.map(node => renderNodeForPrint(node))}
            </PageContent>
              {agreement?.qr_code_base64 && (
              <PageQRCode>
                <img 
                  src={agreement.qr_code_base64} 
                  alt="Verification QR Code"
                />
              </PageQRCode>
            )}
            <PageFooter>
              <PageFooterLeft>
                <AgreementNumber>
                  {agreement?.agreement_number || ''}
                </AgreementNumber>
                <AgreementUUID>
                  {agreement?.verify_link || ''}
                </AgreementUUID>
              </PageFooterLeft>
              <PageNumber>Page 1 of {totalPages}</PageNumber>
            </PageFooter>
          </PageInner>
        </Page>

          {pages.slice(1).map((page, index) => (
            <Page key={`page-${index + 2}`}>
              <PageInner>
                {logoUrl && (
                  <Watermark>
                    <img src={logoUrl} alt="Logo" />
                  </Watermark>
                )}
                <PageContent>
                  {page.nodes.map(node => renderNodeForPrint(node))}
                </PageContent>
                {agreement?.qr_code_base64 && (
                  <PageQRCode>
                    <img 
                      src={agreement.qr_code_base64} 
                      alt="Verification QR Code"
                    />
                  </PageQRCode>
                )}
                <PageFooter>
                  <PageFooterLeft>
                    <AgreementNumber>
                      {agreement?.agreement_number || ''}
                    </AgreementNumber>
                    <AgreementUUID>
                      {agreement?.verify_link || ''}
                    </AgreementUUID>
                  </PageFooterLeft>
                  <PageNumber>Page {page.pageNumber} of {totalPages}</PageNumber>
                </PageFooter>
              </PageInner>
            </Page>
          ))}

          {agreement?.signatures?.length > 0 && (
            <Page>
              <PageInner>
                {logoUrl && (
                  <Watermark>
                    <img src={logoUrl} alt="Logo" />
                  </Watermark>
                )}

                <PageContentWithLimit>
                  <SectionHeader isEditing={false}>SIGNATURES</SectionHeader>
                  
                  <SignatureSection>
                    <SignatureTable>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Signature</th>
                          <th>Date</th>
                        </tr>
                      </thead>
                        <tbody>
                          {agreement.signatures.map((signature: any) => (
                            <tr key={signature.id}>
                              <td>
                                <div>{signature.signer_name}</div>
                                <div style={{ fontSize: '3mm', color: '#666', marginTop: '1mm' }}>
                                  ({formatRole(signature.signer_role)})
                                </div>
                              </td>
                            <td style={{ textAlign: 'center' }}>
                              {signature.is_signed && signature.signature_data ? (
                                <SignatureImage 
                                  src={signature.signature_data}
                                />
                              ) : (
                                '___________'
                              )}
                            </td>
                              <td>
                                {signature.signed_at && signature.signed_at !== '' 
                                  ? formatDate(new Date(signature.signed_at))
                                  : '«____» __________ 20__'
                                }
                              </td>
                          </tr>
                        ))}
                      </tbody>
                    </SignatureTable>
                  </SignatureSection>
                                        
                  {/* Секция документов */}
                  {(() => {
                    // Функция для получения подписантов с документами
                    const getSignersWithDocuments = () => {
                      if (!agreement?.signatures || !agreement?.parties) return [];
                      
                      const signersWithDocs: any[] = [];
                      
                      agreement.signatures.forEach((signature: any) => {
                        // Находим соответствующую сторону по роли
                        const party = agreement.parties.find((p: any) => p.role === signature.signer_role);
                        
                        if (party && party.documents && party.documents.length > 0) {
                          signersWithDocs.push({
                            role: signature.signer_role,
                            name: signature.signer_name,
                            documents: party.documents
                          });
                        }
                      });
                      
                      return signersWithDocs;
                    };
                  
                    const signersWithDocuments = getSignersWithDocuments();
                    
                    if (signersWithDocuments.length === 0) return null;
                  
                      return (
                        <DocumentsSection>
                          <SectionHeader isEditing={false}>ATTACHED DOCUMENTS</SectionHeader>
                          {signersWithDocuments.map((signer: any, index: number) => (
                            <DocumentBlock key={index}>
                              <DocumentLabel>{formatRole(signer.role)}'s Documents:</DocumentLabel>
                              <DocumentGrid>
                                {signer.documents.map((doc: any, docIndex: number) => (
                                  <DocumentImage 
                                    key={docIndex} 
                                    src={doc.document_base64} 
                                    alt={`${formatRole(signer.role)} document ${docIndex + 1}`}
                                  />
                                ))}
                              </DocumentGrid>
                            </DocumentBlock>
                          ))}
                        </DocumentsSection>
                      );
                  })()}
              </PageContentWithLimit>

              {agreement?.qr_code_base64 && (
                <PageQRCode>
                  <img 
                    src={agreement.qr_code_base64} 
                    alt="Verification QR Code"
                  />
                </PageQRCode>
              )}
              <PageFooter>
                <PageFooterLeft>
                  <AgreementNumber>
                    {agreement?.agreement_number || ''}
                  </AgreementNumber>
                  <AgreementUUID>
                    {agreement?.verify_link || ''}
                  </AgreementUUID>
                </PageFooterLeft>
                <PageNumber>Page {totalPages} of {totalPages}</PageNumber>
              </PageFooter>
            </PageInner>
          </Page>
        )}
        </ContractContainer>
      </ContractWrapper>
    );
  }
);

DocumentEditor.displayName = 'DocumentEditor';

export default DocumentEditor;