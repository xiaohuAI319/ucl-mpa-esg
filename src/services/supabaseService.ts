import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Folder, FileItem, Message } from '../types';

class SupabaseService {
  private client: SupabaseClient | null = null;

  initialize(url: string, anonKey: string) {
    this.client = createClient(url, anonKey);
  }

  async testConnection(): Promise<boolean> {
    if (!this.client) return false;
    try {
      const { error } = await this.client.from('documents').select('id').limit(1);
      return !error;
    } catch {
      return false;
    }
  }

  // Folders
  async getFolders(): Promise<Folder[]> {
    if (!this.client) return [];
    
    const { data: documents } = await this.client
      .from('documents')
      .select('*')
      .order('created_at', { ascending: true });

    if (!documents) return [];

    // Group by folder_name
    const folderMap = new Map<string, FileItem[]>();
    
    documents.forEach(doc => {
      const folderName = doc.folder_name || 'Default';
      if (!folderMap.has(folderName)) {
        folderMap.set(folderName, []);
      }
      folderMap.get(folderName)!.push({
        id: doc.id,
        name: doc.file_name,
        content: doc.parsed_content || '',
        isText: doc.parse_status === 'success',
        fromDocx: doc.file_type === 'docx',
        timestamp: new Date(doc.created_at).getTime()
      });
    });

    const folders: Folder[] = [];
    folderMap.forEach((files, name) => {
      folders.push({
        id: name,
        name,
        files
      });
    });

    return folders;
  }

  async createFolder(folder: Folder): Promise<void> {
    // Folders are created implicitly when documents are uploaded
    // Just validate
    if (!this.client) throw new Error('Supabase not initialized');
  }

  async deleteFolder(folderId: string): Promise<void> {
    if (!this.client) return;
    
    await this.client
      .from('documents')
      .delete()
      .eq('folder_name', folderId);
  }

  // Documents
  async uploadDocument(folderId: string, file: FileItem): Promise<void> {
    if (!this.client) throw new Error('Supabase not initialized');

    const { error } = await this.client
      .from('documents')
      .insert({
        id: file.id,
        folder_name: folderId,
        file_name: file.name,
        file_type: file.fromDocx ? 'docx' : file.name.split('.').pop()?.toLowerCase(),
        parsed_content: file.content,
        parse_status: file.isText ? 'success' : 'failed'
      });

    if (error) throw error;
  }

  // Conversations
  async createConversation(id: string, model: string): Promise<void> {
    if (!this.client) return;

    await this.client
      .from('conversations')
      .insert({
        id,
        title: `Chat - ${new Date().toLocaleDateString()}`,
        model
      });
  }

  async getMessages(conversationId: string): Promise<Message[]> {
    if (!this.client) return [];

    const { data } = await this.client
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (!data) return [];

    return data.map(msg => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      timestamp: new Date(msg.created_at).getTime(),
      groundingMetadata: msg.sources
    }));
  }

  async saveMessage(conversationId: string, message: Message): Promise<void> {
    if (!this.client) return;

    await this.client
      .from('messages')
      .insert({
        id: message.id,
        conversation_id: conversationId,
        role: message.role,
        content: message.content,
        sources: message.groundingMetadata
      });
  }
}

export const supabaseService = new SupabaseService();
