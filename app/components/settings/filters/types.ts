import type { IMiddleware } from '~/lib/hooks/useFilters';

export interface FilterItem {
  id: number;
  name: string;
  order: number;
  enabled?: boolean;
  inputs: IMiddleware['inputs'];
  content: string;
}
