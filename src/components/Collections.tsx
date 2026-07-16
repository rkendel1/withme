import React, { useState, useEffect, useCallback } from 'react';
import { 
  FolderOpen, 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  X,
  FolderGit2,
} from 'lucide-react';
import { 
  getAllCollections, 
  createCollection, 
  deleteCollection, 
  updateCollection,
  getRepositoriesByCollection,
  getCollectionRepositoryCount,
} from '../db';
import type { Collection, Repository } from '../types';

interface CollectionWithCount extends Collection {
  repositoryCount: number;
}

const COLLECTION_COLORS = [
  '#8b5cf6', // Purple
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#84cc16', // Lime
];

export function Collections() {
  const [collections, setCollections] = useState<CollectionWithCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newColor, setNewColor] = useState(COLLECTION_COLORS[0]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [selectedCollection, setSelectedCollection] = useState<CollectionWithCount | null>(null);
  const [collectionRepos, setCollectionRepos] = useState<Repository[]>([]);

  const loadCollections = useCallback(async () => {
    try {
      const cols = await getAllCollections();
      const colsWithCount = await Promise.all(
        cols.map(async (col) => ({
          ...col,
          repositoryCount: await getCollectionRepositoryCount(col.id),
        }))
      );
      setCollections(colsWithCount);
    } catch (error) {
      console.error('Failed to load collections:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  const handleCreateCollection = async () => {
    if (!newName.trim()) return;

    try {
      await createCollection({
        name: newName.trim(),
        description: newDescription.trim() || null,
        color: newColor,
      });
      setNewName('');
      setNewDescription('');
      setNewColor(COLLECTION_COLORS[0]);
      setIsCreating(false);
      await loadCollections();
    } catch (error) {
      console.error('Failed to create collection:', error);
    }
  };

  const handleDeleteCollection = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this collection?')) return;

    try {
      await deleteCollection(id);
      if (selectedCollection?.id === id) {
        setSelectedCollection(null);
        setCollectionRepos([]);
      }
      await loadCollections();
    } catch (error) {
      console.error('Failed to delete collection:', error);
    }
  };

  const handleStartEdit = (collection: CollectionWithCount, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(collection.id);
    setEditName(collection.name);
  };

  const handleSaveEdit = async (id: number) => {
    if (!editName.trim()) return;

    try {
      await updateCollection(id, { name: editName.trim() });
      setEditingId(null);
      await loadCollections();
    } catch (error) {
      console.error('Failed to update collection:', error);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const handleSelectCollection = async (collection: CollectionWithCount) => {
    setSelectedCollection(collection);
    try {
      const repos = await getRepositoriesByCollection(collection.id);
      setCollectionRepos(repos);
    } catch (error) {
      console.error('Failed to load collection repositories:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500 dark:text-gray-400">Loading collections...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FolderOpen className="w-5 h-5" />
            Collections
          </h2>
          <button
            onClick={() => setIsCreating(true)}
            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 
                       dark:hover:bg-blue-900/30 rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {isCreating && (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 space-y-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Collection name"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 
                         rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <input
              type="text"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Description (optional)"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 
                         rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Color:</span>
              <div className="flex gap-1">
                {COLLECTION_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewColor(color)}
                    className={`w-6 h-6 rounded-full transition-transform ${
                      newColor === color ? 'scale-110 ring-2 ring-offset-2 ring-gray-400' : ''
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsCreating(false)}
                className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 
                           dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCollection}
                disabled={!newName.trim()}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                           disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {collections.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            <FolderOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No collections yet</p>
            <p className="text-sm mt-1">Create a collection to organize your repositories</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {collections.map((collection) => (
              <li
                key={collection.id}
                onClick={() => handleSelectCollection(collection)}
                className={`p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 
                           transition-colors ${
                             selectedCollection?.id === collection.id
                               ? 'bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500'
                               : ''
                           }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: collection.color }}
                  >
                    <FolderOpen className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    {editingId === collection.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 
                                     rounded bg-white dark:bg-gray-900"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit(collection.id);
                            if (e.key === 'Escape') handleCancelEdit();
                          }}
                          autoFocus
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSaveEdit(collection.id);
                          }}
                          className="p-1 text-green-600 hover:bg-green-100 rounded"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancelEdit();
                          }}
                          className="p-1 text-gray-500 hover:bg-gray-100 rounded"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <h3 className="font-medium text-sm truncate">{collection.name}</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {collection.repositoryCount} {collection.repositoryCount === 1 ? 'repository' : 'repositories'}
                        </p>
                      </>
                    )}
                  </div>
                  {editingId !== collection.id && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => handleStartEdit(collection, e)}
                        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteCollection(collection.id, e)}
                        className="p-1 text-gray-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selectedCollection && collectionRepos.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 max-h-48 overflow-y-auto">
          <div className="p-2 bg-gray-50 dark:bg-gray-800 text-xs font-medium text-gray-500 sticky top-0">
            Repositories in {selectedCollection.name}
          </div>
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {collectionRepos.map((repo) => (
              <li key={repo.id} className="px-3 py-2 flex items-center gap-2">
                <FolderGit2 className="w-4 h-4 text-gray-400" />
                <span className="text-sm truncate">{repo.fullName}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
