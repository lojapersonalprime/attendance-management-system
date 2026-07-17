import "server-only";

export interface PrivateStorage {
  upload(path: string, content: Buffer, contentType: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  remove(path: string): Promise<void>;
}
