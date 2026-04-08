import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type PageSummaryProps = {
  pageTitle: string;
  pageUrl: string;
};

export function PageSummary({ pageTitle, pageUrl }: PageSummaryProps) {
  if (!pageTitle && !pageUrl) {
    return null;
  }

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-sm">Active page</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-xs text-muted-foreground">
        {pageTitle ? <p className="font-medium text-foreground">{pageTitle}</p> : null}
        {pageUrl ? <p className="break-all">{pageUrl}</p> : null}
      </CardContent>
    </Card>
  );
}
