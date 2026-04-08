import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { FieldInfo } from "@/types/autofill";
import { FieldCard } from "./FieldCard";

type FieldListProps = {
  fields: FieldInfo[];
  isScanning: boolean;
  onFieldValueChange: (domIndex: number, value: string) => void;
};

export function FieldList({ fields, isScanning, onFieldValueChange }: FieldListProps) {
  if (isScanning && !fields.length) {
    return (
      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-sm">Scanning fields...</CardTitle>
          <CardDescription>Checking the active tab for editable inputs.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!fields.length) {
    return (
      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-sm">No fields detected</CardTitle>
          <CardDescription>
            Open a form on the active tab, then click Refresh to scan again.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          This popup only detects inputs on tabs where the extension can run.
        </CardContent>
      </Card>
    );
  }

  return (
    <ul className="space-y-2">
      {fields.map((field) => (
        <li key={`${field.domIndex}-${field.id}-${field.name}`}>
          <FieldCard field={field} onValueChange={onFieldValueChange} />
        </li>
      ))}
    </ul>
  );
}
