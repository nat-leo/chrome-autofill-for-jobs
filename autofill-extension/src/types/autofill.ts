import type {
  ExtensionResponse,
  FillFieldInput,
  FillFieldsResult,
  ScannedField,
} from "@/lib/chrome-interface";

export type FieldInfo = ScannedField & {
  value: string;
};

export type ScanFieldsResponse = ExtensionResponse<ScannedField[]>;

export type FillFieldPayload = FillFieldInput;

export type FillFieldsResponse = ExtensionResponse<FillFieldsResult>;
