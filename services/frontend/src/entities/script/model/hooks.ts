import { useState, useEffect, useCallback } from "react";
import { scriptApi } from "../api";
import type { Script } from "../types";

export const useScripts = () => {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchScripts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await scriptApi.list();
      // Ensure we handle both { scripts: [...] } and direct array (legacy)
      const data = response.data as any;
      const scriptsList = Array.isArray(data) ? data : (data.scripts || []);
      setScripts(scriptsList);
      setError(null);
    } catch (err) {
      // try to extract API error message
      const apiErr = err as unknown as {
        response?: { data?: { error?: string } };
      };
      const msg = apiErr?.response?.data?.error || "Failed to fetch scripts";
      setError(msg);
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

  const downloadScript = async (id: string, name: string) => {
    try {
      const response = await scriptApi.download(id);
      // Ensure we have a Blob. Axios with responseType: 'blob' returns Blob in response.data
      const blob = response.data instanceof Blob
        ? response.data
        : new Blob([response.data as any]);

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
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
    downloadScript,
  };
};

export const useScript = (id?: string) => {
  const [script, setScript] = useState<Script | null>(null);
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchScriptDetails = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [detailsRes, contentRes] = await Promise.all([
        scriptApi.get(id),
        scriptApi.getContent(id).catch(() => ({ data: { parsed_text: "" } })),
      ]);
      setScript(detailsRes.data);
      // Backend might return parsed_text or content
      const contentData = contentRes.data as any;
      setContent(contentData.parsed_text || contentData.content || "");
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Failed to fetch script details");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchScriptDetails();
  }, [fetchScriptDetails]);

  return {
    script,
    content,
    loading,
    error,
    refetch: fetchScriptDetails,
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
      const data = listRes.data as any;
      const baseScriptsList = Array.isArray(data) ? data : (data.base_scripts || []);
      setBaseScripts(baseScriptsList);
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

  return {
    baseScripts,
    currentBase,
    loading,
    fetchBaseScripts,
    activateAsBase,
  };
};
