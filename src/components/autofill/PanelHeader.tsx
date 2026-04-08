import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type PanelHeaderProps = {
  fieldCount: number;
  isScanning: boolean;
  onRefresh: () => void;
};

export function PanelHeader({ fieldCount, isScanning, onRefresh }: PanelHeaderProps) {
  return (
    <Card size="sm">
      <CardHeader className="gap-2">
        <div className="flex items-center gap-2">
          <CardTitle>Detected fields</CardTitle>
          <Badge variant="outline">
            {fieldCount} {fieldCount === 1 ? "field" : "fields"}
          </Badge>
        </div>
        <CardDescription>Scan the active tab and prepare values before filling.</CardDescription>
        <CardAction>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isScanning}
          >
            {isScanning ? "Refreshing..." : "Refresh"}
          </Button>
        </CardAction>
      </CardHeader>
    </Card>
  );
}
