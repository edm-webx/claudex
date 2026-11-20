/** DKN-06: the four themes of a café/bistro: floor colours + pattern, wall colours, sign colour. Darker and more saturated than the old ones (no near-white walls). */
export type TemaId = 'retro' | 'modern' | 'bohem' | 'deniz';
export interface TemaPaketi { id: TemaId; ad: string; zemin: [string, string]; desen: 'cizgi' | 'dama' | 'tahta' | 'fayans'; duvar: [string, string]; tabela: string }
export const KAFE_TEMA: Record<TemaId, TemaPaketi> = {
  retro: { id: 'retro', ad: 'Retro', zemin: ['#6e3418', '#c99a4a'], desen: 'cizgi', duvar: ['#2a6b5c', '#8f2f1f'], tabela: '#ffd27a' },
  modern: { id: 'modern', ad: 'Modern', zemin: ['#5a5d63', '#3c3f45'], desen: 'dama', duvar: ['#8a8f96', '#25262b'], tabela: '#f4f4f2' },
  bohem: { id: 'bohem', ad: 'Bohem', zemin: ['#8a5430', '#c98a4e'], desen: 'tahta', duvar: ['#b4573a', '#d4a55c'], tabela: '#f6e3b4' },
  deniz: { id: 'deniz', ad: 'Deniz', zemin: ['#c9bf9f', '#2f77b3'], desen: 'fayans', duvar: ['#4c8fbf', '#16406f'], tabela: '#e8f4ff' },
};
