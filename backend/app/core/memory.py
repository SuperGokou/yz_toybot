"""
Memory Manager for KidBot RAG System

Handles document ingestion and semantic search using ChromaDB.
"""

import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

import chromadb
from sentence_transformers import SentenceTransformer

from ..config import DATA_DIR


# Global cache for resources
_embedding_model_cache = {}
_chroma_client_cache = {}


def load_embedding_model(model_name: str) -> SentenceTransformer:
    """Load and cache the sentence transformer embedding model."""
    if model_name not in _embedding_model_cache:
        print(f"[Cache] Loading embedding model: {model_name}...")
        _embedding_model_cache[model_name] = SentenceTransformer(model_name)
    return _embedding_model_cache[model_name]


def get_chroma_client(vector_store_path: str) -> chromadb.PersistentClient:
    """Get and cache the ChromaDB persistent client."""
    if vector_store_path not in _chroma_client_cache:
        print(f"[Cache] Connecting to ChromaDB at: {vector_store_path}...")
        _chroma_client_cache[vector_store_path] = chromadb.PersistentClient(path=vector_store_path)
    return _chroma_client_cache[vector_store_path]


class MemoryManager:
    """Manages the knowledge base for KidBot."""

    def __init__(self, config: dict):
        """Initialize the Memory Manager."""
        self.config = config
        
        # Get paths from config or use defaults
        paths = config.get("paths", {})
        rag_config = config.get("rag", {})
        
        self.raw_docs_path = Path(paths.get("raw_docs", str(DATA_DIR / "raw_docs")))
        self.vector_store_path = Path(paths.get("vector_store", str(DATA_DIR / "vector_store")))
        self.processed_files_path = self.vector_store_path / "processed_files.json"

        # Ensure directories exist
        self.raw_docs_path.mkdir(parents=True, exist_ok=True)
        self.vector_store_path.mkdir(parents=True, exist_ok=True)

        # Collection settings
        self.collection_name = rag_config.get("collection_name", "kidbot_memory")
        self.embedding_model_name = rag_config.get("embedding_model", "all-MiniLM-L6-v2")

        # Use cached ChromaDB client
        self.client = get_chroma_client(str(self.vector_store_path))
        self.collection = self._get_or_create_collection()

        # Use cached embedding model
        self.embedding_model = load_embedding_model(self.embedding_model_name)

        # Load processed files registry
        self.processed_files = self._load_processed_files()

    def _get_or_create_collection(self) -> chromadb.Collection:
        """Get existing collection or create a new one."""
        try:
            return self.client.get_or_create_collection(
                name=self.collection_name,
                metadata={"description": "KidBot knowledge base"}
            )
        except Exception as e:
            print(f"Error accessing collection: {e}")
            raise

    def _load_processed_files(self) -> dict:
        """Load the registry of processed files."""
        if self.processed_files_path.exists():
            try:
                with open(self.processed_files_path, "r") as f:
                    return json.load(f)
            except (json.JSONDecodeError, IOError):
                return {}
        return {}

    def _save_processed_files(self):
        """Save the registry of processed files."""
        with open(self.processed_files_path, "w") as f:
            json.dump(self.processed_files, f, indent=2)

    def query_memory(self, query_text: str, n_results: int = 3) -> list[str]:
        """Search the knowledge base for relevant context."""
        if self.collection.count() == 0:
            return []

        try:
            results = self.collection.query(
                query_texts=[query_text],
                n_results=min(n_results, self.collection.count())
            )

            if results and results["documents"]:
                return results["documents"][0]

        except Exception as e:
            print(f"Error querying memory: {e}")

        return []

    def add_memory(self, text: str, metadata: Optional[dict] = None) -> bool:
        """Add a new memory to the knowledge base."""
        if not text or not text.strip():
            return False

        try:
            doc_id = f"memory_{uuid.uuid4().hex[:12]}"

            if metadata is None:
                metadata = {}

            metadata.update({
                "source": "conversation",
                "type": "learned_fact",
                "timestamp": datetime.now().isoformat()
            })

            embedding = self.embedding_model.encode([text], show_progress_bar=False).tolist()

            self.collection.add(
                ids=[doc_id],
                embeddings=embedding,
                documents=[text],
                metadatas=[metadata]
            )

            print(f"[Memory] Saved new memory: {text[:50]}...")
            return True

        except Exception as e:
            print(f"[Memory] Error saving memory: {e}")
            return False

    def get_stats(self) -> dict:
        """Get statistics about the knowledge base."""
        return {
            "total_documents": self.collection.count(),
            "processed_files": len(self.processed_files),
            "collection_name": self.collection_name
        }
