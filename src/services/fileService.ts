import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import PizZip from 'pizzip';
import { FileItem } from '../types';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export const isPlainTextFile = (name: string): boolean => {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const textExts = ['txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'xml', 'html', 'js', 'ts', 'py', 'log'];
  return textExts.includes(ext);
};

export const isDocxFile = (name: string): boolean => {
  return name.split('.').pop()?.toLowerCase() === 'docx';
};

export const isPdfFile = (name: string): boolean => {
  return name.split('.').pop()?.toLowerCase() === 'pdf';
};

export const isPptFile = (name: string): boolean => {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return ['ppt', 'pptx'].includes(ext);
};

export const parseFile = async (file: File): Promise<FileItem> => {
  const fileId = Date.now().toString() + '_' + Math.random().toString(16).slice(2);
  const baseItem = {
    id: fileId,
    name: file.name,
    timestamp: Date.now(),
  };

  console.log('📄 Parsing file:', file.name, 'Type:', file.type, 'Size:', file.size);

  try {
    // Plain text files (TXT, MD, JSON, etc.)
    if (isPlainTextFile(file.name)) {
      console.log('📝 Parsing as plain text...');
      const content = await file.text();
      console.log('✅ Text parsed, length:', content.length);
      return {
        ...baseItem,
        content,
        isText: true,
        fromDocx: false,
      };
    } 
    
    // DOCX files
    else if (isDocxFile(file.name)) {
      console.log('📄 Parsing DOCX...');
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      console.log('✅ DOCX parsed, length:', result.value.length);
      return {
        ...baseItem,
        content: result.value,
        isText: true,
        fromDocx: true,
      };
    } 
    
    // PDF files
    else if (isPdfFile(file.name)) {
      console.log('📕 Parsing PDF...');
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      console.log('📕 PDF loaded, pages:', pdf.numPages);
      
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        fullText += pageText + '\n\n';
      }
      
      console.log('✅ PDF parsed, length:', fullText.length);
      return {
        ...baseItem,
        content: fullText.trim() || `[PDF file: ${file.name}]\n\n无法从此 PDF 提取文本内容。可能是扫描版或加密文件。`,
        isText: true,
        fromDocx: false,
      };
    } 
    
    // PPT/PPTX files
    else if (isPptFile(file.name)) {
      console.log('📊 Parsing PPTX...');
      try {
        const arrayBuffer = await file.arrayBuffer();
        const zip = new PizZip(arrayBuffer);
        
        let fullText = '';
        
        // Extract text from slides
        const slideFiles = Object.keys(zip.files).filter(name => 
          name.startsWith('ppt/slides/slide') && name.endsWith('.xml')
        );
        
        for (const slideFile of slideFiles) {
          const slideXml = zip.file(slideFile)?.asText();
          if (slideXml) {
            // Extract text between <a:t> tags (text content in PPTX)
            const textMatches = slideXml.match(/<a:t>(.*?)<\/a:t>/g) || [];
            const slideText = textMatches
              .map(match => match.replace(/<\/?a:t>/g, ''))
              .join(' ');
            fullText += slideText + '\n\n';
          }
        }
        
        console.log('✅ PPTX parsed, length:', fullText.length);
        return {
          ...baseItem,
          content: fullText.trim() || `[PowerPoint 文件: ${file.name}]\n\n无法提取文本内容，可能是纯图片幻灯片。`,
          isText: true,
          fromDocx: false,
        };
      } catch (error) {
        console.error('❌ PPTX parse error:', error);
        return {
          ...baseItem,
          content: `[PowerPoint 文件: ${file.name}]\n\n解析失败。建议转换为 PDF 后上传。`,
          isText: false,
          fromDocx: false,
        };
      }
    }
    
    // Unsupported file types
    else {
      console.log('⚠️ Unsupported file type');
      return {
        ...baseItem,
        content: `[不支持的文件类型: ${file.name}]`,
        isText: false,
        fromDocx: false,
      };
    }
  } catch (error) {
    console.error('❌ Error parsing file:', error);
    return {
      ...baseItem,
      content: `[解析文件失败: ${file.name}]\n\n错误: ${error instanceof Error ? error.message : '未知错误'}`,
      isText: false,
      fromDocx: false,
    };
  }
};
