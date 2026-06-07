// Configuration
const API_KEY = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY;
const SHEET_ID = import.meta.env.VITE_GOOGLE_SHEET_ID;

export interface SheetRow {
  [key: string]: string | number;
}

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

function assertSheetsConfig() {
  if (!API_KEY) {
    throw new Error('Google Sheets API key is not configured. Please add VITE_GOOGLE_SHEETS_API_KEY to your .env file');
  }

  if (!SHEET_ID) {
    throw new Error('Google Sheet ID is not configured. Please add VITE_GOOGLE_SHEET_ID to your .env file');
  }
}

function mapRowsToObjects(rows: string[][], useHeaders: boolean): SheetRow[] {
  if (!rows || rows.length === 0) return [];

  if (useHeaders) {
    const headers = rows[0] as string[];
    return rows.slice(1).map((row) => {
      const obj: SheetRow = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] || '';
      });
      return obj;
    });
  }

  return rows.map((row) => {
    const obj: SheetRow = {};
    row.forEach((cell, index) => {
      obj[`column_${index}`] = cell;
    });
    return obj;
  });
}

/**
 * Fetch data from Google Sheets
 * @param range - The A1 notation range (e.g., 'Sheet1!A1:D10' or 'Sheet1')
 * @param useHeaders - If true, first row will be used as headers
 * @returns Array of objects with sheet data
 */
export const fetchGoogleSheetData = async (
  range: string = 'Sheet1',
  useHeaders: boolean = true
): Promise<SheetRow[]> => {
  try {
    assertSheetsConfig();

    const url = `${SHEETS_API_BASE}/${SHEET_ID}/values/${encodeURIComponent(range)}?key=${API_KEY}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Google Sheets API error: ${response.status} ${response.statusText}`);
    }

    const payload = await response.json();
    const rows = payload.values as string[][] | undefined;

    if (!rows || rows.length === 0) {
      return [];
    }

    return mapRowsToObjects(rows, useHeaders);
  } catch (error) {
    throw error;
  }
};

/**
 * Fetch multiple sheets at once
 * @param ranges - Array of range strings
 * @returns Object with range names as keys and data as values
 */
export const fetchMultipleRanges = async (
  ranges: string[]
): Promise<{ [key: string]: SheetRow[] }> => {
  try {
    assertSheetsConfig();

    const params = new URLSearchParams({ key: API_KEY! });
    ranges.forEach((range) => params.append('ranges', range));

    const url = `${SHEETS_API_BASE}/${SHEET_ID}/values:batchGet?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Google Sheets API error: ${response.status} ${response.statusText}`);
    }

    const payload = await response.json();

    const result: { [key: string]: SheetRow[] } = {};

    payload.valueRanges?.forEach((valueRange: any, index: number) => {
      const rows = valueRange.values;
      if (rows && rows.length > 0) {
        result[ranges[index]] = mapRowsToObjects(rows as string[][], true);
      }
    });

    return result;
  } catch (error) {
    throw error;
  }
};

/**
 * Get sheet metadata (names, row counts, etc.)
 */
export const getSheetMetadata = async () => {
  try {
    assertSheetsConfig();

    const url = `${SHEETS_API_BASE}/${SHEET_ID}?key=${API_KEY}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Google Sheets API error: ${response.status} ${response.statusText}`);
    }

    const payload = await response.json();

    return {
      title: payload.properties?.title,
      sheets: payload.sheets?.map((sheet: any) => ({
        title: sheet.properties?.title,
        sheetId: sheet.properties?.sheetId,
        rowCount: sheet.properties?.gridProperties?.rowCount,
        columnCount: sheet.properties?.gridProperties?.columnCount,
      })),
    };
  } catch (error) {
    throw error;
  }
};
