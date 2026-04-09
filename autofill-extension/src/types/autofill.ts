export type FieldInfo = {
  domIndex: number;
  tag: string;
  type: string | null;
  name: string;
  id: string;
  placeholder: string;
  label: string;
  value: string;
  visible: boolean;
  disabled: boolean;
  readOnly: boolean;
};

export type ScanFieldsResponse = {
  fields?: FieldInfo[];
  title?: string;
  url?: string;
};

export type FillFieldPayload = {
  domIndex: number;
  value: string;
};

export type FillFieldsResponse = {
  updated: number;
  total: number;
  error?: string;
};
