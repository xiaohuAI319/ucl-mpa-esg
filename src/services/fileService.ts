import { FileItem } from '../types';

export const isPlainTextFile = (name: string): boolean => {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const textExts = ['txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'xml', 'html', 'js', 'ts', 'py'];
  return textExts.includes(ext);
};

export const isDocxFile = (name: string): boolean => {
  return name.split('.').pop()?.toLowerCase() === 'docx';
};

export const isPdfFile = (name: string): boolean => {
  return name.split('.').pop()?.toLowerCase() === 'pdf';
};

export const parseFile = async (file: File): Promise<FileItem> => {
  const fileId = Date.now().toString() + '_' + Math.random().toString(16).slice(2);
  const baseItem = {
    id: fileId,
    name: file.name,
    timestamp: Date.now(),
  };

  // Plain text files
  if (isPlainTextFile(file.name)) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          ...baseItem,
          content: reader.result as string,
          isText: true,
          fromDocx: false,
        });
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  } 
  
  // DOCX files
  else if (isDocxFile(file.name)) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const arrayBuffer = e.target?.result;
        if (window.mammoth) {
          window.mammoth.extractRawText({ arrayBuffer })
            .then((result: any) => {
              resolve({
                ...baseItem,
                content: result.value || '',
                isText: true,
                fromDocx: true,
              });
            })
            .catch((err: any) => {
              console.error("Mammoth error", err);
              resolve({
                ...baseItem,
                content: '',
                isText: false,
                fromDocx: true,
              });
            });
        } else {
          reject(new Error("Mammoth library not loaded"));
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  } 
  
  // PDF files (basic extraction, could be improved with pdf.js)
  else if (isPdfFile(file.name)) {
    // For now, just mark as uploaded, actual parsing needs pdf.js or server-side
    return Promise.resolve({
      ...baseItem,
      content: `[PDF file: ${file.name}]\n\nNote: PDF parsing will be available soon. The file is uploaded and stored.`,
      isText: true,
      fromDocx: false,
    });
  } 
  
  // Unsupported files
  else {
    return Promise.resolve({
      ...baseItem,
      content: '',
      isText: false,
      fromDocx: false,
    });
  }
};
