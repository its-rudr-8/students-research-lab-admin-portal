import { useState, useEffect } from 'react';
import { fetchGoogleSheetData, getSheetMetadata, type SheetRow } from '@/lib/googleSheetsService';
import { useToast } from '@/hooks/use-toast';

interface UseGoogleSheetOptions {
  range?: string;
  useHeaders?: boolean;
  autoFetch?: boolean;
}

export const useGoogleSheet = (options: UseGoogleSheetOptions = {}) => {
  const {
    range = 'Sheet1',
    useHeaders = true,
    autoFetch = true,
  } = options;

  const [data, setData] = useState<SheetRow[]>([]);
  const [metadata, setMetadata] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const sheetData = await fetchGoogleSheetData(range, useHeaders);
      setData(sheetData);
      
      return sheetData;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch Google Sheets data';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const fetchMetadata = async () => {
    try {
      const meta = await getSheetMetadata();
      setMetadata(meta);
      return meta;
    } catch (err) {
      return null;
    }
  };

  const refresh = () => fetchData();

  useEffect(() => {
    if (autoFetch) {
      fetchData();
      fetchMetadata();
    }
  }, [range, useHeaders, autoFetch]);

  return {
    data,
    metadata,
    loading,
    error,
    refresh,
    fetchData,
    fetchMetadata,
  };
};
