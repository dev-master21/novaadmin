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
  font-family: 'Arial', sans-serif;
  position: relative;
  color: #1b273b;
  
  @media print {
    margin: 0;
    background: #f2eee8;
    width: 210mm;
  }

  @media (max-width: 768px) {
    width: 100%;
    background: transparent;
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

  @media (max-width: 768px) {
    width: 100%;
    min-height: auto;
    height: auto;
    background: #fff;
    margin-bottom: 0;
    padding: 20px;
    box-shadow: none;
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
    padding: ${props => props.isFirstPage ? '12mm 15mm' : '10mm 15mm'};
  }

  @media (max-width: 768px) {
    width: 100%;
    border: none;
    padding: 0;
    background: #fff;
  }
`;

const PageContent = styled.div`
  position: relative;
  z-index: 1;
`;

const Header = styled.div`
  margin-bottom: 12mm;
  
  @media print {
    margin-bottom: 10mm;
  }

  @media (max-width: 768px) {
    margin-bottom: 20px;
  }
`;

const LogoWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5mm;
  margin-bottom: 8mm;
`;

const DecorativeLine = styled.div`
  flex: 1;
  height: 1px;
  background: linear-gradient(to right, transparent, #1b273b, transparent);
  
  &.left {
    background: linear-gradient(to right, transparent, #1b273b);
  }
  
  &.right {
    background: linear-gradient(to left, transparent, #1b273b);
  }

  @media (max-width: 768px) {
    display: none;
  }
`;

const LogoContainer = styled.div`
  img {
    height: 15mm;
    width: auto;
    
    @media print {
      height: 12mm;
    }

    @media (max-width: 768px) {
      height: 40px;
    }
  }
`;

const Title = styled.h1<{ isEditing: boolean }>`
  font-size: 7mm;
  font-weight: 700;
  text-align: center;
  margin: 8mm 0;
  letter-spacing: 0.5mm;
  cursor: ${props => props.isEditing ? 'text' : 'default'};
  border: ${props => props.isEditing ? '1px dashed #4CAF50' : 'none'};
  padding: ${props => props.isEditing ? '2mm' : '0'};
  
  @media print {
    font-size: 6mm;
    margin: 6mm 0;
    border: none;
  }

  @media (max-width: 768px) {
    font-size: 20px;
    margin: 16px 0;
  }
`;

const DateLocation = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 8mm;
  font-size: 3.5mm;
  
  @media print {
    margin-bottom: 6mm;
    font-size: 3.2mm;
  }

  @media (max-width: 768px) {
    font-size: 12px;
    margin-bottom: 16px;
    flex-direction: column;
    gap: 8px;
  }
`;

const SectionHeader = styled.h2<{ isEditing: boolean; number?: string }>`
  font-size: 4.5mm;
  font-weight: 600;
  margin: 6mm 0 3mm 0;
  background: #e8e4de;
  padding: 2mm 4mm;
  cursor: ${props => props.isEditing ? 'text' : 'default'};
  border: ${props => props.isEditing ? '1px dashed #4CAF50' : 'none'};
  position: relative;
  
  &::before {
    content: '${props => props.number || ''}';
    margin-right: ${props => props.number ? '2mm' : '0'};
  }
  
  @media print {
    font-size: 4.2mm;
    background: #e8e4de !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    border: none;
  }

  @media (max-width: 768px) {
    font-size: 16px;
    padding: 8px 12px;
    margin: 16px 0 12px 0;
  }
`;

const SubsectionHeader = styled.h3<{ isEditing: boolean; number?: string }>`
  font-size: 4mm;
  font-weight: 600;
  margin: 4mm 0 2mm 0;
  cursor: ${props => props.isEditing ? 'text' : 'default'};
  border: ${props => props.isEditing ? '1px dashed #4CAF50' : 'none'};
  padding: ${props => props.isEditing ? '1mm 2mm' : '0'};
  
  &::before {
    content: '${props => props.number || ''}';
    margin-right: ${props => props.number ? '1.5mm' : '0'};
  }
  
  @media print {
    font-size: 3.8mm;
    border: none;
  }

  @media (max-width: 768px) {
    font-size: 14px;
    margin: 12px 0 8px 0;
  }
`;

const Paragraph = styled.p<{ isEditing: boolean }>`
  font-size: 3.5mm;
  line-height: 1.6;
  margin: 2mm 0;
  text-align: justify;
  cursor: ${props => props.isEditing ? 'text' : 'default'};
  border: ${props => props.isEditing ? '1px dashed #4CAF50' : 'none'};
  padding: ${props => props.isEditing ? '1mm' : '0'};
  
  @media print {
    font-size: 3.2mm;
    border: none;
  }

  @media (max-width: 768px) {
    font-size: 12px;
    margin: 8px 0;
  }
`;

const BulletList = styled.ul<{ isEditing: boolean }>`
  margin: 2mm 0 2mm 8mm;
  padding: 0;
  border: ${props => props.isEditing ? '1px dashed #4CAF50' : 'none'};
  padding: ${props => props.isEditing ? '1mm' : '0'};
  
  @media print {
    border: none;
  }

  @media (max-width: 768px) {
    margin: 8px 0 8px 24px;
  }
`;

const BulletItem = styled.li<{ isEditing: boolean }>`
  font-size: 3.5mm;
  line-height: 1.6;
  margin: 1.5mm 0;
  cursor: ${props => props.isEditing ? 'text' : 'default'};
  
  @media print {
    font-size: 3.2mm;
  }

  @media (max-width: 768px) {
    font-size: 12px;
    margin: 6px 0;
  }
`;

const PageNumber = styled.div`
  position: absolute;
  bottom: 5mm;
  right: 10mm;
  font-size: 3mm;
  color: #666;
  
  @media print {
    bottom: 5mm;
  }

  @media (max-width: 768px) {
    display: none;
  }
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

  @media (max-width: 768px) {
    display: none;
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

  @media (max-width: 768px) {
    margin-top: 32px;
  }
`;

const SignatureTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  margin-top: 10mm;
  
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

  @media (max-width: 768px) {
    margin-top: 16px;

    th, td {
      padding: 8px;
      font-size: 11px;
    }
  }
`;

const SignatureImage = styled.img`
  max-height: 20mm;
  max-width: 50mm;
  object-fit: contain;

  @media (max-width: 768px) {
    max-height: 60px;
    max-width: 120px;
  }
`;

const QRCodeSection = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 10mm;
  page-break-inside: avoid;
  
  img {
    width: 30mm;
    height: 30mm;
  }

  @media (max-width: 768px) {
    margin-top: 16px;

    img {
      width: 100px;
      height: 100px;
    }
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

// Helper function
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
    const [contextMenu, setContextMenu] = useState<{ show: boolean; x: number; y: number; selectedText: string }>({
      show: false,
      x: 0,
      y: 0,
      selectedText: ''
    });

    const logo = logoUrl || '/nova-logo.svg';

    // Renumber nodes
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
        if (contextMenu.show && !(e.target as HTMLElement).closest('.context-menu-button')) {
          setContextMenu({ show: false, x: 0, y: 0, selectedText: '' });
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showAddMenu, contextMenu.show]);

    const splitContentIntoPages = () => {
      const pagesContent: PageContent[] = [];
      let currentPage: PageContent = { nodes: [], pageNumber: 1 };
      let currentPageHeight = 0;

      const addNodeToPages = (node: DocumentNode) => {
        const nodeHeight = estimateNodeHeight(node);
        const pageLimit = currentPage.pageNumber === 1 ? FIRST_PAGE_CONTENT_HEIGHT_MM : PAGE_CONTENT_HEIGHT_MM;

        if (currentPageHeight + nodeHeight > pageLimit) {
          pagesContent.push(currentPage);
          currentPage = { nodes: [], pageNumber: pagesContent.length + 1 };
          currentPageHeight = 0;
        }
        
        if (node.children && node.children.length > 0) {
          currentPage.nodes.push({ ...node, children: [] });
          currentPageHeight += 15;
          
          node.children.forEach(child => {
            const childHeight = estimateNodeHeight(child);
            
            if (currentPageHeight + childHeight > (currentPage.pageNumber === 1 ? FIRST_PAGE_CONTENT_HEIGHT_MM : PAGE_CONTENT_HEIGHT_MM)) {
              pagesContent.push(currentPage);
              currentPage = { nodes: [], pageNumber: pagesContent.length + 2 };
              currentPageHeight = 0;
            }
            
            currentPage.nodes.push(child);
            currentPageHeight += childHeight;
          });
        } else {
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
          
          if (savedStructure.nodes && Array.isArray(savedStructure.nodes)) {
            nodes = savedStructure.nodes;
          }
          
          setStructure({
            title: savedStructure.title || getDefaultTitle(data.type),
            city: savedStructure.city || data.city || 'Phuket',
            date: savedStructure.date ? new Date(savedStructure.date) : new Date(),
            nodes: renumberNodes(nodes)
          });
        } catch (e) {
          console.error('Error parsing structure:', e);
          setDefaultStructure(data);
        }
      } else {
        setDefaultStructure(data);
      }
    };

    const setDefaultStructure = (data: any) => {
      const defaultNodes: DocumentNode[] = [
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
              number: '1.1'
            }
          ]
        }
      ];

      setStructure({
        title: getDefaultTitle(data.type),
        city: data.city || 'Phuket',
        date: new Date(),
        nodes: defaultNodes
      });
    };

    const getDefaultTitle = (type: string) => {
      const titles: { [key: string]: string } = {
        rent: 'LEASE AGREEMENT',
        sale: 'SALE AGREEMENT',
        bilateral: 'BILATERAL AGREEMENT',
        trilateral: 'TRILATERAL AGREEMENT',
        agency: 'AGENCY AGREEMENT',
        transfer_act: 'TRANSFER ACT'
      };
      return titles[type] || 'AGREEMENT';
    };

    const generateHTMLFromStructure = () => {
      let html = `<h1>${structure.title}</h1>`;
      html += `<div style="display:flex;justify-content:space-between;margin-bottom:20px;">`;
      html += `<span>City: ${structure.city}</span>`;
      html += `<span>${formatDate(structure.date)}</span>`;
      html += `</div>`;

      const nodeToHtml = (node: DocumentNode): string => {
        let nodeHtml = '';
        
        switch (node.type) {
          case 'section':
            nodeHtml += `<h2>${node.number || ''}. ${node.content}</h2>`;
            break;
          case 'subsection':
            nodeHtml += `<h3>${node.number || ''} ${node.content}</h3>`;
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

    const formatDate = (date: Date) => {
      if (!date) return '';
      return new Date(date).toLocaleDateString('en-US', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      });
    };

    const addNode = (afterId: string | null, type: 'section' | 'subsection' | 'paragraph' | 'bulletList') => {
      const newNode: DocumentNode = {
        id: Date.now().toString(),
        type,
        content: type === 'section' ? 'NEW SECTION' : 
                 type === 'paragraph' ? 'New paragraph' : 
                 type === 'bulletList' ? '' : 'New content',
        items: type === 'bulletList' ? ['New item'] : undefined,
        children: type === 'section' ? [] : undefined
      };

      if (!afterId) {
        setStructure({
          ...structure,
          nodes: renumberNodes([...structure.nodes, newNode])
        });
        setEditingNode(newNode.id);
        return;
      }

      const insertInNodes = (nodes: DocumentNode[]): DocumentNode[] => {
        const result: DocumentNode[] = [];
        
        for (const node of nodes) {
          result.push(node);
          
          if (node.id === afterId) {
            if (node.type === 'section' && (type === 'subsection' || type === 'paragraph' || type === 'bulletList')) {
              node.children = [...(node.children || []), newNode];
            } else {
              result.push(newNode);
            }
          } else if (node.children) {
            node.children = insertInNodes(node.children);
          }
        }
        
        return result;
      };

      setStructure({
        ...structure,
        nodes: renumberNodes(insertInNodes(structure.nodes))
      });
      setEditingNode(newNode.id);
    };

    const removeNode = (nodeId: string) => {
      const removeFromNodes = (nodes: DocumentNode[]): DocumentNode[] => {
        return nodes.filter(node => {
          if (node.id === nodeId) return false;
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

    const updateNode = (nodeId: string, content: string) => {
      const updateInNodes = (nodes: DocumentNode[]): DocumentNode[] => {
        return nodes.map(node => {
          if (node.id === nodeId) {
            return { ...node, content };
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

    const renderNode = (node: DocumentNode): JSX.Element => {
      const isEditable = editingNode === node.id;

      switch (node.type) {
        case 'section':
          return (
            <div key={node.id} style={{ position: 'relative', marginBottom: '6mm' }}>
              <SectionHeader
                isEditing={isEditing}
                number={node.number}
                contentEditable={isEditable}
                suppressContentEditableWarning
                onBlur={(e) => {
                  updateNode(node.id, e.currentTarget.textContent || '');
                  setEditingNode(null);
                }}
                onClick={() => isEditing && setEditingNode(node.id)}
              >
                {node.content}
              </SectionHeader>
              {isEditing && (
                <div style={{ position: 'absolute', right: '-20px', top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: '4px' }} className="no-print">
                  <EditButton variant="remove" onClick={() => removeNode(node.id)} title="Remove">
                    <FiX size={10} />
                  </EditButton>
                  <EditButton variant="add" onClick={() => setShowAddMenu(node.id)} className="add-button" title="Add">
                    <FiPlus size={10} />
                  </EditButton>
                </div>
              )}
              {showAddMenu === node.id && (
                <div className="add-node-menu" style={{
                  position: 'absolute',
                  right: '-150px',
                  top: '0',
                  background: 'white',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  padding: '8px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  zIndex: 1000
                }}>
                  <button onClick={() => { addNode(node.id, 'subsection'); setShowAddMenu(null); }} style={{ display: 'block', width: '100%', padding: '6px 12px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}>
                    <FiHash size={14} style={{ marginRight: '8px' }} /> Subsection
                  </button>
                  <button onClick={() => { addNode(node.id, 'paragraph'); setShowAddMenu(null); }} style={{ display: 'block', width: '100%', padding: '6px 12px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}>
                    <FiType size={14} style={{ marginRight: '8px' }} /> Paragraph
                  </button>
                  <button onClick={() => { addNode(node.id, 'bulletList'); setShowAddMenu(null); }} style={{ display: 'block', width: '100%', padding: '6px 12px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}>
                    <FiList size={14} style={{ marginRight: '8px' }} /> List
                  </button>
                </div>
              )}
              {node.children && node.children.map(child => renderNode(child))}
            </div>
          );

        case 'subsection':
          return (
            <div key={node.id} style={{ position: 'relative', marginBottom: '4mm' }}>
              <SubsectionHeader
                isEditing={isEditing}
                number={node.number}
                contentEditable={isEditable}
                suppressContentEditableWarning
                onBlur={(e) => {
                  updateNode(node.id, e.currentTarget.textContent || '');
                  setEditingNode(null);
                }}
                onClick={() => isEditing && setEditingNode(node.id)}
              >
                {node.content}
              </SubsectionHeader>
              {isEditing && (
                <div style={{ position: 'absolute', right: '-20px', top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: '4px' }} className="no-print">
                  <EditButton variant="remove" onClick={() => removeNode(node.id)} title="Remove">
                    <FiX size={10} />
                  </EditButton>
                </div>
              )}
            </div>
          );

        case 'paragraph':
          return (
            <div key={node.id} style={{ position: 'relative', marginBottom: '2mm' }}>
              <Paragraph
                isEditing={isEditing}
                contentEditable={isEditable}
                suppressContentEditableWarning
                onBlur={(e) => {
                  updateNode(node.id, e.currentTarget.textContent || '');
                  setEditingNode(null);
                }}
                onClick={() => isEditing && setEditingNode(node.id)}
              >
                {node.content}
              </Paragraph>
              {isEditing && (
                <div style={{ position: 'absolute', right: '-20px', top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: '4px' }} className="no-print">
                  <EditButton variant="remove" onClick={() => removeNode(node.id)} title="Remove">
                    <FiX size={10} />
                  </EditButton>
                </div>
              )}
            </div>
          );

        case 'bulletList':
          return (
            <div key={node.id} style={{ position: 'relative', marginBottom: '2mm' }}>
              <BulletList isEditing={isEditing}>
                {node.items?.map((item, index) => (
                  <BulletItem key={index} isEditing={isEditing}>
                    {item}
                  </BulletItem>
                ))}
              </BulletList>
              {isEditing && (
                <div style={{ position: 'absolute', right: '-20px', top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: '4px' }} className="no-print">
                  <EditButton variant="remove" onClick={() => removeNode(node.id)} title="Remove">
                    <FiX size={10} />
                  </EditButton>
                </div>
              )}
            </div>
          );

        default:
          return <></>;
      }
    };

    const renderNodeForPrint = (node: DocumentNode): JSX.Element => {
      switch (node.type) {
        case 'section':
          return (
            <div key={node.id}>
              <SectionHeader isEditing={false} number={node.number}>
                {node.content}
              </SectionHeader>
              {node.children && node.children.map(child => renderNodeForPrint(child))}
            </div>
          );

        case 'subsection':
          return (
            <SubsectionHeader key={node.id} isEditing={false} number={node.number}>
              {node.content}
            </SubsectionHeader>
          );

        case 'paragraph':
          return (
            <Paragraph key={node.id} isEditing={false}>
              {node.content}
            </Paragraph>
          );

        case 'bulletList':
          return (
            <BulletList key={node.id} isEditing={false}>
              {node.items?.map((item, index) => (
                <BulletItem key={index} isEditing={false}>
                  {item}
                </BulletItem>
              ))}
            </BulletList>
          );

        default:
          return <></>;
      }
    };

    const totalPages = pages.length + (agreement?.signatures?.length > 0 ? 1 : 0);

    // Edit mode - single page
    if (isEditing) {
      return (
        <ContractWrapper>
          <ContractContainer>
            <Page>
              <PageInner isFirstPage>
                <Watermark>
                  <img src={logo} alt="NOVA ESTATE" />
                </Watermark>
                <PageContent>
                  <Header>
                    <LogoWrapper>
                      <DecorativeLine className="left" />
                      <LogoContainer>
                        <img src={logo} alt="NOVA ESTATE" />
                      </LogoContainer>
                      <DecorativeLine className="right" />
                    </LogoWrapper>
                  </Header>
                  
                  <Title 
                    isEditing={isEditing}
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => setStructure({ ...structure, title: e.currentTarget.textContent || '' })}
                  >
                    {structure.title}
                  </Title>
                  
                  <DateLocation>
                    <span>
                      City: 
                      <span
                        contentEditable={isEditing}
                        suppressContentEditableWarning
                        onBlur={(e) => setStructure({ ...structure, city: e.currentTarget.textContent || '' })}
                        style={{ marginLeft: '4px', borderBottom: isEditing ? '1px dashed #4CAF50' : 'none', cursor: isEditing ? 'text' : 'default' }}
                      >
                        {structure.city}
                      </span>
                    </span>
                    <span>{formatDate(structure.date)}</span>
                  </DateLocation>
                  
                  {structure.nodes.map(node => renderNode(node))}
                  
                  {isEditing && (
                    <div style={{ textAlign: 'center', marginTop: '10mm' }} className="no-print">
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
            <ContextMenu x={contextMenu.x} y={contextMenu.y}>
              <ContextMenuButton onClick={() => {}}>
                <FiBold size={16} />
                Bold
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
              <Watermark>
                <img src={logo} alt="NOVA ESTATE" />
              </Watermark>
              <PageContent>
                <Header>
                  <LogoWrapper>
                    <DecorativeLine className="left" />
                    <LogoContainer>
                      <img src={logo} alt="NOVA ESTATE" />
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
              <PageNumber>Page 1 of {totalPages}</PageNumber>
            </PageInner>
          </Page>

          {pages.slice(1).map((page, index) => (
            <Page key={`page-${index + 2}`}>
              <PageInner>
                <Watermark>
                  <img src={logo} alt="NOVA ESTATE" />
                </Watermark>
                <PageContent>
                  {page.nodes.map(node => renderNodeForPrint(node))}
                </PageContent>
                <PageNumber>Page {page.pageNumber} of {totalPages}</PageNumber>
              </PageInner>
            </Page>
          ))}

          {agreement?.signatures?.length > 0 && (
            <Page>
              <PageInner>
                <Watermark>
                  <img src={logo} alt="NOVA ESTATE" />
                </Watermark>
                
                <PageContent>
                  <SectionHeader isEditing={false}>SIGNATURES</SectionHeader>
                  
                  <SignatureSection>
                    <SignatureTable>
                      <thead>
                        <tr>
                          <th>Party</th>
                          <th>Name</th>
                          <th>Signature</th>
                          <th>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {agreement.signatures.map((signature: any) => (
                          <tr key={signature.id}>
                            <td>{signature.signer_role}</td>
                            <td>{signature.signer_name}</td>
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
                              {signature.signed_at 
                                ? formatDate(new Date(signature.signed_at))
                                : '«____» __________ 20__'
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </SignatureTable>
                  </SignatureSection>
                      
                  {agreement?.qr_code_path && (
                    <QRCodeSection>
                      <img 
                        src={agreement.qr_code_path?.startsWith('http') ? agreement.qr_code_path : `http://localhost:5000${agreement.qr_code_path}`}
                        alt="QR Code"
                      />
                    </QRCodeSection>
                  )}
                </PageContent>
                
                <PageNumber>Page {totalPages} of {totalPages}</PageNumber>
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