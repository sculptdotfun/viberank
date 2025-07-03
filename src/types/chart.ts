export interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    payload: {
      date: string;
      cost: number;
      tokens: number;
    };
  }>;
  label?: string;
}