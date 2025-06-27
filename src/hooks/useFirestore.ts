import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  getDoc
} from 'firebase/firestore';
import type {
  QueryConstraint,
  DocumentData,
  DocumentReference
} from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Hook for real-time Firestore collection data
 */
export function useCollection<T = DocumentData>(
  collectionName: string,
  constraints: QueryConstraint[] = [],
  deps: any[] = []
) {
  const [documents, setDocuments] = useState<T[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    setLoading(true);
    
    const collectionRef = collection(db, collectionName);
    const q = query(collectionRef, ...constraints);
    
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const results: T[] = snapshot.docs.map(doc => ({
          ...(doc.data() as any),
          id: doc.id
        })) as T[];
        
        setDocuments(results);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error('Firestore collection error:', err);
        setError(`Failed to fetch ${collectionName}: ${err.message}`);
        setLoading(false);
      }
    );
    
    // Cleanup function
    return unsubscribe;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps]);
  
  return { documents, error, loading };
}

/**
 * Hook for real-time Firestore document data
 */
export function useDocument<T = DocumentData>(
  collectionName: string,
  documentId: string,
  deps: any[] = []
) {
  const [document, setDocument] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!documentId) {
      setDocument(null);
      setError('No document ID provided');
      setLoading(false);
      return;
    }
    
    setLoading(true);
    
    const docRef = doc(db, collectionName, documentId);
    
    const unsubscribe = onSnapshot(docRef, 
      (doc) => {
        if (doc.exists()) {
          setDocument({ ...(doc.data() as any), id: doc.id } as T);
          setError(null);
        } else {
          setDocument(null);
          setError(`Document ${documentId} not found in ${collectionName}`);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Firestore document error:', err);
        setError(`Failed to fetch document: ${err.message}`);
        setLoading(false);
      }
    );
    
    // Cleanup function
    return unsubscribe;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionName, documentId, ...deps]);
  
  return { document, error, loading };
}

/**
 * Hook for fetching a document once (not real-time)
 */
export function useFetchDocument<T = DocumentData>(
  collectionName: string,
  documentId: string | null,
  deps: any[] = []
) {
  const [document, setDocument] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!documentId) {
      setDocument(null);
      return;
    }

    const fetchDocument = async () => {
      setLoading(true);
      try {
        const docRef = doc(db, collectionName, documentId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setDocument({ ...(docSnap.data() as any), id: docSnap.id } as T);
          setError(null);
        } else {
          setDocument(null);
          setError(`Document ${documentId} not found in ${collectionName}`);
        }
      } catch (err: any) {
        console.error('Error fetching document:', err);
        setError(err.message);
        setDocument(null);
      } finally {
        setLoading(false);
      }
    };
    
    fetchDocument();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionName, documentId, ...deps]);
  
  return { document, error, loading };
}

/**
 * Create query constraints from parameters
 */
export function createQueryConstraints(
  filters: { field: string; operator: string; value: any }[] = [], 
  sortBy: { field: string; direction?: 'asc' | 'desc' }[] = []
): QueryConstraint[] {
  const constraints: QueryConstraint[] = [];
  
  // Add filters
  filters.forEach(filter => {
    constraints.push(where(filter.field, filter.operator as any, filter.value));
  });
  
  // Add sort orders
  sortBy.forEach(sort => {
    constraints.push(orderBy(sort.field, sort.direction || 'asc'));
  });
  
  return constraints;
}