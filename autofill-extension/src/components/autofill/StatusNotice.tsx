import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type StatusNoticeProps = {
  error: string;
  status: string;
};

export function StatusNotice({ error, status }: StatusNoticeProps) {
  if (!error && !status) {
    return null;
  }

  return (
    <div className="space-y-2">
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Action failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {status ? (
        <Alert>
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{status}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
