import { Character, CharacterImage } from "./types";

// Extend globalThis type for TypeScript
declare global {
  var characterStoreInstance: CharacterStore | undefined;
  var characterStoreInitialized: boolean | undefined;
}

// In-memory store for demo purposes
// In production, you would use a database like PostgreSQL, MongoDB, or Prisma
class CharacterStore {
  private characters: Map<string, Character> = new Map();
  private characterImages: Map<string, CharacterImage[]> = new Map();
  private userCharacters: Map<string, string[]> = new Map(); // userId -> characterIds

  // Character CRUD operations
  createCharacter(character: Character): Character {
    this.characters.set(character.id, character);
    
    // Add to user's character list
    if (character.userId) {
      const userChars = this.userCharacters.get(character.userId) || [];
      userChars.push(character.id);
      this.userCharacters.set(character.userId, userChars);
    }
    
    return character;
  }

  getCharacter(id: string): Character | undefined {
    return this.characters.get(id);
  }

  updateCharacter(id: string, updates: Partial<Character>): Character | undefined {
    const character = this.characters.get(id);
    if (!character) return undefined;
    
    const updated = { ...character, ...updates, updatedAt: new Date() };
    this.characters.set(id, updated);
    return updated;
  }

  deleteCharacter(id: string): boolean {
    const character = this.characters.get(id);
    if (!character) return false;
    
    // Remove from user's character list
    if (character.userId) {
      const userChars = this.userCharacters.get(character.userId) || [];
      this.userCharacters.set(
        character.userId,
        userChars.filter((cId) => cId !== id)
      );
    }
    
    // Remove character images
    this.characterImages.delete(id);
    
    return this.characters.delete(id);
  }

  // Get all characters for a user
  getUserCharacters(userId: string): Character[] {
    const characterIds = this.userCharacters.get(userId) || [];
    return characterIds
      .map((id) => this.characters.get(id))
      .filter((c): c is Character => c !== undefined);
  }

  // Get all public characters
  getPublicCharacters(): Character[] {
    return Array.from(this.characters.values()).filter((c) => c.isPublic);
  }

  // Get all characters (for admin or public gallery)
  getAllCharacters(): Character[] {
    return Array.from(this.characters.values());
  }

  // Character Images operations
  addCharacterImage(characterId: string, image: CharacterImage): CharacterImage {
    const images = this.characterImages.get(characterId) || [];
    images.push(image);
    this.characterImages.set(characterId, images);
    
    // Also update the character's images array
    const character = this.characters.get(characterId);
    if (character) {
      character.images = [...(character.images || []), image.imageUrl];
      this.characters.set(characterId, character);
    }
    
    return image;
  }

  getCharacterImages(characterId: string): CharacterImage[] {
    return this.characterImages.get(characterId) || [];
  }

  setMainFaceImage(characterId: string, imageId: string): boolean {
    const images = this.characterImages.get(characterId);
    if (!images) return false;
    
    // Reset all images and set the new main face
    const updatedImages = images.map((img) => ({
      ...img,
      isMainFace: img.id === imageId,
    }));
    this.characterImages.set(characterId, updatedImages);
    
    // Update character's main face image
    const mainImage = updatedImages.find((img) => img.id === imageId);
    if (mainImage) {
      const character = this.characters.get(characterId);
      if (character) {
        character.mainFaceImage = mainImage.imageUrl;
        character.thumbnail = mainImage.imageUrl;
        this.characters.set(characterId, character);
      }
    }
    
    return true;
  }

  deleteCharacterImage(characterId: string, imageId: string): boolean {
    const images = this.characterImages.get(characterId);
    if (!images) return false;
    
    const imageToDelete = images.find((img) => img.id === imageId);
    const updatedImages = images.filter((img) => img.id !== imageId);
    this.characterImages.set(characterId, updatedImages);
    
    // Update character's images array
    if (imageToDelete) {
      const character = this.characters.get(characterId);
      if (character) {
        character.images = character.images.filter(
          (url) => url !== imageToDelete.imageUrl
        );
        this.characters.set(characterId, character);
      }
    }
    
    return true;
  }
}

// Use globalThis to preserve store across hot reloads in development
// This prevents data loss when Next.js hot-reloads modules
function getCharacterStore(): CharacterStore {
  if (process.env.NODE_ENV === 'production') {
    // In production, create a new instance (though for production you should use a real database)
    return new CharacterStore();
  }

  // In development, reuse the same instance across hot reloads
  if (!globalThis.characterStoreInstance) {
    globalThis.characterStoreInstance = new CharacterStore();
  }
  return globalThis.characterStoreInstance;
}

// Singleton instance
export const characterStore = getCharacterStore();

// Note: No mock data initialization - gallery will show only real user-created characters with images
