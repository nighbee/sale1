import { useState, useEffect, useCallback } from 'react';
import { scriptApi } from '../api';
import type { Script } from '../types';

export const useScripts = () => {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchScripts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await scriptApi.list();
      setScripts(response.data.scripts);
      setError(null);
    } catch (err) {
      setError('Failed to fetch scripts');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScripts();
  }, [fetchScripts]);

  const uploadScript = async (formData: FormData) => {
    try {
      await scriptApi.upload(formData);
      await fetchScripts();
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const deleteScript = async (id: string) => {
    try {
      await scriptApi.delete(id);
      await fetchScripts();
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const updateScript = async (id: string, name: string) => {
    try {
      await scriptApi.update(id, { name });
      await fetchScripts();
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  return {
    scripts,
    loading,
    error,
    fetchScripts,
    uploadScript,
    deleteScript,
    updateScript,
  };
};

export const useBaseScripts = () => {
  const [baseScripts, setBaseScripts] = useState<Script[]>([]);
  const [currentBase, setCurrentBase] = useState<Script | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchBaseScripts = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, currentRes] = await Promise.all([
        scriptApi.listBaseScripts(),
        scriptApi.getBaseScript().catch(() => ({ data: null })),
      ]);
      setBaseScripts(listRes.data.scripts);
      setCurrentBase(currentRes.data as Script | null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const activateAsBase = async (id: string) => {
    await scriptApi.activateAsBase(id);
    await fetchBaseScripts();
  };

  return { baseScripts, currentBase, loading, fetchBaseScripts, activateAsBase };
};
