import { useState, useEffect, useCallback } from 'react';
import { callApi } from '../api';
import type { Call, CallTranscript, CallAnalysis } from '../types';

export const useCall = (id?: string) => {
  const [call, setCall] = useState<Call | null>(null);
  const [transcript, setTranscript] = useState<CallTranscript | null>(null);
  const [analysis, setAnalysis] = useState<CallAnalysis | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchCallData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [callRes, transRes, analRes] = await Promise.all([
        callApi.getCall(id),
        callApi.getTranscript(id),
        callApi.getAnalysis(id),
      ]);
      const rawCall = callRes.data as any;
      setCall(rawCall.call ? rawCall.call : (callRes.data as Call));
      setTranscript(transRes.data as CallTranscript);
      setAnalysis(analRes.data as CallAnalysis);
    } catch (err) {
      console.error('Failed to fetch call data:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCallData();
  }, [fetchCallData]);

  return { call, transcript, analysis, loading, fetchCallData };
};

export const useCallActions = () => {
  const [loading, setLoading] = useState(false);

  const reprocessCall = async (id: string) => {
    setLoading(true);
    try {
      await callApi.reprocess(id);
    } catch (err) {
      console.error('Failed to reprocess call:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getAudioUrl = async (id: string) => {
    try {
      const response = await callApi.getAudio(id);
      return URL.createObjectURL(response.data as unknown as Blob);
    } catch (err) {
      console.error('Failed to get audio:', err);
      return null;
    }
  };

  return { reprocessCall, getAudioUrl, loading };
};
