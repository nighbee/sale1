import { useState, useEffect, useCallback } from 'react';
import { teamApi } from '../api';
import type { Team } from '../types';

export const useTeams = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTeams = useCallback(async () => {
    setLoading(true);
    try {
      const response = await teamApi.list();
      setTeams(response.data.teams);
    } catch (err) {
      console.error('Failed to fetch teams:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  const createTeam = async (data: unknown) => {
    await teamApi.create(data);
    await fetchTeams();
  };

  const ensureTeam = async (data: unknown) => {
    await teamApi.ensure(data);
    await fetchTeams();
  };

  const deleteTeam = async (id: string) => {
    await teamApi.delete(id);
    await fetchTeams();
  };

  return { teams, loading, fetchTeams, createTeam, ensureTeam, deleteTeam };
};
