import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Folder, FileItem, Message } from '../types';

class SupabaseService {
  private client: SupabaseClient | null = null;
  private folderIdMap: Map<string, number> = new Map();

  initialize(url: string, publishableKey: string) {
    this.client = createClient(url, publishableKey);
  }

  async testConnection(): Promise<boolean> {
    if (!this.client) return false;
    try {
      const { error } = await this.client.from('folders').select('id').limit(1);
      return !error;
    } catch {
      return false;
    }
  }

  // Folders
  async getFolders(): Promise<Folder[]> {
    if (!this.client) return [];
    
    // Get all folders
    const { data: foldersData, error: folderError } = await this.client
      .from('folders')
      .select('*')
      .order('created_at', { ascending: true });

    if (folderError || !foldersData) {
      console.error('Failed to fetch folders:', folderError);
      return [];
    }

    // Get all documents
    const { data: documents, error: docError } = await this.client
      .from('documents')
      .select('*')
      .order('created_at', { ascending: true });

    if (docError) {
      console.error('Failed to fetch documents:', docError);
    }

    // Map folders with their documents
    const folders: Folder[] = foldersData.map(folder => {
      this.folderIdMap.set(folder.name, folder.id);
      
      const files: FileItem[] = documents
        ?.filter(doc => doc.folder_id === folder.id)
        .map(doc => ({
          id: doc.id.toString(),
          name: doc.file_name,
          content: doc.content || '',
          isText: doc.parse_status === 'success',
          fromDocx: doc.file_type === 'docx',
          timestamp: new Date(doc.created_at).getTime()
        })) || [];

      return {
        id: folder.id.toString(),
        name: folder.name,
        files
      };
    });

    return folders;
  }

  async createFolder(folder: Folder): Promise<void> {
    if (!this.client) throw new Error('Supabase not initialized');
    
    const { data, error } = await this.client
      .from('folders')
      .insert({
        name: folder.name,
        user_id: null // Anonymous user
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create folder:', error);
      throw error;
    }

    if (data) {
      this.folderIdMap.set(folder.name, data.id);
    }
  }

  async deleteFolder(folderId: string): Promise<void> {
    if (!this.client) return;
    
    const numericId = parseInt(folderId);
    if (isNaN(numericId)) return;

    // Delete documents first (cascade should handle this, but being explicit)
    await this.client
      .from('documents')
      .delete()
      .eq('folder_id', numericId);

    // Delete folder
    await this.client
      .from('folders')
      .delete()
      .eq('id', numericId);
  }

  async deleteDocument(documentId: string): Promise<void> {
    if (!this.client) return;
    
    const numericId = parseInt(documentId);
    if (isNaN(numericId)) return;

    const { error } = await this.client
      .from('documents')
      .delete()
      .eq('id', numericId);

    if (error) {
      console.error('Failed to delete document:', error);
      throw error;
    }
  }

  // Documents
  async uploadDocument(folderId: string, file: FileItem): Promise<void> {
    if (!this.client) throw new Error('Supabase not initialized');

    const numericFolderId = parseInt(folderId);
    if (isNaN(numericFolderId)) {
      throw new Error('Invalid folder ID');
    }

    const { error } = await this.client
      .from('documents')
      .insert({
        folder_id: numericFolderId,
        file_name: file.name,
        file_type: file.fromDocx ? 'docx' : file.name.split('.').pop()?.toLowerCase() || 'txt',
        content: file.content,
        parse_status: file.isText ? 'success' : 'failed',
        user_id: null // Anonymous user
      });

    if (error) {
      console.error('Failed to upload document:', error);
      throw error;
    }
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
