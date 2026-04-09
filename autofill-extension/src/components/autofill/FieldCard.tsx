import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { FieldInfo } from "@/types/autofill";

type FieldCardProps = {
  field: FieldInfo;
  onValueChange: (domIndex: number, value: string) => void;
};

function getFieldLabel(field: FieldInfo) {
  return field.label || field.placeholder || field.name || field.id || "(unlabeled field)";
}

export function FieldCard({ field, onValueChange }: FieldCardProps) {
  return (
    <Card size="sm">
      <CardHeader className="gap-2">
        <CardTitle className="text-sm">{getFieldLabel(field)}</CardTitle>
        <div className="flex flex-wrap gap-1">
          <Badge variant="outline">{field.tag}</Badge>
          <Badge variant="secondary">{field.type ?? "unknown type"}</Badge>
          {!field.visible ? <Badge variant="secondary">hidden</Badge> : null}
          {field.disabled ? <Badge variant="secondary">disabled</Badge> : null}
          {field.readOnly ? <Badge variant="secondary">read-only</Badge> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <Input
          type="text"
          value={field.value ?? ""}
          onChange={(event) => onValueChange(field.domIndex, event.target.value)}
          placeholder={field.placeholder || field.label || "Field value"}
          disabled={field.disabled || field.readOnly}
        />

        <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <dt className="font-medium">name</dt>
          <dd className="truncate">{field.name || "-"}</dd>

          <dt className="font-medium">id</dt>
          <dd className="truncate">{field.id || "-"}</dd>

          <dt className="font-medium">placeholder</dt>
          <dd className="truncate">{field.placeholder || "-"}</dd>
        </dl>
      </CardContent>
    </Card>
  );
}
